// A Swiss chronograph in the Portuguese style lying in a leather tray: silver
// dial, blue Arabic numerals, blued leaf hands, two subdials. It keeps the
// visitor's real time, and its pushers run the chronograph.
import * as THREE from 'three';
import { canvas, texture } from '../textures';

export interface Watch {
  group: THREE.Group;
  /** The case and dial: click to look closer. */
  body: THREE.Object3D;
  /** The pusher at two o'clock (start/stop) and four o'clock (reset). */
  startStop: THREE.Object3D;
  reset: THREE.Object3D;
  /** The chronograph: start, stop, reset. Returns whether it's now running. */
  press(button: 'start' | 'reset'): boolean;
  /** Seconds on the chronograph. */
  elapsed(): number;
  tick(): void;
}

const R = 0.0205;

function dialTexture() {
  const S = 1024;
  const [c, g] = canvas(S, S);
  const cx = S / 2;
  const r = S / 2;
  // Silver-white, with a faint sunray brushing.
  const base = g.createRadialGradient(cx, cx, 0, cx, cx, r);
  base.addColorStop(0, '#f6f5f0');
  base.addColorStop(1, '#dedcd4');
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 720; i++) {
    const a = (i / 720) * Math.PI * 2;
    g.strokeStyle = `rgba(${i % 2 ? '255,255,255' : '160,160,150'},0.05)`;
    g.beginPath();
    g.moveTo(cx, cx);
    g.lineTo(cx + Math.cos(a) * r, cx + Math.sin(a) * r);
    g.stroke();
  }
  // Railway minute track.
  g.strokeStyle = '#1b2a5e';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(cx, cx, r * 0.93, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(cx, cx, r * 0.87, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 240; i++) {
    const a = (i / 240) * Math.PI * 2;
    const long = i % 4 === 0;
    g.lineWidth = long ? 3 : 1.4;
    g.beginPath();
    g.moveTo(cx + Math.sin(a) * r * 0.87, cx - Math.cos(a) * r * 0.87);
    g.lineTo(cx + Math.sin(a) * r * (long ? 0.94 : 0.91), cx - Math.cos(a) * r * (long ? 0.94 : 0.91));
    g.stroke();
  }
  // Applied Arabic numerals; six is hidden under the small seconds.
  g.fillStyle = '#1f3b8f';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '500 92px "EB Garamond", Georgia, serif';
  for (let n = 1; n <= 12; n++) {
    if (n === 6) continue;
    const a = (n / 12) * Math.PI * 2;
    const rr = r * 0.73;
    g.fillText(String(n), cx + Math.sin(a) * rr, cx - Math.cos(a) * rr + 4);
  }
  // Subdials: thirty-minute counter above center, small seconds below.
  const sub = (y: number, labels: string[], ticks: number) => {
    const sr = r * 0.25;
    const grad = g.createRadialGradient(cx, y, 0, cx, y, sr);
    grad.addColorStop(0, '#e8e6de');
    grad.addColorStop(1, '#d2cfc5');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(cx, y, sr, 0, Math.PI * 2);
    g.fill();
    for (let k = 0; k < 60; k += 2) {
      g.strokeStyle = 'rgba(40,40,60,0.25)';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(cx, y, sr * (0.35 + k / 120), 0, Math.PI * 2);
      g.stroke();
    }
    g.strokeStyle = '#1b2a5e';
    for (let k = 0; k < ticks; k++) {
      const a = (k / ticks) * Math.PI * 2;
      g.lineWidth = k % (ticks / labels.length) === 0 ? 3 : 1.5;
      g.beginPath();
      g.moveTo(cx + Math.sin(a) * sr * 0.8, y - Math.cos(a) * sr * 0.8);
      g.lineTo(cx + Math.sin(a) * sr * 0.97, y - Math.cos(a) * sr * 0.97);
      g.stroke();
    }
    g.fillStyle = '#1b2a5e';
    g.font = '500 30px "EB Garamond", Georgia, serif';
    labels.forEach((l, k) => {
      const a = (k / labels.length) * Math.PI * 2;
      g.fillText(l, cx + Math.sin(a) * sr * 0.6, y - Math.cos(a) * sr * 0.6 + 2);
    });
  };
  sub(cx - r * 0.42, ['30', '10', '20'], 30);
  sub(cx + r * 0.42, ['60', '20', '40'], 60);
  // The name, small and quiet.
  g.fillStyle = '#1b2a5e';
  g.font = '600 34px "EB Garamond", Georgia, serif';
  (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '6px';
  g.fillText('EVOLVING WORD', cx, cx - r * 0.1);
  g.font = 'italic 400 26px "EB Garamond", Georgia, serif';
  (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '2px';
  g.fillText('Chronograph · Automatic', cx, cx + r * 0.1);
  g.font = '500 20px "EB Garamond", Georgia, serif';
  g.fillText('SWISS MADE', cx, cx + r * 0.83);
  return texture(c);
}

/** A leaf hand lying flat, pointing at twelve (−z). */
function leafHand(len: number, width: number, mat: THREE.Material) {
  const s = new THREE.Shape();
  s.moveTo(0, -len * 0.18);
  s.quadraticCurveTo(width, len * 0.25, 0, len);
  s.quadraticCurveTo(-width, len * 0.25, 0, -len * 0.18);
  const g = new THREE.ShapeGeometry(s, 12);
  g.rotateX(-Math.PI / 2);
  return new THREE.Mesh(g, mat);
}

function needle(len: number, tail: number, width: number, mat: THREE.Material) {
  const g = new THREE.PlaneGeometry(width, len + tail);
  g.translate(0, (len - tail) / 2, 0);
  g.rotateX(-Math.PI / 2);
  return new THREE.Mesh(g, mat);
}

function strapTexture() {
  const [c, g] = canvas(256, 1024);
  g.fillStyle = '#4a2a17';
  g.fillRect(0, 0, 256, 1024);
  // Alligator scales: rows of soft rectangles.
  for (let y = 0; y < 1024; y += 46) {
    const off = (y / 46) % 2 ? 0 : 26;
    for (let x = -off; x < 256; x += 52) {
      const grd = g.createLinearGradient(x, y, x, y + 42);
      grd.addColorStop(0, 'rgba(110,62,32,0.9)');
      grd.addColorStop(1, 'rgba(50,25,10,0.9)');
      g.fillStyle = grd;
      g.beginPath();
      g.roundRect(x + 3, y + 3, 46, 40, 10);
      g.fill();
    }
  }
  g.strokeStyle = 'rgba(230,210,180,0.6)';
  g.setLineDash([10, 8]);
  g.lineWidth = 4;
  g.strokeRect(12, 0, 232, 1024);
  return texture(c);
}

export function buildWatch(): Watch {
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: '#d9dbe0', metalness: 1, roughness: 0.22 });
  const blue = new THREE.MeshStandardMaterial({ color: '#2547b0', metalness: 0.8, roughness: 0.25, emissive: '#0a1640', emissiveIntensity: 0.6, side: THREE.DoubleSide });

  // The tray it rests in.
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.21), new THREE.MeshStandardMaterial({ color: '#3a1f12', roughness: 0.7 }));
  tray.position.y = 0.006;
  tray.receiveShadow = true;
  group.add(tray);
  const lining = new THREE.Mesh(new THREE.PlaneGeometry(0.106, 0.196), new THREE.MeshStandardMaterial({ color: '#7a1f24', roughness: 0.95 }));
  lining.rotation.x = -Math.PI / 2;
  lining.position.y = 0.0122;
  group.add(lining);

  const body = new THREE.Group();
  body.position.y = 0.019;
  group.add(body);

  // Case: a lathe profile, polished steel.
  const prof = [
    [0, 0],
    [R * 0.9, 0],
    [R, 0.002],
    [R * 1.02, 0.007],
    [R, 0.0105],
    [R * 0.92, 0.0115],
    [R * 0.9, 0.0105],
    [0, 0.0105],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const caseMesh = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), steel);
  caseMesh.castShadow = true;
  body.add(caseMesh);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(R * 0.9, 64), new THREE.MeshStandardMaterial({ map: dialTexture(), roughness: 0.4, metalness: 0.1 }));
  dial.rotation.x = -Math.PI / 2;
  dial.position.y = 0.0106;
  body.add(dial);
  // Crystal: a shallow dome that catches the light.
  const crystal = new THREE.Mesh(
    new THREE.SphereGeometry(R * 2.2, 48, 8, 0, Math.PI * 2, 0, Math.asin(0.9 / 2.2)),
    new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.1, roughness: 0.02, metalness: 0, depthWrite: false }),
  );
  crystal.position.y = 0.0115 - R * 2.2 * Math.cos(Math.asin(0.9 / 2.2)) + 0.0014;
  body.add(crystal);
  // Lugs at twelve and six.
  for (const sz of [-1, 1])
    for (const sx of [-1, 1]) {
      const lug = new THREE.Mesh(new THREE.BoxGeometry(0.0035, 0.006, 0.01), steel);
      lug.position.set(sx * 0.0095, 0.004, sz * (R + 0.003));
      body.add(lug);
    }
  // Crown at three, pushers at two and four.
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0032, 0.004, 20), steel);
  crown.rotation.z = Math.PI / 2;
  crown.position.set(R + 0.0025, 0.0055, 0);
  body.add(crown);
  const pusher = (angle: number) => {
    const p = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0013, 0.0013, 0.004, 12), steel);
    stem.rotation.z = Math.PI / 2;
    stem.position.x = R + 0.0018;
    p.add(stem);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.0028, 16), steel);
    cap.rotation.z = Math.PI / 2;
    cap.position.x = R + 0.0045;
    p.add(cap);
    // A generous invisible hit area: real pushers are tiny.
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.x = R + 0.004;
    p.add(hit);
    p.position.y = 0.0055;
    p.rotation.y = angle;
    body.add(p);
    return p;
  };
  const startStop = pusher(Math.PI / 6);
  const reset = pusher(-Math.PI / 6);

  // Hands, from the bottom up.
  const handY = 0.0108;
  const hour = leafHand(R * 0.5, 0.0016, blue);
  const minute = leafHand(R * 0.75, 0.0013, blue);
  const chrono = needle(R * 0.82, R * 0.2, 0.00035, blue);
  const subR = R * 0.9 * 0.42;
  const smallSec = needle(R * 0.2, R * 0.04, 0.0004, blue);
  const counter = needle(R * 0.2, R * 0.04, 0.0004, blue);
  smallSec.position.set(0, handY, subR);
  counter.position.set(0, handY, -subR);
  hour.position.y = handY + 0.0002;
  minute.position.y = handY + 0.0004;
  chrono.position.y = handY + 0.0006;
  body.add(smallSec, counter, hour, minute, chrono);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.0008, 0.0008, 0.0012, 12), blue);
  pin.position.y = handY + 0.0008;
  body.add(pin);

  // The strap, curving down to the tray at each end, with a pin buckle.
  const strapMat = new THREE.MeshStandardMaterial({ map: strapTexture(), roughness: 0.6 });
  const strapPiece = (dir: 1 | -1, len: number) => {
    const g = new THREE.BoxGeometry(0.019, 0.003, len, 1, 1, 12);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i) + len / 2;
      pos.setY(i, pos.getY(i) - Math.pow(Math.max(0, z / len), 1.6) * 0.0115);
    }
    g.computeVertexNormals();
    g.translate(0, 0, len / 2);
    const m = new THREE.Mesh(g, strapMat);
    m.position.set(0, 0.0045, dir * (R + 0.006));
    if (dir < 0) m.rotation.y = Math.PI;
    m.castShadow = true;
    body.add(m);
    return m;
  };
  strapPiece(-1, 0.07);
  strapPiece(1, 0.062);
  const buckle = new THREE.Mesh(new THREE.TorusGeometry(0.0105, 0.0012, 8, 24, Math.PI), steel);
  buckle.rotation.set(-Math.PI / 2, 0, 0);
  buckle.position.set(0, -0.007, R + 0.068);
  body.add(buckle);

  // The chronograph.
  let running = false;
  let startedAt = 0;
  let banked = 0;
  const elapsed = () => banked + (running ? (performance.now() - startedAt) / 1000 : 0);

  const turn = (m: THREE.Object3D, fraction: number) => (m.rotation.y = -fraction * Math.PI * 2);

  return {
    group,
    body,
    startStop,
    reset,
    press(button) {
      if (button === 'start') {
        if (running) banked = elapsed();
        else startedAt = performance.now();
        running = !running;
      } else if (!running) banked = 0;
      return running;
    },
    elapsed,
    tick() {
      const now = new Date();
      // An automatic sweeps in small steps, eight a second.
      const ms = Math.floor(now.getMilliseconds() / 125) * 125;
      const s = now.getSeconds() + ms / 1000;
      const m = now.getMinutes() + s / 60;
      const h = (now.getHours() % 12) + m / 60;
      turn(hour, h / 12);
      turn(minute, m / 60);
      turn(smallSec, s / 60);
      const e = elapsed();
      turn(chrono, (Math.floor(e * 8) / 8 / 60) % 1);
      turn(counter, (Math.floor(e / 60) % 30) / 30);
    },
  };
}
