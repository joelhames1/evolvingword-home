// A pair of running shoes kicked off by the desk: white uppers, a colored stripe,
// a thick cushioned sole, laces still tied.
import * as THREE from 'three';
import { canvas, texture } from '../textures';

export interface Shoes {
  group: THREE.Group;
  /** Gives them a little hop, as if they'd like to go out. */
  hop(): void;
  tick(t: number, dt: number): void;
}

/** The outline of a shoe seen from below, toe at +x, about 30cm long. */
function outline(left: boolean) {
  const s = new THREE.Shape();
  const k = left ? -1 : 1;
  s.moveTo(-0.15, 0);
  s.bezierCurveTo(-0.15, 0.04 * k, -0.11, 0.045 * k, -0.06, 0.04 * k);
  s.bezierCurveTo(0.0, 0.035 * k, 0.05, 0.05 * k, 0.1, 0.048 * k);
  s.bezierCurveTo(0.15, 0.045 * k, 0.16, 0.0, 0.15, -0.015 * k);
  s.bezierCurveTo(0.14, -0.04 * k, 0.08, -0.042 * k, 0.04, -0.035 * k);
  s.bezierCurveTo(-0.02, -0.03 * k, -0.08, -0.04 * k, -0.12, -0.035 * k);
  s.bezierCurveTo(-0.15, -0.03 * k, -0.155, -0.01 * k, -0.15, 0);
  return s;
}

function upperTexture() {
  const [c, g] = canvas(512, 256);
  g.fillStyle = '#f2f0ea';
  g.fillRect(0, 0, 512, 256);
  // Mesh panel, a suede toe cap and a bold stripe sweeping back.
  for (let x = 0; x < 512; x += 6)
    for (let y = 0; y < 256; y += 6) {
      g.fillStyle = 'rgba(0,0,0,0.04)';
      g.fillRect(x, y, 3, 3);
    }
  g.fillStyle = '#d8d4ca';
  g.fillRect(380, 0, 132, 256);
  g.fillStyle = '#1f4fb4';
  g.beginPath();
  g.moveTo(120, 240);
  g.quadraticCurveTo(250, 120, 420, 90);
  g.lineTo(430, 130);
  g.quadraticCurveTo(270, 160, 170, 250);
  g.closePath();
  g.fill();
  g.fillStyle = '#e04a2f';
  g.fillRect(0, 60, 60, 120);
  return texture(c);
}

function buildShoe(left: boolean) {
  const shoe = new THREE.Group();
  const shape = outline(left);
  const sole = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.028, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 24 }), [
    new THREE.MeshStandardMaterial({ color: '#f4f1e8', roughness: 0.7 }),
    new THREE.MeshStandardMaterial({ color: '#2a2f45', roughness: 0.85 }),
  ]);
  sole.rotation.x = -Math.PI / 2;
  sole.castShadow = true;
  sole.receiveShadow = true;
  shoe.add(sole);
  // The upper: a stretched half-ellipsoid, higher at the heel.
  const g = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Heel higher than toe; a slight taper at the toe.
    const heel = THREE.MathUtils.smoothstep(-x, -0.2, 1);
    pos.setXYZ(i, x * 0.148, y * (0.05 + heel * 0.045), z * (0.043 - Math.max(0, x) * 0.008));
  }
  g.computeVertexNormals();
  const upper = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: upperTexture(), roughness: 0.75 }));
  upper.position.y = 0.03;
  upper.castShadow = true;
  shoe.add(upper);
  // The opening at the ankle, and laces across the top.
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 8, 20), new THREE.MeshStandardMaterial({ color: '#2a2f45', roughness: 0.8 }));
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(1.4, 1, 1);
  collar.position.set(-0.07, 0.085, 0);
  shoe.add(collar);
  const laceMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
  for (let i = 0; i < 5; i++) {
    const lace = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.004, 0.04), laceMat);
    lace.position.set(-0.02 + i * 0.022, 0.078 - i * 0.006, 0);
    lace.rotation.z = -0.25;
    shoe.add(lace);
  }
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.0025, 6, 12), laceMat);
  bow.position.set(-0.035, 0.084, 0.006);
  bow.rotation.set(0.3, 0.6, 0);
  shoe.add(bow);
  return shoe;
}

export function buildShoes(): Shoes {
  const group = new THREE.Group();
  const leftShoe = buildShoe(true);
  const rightShoe = buildShoe(false);
  leftShoe.position.set(0, 0, -0.07);
  leftShoe.rotation.y = 0.18;
  rightShoe.position.set(0.04, 0, 0.07);
  rightShoe.rotation.y = -0.12;
  group.add(leftShoe, rightShoe);
  // A generous invisible hit area round the pair, so the gap between them counts too.
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.32), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(0.02, 0.07, 0);
  group.add(hit);
  let hopAt = -10;
  let now = 0;
  return {
    group,
    hop() {
      hopAt = now;
    },
    tick(t) {
      now = t;
      const k = t - hopAt;
      const h = k >= 0 && k < 0.9 ? Math.abs(Math.sin(k * Math.PI * 2.2)) * 0.04 * (1 - k / 0.9) : 0;
      leftShoe.position.y = h;
      rightShoe.position.y = k > 0.12 ? (k - 0.12 < 0.9 ? Math.abs(Math.sin((k - 0.12) * Math.PI * 2.2)) * 0.04 * (1 - (k - 0.12) / 0.9) : 0) : 0;
    },
  };
}
