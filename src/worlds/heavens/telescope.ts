// The telescope in the middle of the room: a long cream refractor with brass
// bands, on a fork that turns on a cast-iron pier. It points out of the slit
// wherever the dome is turned, and swings to whatever you ask it to look at.
// On the pier, a small brass plate.
import * as THREE from 'three';
import { canvas, texture } from '../../textures';
import { CENTER } from './peak';

/** Where the tube pivots, above the floor. */
export const PIVOT = 2.5;
/** Half the tube's length, and where the eyepiece sits behind the pivot. */
const HALF = 1.5;

/** The plate on the pier: engraved brass. */
function plate() {
  const [c, g] = canvas(1024, 384);
  const grad = g.createLinearGradient(0, 0, 0, 384);
  grad.addColorStop(0, '#d9b46a');
  grad.addColorStop(0.5, '#b88c44');
  grad.addColorStop(1, '#8e6630');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 384);
  // Brushed.
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(255,240,200,${Math.random() * 0.05})`;
    g.fillRect(0, Math.random() * 384, 1024, 1);
  }
  g.strokeStyle = 'rgba(60,36,10,0.7)';
  g.lineWidth = 5;
  g.strokeRect(22, 22, 980, 340);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // Engraved: a dark cut with a bright lip below it.
  const cut = (text: string, font: string, y: number, spacing: number) => {
    g.font = font;
    (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${spacing}px`;
    g.fillStyle = 'rgba(255,236,190,0.55)';
    g.fillText(text, 512, y + 2);
    g.fillStyle = '#3a2408';
    g.fillText(text, 512, y);
  };
  cut('THE HEAVENS DECLARE', '600 74px "EB Garamond", serif', 112, 10);
  cut('THE GLORY OF GOD', '600 74px "EB Garamond", serif', 200, 10);
  cut('PSALM 19:1', 'italic 400 46px "EB Garamond", serif', 290, 4);
  return texture(c);
}

export interface Telescope {
  group: THREE.Group;
  /** Turns on the pier. */
  fork: THREE.Group;
  /** Tilts in the fork. */
  tube: THREE.Group;
  plaque: THREE.Mesh;
  /** Points it now (degrees): azimuth like the dome, elevation above the horizon. */
  point(az: number, el: number): void;
  /** Where the eyepiece is, and which way is up out of it, in the world. */
  eyepiece(): { at: THREE.Vector3; up: THREE.Vector3; back: THREE.Vector3 };
}

/** Faces the plaque toward this azimuth (where you stand to look at the telescope). */
export function buildTelescope(plaqueAz: number): Telescope {
  const group = new THREE.Group();
  group.position.copy(CENTER);
  const iron = new THREE.MeshStandardMaterial({ color: '#1e2925', roughness: 0.5, metalness: 0.55 });
  const cream = new THREE.MeshStandardMaterial({ color: '#e6dfcd', roughness: 0.42, metalness: 0.08 });
  const brass = new THREE.MeshStandardMaterial({ color: '#c09350', roughness: 0.3, metalness: 0.9 });
  const black = new THREE.MeshStandardMaterial({ color: '#121316', roughness: 0.55, metalness: 0.3 });
  const cast = (m: THREE.Mesh) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  // The pier: flared at the foot, a brass band, a flange for the fork to turn on.
  const pier = cast(
    new THREE.Mesh(
      new THREE.LatheGeometry(
        [
          [0, 0.01],
          [0.6, 0.01],
          [0.6, 0.07],
          [0.5, 0.1],
          [0.43, 0.22],
          [0.38, 0.9],
          [0.37, 1.08],
          [0.5, 1.1],
          [0.5, 1.17],
          [0, 1.17],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        48,
      ),
      iron,
    ),
  );
  group.add(pier);
  const band = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.392, 0.392, 0.05, 48), brass));
  band.position.y = 0.97;
  group.add(band);
  // The plate, curved to the pier, facing where you'd stand.
  const a = THREE.MathUtils.degToRad(plaqueAz);
  const span = 0.75;
  const plaque = new THREE.Mesh(new THREE.CylinderGeometry(0.392, 0.396, 0.22, 24, 1, true, Math.PI - a - span / 2, span), new THREE.MeshStandardMaterial({ map: plate(), roughness: 0.32, metalness: 0.75 }));
  plaque.position.y = 0.7;
  group.add(plaque);

  // The fork: a turntable, a yoke, two tall arms holding the tube's trunnions.
  const fork = new THREE.Group();
  fork.position.y = 1.17;
  group.add(fork);
  const table = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.5, 0.1, 48), black));
  table.position.y = 0.05;
  fork.add(table);
  const yoke = cast(new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.16, 0.46), iron));
  yoke.position.y = 0.18;
  fork.add(yoke);
  for (const side of [-1, 1]) {
    const arm = cast(new THREE.Mesh(new THREE.BoxGeometry(0.12, PIVOT - 1.17 - 0.18, 0.36), iron));
    arm.position.set(side * 0.48, 0.18 + (PIVOT - 1.17 - 0.18) / 2, 0);
    fork.add(arm);
    const cap = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 32), iron));
    cap.rotation.z = Math.PI / 2;
    cap.position.set(side * 0.48, PIVOT - 1.17, 0);
    fork.add(cap);
    const boss = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 32), brass));
    boss.rotation.z = Math.PI / 2;
    boss.position.set(side * 0.56, PIVOT - 1.17, 0);
    fork.add(boss);
  }

  // The tube, along −z toward the sky end; it tilts about x.
  const tube = new THREE.Group();
  tube.position.y = PIVOT - 1.17;
  fork.add(tube);
  const along = (geo: THREE.BufferGeometry, mat: THREE.Material, z: number) => {
    const m = cast(new THREE.Mesh(geo, mat));
    m.rotation.x = Math.PI / 2;
    m.position.z = z;
    tube.add(m);
    return m;
  };
  along(new THREE.CylinderGeometry(0.25, 0.23, HALF * 2, 40), cream, 0);
  // The dew shield, a little wider, and the lens deep inside it.
  along(new THREE.CylinderGeometry(0.285, 0.285, 0.56, 40, 1, true), cream, -HALF - 0.24);
  const inside = along(new THREE.CylinderGeometry(0.278, 0.278, 0.55, 40, 1, true), new THREE.MeshStandardMaterial({ color: '#050506', roughness: 0.9, side: THREE.BackSide }), -HALF - 0.24);
  inside.castShadow = false;
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.25, 40), new THREE.MeshStandardMaterial({ color: '#0b1220', roughness: 0.05, metalness: 0.6, envMapIntensity: 2 }));
  lens.position.z = -HALF - 0.02;
  lens.rotation.y = Math.PI;
  tube.add(lens);
  for (const z of [-HALF - 0.52, -HALF + 0.02, -0.35, 0.55, HALF - 0.02]) along(new THREE.CylinderGeometry(0.262, 0.262, 0.05, 40), brass, z);
  // The back end: a cap, the focuser and a diagonal with the eyepiece pointing up.
  along(new THREE.CylinderGeometry(0.2, 0.24, 0.08, 32), black, HALF + 0.04);
  along(new THREE.CylinderGeometry(0.055, 0.055, 0.28, 20), brass, HALF + 0.2);
  const diag = cast(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), black));
  diag.position.z = HALF + 0.36;
  tube.add(diag);
  const eye = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.12, 20), black));
  eye.position.set(0, 0.1, HALF + 0.36);
  tube.add(eye);
  const eyeRing = cast(new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 8, 20), brass));
  eyeRing.rotation.x = Math.PI / 2;
  eyeRing.position.set(0, 0.16, HALF + 0.36);
  tube.add(eyeRing);
  // A focusing knob either side.
  for (const side of [-1, 1]) {
    const knob = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 16), brass));
    knob.rotation.z = Math.PI / 2;
    knob.position.set(side * 0.075, -0.02, HALF + 0.2);
    tube.add(knob);
  }
  // The finder, riding on top in two rings.
  const finder = new THREE.Group();
  finder.position.set(0.17, 0.3, 0.35);
  tube.add(finder);
  const fTube = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.75, 20), cream));
  fTube.rotation.x = Math.PI / 2;
  finder.add(fTube);
  for (const z of [-0.22, 0.22]) {
    const ring = cast(new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.01, 8, 20), brass));
    ring.position.z = z;
    finder.add(ring);
    const post = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.08, 8), brass));
    post.position.set(-0.04, -0.06, z);
    post.rotation.z = 0.5;
    finder.add(post);
  }

  const at = new THREE.Vector3();
  return {
    group,
    fork,
    tube,
    plaque,
    point(az, el) {
      fork.rotation.y = -THREE.MathUtils.degToRad(az);
      tube.rotation.x = THREE.MathUtils.degToRad(el);
    },
    eyepiece() {
      group.updateMatrixWorld(true);
      tube.localToWorld(at.set(0, 0.17, HALF + 0.36));
      const up = new THREE.Vector3(0, 1, 0).transformDirection(tube.matrixWorld);
      const back = new THREE.Vector3(0, 0, 1).transformDirection(tube.matrixWorld);
      return { at: at.clone(), up, back };
    },
  };
}
