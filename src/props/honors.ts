// The right-hand wall: framed diplomas, and race medals hanging on their
// ribbons from a pegged board, shortest race to longest.
import * as THREE from 'three';
import { DIPLOMAS, MEDALS } from '../content';
import { canvas, texture } from '../textures';

export interface Honors {
  group: THREE.Group;
  diplomas: THREE.Object3D[];
  medals: THREE.Object3D[];
  /** Sets a medal swinging. */
  swing(i: number): void;
  tick(t: number, dt: number): void;
}

const METALS = {
  gold: ['#f6dc8a', '#b98a2e', '#6e4c12'],
  silver: ['#f2f4f7', '#a9adb5', '#5a5e66'],
  bronze: ['#f0b98a', '#a8642e', '#5a2e10'],
};

function diplomaTexture(d: (typeof DIPLOMAS)[number]) {
  const [c, g] = canvas(1400, 1050);
  g.fillStyle = '#f5edd8';
  g.fillRect(0, 0, 1400, 1050);
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `rgba(140,110,60,${Math.random() * 0.04})`;
    g.fillRect(Math.random() * 1400, Math.random() * 1050, 3, 3);
  }
  // A fine engraved border.
  g.strokeStyle = '#7a5a2a';
  g.lineWidth = 6;
  g.strokeRect(40, 40, 1320, 970);
  g.lineWidth = 2;
  g.strokeRect(60, 60, 1280, 930);
  g.textAlign = 'center';
  g.fillStyle = '#1a1410';
  g.font = '400 92px "UnifrakturMaguntia", serif';
  g.fillText(d.school, 700, 230);
  g.font = 'italic 400 40px "EB Garamond", serif';
  g.fillText('has conferred upon', 700, 330);
  g.font = '400 84px "UnifrakturMaguntia", serif';
  g.fillText('Your Name', 700, 440);
  g.font = 'italic 400 40px "EB Garamond", serif';
  g.fillText('the degree of', 700, 530);
  g.font = '500 78px "EB Garamond", serif';
  g.fillText(d.degree, 700, 630);
  g.font = 'italic 400 46px "EB Garamond", serif';
  g.fillText(`in ${d.field}`, 700, 710);
  g.font = '400 34px "EB Garamond", serif';
  g.fillText(`${d.place} · ${d.year}`, 700, 790);
  // Signatures and a gold seal with ribbons.
  g.strokeStyle = '#2a2420';
  g.lineWidth = 2;
  for (const x of [330, 1070]) {
    g.beginPath();
    g.moveTo(x - 170, 920);
    g.lineTo(x + 170, 920);
    g.stroke();
    g.font = 'italic 400 46px "Caveat", cursive';
    g.fillText(x < 700 ? 'A. Signature' : 'B. Signature', x, 905);
    g.font = '400 24px "EB Garamond", serif';
    g.fillText(x < 700 ? 'President' : 'Dean', x, 955);
  }
  g.fillStyle = '#8c1f1f';
  g.beginPath();
  g.moveTo(670, 900);
  g.lineTo(640, 1010);
  g.lineTo(680, 985);
  g.lineTo(700, 1020);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(730, 900);
  g.lineTo(760, 1010);
  g.lineTo(720, 985);
  g.lineTo(700, 1020);
  g.closePath();
  g.fill();
  const seal = g.createRadialGradient(690, 880, 10, 700, 890, 70);
  seal.addColorStop(0, '#f8e3a0');
  seal.addColorStop(1, '#a87a22');
  g.fillStyle = seal;
  g.beginPath();
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const rr = i % 2 ? 62 : 70;
    g.lineTo(700 + Math.cos(a) * rr, 890 + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
  return texture(c);
}

function medalTexture(face: string, metal: keyof typeof METALS) {
  const [c, g] = canvas(512, 512);
  const [hi, mid, lo] = METALS[metal];
  const grad = g.createRadialGradient(200, 180, 20, 256, 256, 256);
  grad.addColorStop(0, hi);
  grad.addColorStop(0.6, mid);
  grad.addColorStop(1, lo);
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  // Raised rim, a laurel, and the distance.
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 10;
  g.beginPath();
  g.arc(256, 256, 226, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(256, 256, 214, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = 'rgba(0,0,0,0.28)';
  for (const side of [-1, 1])
    for (let i = 0; i < 9; i++) {
      const a = Math.PI / 2 + side * (0.4 + i * 0.22);
      g.save();
      g.translate(256 + Math.cos(a) * 170, 256 + Math.sin(a) * 170);
      g.rotate(a + side * 0.6);
      g.beginPath();
      g.ellipse(0, 0, 9, 22, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  g.fillStyle = lo;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 ${face.length > 3 ? 120 : 150}px "Archivo Black", sans-serif`;
  g.fillText(face, 256, 250);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillText(face, 252, 246);
  g.font = '700 30px "Space Mono", monospace';
  g.fillStyle = lo;
  g.fillText('FINISHER', 256, 350);
  return texture(c);
}

function ribbonTexture(a: string, b: string) {
  const [c, g] = canvas(64, 512);
  g.fillStyle = a;
  g.fillRect(0, 0, 64, 512);
  g.fillStyle = b;
  g.fillRect(24, 0, 16, 512);
  g.fillStyle = 'rgba(0,0,0,0.15)';
  g.fillRect(0, 0, 4, 512);
  g.fillRect(60, 0, 4, 512);
  return texture(c);
}

/** Things on the right wall face −x. Build them facing +z and turn the group. */
export function buildHonors(): Honors {
  const group = new THREE.Group();
  group.rotation.y = -Math.PI / 2;

  // Diplomas: a dark frame, a cream mat, the certificate.
  const frameMat = new THREE.MeshStandardMaterial({ color: '#241710', roughness: 0.45 });
  const gilt = new THREE.MeshStandardMaterial({ color: '#c7a35a', metalness: 0.9, roughness: 0.35 });
  const diplomas: THREE.Object3D[] = [];
  DIPLOMAS.forEach((d, i) => {
    const f = new THREE.Group();
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.36, 0.025), frameMat);
    back.castShadow = true;
    f.add(back);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.027), gilt);
    lip.position.z = 0.0005;
    f.add(lip);
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(0.41, 0.31), new THREE.MeshStandardMaterial({ color: '#efe6cf', roughness: 0.95 }));
    mat.position.z = 0.0141;
    f.add(mat);
    const cert = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.255), new THREE.MeshStandardMaterial({ map: diplomaTexture(d), roughness: 0.85 }));
    cert.position.z = 0.0143;
    f.add(cert);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.41, 0.31), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.06, roughness: 0.05, metalness: 0.3 }));
    glass.position.z = 0.0145;
    f.add(glass);
    // Placed along the wall (the group's x runs along the wall toward the front).
    f.position.set(-0.75 + i * 0.55, 1.62 + (i % 2) * 0.04, 0.015);
    group.add(f);
    diplomas.push(f);
  });

  // The medal board: pine with brass pegs.
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.025), new THREE.MeshStandardMaterial({ color: '#7a4f2a', roughness: 0.6 }));
  board.position.set(0.82, 1.95, 0.013);
  board.castShadow = true;
  group.add(board);
  const brass = new THREE.MeshStandardMaterial({ color: '#c9a04e', metalness: 1, roughness: 0.3 });
  const medals: THREE.Object3D[] = [];
  const swingState = MEDALS.map(() => ({ a: 0, v: 0 }));
  MEDALS.forEach((m, i) => {
    const x = 0.6 + i * 0.145;
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 12), brass);
    peg.rotation.x = Math.PI / 2;
    peg.position.set(x, 1.95, 0.035);
    group.add(peg);
    // Each medal hangs from its peg: a pivot that swings.
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.95, 0.042);
    const drop = 0.26 + (i % 2) * 0.04;
    const ribbonTex = ribbonTexture(m.ribbon[0], m.ribbon[1]);
    for (const side of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.PlaneGeometry(0.034, drop * 1.03), new THREE.MeshStandardMaterial({ map: ribbonTex, roughness: 0.8, side: THREE.DoubleSide }));
      strap.position.set(side * 0.012, -drop / 2, side * 0.002);
      strap.rotation.z = side * 0.09;
      pivot.add(strap);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0018, 8, 20), brass);
    ring.position.set(0, -drop - 0.002, 0.003);
    pivot.add(ring);
    const [hi, mid] = METALS[m.metal];
    const faceTex = medalTexture(m.face, m.metal);
    const edge = new THREE.MeshStandardMaterial({ color: mid, metalness: 1, roughness: 0.3 });
    const face = new THREE.MeshStandardMaterial({ map: faceTex, metalness: 0.85, roughness: 0.3, color: '#ffffff' });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.006, 40), [edge, face, face]);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(0, -drop - 0.05, 0.005);
    disc.castShadow = true;
    pivot.add(disc);
    void hi;
    group.add(pivot);
    medals.push(pivot);
  });

  return {
    group,
    diplomas,
    medals,
    swing(i) {
      swingState[i].v += 2.2 * (Math.random() < 0.5 ? -1 : 1);
    },
    tick(_t, dt) {
      // A damped pendulum each, about a second to a swing.
      swingState.forEach((s, i) => {
        s.v += -s.a * 38 * dt;
        s.v *= Math.exp(-dt * 1.4);
        s.a += s.v * dt;
        medals[i].rotation.z = s.a;
      });
    },
  };
}
