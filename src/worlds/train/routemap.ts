// The route plate under the map: an enamel strip of the line, the way railway
// maps in carriages were drawn. The landscapes behind us, the one we're in,
// and at its end the junction, forking: the branch it's set for lit, the
// other dim. A little amber light runs along it where the train is. Past
// forks keep the way they went, with a star where you threw the lever.
import * as THREE from 'three';
import { canvas, texture } from '../../textures';
import { BRANCHES, LAYOUT, NAMES, type Journey } from './journey';

const W = 1536;
const H = 300;

export function buildRouteMap(journey: Journey) {
  const [c, g] = canvas(W, H);
  const tex = texture(c);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.15, emissiveMap: tex, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.18 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 1.12 * (H / W)), mat);
  // The train's light: a dot that glows, over the plate.
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.009, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb040').multiplyScalar(3.2) }));
  dot.position.z = 0.002;
  mesh.add(dot);
  let lastKey = '';

  /** Where along the strip u falls, in pixels: from the start of the stretch before last to the junction ahead. */
  const draw = () => {
    const legs = journey.legs;
    const cur = journey.current();
    const i = legs.indexOf(cur);
    const shown = legs.slice(Math.max(0, i - 2), i + 1);
    const u0 = shown[0].start;
    const u1 = cur.end;
    const x0 = 70;
    const xj = W - 380;
    const px = (u: number) => x0 + ((u - u0) / (u1 - u0)) * (xj - x0);
    const yLine = 150;
    g.fillStyle = '#123224';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#c9a35a';
    g.lineWidth = 10;
    g.strokeRect(5, 5, W - 10, H - 10);
    g.lineWidth = 2;
    g.strokeRect(20, 20, W - 40, H - 40);
    g.fillStyle = '#c9a35a';
    g.font = '700 26px "Space Mono", monospace';
    g.textAlign = 'left';
    g.fillText('THE NIGHT TRAIN  ·  THE LINE TONIGHT', 40, 56);
    // The line so far.
    g.lineCap = 'round';
    g.strokeStyle = '#efe4c8';
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(x0, yLine);
    g.lineTo(xj, yLine);
    g.stroke();
    shown.forEach((l, k) => {
      const a = px(l.start);
      const b = px(l.end);
      // Each landscape's name over its stretch, and its stations as ticks.
      g.fillStyle = l === cur ? '#f4ead2' : 'rgba(239,228,200,0.6)';
      g.font = `${l === cur ? 700 : 400} 30px "Space Mono", monospace`;
      g.textAlign = 'center';
      g.fillText(NAMES[l.land].toUpperCase(), (a + b) / 2, yLine - 34);
      const st = LAYOUT[l.land].station;
      if (st) {
        const sx = px(l.start + st.at);
        g.fillStyle = '#efe4c8';
        g.fillRect(sx - 4, yLine - 4, 8, 26);
        g.font = '400 20px "Space Mono", monospace';
        g.fillText(st.name, sx, yLine + 50);
      }
      // A past junction: the way not taken, a short stub off the line.
      if (k < shown.length - 1) {
        g.strokeStyle = 'rgba(239,228,200,0.35)';
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(b, yLine);
        g.lineTo(b + 44, yLine + 44);
        g.stroke();
        g.fillStyle = 'rgba(239,228,200,0.45)';
        g.font = '400 17px "Space Mono", monospace';
        g.fillText(NAMES[BRANCHES[l.land][l.set ? 0 : 1]].replace(/^The /, '').toUpperCase(), b + 58, yLine + 76);
        if (l.by === 'you') star(b, yLine - 70);
      }
    });
    // The junction ahead: two branches out to the right, the one it's set for bright.
    const j = journey.junction();
    for (const k of [0, 1] as const) {
      const on = j.set === k;
      const yy = yLine + (k === 0 ? -70 : 70);
      g.strokeStyle = on ? '#e8c46a' : 'rgba(239,228,200,0.3)';
      g.lineWidth = on ? 9 : 5;
      g.beginPath();
      g.moveTo(xj, yLine);
      g.bezierCurveTo(xj + 90, yLine, xj + 90, yy, xj + 180, yy);
      g.lineTo(W - 60, yy);
      g.stroke();
      g.fillStyle = on ? '#f4ead2' : 'rgba(239,228,200,0.45)';
      g.font = `${on ? 700 : 400} 26px "Space Mono", monospace`;
      g.textAlign = 'right';
      g.fillText(NAMES[j.to[k]].toUpperCase(), W - 60, yy + (k === 0 ? -16 : 38));
    }
    if (j.by === 'you') star(xj, yLine - 70);
    // The points themselves.
    g.fillStyle = j.live ? '#ffb44a' : '#efe4c8';
    g.beginPath();
    g.arc(xj, yLine, 11, 0, Math.PI * 2);
    g.fill();
    tex.needsUpdate = true;
    return { px, yLine };
  };
  const star = (x: number, y: number) => {
    g.fillStyle = '#e8c46a';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? 6 : 14;
      g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    g.fill();
    g.font = '400 16px "Space Mono", monospace';
    g.textAlign = 'center';
    g.fillText('YOU', x, y - 20);
  };

  let geom = draw();
  return {
    mesh,
    tick(t: number) {
      const j = journey.junction();
      const key = `${journey.current().start}:${j.set}:${j.by}:${j.live}:${journey.legs.length}:${journey.revision}`;
      if (key !== lastKey) {
        lastKey = key;
        geom = draw();
      }
      // The light, where we are; it pulses a little.
      const x = geom.px(journey.s);
      const pw = mesh.geometry.parameters.width;
      const ph = mesh.geometry.parameters.height;
      dot.position.set((x / W - 0.5) * pw, (0.5 - geom.yLine / H) * ph, 0.002);
      dot.scale.setScalar(1 + 0.15 * Math.sin(t * 3));
    },
  };
}
