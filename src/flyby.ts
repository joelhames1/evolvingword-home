// Every so often a patrol spinner drifts past the window and its searchlight
// sweeps through the room: the window frame's shadow, and the rain running down
// the glass, crawling across the desk and walls.
import * as THREE from 'three';
import { glow } from './textures';

export interface Flyby {
  group: THREE.Group;
  /** True while a pass is underway. */
  readonly active: boolean;
  /** Starts a pass now. Returns how long it takes, in seconds. */
  pass(t: number): number;
  tick(t: number): void;
}

const DURATION = 12;
const PATH = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(-70, 11, -30),
    new THREE.Vector3(-20, 4.6, -12),
    new THREE.Vector3(-4.5, 2.25, -8.4),
    new THREE.Vector3(3.5, 2.15, -8),
    new THREE.Vector3(15, 4, -11),
    new THREE.Vector3(60, 12, -28),
  ],
  false,
  'centripetal',
);
/** Where the light searches inside the room, from the first look to the last. */
const SEARCH_FROM = new THREE.Vector3(-1.7, 0.85, -0.9);
const SEARCH_TO = new THREE.Vector3(2.2, 1.3, 1.9);

/** Slow in the middle, where it's looking at us; quick at the ends. */
function warp(k: number) {
  const x = k * 2 - 1;
  return 0.5 + (x * 0.3 + x * x * x * 0.7) / 2;
}

export function buildFlyby(lightMap: THREE.Texture | null): Flyby {
  const group = new THREE.Group();
  const ship = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: '#3a3f4a', roughness: 0.28, metalness: 0.85 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 2.6, 6, 16), hullMat);
  body.rotation.x = Math.PI / 2;
  body.scale.set(1, 1, 0.62);
  ship.add(body);
  // Running lights down each flank, and a glow underneath where it hovers.
  const strip = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.6, 3), toneMapped: false });
  for (const side of [-1, 1]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 2.6), strip);
    line.position.set(side * 0.56, -0.05, 0.1);
    ship.add(line);
  }
  const under = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow('rgba(90,170,255,1)', 64), color: new THREE.Color(1.4, 1.4, 1.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  under.position.set(0, -0.55, 0);
  under.scale.set(3.2, 1.2, 1);
  ship.add(under);
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#0a1a20', roughness: 0.1, metalness: 0.9, emissive: '#0f3a44', emissiveIntensity: 0.6 }),
  );
  canopy.scale.set(0.9, 0.7, 1.7);
  canopy.position.set(0, 0.2, 0.45);
  ship.add(canopy);
  for (const side of [-1, 1]) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.2, 12), hullMat);
    pod.rotation.x = Math.PI / 2;
    pod.position.set(side * 0.75, -0.12, -0.6);
    ship.add(pod);
    const fire = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow('rgba(255,150,60,1)', 64), color: new THREE.Color(2.5, 1.6, 1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    fire.position.set(side * 0.75, -0.12, -1.3);
    fire.scale.setScalar(0.9);
    ship.add(fire);
  }
  // Light bar on the roof: red and blue, taking turns.
  const RED = new THREE.Color(4, 0.2, 0.2);
  const BLUE = new THREE.Color(0.2, 0.6, 4);
  const red = new THREE.MeshBasicMaterial({ color: RED.clone(), toneMapped: false });
  const blue = new THREE.MeshBasicMaterial({ color: BLUE.clone(), toneMapped: false });
  const redBar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.12), red);
  const blueBar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.12), blue);
  redBar.position.set(-0.16, 0.4, -0.25);
  blueBar.position.set(0.16, 0.4, -0.25);
  ship.add(redBar, blueBar);
  const flash = (color: string) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(color, 64), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(1.6);
    return s;
  };
  const redFlash = flash('rgba(255,40,40,1)');
  const blueFlash = flash('rgba(60,140,255,1)');
  redFlash.position.copy(redBar.position);
  blueFlash.position.copy(blueBar.position);
  ship.add(redFlash, blueFlash);
  const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow('rgba(255,250,235,1)', 64), color: new THREE.Color(3, 3, 3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  head.position.set(0, -0.2, 1.75);
  head.scale.setScalar(1.4);
  ship.add(head);
  ship.visible = false;
  group.add(ship);

  // The searchlight, shaped by our window on the way in, with the rain as its slide.
  const light = new THREE.SpotLight('#e4ecff', 0, 30, 0.2, 0.35, 1);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.bias = -0.0005;
  light.shadow.normalBias = 0.03;
  light.shadow.camera.near = 1;
  light.shadow.camera.far = 16;
  // Drawn once now so the shadow map exists from the first frame (materials
  // that sample a missing one fail to draw at all), then only during a pass.
  light.shadow.autoUpdate = false;
  light.shadow.needsUpdate = true;
  if (lightMap) light.map = lightMap;
  group.add(light, light.target);

  // The beam you can see outside, stopping at our glass.
  const beamGeo = new THREE.CylinderGeometry(0.06, 1, 1, 24, 1, true);
  beamGeo.translate(0, -0.5, 0);
  beamGeo.rotateX(-Math.PI / 2);
  const beamMat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vFacing;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying float vFacing;
      uniform float uStrength;
      void main() {
        // Thicker through the middle of the cone, like light in rain.
        float body = pow(vFacing, 1.6);
        gl_FragColor = vec4(vec3(0.85, 0.9, 1.0), (0.04 + 0.22 * vUv.y) * body * uStrength);
      }
    `,
    uniforms: { uStrength: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.visible = false;
  group.add(beam);

  let start = -1;
  const pos = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const nose = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const toAim = new THREE.Vector3();

  return {
    group,
    get active() {
      return start >= 0;
    },
    pass(t) {
      start = t;
      ship.visible = true;
      beam.visible = true;
      light.shadow.autoUpdate = true;
      return DURATION;
    },
    tick(t) {
      if (start < 0) return;
      const k = (t - start) / DURATION;
      if (k >= 1) {
        start = -1;
        ship.visible = false;
        beam.visible = false;
        light.intensity = 0;
        light.shadow.autoUpdate = false;
        return;
      }
      const u = warp(k);
      PATH.getPoint(u, pos);
      PATH.getPoint(Math.min(1, u + 0.01), ahead);
      ship.position.copy(pos);
      ship.position.y += Math.sin(t * 1.3) * 0.08;
      ship.lookAt(ahead.x, ship.position.y, ahead.z);
      // Bank into the curve, then level out to hover past the window.
      const near = Math.exp(-Math.pow((u - 0.5) / 0.14, 2));
      ship.rotateZ((ahead.z - pos.z) * -0.6 * (1 - near));
      const on = Math.floor(t * 6) % 2 === 0;
      redFlash.visible = on;
      blueFlash.visible = !on;
      red.color.copy(RED).multiplyScalar(on ? 1 : 0.15);
      blue.color.copy(BLUE).multiplyScalar(on ? 0.15 : 1);
      // The light looks around the room as it goes by, a little restless.
      aim.lerpVectors(SEARCH_FROM, SEARCH_TO, THREE.MathUtils.smoothstep(u, 0.36, 0.64));
      aim.x += Math.sin(t * 1.9) * 0.25;
      aim.y += Math.sin(t * 2.7 + 1) * 0.12;
      nose.set(0, -0.3, 1.6).applyMatrix4(ship.matrixWorld);
      light.position.copy(nose);
      light.target.position.copy(aim);
      light.intensity = 190 * near;
      // The visible beam runs from the nose to where it meets our wall.
      toAim.subVectors(aim, nose);
      const toWall = (-2.24 - nose.z) / toAim.z;
      const len = toAim.length() * THREE.MathUtils.clamp(toWall, 0, 1);
      beam.position.copy(nose);
      beam.lookAt(aim);
      const spread = Math.tan(light.angle) * len;
      beam.scale.set(spread, spread, len);
      beamMat.uniforms.uStrength.value = 0.25 + near * 0.9;
    },
  };
}
