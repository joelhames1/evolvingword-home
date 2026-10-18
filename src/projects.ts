// What hangs on the line. Add a project here and it gets a print on the line,
// a card, a CRT entry and a place in the plain version of the page.

export interface Project {
  id: string;
  title: string;
  /** One line, under the title. */
  tagline: string;
  /** A few sentences for the card. */
  blurb: string;
  status: string;
  year: string;
  url?: string;
  /** The picture printed on the hanging shirt, from public/. */
  art?: string;
  /** Shirt color on the line. */
  fabric: string;
}

export const PROJECTS: Project[] = [
  {
    id: 'our-studio',
    title: 'Our Studio',
    tagline: 'Design together. Print together.',
    blurb:
      'Swipe through designs made for your occasion, change anything just by saying it, try it on in 3D, and when everyone loves it, get print-ready files and a printer nearby. Invite only.',
    status: 'Open',
    year: '2026',
    url: 'https://studio.evolvingword.com',
    art: '/projects/our-studio.png',
    fabric: '#f3efe6',
  },
  {
    id: 'next',
    title: 'Next print',
    tagline: 'On the press.',
    blurb: 'Something new is being inked. Check back soon.',
    status: 'Coming soon',
    year: '2027',
    fabric: '#2b2f3a',
  },
];
