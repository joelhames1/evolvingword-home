// Everything personal in the room lives here, so it's one file to edit.
//
// DRAFT: most of this is placeholder or a guess, written overnight to fill the
// room. Anything marked PLACEHOLDER or GUESS needs the real details.

/** The About card. GUESS, from the things in the room. */
export const ABOUT = {
  title: 'About',
  lines: [
    'I write poems in fountain pen, run races of every length, and keep a map of the places I have been.',
    'Evolving Word is my studio: a room for making things with the people I love, and a few things just for me.',
    'Everything here was built with AI as a collaborator. The mountains are code. So is the music on the tape deck.',
  ],
};

/** The watch on the desk. The dial carries no maker's name. */
export const WATCH = {
  label: 'The watch',
  note: 'A Swiss chronograph in the Portuguese style: two subdials, blued hands, the real time where you are. Press the top pusher to start the chronograph, the bottom one to reset it.',
};

/** Poems on the pad, written out in fountain pen. PLACEHOLDER: short drafts to replace with your own. */
export const POEMS: { title: string; lines: string[] }[] = [
  {
    title: 'Altitude',
    lines: ['The lake holds the mountain', 'the way a page holds a word:', 'upside down, and perfectly,', 'until the wind arrives.'],
  },
  {
    title: 'Mile Twenty',
    lines: ['Somewhere past the cheering', 'the road becomes a question.', 'My legs keep answering', 'in a language I forgot I knew.'],
  },
  {
    title: 'Ink',
    lines: ['I fill the pen at night', 'and promise it a sentence.', 'By morning we have both', 'kept half the promise.'],
  },
];

/** Race medals on the wall, shortest first. PLACEHOLDER: race names, years and times. */
export const MEDALS: { face: string; distance: string; race: string; year: string; time: string; ribbon: [string, string]; metal: 'gold' | 'silver' | 'bronze' }[] = [
  { face: '5K', distance: '5 kilometers', race: 'Your first 5K', year: 'Year', time: 'Finish time', ribbon: ['#c8102e', '#ffffff'], metal: 'bronze' },
  { face: '10K', distance: '10 kilometers', race: 'A 10K race', year: 'Year', time: 'Finish time', ribbon: ['#0b5394', '#f1c232'], metal: 'silver' },
  { face: '13.1', distance: 'Half marathon', race: 'A half marathon', year: 'Year', time: 'Finish time', ribbon: ['#38761d', '#ffffff'], metal: 'silver' },
  { face: '26.2', distance: 'Marathon', race: 'A marathon', year: 'Year', time: 'Finish time', ribbon: ['#20124d', '#e69138'], metal: 'gold' },
];

/** Framed diplomas. PLACEHOLDER: schools, degrees and years. */
export const DIPLOMAS: { school: string; degree: string; field: string; year: string; place: string }[] = [
  { school: 'Your University', degree: 'Bachelor of Arts', field: 'Your Major', year: 'Year', place: 'City, State' },
  { school: 'Your Graduate School', degree: 'Master of Arts', field: 'Your Field', year: 'Year', place: 'City, State' },
];

/** Work history, one Rolodex card each. PLACEHOLDER: to be filled in from LinkedIn. */
export const WORK: { company: string; role: string; years: string; note: string }[] = [
  { company: 'Current Company', role: 'Your Title', years: 'Year to now', note: 'One line on what you do here.' },
  { company: 'Previous Company', role: 'Your Title', years: 'Year to Year', note: 'One line on what you did here.' },
  { company: 'Earlier Company', role: 'Your Title', years: 'Year to Year', note: 'One line on what you did here.' },
  { company: 'First Job', role: 'Your Title', years: 'Year to Year', note: 'Where it started.' },
];

/** Countries already scratched off the map (names as the map knows them). GUESS. */
export const VISITED = ['United States of America', 'Canada', 'Mexico', 'United Kingdom', 'France', 'Switzerland', 'Italy', 'Germany', 'Austria'];

/** The running shoes by the desk. PLACEHOLDER. */
export const SHOES = {
  label: 'Running shoes',
  lines: ['Miles this year: a number goes here.', 'Favorite route: somewhere with a view.', 'Next race: on the calendar.'],
};

/** The treats. */
export const TREATS = {
  chocolate: 'Felchlin chocolate',
  coffee: 'Cappuccino',
};
