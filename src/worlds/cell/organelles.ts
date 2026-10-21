// What floats in the cell: the nucleus with its double envelope and its pores,
// the threads of chromatin and the nucleolus inside; mitochondria, their inner
// membranes folded into cristae; the Golgi's stack of curved ribbons, budding
// vesicles at its rims; folded sheets of endoplasmic reticulum studded with
// ribosomes; and vesicles drifting everywhere. All of it glass and light.
import * as THREE from 'three';
import { rng } from '../../textures';
import { CELL, glass, HAZE, NOISE, shared } from './shaders';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Evenly spread points on a sphere (a Fibonacci spiral). */
function spread(n: number, i: number) {
  const y = 1 - ((i + 0.5) / n) * 2;
  const r = Math.sqrt(1 - y * y);
  const a = i * Math.PI * (3 - Math.sqrt(5));
  return v(Math.cos(a) * r, y, Math.sin(a) * r);
}

// The nucleolus: a dense knot of light, grainy, slowly churning.
const KNOT_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying vec3 vWorld;
  varying vec3 vNrm;
  varying vec3 vLocal;
  ${HAZE}
  ${NOISE}
  void main() {
    vec3 v = normalize(cameraPosition - vWorld);
    // Clamped: a hair over 1 would make pow(1.0 - ndv, ...) a NaN, and NaNs flash black.
    float ndv = min(abs(dot(normalize(vNrm), v)), 1.0);
    float grain = vnoise(vLocal * 9.0 + vec3(0.0, uTime * 0.05, 0.0));
    float body = pow(ndv, 2.5) * (0.55 + 0.35 * grain) + pow(1.0 - ndv, 3.0) * 0.25;
    gl_FragColor = vec4(uColor * body * through(vWorld), 1.0);
  }
`;
const KNOT_VERT = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNrm;
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNrm = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

export interface Nucleus {
  group: THREE.Group;
  center: THREE.Vector3;
  radius: number;
  tick(t: number): void;
}

/** The nucleus: a great violet dome of a double membrane, its pores ringed in gold. */
export function buildNucleus(center: THREE.Vector3, radius: number, quality: 'high' | 'low'): Nucleus {
  const group = new THREE.Group();
  group.position.copy(center);
  const r = rng(7);
  const segs = quality === 'high' ? 96 : 64;
  const shell = new THREE.SphereGeometry(1, segs, segs / 2);
  const outer = new THREE.Mesh(shell, glass({ color: '#5a5cff', edge: '#9a8cff', core: 0.02, rim: 0.85, power: 3.0, shimmer: 0.7 }));
  outer.scale.setScalar(radius);
  const inner = new THREE.Mesh(shell, glass({ color: '#3f9fff', edge: '#6ac7ff', core: 0.015, rim: 0.3, power: 3.6, shimmer: 0.4 }));
  inner.scale.setScalar(radius - 0.14);
  group.add(outer, inner);

  // The pores: points of gold light all over the envelope, like lamps in a dome.
  const pores = quality === 'high' ? 1400 : 800;
  const porePts: number[] = [];
  for (let i = 0; i < pores; i++) {
    const n = spread(pores, i).add(v((r() - 0.5) * 0.03, (r() - 0.5) * 0.03, (r() - 0.5) * 0.03)).normalize();
    n.multiplyScalar(radius - 0.07);
    porePts.push(n.x, n.y, n.z);
  }
  const poreGeo = new THREE.BufferGeometry();
  poreGeo.setAttribute('position', new THREE.Float32BufferAttribute(porePts, 3));
  group.add(new THREE.Points(poreGeo, ribosomeDots('#ffd08a', 0.075)));

  // Chromatin: long loose strings of beads (DNA wound on its spools) wandering
  // inside, faint threads between them, turning very slowly.
  const chromatin = new THREE.Group();
  const threadMat = glass({ color: '#7a6aff', edge: '#a090ff', core: 0.08, rim: 0.12, power: 1.2, shimmer: 0.5 });
  const threads = quality === 'high' ? 16 : 9;
  const beads: number[] = [];
  for (let k = 0; k < threads; k++) {
    const pts: THREE.Vector3[] = [];
    let p = spread(threads, k).multiplyScalar(radius * 0.45);
    const dir = v(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
    for (let i = 0; i < 40; i++) {
      pts.push(p.clone());
      dir.add(v(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.9)).normalize();
      // Turned back toward the middle when they wander near the envelope.
      if (p.length() > radius * 0.7) dir.addScaledVector(p.clone().normalize(), -0.8).normalize();
      p = p.clone().addScaledVector(dir, 0.32);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    chromatin.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 240, 0.006, 3), threadMat));
    for (const q of curve.getSpacedPoints(quality === 'high' ? 260 : 160)) beads.push(q.x, q.y, q.z);
  }
  const beadGeo = new THREE.BufferGeometry();
  beadGeo.setAttribute('position', new THREE.Float32BufferAttribute(beads, 3));
  chromatin.add(new THREE.Points(beadGeo, ribosomeDots('#b7a6ff', 0.04)));
  group.add(chromatin);

  // The nucleolus, low and to one side, glowing rose-gold.
  const knot = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 32),
    new THREE.ShaderMaterial({
      vertexShader: KNOT_VERT,
      fragmentShader: KNOT_FRAG,
      uniforms: { ...shared, uColor: { value: new THREE.Color(1.5, 0.72, 0.45) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  knot.scale.setScalar(radius * 0.2);
  knot.position.set(-radius * 0.42, radius * 0.05, -radius * 0.3);
  group.add(knot);

  return {
    group,
    center,
    radius,
    tick(t) {
      chromatin.rotation.y = t * 0.012;
      chromatin.rotation.x = Math.sin(t * 0.05) * 0.06;
      knot.rotation.y = -t * 0.03;
    },
  };
}

export interface Mito {
  group: THREE.Group;
  tick(t: number): void;
}

/**
 * A mitochondrion: an outer skin, an inner one, and between, the inner membrane
 * folded into cristae, a row of soft curved shelves from one wall and the other.
 */
export function buildMito(length: number, radius: number, seed: number): Mito {
  const group = new THREE.Group();
  const r = rng(seed);
  const body = new THREE.CapsuleGeometry(radius, length - radius * 2, 10, 40);
  body.rotateZ(Math.PI / 2);
  const outer = new THREE.Mesh(body, glass({ color: '#ff7a4a', edge: '#ffa070', core: 0.05, rim: 1.0, power: 2.4, shimmer: 0.5 }));
  const inner = new THREE.Mesh(body, glass({ color: '#ff5a5a', edge: '#ff8a72', core: 0.04, rim: 0.4, power: 3, shimmer: 0.3 }));
  inner.scale.set(0.95, 0.88, 0.88);
  group.add(outer, inner);

  // The cristae: each a flattened, wavy disc reaching most of the way across.
  const crista = new THREE.SphereGeometry(1, 28, 20);
  const cp = crista.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const y = cp.getY(i);
    const zz = cp.getZ(i);
    cp.setX(i, cp.getX(i) + Math.sin(y * 4.2 + zz * 2) * 0.35);
  }
  crista.computeVertexNormals();
  const cristaMat = glass({ color: '#ffb35a', edge: '#ffc77a', core: 0.045, rim: 0.6, power: 2.2, shimmer: 0.3 });
  const n = Math.max(4, Math.round((length - radius) / (radius * 0.42)));
  const span = length - radius * 1.3;
  for (let i = 0; i < n; i++) {
    const c = new THREE.Mesh(crista, cristaMat);
    const side = i % 2 ? 1 : -1;
    c.position.set(-span / 2 + (span * (i + 0.5)) / n, side * radius * 0.2, (r() - 0.5) * radius * 0.2);
    c.scale.set(radius * 0.06, radius * 0.62, radius * 0.72);
    c.rotation.set((r() - 0.5) * 0.3, (r() - 0.5) * 0.3, side * 0.12 + (r() - 0.5) * 0.2);
    group.add(c);
  }
  const phase = r() * 10;
  return {
    group,
    tick(t) {
      // Drifting, turning very slowly round its own length.
      group.rotation.x = phase + t * 0.03;
    },
  };
}

/** The Golgi: a stack of curved ribbons, swollen at their rims, with vesicles budding off. */
export function buildGolgi(seed: number) {
  const group = new THREE.Group();
  const r = rng(seed);
  // One cisterna: a thin pancake with a fat rim, as a lathe, bowed like a dish.
  const profile: THREE.Vector2[] = [];
  const R = 1;
  for (let i = 0; i <= 16; i++) {
    const x = (i / 16) * R * 0.86;
    profile.push(new THREE.Vector2(x, -0.03 - 0.05 * Math.pow(i / 16, 6)));
  }
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI;
    profile.push(new THREE.Vector2(R * 0.86 + Math.cos(a) * 0.09, Math.sin(a) * 0.09));
  }
  for (let i = 16; i >= 0; i--) {
    const x = (i / 16) * R * 0.86;
    profile.push(new THREE.Vector2(x, 0.03 + 0.05 * Math.pow(i / 16, 6)));
  }
  const disc = new THREE.LatheGeometry(profile, 48);
  const dp = disc.attributes.position;
  for (let i = 0; i < dp.count; i++) {
    const x = dp.getX(i);
    const z = dp.getZ(i);
    // Bowed, and stretched into a ribbon.
    dp.setY(i, dp.getY(i) + (x * x + z * z) * 0.35 + Math.sin(x * 3 + z) * 0.03);
    dp.setX(i, x * 1.6);
  }
  disc.computeVertexNormals();
  const colors = ['#ffcf6a', '#ffb05a', '#ff9a5a', '#ff8a6a', '#ff7a7a', '#f47aa0'];
  const stack = 6;
  for (let k = 0; k < stack; k++) {
    const mat = glass({ color: colors[k], edge: colors[k], core: 0.06, rim: 1.0, power: 2.2, shimmer: 0.4 });
    const c = new THREE.Mesh(disc, mat);
    const s = 1 - Math.abs(k - (stack - 1) / 2) * 0.12;
    c.scale.set(s, 1, s);
    c.position.y = k * 0.24;
    c.position.x = (r() - 0.5) * 0.12;
    group.add(c);
  }
  // Vesicles budding at the rims.
  const bud = new THREE.SphereGeometry(1, 20, 12);
  const budMat = glass({ color: '#ffd08a', edge: '#ffd9a0', core: 0.12, rim: 1.0, power: 1.8 });
  for (let i = 0; i < 18; i++) {
    const k = Math.floor(r() * stack);
    const a = r() * Math.PI * 2;
    const b = new THREE.Mesh(bud, budMat);
    const s = 0.06 + r() * 0.07;
    b.scale.setScalar(s);
    const rr = 1 - Math.abs(k - (stack - 1) / 2) * 0.12;
    b.position.set(Math.cos(a) * 1.6 * rr * (0.95 + r() * 0.25), k * 0.24 + 0.3 + r() * 0.15, Math.sin(a) * rr * (0.95 + r() * 0.25));
    group.add(b);
  }
  return group;
}

/** Folded sheets of rough ER, ribosomes studded across them as points of light. */
export function buildER(seed: number, width: number, height: number, layers: number, quality: 'high' | 'low') {
  const group = new THREE.Group();
  const r = rng(seed);
  const sheet = new THREE.PlaneGeometry(width, height, 64, 32);
  const sp = sheet.attributes.position;
  const ph = r() * 10;
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i);
    const y = sp.getY(i);
    sp.setZ(i, Math.sin(x * 1.4 + ph) * 0.5 + Math.sin(y * 1.9 + x * 0.6) * 0.25 + Math.sin(x * 3.7 + y) * 0.08 + (x * x + y * y) * 0.05);
  }
  sheet.computeVertexNormals();
  const mat = glass({ color: '#ffb48a', edge: '#ffc49a', core: 0.03, rim: 0.6, power: 2.6, shimmer: 0.6, edgeFade: 0.3 });
  const per = quality === 'high' ? 420 : 200;
  const dots: number[] = [];
  for (let k = 0; k < layers; k++) {
    const s = new THREE.Mesh(sheet, mat);
    s.position.z = k * 0.55;
    s.position.x = (r() - 0.5) * 0.4;
    group.add(s);
    // Ribosomes, on the surface (sampled from the same folds).
    for (let i = 0; i < per; i++) {
      const x = (r() - 0.5) * width * 0.7;
      const y = (r() - 0.5) * height * 0.7;
      const zz = Math.sin(x * 1.4 + ph) * 0.5 + Math.sin(y * 1.9 + x * 0.6) * 0.25 + Math.sin(x * 3.7 + y) * 0.08 + (x * x + y * y) * 0.05;
      dots.push(x + s.position.x, y, zz + s.position.z + (r() < 0.5 ? -0.03 : 0.03));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(dots, 3));
  const points = new THREE.Points(geo, ribosomeDots('#ffd27a', 0.03));
  group.add(points);
  return group;
}

const DOT_VERT = /* glsl */ `
  uniform float uSize;
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vec4 mv = viewMatrix * w;
    gl_PointSize = uSize * 600.0 / max(-mv.z, 0.3);
    gl_Position = projectionMatrix * mv;
  }
`;
const DOT_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying vec3 vWorld;
  ${HAZE}
  void main() {
    float r = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.1, r);
    gl_FragColor = vec4(uColor * a * through(vWorld), 1.0);
  }
`;

/** Small fixed points of light, sized in meters: ribosomes. */
export function ribosomeDots(color: string, size: number) {
  return new THREE.ShaderMaterial({
    vertexShader: DOT_VERT,
    fragmentShader: DOT_FRAG,
    uniforms: { ...shared, uColor: { value: new THREE.Color(color) }, uSize: { value: size } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export interface Vesicles {
  mesh: THREE.InstancedMesh;
  tick(t: number, dt: number, camera: THREE.Camera): void;
}

/** Vesicles: glassy bubbles of every size drifting up through the cell, keeping out of your face. */
export function buildVesicles(n: number, seed: number): Vesicles {
  const r = rng(seed);
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 3), glass({ color: '#ffffff', edge: '#ffffff', core: 0.07, rim: 1.0, power: 2.0, shimmer: 0.4 }), n);
  mesh.frustumCulled = false;
  const tints = ['#ffb070', '#ff8a7a', '#ffd08a', '#ff9a5a', '#7ad8c8', '#c49aff'];
  const span = CELL.radius * 0.8;
  const items = Array.from({ length: n }, () => {
    const a = r() * Math.PI * 2;
    const k = Math.sqrt(r()) * CELL.radius * 0.78;
    const small = r() < 0.82;
    return {
      p: v(CELL.center.x + Math.cos(a) * k, CELL.center.y + (r() * 2 - 1) * span, CELL.center.z + Math.sin(a) * k),
      size: small ? 0.05 + r() * 0.1 : 0.18 + r() * 0.24,
      rise: 0.03 + r() * 0.08,
      phase: r() * 10,
      shown: 1,
    };
  });
  items.forEach((_, i) => mesh.setColorAt(i, new THREE.Color(tints[i % tints.length]).multiplyScalar(0.8 + r() * 0.4)));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = v(1, 1, 1);
  const at = v(0, 0, 0);
  const sway = v(0, 0, 0);
  return {
    mesh,
    tick(t, dt, camera) {
      items.forEach((it, i) => {
        it.p.y += it.rise * dt;
        if (it.p.y > CELL.center.y + span) it.p.y -= span * 2;
        at.copy(it.p).add(sway.set(Math.sin(t * 0.13 + it.phase) * 0.8, 0, Math.cos(t * 0.11 + it.phase * 1.3) * 0.8));
        // Out of the way of the lens: they shrink away when you come close.
        const d = at.distanceTo(camera.position);
        const want = THREE.MathUtils.smoothstep(d, 1.0 + it.size * 2, 2.6 + it.size * 3);
        it.shown += (want - it.shown) * Math.min(1, dt * 3);
        // And they swell in and out of sight at the top and the bottom of the loop.
        const ends = THREE.MathUtils.smoothstep(span - Math.abs(it.p.y - CELL.center.y), 0, 2);
        s.setScalar(Math.max(1e-4, it.size * it.shown * ends * (1 + 0.04 * Math.sin(t * 1.3 + it.phase))));
        m.compose(at, q, s);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
