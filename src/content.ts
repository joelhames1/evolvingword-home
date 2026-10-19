// Everything personal in the room lives here, so it's one file to edit.
//
// The About lines are still a guess; everything else is real.

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

/** Poems on the pad, written out in fountain pen. Untitled; an empty line is a stanza break. */
export const POEMS: { title?: string; lines: string[] }[] = [
  {
    lines: [
      'If inspiration demands reconciliation',
      'I submit myself before its measured judgment.',
      'With desperation I search for a reason',
      'that it would bestow upon me the fickle',
      'allowance of fated Love above all others.',
      'And I taste the tangible jealousy of them,',
      'those whose gaze suggests abandonment,',
      'while my tranquility spills into the world',
    ],
  },
  {
    lines: [
      'In time we find we are aligned',
      'In body, soul and in our mind',
      'But first we thirst so unrehearsed',
      'For a life that\u2019s rife, and uncoerced.',
      '',
      'A course whose source is unendorsed',
      'Unknown to all but with such force',
      'We make our choice and then rejoice',
      'And give our hopes a sprightly voice',
      '',
      'With might we fight all through the night',
      'For causes noble, a thankless plight',
      'Our paths are set without a threat',
      'We owe our futures handsome debt',
    ],
  },
  {
    lines: [
      'We search the tidepools of our soul',
      'To find our hearts two halves, one whole',
      'We seek another to whom we bind',
      'Our heart, our soul, our body, our mind',
      'And by the quick we take a stroll',
      'Never lost, or sad and always kind',
      '',
      'We ebb and flow in rhythmic beat',
      'In some ways torn, in some complete',
      '\u2019Til that we seek is close we feel',
      'We stumble, fall and then we kneel',
      'Hands clasped tight, wet with heat',
      'Longing stares till hearts do heal',
    ],
  },
  {
    lines: [
      'These thoughts I have they scatter',
      'The remnants of a thousand iterations',
      'Of a thousand palpitations',
      'I am convinced they no longer matter',
      '',
      'They are ethereal',
      'Without substance, they are the voluminous',
      'gas of a mind less luminous',
      'And increasingly immaterial',
      '',
      'My hands burn with the attempts',
      'To gather the shattered fragments',
      'And piece together at least a better',
      'Understanding of my torments',
    ],
  },
  {
    lines: [
      'The tranquil beating of your heart belies a storm within',
      'I sense unease of countless fees owed to fated whim',
      'My presence here may prove too near when studied from afar',
      'But foolish thoughts are much too fraught with motives too bizarre',
      '',
      'Abandoned hope suggests a scope of motivations true',
      'When filled with these hilarities and mocking senses too',
      'We bow before the shambled door to beg for mercy please',
      'Relent our souls of unclear goals and rise us from our knees',
    ],
  },
];

/** What to call a poem: its title, or its first line. */
export const poemName = (p: { title?: string; lines: string[] }) => p.title ?? p.lines[0];

/** Race medals on the wall, shortest first: the best race at each distance, from Strava. */
export const MEDALS: { face: string; distance: string; race: string; year: string; time: string; note: string; ribbon: [string, string]; metal: 'gold' | 'silver' | 'bronze' }[] = [
  { face: '5K', distance: '5K', race: 'Gig Harbor Turkey Trot', year: '2024', time: '26:16', note: 'A personal best, out of two dozen 5Ks since 2022.', ribbon: ['#c8102e', '#ffffff'], metal: 'bronze' },
  { face: '10K', distance: '10K', race: 'Hot Chocolate 10K, Seattle', year: '2024', time: '53:53', note: 'A personal best. The first 10K, in 2023, came in just over the hour.', ribbon: ['#5a3220', '#f1c232'], metal: 'silver' },
  { face: '13.1', distance: 'Half marathon', race: 'Long Beach Half Marathon', year: '2024', time: '2:11:57', note: 'The first half. Santa Barbara followed in 2025.', ribbon: ['#0b5394', '#ffffff'], metal: 'silver' },
  { face: '26.2', distance: 'Marathon', race: 'Los Angeles Marathon', year: '2026', time: '5:42:00', note: 'The first marathon.', ribbon: ['#20124d', '#e69138'], metal: 'gold' },
];

/** Framed diplomas. */
export const DIPLOMAS: { school: string; degree: string; field: string; year: string; place: string; honors?: string }[] = [
  { school: 'University of California, Irvine', degree: 'Bachelor of Arts', field: 'Psychology and Social Behavior', year: '1995', place: 'Irvine, California', honors: 'Campuswide Honors Program' },
  { school: 'University of Illinois Urbana-Champaign', degree: 'Master of Education', field: 'Educational Psychology', year: '2011', place: 'Urbana-Champaign, Illinois' },
];

/** Work history, newest first, one Rolodex card each. From LinkedIn. */
export const WORK: { company: string; role: string; years: string; note: string }[] = [
  { company: 'ParentSquare', role: 'SVP, Product', years: '2026 to now', note: 'Simplifying how schools and families connect.' },
  { company: 'Subject', role: 'Chief Product Officer', years: '2023 to 2026', note: 'Product, engineering, design, data and education.' },
  { company: 'Paper', role: 'Chief Product Officer', years: '2021 to 2022', note: 'Support for every student, whenever they need it.' },
  { company: 'PowerSchool', role: 'VP Product', years: '2019 to 2021', note: 'One platform for students, teachers and families.' },
  { company: 'Schoology', role: 'VP Product', years: '2017 to 2019', note: 'Learning experiences for students everywhere.' },
  { company: 'PowerSchool', role: 'VP Product', years: '2017', note: 'Bringing the SunGard K-12 products into the family.' },
  { company: 'SunGard K-12 Education', role: 'VP Product', years: '2015 to 2017', note: 'An $80 million portfolio, from refactors to mobile.' },
  { company: 'KualiCo', role: 'Product', years: '2014 to 2015', note: 'Startup software for higher education.' },
  { company: 'SunGard K-12', role: 'Director of Product Management', years: '2012 to 2014', note: 'Student systems, assessment, and the team behind them.' },
  { company: 'Tamalpais Union High School District', role: 'Senior Director, Instructional Technology', years: '2004 to 2011', note: 'Built the IT team; brought online learning to class.' },
];

/** Countries already scratched off the map, as you'd say them. More to come. */
export const VISITED = [
  'United States',
  'Canada',
  'Mexico',
  'Bahamas',
  'British Virgin Islands',
  'Jamaica',
  'Ecuador',
  'Brazil',
  'French Polynesia',
  'Fiji',
  'South Korea',
  'China',
  'Vietnam',
  'Singapore',
  'Indonesia',
  'Nepal',
  'Sri Lanka',
  'Turkey',
  'Austria',
  'United Arab Emirates',
  'Italy',
  'Spain',
  'Portugal',
  'France',
  'Switzerland',
  'Germany',
];

/** The running shoes by the desk. Distances from Strava. */
export const SHOES = {
  label: 'Nike Vomero Plus',
  lines: ['On the second pair now, about 595 miles in.', '335 miles run in 2026, as of October.'],
};

/** The treats. */
export const TREATS = {
  chocolate: 'Felchlin chocolate',
  coffee: 'Cappuccino',
};
