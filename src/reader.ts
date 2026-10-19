// The book reader: a two-page spread over the scene, turned with the arrow keys
// or the corners. Poems start on a fresh page; long ones run over.
import type { Book } from './books';

export interface Reader {
  open(book: Book): void;
  close(): void;
  isOpen(): boolean;
  /** Turns a spread; returns false at either end. */
  turn(dir: 1 | -1): boolean;
}

const LINES_PER_PAGE = 22;

type Page = { kind: 'title'; book: Book } | { kind: 'text'; heading?: string; lines: string[]; prose: boolean };

/** Splits a book into pages: a title page, then each piece, broken at stanzas. */
export function paginate(book: Book): Page[] {
  const pages: Page[] = [{ kind: 'title', book }];
  for (const piece of book.pieces) {
    const prose = piece.text.split('\n').some((l) => l.length > 120);
    if (prose) {
      for (const [i, para] of piece.text.split(/\n\n+/).entries()) pages.push({ kind: 'text', heading: i === 0 ? piece.title : undefined, lines: [para], prose: true });
      continue;
    }
    const stanzas = piece.text.split(/\n\n/);
    let lines: string[] = [];
    let first = true;
    const flush = () => {
      pages.push({ kind: 'text', heading: first ? piece.title : undefined, lines, prose: false });
      first = false;
      lines = [];
    };
    for (const s of stanzas) {
      const sl = s.split('\n');
      if (lines.length && lines.length + sl.length + 1 > LINES_PER_PAGE - (first ? 3 : 0)) flush();
      if (lines.length) lines.push('');
      lines.push(...sl);
    }
    flush();
  }
  return pages;
}

export function buildReader(root: HTMLElement, on: { turn: () => void; closed: () => void }): Reader {
  const left = root.querySelector<HTMLElement>('.page.left')!;
  const right = root.querySelector<HTMLElement>('.page.right')!;
  const prev = root.querySelector<HTMLButtonElement>('.reader-prev')!;
  const next = root.querySelector<HTMLButtonElement>('.reader-next')!;
  const shut = root.querySelector<HTMLButtonElement>('.reader-close')!;
  let pages: Page[] = [];
  let at = 0;

  const render = (el: HTMLElement, page: Page | undefined, n: number) => {
    el.replaceChildren();
    if (!page) return;
    if (page.kind === 'title') {
      const t = document.createElement('div');
      t.className = 'title-page';
      const h = document.createElement('h2');
      h.textContent = page.book.title;
      const a = document.createElement('p');
      a.className = 'by';
      a.textContent = page.book.author;
      const y = document.createElement('p');
      y.className = 'year';
      y.textContent = `${page.book.year} · public domain`;
      t.append(h, a, y);
      el.append(t);
    } else {
      if (page.heading) {
        const h = document.createElement('h3');
        h.textContent = page.heading;
        el.append(h);
      }
      for (const line of page.lines) {
        const p = document.createElement('p');
        p.className = page.prose ? 'prose' : line ? 'verse' : 'gap';
        p.textContent = line || ' ';
        el.append(p);
      }
    }
    const folio = document.createElement('span');
    folio.className = 'folio';
    folio.textContent = n > 0 ? String(n) : '';
    el.append(folio);
  };

  const show = () => {
    render(left, pages[at], at);
    render(right, pages[at + 1], at + 1);
    prev.disabled = at === 0;
    next.disabled = at + 2 >= pages.length;
  };

  const reader: Reader = {
    open(book) {
      pages = paginate(book);
      at = 0;
      show();
      root.hidden = false;
      root.setAttribute('aria-label', `${book.title}, by ${book.author}`);
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
  shut.addEventListener('click', () => reader.close());
  return reader;
}
