// The renderer, the scene, the camera and the film look laid over everything:
// bloom on the lamps, grain, a vignette, a touch of lens fringing, and a
// "lo-fi" switch that drops it to chunky 90s pixels and scanlines.
import * as THREE from 'three';
import {
  BlendFunction,
  BloomEffect,
  Effect,
  ChromaticAberrationEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  PixelationEffect,
  RenderPass,
  ScanlineEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';

export type Quality = 'high' | 'low';

export interface World {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  quality: Quality;
  /** Runs every frame with seconds since start and since the last frame. */
  onTick(fn: (t: number, dt: number) => void): void;
  setLofi(on: boolean): void;
  /** Seconds since start, as the frame loop sees it. */
  elapsed(): number;
  /** Slow down or stop the clock (0 freezes it): for screenshots and tests. */
  setTimeScale(s: number): void;
  start(): void;
  render(): void;
}

export function createWorld(host: HTMLElement, quality: Quality): World {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false, depth: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 1.75 : 1));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05060d');

  const camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.05, 3200);

  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: quality === 'high' ? 4 : 0 });
  composer.addPass(new RenderPass(scene, camera));
  // A safety net: a pixel that came out as not-a-number or infinite (one bad
  // shader expression is enough) would be smeared by the bloom into flashing
  // black blocks. Catch it here, before anything spreads it.
  composer.addPass(
    new EffectPass(
      camera,
      new Effect(
        'Finite',
        /* glsl */ `
          void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
            vec4 c = inputColor;
            bool bad = any(isnan(c)) || any(isinf(c)) || c.r != c.r || c.g != c.g || c.b != c.b;
            outputColor = bad ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(min(c.rgb, vec3(64.0)), c.a);
          }
        `,
      ),
    ),
  );
  const bloom = new BloomEffect({ mipmapBlur: true, intensity: 1.35, luminanceThreshold: 0.55, luminanceSmoothing: 0.25, radius: 0.72 });
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
  const vignette = new VignetteEffect({ offset: 0.28, darkness: 0.72 });
  const grain = new NoiseEffect({ premultiply: true, blendFunction: BlendFunction.SCREEN });
  grain.blendMode.opacity.value = 0.32;
  const scan = new ScanlineEffect({ density: 1.6, blendFunction: BlendFunction.OVERLAY });
  scan.blendMode.opacity.value = 0;
  composer.addPass(new EffectPass(camera, bloom, tone, vignette, grain, scan));
  const fringe = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0009, 0.0007), radialModulation: true, modulationOffset: 0.35 });
  const fringePass = new EffectPass(camera, fringe);
  composer.addPass(fringePass);
  const pixels = new PixelationEffect(4);
  const pixelPass = new EffectPass(camera, pixels);
  composer.addPass(pixelPass);
  // The composer only draws its last pass to the screen, so lo-fi hands that job
  // back and forth instead of leaving a switched-off pass holding it.
  composer.autoRenderToScreen = false;
  const lofiPass = (on: boolean) => {
    pixelPass.enabled = on;
    pixelPass.renderToScreen = on;
    fringePass.renderToScreen = !on;
  };
  lofiPass(false);

  const ticks: ((t: number, dt: number) => void)[] = [];
  const timer = new THREE.Timer();
  timer.connect(document);

  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);

  const frame = (now?: number) => {
    timer.update(now);
    // Never backwards (the first frame can come out a hair negative), never a big jump.
    const dt = THREE.MathUtils.clamp(timer.getDelta(), 0, 0.1);
    const t = timer.getElapsed();
    for (const f of ticks) f(t, dt);
    composer.render(dt);
  };

  return {
    renderer,
    scene,
    camera,
    quality,
    onTick: (fn) => ticks.push(fn),
    setLofi(on) {
      lofiPass(on);
      scan.blendMode.opacity.value = on ? 0.55 : 0;
      grain.blendMode.opacity.value = on ? 0.5 : 0.32;
      bloom.intensity = on ? 1.9 : 1.35;
    },
    elapsed: () => timer.getElapsed(),
    setTimeScale: (k) => timer.setTimescale(k),
    start() {
      timer.reset();
      renderer.setAnimationLoop(frame);
    },
    render: () => frame(),
  };
}
