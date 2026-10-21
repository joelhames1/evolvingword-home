// The looking-glass in the passage out of the reading room. It doubles
// everything, the way the story's mirror does, which is how anyone could
// believe the library goes on forever. Old glass: the silvering gone dim at the
// edges and foxed in patches. It really reflects, in a small picture, and only
// when you're close enough to see it.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import type { Quality } from '../../world';

const OLD_GLASS = {
  name: 'OldGlass',
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null } },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec2 vPlane;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vPlane = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    varying vec4 vUv;
    varying vec2 vPlane;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    void main() {
      vec3 base = texture2DProj(tDiffuse, vUv).rgb;
      vec2 q = vPlane * vec2(1.0, 1.7);
      float n = noise(q * 5.0) * 0.6 + noise(q * 19.0) * 0.4;
      float fox = smoothstep(0.7, 0.9, n) * 0.6;
      float edge = min(min(vPlane.x, 1.0 - vPlane.x), min(vPlane.y, 1.0 - vPlane.y));
      float dim = 0.55 + 0.45 * smoothstep(0.0, 0.16, edge);
      vec3 c = base * color * dim * (1.0 - fox * 0.7) + vec3(0.05, 0.035, 0.02) * fox;
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }
  `,
};

export function buildMirror(quality: Quality, frameMat: THREE.Material) {
  const group = new THREE.Group();
  const w = 1.05;
  const h = 1.85;
  // A small picture is plenty for old glass: smaller still, and drawn less often, on the low tier.
  const high = quality === 'high';
  const glass = new Reflector(new THREE.PlaneGeometry(w, h), { textureWidth: high ? 512 : 320, textureHeight: high ? 900 : 560, color: '#c9bca2', shader: OLD_GLASS, multisample: 0 });
  // Only worth the extra picture when you're near enough to see it.
  const draw = glass.onBeforeRender;
  let n = 0;
  const at = new THREE.Vector3();
  glass.onBeforeRender = function (renderer, scene, camera, ...rest) {
    if (camera.position.distanceTo(glass.getWorldPosition(at)) > 9 || n++ % (high ? 2 : 3)) return;
    draw.call(this, renderer, scene, camera, ...rest);
  };
  group.add(glass);
  // A plain dark frame.
  for (const [fw, fh, x, y] of [
    [w + 0.16, 0.08, 0, h / 2 + 0.04],
    [w + 0.16, 0.08, 0, -h / 2 - 0.04],
    [0.08, h, -w / 2 - 0.04, 0],
    [0.08, h, w / 2 + 0.04, 0],
  ]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.05), frameMat);
    f.position.set(x, y, 0.005);
    group.add(f);
  }
  return group;
}
