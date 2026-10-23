// The emergency brake's sparks: short, hot streaks flung back and down off the
// wheels where the shoes grind, bouncing off the rail and dying in a moment; a
// little smoke drifting back from the bogies; and the rail head glowing under
// each wheel while it lasts. All of it rides with the train (the car stands
// still and the land goes by), so everything here is in the car's frame.
import * as THREE from 'three';
import { CAR } from './plan';

/** Where the wheels are along the train: our two bogies' axles and the next car's nearest. */
export const WHEEL_X = [-0.95, 1.55, 6.45, 8.95, -16.05, -18.55, -22.4, -24.9];
/** Each side's wheels, across the train, and the rail under them. */
const WHEEL_Z = 0.75;
const RAIL_Z = 0.7175;
/** The top of the rails, the ballast the sparks land on. */
const RAIL_HEAD = CAR.rail + 0.045;
const GROUND = -1.36;

export interface Sparks {
  group: THREE.Group;
  /**
   * One frame: `rate` is how hard the brakes are working (0..1), `v` the train's
   * speed (the ground goes back under it at that speed), `dt` seconds.
   */
  tick(rate: number, v: number, dt: number, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer): void;
  /** How many are flying, for the tests. */
  live(): number;
}

export function buildSparks(opts: { count: number; reduced: boolean }): Sparks {
  const group = new THREE.Group();
  group.name = 'sparks';
  const N = opts.count;

  // --- the streaks: four corners each, stretched along the way each one flies -------------------
  const head = new Float32Array(N * 12);
  const vel = new Float32Array(N * 12);
  const heat = new Float32Array(N * 4);
  const corner = new Float32Array(N * 8);
  const index = new Uint32Array(N * 6);
  for (let i = 0; i < N; i++) {
    // Tail (0) and head (1), each side across (-1, 1).
    corner.set([0, -1, 0, 1, 1, -1, 1, 1], i * 8);
    const b = i * 4;
    index.set([b, b + 2, b + 1, b + 1, b + 2, b + 3], i * 6);
  }
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(head, 3).setUsage(THREE.DynamicDrawUsage);
  const velAttr = new THREE.BufferAttribute(vel, 3).setUsage(THREE.DynamicDrawUsage);
  const heatAttr = new THREE.BufferAttribute(heat, 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('aVel', velAttr);
  geo.setAttribute('aHeat', heatAttr);
  geo.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  const streakMat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute vec3 aVel;
      attribute float aHeat;
      attribute vec2 aCorner;
      uniform vec2 uRes;
      uniform float uLen;
      uniform float uWidth;
      varying float vHeat;
      varying vec2 vC;
      void main() {
        vHeat = aHeat;
        vC = aCorner;
        // Out cold, or too close to the lens to draw: off the screen.
        vec4 off = vec4(0.0, 0.0, 2.0, 1.0);
        if (aHeat <= 0.0) { gl_Position = off; return; }
        // The streak runs back from where it is along the way it came, as a long exposure would catch it.
        float speed = length(aVel);
        vec3 back = speed > 1e-4 ? aVel * (min(speed * uLen, 0.8) / speed) : vec3(0.0);
        vec4 h = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec4 t = projectionMatrix * modelViewMatrix * vec4(position - back, 1.0);
        if (h.w < 0.05 || t.w < 0.05) { gl_Position = off; return; }
        vec2 halfRes = uRes * 0.5;
        vec2 d = (h.xy / h.w - t.xy / t.w) * halfRes;
        float len = length(d);
        vec2 dir = len > 1e-3 ? d / len : vec2(1.0, 0.0);
        vec2 across = vec2(-dir.y, dir.x);
        float w = uWidth * (0.55 + 0.6 * aHeat);
        vec4 p = aCorner.x > 0.5 ? h : t;
        vec2 px = across * aCorner.y * w + dir * (aCorner.x > 0.5 ? w : -w * 0.5);
        p.xy += px / halfRes * p.w;
        gl_Position = p;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vHeat;
      varying vec2 vC;
      void main() {
        // Bright along the middle, hottest at the head, cooling to orange down the tail.
        float across = clamp(1.0 - vC.y * vC.y, 0.0, 1.0);
        float along = clamp(vC.x, 0.0, 1.0);
        float k = across * across * (0.08 + 0.92 * along * along);
        vec3 hot = mix(vec3(1.0, 0.24, 0.03), vec3(1.0, 0.72, 0.36), clamp(vHeat * along * 1.15, 0.0, 1.0));
        gl_FragColor = vec4(hot * k * (0.5 + 2.8 * vHeat), 1.0);
      }
    `,
    uniforms: { uRes: { value: new THREE.Vector2(1, 1) }, uLen: { value: 0.03 }, uWidth: { value: 1.6 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const streaks = new THREE.Mesh(geo, streakMat);
  streaks.frustumCulled = false;
  streaks.renderOrder = 6;
  group.add(streaks);

  // --- the smoke: a few soft puffs from the shoes, drifting back and up ---------------------------
  const PUFFS = opts.reduced ? 0 : 40;
  const puffPos = new Float32Array(Math.max(1, PUFFS) * 3);
  const puffSize = new Float32Array(Math.max(1, PUFFS));
  const puffAlpha = new Float32Array(Math.max(1, PUFFS));
  const puffVel = new Float32Array(Math.max(1, PUFFS) * 3);
  const puffAge = new Float32Array(Math.max(1, PUFFS)).fill(-1);
  const puffLife = new Float32Array(Math.max(1, PUFFS)).fill(1);
  const puffGeo = new THREE.BufferGeometry();
  const puffPosAttr = new THREE.BufferAttribute(puffPos, 3).setUsage(THREE.DynamicDrawUsage);
  const puffSizeAttr = new THREE.BufferAttribute(puffSize, 1).setUsage(THREE.DynamicDrawUsage);
  const puffAlphaAttr = new THREE.BufferAttribute(puffAlpha, 1).setUsage(THREE.DynamicDrawUsage);
  puffGeo.setAttribute('position', puffPosAttr);
  puffGeo.setAttribute('aSize', puffSizeAttr);
  puffGeo.setAttribute('aAlpha', puffAlphaAttr);
  const puffMat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aAlpha;
      uniform float uScale;
      varying float vAlpha;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float d = max(-mv.z, 0.05);
        vAlpha = aAlpha * smoothstep(0.3, 1.2, d);
        gl_PointSize = aAlpha > 0.0 ? clamp(aSize * uScale / d, 1.0, 320.0) : 0.0;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float r = clamp(length(c) * 2.0, 0.0, 1.0);
        float a = (1.0 - r) * (1.0 - r) * vAlpha;
        if (a < 0.002) discard;
        gl_FragColor = vec4(uColor, a);
      }
    `,
    uniforms: { uScale: { value: 500 }, uColor: { value: new THREE.Color(0.2, 0.19, 0.2) } },
    transparent: true,
    depthWrite: false,
  });
  const smoke = new THREE.Points(puffGeo, puffMat);
  smoke.frustumCulled = false;
  smoke.renderOrder = 5;
  group.add(smoke);

  // --- the rail glowing under each braking wheel: a strip on the rail head, hottest at the wheel ---
  const strips: number[] = [];
  const along: number[] = [];
  const LEN = 1.4;
  for (const x of WHEEL_X)
    for (const s of [-1, 1]) {
      const z = s * RAIL_Z;
      const y = RAIL_HEAD + 0.004;
      // From just ahead of the wheel back along the rail it has just ground.
      const x0 = x + 0.12;
      const x1 = x - LEN;
      strips.push(x0, y, z - 0.04, x0, y, z + 0.04, x1, y, z - 0.04, x1, y, z - 0.04, x0, y, z + 0.04, x1, y, z + 0.04);
      along.push(0, 0, 1, 1, 0, 1);
    }
  const railGeo = new THREE.BufferGeometry();
  railGeo.setAttribute('position', new THREE.Float32BufferAttribute(strips, 3));
  railGeo.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
  const railMat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute float aAlong;
      varying float vAlong;
      void main() {
        vAlong = aAlong;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uGlow;
      varying float vAlong;
      void main() {
        float k = clamp(1.0 - vAlong, 0.0, 1.0);
        k = k * k * k;
        gl_FragColor = vec4(vec3(1.0, 0.36, 0.08) * k * uGlow * 2.4, 1.0);
      }
    `,
    uniforms: { uGlow: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const rails = new THREE.Mesh(railGeo, railMat);
  rails.frustumCulled = false;
  rails.renderOrder = 4;
  group.add(rails);

  // --- state ---------------------------------------------------------------------------------------
  const life = new Float32Array(N);
  const p = new Float32Array(N * 3);
  const u = new Float32Array(N * 3);
  const hot = new Float32Array(N);
  let carry = 0;
  let puffCarry = 0;
  let puffsBefore = 0;
  let glowNow = 0;
  let alive = 0;
  let dirty = true;
  const rand = Math.random;

  const spawn = (i: number, v: number) => {
    const x = WHEEL_X[Math.floor(rand() * WHEEL_X.length)];
    const side = rand() < 0.5 ? -1 : 1;
    const r = rand();
    const k = i * 3;
    if (r < 0.65) {
      // From where the wheel meets the rail: back along it and down, skipping off the head.
      p[k] = x - 0.05 - rand() * 0.25;
      p[k + 1] = RAIL_HEAD + 0.01;
      p[k + 2] = side * (RAIL_Z + 0.02 + rand() * 0.06);
      u[k] = -(0.35 + rand() * 0.55) * v - 0.5;
      u[k + 1] = -0.4 + rand() * 1.8;
      u[k + 2] = side * (0.3 + rand() * 1.8);
      life[i] = 0.08 + rand() * 0.22;
    } else if (r < 0.9) {
      // Off the shoe at the back of the wheel: down with the tread.
      p[k] = x - 0.44;
      p[k + 1] = CAR.rail + 0.46 - 0.1 + rand() * 0.2;
      p[k + 2] = side * (WHEEL_Z + 0.04);
      u[k] = -(0.15 + rand() * 0.35) * v;
      u[k + 1] = -(1.5 + rand() * 2.5);
      u[k + 2] = side * (0.2 + rand() * 1.2);
      life[i] = 0.12 + rand() * 0.25;
    } else {
      // Now and then one flung well out from under the car.
      p[k] = x - 0.1;
      p[k + 1] = RAIL_HEAD + 0.02;
      p[k + 2] = side * (RAIL_Z + 0.05);
      u[k] = -(0.3 + rand() * 0.4) * v;
      u[k + 1] = 0.8 + rand() * 1.6;
      u[k + 2] = side * (3 + rand() * 4);
      life[i] = 0.3 + rand() * 0.3;
    }
    hot[i] = 1;
  };

  const puff = (i: number, v: number) => {
    const x = WHEEL_X[Math.floor(rand() * 4)];
    const side = rand() < 0.5 ? -1 : 1;
    const k = i * 3;
    puffPos[k] = x - 0.3;
    puffPos[k + 1] = RAIL_HEAD + 0.15 + rand() * 0.2;
    puffPos[k + 2] = side * (WHEEL_Z + 0.2 + rand() * 0.3);
    puffVel[k] = -(0.15 + rand() * 0.2) * v;
    puffVel[k + 1] = 0.25 + rand() * 0.3;
    puffVel[k + 2] = side * (0.2 + rand() * 0.4);
    puffAge[i] = 0;
    puffLife[i] = 1.4 + rand() * 1.2;
  };

  return {
    group,
    live: () => alive,
    tick(rate, v, dtIn, camera, renderer) {
      const dt = Math.min(0.05, Math.max(0, dtIn));
      // New sparks, as many as the brakes are throwing.
      if (rate > 0 && dt > 0) {
        carry = Math.min(carry + dt * 1400 * rate, 60);
        for (let i = 0; i < N && carry >= 1; i++) {
          if (life[i] > 0) continue;
          spawn(i, v);
          carry -= 1;
        }
      } else carry = 0;
      // The sparks fly, fall, bounce off the ballast and go out.
      alive = 0;
      for (let i = 0; i < N; i++) {
        const k = i * 3;
        if (life[i] <= 0) {
          if (hot[i] > 0) {
            hot[i] = 0;
            heat.fill(0, i * 4, i * 4 + 4);
            dirty = true;
          }
          continue;
        }
        alive++;
        life[i] -= dt;
        u[k + 1] -= 9.8 * dt;
        p[k] += u[k] * dt;
        p[k + 1] += u[k + 1] * dt;
        p[k + 2] += u[k + 2] * dt;
        if (p[k + 1] < GROUND && u[k + 1] < 0) {
          // A bounce: the ballast drags it back with the land going by, and it cools.
          p[k + 1] = GROUND;
          u[k + 1] = -u[k + 1] * 0.3;
          u[k] = u[k] * 0.5 - v * 0.4;
          u[k + 2] *= 0.5;
          hot[i] *= 0.6;
        }
        const h = life[i] > 0 ? Math.min(1, hot[i] * Math.min(1, life[i] / 0.12)) : 0;
        for (let c = 0; c < 4; c++) {
          head[(i * 4 + c) * 3] = p[k];
          head[(i * 4 + c) * 3 + 1] = p[k + 1];
          head[(i * 4 + c) * 3 + 2] = p[k + 2];
          vel[(i * 4 + c) * 3] = u[k];
          vel[(i * 4 + c) * 3 + 1] = u[k + 1];
          vel[(i * 4 + c) * 3 + 2] = u[k + 2];
          heat[i * 4 + c] = h;
        }
        dirty = true;
      }
      if (dirty) {
        posAttr.needsUpdate = true;
        velAttr.needsUpdate = true;
        heatAttr.needsUpdate = true;
        dirty = alive > 0;
      }
      streaks.visible = alive > 0;
      const size = renderer.getDrawingBufferSize(streakMat.uniforms.uRes.value as THREE.Vector2);
      streakMat.uniforms.uWidth.value = Math.max(1.5, size.y / 400);

      // The smoke.
      let puffs = 0;
      if (PUFFS) {
        if (rate > 0.05 && dt > 0) {
          puffCarry = Math.min(puffCarry + dt * 14 * rate, 4);
          for (let i = 0; i < PUFFS && puffCarry >= 1; i++) {
            if (puffAge[i] >= 0) continue;
            puff(i, v);
            puffCarry -= 1;
          }
        }
        for (let i = 0; i < PUFFS; i++) {
          if (puffAge[i] < 0) {
            puffAlpha[i] = 0;
            continue;
          }
          puffs++;
          puffAge[i] += dt;
          const a = puffAge[i] / puffLife[i];
          if (a >= 1) {
            puffAge[i] = -1;
            puffAlpha[i] = 0;
            continue;
          }
          const k = i * 3;
          puffPos[k] += puffVel[k] * dt;
          puffPos[k + 1] += puffVel[k + 1] * dt;
          puffPos[k + 2] += puffVel[k + 2] * dt;
          puffSize[i] = 0.35 + a * 1.4;
          puffAlpha[i] = 0.22 * Math.min(1, a * 6) * (1 - a);
        }
        if (puffs > 0 || puffsBefore > 0) {
          puffPosAttr.needsUpdate = true;
          puffSizeAttr.needsUpdate = true;
          puffAlphaAttr.needsUpdate = true;
        }
        puffsBefore = puffs;
        puffMat.uniforms.uScale.value = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      }
      smoke.visible = puffs > 0;

      // The rail heads glow while the shoes grind, and cool a little slower than the sparks.
      const aim = rate > 0 ? Math.min(1, 0.35 + rate * 0.65) : 0;
      glowNow += (aim - glowNow) * Math.min(1, dt * (aim > glowNow ? 6 : 1.4));
      if (glowNow < 0.003) glowNow = 0;
      railMat.uniforms.uGlow.value = glowNow * (0.85 + 0.15 * Math.sin(performance.now() * 0.05));
      rails.visible = glowNow > 0;
      group.visible = streaks.visible || smoke.visible || rails.visible;
    },
  };
}
