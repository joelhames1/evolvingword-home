// The night over the line: a deep blue dome that goes with the camera, a few
// thousand stars with a faint Milky Way across them, and a big low moon on the
// window side. Over the city the horizon glows orange and the stars thin out.
import * as THREE from 'three';
import { canvas, glow, rng, texture } from '../../textures';
import type { Quality } from '../../world';
import { MOON_DIR } from './night';

const R = 2700;

export interface Sky {
  group: THREE.Group;
  /** How much of the sky the city's lights wash out, 0..1. */
  setCity(k: number): void;
  tick(t: number, camera: THREE.Camera): void;
  stars: number;
}

function moonTexture() {
  const [c, g] = canvas(256, 256);
  const r = rng(77);
  const grad = g.createRadialGradient(118, 116, 10, 128, 128, 124);
  grad.addColorStop(0, '#fffbf0');
  grad.addColorStop(0.75, '#efe6d2');
  grad.addColorStop(1, '#cfc4ad');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(128, 128, 124, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.clip();
  // The seas: soft grey blotches, mostly on one side, like the real one.
  for (const [x, y, rad, a] of [
    [92, 86, 34, 0.22],
    [130, 74, 26, 0.2],
    [150, 118, 30, 0.18],
    [104, 132, 22, 0.16],
    [70, 150, 28, 0.12],
    [170, 166, 18, 0.1],
  ]) {
    const s = g.createRadialGradient(x, y, 2, x, y, rad);
    s.addColorStop(0, `rgba(90,96,110,${a})`);
    s.addColorStop(1, 'rgba(90,96,110,0)');
    g.fillStyle = s;
    g.fillRect(0, 0, 256, 256);
  }
  for (let i = 0; i < 40; i++) {
    const x = r() * 256;
    const y = r() * 256;
    const rad = 1 + r() * 5;
    g.strokeStyle = `rgba(120,110,95,${0.08 + r() * 0.12})`;
    g.lineWidth = 1;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
  return texture(c);
}

export function buildSky(quality: Quality): Sky {
  const group = new THREE.Group();
  const city = { value: 0 };

  // The dome: dark at the top, a little lighter and bluer low down, brighter round the moon.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(R, 48, 24),
    new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uMoon;
        uniform float uCity;
        varying vec3 vDir;
        float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
        void main() {
          vec3 d = normalize(vDir);
          float up = clamp(d.y, -0.2, 1.0);
          vec3 zenith = vec3(0.006, 0.009, 0.022);
          vec3 horizon = vec3(0.03, 0.045, 0.085);
          vec3 col = mix(horizon, zenith, pow(clamp(up, 0.0, 1.0), 0.45));
          // The moon's glow, wide and soft, and a tighter halo.
          float m = max(dot(d, uMoon), 0.0);
          col += vec3(0.16, 0.19, 0.26) * pow(m, 18.0) * 0.6 + vec3(0.25, 0.27, 0.3) * pow(m, 400.0) * 0.5;
          // A faint Milky Way: a band across the sky, mottled.
          vec3 axis = normalize(vec3(0.45, 0.35, 0.82));
          float band = exp(-pow(dot(d, axis) / 0.16, 2.0));
          float dust = noise(d.xz * 9.0 + d.y * 4.0) * 0.6 + noise(d.xy * 23.0) * 0.4;
          col += vec3(0.05, 0.055, 0.07) * band * (0.4 + dust) * (1.0 - uCity) * smoothstep(0.0, 0.3, up);
          // The city's sodium glow, low down all round.
          col += vec3(0.32, 0.16, 0.06) * uCity * exp(-max(up, 0.0) * 9.0) * 0.55;
          // Below the horizon (seen only past the edge of things), the haze.
          col = mix(col, horizon * (1.0 + uCity * 2.0), smoothstep(0.02, -0.08, d.y));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      uniforms: { uMoon: { value: MOON_DIR.clone() }, uCity: city },
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  group.add(dome);

  // The stars: a few thousand, more toward the Milky Way, in their own colors, twinkling.
  const count = quality === 'high' ? 3200 : 1800;
  const r = rng(2026);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const axis = new THREE.Vector3(0.45, 0.35, 0.82).normalize();
  const tint = [new THREE.Color('#ffd9b0'), new THREE.Color('#ffffff'), new THREE.Color('#cfdcff'), new THREE.Color('#fff3d6')];
  let n = 0;
  while (n < count) {
    const d = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
    if (d.lengthSq() > 1 || d.lengthSq() < 0.01) continue;
    d.normalize();
    if (d.y < -0.05) continue;
    // Thicker in the band.
    if (r() > 0.35 + 0.65 * Math.exp(-Math.pow(d.dot(axis) / 0.2, 2))) continue;
    d.multiplyScalar(R * 0.96).toArray(pos, n * 3);
    const bright = Math.pow(r(), 6);
    tint[Math.floor(r() * tint.length)].clone().multiplyScalar(0.35 + bright * 1.6).toArray(col, n * 3);
    size[n] = 1.2 + bright * 2.6;
    n++;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const starMat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      uniform float uTime;
      uniform float uCity;
      uniform float uPixel;
      varying vec3 vColor;
      void main() {
        vec3 d = normalize(position);
        // Dimmer and redder low down, through more air; fewer over the city.
        float air = smoothstep(-0.02, 0.25, d.y);
        float tw = 0.75 + 0.25 * sin(uTime * (1.3 + fract(position.x * 0.013) * 3.0) + position.z);
        float keep = 1.0 - uCity * smoothstep(0.0, 0.5, 1.0 - length(aColor) * 0.7);
        vColor = aColor * air * tw * keep;
        gl_PointSize = aSize * uPixel;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.0, r);
        gl_FragColor = vec4(vColor * a * a, 1.0);
      }
    `,
    uniforms: { uTime: { value: 0 }, uCity: city, uPixel: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = -9;
  stars.frustumCulled = false;
  group.add(stars);

  // The moon, big and low, with a soft glow round it.
  const moon = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ map: moonTexture(), color: new THREE.Color(1.15, 1.12, 1.05), depthWrite: false, transparent: true }));
  const moonSize = Math.tan(THREE.MathUtils.degToRad(0.75)) * R * 0.93;
  moon.scale.setScalar(moonSize);
  moon.position.copy(MOON_DIR).multiplyScalar(R * 0.93);
  moon.lookAt(0, 0, 0);
  moon.renderOrder = -8;
  group.add(moon);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow('rgba(190,205,240,1)', 128), color: '#9fb2dc', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
  halo.scale.setScalar(moonSize * 9);
  halo.position.copy(moon.position);
  halo.renderOrder = -7;
  group.add(halo);

  return {
    group,
    stars: count,
    setCity(k) {
      city.value = k;
    },
    tick(t, camera) {
      group.position.copy(camera.position);
      starMat.uniforms.uTime.value = t;
      starMat.uniforms.uPixel.value = Math.min(2, window.devicePixelRatio || 1);
    },
  };
}
