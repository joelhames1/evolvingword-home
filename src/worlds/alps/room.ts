// The study: a pine-paneled room high on the shore, beams overhead, a rug on the
// boards, and one big window onto the lake and the mountains.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { ROOM } from '../../layout';
import { boards, paneling, rug } from '../../textures';

/** The window opening in the back wall. */
export const WINDOW = { x0: -1.9, x1: 1.9, y0: 0.95, y1: 2.32 };

export interface Room {
  group: THREE.Group;
  glass: THREE.ShaderMaterial;
  /** Evening light through the window, throwing the frame's shadow on the desk. */
  windowLight: THREE.SpotLight;
  /** Warm lamps on the walls, so the far side of the room isn't a cave. */
  sconces: THREE.PointLight[];
  tick(t: number): void;
}

const GLASS_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
// Old glass on a cold evening: a little frost creeping in from the corners of
// each pane, otherwise clear.
const GLASS_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec2 uAspect;
  varying vec2 vUv;
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  void main() {
    // Distance, in meters, to the nearest edge of the pane we're in: one big
    // pane below the transom, four small ones above it.
    float w = uAspect.x;
    vec2 m = vUv * vec2(w, 1.0);
    float split = 0.9;
    float edge;
    if (vUv.y > split) {
      float cellW = w / 4.0;
      float fx = mod(m.x, cellW);
      edge = min(min(fx, cellW - fx), min(vUv.y - split, 1.0 - vUv.y));
    } else {
      edge = min(min(m.x, w - m.x), min(vUv.y, split - vUv.y));
    }
    // Frost creeps in from the edges, ragged, thicker at the bottom.
    float n = noise(m * 14.0) * 0.6 + noise(m * 47.0) * 0.4;
    float reach = 0.03 + 0.045 * n + 0.04 * (1.0 - smoothstep(0.0, 0.3, vUv.y));
    float frost = 1.0 - smoothstep(reach * 0.4, reach, edge);
    float a = frost * (0.28 + 0.2 * noise(m * 120.0));
    gl_FragColor = vec4(vec3(0.86, 0.88, 0.96), a);
  }
`;

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, cast = false) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

export function buildRoom(): Room {
  RectAreaLightUniformsLib.init();
  const group = new THREE.Group();
  const { x0, x1, z0, z1, h } = ROOM;
  const W = WINDOW;

  // Pine on every wall. Each piece gets its own repeat, so the boards stay 20cm wide.
  const pine = paneling(17);
  const pineFor = (w: number, ht: number) => {
    const tx = pine.clone();
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
    tx.repeat.set(w / 1.6, ht / 2.8);
    tx.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: tx, roughness: 0.62, metalness: 0 });
  };
  const trimMat = new THREE.MeshStandardMaterial({ color: '#3b2414', roughness: 0.55 });
  const floorMat = new THREE.MeshStandardMaterial({ map: boards(5), roughness: 0.5, metalness: 0.02 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, (z0 + z1) / 2);
  floor.receiveShadow = true;
  group.add(floor);
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.0), new THREE.MeshStandardMaterial({ map: rug(), roughness: 0.95 }));
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(0.1, 0.004, -0.05);
  carpet.receiveShadow = true;
  group.add(carpet);

  // Ceiling boards and three heavy beams.
  const ceilTex = pine.clone();
  ceilTex.wrapS = ceilTex.wrapT = THREE.RepeatWrapping;
  ceilTex.repeat.set(3, 3);
  ceilTex.needsUpdate = true;
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshStandardMaterial({ map: ceilTex, color: '#8a6a52', roughness: 0.8 }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, h, (z0 + z1) / 2);
  group.add(ceiling);
  for (const bz of [-1.1, 0.4, 1.9]) group.add(box(x1 - x0, 0.18, 0.16, trimMat, 0, h - 0.09, bz));

  // Back wall around the window, then the sides and the front.
  const t = 0.24;
  const zb = z0 - t / 2;
  group.add(box(x1 - x0, W.y0, t, pineFor(x1 - x0, W.y0), 0, W.y0 / 2, zb));
  group.add(box(x1 - x0, h - W.y1, t, pineFor(x1 - x0, h - W.y1), 0, (h + W.y1) / 2, zb));
  group.add(box(W.x0 - x0, W.y1 - W.y0, t, pineFor(W.x0 - x0, W.y1 - W.y0), (x0 + W.x0) / 2, (W.y0 + W.y1) / 2, zb));
  group.add(box(x1 - W.x1, W.y1 - W.y0, t, pineFor(x1 - W.x1, W.y1 - W.y0), (x1 + W.x1) / 2, (W.y0 + W.y1) / 2, zb));
  group.add(box(t, h, z1 - z0, pineFor(z1 - z0, h), x0 - t / 2, h / 2, (z0 + z1) / 2));
  group.add(box(t, h, z1 - z0, pineFor(z1 - z0, h), x1 + t / 2, h / 2, (z0 + z1) / 2));
  group.add(box(x1 - x0 + 2 * t, h, t, pineFor(x1 - x0, h), 0, h / 2, z1 + t / 2));
  // Skirting and a picture rail.
  for (const [w, x, z, ry] of [
    [x1 - x0, 0, z0 + 0.012, 0],
    [x1 - x0, 0, z1 - 0.012, 0],
    [z1 - z0, x0 + 0.012, (z0 + z1) / 2, Math.PI / 2],
    [z1 - z0, x1 - 0.012, (z0 + z1) / 2, Math.PI / 2],
  ] as const) {
    const s = box(w, 0.12, 0.025, trimMat, x, 0.06, z);
    s.rotation.y = ry;
    group.add(s);
    const rail = box(w, 0.035, 0.03, trimMat, x, 2.4, z);
    rail.rotation.y = ry;
    group.add(rail);
  }

  // The window: a deep wooden frame, a sill, frosty glass.
  const frameMat = new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.5 });
  const fw = 0.07;
  const cx = (W.x0 + W.x1) / 2;
  const cy = (W.y0 + W.y1) / 2;
  const ww = W.x1 - W.x0;
  const wh = W.y1 - W.y0;
  group.add(box(ww + fw, fw, 0.1, frameMat, cx, W.y0, z0 - 0.06, true));
  group.add(box(ww + fw, fw, 0.1, frameMat, cx, W.y1, z0 - 0.06, true));
  // A picture window: one big pane, with a row of small panes above a transom.
  const transom = W.y0 + wh * 0.9;
  group.add(box(ww + fw, fw * 0.8, 0.09, frameMat, cx, transom, z0 - 0.06, true));
  for (const fx of [W.x0, W.x1]) group.add(box(fw, wh, 0.09, frameMat, fx, cy, z0 - 0.06, true));
  for (let k = 1; k < 4; k++) {
    const fx = W.x0 + (ww * k) / 4;
    group.add(box(fw * 0.55, W.y1 - transom, 0.08, frameMat, fx, (W.y1 + transom) / 2, z0 - 0.06, true));
  }
  group.add(box(ww + 0.32, 0.045, 0.32, trimMat, cx, W.y0 - 0.02, z0 + 0.09, true));
  const glass = new THREE.ShaderMaterial({
    vertexShader: GLASS_VERT,
    fragmentShader: GLASS_FRAG,
    uniforms: { uTime: { value: 0 }, uAspect: { value: new THREE.Vector2(ww / wh, 1) } },
    transparent: true,
    depthWrite: false,
  });
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), glass);
  pane.position.set(cx, cy, z0 - 0.1);
  group.add(pane);

  // A radiator under the window, painted cream, and a wool curtain.
  const radMat = new THREE.MeshStandardMaterial({ color: '#cbbf9f', roughness: 0.5, metalness: 0.2 });
  for (let i = 0; i < 16; i++) group.add(box(0.05, 0.52, 0.09, radMat, -0.9 + i * 0.12, 0.4, z0 + 0.12, true));
  group.add(box(1.95, 0.035, 0.06, radMat, 0, 0.15, z0 + 0.12));
  // The curtain hangs beside the window, gathered, clear of the desk and just
  // overlapping the frame; its folds deepen and flare a little toward the hem.
  const curtainGeo = new THREE.PlaneGeometry(0.5, 2.58, 40, 10);
  const cpos = curtainGeo.attributes.position;
  for (let i = 0; i < cpos.count; i++) {
    const x = cpos.getX(i);
    const low = 1 - (cpos.getY(i) + 1.29) / 2.58;
    cpos.setX(i, x * (1 + low * 0.12));
    cpos.setZ(i, Math.sin(x * 46) * (0.03 + low * 0.012) + Math.sin(x * 15) * 0.014);
  }
  curtainGeo.computeVertexNormals();
  const curtain = new THREE.Mesh(curtainGeo, new THREE.MeshStandardMaterial({ color: '#6e2a22', roughness: 0.95, side: THREE.DoubleSide }));
  curtain.position.set(W.x0 - 0.2, 1.42, z0 + 0.1);
  curtain.castShadow = true;
  group.add(curtain);
  group.add(box(ww + 0.9, 0.03, 0.03, trimMat, cx, 2.72, z0 + 0.2));

  // Evening light through the window: cool, with the frame's shadow across the desk.
  const windowLight = new THREE.SpotLight('#8c8fd0', 40, 22, 0.32, 0.45, 1.25);
  windowLight.position.set(-1.0, 8.5, -8.5);
  windowLight.target.position.set(0.2, 0.76, -1.2);
  windowLight.castShadow = true;
  windowLight.shadow.mapSize.set(1024, 1024);
  windowLight.shadow.bias = -0.0005;
  windowLight.shadow.normalBias = 0.03;
  windowLight.shadow.camera.near = 4;
  windowLight.shadow.camera.far = 20;
  group.add(windowLight, windowLight.target);
  const fill = new THREE.RectAreaLight('#6f74c8', 0.9, ww, wh);
  fill.position.set(cx, cy, z0 - 0.15);
  fill.lookAt(cx, cy, 1);
  group.add(fill);
  group.add(new THREE.HemisphereLight('#3a3f6a', '#2a160a', 0.12));

  // Brass sconces on the side walls and one by the bookshelf.
  const sconces: THREE.PointLight[] = [];
  const brass = new THREE.MeshStandardMaterial({ color: '#b08a3e', metalness: 0.9, roughness: 0.35 });
  const shadeMat = new THREE.MeshStandardMaterial({ color: '#f3d9a8', emissive: '#ffb860', emissiveIntensity: 1.4, roughness: 0.8, side: THREE.DoubleSide });
  for (const [x, z, ry] of [
    [x0 + 0.06, -0.95, Math.PI / 2],
    [x1 - 0.06, 1.15, -Math.PI / 2],
    [1.55, z1 - 0.06, Math.PI],
  ] as const) {
    const s = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 20), brass);
    plate.rotation.x = Math.PI / 2;
    s.add(plate);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 8), brass);
    arm.rotation.x = Math.PI / 2;
    arm.position.z = 0.07;
    s.add(arm);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.085, 0.13, 24, 1, true), shadeMat);
    shade.position.set(0, 0.04, 0.14);
    s.add(shade);
    s.position.set(x, 1.95, z);
    s.rotation.y = ry;
    group.add(s);
    s.updateMatrixWorld();
    const light = new THREE.PointLight('#ffb766', 1.6, 3.6, 1.6);
    light.position.copy(s.localToWorld(new THREE.Vector3(0, 0.02, 0.16)));
    group.add(light);
    sconces.push(light);
  }

  return {
    group,
    glass,
    windowLight,
    sconces,
    tick(time) {
      glass.uniforms.uTime.value = time;
    },
  };
}
