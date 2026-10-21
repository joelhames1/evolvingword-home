// What the studio's pieces stand on in a round room with a turning dome: the
// diplomas and medals hang from a brass picture rail over the wall, the map
// stands on an easel, the shirts' line runs between two posts with a bar over
// the top. And a celestial globe by the bookshelf, for looking things up.
import * as THREE from 'three';
import { canvas, rng, texture } from '../../textures';
import { LEDGE } from './dome';

const brass = () => new THREE.MeshStandardMaterial({ color: '#c39a58', roughness: 0.3, metalness: 0.9 });
const oak = () => new THREE.MeshStandardMaterial({ color: '#6b4a2c', roughness: 0.55 });

/** A rod from a to b. */
function rod(a: THREE.Vector3, b: THREE.Vector3, radius: number, mat: THREE.Material, sides = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), sides), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  m.castShadow = true;
  return m;
}

/**
 * The picture rail over the honors: in the honors group's own frame (x along the
 * wall, z out into the room), standing on the ledge. Wires drop to each diploma.
 */
export function honorsRail(honors: THREE.Object3D, diplomas: THREE.Object3D[]) {
  const group = new THREE.Group();
  const mat = brass();
  const at = (x: number, y: number, z: number) => honors.localToWorld(new THREE.Vector3(x, y, z));
  const y = 2.0;
  const ends = [-1.14, 1.26];
  group.add(rod(at(ends[0] - 0.04, y, 0.03), at(ends[1] + 0.04, y, 0.03), 0.013, mat, 14));
  for (const x of ends) {
    group.add(rod(at(x, LEDGE, 0.0), at(x, y + 0.02, 0.03), 0.011, mat));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.024, 14, 10), mat);
    knob.position.copy(at(x + (x < 0 ? -0.04 : 0.04), y, 0.03));
    group.add(knob);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.02, 16), mat);
    foot.position.copy(at(x, LEDGE + 0.01, 0));
    group.add(foot);
  }
  // Wires from each frame's top corners up to the rail.
  const wire = new THREE.MeshStandardMaterial({ color: '#9a8a70', roughness: 0.4, metalness: 0.8 });
  for (const d of diplomas) {
    const top = d.position.y + 0.18;
    for (const s of [-1, 1]) group.add(rod(at(d.position.x + s * 0.19, top, 0.02), at(d.position.x + s * 0.07, y - 0.01, 0.03), 0.0018, wire, 4));
  }
  // Two short hangers for the medal bar.
  for (const x of [0.6, 1.04]) group.add(rod(at(x, 1.985, 0.025), at(x, y, 0.03), 0.006, mat));
  return group;
}

/** An easel for the map, in the map group's frame (the map's middle at the origin, its face toward +z). */
export function easel(map: THREE.Object3D, floorY: number) {
  const group = new THREE.Group();
  const wood = oak();
  const at = (x: number, y: number, z: number) => map.localToWorld(new THREE.Vector3(x, y, z));
  const down = -floorY;
  // Two front legs splayed a little, a back leg, and the ledge the frame stands on.
  // The legs stand just outside the frame's ends, so nothing crosses the map.
  for (const s of [-1, 1]) {
    const leg = rod(at(s * 0.93, down, 0.2), at(s * 0.85, 0.58, -0.03), 0.022, wood, 8);
    group.add(leg);
  }
  // (Its foot stays short of the wall behind, rather than going through it.)
  group.add(rod(at(0, down, -0.3), at(0, 0.3, -0.06), 0.022, wood, 8));
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.035, 0.09), wood);
  ledge.position.copy(at(0, -0.43, 0.01));
  ledge.quaternion.copy(map.getWorldQuaternion(new THREE.Quaternion()));
  ledge.castShadow = true;
  group.add(ledge);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 0.015), wood);
  lip.position.copy(at(0, -0.405, 0.05));
  lip.quaternion.copy(ledge.quaternion);
  group.add(lip);
  // A crossbar low down, between the front legs.
  group.add(rod(at(-0.9, down + 0.35, 0.16), at(0.9, down + 0.35, 0.16), 0.012, wood, 6));
  return group;
}

/** Posts at each end of the shirts' line, and a bar across the top for its hooks; in the line's frame. */
export function lineFrame(line: THREE.Object3D) {
  const group = new THREE.Group();
  const wood = oak();
  const mat = brass();
  const at = (x: number, y: number, z: number) => line.localToWorld(new THREE.Vector3(x, y, z));
  const top = 2.84;
  for (const x of [-0.06, 1.61]) {
    group.add(rod(at(x, 0, -0.02), at(x, top, -0.02), 0.028, wood, 10));
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.04, 20), wood);
    foot.position.copy(at(x, 0.02, -0.02));
    foot.castShadow = true;
    group.add(foot);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), mat);
    finial.position.copy(at(x, top + 0.04, -0.02));
    group.add(finial);
  }
  group.add(rod(at(-0.09, top - 0.03, 0), at(1.64, top - 0.03, 0), 0.016, mat, 12));
  return group;
}

/** The sky's map on a globe: dark blue, gold stars and a few figures, in a brass meridian, on a three-legged stand. */
export function celestialGlobe() {
  const group = new THREE.Group();
  const [c, g] = canvas(1024, 512);
  g.fillStyle = '#0d1a3a';
  g.fillRect(0, 0, 1024, 512);
  const r = rng(88);
  // Faint grid of hours and degrees.
  g.strokeStyle = 'rgba(200,180,120,0.18)';
  g.lineWidth = 1;
  for (let x = 0; x < 1024; x += 1024 / 24) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 512);
    g.stroke();
  }
  for (let y = 0; y < 512; y += 512 / 12) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(1024, y);
    g.stroke();
  }
  // The ecliptic, a gold wave.
  g.strokeStyle = 'rgba(230,190,110,0.6)';
  g.lineWidth = 2;
  g.beginPath();
  for (let x = 0; x <= 1024; x += 8) g.lineTo(x, 256 + Math.sin((x / 1024) * Math.PI * 2) * 66);
  g.stroke();
  // Stars, and here and there a little figure joining a few of them.
  g.fillStyle = '#f2d58e';
  const pts: [number, number][] = [];
  for (let i = 0; i < 260; i++) {
    const x = r() * 1024;
    const y = 30 + r() * 452;
    const s = 0.6 + Math.pow(r(), 3) * 3;
    pts.push([x, y]);
    g.beginPath();
    g.arc(x, y, s, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = 'rgba(242,213,142,0.45)';
  g.lineWidth = 1.2;
  for (let k = 0; k < 14; k++) {
    const [x0, y0] = pts[Math.floor(r() * pts.length)];
    g.beginPath();
    g.moveTo(x0, y0);
    let x = x0;
    let y = y0;
    for (let j = 0; j < 4; j++) {
      x += (r() - 0.5) * 70;
      y += (r() - 0.5) * 50;
      g.lineTo(x, y);
      g.arc(x, y, 1.6, 0, Math.PI * 2);
      g.moveTo(x, y);
    }
    g.stroke();
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 48, 24), new THREE.MeshStandardMaterial({ map: texture(c), roughness: 0.4, metalness: 0.1 }));
  ball.position.y = 0.95;
  ball.rotation.z = 0.41;
  ball.castShadow = true;
  group.add(ball);
  const mat = brass();
  const meridian = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.008, 8, 64), mat);
  meridian.position.y = 0.95;
  meridian.rotation.z = 0.41;
  group.add(meridian);
  const horizon = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.012, 8, 64), new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: 0.5 }));
  horizon.rotation.x = Math.PI / 2;
  horizon.position.y = 0.95;
  group.add(horizon);
  const wood = oak();
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    group.add(rod(new THREE.Vector3(Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22), new THREE.Vector3(Math.cos(a) * 0.2, 0.95, Math.sin(a) * 0.2), 0.016, wood, 8));
  }
  group.add(rod(new THREE.Vector3(0, 0.7, 0), new THREE.Vector3(0, 0.95 - 0.2, 0), 0.012, mat));
  return { group, ball };
}

/** A four-pointed glint, for light catching metal. */
function glintTexture() {
  const [c, g] = canvas(128, 128);
  const core = g.createRadialGradient(64, 64, 0, 64, 64, 30);
  core.addColorStop(0, 'rgba(255,250,235,1)');
  core.addColorStop(0.2, 'rgba(255,236,190,0.5)');
  core.addColorStop(1, 'rgba(255,236,190,0)');
  g.fillStyle = core;
  g.fillRect(0, 0, 128, 128);
  for (const [w, h] of [
    [128, 3],
    [3, 128],
  ]) {
    const ray = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    ray.addColorStop(0, 'rgba(255,248,225,0.9)');
    ray.addColorStop(1, 'rgba(255,248,225,0)');
    g.fillStyle = ray;
    g.fillRect(64 - w / 2, 64 - h / 2, w, h);
  }
  return texture(c);
}

/**
 * The medals as small bright stars: a glint on each, twinkling, that follows it
 * as it swings. Only shown while you're looking at them.
 */
export function medalGlints(medals: THREE.Object3D[]) {
  const group = new THREE.Group();
  const map = glintTexture();
  // Each medal's disc: the round piece at the end of its ribbon.
  const discs = medals.map((pivot) => {
    let disc: THREE.Object3D = pivot;
    pivot.traverse((o) => {
      const p = ((o as THREE.Mesh).geometry as THREE.CylinderGeometry | undefined)?.parameters;
      if ((o as THREE.Mesh).isMesh && p && Math.abs(p.radiusTop - 0.042) < 1e-4) disc = o;
    });
    return disc;
  });
  const sprites = discs.map(() => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    s.scale.setScalar(0.09);
    group.add(s);
    return s;
  });
  const at = new THREE.Vector3();
  return {
    group,
    tick(t: number, show: number) {
      group.visible = show > 0.01;
      if (!group.visible) return;
      discs.forEach((d, i) => {
        // On the rim, up and to one side, where the light catches it.
        d.localToWorld(at.set(-0.026, 0.004, -0.024));
        sprites[i].position.copy(at);
        const tw = 0.55 + 0.45 * Math.sin(t * (1.3 + i * 0.37) + i * 2.1) * Math.sin(t * (2.9 + i * 0.21) + i);
        (sprites[i].material as THREE.SpriteMaterial).opacity = show * Math.max(0, tw);
        sprites[i].scale.setScalar(0.04 + 0.03 * tw);
      });
    },
  };
}
