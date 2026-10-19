// Where the map knows places by name, and the places too small to draw as
// outlines. Shared by the scratch map in the room and the simple page's map.

/** What people call some countries, against what the map data calls them. */
const ALIAS: Record<string, string> = {
  'United States': 'United States of America',
  USA: 'United States of America',
  'Czech Republic': 'Czechia',
  'Bosnia and Herzegovina': 'Bosnia and Herz.',
  'Dominican Republic': 'Dominican Rep.',
  'Democratic Republic of the Congo': 'Dem. Rep. Congo',
  'Central African Republic': 'Central African Rep.',
  'South Sudan': 'S. Sudan',
  'Equatorial Guinea': 'Eq. Guinea',
  'Solomon Islands': 'Solomon Is.',
  'Falkland Islands': 'Falkland Is.',
  "Côte d'Ivoire": "Côte d'Ivoire",
  Eswatini: 'eSwatini',
  'North Macedonia': 'Macedonia',
};

/** Places too small for the world outline, drawn as dots the way paper scratch maps do. */
export const SMALL_PLACES: Record<string, [number, number]> = {
  Singapore: [103.82, 1.35],
  'British Virgin Islands': [-64.62, 18.43],
  'U.S. Virgin Islands': [-64.83, 17.95],
  'French Polynesia': [-149.6, -17.65],
  Maldives: [73.5, 3.2],
  Mauritius: [57.55, -20.25],
  Seychelles: [55.45, -4.65],
  Malta: [14.4, 35.9],
  Bahrain: [50.55, 26.05],
  'Hong Kong': [114.17, 22.32],
  Barbados: [-59.55, 13.17],
  'Saint Lucia': [-60.98, 13.9],
  'Antigua and Barbuda': [-61.8, 17.08],
  Grenada: [-61.68, 12.12],
  'Cayman Islands': [-81.25, 19.3],
  'Turks and Caicos': [-71.8, 21.75],
  Aruba: [-69.97, 12.52],
  Curaçao: [-68.95, 12.17],
  Bermuda: [-64.75, 32.3],
  Samoa: [-172.1, -13.75],
  Tonga: [-175.2, -21.15],
  'Cook Islands': [-159.78, -21.23],
  Palau: [134.55, 7.5],
  Guam: [144.78, 13.45],
  'Cabo Verde': [-23.6, 15.1],
  Monaco: [7.42, 43.74],
  Andorra: [1.52, 42.55],
  Liechtenstein: [9.55, 47.16],
  'San Marino': [12.45, 43.94],
};

/** The name the map knows a place by, or null if it can't draw it. */
export function mapName(place: string, known: Set<string>): string | null {
  const name = ALIAS[place] ?? place;
  return known.has(name) || name in SMALL_PLACES ? name : null;
}
