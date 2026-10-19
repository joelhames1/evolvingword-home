// The worlds you can step into, as the chooser shows them. Each one's 3D code
// (its kit) loads only when it's picked; see src/scene.ts.

export type WorldId = 'alps' | 'city';

export interface WorldInfo {
  id: WorldId;
  name: string;
  /** One line under the globe. */
  line: string;
  /** What's inside the globe on the chooser. */
  still: string;
  /** The color it glows when you're near it. */
  glow: string;
  /** What falls inside the glass. */
  weather: 'snow' | 'rain';
}

export const WORLDS: WorldInfo[] = [
  { id: 'alps', name: 'The Lake House', line: 'Dusk in the Alps, snow on the water.', still: '/worlds/alps.jpg', glow: '#f3a6c0', weather: 'snow' },
  { id: 'city', name: 'Night Studio', line: 'Five floors above a rainy neon city.', still: '/worlds/city.jpg', glow: '#ff4fb0', weather: 'rain' },
];

export const isWorld = (id: string | null | undefined): id is WorldId => WORLDS.some((w) => w.id === id);
