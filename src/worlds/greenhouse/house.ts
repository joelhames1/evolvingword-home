// The glasshouse: an old brick wall at the back, a low brick wall at the front
// with the glass rising from it and curving over into the roof, cast-iron ribs
// painted cream every bay, glazing bars between, tie rods with a ring across the
// span, cresting along the ridge and a finial at each end. Inside, slatted
// staging in two tiers, a gravel bench for ferns, the hot-water pipes along the
// front, a tiled aisle and a door open to the garden. The glass is old and a
// little green, grimy at the foot of each pane, and when a shower passes, drops
// bead on it and run.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvas, rng, texture } from '../../textures';
import { ALCOVE, FERNS, HOUSE, profile, STAGING } from './plan';
import { brick, floor, weathered } from './surfaces';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Profile stations where a rail runs the length of the house (as indexes into the fine profile). */
const STEPS = 12;

export interface House {
  group: THREE.Group;
  /** The glass's uniforms: how wet it is, the time, the sun. */
  glass: THREE.ShaderMaterial;
  /** The wood and the iron, for the studio's pieces to match. */
  materials: { iron: THREE.MeshStandardMaterial; wood: THREE.MeshStandardMaterial; blackIron: THREE.MeshStandardMaterial; brick: THREE.MeshStandardMaterial; stone: THREE.MeshStandardMaterial };
  tick(t: number, rain: number): void;
}

const GLASS_VERT = /* glsl */ `
  attribute vec2 aPane;
  varying vec3 vWorld;
  varying vec3 vNrm;
  varying vec2 vUv;
  varying vec2 vPane;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNrm = normalize(mat3(modelMatrix) * normal);
    vUv = uv;
    vPane = aPane;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

// Old glass: nearly clear, a little green in the thickness, grime and green
// algae gathered at the foot of each pane, the sky and the sun in it at a
// glancing angle. In the rain, beads of water that catch the light, and now and
// then one that lets go and runs, leaving a clear trail.
const GLASS_FRAG = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uSkyLow;
  uniform vec3 uSkyHigh;
  uniform float uRain;
  uniform float uTime;
  varying vec3 vWorld;
  varying vec3 vNrm;
  varying vec2 vUv;
  varying vec2 vPane;
  float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  /** Beads of rain on the pane, in meters: how much water, and a highlight. */
  vec2 drops(vec2 uv) {
    float water = 0.0;
    float shine = 0.0;
    // Still beads, in a grid of 3 cm cells.
    vec2 g = uv / 0.03;
    vec2 cell = floor(g);
    vec2 o = hash22(cell);
    float size = mix(0.12, 0.38, o.y) * step(0.35, hash12(cell + 7.1));
    vec2 d = (fract(g) - (0.25 + 0.5 * o)) / max(size, 1e-3);
    float r = length(d);
    float bead = smoothstep(1.0, 0.75, r) * step(1e-3, size);
    water += bead;
    // The highlight sits up and to one side of each bead, where the sky is.
    shine += smoothstep(0.45, 0.0, length(d - vec2(-0.3, 0.35))) * bead;
    // Runners: a column now and then has a drop sliding down it, a trail above.
    float col = floor(uv.x / 0.05);
    float h = hash12(vec2(col, 3.7));
    if (h > 0.55) {
      float speed = 0.12 + h * 0.25;
      float y = 1.0 - fract(uTime * speed * 0.35 + h * 13.0);
      float span = 1.6;
      float at = mod(uv.y, span) / span;
      float x = fract(uv.x / 0.05) - 0.5 + sin(uv.y * 31.0 + h * 9.0) * 0.08;
      float head = smoothstep(0.22, 0.12, length(vec2(x * 1.3, (at - y) * 18.0)));
      float trail = smoothstep(0.08, 0.02, abs(x)) * step(y, at) * smoothstep(0.35, 0.0, at - y) * 0.5;
      water += head + trail;
      shine += head * 0.6;
    }
    return vec2(clamp(water, 0.0, 1.0), clamp(shine, 0.0, 1.0));
  }
  void main() {
    vec3 toEye = cameraPosition - vWorld;
    float dist = length(toEye);
    vec3 v = toEye / max(dist, 1e-4);
    vec3 n = normalize(vNrm);
    if (dot(n, v) < 0.0) n = -n;
    float facing = clamp(dot(n, v), 0.0, 1.0);
    float fres = 0.03 + 0.85 * pow(1.0 - facing, 5.0);
    vec3 r = reflect(-v, n);
    vec3 sky = mix(uSkyLow, uSkyHigh, clamp(r.y * 1.6, 0.0, 1.0));
    float glint = pow(clamp(dot(r, uSunDir), 0.0, 1.0), 300.0);
    // Grime at the foot of each pane and in its corners, and a faint green of algae.
    float foot = smoothstep(0.22, 0.0, vPane.y) * (0.55 + 0.45 * vnoise(vUv * 26.0));
    float edge = smoothstep(0.06, 0.0, min(vPane.x, 1.0 - vPane.x)) * 0.35;
    float grime = clamp(foot + edge + vnoise(vUv * 3.0) * 0.12, 0.0, 1.0);
    vec3 grimeCol = mix(vec3(0.22, 0.24, 0.12), vec3(0.32, 0.27, 0.18), vnoise(vUv * 9.0));
    vec2 wet = uRain > 0.01 ? drops(vUv) * uRain : vec2(0.0);
    vec3 col = vec3(0.05, 0.07, 0.06) * (1.0 - grime) + grimeCol * grime;
    col += sky * fres * 0.9 + uSunColor * glint * 2.5 * (1.0 - uRain * 0.6);
    col += (sky * 0.5 + uSunColor * 0.15) * wet.y;
    float a = 0.06 + grime * 0.32 + fres * 0.55 + wet.x * 0.16 + glint * 0.3;
    // Nothing to flare across the lens if the camera comes close.
    a *= smoothstep(0.1, 0.5, dist);
    gl_FragColor = vec4(col, clamp(a, 0.0, 0.9));
  }
`;

/** A box from a to b with a cross-section w (sideways, along `side`) by d (along `out`). */
function beam(a: THREE.Vector3, b: THREE.Vector3, w: number, d: number, out: THREE.Vector3) {
  const len = a.distanceTo(b);
  const geo = new THREE.BoxGeometry(w, len, d);
  const y = b.clone().sub(a).normalize();
  const z = out.clone().sub(y.clone().multiplyScalar(out.dot(y))).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  geo.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, z).setPosition(a.clone().add(b).multiplyScalar(0.5)));
  return geo;
}

/** A plain rod (round) from a to b. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, sides = 8) {
  const geo = new THREE.CylinderGeometry(r, r, a.distanceTo(b), sides, 1);
  geo.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), b.clone().sub(a).normalize()), v(1, 1, 1)));
  return geo;
}

/** Without its index (so geometries of both kinds merge), with only position, normal and uv. */
const plain = (g: THREE.BufferGeometry) => {
  const out = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(out.attributes)) if (!['position', 'normal', 'uv'].includes(k)) out.deleteAttribute(k);
  return out;
};

/** The cresting along the ridge: a cast-iron frieze of quatrefoils and spear tips, cut out of a strip. */
function crestingTexture() {
  const [c, g] = canvas(256, 64);
  g.fillStyle = '#fff';
  g.fillRect(0, 54, 256, 10);
  for (let i = 0; i < 4; i++) {
    const x = 32 + i * 64;
    g.beginPath();
    g.arc(x, 34, 14, 0, Math.PI * 2);
    g.arc(x, 34, 8, 0, Math.PI * 2, true);
    g.fill();
    // A spear tip above each ring, and a little fleur between.
    g.beginPath();
    g.moveTo(x - 4, 20);
    g.lineTo(x, 2);
    g.lineTo(x + 4, 20);
    g.fill();
    g.fillRect(x - 2, 46, 4, 10);
    g.beginPath();
    g.moveTo(x + 32 - 6, 56);
    g.quadraticCurveTo(x + 32, 30, x + 32 + 6, 56);
    g.fill();
  }
  const t = texture(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function buildHouse(quality: 'high' | 'low'): House {
  const group = new THREE.Group();
  const { x0, x1, front, back, knee, kneeIn, kneeOut, wallTop, bay } = HOUSE;
  const high = quality === 'high';

  // --- materials ------------------------------------------------------------------------
  const backBrick = brick(11, { wash: true, moss: true });
  backBrick.map.repeat.set((x1 - x0 + 0.6) / 2, wallTop + 0.3);
  backBrick.bump.repeat.copy(backBrick.map.repeat);
  const brickMat = new THREE.MeshStandardMaterial({ map: backBrick.map, bumpMap: backBrick.bump, bumpScale: 2.2, roughness: 0.92 });
  const kneeBrick = brick(29, { moss: true });
  kneeBrick.map.repeat.set(6, 0.8);
  kneeBrick.bump.repeat.copy(kneeBrick.map.repeat);
  const kneeMat = new THREE.MeshStandardMaterial({ map: kneeBrick.map, bumpMap: kneeBrick.bump, bumpScale: 2, roughness: 0.92 });
  const endBrick = brick(29, { moss: true });
  endBrick.map.repeat.set(2.6, 0.8);
  endBrick.bump.repeat.copy(endBrick.map.repeat);
  const endMat = new THREE.MeshStandardMaterial({ map: endBrick.map, bumpMap: endBrick.bump, bumpScale: 2, roughness: 0.92 });
  const stone = new THREE.MeshStandardMaterial({ color: '#c8bba0', roughness: 0.85 });
  // Iron painted cream, the paint worn a little: warm in the low sun.
  const iron = new THREE.MeshStandardMaterial({ color: '#e7e0cf', roughness: 0.48, metalness: 0.05 });
  const blackIron = new THREE.MeshStandardMaterial({ color: '#23211f', roughness: 0.55, metalness: 0.45 });
  const woodMap = weathered(5);
  woodMap.wrapS = woodMap.wrapT = THREE.RepeatWrapping;
  const wood = new THREE.MeshStandardMaterial({ map: woodMap, roughness: 0.82 });

  // --- the brick ----------------------------------------------------------------------------
  const wall = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.6, wallTop + 0.3, 0.45), brickMat);
  wall.position.set(0, (wallTop + 0.3) / 2, back + 0.225);
  wall.receiveShadow = true;
  wall.castShadow = true;
  group.add(wall);
  // A stone coping along the top of the wall.
  const coping = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.7, 0.08, 0.55), stone);
  coping.position.set(0, wallTop + 0.34, back + 0.225);
  coping.castShadow = true;
  group.add(coping);
  // The knee wall along the front, and round the ends (with a gap for the door).
  const kneeWall = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.3, knee - 0.05, kneeIn - kneeOut), kneeMat);
  kneeWall.position.set(0, (knee - 0.05) / 2, (kneeIn + kneeOut) / 2);
  kneeWall.receiveShadow = true;
  kneeWall.castShadow = true;
  group.add(kneeWall);
  const sill = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.38, 0.06, kneeIn - kneeOut + 0.1), stone);
  sill.position.set(0, knee - 0.03, (kneeIn + kneeOut) / 2);
  sill.receiveShadow = true;
  sill.castShadow = true;
  group.add(sill);
  const { door } = HOUSE;
  for (const [x, za, zb] of [
    [x1, kneeOut, back],
    [x0, kneeOut, door.z - door.half],
    [x0, door.z + door.half, back],
  ] as const) {
    const len = zb - za;
    const end = new THREE.Mesh(new THREE.BoxGeometry(0.3, knee - 0.05, len), endMat);
    end.position.set(x + (x < 0 ? -0.15 : 0.15), (knee - 0.05) / 2, za + len / 2);
    end.receiveShadow = true;
    end.castShadow = true;
    group.add(end);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, len), stone);
    top.position.set(end.position.x, knee - 0.03, end.position.z);
    top.castShadow = true;
    group.add(top);
  }

  // --- the floor --------------------------------------------------------------------------
  const floorTex = floor({ w: x1 - x0, d: back - kneeIn }, { z0: -0.75, z1: 1.55 }, kneeIn);
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, back - kneeIn), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.88 }));
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(0, 0, (back + kneeIn) / 2);
  // (The canvas's top row lands at the front of the house.)
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // --- the glass and the iron ---------------------------------------------------------------
  const prof = profile(STEPS);
  // Distance along the glass from its foot, at each profile point.
  const along: number[] = [0];
  for (let i = 1; i < prof.length; i++) along.push(along[i - 1] + prof[i].distanceTo(prof[i - 1]));
  const ridgeAt = prof.length - 2;
  // Where the panes change: the foot, the top of the upright glass, the end of the curve, two purlins, the ridge, the wall.
  const rails = [0, 1, 1 + STEPS / 2, 1 + STEPS, ridgeAt, prof.length - 1];
  const roofLen = along[ridgeAt] - along[1 + STEPS];
  const paneStops = [...rails.map((i) => along[i]), along[1 + STEPS] + roofLen / 3, along[1 + STEPS] + (roofLen * 2) / 3].sort((a, b) => a - b);
  /** Where a stretch of glass from s0 to s1 (along the profile) falls within its pane, 0 at the pane's foot and 1 at its head. */
  const paneRange = (s0: number, s1: number) => {
    const mid = (s0 + s1) / 2;
    let k = 1;
    while (k < paneStops.length - 1 && mid > paneStops[k]) k++;
    const len = Math.max(1e-6, paneStops[k] - paneStops[k - 1]);
    return [(s0 - paneStops[k - 1]) / len, (s1 - paneStops[k - 1]) / len];
  };
  // Up the glass is always toward the ridge, so rain runs down it: on the back slope, measured up from the wall.
  const upAlong = (i: number) => (i <= ridgeAt ? along[i] : 2 * along[ridgeAt] - along[i]);
  const pos: number[] = [];
  const uv: number[] = [];
  const pane: number[] = [];
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, ua: number[], ub: number[], uc: number[], ud: number[], pa: number[], pb: number[], pc: number[], pd: number[]) => {
    for (const [p, u, q] of [
      [a, ua, pa],
      [b, ub, pb],
      [c, uc, pc],
      [a, ua, pa],
      [c, uc, pc],
      [d, ud, pd],
    ] as const) {
      pos.push(p.x, p.y, p.z);
      uv.push(u[0], u[1]);
      pane.push(q[0], q[1]);
    }
  };
  const halfBay = bay / 2;
  for (let i = 0; i < prof.length - 1; i++) {
    const p0 = prof[i];
    const p1 = prof[i + 1];
    for (let x = x0; x < x1 - 1e-6; x += halfBay) {
      const xa = x;
      const xb = x + halfBay;
      const s0 = upAlong(i);
      const s1 = upAlong(i + 1);
      const [v0, v1] = paneRange(along[i], along[i + 1]);
      // On the back slope the pane's foot is at the wall, the far end of this segment.
      const pv0 = i >= ridgeAt ? 1 - v0 : v0;
      const pv1 = i >= ridgeAt ? 1 - v1 : v1;
      quad(v(xa, p0.y, p0.x), v(xb, p0.y, p0.x), v(xb, p1.y, p1.x), v(xa, p1.y, p1.x), [xa, s0], [xb, s0], [xb, s1], [xa, s1], [0, pv0], [1, pv0], [1, pv1], [0, pv1]);
    }
  }
  // The two ends: glass from the knee wall up to the roof, in (z, y); the right-hand one round the door.
  const outline = (withDoor: boolean) => {
    const pts: THREE.Vector2[] = [new THREE.Vector2(front, knee)];
    if (withDoor) pts.push(new THREE.Vector2(door.z - door.half, knee), new THREE.Vector2(door.z - door.half, door.h), new THREE.Vector2(door.z + door.half, door.h), new THREE.Vector2(door.z + door.half, knee));
    pts.push(new THREE.Vector2(back, knee), new THREE.Vector2(back, wallTop));
    for (let i = prof.length - 2; i >= 1; i--) pts.push(prof[i].clone());
    return pts;
  };
  for (const [x, withDoor] of [
    [x0, true],
    [x1, false],
  ] as const) {
    const shape = new THREE.Shape(outline(withDoor));
    const g = new THREE.ShapeGeometry(shape).toNonIndexed();
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const z = p.getX(k);
      const y = p.getY(k);
      pos.push(x, y, z);
      uv.push(z, y);
      pane.push(THREE.MathUtils.euclideanModulo(z - front, 0.6) / 0.6, THREE.MathUtils.euclideanModulo(y - knee, 0.62) / 0.62);
    }
  }
  const glassGeo = new THREE.BufferGeometry();
  glassGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  glassGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  glassGeo.setAttribute('aPane', new THREE.Float32BufferAttribute(pane, 2));
  glassGeo.computeVertexNormals();
  const glass = new THREE.ShaderMaterial({
    vertexShader: GLASS_VERT,
    fragmentShader: GLASS_FRAG,
    uniforms: {
      uSunDir: { value: new THREE.Vector3() },
      uSunColor: { value: new THREE.Color('#ffc890') },
      uSkyLow: { value: new THREE.Color('#e9c08a') },
      uSkyHigh: { value: new THREE.Color('#8fa6c2') },
      uRain: { value: 0 },
      uTime: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const glassMesh = new THREE.Mesh(glassGeo, glass);
  glassMesh.renderOrder = 2;
  group.add(glassMesh);

  // The iron: ribs every bay, bars between, rails along the house, and the ends' mullions.
  const ironParts: THREE.BufferGeometry[] = [];
  const inward = (i: number) => {
    const a = prof[Math.max(0, i - 1)];
    const b = prof[Math.min(prof.length - 1, i + 1)];
    const d = b.clone().sub(a).normalize();
    return v(0, -d.x, d.y);
  };
  for (let x = x0; x <= x1 + 1e-6; x += halfBay) {
    const rib = Math.abs(((x - x0) / bay) % 1) < 1e-6 || Math.abs(((x - x0) / bay) % 1 - 1) < 1e-6;
    const w = rib ? 0.04 : 0.022;
    const d = rib ? 0.09 : 0.04;
    for (let i = 0; i < prof.length - 1; i++) {
      const n = inward(i).add(inward(i + 1)).normalize();
      const a = v(x, prof[i].y, prof[i].x).addScaledVector(inward(i), d / 2 + 0.004);
      const b = v(x, prof[i + 1].y, prof[i + 1].x).addScaledVector(inward(i + 1), d / 2 + 0.004);
      // A hair longer than the segment, so the joints round the curve close up.
      const dir = b.clone().sub(a).normalize();
      ironParts.push(beam(a.clone().addScaledVector(dir, -0.01), b.clone().addScaledVector(dir, 0.01), w, d, n));
    }
  }
  for (const i of rails) {
    const n = inward(i);
    const d = i === ridgeAt ? 0.14 : 0.06;
    const p = v(0, prof[i].y, prof[i].x).addScaledVector(n, d / 2);
    ironParts.push(beam(v(x0, p.y, p.z), v(x1, p.y, p.z), 0.06, d, n));
  }
  // The purlins on the roof.
  for (const k of [1 / 3, 2 / 3]) {
    const z = HOUSE.eave.z + (HOUSE.ridge.z - HOUSE.eave.z) * k;
    const y = HOUSE.eave.y + (HOUSE.ridge.y - HOUSE.eave.y) * k;
    const n = inward(1 + STEPS + 1);
    const p = v(0, y, z).addScaledVector(n, 0.03);
    ironParts.push(beam(v(x0, p.y, p.z), v(x1, p.y, p.z), 0.05, 0.05, n));
  }
  // Mullions in the ends, every 0.6 m, and a transom at the height of the bend.
  const roofAbove = (z: number) => {
    for (let i = 1; i < prof.length; i++) {
      const a = prof[i - 1];
      const b = prof[i];
      if ((z >= a.x && z <= b.x) || (z <= a.x && z >= b.x)) return a.y + ((b.y - a.y) * (z - a.x)) / (b.x - a.x || 1);
    }
    return HOUSE.knee;
  };
  for (const x of [x0, x1]) {
    const into = v(x < 0 ? 1 : -1, 0, 0);
    for (let z = front + 0.6; z < back - 0.05; z += 0.6) {
      if (x === x0 && Math.abs(z - door.z) < door.half + 0.03) continue;
      ironParts.push(beam(v(x, knee, z).addScaledVector(into, 0.02), v(x, roofAbove(z), z).addScaledVector(into, 0.02), 0.03, 0.04, into));
    }
    ironParts.push(beam(v(x, HOUSE.bend, front).addScaledVector(into, 0.025), v(x, HOUSE.bend, back).addScaledVector(into, 0.025), 0.05, 0.05, v(0, 1, 0)));
  }
  // The door frame, and the door itself, open out into the garden.
  const dz0 = door.z - door.half;
  const dz1 = door.z + door.half;
  for (const z of [dz0, dz1]) ironParts.push(beam(v(x0, 0, z), v(x0, door.h + 0.04, z), 0.08, 0.08, v(1, 0, 0)));
  ironParts.push(beam(v(x0, door.h, dz0 - 0.04), v(x0, door.h, dz1 + 0.04), 0.08, 0.08, v(1, 0, 0)));
  // Tie rods across the span at each rib, with a ring in the middle: what keeps the roof from spreading.
  for (let x = x0 + bay; x < x1 - 1e-6; x += bay) {
    const a = v(x, roofY0(), HOUSE.eave.z - 0.05);
    const b = v(x, roofY0(), back - 0.02);
    const mid = a.clone().lerp(b, 0.5);
    ironParts.push(rod(a, mid.clone().add(v(0, 0, -0.1)), 0.008), rod(mid.clone().add(v(0, 0, 0.1)), b, 0.008));
    const ring = new THREE.TorusGeometry(0.1, 0.012, 6, 24);
    ring.rotateY(Math.PI / 2);
    ring.translate(mid.x, mid.y, mid.z);
    ironParts.push(ring);
    // And a slim hanger from the ridge down to the ring.
    ironParts.push(rod(v(x, HOUSE.ridge.y - 0.08, HOUSE.ridge.z), v(x, mid.y + 0.1, mid.z + 0.02), 0.007));
  }
  function roofY0() {
    return HOUSE.eave.y - 0.12;
  }
  const ironMesh = new THREE.Mesh(mergeGeometries(ironParts.map(plain)), iron);
  ironMesh.castShadow = true;
  ironMesh.receiveShadow = true;
  group.add(ironMesh);

  // The door, glazed, swung out to the garden on its hinges at the front side of the frame.
  const doorGroup = new THREE.Group();
  doorGroup.position.set(x0 - 0.04, 0, dz0 + 0.02);
  doorGroup.rotation.y = 1.25;
  const dw = dz1 - dz0 - 0.04;
  const doorParts: THREE.BufferGeometry[] = [];
  for (const z of [0.03, dw - 0.03]) doorParts.push(beam(v(0, 0.02, z), v(0, door.h - 0.04, z), 0.05, 0.06, v(1, 0, 0)));
  for (const y of [0.04, 0.85, 1.5, door.h - 0.06]) doorParts.push(beam(v(0, y, 0.03), v(0, y, dw - 0.03), 0.06, 0.05, v(1, 0, 0)));
  const doorFrame = new THREE.Mesh(mergeGeometries(doorParts.map(plain)), iron);
  doorFrame.castShadow = true;
  doorGroup.add(doorFrame);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.8, dw - 0.08), wood);
  panel.position.set(0, 0.45, dw / 2);
  doorGroup.add(panel);
  const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(dw - 0.08, door.h - 0.95).toNonIndexed(), glass);
  doorGlass.geometry.setAttribute('aPane', new THREE.Float32BufferAttribute(new Array(12).fill(0.5), 2));
  doorGlass.rotation.y = Math.PI / 2;
  doorGlass.position.set(0, 0.85 + (door.h - 0.95) / 2, dw / 2);
  doorGlass.renderOrder = 2;
  doorGroup.add(doorGlass);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), new THREE.MeshStandardMaterial({ color: '#b08a4a', metalness: 0.9, roughness: 0.3 }));
  knob.position.set(-0.04, 1.0, dw - 0.08);
  doorGroup.add(knob);
  group.add(doorGroup);

  // The cresting along the ridge, outside, and a finial at each end.
  const crest = new THREE.Mesh(
    new THREE.PlaneGeometry(x1 - x0, 0.22),
    new THREE.MeshStandardMaterial({ color: '#e2dbc8', alphaMap: crestingTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5 }),
  );
  (crest.material as THREE.MeshStandardMaterial).alphaMap!.repeat.set((x1 - x0) / 0.5, 1);
  crest.position.set(0, HOUSE.ridge.y + 0.16, HOUSE.ridge.z - 0.02);
  crest.castShadow = true;
  group.add(crest);
  const finialProfile = [
    [0, 0],
    [0.05, 0],
    [0.05, 0.04],
    [0.03, 0.08],
    [0.055, 0.16],
    [0.03, 0.24],
    [0.018, 0.3],
    [0.03, 0.36],
    [0.0, 0.52],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const finialGeo = new THREE.LatheGeometry(finialProfile, 12);
  for (const x of [x0, x1]) {
    const f = new THREE.Mesh(finialGeo, iron);
    f.position.set(x, HOUSE.ridge.y + 0.06, HOUSE.ridge.z);
    f.castShadow = true;
    group.add(f);
  }

  // --- the staging ---------------------------------------------------------------------------
  // Two tiers of slats on cast-iron frames, and a low shelf under the front for spare pots.
  const slatParts: THREE.BufferGeometry[] = [];
  const blackParts: THREE.BufferGeometry[] = [];
  const slats = (z0: number, z1: number, y: number, x0s: number, x1s: number, n: number) => {
    const w = (z1 - z0) / n;
    for (let k = 0; k < n; k++) {
      const g = new THREE.BoxGeometry(x1s - x0s, 0.028, w - 0.014);
      g.translate((x0s + x1s) / 2, y - 0.014, z0 + w * (k + 0.5));
      slatParts.push(g);
    }
  };
  const S = STAGING;
  slats(S.front.z0, S.front.z1, S.front.y, S.x0, S.x1, 5);
  slats(S.back.z0, S.back.z1, S.back.y, S.x0, S.x1, 4);
  slats(S.front.z0 + 0.05, S.front.z1 - 0.05, 0.16, S.x0 + 0.05, S.x1 - 0.7, 3);
  // A raised edge along the front of each tier, so nothing rolls off.
  for (const [z, y] of [
    [S.front.z1, S.front.y],
    [S.back.z1, S.back.y],
  ]) {
    const lip = new THREE.BoxGeometry(S.x1 - S.x0, 0.07, 0.022);
    lip.translate((S.x0 + S.x1) / 2, y - 0.01, z);
    slatParts.push(lip);
  }
  for (let x = S.x0 + 0.06; x <= S.x1 + 1e-6; x += (S.x1 - S.x0 - 0.12) / 3) {
    for (const [z, h] of [
      [S.front.z1 - 0.03, S.front.y - 0.03],
      [S.back.z0 + 0.03, S.back.y - 0.03],
      [S.back.z1 - 0.02, S.back.y - 0.03],
    ]) {
      const leg = new THREE.BoxGeometry(0.035, h, 0.035);
      leg.translate(x, h / 2, z);
      blackParts.push(leg);
    }
    // The brackets under each tier, front to back.
    blackParts.push(beam(v(x, S.front.y - 0.05, S.front.z1 - 0.03), v(x, S.front.y - 0.05, S.front.z0), 0.03, 0.04, v(0, 1, 0)));
    blackParts.push(beam(v(x, S.back.y - 0.05, S.back.z1), v(x, S.back.y - 0.05, S.back.z0 + 0.03), 0.03, 0.04, v(0, 1, 0)));
    blackParts.push(beam(v(x, 0.3, S.front.z1 - 0.03), v(x, S.front.y - 0.06, S.front.z0 + 0.05), 0.02, 0.025, v(0, 0, 1)));
  }

  // --- the fern bench: a deep tray of gravel on brick piers ------------------------------------------
  const F = FERNS;
  const tray = new THREE.BoxGeometry(F.x1 - F.x0, 0.12, F.z1 - F.z0);
  tray.translate((F.x0 + F.x1) / 2, F.y - 0.06, (F.z0 + F.z1) / 2);
  slatParts.push(tray);
  const gravel = new THREE.Mesh(new THREE.PlaneGeometry(F.x1 - F.x0 - 0.06, F.z1 - F.z0 - 0.06), new THREE.MeshStandardMaterial({ map: gravelTexture(), roughness: 0.95 }));
  gravel.rotation.x = -Math.PI / 2;
  gravel.position.set((F.x0 + F.x1) / 2, F.y + 0.002, (F.z0 + F.z1) / 2);
  gravel.receiveShadow = true;
  group.add(gravel);
  for (const x of [F.x0 + 0.2, (F.x0 + F.x1) / 2, F.x1 - 0.2]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(0.23, F.y - 0.12, 0.45), endMat);
    pier.position.set(x, (F.y - 0.12) / 2, (F.z0 + F.z1) / 2);
    pier.castShadow = true;
    pier.receiveShadow = true;
    group.add(pier);
  }

  const slatMesh = new THREE.Mesh(mergeGeometries(slatParts.map(plain)), wood);
  slatMesh.castShadow = true;
  slatMesh.receiveShadow = true;
  group.add(slatMesh);

  // --- the hot-water pipes along the front, under everything ---------------------------------------------
  for (const y of [0.1, 0.22]) blackParts.push(rod(v(x0 + 0.2, y, -2.02), v(x1 - 0.2, y, -2.02), 0.038, high ? 14 : 8));
  for (const x of [x0 + 0.2, x1 - 0.2]) blackParts.push(rod(v(x, 0.1, -2.02), v(x, 0.22, -2.02), 0.042, 10));
  const blackMesh = new THREE.Mesh(mergeGeometries(blackParts.map(plain)), blackIron);
  blackMesh.castShadow = true;
  blackMesh.receiveShadow = true;
  group.add(blackMesh);

  // --- the CRT's alcove: a little brick niche with a segmental arch, on the bench ------------------------
  const A = ALCOVE;
  const aw = A.x1 - A.x0;
  const ah = A.top - 0.76;
  // An arch on two legs, open at the foot where it stands on the bench.
  const side = 0.09;
  const spring = ah - 0.2;
  const outer = new THREE.Shape();
  outer.moveTo(0, 0);
  outer.lineTo(side, 0);
  outer.lineTo(side, spring);
  outer.quadraticCurveTo(aw / 2, spring + 0.24, aw - side, spring);
  outer.lineTo(aw - side, 0);
  outer.lineTo(aw, 0);
  outer.lineTo(aw, ah);
  outer.lineTo(0, ah);
  outer.closePath();
  const niche = new THREE.ExtrudeGeometry(outer, { depth: A.z1 - A.z0, bevelEnabled: false, curveSegments: 12 });
  niche.translate(A.x0, 0.75, A.z0);
  const nicheBrick = brick(41);
  nicheBrick.map.repeat.set(1.6, 1.6);
  nicheBrick.bump.repeat.set(1.6, 1.6);
  const nicheMat = new THREE.MeshStandardMaterial({ map: nicheBrick.map, bumpMap: nicheBrick.bump, bumpScale: 1.5, roughness: 0.9 });
  const nicheMesh = new THREE.Mesh(niche, nicheMat);
  nicheMesh.castShadow = true;
  nicheMesh.receiveShadow = true;
  group.add(nicheMesh);
  const nicheBack = new THREE.Mesh(new THREE.PlaneGeometry(aw - 2 * side, ah), nicheMat);
  nicheBack.position.set(A.x0 + aw / 2, 0.75 + ah / 2, A.z0 + 0.02);
  nicheBack.receiveShadow = true;
  group.add(nicheBack);
  // A slate cap on top, a little proud.
  const cap = new THREE.Mesh(new THREE.BoxGeometry(aw + 0.06, 0.035, A.z1 - A.z0 + 0.05), new THREE.MeshStandardMaterial({ color: '#4a4c52', roughness: 0.6 }));
  cap.position.set(A.x0 + aw / 2, A.top + 0.0175, (A.z0 + A.z1) / 2 + 0.01);
  cap.castShadow = true;
  group.add(cap);

  return {
    group,
    glass,
    materials: { iron, wood, blackIron, brick: brickMat, stone },
    tick(t, rain) {
      glass.uniforms.uTime.value = t;
      glass.uniforms.uRain.value = rain;
    },
  };
}

/** Pea gravel, grey and buff, for the fern bench's tray. */
function gravelTexture() {
  const [c, g] = canvas(512, 256);
  const r = rng(13);
  g.fillStyle = '#6e665a';
  g.fillRect(0, 0, 512, 256);
  for (let k = 0; k < 5000; k++) {
    const s = 2 + r() * 4;
    g.fillStyle = ['#9a9080', '#7e766a', '#b4a890', '#5a544c', '#8a8274'][Math.floor(r() * 5)];
    g.beginPath();
    g.ellipse(r() * 512, r() * 256, s, s * (0.6 + r() * 0.4), r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  return texture(c);
}
