// A scratch-off map of the world on the left wall: gold foil over a bright
// map, with the countries already visited scratched through. Drag across it
// in close-up to scratch some more; the foil remembers, per visitor.
import * as THREE from 'three';
import { geoEquirectangular, geoGraticule10, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';
import { VISITED } from '../content';
import { canvas, texture } from '../textures';

export interface ScratchMap {
  group: THREE.Group;
  /** The map surface: drag to scratch, hover for names. */
  surface: THREE.Mesh;
  /** Scratches at a point on the map (uv, 0..1). */
  scratch(u: number, v: number): void;
  /** The country under a point on the map, if any. */
  countryAt(u: number, v: number): string | null;
  /** How many countries are showing through, roughly. */
  visited(): number;
  tick(): void;
}

const W = 2048;
const H = 1024;
const MAP_W = 1.5;
const MAP_H = 0.75;
const KEY = 'ew.scratch.v1';

type Country = Feature<Geometry, { name: string }>;

export function buildMap(): ScratchMap {
  const group = new THREE.Group();
  const topo = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
  const countries = (feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>).features as Country[];
  const projection = geoEquirectangular().fitExtent(
    [
      [20, 20],
      [W - 20, H - 20],
    ],
    { type: 'Sphere' },
  );

  // Underneath: a bright, slightly retro political map.
  const [bc, bg] = canvas(W, H);
  bg.fillStyle = '#8fc6d6';
  bg.fillRect(0, 0, W, H);
  const path = geoPath(projection, bg);
  bg.strokeStyle = 'rgba(255,255,255,0.35)';
  bg.lineWidth = 1;
  bg.beginPath();
  path(geoGraticule10());
  bg.stroke();
  const palette = ['#f4b860', '#e66b5b', '#7fbf6a', '#c58fd6', '#f2d16b', '#6fa8dc', '#e98fb2', '#9bd4a4'];
  countries.forEach((c, i) => {
    bg.fillStyle = palette[i % palette.length];
    bg.beginPath();
    path(c);
    bg.fill();
    bg.strokeStyle = 'rgba(40,30,20,0.55)';
    bg.lineWidth = 1.2;
    bg.stroke();
  });

  // On top: gold foil with embossed outlines, a title and a compass rose.
  const [fc, fg] = canvas(W, H);
  const foil = fg.createLinearGradient(0, 0, W, H);
  foil.addColorStop(0, '#b8923e');
  foil.addColorStop(0.35, '#f2d98c');
  foil.addColorStop(0.55, '#c9a24c');
  foil.addColorStop(0.8, '#f0d48a');
  foil.addColorStop(1, '#a8812f');
  fg.fillStyle = foil;
  fg.fillRect(0, 0, W, H);
  for (let i = 0; i < 30000; i++) {
    fg.fillStyle = `rgba(${Math.random() < 0.5 ? '255,250,220' : '90,60,10'},${Math.random() * 0.08})`;
    fg.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  const fpath = geoPath(projection, fg);
  fg.strokeStyle = 'rgba(90,62,15,0.7)';
  fg.lineWidth = 1.6;
  for (const c of countries) {
    fg.beginPath();
    fpath(c);
    fg.stroke();
  }
  fg.fillStyle = 'rgba(90,62,15,0.85)';
  fg.font = '700 34px "Space Mono", monospace';
  fg.textAlign = 'left';
  fg.fillText('SCRATCH MAP OF THE WORLD', 60, H - 60);

  // Every country painted in its own color at half size, so any pixel can say
  // whose it is. The three channels check each other, which throws out the
  // blended pixels along coastlines.
  const IW = W / 2;
  const IH = H / 2;
  const [, ig] = canvas(IW, IH);
  ig.scale(0.5, 0.5);
  const ipath = geoPath(projection, ig);
  countries.forEach((c, i) => {
    ig.fillStyle = `rgb(${i + 1},${254 - i},${((i + 1) * 37) & 255})`;
    ig.beginPath();
    ipath(c);
    ig.fill();
  });
  const owner = new Int16Array(IW * IH).fill(-1);
  const size = new Uint32Array(countries.length);
  const ids = ig.getImageData(0, 0, IW, IH).data;
  for (let p = 0; p < owner.length; p++) {
    const i = ids[p * 4] - 1;
    if (i >= 0 && i < countries.length && ids[p * 4 + 1] === 254 - i && ids[p * 4 + 2] === ((i + 1) * 37 & 255)) {
      owner[p] = i;
      size[i]++;
    }
  }

  // What's been scratched: an alpha mask for the picture, kept small enough to
  // remember, and the same at half size in plain memory for counting.
  const [mc, mg] = canvas(W, H);
  const [sc, sg] = canvas(512, 256);
  const cleared = new Uint8Array(IW * IH);
  const restore = () => {
    try {
      const saved = localStorage.getItem(KEY);
      if (!saved) return;
      const img = new Image();
      img.onload = () => {
        mg.drawImage(img, 0, 0, W, H);
        dirty = true;
        const [, rg] = canvas(IW, IH);
        rg.drawImage(img, 0, 0, IW, IH);
        const a = rg.getImageData(0, 0, IW, IH).data;
        for (let p = 0; p < cleared.length; p++) if (a[p * 4 + 3] > 128) cleared[p] = 1;
      };
      img.src = saved;
    } catch {
      // Nothing remembered, or nowhere to remember it.
    }
  };
  // The countries already visited, scratched clean to start with.
  mg.fillStyle = '#fff';
  const mpath = geoPath(projection, mg);
  const been = new Set<number>();
  countries.forEach((c, i) => {
    if (!VISITED.includes(c.properties.name)) return;
    mg.beginPath();
    mpath(c);
    mg.fill();
    been.add(i);
  });
  for (let p = 0; p < owner.length; p++) if (been.has(owner[p])) cleared[p] = 1;
  let dirty = true;
  restore();

  const [oc, og] = canvas(W, H);
  const tex = texture(oc);
  const compose = () => {
    og.globalCompositeOperation = 'source-over';
    og.drawImage(fc, 0, 0);
    // Cut the foil where it's been scratched, then lay the map under the holes.
    og.globalCompositeOperation = 'destination-out';
    og.drawImage(mc, 0, 0);
    og.globalCompositeOperation = 'destination-over';
    og.drawImage(bc, 0, 0);
    og.globalCompositeOperation = 'source-over';
    tex.needsUpdate = true;
  };

  // The frame: thin black, with a little depth.
  const frameMat = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.5 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(MAP_W + 0.06, MAP_H + 0.06, 0.03), frameMat);
  frame.castShadow = true;
  group.add(frame);
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, MAP_H), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.2 }));
  surface.position.z = 0.0155;
  group.add(surface);

  // A brass picture light over the top, throwing a warm wash down the foil.
  const brass = new THREE.MeshStandardMaterial({ color: '#b08a3e', metalness: 0.9, roughness: 0.35 });
  const lampBar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 20, 1, false, 0, Math.PI), brass);
  lampBar.rotation.set(0, 0, Math.PI / 2);
  lampBar.position.set(0, MAP_H / 2 + 0.065, 0.12);
  group.add(lampBar);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.13, 8), brass);
  arm.rotation.x = Math.PI / 2;
  arm.position.set(0, MAP_H / 2 + 0.065, 0.06);
  group.add(arm);
  const pictureLight = new THREE.SpotLight('#ffcf8a', 2.2, 2.6, 1.1, 1, 1.2);
  pictureLight.position.set(0, MAP_H / 2 + 0.06, 0.28);
  pictureLight.target.position.set(0, -0.35, 0);
  group.add(pictureLight, pictureLight.target);

  let saveTimer = 0;
  const save = () => {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      try {
        sg.clearRect(0, 0, 512, 256);
        sg.drawImage(mc, 0, 0, 512, 256);
        localStorage.setItem(KEY, sc.toDataURL('image/png'));
      } catch {
        // Private windows can't remember; that's fine.
      }
    }, 800);
  };

  const countryAt = (u: number, v: number) => {
    const x = Math.floor(u * IW);
    const y = Math.floor((1 - v) * IH);
    if (x < 0 || y < 0 || x >= IW || y >= IH) return null;
    const i = owner[y * IW + x];
    return i >= 0 ? countries[i].properties.name : null;
  };

  return {
    group,
    surface,
    scratch(u, v) {
      const x = u * W;
      const y = (1 - v) * H;
      mg.fillStyle = '#fff';
      // A ragged coin-edge scratch.
      for (let i = 0; i < 6; i++) {
        const cx = x + (Math.random() - 0.5) * 18;
        const cy = y + (Math.random() - 0.5) * 18;
        const r = 10 + Math.random() * 8;
        mg.beginPath();
        mg.arc(cx, cy, r, 0, Math.PI * 2);
        mg.fill();
        // The same circle in the half-size tally.
        const hr = r / 2;
        for (let py = Math.max(0, Math.floor(cy / 2 - hr)); py <= Math.min(IH - 1, cy / 2 + hr); py++) {
          for (let px = Math.max(0, Math.floor(cx / 2 - hr)); px <= Math.min(IW - 1, cx / 2 + hr); px++) {
            if ((px - cx / 2) ** 2 + (py - cy / 2) ** 2 <= hr * hr) cleared[py * IW + px] = 1;
          }
        }
      }
      dirty = true;
      save();
    },
    countryAt,
    visited() {
      // A country counts once a good part of it shows through the foil.
      const clear = new Uint32Array(countries.length);
      for (let p = 0; p < owner.length; p++) if (owner[p] >= 0 && cleared[p]) clear[owner[p]]++;
      return countries.filter((_, i) => size[i] > 0 && clear[i] >= size[i] * 0.4).length;
    },
    tick() {
      if (dirty) {
        dirty = false;
        compose();
      }
    },
  };
}
