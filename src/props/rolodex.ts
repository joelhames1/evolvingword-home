// A Rolodex at the end of the desk: every job on its own card. Flick through it.
import * as THREE from 'three';
import { WORK } from '../content';
import { canvas, texture } from '../textures';

export interface Rolodex {
  group: THREE.Group;
  /** The whole thing, for clicking. */
  body: THREE.Object3D;
  /** Flips to the next card; returns its index. */
  flip(dir?: 1 | -1): number;
  index(): number;
  tick(t: number, dt: number): void;
}

const CW = 0.1;
const CH = 0.06;
const CARDS = 22;

function cardTexture(job?: (typeof WORK)[number], n?: number) {
  const [c, g] = canvas(640, 384);
  g.fillStyle = '#f6f1e3';
  g.fillRect(0, 0, 640, 384);
  // Index-card rules, and the two slots at the bottom that hold it on the rails.
  g.strokeStyle = 'rgba(80,110,170,0.35)';
  g.lineWidth = 2;
  for (let y = 120; y < 340; y += 44) {
    g.beginPath();
    g.moveTo(24, y);
    g.lineTo(616, y);
    g.stroke();
  }
  g.strokeStyle = 'rgba(200,70,60,0.5)';
  g.beginPath();
  g.moveTo(24, 92);
  g.lineTo(616, 92);
  g.stroke();
  g.fillStyle = '#d8d0bd';
  g.fillRect(180, 352, 60, 32);
  g.fillRect(400, 352, 60, 32);
  if (job) {
    // Long names and notes shrink to fit the card, above the rail.
    const fit = (text: string, weight: string, size: number, family: string, max: number) => {
      let px = size;
      g.font = `${weight} ${px}px ${family}`;
      while (g.measureText(text).width > max && px > 16) g.font = `${weight} ${--px}px ${family}`;
    };
    g.fillStyle = '#1b1b22';
    fit(job.company.toUpperCase(), '700', 46, '"Space Mono", monospace', 490);
    g.fillText(job.company.toUpperCase(), 30, 70);
    g.fillStyle = '#2a3a7a';
    fit(job.role, '400', 34, '"Space Mono", monospace', 580);
    g.fillText(job.role, 30, 150);
    g.fillStyle = '#5a5248';
    g.font = '400 34px "Space Mono", monospace';
    g.fillText(job.years, 30, 196);
    g.fillStyle = '#1c2b6b';
    fit(job.note, '600', 40, '"Caveat", cursive', 580);
    g.fillText(job.note, 30, 284);
    g.font = '400 24px "Space Mono", monospace';
    g.fillStyle = '#8a8070';
    g.fillText(`${String((n ?? 0) + 1).padStart(2, '0')}/${String(WORK.length).padStart(2, '0')}`, 540, 40);
  }
  return texture(c);
}

export function buildRolodex(): Rolodex {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const metal = new THREE.MeshStandardMaterial({ color: '#1d1e22', metalness: 0.7, roughness: 0.35 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#c9ccd2', metalness: 1, roughness: 0.2 });

  // The stand: a base and two round side plates holding the axle.
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.012, 0.09), metal);
  base.position.y = 0.006;
  base.castShadow = true;
  body.add(base);
  for (const sx of [-1, 1]) {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.006, 32), metal);
    plate.rotation.z = Math.PI / 2;
    plate.position.set(sx * 0.062, 0.05, 0);
    plate.castShadow = true;
    body.add(plate);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.04, 0.03), metal);
    leg.position.set(sx * 0.062, 0.02, 0);
    body.add(leg);
  }
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.13, 12), chrome);
  axle.rotation.z = Math.PI / 2;
  axle.position.y = 0.05;
  body.add(axle);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 20), metal);
  knob.rotation.z = Math.PI / 2;
  knob.position.set(0.074, 0.05, 0);
  body.add(knob);

  // The wheel of cards. Card i sits at angle i * step around the axle.
  const wheel = new THREE.Group();
  wheel.position.y = 0.05;
  body.add(wheel);
  const step = Math.PI / CARDS;
  const blankTex = cardTexture();
  const holders: THREE.Group[] = [];
  for (let i = 0; i < CARDS; i++) {
    const job = i < WORK.length ? WORK[i] : undefined;
    const front = new THREE.MeshStandardMaterial({ map: job ? cardTexture(job, i) : blankTex, roughness: 0.9, side: THREE.DoubleSide });
    const card = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH), front);
    // Each card stands out from the axle; its bottom edge on the rails.
    card.position.set(0, CH / 2 - 0.006, 0);
    const holder = new THREE.Group();
    holder.add(card);
    wheel.add(holder);
    holders.push(holder);
  }
  let index = 0;
  let at = 0;

  return {
    group,
    body,
    flip(dir = 1) {
      index = (index + dir + WORK.length) % WORK.length;
      return index;
    },
    index: () => index,
    tick(_t, dt) {
      at += (index - at) * Math.min(1, dt * 7);
      // Cards already flipped fall forward, leaving the current one open to read;
      // the rest lean back behind it.
      holders.forEach((h, i) => {
        const rel = i - at;
        const rot = -rel * step - 0.12 + 0.75 * THREE.MathUtils.clamp(-rel, 0, 1);
        h.rotation.x = THREE.MathUtils.clamp(rot, -Math.PI / 2, Math.PI / 2);
      });
    },
  };
}
