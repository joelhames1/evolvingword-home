// The desk under the window and everything on it.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { canvas, glow, label, rng, texture, wood } from './textures';

export const DESK_Y = 0.76;

const CRT_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
// A tube screen: bulged glass, scanlines, a little color fringing, a rolling band.
const CRT_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uTime;
  uniform float uPower;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv - 0.5;
    vec2 uv = c * (1.0 + dot(c, c) * 0.16) + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.008, 0.009, 0.012, 1.0); return; }
    vec3 col;
    col.r = texture2D(uMap, uv + vec2(0.0016, 0.0)).r;
    col.g = texture2D(uMap, uv).g;
    col.b = texture2D(uMap, uv - vec2(0.0016, 0.0)).b;
    float scan = 0.78 + 0.22 * sin(uv.y * 768.0 * 3.14159);
    float band = 1.0 + 0.06 * smoothstep(0.0, 0.08, fract(uv.y * 0.6 - uTime * 0.12)) * smoothstep(0.16, 0.08, fract(uv.y * 0.6 - uTime * 0.12));
    float flick = 0.975 + 0.025 * sin(uTime * 63.0);
    float vig = smoothstep(0.78, 0.25, length(c * vec2(1.0, 1.1)));
    col = col * scan * band * flick * vig * uPower + vec3(0.015, 0.02, 0.03) * vig * uPower;
    gl_FragColor = vec4(col * 1.7, 1.0);
  }
`;

export interface Desk {
  group: THREE.Group;
  crtScreen: THREE.Mesh;
  crtMaterial: THREE.ShaderMaterial;
  /** The tape deck under the monitor: it plays the music. */
  deck: THREE.Object3D;
  lamp: THREE.Object3D;
  plant: THREE.Object3D;
  setLamp(on: boolean): void;
  lampOn(): boolean;
  /** Where things are, for the camera. */
  spots: { crt: THREE.Vector3 };
  tick(t: number, dt: number): void;
}

function rbox(w: number, h: number, d: number, r: number, mat: THREE.Material) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function std(color: string, roughness = 0.6, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

export function buildDesk(crtTexture: THREE.Texture): Desk {
  const group = new THREE.Group();
  const z = -1.58;
  const top = DESK_Y;

  // The desk itself.
  const woodMat = new THREE.MeshStandardMaterial({ map: wood(7, '#5a3820', '#2c180b'), roughness: 0.48, metalness: 0.02 });
  const deskTop = rbox(3.5, 0.05, 0.78, 0.012, woodMat);
  deskTop.position.set(0, top - 0.025, z);
  group.add(deskTop);
  const legMat = std('#2a1c12', 0.7);
  for (const lx of [-1.68, 1.68]) {
    const leg = rbox(0.06, top - 0.05, 0.7, 0.01, legMat);
    leg.position.set(lx, (top - 0.05) / 2, z);
    group.add(leg);
  }
  const drawers = rbox(0.5, 0.5, 0.66, 0.01, woodMat);
  drawers.position.set(1.3, top - 0.3, z);
  group.add(drawers);
  for (const dy of [-0.13, 0.08]) {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), std('#c9a55a', 0.3, 0.9));
    knob.position.set(1.3, top - 0.3 + dy, z + 0.335);
    group.add(knob);
  }

  // Tape deck with a green VFD clock, and the CRT on top of it.
  const deckX = -0.12;
  const deck = rbox(0.56, 0.1, 0.4, 0.008, std('#17171a', 0.4, 0.3));
  deck.position.set(deckX, top + 0.05, z - 0.02);
  group.add(deck);
  const [vc, vg] = canvas(256, 64);
  const vfdTex = texture(vc);
  const vfd = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.03), new THREE.MeshBasicMaterial({ map: vfdTex, toneMapped: false }));
  vfd.position.set(deckX + 0.16, top + 0.055, z + 0.181);
  group.add(vfd);
  let lastMinute = -1;
  const drawClock = () => {
    const now = new Date();
    const m = now.getHours() * 60 + now.getMinutes();
    if (m === lastMinute) return;
    lastMinute = m;
    vg.fillStyle = '#050806';
    vg.fillRect(0, 0, 256, 64);
    vg.font = '400 52px "VT323"';
    vg.fillStyle = '#6dffc4';
    vg.shadowColor = '#3dffb0';
    vg.shadowBlur = 12;
    vg.textAlign = 'right';
    vg.textBaseline = 'middle';
    vg.fillText(`${String(now.getHours()).padStart(2, '0')} ${String(now.getMinutes()).padStart(2, '0')}`, 240, 34);
    vg.font = '400 22px "VT323"';
    vg.textAlign = 'left';
    vg.fillText('PM', 10, 22);
    vfdTex.needsUpdate = true;
  };
  for (let i = 0; i < 6; i++) {
    const b = rbox(0.035, 0.012, 0.01, 0.003, std('#2c2c30', 0.5));
    b.position.set(deckX - 0.22 + i * 0.045, top + 0.04, z + 0.183);
    group.add(b);
  }

  const crt = new THREE.Group();
  crt.position.set(deckX, top + 0.1, z - 0.02);
  const caseMat = std('#1b1a1c', 0.55, 0.15);
  const body = rbox(0.5, 0.42, 0.46, 0.03, caseMat);
  body.position.y = 0.21;
  crt.add(body);
  const back = rbox(0.34, 0.3, 0.2, 0.05, caseMat);
  back.position.set(0, 0.2, -0.28);
  crt.add(back);
  const bezel = rbox(0.47, 0.37, 0.03, 0.02, std('#262528', 0.45, 0.1));
  bezel.position.set(0, 0.225, 0.225);
  crt.add(bezel);
  const crtMaterial = new THREE.ShaderMaterial({
    vertexShader: CRT_VERT,
    fragmentShader: CRT_FRAG,
    uniforms: { uMap: { value: crtTexture }, uTime: { value: 0 }, uPower: { value: 1 } },
    toneMapped: false,
  });
  const screenGeo = new THREE.PlaneGeometry(0.4, 0.3, 24, 18);
  const sp = screenGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i) / 0.2;
    const y = sp.getY(i) / 0.15;
    sp.setZ(i, 0.018 * (1 - (x * x + y * y) / 2));
  }
  const crtScreen = new THREE.Mesh(screenGeo, crtMaterial);
  crtScreen.position.set(0, 0.23, 0.236);
  crt.add(crtScreen);
  const brand = label([{ text: 'EVOLVING · Tapetron', font: 'italic 400 34px "Space Mono"', color: '#8f8a80', y: 32 }], 512, 64);
  const brandMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.02), new THREE.MeshBasicMaterial({ map: brand, transparent: true }));
  brandMesh.position.set(-0.1, 0.395, 0.241);
  crt.add(brandMesh);
  const power = new THREE.Mesh(new THREE.CircleGeometry(0.006, 12), new THREE.MeshBasicMaterial({ color: '#4dff8a', toneMapped: false }));
  power.position.set(0.19, 0.03, 0.241);
  crt.add(power);
  group.add(crt);
  const crtGlow = new THREE.PointLight('#7fe0c0', 0.55, 1.8, 2);
  crtGlow.position.set(deckX, top + 0.33, z + 0.45);
  group.add(crtGlow);

  // Keyboard.
  const [kc, kg] = canvas(512, 160);
  kg.fillStyle = '#c8c2b4';
  kg.fillRect(0, 0, 512, 160);
  for (let row = 0; row < 5; row++)
    for (let k = 0; k < 15; k++) {
      kg.fillStyle = row === 4 && k > 3 && k < 11 ? '#d8d2c4' : '#e2dccd';
      if (row === 4 && k > 4 && k < 11) continue;
      kg.fillRect(8 + k * 33.5, 8 + row * 30, 30, 26);
      kg.fillStyle = 'rgba(0,0,0,0.12)';
      kg.fillRect(8 + k * 33.5, 30 + row * 30, 30, 4);
    }
  kg.fillStyle = '#e2dccd';
  kg.fillRect(176, 128, 200, 26);
  const keyboard = rbox(0.46, 0.025, 0.15, 0.006, new THREE.MeshStandardMaterial({ color: '#8e897e', roughness: 0.6 }));
  keyboard.position.set(deckX - 0.02, top + 0.013, z + 0.27);
  keyboard.rotation.y = 0.03;
  group.add(keyboard);
  const keys = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.135), new THREE.MeshStandardMaterial({ map: texture(kc), color: '#9a958a', roughness: 0.7 }));
  keys.rotation.x = -Math.PI / 2;
  keys.position.set(0, 0.0131, 0);
  keyboard.add(keys);

  // The lamp: heavy base, two arms, a shade with a warm bulb, and the light it throws.
  const lamp = new THREE.Group();
  lamp.position.set(-1.18, top, z + 0.05);
  const brass = std('#b6824f', 0.35, 0.8);
  const shadeMat = new THREE.MeshStandardMaterial({ color: '#7d2b1f', roughness: 0.45, metalness: 0.3, side: THREE.DoubleSide });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.03, 32), shadeMat);
  base.position.y = 0.015;
  base.castShadow = true;
  lamp.add(base);
  const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.42, 12), brass);
  arm1.position.set(0.04, 0.22, 0);
  arm1.rotation.z = -0.22;
  arm1.castShadow = true;
  lamp.add(arm1);
  const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.34, 12), brass);
  arm2.position.set(0.19, 0.48, 0);
  arm2.rotation.z = -1.15;
  arm2.castShadow = true;
  lamp.add(arm2);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.14, 0.17, 32, 1, true), shadeMat);
  shade.position.set(0.34, 0.52, 0);
  shade.rotation.z = 0.5;
  shade.castShadow = true;
  lamp.add(shade);
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0').multiplyScalar(3), toneMapped: false });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), bulbMat);
  bulb.position.set(0.37, 0.47, 0);
  lamp.add(bulb);
  group.add(lamp);
  const lampLight = new THREE.SpotLight('#ffb36b', 4, 4, 0.95, 0.6, 1.4);
  lampLight.position.set(lamp.position.x + 0.36, top + 0.5, lamp.position.z);
  lampLight.target.position.set(lamp.position.x + 0.7, top, lamp.position.z + 0.15);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(1024, 1024);
  lampLight.shadow.bias = -0.0004;
  lampLight.shadow.normalBias = 0.02;
  group.add(lampLight, lampLight.target);
  const lampFill = new THREE.PointLight('#ff9a50', 1.2, 3, 2);
  lampFill.position.copy(lampLight.position).add(new THREE.Vector3(0, 0.1, 0.1));
  group.add(lampFill);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow('rgba(255,200,140,1)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
  halo.scale.set(0.5, 0.5, 1);
  halo.position.set(lamp.position.x + 0.37, top + 0.47, lamp.position.z);
  group.add(halo);
  let on = true;
  const setLamp = (v: boolean) => {
    on = v;
    lampLight.intensity = v ? 4 : 0;
    lampFill.intensity = v ? 1.2 : 0;
    bulbMat.color.set(v ? new THREE.Color('#ffd9a0').multiplyScalar(3) : new THREE.Color('#3a3026'));
    halo.visible = v;
  };

  // A big leafy plant on the floor in the left corner.
  const plant = new THREE.Group();
  const potProfile = [new THREE.Vector2(0, 0), new THREE.Vector2(0.15, 0), new THREE.Vector2(0.2, 0.36), new THREE.Vector2(0.21, 0.38), new THREE.Vector2(0.19, 0.38), new THREE.Vector2(0, 0.34)];
  const pot = new THREE.Mesh(new THREE.LatheGeometry(potProfile, 40), std('#a24f34', 0.85));
  pot.castShadow = true;
  plant.add(pot);
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.bezierCurveTo(0.09, 0.08, 0.1, 0.26, 0, 0.36);
  leafShape.bezierCurveTo(-0.1, 0.26, -0.09, 0.08, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(leafShape, 10);
  const lp = leafGeo.attributes.position;
  for (let i = 0; i < lp.count; i++) lp.setZ(i, Math.pow(lp.getY(i) / 0.36, 2) * 0.08 + Math.abs(lp.getX(i)) * 0.4);
  leafGeo.computeVertexNormals();
  const leafMat = new THREE.MeshStandardMaterial({ color: '#25502c', roughness: 0.55, side: THREE.DoubleSide });
  const pr = rng(31);
  for (let i = 0; i < 26; i++) {
    const stemH = 0.35 + pr() * 0.75;
    const ang = pr() * Math.PI * 2;
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(Math.cos(ang) * 0.06, stemH, Math.sin(ang) * 0.06);
    leaf.rotation.set(-0.6 - pr() * 0.6, ang, (pr() - 0.5) * 0.4, 'YXZ');
    leaf.scale.setScalar(0.8 + pr() * 0.7);
    leaf.castShadow = true;
    plant.add(leaf);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, stemH, 6), leafMat);
    stem.position.set(Math.cos(ang) * 0.03, stemH / 2, Math.sin(ang) * 0.03);
    stem.rotation.z = (pr() - 0.5) * 0.3;
    plant.add(stem);
  }
  plant.position.set(-2.02, 0, -1.55);
  group.add(plant);

  const spots = { crt: new THREE.Vector3(deckX, top + 0.33, z + 0.22) };

  return {
    group,
    crtScreen,
    crtMaterial,
    deck,
    lamp,
    plant,
    setLamp,
    lampOn: () => on,
    spots,
    tick(t) {
      crtMaterial.uniforms.uTime.value = t;
      drawClock();
    },
  };
}
