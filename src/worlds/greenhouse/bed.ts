// The word board: carpet bedding on the grass bank across the lawn, the way the
// Victorians spelled out names and dates on a slope. Sixteen little beds in a
// row, edged in terracotta, each planted five by seven: low bronze foliage for
// the ground of the letter, and where the letter's strokes run, silver plants
// that flower. The weasel program breeds the phrase. Where a letter is still
// wrong its strokes are only silver leaves in bud; once it comes right they
// open into scarlet flowers, all at once, glowing in the low sun behind them.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Evolver, MAX_PHRASE } from '../../evolve';
import { rng } from '../../textures';
import type { Board, Evolution } from '../kit';
import { DAYLIGHT, outdoor, type DaylightUniforms } from '../outdoor';
import { glyph } from '../tower/board';
import { BANK, whiteColors } from './grounds';

export const PHRASES = ['EVOLVING WORD', 'IN FULL BLOOM', 'GOLDEN HOUR', 'GROW SOMETHING', 'TEND YOUR GARDEN', 'MAKE SOMETHING', 'SOW AND SEE', 'BEST IN SHOW'];

/** One plant to a cell, this far apart; a letter is five by seven, with a cell's gap to the next. */
export const CELL = 0.14;
const COLS = 5;
const ROWS = 7;
const ADVANCE = (COLS + 1) * CELL;

const VERT = /* glsl */ `
  ${DAYLIGHT}
  attribute vec3 aState;
  uniform float uKind;
  uniform vec3 uSilver;
  uniform vec3 uLeaf;
  uniform vec3 uBud;
  uniform vec3 uFlower;
  varying vec3 vColor;
  varying vec3 vWorld;
  varying vec3 vNrm;
  varying float vPetal;
  void main() {
    float on = aState.x;
    float bloom = aState.y;
    vec3 p = position;
    vec3 col;
    if (uKind < 0.5) {
      // The foliage: low bronze for the ground, a taller silver mound in the strokes.
      p.y *= mix(0.55, 1.0, on);
      col = mix(uSilver, uLeaf, on);
      vPetal = 0.0;
    } else {
      // The flower: a tight green bud that swells and opens scarlet.
      float open = smoothstep(0.45, 1.0, bloom);
      p *= max(bloom, 0.0001) * mix(0.55, 1.0, open);
      p.y += (1.0 - open) * 0.012;
      col = mix(uBud, uFlower, open) * (1.0 + aState.z * 0.8);
      vPetal = open;
    }
    vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
    vWorld = w.xyz;
    vNrm = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vColor = col;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const FRAG = /* glsl */ `
  ${DAYLIGHT}
  varying vec3 vColor;
  varying vec3 vWorld;
  varying vec3 vNrm;
  varying float vPetal;
  void main() {
    vec3 n = normalize(vNrm);
    vec3 v = normalize(cameraPosition - vWorld);
    vec3 col = daylight(vColor, n, vWorld);
    // Petals with the sun behind them glow, the way they do at this hour.
    float back = pow(max(dot(-v, uSunDir), 0.0), 2.0);
    col += vColor * uSunColor * (0.25 + back * 0.9) * vPetal;
    gl_FragColor = vec4(fade(col, vWorld), 1.0);
  }
`;

/** A little bedding flower: five round petals in a cup and a gold eye, about 5 cm across. */
function flowerGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const petal = new THREE.CircleGeometry(0.034, 5);
    petal.scale(0.85, 1, 1);
    petal.translate(0, 0.03, 0);
    petal.rotateX(-Math.PI / 2 + 0.45);
    petal.rotateY((i / 5) * Math.PI * 2);
    petal.translate(0, 0.045, 0);
    parts.push(petal);
  }
  const eye = new THREE.SphereGeometry(0.01, 5, 3);
  eye.translate(0, 0.05, 0);
  parts.push(eye.toNonIndexed());
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => (g.deleteAttribute('uv'), g)));
}

/** A low mound of leaves, about the size of a cell. */
function moundGeometry() {
  const geo = new THREE.IcosahedronGeometry(0.068, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setY(i, Math.max(y, -0.01) * 0.75 + Math.sin(p.getX(i) * 60) * 0.004);
  }
  geo.computeVertexNormals();
  return geo;
}

export interface Bed extends Board {
  group: THREE.Group;
  face: THREE.Mesh;
  /** How many of the letters are right, 0..1. */
  settled(): number;
}

export function buildBed(daylight: DaylightUniforms): Bed {
  const group = new THREE.Group();
  // The bank's own frame: x along it, y up the slope, z out of it toward the house.
  const up = new THREE.Vector3(0, Math.sin(BANK.tilt), -Math.cos(BANK.tilt));
  const out = new THREE.Vector3(0, Math.cos(BANK.tilt), Math.sin(BANK.tilt));
  const frame = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), up, out).setPosition(BANK.center);
  group.matrixAutoUpdate = false;
  group.matrix.copy(frame);

  // The beds: raised a little, soil in a terracotta edging.
  const bedW = COLS * CELL + 0.1;
  const bedH = ROWS * CELL + 0.1;
  const slotX = (s: number) => (s - (MAX_PHRASE - 1) / 2) * ADVANCE;
  const soilParts: THREE.BufferGeometry[] = [];
  const edgeParts: THREE.BufferGeometry[] = [];
  for (let s = 0; s < MAX_PHRASE; s++) {
    const x = slotX(s);
    const soilBox = new THREE.BoxGeometry(bedW, bedH, 0.06);
    soilBox.translate(x, 0, 0.0);
    soilParts.push(soilBox);
    for (const [w, h, dx, dy] of [
      [bedW + 0.06, 0.035, 0, bedH / 2 + 0.0175],
      [bedW + 0.06, 0.035, 0, -bedH / 2 - 0.0175],
      [0.035, bedH, bedW / 2 + 0.0175, 0],
      [0.035, bedH, -bedW / 2 - 0.0175, 0],
    ]) {
      const e = new THREE.BoxGeometry(w, h, 0.1);
      e.translate(x + dx, dy, 0.02);
      edgeParts.push(e);
    }
  }
  const soil = new THREE.Mesh(whiteColors(mergeGeometries(soilParts)), outdoor(daylight, { color: '#3a2a1e', vertexColors: true }));
  const edging = new THREE.Mesh(whiteColors(mergeGeometries(edgeParts)), outdoor(daylight, { color: '#b5623e', vertexColors: true }));
  group.add(soil, edging);

  // A plant in every cell: a mound of leaves, and a flower that only shows in the letter's strokes.
  const N = MAX_PHRASE * COLS * ROWS;
  const state = new Float32Array(N * 3);
  const mounds = new THREE.InstancedMesh(moundGeometry(), new THREE.ShaderMaterial(), N);
  const flowers = new THREE.InstancedMesh(flowerGeometry(), new THREE.ShaderMaterial(), N);
  const r = rng(2024);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const square = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0)));
  for (let s = 0; s < MAX_PHRASE; s++)
    for (let row = 0; row < ROWS; row++)
      for (let col = 0; col < COLS; col++) {
        const i = (s * ROWS + row) * COLS + col;
        const x = slotX(s) + (col - (COLS - 1) / 2) * CELL + (r() - 0.5) * 0.012;
        // Row 0 of the glyph is the top of the letter: up the bank.
        const y = ((ROWS - 1) / 2 - row) * CELL + (r() - 0.5) * 0.012;
        // Each plant stands square to the slope (its +y out of the bank, so the flowers face the house), turned any which way.
        q.copy(square).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28));
        const sc = 0.9 + r() * 0.25;
        m.compose(new THREE.Vector3(x, y, 0.035), q, new THREE.Vector3(sc, sc, sc));
        mounds.setMatrixAt(i, m);
        m.compose(new THREE.Vector3(x, y, 0.075), q, new THREE.Vector3(sc, sc, sc));
        flowers.setMatrixAt(i, m);
      }
  const stateAttr = new THREE.InstancedBufferAttribute(state, 3);
  stateAttr.setUsage(THREE.DynamicDrawUsage);
  mounds.geometry.setAttribute('aState', stateAttr);
  flowers.geometry.setAttribute('aState', stateAttr);
  const colors = {
    uSilver: { value: new THREE.Color('#3e3a1e') },
    uLeaf: { value: new THREE.Color('#b8c4b4') },
    uBud: { value: new THREE.Color('#7a8a3a') },
    uFlower: { value: new THREE.Color('#e01a12') },
  };
  for (const [mesh, kind] of [
    [mounds, 0],
    [flowers, 1],
  ] as const) {
    mesh.material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { ...daylight, ...colors, uKind: { value: kind } } });
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  // What to click: the whole row of beds.
  const face = new THREE.Mesh(new THREE.PlaneGeometry(MAX_PHRASE * ADVANCE, bedH + 0.3), new THREE.MeshBasicMaterial({ visible: false }));
  face.position.z = 0.1;
  group.add(face);
  group.updateMatrixWorld(true);

  // The phrase, bred the usual way.
  const evolver = new Evolver(Math.random, 40, 0.05);
  let phrase = 0;
  evolver.aim(PHRASES[0]);
  evolver.scramble();
  let evo = evolver.state();
  let custom = false;
  let holdUntil = 0;
  let nextGen = 0;
  let lastT = 0;
  // Each cell's eased state: in a stroke (0..1), how open (0..1), and a flash as its letter comes right.
  const wasRight = new Uint8Array(MAX_PHRASE);

  const place = (dt: number) => {
    const L = evo.target.length;
    // The phrase sits in the middle beds; the ones either side stay silver.
    const start = Math.floor((MAX_PHRASE - L) / 2);
    const kOn = 1 - Math.exp(-dt * 5);
    for (let s = 0; s < MAX_PHRASE; s++) {
      const i = s - start;
      const inPhrase = i >= 0 && i < L;
      const ch = inPhrase ? evo.text[i] : ' ';
      const right = inPhrase && evo.text[i] === evo.target[i] && ch !== ' ';
      const flash = right && !wasRight[s];
      wasRight[s] = right ? 1 : 0;
      const g = glyph(ch);
      for (let row = 0; row < ROWS; row++)
        for (let col = 0; col < COLS; col++) {
          const k = ((s * ROWS + row) * COLS + col) * 3;
          const lit = g[row][col] ? 1 : 0;
          state[k] += (lit - state[k]) * kOn;
          // Wrong strokes in bud; right ones open, a little slower, so it reads as blooming.
          const aim = lit ? (right ? 1 : 0.42) : 0;
          const rate = aim > state[k + 1] ? (right ? 2.2 : 4) : 6;
          state[k + 1] += (aim - state[k + 1]) * (1 - Math.exp(-dt * rate));
          state[k + 2] = flash && lit ? 1 : Math.max(0, state[k + 2] - dt * 1.4);
        }
    }
    stateAttr.needsUpdate = true;
  };

  return {
    group,
    face,
    settled: () => {
      const L = evo.target.length || 1;
      let n = 0;
      for (let i = 0; i < evo.target.length; i++) if (evo.text[i] === evo.target[i]) n++;
      return n / L;
    },
    evolution: (): Evolution => ({ ...evo, custom }),
    evolve(text) {
      custom = true;
      holdUntil = 0;
      evolver.aim(text.slice(0, MAX_PHRASE));
      evo = evolver.state();
    },
    tick(t) {
      const dt = Math.min(0.1, Math.max(0, t - lastT));
      lastT = t;
      if (t >= nextGen) {
        let steps = Math.min(12, 1 + Math.floor((t - nextGen) / 0.14));
        nextGen = t + 0.14;
        while (steps-- > 0) {
          if (evo.done) {
            if (!holdUntil) holdUntil = t + (custom ? 18 : 10);
            if (t > holdUntil) {
              holdUntil = 0;
              custom = false;
              phrase = (phrase + 1) % PHRASES.length;
              evolver.aim(PHRASES[phrase]);
            }
          }
          evo = evo.done && holdUntil ? evo : evolver.step();
        }
      }
      place(dt);
      return 0;
    },
  };
}
