// A bowl of chocolate discs you can eat one at a time, and a cappuccino you can
// drink in three sips. Both refill, because this is a nice studio.
import * as THREE from 'three';
import { canvas, glow, texture } from '../textures';

export interface Treats {
  group: THREE.Group;
  bowl: THREE.Object3D;
  discs: THREE.Mesh[];
  cup: THREE.Object3D;
  /** Eats a disc; returns how many are left. */
  eat(disc: THREE.Mesh): number;
  refill(): void;
  left(): number;
  /** Takes a sip; returns sips left (0 = empty). Refills when already empty. */
  sip(): number;
  sipsLeft(): number;
  tick(t: number, dt: number): void;
}

const DISCS = 7;
const SIPS = 3;

function discTexture() {
  const [c, g] = canvas(256, 256);
  const grad = g.createRadialGradient(110, 100, 10, 128, 128, 128);
  grad.addColorStop(0, '#74432a');
  grad.addColorStop(1, '#3a1d0f');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  // The pressed ring and a little logo dot, like couverture discs.
  g.strokeStyle = 'rgba(150,95,60,0.7)';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(128, 128, 92, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = 'rgba(120,70,40,0.5)';
  g.beginPath();
  g.arc(128, 128, 18, 0, Math.PI * 2);
  g.fill();
  return texture(c);
}

function foamTexture(level: number) {
  const [c, g] = canvas(512, 512);
  // Crema at the rim, foam in the middle, a rosetta poured through it.
  const grad = g.createRadialGradient(256, 256, 40, 256, 256, 256);
  grad.addColorStop(0, '#f3e6d0');
  grad.addColorStop(0.62, '#e9d3b2');
  grad.addColorStop(0.8, '#9a5f32');
  grad.addColorStop(1, '#5a3218');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  if (level > 0) {
    g.fillStyle = 'rgba(154,95,50,0.85)';
    g.strokeStyle = 'rgba(154,95,50,0.9)';
    // A rosetta: nested leaves narrowing up a stem.
    for (let i = 0; i < 7; i++) {
      const y = 360 - i * 34;
      const w = 120 - i * 14;
      g.beginPath();
      g.ellipse(256, y, w, 18, 0, Math.PI, 0);
      g.lineWidth = 9;
      g.stroke();
    }
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(256, 410);
    g.lineTo(256, 130);
    g.stroke();
    g.beginPath();
    g.arc(256, 130, 22, 0, Math.PI * 2);
    g.fill();
    if (level < SIPS) {
      // Drunk from: the art smears and the foam thins.
      g.fillStyle = `rgba(233,211,178,${0.25 * (SIPS - level)})`;
      g.fillRect(0, 0, 512, 512);
    }
  } else {
    // Empty: dark dregs and a ring of foam.
    g.fillStyle = '#3a1d0d';
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(233,211,178,0.8)';
    g.lineWidth = 26;
    g.beginPath();
    g.arc(256, 256, 226, 0, Math.PI * 2);
    g.stroke();
  }
  return texture(c);
}

export function buildTreats(): Treats {
  const group = new THREE.Group();
  const porcelain = new THREE.MeshStandardMaterial({ color: '#f1ede4', roughness: 0.25, metalness: 0 });

  // The bowl: white glaze with a blue rim, on the right of the desk.
  const bowl = new THREE.Group();
  const bowlProfile = [
    [0, 0.002],
    [0.03, 0],
    [0.034, 0.003],
    [0.058, 0.026],
    [0.061, 0.03],
    [0.057, 0.03],
    [0.052, 0.025],
    [0.028, 0.006],
    [0, 0.006],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const bowlMesh = new THREE.Mesh(new THREE.LatheGeometry(bowlProfile, 48), porcelain);
  bowlMesh.castShadow = true;
  bowlMesh.receiveShadow = true;
  bowl.add(bowlMesh);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.059, 0.0018, 8, 48), new THREE.MeshStandardMaterial({ color: '#2b4a8a', roughness: 0.3 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.03;
  bowl.add(rim);
  group.add(bowl);

  const discTex = discTexture();
  const discs: THREE.Mesh[] = [];
  const homes: THREE.Vector3[] = [];
  const spin: number[] = [];
  for (let i = 0; i < DISCS; i++) {
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: discTex, roughness: 0.28, metalness: 0.05 });
    const side = new THREE.MeshStandardMaterial({ color: '#3a1d0f', roughness: 0.4 });
    // Thin couverture discs, one in the middle and the rest leaning up the sides.
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.0032, 28), [side, mat, mat]);
    const a = (i / (DISCS - 1)) * Math.PI * 2 + 0.3;
    const rr = i === 0 ? 0 : 0.019 + (i % 2) * 0.004;
    const home = new THREE.Vector3(Math.cos(a) * rr, 0.0085 + rr * 0.32 + (i === 0 ? 0.002 : 0), Math.sin(a) * rr);
    d.position.copy(home);
    // Tilted to lie on the bowl's slope.
    d.rotation.set(-Math.sin(a) * rr * 14, Math.random() * 6, Math.cos(a) * rr * 14, 'XZY');
    d.castShadow = true;
    discs.push(d);
    homes.push(home);
    spin.push(Math.random() * 6);
    bowl.add(d);
  }
  const eaten = new Set<THREE.Mesh>();
  const leaving = new Map<THREE.Mesh, number>();
  const arriving = new Map<THREE.Mesh, number>();

  // The cappuccino: cup, saucer, handle, spoon, foam.
  const cup = new THREE.Group();
  const saucer = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        [0, 0.001],
        [0.05, 0],
        [0.07, 0.008],
        [0.072, 0.011],
        [0.068, 0.01],
        [0.05, 0.004],
        [0, 0.005],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
      48,
    ),
    porcelain,
  );
  saucer.castShadow = true;
  saucer.receiveShadow = true;
  cup.add(saucer);
  const cupProfile = [
    [0, 0.005],
    [0.022, 0.005],
    [0.028, 0.012],
    [0.042, 0.05],
    [0.045, 0.068],
    [0.0425, 0.068],
    [0.0395, 0.05],
    [0.025, 0.014],
    [0, 0.013],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const cupMesh = new THREE.Mesh(new THREE.LatheGeometry(cupProfile, 48), porcelain);
  cupMesh.castShadow = true;
  cup.add(cupMesh);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.0045, 10, 24, Math.PI * 1.25), porcelain);
  handle.position.set(0.048, 0.042, 0);
  handle.rotation.z = -Math.PI * 0.62;
  cup.add(handle);
  const spoon = new THREE.Mesh(new THREE.CapsuleGeometry(0.0022, 0.07, 4, 8), new THREE.MeshStandardMaterial({ color: '#d0d3d8', metalness: 1, roughness: 0.25 }));
  spoon.rotation.set(Math.PI / 2, 0, 0.9);
  spoon.position.set(0.0, 0.011, 0.052);
  cup.add(spoon);
  let sips = SIPS;
  const foamMat = new THREE.MeshStandardMaterial({ map: foamTexture(SIPS), roughness: 0.75 });
  const foam = new THREE.Mesh(new THREE.CircleGeometry(1, 48), foamMat);
  foam.rotation.x = -Math.PI / 2;
  cup.add(foam);
  // The surface sits lower, and narrower, as the cup empties.
  const setLevel = (y: number) => {
    foam.position.y = y;
    const radius = y > 0.05 ? 0.0395 + ((y - 0.05) / 0.018) * 0.003 : 0.025 + ((y - 0.014) / 0.036) * 0.0145;
    foam.scale.setScalar(radius);
  };
  let level = 0.064;
  let levelAim = level;
  setLevel(level);
  const steamTex = glow('rgba(255,255,255,0.6)');
  const steam: THREE.Sprite[] = [];
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 }));
    s.userData.phase = i / 10;
    steam.push(s);
    cup.add(s);
  }
  group.add(cup);

  return {
    group,
    bowl,
    discs,
    cup,
    eat(d) {
      if (eaten.has(d)) return DISCS - eaten.size;
      eaten.add(d);
      leaving.set(d, 0);
      return DISCS - eaten.size;
    },
    refill() {
      for (const d of eaten) {
        d.visible = true;
        d.scale.setScalar(1);
        arriving.set(d, 0);
      }
      eaten.clear();
    },
    left: () => DISCS - eaten.size,
    sip() {
      if (sips === 0) {
        sips = SIPS;
        levelAim = 0.064;
      } else {
        sips--;
        levelAim = sips === 0 ? 0.016 : 0.064 - (SIPS - sips) * 0.014;
      }
      foamMat.map?.dispose();
      foamMat.map = foamTexture(sips);
      foamMat.needsUpdate = true;
      return sips;
    },
    sipsLeft: () => sips,
    tick(t, dt) {
      // Eaten: lift toward the visitor, shrink, gone.
      for (const [d, k0] of leaving) {
        const k = k0 + dt * 2.2;
        leaving.set(d, k);
        d.position.y = homes[discs.indexOf(d)].y + k * 0.12;
        d.position.z = homes[discs.indexOf(d)].z + k * 0.08;
        d.rotation.x += dt * 4;
        d.scale.setScalar(Math.max(0.001, 1 - k));
        if (k >= 1) {
          d.visible = false;
          leaving.delete(d);
        }
      }
      // Refilled: drop back into the bowl.
      for (const [d, k0] of arriving) {
        const k = Math.min(1, k0 + dt * 1.8);
        arriving.set(d, k);
        const home = homes[discs.indexOf(d)];
        d.position.set(home.x, home.y + (1 - k * k) * 0.1, home.z);
        if (k >= 1) arriving.delete(d);
      }
      for (let i = 0; i < discs.length; i++) if (!leaving.has(discs[i])) discs[i].rotation.y = spin[i];
      level += (levelAim - level) * Math.min(1, dt * 4);
      setLevel(level);
      const hot = sips > 0 ? 1 : 0.2;
      for (const s of steam) {
        const k = (t * 0.1 + (s.userData.phase as number)) % 1;
        s.position.set(Math.sin(k * 7 + (s.userData.phase as number) * 9) * 0.012, 0.075 + k * 0.18, Math.cos(k * 5) * 0.008);
        s.scale.setScalar(0.025 + k * 0.06);
        (s.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * 0.09 * hot;
      }
    },
  };
}
