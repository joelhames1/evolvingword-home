// Hover and click on things in the room: whatever's under the pointer warms up
// a little, shows its name, and does its thing when clicked.
import * as THREE from 'three';

export interface Target {
  object: THREE.Object3D;
  label: string | (() => string);
  onClick: (hit: THREE.Intersection) => void;
  /** Skip the warm-up glow (shader materials, the CRT). */
  noGlow?: boolean;
}

export class Interactions {
  private ray = new THREE.Raycaster();
  private pointer = new THREE.Vector2(9, 9);
  private targets: Target[] = [];
  private hovered: Target | null = null;
  private saved = new Map<THREE.MeshStandardMaterial, THREE.Color>();
  enabled = true;

  constructor(
    private camera: THREE.Camera,
    private dom: HTMLElement,
    private tooltip: HTMLElement,
  ) {
    dom.addEventListener('pointermove', (e) => {
      this.pointer.set((e.clientX / dom.clientWidth) * 2 - 1, -(e.clientY / dom.clientHeight) * 2 + 1);
      tooltip.style.transform = `translate(${e.clientX + 16}px, ${e.clientY + 14}px)`;
    });
    dom.addEventListener('pointerleave', () => this.pointer.set(9, 9));
    dom.addEventListener('click', () => {
      if (!this.enabled) return;
      const hit = this.pick();
      if (hit) hit.target.onClick(hit.hit);
    });
  }

  add(t: Target) {
    this.targets.push(t);
  }

  private pick(): { target: Target; hit: THREE.Intersection } | null {
    if (Math.abs(this.pointer.x) > 1) return null;
    this.ray.setFromCamera(this.pointer, this.camera);
    let best: { target: Target; hit: THREE.Intersection } | null = null;
    for (const target of this.targets) {
      const hit = this.ray.intersectObject(target.object, true)[0];
      if (hit && (!best || hit.distance < best.hit.distance)) best = { target, hit };
    }
    return best;
  }

  private glow(t: Target, on: boolean) {
    if (t.noGlow) return;
    t.object.traverse((o) => {
      const mats = (o as THREE.Mesh).material;
      for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) {
        if (!(m instanceof THREE.MeshStandardMaterial)) continue;
        if (on) {
          if (!this.saved.has(m)) this.saved.set(m, m.emissive.clone());
          m.emissive.set('#3a2412');
        } else if (this.saved.has(m)) {
          m.emissive.copy(this.saved.get(m)!);
          this.saved.delete(m);
        }
      }
    });
  }

  update() {
    const hit = this.enabled ? this.pick() : null;
    const t = hit?.target ?? null;
    if (t !== this.hovered) {
      if (this.hovered) this.glow(this.hovered, false);
      if (t) this.glow(t, true);
      this.hovered = t;
      this.dom.style.cursor = t ? 'pointer' : '';
      this.tooltip.classList.toggle('show', !!t);
    }
    if (t) this.tooltip.textContent = typeof t.label === 'function' ? t.label() : t.label;
  }
}
