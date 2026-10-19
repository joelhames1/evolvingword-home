// The book reader: a two-page spread over the scene, turned with the arrow keys
// or the corners. Long books open on a contents page you can click through, and
// each book remembers where you left it. Poems start on a fresh page; long
// stanzas and verse paragraphs run over.
import type { Book } from './books';

export interface Reader {
  open(book: Book): void;
  close(): void;
  isOpen(): boolean;
  /** Turns a spread; returns false at either end. */
  turn(dir: 1 | -1): boolean;
}

const LINES_PER_PAGE = 22;
/** Roughly how many characters fit across a page before a line wraps. */
const WIDTH = 52;
const CONTENTS_PER_PAGE = 16;
const KEY = 'ew.books.v1';

type Entry = { title: string; page: number };
type Page =
  | { kind: 'title'; book: Book }
  | { kind: 'contents'; entries: Entry[]; first: boolean }
  | { kind: 'text'; heading?: string; note?: string; lines: string[]; prose: boolean };

/** How many printed lines a line of verse takes, once it wraps. */
const rows = (line: string) => Math.max(1, Math.ceil(line.trimEnd().length / WIDTH));
const height = (lines: string[]) => lines.reduce((n, l) => n + rows(l), 0);

/** Splits a book into pages: a title page, a contents page for long books, then each piece. */
export function paginate(book: Book): Page[] {
  const body: Page[] = [];
  const starts: number[] = [];
  for (const piece of book.pieces) {
    starts.push(body.length);
    const prose = piece.text.split('\n').some((l) => l.length > 120);
    if (prose) {
      for (const [i, para] of piece.text.split(/\n\n+/).entries()) body.push({ kind: 'text', heading: i === 0 ? piece.title : undefined, note: i === 0 ? piece.note : undefined, lines: [para], prose: true });
      continue;
    }
    let lines: string[] = [];
    let first = true;
    // The heading takes three lines; a prose note above the verse takes its share too.
    const room = () => LINES_PER_PAGE - (first ? 3 + (piece.note ? Math.ceil(piece.note.length / 85) + 1 : 0) : 0);
    const flush = () => {
      while (lines.length && !lines[lines.length - 1]) lines.pop();
      body.push({ kind: 'text', heading: first ? piece.title : undefined, note: first ? piece.note : undefined, lines, prose: false });
      first = false;
      lines = [];
    };
    for (const stanza of piece.text.split(/\n\n/)) {
      let rest = stanza.split('\n');
      // Short stanzas (tercets, quatrains) stay whole, moving to the next page if
      // they must; long verse paragraphs flow on and break at the foot.
      if (lines.length && height(lines) + 1 + height(rest) > room() && (height(rest) <= 8 || room() - height(lines) < 5)) flush();
      if (lines.length && height(lines) + 2 > room()) flush();
      if (lines.length) lines.push('');
      // One longer than a page runs over, a page at a time.
      while (height(lines) + height(rest) > room()) {
        let take = 0;
        while (take < rest.length && height(lines) + height(rest.slice(0, take + 1)) <= room()) take++;
        if (take === 0 && !lines.length) take = 1;
        lines.push(...rest.slice(0, take));
        rest = rest.slice(take);
        flush();
      }
      lines.push(...rest);
    }
    if (lines.length || first) flush();
  }
  // Long books get a contents page, or a few, after the title.
  const contents: Page[] = [];
  if (book.pieces.length > 4) {
    const n = Math.ceil(book.pieces.length / CONTENTS_PER_PAGE);
    const front = 1 + n;
    for (let i = 0; i < n; i++) {
      const entries = book.pieces.slice(i * CONTENTS_PER_PAGE, (i + 1) * CONTENTS_PER_PAGE).map((p, k) => ({ title: p.title, page: front + starts[i * CONTENTS_PER_PAGE + k] }));
      contents.push({ kind: 'contents', entries, first: i === 0 });
    }
  }
  return [{ kind: 'title', book }, ...contents, ...body];
}

export function buildReader(root: HTMLElement, on: { turn: () => void; closed: () => void }): Reader {
  const left = root.querySelector<HTMLElement>('.page.left')!;
  const right = root.querySelector<HTMLElement>('.page.right')!;
  const prev = root.querySelector<HTMLButtonElement>('.reader-prev')!;
  const next = root.querySelector<HTMLButtonElement>('.reader-next')!;
  const shut = root.querySelector<HTMLButtonElement>('.reader-close')!;
  const toc = root.querySelector<HTMLButtonElement>('.reader-contents')!;
  let pages: Page[] = [];
  let at = 0;
  let book: Book | null = null;

  const marks = (): Record<string, number> => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, number>;
    } catch {
      return {};
    }
  };
  const remember = () => {
    if (!book) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...marks(), [book.id]: at }));
    } catch {
      // Private windows forget; that's fine.
    }
  };

  const el = (tag: string, text?: string, cls?: string) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };

  const render = (side: HTMLElement, page: Page | undefined, n: number) => {
    side.replaceChildren();
    if (!page) return;
    if (page.kind === 'title') {
      const t = el('div', undefined, 'title-page');
      t.append(el('h2', page.book.title), el('p', page.book.author, 'by'));
      if (page.book.by) t.append(el('p', `translated by ${page.book.by}`, 'translator'));
      t.append(el('p', `${page.book.year} · public domain`, 'year'));
      side.append(t);
    } else if (page.kind === 'contents') {
      if (page.first) side.append(el('h3', 'Contents'));
      const list = el('ol', undefined, 'contents');
      for (const entry of page.entries) {
        const li = el('li');
        const go = el('button', entry.title) as HTMLButtonElement;
        go.type = 'button';
        go.addEventListener('click', () => jump(entry.page));
        li.append(go, el('span', String(entry.page), 'num'));
        list.append(li);
      }
      side.append(list);
    } else {
      if (page.heading) side.append(el('h3', page.heading));
      if (page.note) side.append(el('p', page.note, 'argument'));
      for (const line of page.lines) side.append(el('p', line || ' ', page.prose ? 'prose' : line ? 'verse' : 'gap'));
    }
    side.append(el('span', n > 0 ? String(n) : '', 'folio'));
  };

  const show = () => {
    render(left, pages[at], at);
    render(right, pages[at + 1], at + 1);
    prev.disabled = at === 0;
    next.disabled = at + 2 >= pages.length;
    toc.hidden = !pages.some((p) => p.kind === 'contents');
    remember();
  };

  const jump = (page: number) => {
    at = Math.max(0, Math.min(page - (page % 2), pages.length - 1));
    show();
    on.turn();
  };

  const reader: Reader = {
    open(b) {
      book = b;
      pages = paginate(b);
      // Back where you left it, if you've been here before.
      const saved = marks()[b.id] ?? 0;
      at = saved > 0 && saved < pages.length ? saved - (saved % 2) : 0;
      show();
      root.hidden = false;
      root.setAttribute('aria-label', `${b.title}, by ${b.author}`);
      next.focus();
    },
    close() {
      if (root.hidden) return;
      root.hidden = true;
      on.closed();
    },
    isOpen: () => !root.hidden,
    turn(dir) {
      const to = at + dir * 2;
      if (to < 0 || to >= pages.length) return false;
      at = to;
      show();
      on.turn();
      return true;
    },
  };
  prev.addEventListener('click', () => reader.turn(-1));
  next.addEventListener('click', () => reader.turn(1));
  toc.addEventListener('click', () => jump(1));
  shut.addEventListener('click', () => reader.close());
  return reader;
}
