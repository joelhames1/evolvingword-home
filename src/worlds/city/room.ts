// The Night Studio: a small room five floors up, one big window onto the city,
// the outside wall of the building with a neon sign over our window, and rain
// running down the glass.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { ROOM } from '../../layout';
import { boards, canvas, label, plaster, rng, texture } from '../../textures';

/** The window opening in the back wall. */
export const WINDOW = { x0: -1.9, x1: 1.9, y0: 0.95, y1: 2.45 };
/** Street level, far below. */
export const STREET_Y = -15;

export interface Room {
  group: THREE.Group;
  /** The neon signs outside, for flicker. */
  neon: THREE.Mesh[];
  neonLight: THREE.PointLight;
  glass: THREE.ShaderMaterial;
  /** City light through the wet window, projecting the rain into the room. */
  rainLight: THREE.SpotLight;
  /** Redraws the rain the window light projects; call before each frame. */
  renderRain(renderer: THREE.WebGLRenderer): void;
  tick(t: number): void;
}

const GLASS_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// Drops that sit, slide and leave trails. The same field draws the glass (dark
// beads with a bright point where each one focuses the city) and, in projector
// mode, the light the window throws into the room: rain shadows on the desk.
const GLASS_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec2 uAspect;
  uniform float uMode;
  varying vec2 vUv;
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  // x: drop body, y: highlight, z: trail
  vec3 layer(vec2 uv, float t, float scale, float speed) {
    uv *= scale;
    vec2 id = floor(uv);
    vec2 f = fract(uv) - 0.5;
    float n = hash(id);
    float x = (n - 0.5) * 0.7;
    float fall = fract(n * 13.7 + t * (0.05 + n * 0.1) * speed);
    // Drops hang, then let go.
    float slide = smoothstep(0.25, 1.0, fall);
    float y = 0.42 - slide * 0.84 + sin(fall * 20.0 + n * 6.0) * 0.015;
    vec2 p = vec2(x + sin(slide * 9.0 + n * 3.0) * 0.035, y);
    float r = 0.06 + n * 0.03;
    vec2 q = (f - p) * vec2(1.0, 1.25);
    float body = smoothstep(r, r * 0.55, length(q));
    float hl = smoothstep(r * 0.45, 0.0, length(q - vec2(-r * 0.15, -r * 0.4)));
    float trail = smoothstep(0.02, 0.0, abs(f.x - p.x)) * smoothstep(p.y + 0.5, p.y, f.y) * step(p.y, f.y) * slide;
    vec2 sp = vec2(hash(id + 3.1) - 0.5, hash(id + 7.7) - 0.5) * 0.8;
    float sr = 0.025 + hash(id + 5.5) * 0.03;
    float still = smoothstep(sr, sr * 0.4, length(f - sp)) * step(0.45, hash(id + 1.3));
    float shl = smoothstep(sr * 0.5, 0.0, length(f - sp + vec2(0.0, sr * 0.35))) * step(0.45, hash(id + 1.3));
    return vec3(body + still, hl + shl, trail);
  }
  void main() {
    vec2 uv = vUv * uAspect;
    vec3 a = layer(uv, uTime, 6.0, 1.0) + layer(uv + 3.7, uTime, 11.0, 1.3) * 0.8 + layer(uv + 9.1, uTime, 21.0, 1.8) * 0.6;
    float body = clamp(a.x, 0.0, 1.0);
    float hl = clamp(a.y, 0.0, 1.0);
    float trail = clamp(a.z, 0.0, 1.0);
    if (uMode > 0.5) {
      // Light through wet glass: dark rims, bright focused centers, wavering
      // streaks. Drawn bigger than on the glass, since the light magnifies them.
      vec2 big = vUv * uAspect;
      vec3 b = layer(big, uTime, 5.0, 1.0) + layer(big + 3.7, uTime, 9.0, 1.3) * 0.9 + layer(big + 9.1, uTime, 15.0, 1.6) * 0.7;
      float bb = clamp(b.x, 0.0, 1.0);
      float bh = clamp(b.y, 0.0, 1.0);
      float bt = clamp(b.z, 0.0, 1.0);
      float v = 1.0 - bb * (1.0 - bh) * 0.9 + bh * 1.8 - bt * 0.6;
      v *= 0.93 + 0.07 * sin(vUv.y * 34.0 + uTime * 1.7 + sin(vUv.x * 11.0 + uTime * 0.6) * 2.0);
      gl_FragColor = vec4(vec3(clamp(v, 0.0, 3.0)), 1.0);
      return;
    }
    vec3 tint = mix(vec3(0.35, 0.6, 1.0), vec3(1.0, 0.35, 0.72), smoothstep(0.15, 0.95, vUv.x));
    // Condensation creeping up from the sill.
    float mist = smoothstep(0.32, 0.0, vUv.y) * (0.65 + 0.35 * hash(floor(uv * 60.0)));
    vec3 col = vec3(0.004, 0.005, 0.01) * body + tint * hl * 2.2 + tint * 0.4 * trail + vec3(0.32, 0.3, 0.4) * mist * 0.35;
    float alpha = 0.025 + body * 0.42 + hl * 0.55 + trail * 0.14 + mist * 0.22;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.9));
  }
`;

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, cast = false) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

/** A neon tube spelling a word, as glowing text on a dark backing. */
function neonSign(text: string, color: string, width: number) {
  const [c, g] = canvas(1024, 256);
  (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '6px';
  let size = 150;
  g.font = `700 ${size}px "Archivo Black", sans-serif`;
  const room = 1024 - 90;
  const wide = g.measureText(text).width;
  if (wide > room) size = Math.floor((size * room) / wide);
  g.font = `700 ${size}px "Archivo Black", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 30;
  g.strokeStyle = color;
  g.lineWidth = 7;
  g.strokeText(text, 512, 132);
  g.shadowBlur = 8;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2.5;
  g.strokeText(text, 512, 132);
  const t = texture(c);
  const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, color: new THREE.Color(color).multiplyScalar(2.2), depthWrite: false, toneMapped: false });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), mat);
}

/** A vertical blade sign: letters stacked in a tube, framed in a second color. */
function bladeSign(text: string, color: string, frame: string) {
  const [c, g] = canvas(256, 1024);
  g.fillStyle = '#0a0a10';
  g.fillRect(0, 0, 256, 1024);
  g.shadowBlur = 18;
  g.shadowColor = frame;
  g.strokeStyle = frame;
  g.lineWidth = 6;
  g.strokeRect(18, 18, 220, 988);
  g.font = '700 150px "Archivo Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const step = 940 / text.length;
  [...text].forEach((ch, i) => {
    const y = 50 + step * (i + 0.5);
    g.shadowColor = color;
    g.shadowBlur = 26;
    g.strokeStyle = color;
    g.lineWidth = 6;
    g.strokeText(ch, 128, y);
    g.shadowBlur = 6;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2;
    g.strokeText(ch, 128, y);
  });
  return texture(c);
}

/** Lit windows across our building's face: blinds, TV light, curtains, plants. */
function windowTextures() {
  const r = rng(77);
  const make = (draw: (g: CanvasRenderingContext2D) => void) => {
    const [c, g] = canvas(160, 130);
    draw(g);
    // A sliver of reflection across the glass, and the frame.
    const ref = g.createLinearGradient(0, 0, 160, 130);
    ref.addColorStop(0.35, 'rgba(255,255,255,0)');
    ref.addColorStop(0.42, 'rgba(255,255,255,0.07)');
    ref.addColorStop(0.5, 'rgba(255,255,255,0)');
    g.fillStyle = ref;
    g.fillRect(0, 0, 160, 130);
    g.strokeStyle = '#0b0a0d';
    g.lineWidth = 10;
    g.strokeRect(0, 0, 160, 130);
    g.fillStyle = '#0b0a0d';
    g.fillRect(78, 0, 4, 130);
    return texture(c);
  };
  const room = (g: CanvasRenderingContext2D, a: string, b: string) => {
    const grad = g.createRadialGradient(60 + r() * 40, 50, 5, 80, 65, 110);
    grad.addColorStop(0, a);
    grad.addColorStop(1, b);
    g.fillStyle = grad;
    g.fillRect(0, 0, 160, 130);
  };
  const blinds = (g: CanvasRenderingContext2D, raised: number) => {
    for (let y = 0; y < 130 * (1 - raised); y += 6) {
      g.fillStyle = 'rgba(10,6,4,0.55)';
      g.fillRect(0, y, 160, 2.4);
      g.fillStyle = 'rgba(255,240,220,0.08)';
      g.fillRect(0, y + 2.4, 160, 1);
    }
    g.fillStyle = 'rgba(10,6,4,0.7)';
    g.fillRect(0, 130 * (1 - raised) - 4, 160, 4);
  };
  return {
    warmBlinds: make((g) => {
      room(g, '#ffc27a', '#a8501c');
      blinds(g, 0.25);
    }),
    coolBlinds: make((g) => {
      room(g, '#9fc0ff', '#2a3f8a');
      blinds(g, 0.45);
    }),
    pinkBlinds: make((g) => {
      room(g, '#ff7ac4', '#6a1450');
      blinds(g, 0.1);
    }),
    tv: make((g) => {
      g.fillStyle = '#070a18';
      g.fillRect(0, 0, 160, 130);
      const glowG = g.createRadialGradient(40, 110, 4, 40, 110, 120);
      glowG.addColorStop(0, '#9ab8ff');
      glowG.addColorStop(1, 'rgba(40,60,140,0)');
      g.fillStyle = glowG;
      g.fillRect(0, 0, 160, 130);
      // Someone on a sofa, watching.
      g.fillStyle = '#05060c';
      g.beginPath();
      g.ellipse(112, 74, 11, 13, 0, 0, Math.PI * 2);
      g.fill();
      g.fillRect(84, 86, 66, 44);
    }),
    curtain: make((g) => {
      room(g, '#c46a3c', '#40160c');
      for (let x = 0; x < 160; x += 9) {
        g.fillStyle = `rgba(0,0,0,${0.18 + r() * 0.2})`;
        g.fillRect(x, 0, 4 + r() * 3, 130);
      }
    }),
    plant: make((g) => {
      room(g, '#ffd59a', '#8a4a1a');
      g.fillStyle = '#100906';
      g.fillRect(28, 100, 34, 30);
      for (let i = 0; i < 9; i++) {
        g.save();
        g.translate(45, 100);
        g.rotate(-1.2 + i * 0.3);
        g.beginPath();
        g.ellipse(0, -26, 7, 26, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }),
    dark: make((g) => {
      g.fillStyle = '#0c0c12';
      g.fillRect(0, 0, 160, 130);
    }),
  };
}

export function buildRoom(): Room {
  RectAreaLightUniformsLib.init();
  const group = new THREE.Group();
  const { x0, x1, z0, z1, h } = ROOM;
  const W = WINDOW;

  const wallMat = new THREE.MeshStandardMaterial({ map: plaster(3, '#6f6255'), roughness: 0.92 });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#2b211a', roughness: 0.6 });
  const floorMat = new THREE.MeshStandardMaterial({ map: boards(5), roughness: 0.55, metalness: 0.05 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, (z0 + z1) / 2);
  floor.receiveShadow = true;
  group.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 1 }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, h, (z0 + z1) / 2);
  group.add(ceiling);

  // Back wall in four pieces around the window, then the side and front walls.
  const t = 0.24;
  const zb = z0 - t / 2;
  group.add(box(x1 - x0, W.y0, t, wallMat, 0, W.y0 / 2, zb));
  group.add(box(x1 - x0, h - W.y1, t, wallMat, 0, (h + W.y1) / 2, zb));
  group.add(box(W.x0 - x0, W.y1 - W.y0, t, wallMat, (x0 + W.x0) / 2, (W.y0 + W.y1) / 2, zb));
  group.add(box(x1 - W.x1, W.y1 - W.y0, t, wallMat, (x1 + W.x1) / 2, (W.y0 + W.y1) / 2, zb));
  group.add(box(t, h, z1 - z0, wallMat, x0 - t / 2, h / 2, (z0 + z1) / 2));
  group.add(box(t, h, z1 - z0, wallMat, x1 + t / 2, h / 2, (z0 + z1) / 2));
  group.add(box(x1 - x0 + 2 * t, h, t, wallMat, 0, h / 2, z1 + t / 2));
  // Skirting.
  for (const [w, x, z, ry] of [
    [x1 - x0, 0, z0 + 0.01, 0],
    [z1 - z0, x0 + 0.01, (z0 + z1) / 2, Math.PI / 2],
    [z1 - z0, x1 - 0.01, (z0 + z1) / 2, Math.PI / 2],
  ] as const) {
    const s = box(w, 0.1, 0.02, trimMat, x, 0.05, z);
    s.rotation.y = ry;
    group.add(s);
  }

  // The window: a frame of mullions, a sill, and rainy glass.
  const frameMat = new THREE.MeshStandardMaterial({ color: '#7a5a3c', roughness: 0.5, metalness: 0.1 });
  const fw = 0.06;
  const cx = (W.x0 + W.x1) / 2;
  const cy = (W.y0 + W.y1) / 2;
  const ww = W.x1 - W.x0;
  const wh = W.y1 - W.y0;
  group.add(box(ww + fw, fw, 0.08, frameMat, cx, W.y0, z0 - 0.06, true));
  group.add(box(ww + fw, fw, 0.08, frameMat, cx, W.y1, z0 - 0.06, true));
  group.add(box(ww + fw, fw * 0.8, 0.08, frameMat, cx, W.y0 + wh * 0.68, z0 - 0.06, true));
  for (const fx of [W.x0, cx, W.x1]) group.add(box(fw, wh, 0.08, frameMat, fx, cy, z0 - 0.06, true));
  group.add(box(ww + 0.3, 0.04, 0.3, trimMat, cx, W.y0 - 0.02, z0 + 0.08, true));
  const glass = new THREE.ShaderMaterial({
    vertexShader: GLASS_VERT,
    fragmentShader: GLASS_FRAG,
    uniforms: { uTime: { value: 0 }, uAspect: { value: new THREE.Vector2(ww / wh, 1) }, uMode: { value: 0 } },
    transparent: true,
    depthWrite: false,
  });
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), glass);
  pane.position.set(cx, cy, z0 - 0.1);
  group.add(pane);

  // A radiator under the window, a curtain bunched to the left.
  const radMat = new THREE.MeshStandardMaterial({ color: '#3d3a35', roughness: 0.5, metalness: 0.3 });
  for (let i = 0; i < 16; i++) group.add(box(0.05, 0.55, 0.1, radMat, -0.9 + i * 0.12, 0.42, z0 + 0.12, true));
  group.add(box(1.95, 0.04, 0.06, radMat, 0, 0.16, z0 + 0.12));
  const curtainGeo = new THREE.PlaneGeometry(0.75, 2.5, 48, 1);
  const pos = curtainGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 26) * 0.045 + Math.sin(pos.getX(i) * 9) * 0.02);
  curtainGeo.computeVertexNormals();
  const curtain = new THREE.Mesh(curtainGeo, new THREE.MeshStandardMaterial({ color: '#4a2f2a', roughness: 0.95, side: THREE.DoubleSide }));
  curtain.position.set(W.x0 + 0.05, 1.45, z0 + 0.18);
  curtain.castShadow = true;
  group.add(curtain);
  group.add(box(ww + 0.9, 0.03, 0.03, frameMat, cx, 2.72, z0 + 0.2));

  // A gig poster on the front wall, beside the bookshelf.
  const poster = label(
    [
      { text: 'PRINT', font: '700 210px "Archivo Black"', color: '#ff4fa3', y: 240, align: 'center' },
      { text: 'NIGHT', font: '700 210px "Archivo Black"', color: '#ffd166', y: 440, align: 'center' },
      { text: 'EVOLVING WORD · LIVE INK', font: '400 46px "Space Mono"', color: '#e8e2ff', y: 640, align: 'center', spacing: 4 },
      { text: 'DOORS 23:00 · ALL AGES', font: '400 40px "Space Mono"', color: '#9fa8ff', y: 720, align: 'center', spacing: 4 },
    ],
    768,
    1024,
    '#1d1f7a',
  );
  const posterMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), new THREE.MeshStandardMaterial({ map: poster, roughness: 0.8 }));
  posterMesh.position.set(1.75, 1.7, z1 - 0.01);
  posterMesh.rotation.y = Math.PI;
  posterMesh.rotation.z = 0.03;
  group.add(posterMesh);

  // Outside: the face of our building. Wet concrete panels, streaked by years of
  // rain, glowing faintly with the street's light from below.
  const facadeShape = new THREE.Shape();
  facadeShape.moveTo(-14, STREET_Y);
  facadeShape.lineTo(14, STREET_Y);
  facadeShape.lineTo(14, 14);
  facadeShape.lineTo(-14, 14);
  const hole = new THREE.Path();
  hole.moveTo(W.x0, W.y0);
  hole.lineTo(W.x0, W.y1);
  hole.lineTo(W.x1, W.y1);
  hole.lineTo(W.x1, W.y0);
  facadeShape.holes.push(hole);
  const [fc, fg] = canvas(1024, 1024);
  const fr = rng(11);
  fg.fillStyle = '#4a4548';
  fg.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 14000; i++) {
    fg.fillStyle = `rgba(${fr() < 0.5 ? '255,255,255' : '0,0,0'},${fr() * 0.06})`;
    fg.fillRect(fr() * 1024, fr() * 1024, 2 + fr() * 4, 2 + fr() * 4);
  }
  // Rain streaks down from every ledge.
  for (let i = 0; i < 260; i++) {
    const x = fr() * 1024;
    const y = Math.floor(fr() * 8) * 128 + 4;
    const len = 30 + fr() * 140;
    const grad = fg.createLinearGradient(0, y, 0, y + len);
    grad.addColorStop(0, `rgba(10,8,10,${0.25 + fr() * 0.3})`);
    grad.addColorStop(1, 'rgba(10,8,10,0)');
    fg.fillStyle = grad;
    fg.fillRect(x, y, 2 + fr() * 7, len);
  }
  // Panel seams: one panel per floor.
  for (let y = 0; y < 1024; y += 128) {
    fg.fillStyle = 'rgba(0,0,0,0.55)';
    fg.fillRect(0, y, 1024, 3);
    fg.fillStyle = 'rgba(255,255,255,0.05)';
    fg.fillRect(0, y + 3, 1024, 1);
  }
  for (let x = 0; x < 1024; x += 256) {
    fg.fillStyle = 'rgba(0,0,0,0.4)';
    fg.fillRect(x, 0, 3, 1024);
  }
  const facadeTex = texture(fc, { repeat: [1 / 8, 1 / 8] });
  // The street's glow, strongest low down, baked in as emission.
  const [gc, gg] = canvas(4, 256);
  const glowGrad = gg.createLinearGradient(0, 0, 0, 256);
  glowGrad.addColorStop(0, '#05040a');
  glowGrad.addColorStop(0.55, '#1a1030');
  glowGrad.addColorStop(1, '#5a2050');
  gg.fillStyle = glowGrad;
  gg.fillRect(0, 0, 4, 256);
  const glowTex = texture(gc);
  // Seen from the street, so both sides render (three.js flips the normal for the outside face).
  const facadeMat = new THREE.MeshStandardMaterial({
    map: facadeTex,
    roughness: 0.42,
    metalness: 0.1,
    side: THREE.DoubleSide,
    emissive: '#ffffff',
    emissiveIntensity: 0.55,
  });
  const facadeGeo = new THREE.ShapeGeometry(facadeShape);
  // ShapeGeometry's UVs are in meters: fine for the repeating panels, but the glow
  // wants 0..1 top to bottom, so it gets a second UV set.
  const fpos = facadeGeo.attributes.position;
  const uv2 = new Float32Array(fpos.count * 2);
  for (let i = 0; i < fpos.count; i++) {
    uv2[i * 2] = 0.5;
    uv2[i * 2 + 1] = (fpos.getY(i) - STREET_Y) / (14 - STREET_Y);
  }
  facadeGeo.setAttribute('uv1', new THREE.BufferAttribute(uv2, 2));
  glowTex.channel = 1;
  facadeMat.emissiveMap = glowTex;
  const facade = new THREE.Mesh(facadeGeo, facadeMat);
  facade.position.z = z0 - t - 0.001;
  facade.castShadow = true;
  group.add(facade);

  // Neighbors' windows, each with a sill; some with an air conditioner hanging off it.
  const tex = windowTextures();
  const kinds = [tex.warmBlinds, tex.warmBlinds, tex.coolBlinds, tex.pinkBlinds, tex.curtain, tex.plant, tex.tv, tex.dark, tex.dark, tex.dark];
  const winMats = new Map<THREE.Texture, THREE.MeshBasicMaterial>();
  const tvMats: THREE.MeshBasicMaterial[] = [];
  const winGeo = new THREE.PlaneGeometry(1.6, 1.3);
  const zf = z0 - t;
  const parts: { kind: 'sill' | 'ac' | 'iron'; m: THREE.Matrix4 }[] = [];
  const put = (kind: 'sill' | 'ac' | 'iron', w: number, h: number, d: number, x: number, y: number, z: number, rz = 0) =>
    parts.push({
      kind,
      m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rz)), new THREE.Vector3(w, h, d)),
    });
  const wr = rng(21);
  for (let fy = -13; fy < 13; fy += 3.2) {
    for (let fx = -12; fx <= 12; fx += 4) {
      if (Math.abs(fx) < 3 && Math.abs(fy - 1.6) < 2) continue; // ours
      const kind = kinds[Math.floor(wr() * kinds.length)];
      let mat = winMats.get(kind);
      if (!mat || kind === tex.tv) {
        mat = new THREE.MeshBasicMaterial({ map: kind, color: kind === tex.dark ? '#ffffff' : '#d8d0c8' });
        if (kind === tex.tv) tvMats.push(mat);
        winMats.set(kind, mat);
      }
      const x = fx + (wr() - 0.5) * 0.2;
      const y = fy + 1.0;
      const m = new THREE.Mesh(winGeo, mat);
      m.position.set(x, y, zf - 0.02);
      m.rotation.y = Math.PI;
      group.add(m);
      put('sill', 1.8, 0.08, 0.2, x, y - 0.7, zf - 0.1);
      put('sill', 1.75, 0.06, 0.08, x, y + 0.69, zf - 0.04);
      if (wr() < 0.22 && fx !== -8) put('ac', 0.72, 0.44, 0.5, x + (wr() - 0.5) * 0.6, y - 0.46, zf - 0.32);
    }
  }

  // A fire escape zigzagging up the left of the building.
  const fx0 = -9.9;
  const fx1 = -6.1;
  const depth = 1.05;
  const zo = zf - depth;
  const floors: number[] = [];
  for (let fy = -13 + 3.2 * 1; fy < 13; fy += 3.2) floors.push(fy + 1.0 - 0.74);
  floors.forEach((py, i) => {
    put('iron', fx1 - fx0, 0.04, depth, (fx0 + fx1) / 2, py, zf - depth / 2);
    // Railing along the front and the ends.
    put('iron', fx1 - fx0, 0.035, 0.035, (fx0 + fx1) / 2, py + 0.95, zo);
    put('iron', fx1 - fx0, 0.025, 0.025, (fx0 + fx1) / 2, py + 0.48, zo);
    for (const ex of [fx0, fx1]) put('iron', 0.035, 0.035, depth, ex, py + 0.95, zf - depth / 2);
    for (let x = fx0; x <= fx1 + 0.01; x += 0.32) put('iron', 0.018, 0.95, 0.018, x, py + 0.475, zo);
    for (const ex of [fx0, fx1]) for (let z = 0.3; z < depth; z += 0.35) put('iron', 0.018, 0.95, 0.018, ex, py + 0.475, zf - z);
    // Stairs up to the next landing, alternating direction.
    const next = floors[i + 1];
    if (next === undefined) return;
    const a = i % 2 ? fx0 + 0.5 : fx1 - 0.5;
    const b = i % 2 ? fx1 - 0.5 : fx0 + 0.5;
    const run = b - a;
    const rise = next - py;
    const len = Math.hypot(run, rise);
    const ang = Math.atan2(rise, run);
    for (const sz of [zf - 0.42, zf - 0.98]) put('iron', len, 0.1, 0.03, (a + b) / 2, (py + next) / 2, sz, ang);
    for (let k = 1; k < 13; k++) put('iron', 0.24, 0.025, 0.56, a + (run * k) / 13, py + (rise * k) / 13, zf - 0.7);
  });
  const ironMat = new THREE.MeshStandardMaterial({ color: '#16171b', roughness: 0.35, metalness: 0.75 });
  const sillMat = new THREE.MeshStandardMaterial({ color: '#5b5553', roughness: 0.5, emissive: '#1a1020', emissiveIntensity: 0.6 });
  const [ac, acg] = canvas(128, 96);
  acg.fillStyle = '#8c8a86';
  acg.fillRect(0, 0, 128, 96);
  for (let y = 10; y < 90; y += 6) {
    acg.fillStyle = '#3a3836';
    acg.fillRect(8, y, 112, 3);
  }
  acg.fillStyle = 'rgba(60,40,20,0.35)';
  acg.fillRect(0, 70, 128, 26);
  const acMat = new THREE.MeshStandardMaterial({ map: texture(ac), roughness: 0.55, metalness: 0.4 });
  const unit = new THREE.BoxGeometry(1, 1, 1);
  for (const [kind, mat] of [
    ['sill', sillMat],
    ['ac', acMat],
    ['iron', ironMat],
  ] as const) {
    const list = parts.filter((p) => p.kind === kind);
    const inst = new THREE.InstancedMesh(unit, mat, list.length);
    list.forEach((p, i) => inst.setMatrixAt(i, p.m));
    inst.castShadow = kind === 'iron';
    group.add(inst);
  }

  // Our sign: neon over the window, facing the street.
  const neon: THREE.Mesh[] = [];
  const sign = neonSign('EVOLVING WORD', '#ff3fa4', 5.2);
  sign.position.set(0, W.y1 + 1.05, zf - 0.25);
  sign.rotation.y = Math.PI;
  group.add(sign);
  neon.push(sign);
  const backing = box(5.4, 1.45, 0.12, new THREE.MeshStandardMaterial({ color: '#0c0b10', roughness: 0.6, metalness: 0.5 }), 0, W.y1 + 1.05, zf - 0.15);
  group.add(backing);
  // It lights the wall around it and the outside of our window frame, and stops
  // short of the room (a point light without shadows would shine through the wall).
  const neonLight = new THREE.PointLight('#ff3fa4', 7, 3.4, 1.3);
  neonLight.position.set(0, W.y1 + 0.95, zf - 0.6);
  group.add(neonLight);

  // A blade sign down the corner: STUDIO, in cyan, sticking out over the street.
  const bladeTex = bladeSign('STUDIO', '#3ff0ff', '#ff3fa4');
  const bladeMat = new THREE.MeshBasicMaterial({ map: bladeTex, color: new THREE.Color(1.6, 1.6, 1.6), toneMapped: false });
  const bladeGroup = new THREE.Group();
  bladeGroup.position.set(4.3, -1.6, zf - 0.75);
  const bladeBox = box(0.16, 4.6, 1.15, new THREE.MeshStandardMaterial({ color: '#0b0b10', metalness: 0.6, roughness: 0.4 }), 0, 0, 0);
  bladeGroup.add(bladeBox);
  for (const side of [1, -1]) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 4.4), bladeMat);
    face.position.x = side * 0.085;
    face.rotation.y = (side * Math.PI) / 2;
    bladeGroup.add(face);
    neon.push(face);
  }
  for (const y of [1.6, -1.6]) bladeGroup.add(box(0.05, 0.05, 0.75, ironMat, 0, y, 0.5));
  group.add(bladeGroup);
  const bladeLight = new THREE.PointLight('#3ff0ff', 5, 4.2, 1.4);
  bladeLight.position.set(4.3, -1.6, zf - 1.3);
  group.add(bladeLight);

  // The city's light coming in through the wet window, throwing the frame and the
  // running rain across the desk and walls: a spotlight with the rain as its slide.
  const rainTarget = new THREE.WebGLRenderTarget(512, 512, { depthBuffer: false, type: THREE.HalfFloatType });
  const rainMat = glass.clone();
  rainMat.uniforms = { uTime: glass.uniforms.uTime, uAspect: glass.uniforms.uAspect, uMode: { value: 1 } };
  rainMat.transparent = false;
  const rainScene = new THREE.Scene();
  rainScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), rainMat));
  const rainCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  rainCam.position.z = 0.5;
  // Set high, so the window's shape lands across the desk.
  const rainLight = new THREE.SpotLight('#7f9cff', 60, 22, 0.3, 0.3, 1.25);
  rainLight.position.set(-1.2, 9, -7.5);
  rainLight.target.position.set(0.4, 0.76, -1.2);
  rainLight.map = rainTarget.texture;
  rainLight.castShadow = true;
  rainLight.shadow.mapSize.set(1024, 1024);
  rainLight.shadow.bias = -0.0005;
  rainLight.shadow.normalBias = 0.03;
  rainLight.shadow.camera.near = 4;
  rainLight.shadow.camera.far = 20;
  group.add(rainLight, rainLight.target);

  // A soft cool fill from the whole window, and just enough in the corners.
  const windowLight = new THREE.RectAreaLight('#5f6fd0', 0.35, ww, wh);
  windowLight.position.set(cx, cy, z0 - 0.15);
  windowLight.lookAt(cx, cy, 1);
  group.add(windowLight);
  group.add(new THREE.HemisphereLight('#24305c', '#120a08', 0.08));

  // Two bare bulbs so the walls read at night: a cage lamp over the medals and
  // diplomas, and a pendant on a cord by the bookshelf.
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.7, 0.95) });
  const cageMat = new THREE.MeshStandardMaterial({ color: '#1a1a1e', metalness: 0.7, roughness: 0.4, wireframe: true });
  const cordMat = new THREE.MeshStandardMaterial({ color: '#111114', roughness: 0.8 });
  for (const [bx, by, bz, pendant] of [
    [x1 - 0.2, 2.32, 0.3, false],
    [0.4, 2.2, 1.95, true],
  ] as const) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 12), bulbMat);
    bulb.position.set(bx, by, bz);
    group.add(bulb);
    const cage = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), cageMat);
    cage.position.copy(bulb.position);
    group.add(cage);
    if (pendant) group.add(box(0.006, h - by, 0.006, cordMat, bx, (h + by) / 2, bz));
    else group.add(box(0.2, 0.014, 0.014, cordMat, bx + 0.1, by, bz));
    const bare = new THREE.PointLight('#ffb070', 1.5, 3.2, 1.5);
    bare.position.set(bx, by - 0.06, bz);
    group.add(bare);
  }

  let lastRain = -1;
  return {
    group,
    neon,
    neonLight,
    glass,
    rainLight,
    renderRain(renderer) {
      // 30 times a second is plenty for water.
      const now = glass.uniforms.uTime.value as number;
      if (now - lastRain < 1 / 30) return;
      lastRain = now;
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rainTarget);
      renderer.render(rainScene, rainCam);
      renderer.setRenderTarget(prev);
    },
    tick(time) {
      glass.uniforms.uTime.value = time;
      // Old neon: a steady hum with the odd stutter.
      const stutter = Math.sin(time * 37.0) > 0.985 || (time % 9 > 8.85 && Math.sin(time * 90) > 0) ? 0.25 : 1;
      const level = (0.92 + Math.sin(time * 120) * 0.04) * stutter;
      (sign.material as THREE.MeshBasicMaterial).opacity = level;
      neonLight.intensity = 7 * level;
      // The blade sign buzzes on its own schedule.
      const blade = Math.sin(time * 23.0 + 1.0) > 0.992 ? 0.3 : 1;
      bladeMat.color.setScalar(1.6 * blade);
      bladeLight.intensity = 5 * blade;
      // Television light, never quite steady.
      tvMats.forEach((m, i) => {
        const k = 0.55 + 0.25 * Math.sin(time * 3.1 + i * 2.0) + 0.2 * Math.sin(time * 11.7 + i) * Math.sin(time * 0.9);
        m.color.setRGB(0.75 * k + 0.1, 0.8 * k + 0.1, k + 0.15);
      });
    },
  };
}
