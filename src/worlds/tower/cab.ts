// The cab at the top of the control tower: glass that leans out all along the
// front and wraps round the front corners, a dark ceiling with sun visors, a
// console in the corner with the flight-strip bay, a radar scope hung from the
// ceiling, binoculars on the sill. Outside: the roof with its spinning antenna,
// the concrete shaft, and the ground forty-odd meters down.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { ROOM } from '../../layout';
import { canvas, label, rng, texture } from '../../textures';
import { outdoor, type DaylightUniforms } from '../outdoor';

/** Ground level, far below the cab floor. */
export const GROUND = -42;
/** The glass starts at the sill and leans out this far by the ceiling. */
export const SILL = 0.9;
export const LEAN = 0.5;
/** How far back along each side wall the glass wraps. */
export const SIDE_Z = ROOM.z0 + 0.9;
/** Where the radar scope hangs, and how big its face is. */
const SCOPE = { pos: new THREE.Vector3(1.95, 2.12, -1.45), size: 0.34 };

export interface Cab {
  group: THREE.Group;
  /** The low sun, streaming in across the room. */
  sun: THREE.SpotLight;
  /** The sky through all that glass. */
  fill: THREE.RectAreaLight;
  /** Feed the scope what's moving: up to eight blips, as bearings (radians, 0 ahead, clockwise) and ranges (0..1 of the scope). */
  setBlips(blips: { bearing: number; range: number }[]): void;
  tick(t: number): void;
}

const GLASS_VERT = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNrm;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNrm = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
// Tower glass is tinted, and the top band darker, to cut the glare. Mostly clear;
// a faint sky sheen at a glancing angle, stronger seen from outside.
const GLASS_FRAG = /* glsl */ `
  uniform vec3 uSheen;
  varying vec3 vWorld;
  varying vec3 vNrm;
  void main() {
    vec3 v = normalize(cameraPosition - vWorld);
    vec3 n = normalize(vNrm);
    float facing = abs(dot(v, n));
    float fres = pow(1.0 - facing, 4.0);
    float band = smoothstep(2.3, 2.45, vWorld.y);
    // From outside, the morning sky's reflection dominates. (The panes face into the room.)
    float outside = step(dot(cameraPosition - vWorld, n), 0.0);
    vec3 tint = mix(vec3(0.02, 0.05, 0.05), vec3(0.01, 0.02, 0.03), band);
    float a = 0.05 + band * 0.32 + fres * 0.45 + outside * 0.35;
    gl_FragColor = vec4(tint + uSheen * (fres + outside * 0.6), clamp(a, 0.0, 0.85));
  }
`;

const SCOPE_VERT = GLASS_VERT.replace('varying vec3 vNrm;', 'varying vec3 vNrm;\n  varying vec2 vUv;').replace('vWorld = w.xyz;', 'vWorld = w.xyz;\n    vUv = uv;');
// A round green scope: range rings, a compass rose, the sweep going round with its
// afterglow, and the blips it paints as it passes them.
const SCOPE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec2 uBlips[8];
  uniform float uCount;
  varying vec2 vUv;
  #define PI 3.14159265
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) { gl_FragColor = vec4(0.004, 0.006, 0.005, 1.0); return; }
    float ang = atan(p.x, p.y);
    float sweepAng = mod(uTime * 1.3, 2.0 * PI);
    // How far behind the sweep this angle is, 0..2PI.
    float behind = mod(sweepAng - ang + 2.0 * PI, 2.0 * PI);
    float trail = exp(-behind * 2.2);
    vec3 green = vec3(0.25, 1.0, 0.45);
    vec3 col = vec3(0.004, 0.02, 0.01);
    float w = fwidth(r) * 1.2;
    for (int i = 1; i <= 4; i++) {
      float ring = float(i) * 0.25;
      col += green * 0.12 * smoothstep(w, 0.0, abs(r - ring));
    }
    // Spokes every thirty degrees, faint.
    float spoke = abs(fract(ang / (PI / 6.0) + 0.5) - 0.5) * (PI / 6.0) * r;
    col += green * 0.06 * smoothstep(0.004, 0.0, spoke) * step(0.08, r);
    col += green * trail * 0.35 * (0.6 + 0.4 * r);
    // The blips: bright as the sweep paints them, fading till it comes round again.
    for (int i = 0; i < 8; i++) {
      if (float(i) >= uCount) break;
      vec2 b = uBlips[i];
      vec2 bp = vec2(sin(b.x), cos(b.x)) * b.y;
      float d = length(p - bp);
      float since = mod(sweepAng - b.x + 2.0 * PI, 2.0 * PI);
      float lit = exp(-since * 0.9);
      col += green * smoothstep(0.045, 0.0, d) * (0.4 + 2.2 * lit);
      // A little data tag beside each.
      col += green * 0.35 * step(abs(p.y - bp.y - 0.06), 0.012) * step(0.05, p.x - bp.x) * step(p.x - bp.x, 0.17) * (0.5 + lit);
    }
    col += vec3(0.01, 0.03, 0.02) * (1.0 - r);
    gl_FragColor = vec4(col * 1.4, 1.0);
  }
`;

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, cast = false) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

/** A thin bar from a to b. */
function beam(a: THREE.Vector3, b: THREE.Vector3, w: number, d: number, mat: THREE.Material) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, d), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  m.castShadow = true;
  return m;
}

/** A flat quad through four corners (in order round the edge). */
function quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, mat: THREE.Material) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([...a.toArray(), ...b.toArray(), ...c.toArray(), ...d.toArray()], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

/** Acoustic wall panels: warm light gray, a seam every 60cm. */
function panels() {
  const [c, g] = canvas(512, 512);
  const r = rng(9);
  g.fillStyle = '#a9a69f';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${r() * 0.05})`;
    g.fillRect(r() * 512, r() * 512, 2, 2);
  }
  for (const x of [0, 256]) {
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(x, 0, 3, 512);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(x + 3, 0, 1, 512);
  }
  return texture(c, { repeat: [1, 1] });
}

/** Charcoal carpet tiles, laid in alternating directions. */
function carpet() {
  const [c, g] = canvas(512, 512);
  const r = rng(13);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      g.fillStyle = (x + y) % 2 ? '#2b2e33' : '#30333a';
      g.fillRect(x * 128, y * 128, 128, 128);
      for (let k = 0; k < 40; k++) {
        g.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.08})`;
        if ((x + y) % 2) g.fillRect(x * 128 + r() * 128, y * 128, 1.5, 128);
        else g.fillRect(x * 128, y * 128 + r() * 128, 128, 1.5);
      }
    }
  for (let i = 0; i < 6000; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '120,130,150' : '0,0,0'},${r() * 0.12})`;
    g.fillRect(r() * 512, r() * 512, 1.5, 1.5);
  }
  return texture(c, { repeat: [4, 4] });
}

/** A flight strip in its holder: callsign, type, route, a colored edge. */
function strip(seed: number) {
  const r = rng(seed);
  const [c, g] = canvas(512, 64);
  const dep = r() < 0.6;
  g.fillStyle = dep ? '#d8e4f2' : '#f3e2b8';
  g.fillRect(0, 0, 512, 64);
  g.fillStyle = dep ? '#3b6db0' : '#c0752a';
  g.fillRect(0, 0, 14, 64);
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 2;
  for (const x of [120, 230, 400]) {
    g.beginPath();
    g.moveTo(x, 4);
    g.lineTo(x, 60);
    g.stroke();
  }
  g.fillStyle = '#1b1b22';
  g.font = '700 30px "Space Mono"';
  g.textBaseline = 'middle';
  g.fillText(`EW${100 + Math.floor(r() * 899)}`, 20, 32);
  g.font = '400 20px "Space Mono"';
  g.fillText(['A320', 'B738', 'A21N', 'E175', 'B789'][Math.floor(r() * 5)], 128, 22);
  g.fillText(`FL${Math.floor(r() * 30 + 10) * 10}`, 128, 46);
  g.fillText(['RWY 09', 'HOLD A4', 'TAXI B', 'CLRD'][Math.floor(r() * 4)], 240, 32);
  // Pencil marks: the controller's scribbles.
  g.strokeStyle = 'rgba(30,30,60,0.7)';
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(410, 40);
  for (let x = 410; x < 500; x += 10) g.lineTo(x, 30 + r() * 16);
  g.stroke();
  return texture(c);
}

/** The cab; its outside is lit by the same morning as the airfield (`daylight`). */
export function buildCab(daylight: DaylightUniforms): Cab {
  RectAreaLightUniformsLib.init();
  const group = new THREE.Group();
  const { x0, x1, z0, z1, h } = ROOM;
  const t = 0.2;

  const wallTex = panels();
  const wallFor = (w: number, ht: number) => {
    const tx = wallTex.clone();
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
    tx.repeat.set(w / 1.2, ht / 1.2);
    tx.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: tx, roughness: 0.9 });
  };
  const trim = new THREE.MeshStandardMaterial({ color: '#2a2c30', roughness: 0.5, metalness: 0.4 });
  const frame = new THREE.MeshStandardMaterial({ color: '#3a3d42', roughness: 0.4, metalness: 0.6 });

  // Floor and ceiling. The ceiling reaches out over the leaning glass.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshStandardMaterial({ map: carpet(), roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, (z0 + z1) / 2);
  floor.receiveShadow = true;
  group.add(floor);
  const [cc, cg] = canvas(256, 256);
  cg.fillStyle = '#26272b';
  cg.fillRect(0, 0, 256, 256);
  cg.strokeStyle = '#17181b';
  cg.lineWidth = 3;
  cg.strokeRect(0, 0, 256, 256);
  const ceilTex = texture(cc, { repeat: [(x1 - x0 + 2 * LEAN) / 0.6, (z1 - z0 + LEAN) / 0.6] });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 2 * LEAN, z1 - z0 + LEAN), new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.95 }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, h, (z0 - LEAN + z1) / 2);
  group.add(ceiling);
  // Recessed downlights in the ceiling, dimmed for the morning.
  const can = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.35, 1.0) });
  const downs: [number, number][] = [
    [x1 - 0.5, 0.2],
    [0.35, z1 - 0.6],
    [x0 + 0.5, 0.6],
  ];
  for (const [x, z] of downs) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.07, 20), can);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(x, h - 0.005, z);
    group.add(disc);
    const light = new THREE.PointLight('#ffc996', 1.5, 3.6, 1.5);
    light.position.set(x, h - 0.15, z);
    group.add(light);
  }

  // The solid walls: the back, the sides behind the glass, and below the sill all round.
  group.add(box(x1 - x0 + 2 * t, h, t, wallFor(x1 - x0, h), 0, h / 2, z1 + t / 2));
  for (const [x, sx] of [
    [x0 - t / 2, -1],
    [x1 + t / 2, 1],
  ] as const) {
    group.add(box(t, h, z1 - SIDE_Z, wallFor(z1 - SIDE_Z, h), x, h / 2, (SIDE_Z + z1) / 2));
    group.add(box(t, SILL, SIDE_Z - z0, wallFor(SIDE_Z - z0, SILL), x, SILL / 2, (z0 + SIDE_Z) / 2));
    // Where the leaning glass meets the upright wall: a triangle of wall to close the gap.
    const xa = sx > 0 ? x1 : x0;
    const xb = xa + sx * LEAN;
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([xa, SILL, SIDE_Z, xb, h, SIDE_Z, xa, h, SIDE_Z], 3));
    tri.computeVertexNormals();
    group.add(new THREE.Mesh(tri, new THREE.MeshStandardMaterial({ color: '#8f8c86', roughness: 0.9, side: THREE.DoubleSide })));
  }
  group.add(box(x1 - x0 + 2 * t, SILL, t, wallFor(x1 - x0, SILL), 0, SILL / 2, z0 - t / 2));
  // Skirting.
  for (const [w, x, z, ry] of [
    [x1 - x0, 0, z1 - 0.01, 0],
    [z1 - z0, x0 + 0.01, (z0 + z1) / 2, Math.PI / 2],
    [z1 - z0, x1 - 0.01, (z0 + z1) / 2, Math.PI / 2],
    [x1 - x0, 0, z0 + 0.01, 0],
  ] as const) {
    const s = box(w, 0.08, 0.02, trim, x, 0.04, z);
    s.rotation.y = ry;
    group.add(s);
  }

  // The glass: three leaning panes, front and both front corners.
  const glass = new THREE.ShaderMaterial({
    vertexShader: GLASS_VERT,
    fragmentShader: GLASS_FRAG,
    uniforms: { uSheen: { value: new THREE.Color('#9fb0d8') } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const FL = v(x0, SILL, z0);
  const FR = v(x1, SILL, z0);
  const TL = v(x0 - LEAN, h, z0 - LEAN);
  const TR = v(x1 + LEAN, h, z0 - LEAN);
  const SL = v(x0, SILL, SIDE_Z);
  const SR = v(x1, SILL, SIDE_Z);
  const STL = v(x0 - LEAN, h, SIDE_Z);
  const STR = v(x1 + LEAN, h, SIDE_Z);
  for (const [a, b, c, d] of [
    [FL, FR, TR, TL],
    [SL, FL, TL, STL],
    [FR, SR, STR, TR],
  ]) {
    const pane = quad(a, b, c, d, glass);
    pane.renderOrder = 2;
    group.add(pane);
  }
  // Mullions: the corners, two more across the front, the backs of the side panes,
  // and rails along the sill and the head.
  const fw = 0.05;
  for (const [a, b] of [
    [FL, TL],
    [FR, TR],
    [SL, STL],
    [SR, STR],
  ])
    group.add(beam(a, b, fw, fw, frame));
  for (const k of [-1 / 3, 1 / 3]) {
    const xb = k * (x1 - x0);
    group.add(beam(v(xb, SILL, z0), v(xb * ((x1 + LEAN) / x1), h, z0 - LEAN), fw * 0.8, fw * 0.8, frame));
  }
  for (const [a, b] of [
    [SL, FL],
    [FL, FR],
    [FR, SR],
    [STL, TL],
    [TL, TR],
    [TR, STR],
  ])
    group.add(beam(a, b, 0.06, 0.06, frame));
  // The sill: a deep ledge inside the glass.
  const sillMat = new THREE.MeshStandardMaterial({ color: '#4a4c51', roughness: 0.6, metalness: 0.2 });
  group.add(box(x1 - x0, 0.03, 0.16, sillMat, 0, SILL - 0.015, z0 + 0.08, true));
  for (const sx of [-1, 1]) group.add(box(0.16, 0.03, SIDE_Z - z0, sillMat, sx * (x1 - 0.08), SILL - 0.015, (z0 + SIDE_Z) / 2, true));

  // Sun visors: smoky roller blinds, some pulled part way down the glass.
  const visor = new THREE.MeshStandardMaterial({ color: '#1a1c22', transparent: true, opacity: 0.55, roughness: 0.6, side: THREE.DoubleSide, depthWrite: false });
  const along = (a: THREE.Vector3, b: THREE.Vector3, k: number) => a.clone().lerp(b, k);
  for (const [x, drop] of [
    [1.25, 0.32],
    [1.65, 0.5],
  ] as const) {
    // Hung just inside the leaning glass, following its slope.
    const w = 0.7;
    const top0 = v(x - w / 2 + 0.05, h - 0.02, z0 - LEAN + 0.06);
    const top1 = v(x + w / 2 - 0.05, h - 0.02, z0 - LEAN + 0.06);
    const k = drop / (h - SILL);
    const bot0 = along(top0, v(top0.x, SILL, z0 + 0.06), k);
    const bot1 = along(top1, v(top1.x, SILL, z0 + 0.06), k);
    const blind = quad(top0, top1, bot1, bot0, visor);
    blind.renderOrder = 3;
    group.add(blind);
    group.add(beam(bot0, bot1, 0.02, 0.02, trim));
  }
  // The roller housings along the head of the glass.
  group.add(beam(v(x0 - LEAN + 0.1, h - 0.04, z0 - LEAN + 0.08), v(x1 + LEAN - 0.1, h - 0.04, z0 - LEAN + 0.08), 0.06, 0.06, trim));

  // The console in the right-hand corner, under the side glass: a sloped desk with
  // screens, the flight-strip bay, and the radio panel.
  const consoleMat = new THREE.MeshStandardMaterial({ color: '#3b3e44', roughness: 0.55, metalness: 0.2 });
  const cx0 = 1.8;
  const cz0 = z0 + 0.02;
  const cz1 = SIDE_Z + 0.25;
  const cw = x1 - cx0;
  group.add(box(cw, 0.82, cz1 - cz0, consoleMat, cx0 + cw / 2, 0.41, (cz0 + cz1) / 2, true));
  // The strip bay: a sloped board of holders, facing back into the room.
  const bay = new THREE.Group();
  bay.position.set(cx0 + cw / 2, 0.82, (cz0 + cz1) / 2);
  bay.rotation.y = Math.PI / 2 + 0.25;
  const bayBoard = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.02, 0.36), new THREE.MeshStandardMaterial({ color: '#1d1f23', roughness: 0.6 }));
  bayBoard.rotation.x = -0.45;
  bayBoard.position.set(0, 0.09, 0);
  bayBoard.castShadow = true;
  bay.add(bayBoard);
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.032), new THREE.MeshStandardMaterial({ map: strip(i * 17 + 3), roughness: 0.7 }));
    const col = i % 2;
    const row = Math.floor(i / 2);
    s.position.set(-0.14 + col * 0.28, 0.011, -0.13 + row * 0.075);
    s.rotation.x = -Math.PI / 2;
    bayBoard.add(s);
  }
  group.add(bay);
  // A small screen on the console showing the weather and the runway in use.
  const wx = label(
    [
      { text: 'WIND 090/06KT', font: '400 34px "VT323"', color: '#7dffb2', x: 18, y: 34 },
      { text: 'QNH 1018   RWY 09', font: '400 34px "VT323"', color: '#7dffb2', x: 18, y: 72 },
      { text: 'VIS 8KM BR  SCT012', font: '400 34px "VT323"', color: '#ffcf6a', x: 18, y: 110 },
    ],
    320,
    140,
    '#03100a',
  );
  const wxScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.096), new THREE.MeshBasicMaterial({ map: wx, color: new THREE.Color(1.3, 1.3, 1.3) }));
  wxScreen.position.set(x1 - 0.03, 1.05, -1.62);
  wxScreen.rotation.y = -Math.PI / 2;
  group.add(wxScreen);
  group.add(box(0.03, 0.12, 0.25, trim, x1 - 0.045, 1.05, -1.62));
  // A desk microphone on its stand, and the handset.
  const mic = new THREE.Group();
  const micBase = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.02, 20), trim);
  mic.add(micBase);
  const goose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([v(0, 0.01, 0), v(0, 0.12, 0.01), v(-0.04, 0.2, 0.06)]), 16, 0.005, 6), trim);
  mic.add(goose);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 0.05, 12), trim);
  head.position.set(-0.05, 0.205, 0.075);
  head.rotation.x = 1.0;
  mic.add(head);
  mic.position.set(2.05, 0.82, SIDE_Z + 0.1);
  mic.rotation.y = -0.6;
  group.add(mic);

  // The radar scope, hung from the ceiling over the corner, tilted down toward the desk.
  const scopeMat = new THREE.ShaderMaterial({
    vertexShader: SCOPE_VERT,
    fragmentShader: SCOPE_FRAG,
    uniforms: { uTime: { value: 0 }, uBlips: { value: Array.from({ length: 8 }, () => new THREE.Vector2()) }, uCount: { value: 0 } },
  });
  const scope = new THREE.Group();
  scope.position.copy(SCOPE.pos);
  scope.lookAt(0, 1.3, 0.9);
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(SCOPE.size + 0.08, SCOPE.size + 0.1, 0.12), trim);
  bezel.position.z = -0.06;
  bezel.castShadow = true;
  scope.add(bezel);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(SCOPE.size, SCOPE.size), scopeMat);
  face.position.set(0, 0.01, 0.002);
  scope.add(face);
  const scopeLabel = label([{ text: 'ASR · 32NM', font: '400 30px "Space Mono"', color: '#9aa4ad', x: 128, y: 20, align: 'center' }], 256, 40);
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.019), new THREE.MeshBasicMaterial({ map: scopeLabel, transparent: true }));
  tag.position.set(0, -SCOPE.size / 2 - 0.022, 0.002);
  scope.add(tag);
  group.add(scope);
  // Its arm up to the ceiling.
  group.add(beam(SCOPE.pos.clone().add(v(0.06, 0.12, 0.02)), v(SCOPE.pos.x + 0.1, h, SCOPE.pos.z + 0.05), 0.04, 0.04, trim));

  // Binoculars on the sill, ready.
  const rubber = new THREE.MeshStandardMaterial({ color: '#131416', roughness: 0.85 });
  const binos = new THREE.Group();
  for (const sx of [-1, 1]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.15, 20), rubber);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(sx * 0.036, 0.034, 0);
    barrel.castShadow = true;
    binos.add(barrel);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.026, 20), new THREE.MeshStandardMaterial({ color: '#284056', roughness: 0.05, metalness: 0.8 }));
    lens.position.set(sx * 0.036, 0.034, -0.0755);
    lens.rotation.y = Math.PI;
    binos.add(lens);
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.04, 16), rubber);
    eye.rotation.x = Math.PI / 2;
    eye.position.set(sx * 0.03, 0.04, 0.09);
    binos.add(eye);
  }
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.12, 10), frame);
  hinge.rotation.x = Math.PI / 2;
  hinge.position.set(0, 0.045, 0.01);
  binos.add(hinge);
  binos.position.set(1.15, SILL, z0 + 0.07);
  binos.rotation.y = 0.5;
  group.add(binos);

  // --- outside: the cab's shell, its roof and the shaft down to the ground -----------
  const concrete = outdoor(daylight, { color: '#b9b4ab' });
  const cladding = outdoor(daylight, { color: '#d9d6cf' });
  // The roof: a deep cap that overhangs the glass, its fascia catching the sun.
  const roof = box(x1 - x0 + 2 * LEAN + 0.6, 0.55, z1 - z0 + LEAN + 0.6, cladding, 0, h + 0.275, (z0 - LEAN + z1) / 2, true);
  group.add(roof);
  // A floor slab under the cab that runs out as a walkway beneath the glass.
  group.add(box(x1 - x0 + 2 * LEAN + 0.8, 0.5, z1 - z0 + LEAN + 0.7, cladding, 0, -0.25, (z0 - LEAN + z1) / 2 - 0.1));
  // Below: the equipment floor, a little narrower, with a row of small windows.
  const [ec, eg] = canvas(512, 128);
  eg.fillStyle = '#c8c3ba';
  eg.fillRect(0, 0, 512, 128);
  for (let x = 20; x < 512; x += 64) {
    eg.fillStyle = '#1d2026';
    eg.fillRect(x, 44, 36, 40);
  }
  const eqMat = outdoor(daylight, { map: texture(ec, { repeat: [2, 1] }) });
  group.add(box(4.6, 3.4, 4.6, eqMat, 0, -2.2, 0.3));
  // The shaft: a round concrete column, with a slot of windows up the stair.
  const shaftH = -3.9 - GROUND;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.4, shaftH, 32, 1, true), concrete);
  shaft.position.set(0, GROUND + shaftH / 2, 0.3);
  shaft.castShadow = true;
  group.add(shaft);
  const [sc, sg] = canvas(64, 1024);
  sg.fillStyle = '#20232a';
  sg.fillRect(0, 0, 64, 1024);
  for (let y = 0; y < 1024; y += 32) {
    sg.fillStyle = Math.random() < 0.3 ? '#ffd9a0' : '#3a3f48';
    sg.fillRect(10, y + 4, 44, 22);
  }
  const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.5, shaftH - 4), new THREE.MeshBasicMaterial({ map: texture(sc) }));
  slot.position.set(0, GROUND + shaftH / 2 - 1, 0.3 - 2.21);
  slot.rotation.y = Math.PI;
  group.add(slot);
  // On the roof: masts and the surface radar, turning.
  const mastMat = outdoor(daylight, { color: '#d0d0d0' });
  const mast = box(0.12, 2.4, 0.12, mastMat, -1.2, h + 1.75, 1.2);
  group.add(mast);
  group.add(box(0.06, 1.6, 0.06, mastMat, 1.6, h + 1.35, 1.8));
  const radarMount = box(0.3, 0.8, 0.3, mastMat, 0.6, h + 0.95, 0.4);
  group.add(radarMount);
  const antenna = new THREE.Group();
  antenna.position.set(0.6, h + 1.42, 0.4);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, 0.12), outdoor(daylight, { color: '#e6e6e6' }));
  antenna.add(bar);
  group.add(antenna);
  // A red light at the top of the mast, for the aircraft.
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.3, 0.2) }));
  beacon.position.set(-1.2, h + 3.0, 1.2);
  group.add(beacon);

  // --- light ----------------------------------------------------------------------
  // The low sun, from out over the airfield to the right, straight in across the room.
  const sun = new THREE.SpotLight('#ffb27e', 70, 40, 0.42, 0.5, 1.0);
  sun.position.set(9.5, 4.2, -15);
  sun.target.position.set(-0.2, 1.2, 0.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  sun.shadow.camera.near = 8;
  sun.shadow.camera.far = 30;
  group.add(sun, sun.target);
  const fill = new THREE.RectAreaLight('#b9b4e0', 1.4, x1 - x0 + 2 * LEAN, h - SILL);
  fill.position.set(0, (h + SILL) / 2, z0 - 0.3);
  fill.lookAt(0, (h + SILL) / 2, 1);
  group.add(fill);
  group.add(new THREE.HemisphereLight('#8d93c2', '#3a2c26', 0.35));
  // The console's screens glow a little on the corner.
  const screenGlow = new THREE.PointLight('#7dffb2', 0.25, 1.2, 2);
  screenGlow.position.set(2.0, 1.1, -1.6);
  group.add(screenGlow);

  return {
    group,
    sun,
    fill,
    setBlips(blips) {
      const list = scopeMat.uniforms.uBlips.value as THREE.Vector2[];
      blips.slice(0, 8).forEach((b, i) => list[i].set(b.bearing, b.range));
      scopeMat.uniforms.uCount.value = Math.min(8, blips.length);
    },
    tick(time) {
      scopeMat.uniforms.uTime.value = time;
      antenna.rotation.y = time * 1.6;
      (beacon.material as THREE.MeshBasicMaterial).color.setRGB(time % 1.5 < 0.75 ? 4 : 0.3, 0.2, 0.15);
    },
  };
}
