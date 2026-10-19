// Turns public-domain texts into the reader's JSON, one file per book in public/books/.
// node scripts/books.mjs <dir with the raw .txt files>
//
// Sources (Project Gutenberg, via the GITenberg mirrors on GitHub):
//   1001.txt  Inferno, Longfellow's translation
//   1002.txt  Purgatorio, Longfellow's translation
//   1003.txt  Paradiso, Longfellow's translation
//   3160.txt  The Odyssey, Pope's translation
//   50852-0.txt  The Bells and Other Poems, Poe
//   246.txt   Rubáiyát of Omar Khayyám, FitzGerald (fifth edition)
// The Project Gutenberg headers, footers and license are stripped; only the
// public-domain text itself is kept.
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('usage: node scripts/books.mjs <dir>');
const out = 'public/books';
fs.mkdirSync(out, { recursive: true });

const read = (name) => {
  const raw = fs.readFileSync(path.join(dir, name), 'utf8').replace(/\r/g, '');
  const start = raw.search(/\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG.*\n/);
  const end = raw.search(/\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG/);
  const text = raw.slice(start < 0 ? 0 : raw.indexOf('\n', start) + 1, end < 0 ? raw.length : end);
  // Some files sign off again just before the end marker.
  const signoff = text.search(/^End of (the )?Project Gutenberg/im);
  return signoff < 0 ? text : text.slice(0, signoff);
};
/** Trims blank lines at the ends and squeezes runs of blank lines to one. */
const tidy = (lines) => {
  const t = lines.map((l) => l.replace(/\s+$/, ''));
  while (t.length && !t[0].trim()) t.shift();
  while (t.length && !t[t.length - 1].trim()) t.pop();
  return t.join('\n').replace(/\n{3,}/g, '\n\n');
};
const SMALL = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'with']);
const titleCase = (s) =>
  s
    .toLowerCase()
    .replace(/\.$/, '')
    .split(' ')
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.replace(/^(['"(]?)(\p{L})/u, (_, p, c) => p + c.toUpperCase())))
    .join(' ')
    .replace(/\bAe/g, 'Ae');
const write = (id, pieces) => {
  fs.writeFileSync(path.join(out, `${id}.json`), JSON.stringify({ pieces }));
  const kb = (fs.statSync(path.join(out, `${id}.json`)).size / 1024).toFixed(0);
  console.log(`${id}: ${pieces.length} pieces, ${kb} KB`);
};

// Dante: one piece per canto.
for (const [id, file, part] of [
  ['inferno', '1001.txt', 'Inferno'],
  ['purgatorio', '1002.txt', 'Purgatorio'],
  ['paradiso', '1003.txt', 'Paradiso'],
]) {
  const lines = read(file).split('\n');
  const pieces = [];
  let cur = null;
  for (const line of lines) {
    // Paradiso carries an appendix of notes after the last canto; the poem ends before it.
    if (line.trim() === 'APPENDIX') break;
    const m = line.match(new RegExp(`^${part}: Canto ([IVXL]+)$`));
    if (m) {
      cur = { title: `Canto ${m[1]}`, lines: [] };
      pieces.push(cur);
    } else if (cur) cur.lines.push(line);
  }
  write(
    id,
    pieces.map((p) => ({ title: p.title, text: tidy(p.lines) })),
  );
}

// The Odyssey: one piece per book, with Pope's prose argument as a note.
{
  const lines = read('3160.txt').split('\n');
  const pieces = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^BOOK ([IVXL]+)\.?$/);
    if (m) {
      cur = { book: m[1], lines: [] };
      pieces.push(cur);
    } else if (cur) cur.lines.push(line);
  }
  write(
    'odyssey',
    pieces.map((p) => {
      const l = p.lines;
      // Each book opens with an argument: a heading (not always), a title in
      // capitals, then a prose summary that runs to the first double blank line.
      let i = 0;
      const skip = () => {
        while (i < l.length && !l[i].trim()) i++;
      };
      skip();
      if (/^ARGUMENT\.?$/.test(l[i].trim())) {
        i++;
        skip();
      }
      // A capitals line with a blank after it is the book's title; with text
      // straight after it, it's just the argument's opening words set in capitals.
      let name = '';
      const note = [];
      if (!(l[i + 1] ?? '').trim()) {
        name = titleCase(l[i++].trim());
      } else {
        const caps = l[i++].trim().toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
        note.push(caps.replace(/\b(pallas|nausicaa|alcinous|ulysses|telemachus|penelope|euryclea|mercury|minerva|phaeacia|ithaca|eumaeus)\b/g, (w) => w[0].toUpperCase() + w.slice(1)));
      }
      skip();
      while (i < l.length && !(l[i].trim() === '' && (l[i + 1] ?? '').trim() === '')) note.push(l[i++].trim());
      const ae = (t) => t.replace(/\bAE(?=[a-z])/g, '\u00c6');
      return { title: `Book ${p.book}${name ? `: ${name}` : ''}`, note: ae(note.join(' ').replace(/\s+/g, ' ').trim()), text: ae(tidy(l.slice(i))) };
    }),
  );
}

// Poe: one piece per poem, from the all-capitals headings; italics marks dropped.
{
  const text = read('50852-0.txt');
  const lines = text.split('\n');
  const body = lines.findIndex((l) => l.trim() === '_THE BELLS_');
  const pieces = [];
  let cur = null;
  for (const line of lines.slice(body)) {
    const t = line.trim();
    const m = t.match(/^_([^a-z_]{3,})_$/) || (t === 'TAMERLANE' || t === 'TO HELEN' ? [t, t] : null);
    if (m && !/^[IVX]+\.$/.test(m[1])) {
      cur = { title: m[1], lines: [] };
      pieces.push(cur);
      continue;
    }
    if (!cur) continue;
    if (/^\[Illustration/.test(t)) {
      cur.skip = !t.endsWith(']');
      continue;
    }
    if (cur.skip) {
      if (t.endsWith(']')) cur.skip = false;
      continue;
    }
    cur.lines.push(line.replace(/_/g, ''));
  }
  // Poe's headings: "EULALIE--A SONG" becomes "Eulalie: A Song", and the dashes
  // standing in for names ("TO F----") become long dashes.
  const fix = (t) =>
    titleCase(t.replace(/([A-Z.])--(?=[A-Z])/g, '$1: ').replace(/-{2,}/g, '\u2014\u2014'))
      .replace(/: ([a-z])/g, (_, c) => `: ${c.toUpperCase()}`)
      .replace(/^To (?!the )([a-z])/, (_, c) => `To ${c.toUpperCase()}`)
      .replace(/^To The /, 'To the ')
      .replace(/ M\. l\. s\./i, ' M. L. S.')
      .replace(/\u2014\u2014([a-z])/g, (_, c) => `\u2014\u2014${c.toUpperCase()}`)
      .replace(/F\u2014\u2014S S\. O\u2014\u2014D/, 'F\u2014\u2014s S. O\u2014\u2014d');
  write(
    'poe',
    pieces.filter((p) => p.lines.some((l) => l.trim())).map((p) => ({ title: fix(p.title), text: tidy(p.lines).replace(/--/g, '—') })),
  );
}

// The Rubáiyát, fifth edition: the quatrains, numbered.
{
  const text = read('246.txt');
  const from = text.lastIndexOf('Fifth Edition');
  const to = text.indexOf('TAMAM.', from);
  const quatrains = text
    .slice(from + 'Fifth Edition'.length, to)
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b && !/^[IVXLC]+\.$/.test(b))
    .map((b) => (/^\*+$/.test(b) ? '*\u2003*\u2003*' : b.split('\n').map((l) => l.trim()).join('\n')));
  write('rubaiyat', [{ title: 'Rubáiyát', text: `${quatrains.join('\n\n').replace(/--/g, '—')}\n\nTamám.` }]);
}
