// The worlds you can step into, as the chooser shows them. Each one's 3D code
// (its kit) loads only when it's picked; see src/scene.ts.

export type WorldId = 'alps' | 'city' | 'tower' | 'monastery' | 'cell' | 'heavens';

export interface WorldInfo {
  id: WorldId;
  name: string;
  /** One line under the globe. */
  line: string;
  /** What's inside the globe on the chooser. */
  still: string;
  /** The color it glows when you're near it. */
  glow: string;
  /** What falls (or drifts) inside the glass. */
  weather: 'snow' | 'rain' | 'mist' | 'petals' | 'motes' | 'stars';
}

/** The chooser is laid out for at most this many globes (more only in the ?worlds=all preview). */
export const MAX_WORLDS = 5;

export const WORLDS: WorldInfo[] = [
  { id: 'alps', name: 'The Lake House', line: 'Dusk in the Alps, snow on the water.', still: '/worlds/alps.jpg', glow: '#f3a6c0', weather: 'snow' },
  { id: 'city', name: 'Night Studio', line: 'Five floors above a rainy neon city.', still: '/worlds/city.jpg', glow: '#ff4fb0', weather: 'rain' },
  { id: 'tower', name: 'The Tower', line: 'First light in the control tower.', still: '/worlds/tower.jpg', glow: '#ffb347', weather: 'mist' },
  { id: 'monastery', name: 'The Monastery', line: 'Afternoon over an Umbrian valley.', still: '/worlds/monastery.jpg', glow: '#f2c6a4', weather: 'petals' },
  { id: 'cell', name: 'The Living Word', line: 'A cell, lit like a cathedral.', still: '/worlds/cell.jpg', glow: '#ffb38a', weather: 'motes' },
  { id: 'heavens', name: 'The Heavens', line: 'Midnight in a mountaintop dome.', still: '/worlds/heavens.jpg', glow: '#a9bcff', weather: 'stars' },
];

export const isWorld = (id: string | null | undefined): id is WorldId => WORLDS.some((w) => w.id === id);

/** A list of world ids as someone wrote it, cleaned: known worlds only, each once, at most five. */
export function cleanShown(ids: unknown): WorldId[] | null {
  if (!Array.isArray(ids)) return null;
  const out: WorldId[] = [];
  for (const id of ids) if (typeof id === 'string' && isWorld(id) && !out.includes(id)) out.push(id);
  return out.length ? out.slice(0, MAX_WORLDS) : null;
}
