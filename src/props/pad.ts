// A pad of lined paper and a fountain pen. Ask, and the pen writes a poem out,
// word by word, the nib following the line.
import * as THREE from 'three';
import { POEMS } from '../content';
import { canvas, texture } from '../textures';

export interface Pad {
  group: THREE.Group;
  /** The paper: click it for a poem. */
  paper: THREE.Object3D;
  pen: THREE.Object3D;
  /** Starts the next poem on a fresh page. Returns its title. */
  next(): string;
  /** True while the pen is moving. */
  writing(): boolean;
  /** The poem on the page now, for the screen reader and the caption. */
  current(): { title: string; lines: string[] } | null;
  tick(t: number, dt: number): void;
}

const PW = 0.15;
const PH = 0.21;
const TW = 768;
const TH = 1075;
const MARGIN = 120;
const TOP = 170;
const LINE = 62;

export function buildPad(): Pad {
  const group = new THREE.Group();
  const [c, g] = canvas(TW, TH);
  const tex = texture(c);
  tex.anisotropy = 8;

  const blank = () => {
    g.fillStyle = '#f7f1e1';
    g.fillRect(0, 0, TW, TH);
    // Faint paper grain.
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = `rgba(120,100,70,${Math.random() * 0.035})`;
      g.fillRect(Math.random() * TW, Math.random() * TH, 2, 2);
    }
    g.strokeStyle = 'rgba(90,120,180,0.4)';
    g.lineWidth = 2;
    for (let y = TOP + LINE; y < TH - 30; y += LINE) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(TW, y);
      g.stroke();
    }
    g.strokeStyle = 'rgba(200,70,60,0.55)';
    g.beginPath();
    g.moveTo(MARGIN - 18, 0);
    g.lineTo(MARGIN - 18, TH);
    g.stroke();
  };
  blank();

  // The pad: a cardboard back, the paper, a red binding strip.
  const back = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.006, 0.006, PH + 0.006), new THREE.MeshStandardMaterial({ color: '#4a3322', roughness: 0.9 }));
  back.position.y = 0.003;
  back.castShadow = true;
  back.receiveShadow = true;
  group.add(back);
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshStandardMaterial({ map: tex, color: '#a39d91', roughness: 0.95 }));
  paper.rotation.x = -Math.PI / 2;
  paper.position.y = 0.0065;
  paper.receiveShadow = true;
  group.add(paper);
  const binding = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.008, 0.009, 0.018), new THREE.MeshStandardMaterial({ color: '#8c2b22', roughness: 0.6 }));
  binding.position.set(0, 0.0055, -PH / 2 + 0.006);
  group.add(binding);

  // The pen: black resin, gold trim, a two-tone nib. Built pointing along +y.
  const pen = new THREE.Group();
  const resin = new THREE.MeshStandardMaterial({ color: '#0d0d10', roughness: 0.18, metalness: 0.2 });
  const gold = new THREE.MeshStandardMaterial({ color: '#d4af5f', roughness: 0.25, metalness: 1 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0056, 0.095, 24), resin);
  barrel.position.y = 0.0475 + 0.022;
  pen.add(barrel);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0066, 0.0064, 0.06, 24), resin);
  cap.position.y = 0.022 + 0.095 + 0.024;
  pen.add(cap);
  const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.0066, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), resin);
  capTop.position.y = 0.022 + 0.095 + 0.054;
  pen.add(capTop);
  for (const y of [0.022, 0.022 + 0.095 - 0.004, 0.022 + 0.095 + 0.004]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0064, 0.0009, 8, 28), gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    pen.add(ring);
  }
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.0022, 0.045, 0.0016), gold);
  clip.position.set(0, 0.022 + 0.095 + 0.03, 0.0072);
  pen.add(clip);
  const section = new THREE.Mesh(new THREE.CylinderGeometry(0.0048, 0.0038, 0.022, 20), resin);
  section.position.y = 0.011;
  pen.add(section);
  const nibShape = new THREE.Shape();
  nibShape.moveTo(-0.0032, 0.004);
  nibShape.quadraticCurveTo(-0.003, -0.006, 0, -0.016);
  nibShape.quadraticCurveTo(0.003, -0.006, 0.0032, 0.004);
  nibShape.closePath();
  const nib = new THREE.Mesh(new THREE.ShapeGeometry(nibShape, 8), new THREE.MeshStandardMaterial({ color: '#e8d9a8', roughness: 0.2, metalness: 1, side: THREE.DoubleSide }));
  nib.position.set(0, 0.0, 0.0038);
  pen.add(nib);
  pen.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  // Hang the pen from its nib point, so posing the pivot places the nib.
  pen.position.y = 0.016;
  const penPivot = new THREE.Group();
  penPivot.add(pen);
  group.add(penPivot);

  // Resting pose: lying beside the pad. Writing pose: tip on the paper, leaning back.
  const restPos = new THREE.Vector3(PW / 2 + 0.03, 0.007, 0.01);
  const restRot = new THREE.Euler(Math.PI / 2, 0, 0.35, 'YXZ');
  const writeRot = new THREE.Euler(0.72, 0.5, 0, 'YXZ');
  penPivot.position.copy(restPos);
  penPivot.rotation.copy(restRot);
  const restQ = new THREE.Quaternion().setFromEuler(restRot);
  const writeQ = new THREE.Quaternion().setFromEuler(writeRot);

  let poem = -1;
  let shown = 0; // characters written so far
  let layout: { text: string; x: number; y: number; font: string }[] = [];
  let total = 0;
  let pose = 0; // 0 resting, 1 writing
  let pause = 0;
  const tip = new THREE.Vector3();

  const ink = '#1c2b6b';
  const titleFont = '600 72px "Caveat", cursive';
  const bodyFont = '600 56px "Caveat", cursive';

  const plan = (p: { title: string; lines: string[] }) => {
    layout = [{ text: p.title, x: MARGIN, y: TOP, font: titleFont }];
    p.lines.forEach((line, i) => layout.push({ text: line, x: MARGIN + (i % 2 ? 22 : 0), y: TOP + LINE * (i + 2) - 10, font: bodyFont }));
    total = layout.reduce((n, l) => n + l.text.length, 0);
  };

  /** Draws what's been written so far, and returns where the nib is on the page. */
  const drawUpTo = (n: number) => {
    blank();
    let left = n;
    let at = { x: MARGIN, y: TOP };
    g.fillStyle = ink;
    g.strokeStyle = ink;
    g.lineWidth = 1.6;
    g.textBaseline = 'alphabetic';
    for (const l of layout) {
      if (left <= 0) break;
      const part = l.text.slice(0, Math.min(left, l.text.length));
      g.font = l.font;
      // A slight wobble, line by line, so it reads as a hand.
      g.save();
      g.translate(l.x, l.y);
      g.rotate(Math.sin(l.y) * 0.006);
      // Filled and lightly stroked: a wet nib's line, thick enough to survive the distance.
      g.fillText(part, 0, 0);
      g.strokeText(part, 0, 0);
      g.restore();
      at = { x: l.x + g.measureText(part).width, y: l.y };
      left -= l.text.length;
    }
    tex.needsUpdate = true;
    return at;
  };

  return {
    group,
    paper,
    pen: penPivot,
    next() {
      poem = (poem + 1) % POEMS.length;
      plan(POEMS[poem]);
      shown = 0;
      pause = 0.6;
      drawUpTo(0);
      return POEMS[poem].title;
    },
    writing: () => poem >= 0 && shown < total,
    current: () => (poem >= 0 ? POEMS[poem] : null),
    tick(t, dt) {
      const busy = poem >= 0 && shown < total;
      pose = THREE.MathUtils.clamp(pose + (busy ? dt * 2.5 : -dt * 1.2), 0, 1);
      if (busy) {
        if (pause > 0) pause -= dt;
        else {
          const before = Math.floor(shown);
          // About fourteen letters a second, a beat between lines.
          shown = Math.min(total, shown + dt * 14);
          let count = 0;
          for (const l of layout) {
            count += l.text.length;
            if (before < count && Math.floor(shown) >= count) pause = 0.35;
          }
        }
        const at = drawUpTo(Math.floor(shown));
        // Page pixels to the pad's local space.
        tip.set((at.x / TW - 0.5) * PW, 0.0075 + Math.abs(Math.sin(t * 22)) * 0.0012, (at.y / TH - 0.5) * PH - 0.003);
      }
      const k = THREE.MathUtils.smoothstep(pose, 0, 1);
      penPivot.position.lerpVectors(restPos, tip.lengthSq() ? tip : restPos, k);
      penPivot.quaternion.slerpQuaternions(restQ, writeQ, k);
    },
  };
}
