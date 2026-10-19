// Projects hang on a drying line along the left wall, behind the map, pegged up
// like fresh prints. The line is built along x and turned to run beside the wall.
import * as THREE from 'three';
import { PROJECTS, type Project } from './projects';
import { canvas, label, texture } from './textures';

export interface Hanging {
  project: Project;
  object: THREE.Object3D;
  /** Where the camera should look for this one. */
  focus: THREE.Vector3;
}

export interface Line {
  group: THREE.Group;
  items: Hanging[];
  /** The middle of the line, for the projects shot. */
  center: THREE.Vector3;
  tick(t: number): void;
}

const LEFT = new THREE.Vector3(0, 2.32, 0);
const RIGHT = new THREE.Vector3(1.55, 2.29, 0);
/** Where the line goes: a quarter turn, so the shirts face into the room from the left wall. */
const PLACE = { x: -2.12, z: 2.55, turn: Math.PI / 2 };

/** A T-shirt silhouette in a 512 x 600 box. */
function shirtPath(g: CanvasRenderingContext2D) {
  g.beginPath();
  g.moveTo(180, 20);
  g.quadraticCurveTo(256, 70, 332, 20);
  g.lineTo(440, 60);
  g.lineTo(505, 175);
  g.lineTo(420, 215);
  g.lineTo(392, 160);
  g.lineTo(400, 585);
  g.quadraticCurveTo(256, 600, 112, 585);
  g.lineTo(120, 160);
  g.lineTo(92, 215);
  g.lineTo(7, 175);
  g.lineTo(72, 60);
  g.closePath();
}

function shirtTexture(p: Project, art?: HTMLImageElement) {
  const [c, g] = canvas(512, 600);
  shirtPath(g);
  g.fillStyle = p.fabric;
  g.fill();
  g.save();
  shirtPath(g);
  g.clip();
  // Folds and a little shading so it reads as cloth, not a cutout.
  for (let i = 0; i < 9; i++) {
    const x = 90 + i * 40 + Math.sin(i * 2.3) * 12;
    const grad = g.createLinearGradient(x - 30, 0, x + 30, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, `rgba(0,0,0,${0.05 + (i % 3) * 0.025})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - 30, 140, 60, 460);
  }
  const shade = g.createLinearGradient(0, 0, 0, 600);
  shade.addColorStop(0, 'rgba(0,0,0,0.12)');
  shade.addColorStop(0.35, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.18)');
  g.fillStyle = shade;
  g.fillRect(0, 0, 512, 600);
  if (art) {
    const w = 230;
    const h = (art.height / art.width) * w;
    g.globalAlpha = 0.95;
    g.drawImage(art, 256 - w / 2, 150, w, h);
    g.globalAlpha = 1;
  } else {
    // An empty screen frame: the next print, not inked yet.
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.setLineDash([10, 10]);
    g.lineWidth = 4;
    g.strokeRect(156, 170, 200, 240);
    g.setLineDash([]);
    g.font = '400 44px "VT323"';
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.textAlign = 'center';
    g.fillText('NEXT', 256, 300);
  }
  g.restore();
  // The collar.
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(180, 22);
  g.quadraticCurveTo(256, 72, 332, 22);
  g.stroke();
  return texture(c);
}

function sag(t: number) {
  const p = LEFT.clone().lerp(RIGHT, t);
  p.y -= Math.sin(t * Math.PI) * 0.09;
  return p;
}

export function buildLine(): Line {
  const group = new THREE.Group();
  const ropeCurve = new THREE.CatmullRomCurve3(Array.from({ length: 12 }, (_, i) => sag(i / 11)));
  const ropeMat = new THREE.MeshStandardMaterial({ color: '#d8cbb0', roughness: 0.9 });
  const rope = new THREE.Mesh(new THREE.TubeGeometry(ropeCurve, 64, 0.004, 6), ropeMat);
  group.add(rope);
  for (const end of [LEFT, RIGHT]) {
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 2.8 - end.y, 6), ropeMat);
    hook.position.set(end.x, (2.8 + end.y) / 2, end.z);
    group.add(hook);
  }
  group.position.set(PLACE.x, 0, PLACE.z);
  group.rotation.y = PLACE.turn;
  group.updateMatrixWorld(true);

  const items: Hanging[] = [];
  const pegMat = new THREE.MeshStandardMaterial({ color: '#c49a62', roughness: 0.7 });
  PROJECTS.forEach((p, i) => {
    const at = 0.3 + i * 0.4;
    const top = sag(at);
    const pivot = new THREE.Group();
    pivot.position.copy(top);
    const mat = new THREE.MeshStandardMaterial({ map: shirtTexture(p), transparent: false, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.92 });
    const geo = new THREE.PlaneGeometry(0.62, 0.72, 16, 16);
    // A little bow, so it hangs like cloth rather than a card.
    const gp = geo.attributes.position;
    for (let k = 0; k < gp.count; k++) gp.setZ(k, -Math.pow(gp.getX(k) / 0.31, 2) * 0.03 + Math.sin(gp.getY(k) * 9) * 0.006);
    geo.computeVertexNormals();
    // Cut the texture's own alpha into the silhouette.
    const [ac, ag] = canvas(512, 600);
    ag.fillStyle = '#000';
    ag.fillRect(0, 0, 512, 600);
    ag.fillStyle = '#fff';
    shirtPath(ag);
    ag.fill();
    mat.alphaMap = texture(ac, { srgb: false });
    const shirt = new THREE.Mesh(geo, mat);
    shirt.position.y = -0.36;
    shirt.castShadow = true;
    pivot.add(shirt);
    if (p.art) {
      const img = new Image();
      img.onload = () => {
        mat.map = shirtTexture(p, img);
        mat.needsUpdate = true;
      };
      img.src = p.art;
    }
    for (const dx of [-0.17, 0.17]) {
      const peg = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.07, 0.016), pegMat);
      peg.position.set(dx, -0.015, 0.01);
      peg.castShadow = true;
      pivot.add(peg);
    }
    // A paper tag with the name.
    const tag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 0.08),
      new THREE.MeshStandardMaterial({
        map: label(
          [
            { text: p.title.toUpperCase(), font: '700 44px "Space Mono"', color: '#1d1a16', y: 50, align: 'center' },
            { text: p.status.toUpperCase(), font: '400 32px "Space Mono"', color: p.url ? '#b0302a' : '#7a7368', y: 104, align: 'center' },
          ],
          400,
          160,
          '#efe4cc',
        ),
        roughness: 0.9,
        side: THREE.DoubleSide,
      }),
    );
    tag.position.set(0.24, -0.1, 0.02);
    tag.rotation.z = -0.12;
    pivot.add(tag);
    pivot.userData.phase = i * 1.7;
    group.add(pivot);
    items.push({ project: p, object: pivot, focus: group.localToWorld(top.clone().add(new THREE.Vector3(0, -0.36, 0))) });
  });

  return {
    group,
    items,
    center: group.localToWorld(sag(0.5).add(new THREE.Vector3(0, -0.35, 0))),
    tick(t) {
      // A draft from the window: slow, uneven sway.
      for (const it of items) {
        const ph = it.object.userData.phase as number;
        it.object.rotation.x = Math.sin(t * 0.9 + ph) * 0.05 + Math.sin(t * 2.3 + ph * 2) * 0.015;
        it.object.rotation.y = Math.sin(t * 0.6 + ph) * 0.07;
      }
    },
  };
}
