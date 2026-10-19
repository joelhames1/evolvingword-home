# Evolving Word

The home page for evolvingword.com: a small wood-paneled study in a chalet above an alpine lake, at dusk, rendered live in the browser. You arrive outside looking down the valley, the camera drifts back into the room, and from the desk you can wander around: the watch, the pen and pad, the coffee and chocolate, the Rolodex, the medals and diplomas, the scratch map, the bookshelf, the running shoes, the projects on the drying line and the CRT.

Everything is made in code as the page runs: no photos, no 3D models, no audio files. The mountains, the lake and its reflections, the village, the train and the gondola are all generated.

## What's in the room

- **The split-flap board** over the window runs Richard Dawkins' "weasel program" from *The Blind Watchmaker*: copy the phrase with random mistakes, keep the best copy, repeat. Press **E** (or click the board) to type your own phrase on the CRT and watch it get bred out of noise.
- **The watch** is a chronograph that keeps your real local time. Its pushers start, stop and reset it.
- **The pad and fountain pen**: click the pad and the pen writes out one of five poems, turning to a fresh sheet when a poem runs long.
- **The bowl and the cup**: click a chocolate to eat it; click the cappuccino to take a sip. Both refill.
- **The Rolodex** flips through work history.
- **The medals** (5K, 10K, half, full: the best race at each distance, from Strava) swing when clicked. **The diplomas** hang next to them.
- **The scratch map** starts with the visited countries scratched off (places too small for the outline map, like Singapore, are dots). Drag across the foil to scratch more; it remembers per browser.
- **The bookshelf** has public-domain books you can open and page through: Dante's Inferno, Purgatorio and Paradiso (Longfellow), the Odyssey (Pope), Poe, the Rubáiyát (FitzGerald), Shakespeare, Dickinson, Frost, Whitman, the Romantics, Yeats and Thoreau. Long books open on a contents page and remember where you left off.
- **The project shirts** hang on a drying line along the left wall.
- **The tape deck** plays a lo-fi loop synthesized with Web Audio over wind and far-off cowbells. Sound starts off; the gate offers it.
- **Lo-fi** mode drops the picture to chunky pixels and scanlines.

Keys: `1` projects, `2` about, `3` signal, `E` evolve a word, `B` books, `M` map, `W` window, `L` lamp, `T` tape, arrows to flip through projects, the Rolodex and books, `Esc` back to the desk.

## The simple page

Everyone who can't or doesn't want the scene gets a quiet, typeset page with the same content: projects, about, the poems, the medals, work and education, a world map with the visited countries filled, and the bookshelf (the books open in the same reader). It's what phones, small screens, `prefers-reduced-motion` and browsers without WebGL 2 get, and anyone can switch to it with the **Simple** button in the scene or the link on the gate. If frames come slowly after you step inside, the scene offers it once. The choice is remembered; "Step inside the full scene" undoes it. `?lite` and `?full` force one or the other.

The simple page never downloads the 3D code: `src/main.ts` decides, and the scene (`src/scene.ts`) is a separate chunk loaded only when someone steps inside.

## Changing the personal bits

Almost everything personal lives in `src/content.ts`: the About lines, the poems the pen writes, the medals (race, year, time), the diplomas, the work history on the Rolodex, the countries already visited, the shoe card. The plain page reads from the same file, so the two never drift apart.

- **Visited countries** are written the way you'd say them. Common differences from the map data (`United States`, `Czech Republic`) are handled in `src/places.ts`, which also holds the small places drawn as dots. `npm test` checks that every country can be drawn.
- **Books** are in `src/books.ts`. Short ones live there; long ones are JSON in `public/books/`, built from Project Gutenberg texts by `node scripts/books.mjs <dir>` (the script lists its sources). Only add texts that are in the public domain.
- **Projects** live in `src/projects.ts`. Each one becomes a shirt on the drying line, a job ticket, a line on the CRT and an entry on the plain page. Put its artwork in `public/projects/` (a square PNG with a transparent background prints best on the shirt).

## Working on it

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (the evolver, the board, the books and their pages, the map names)
npx playwright test  # builds, serves with the production headers, drives the real page
npm run build        # type-checks and builds to dist/
```

Handy while tuning the look (they use the software renderer, so no GPU is needed, but expect about one frame a second):

- `node scripts/shots.mjs shots http://localhost:5173` screenshots every camera position.
- `node scripts/og.mjs vista shots/og.png http://localhost:5173` renders the link-preview still (save it as `public/og.jpg`).
- `node scripts/lightaudit.mjs shots/audit http://localhost:5173/?shot=desk&full` shoots the desk with each light switched off in turn.
- `?shot=<name>&full` skips the gate and jumps straight to a shot: `vista`, `desk`, `window`, `board`, `projects`, `about`, `signal`, `watch`, `pad`, `treats`, `work`, `map`, `diplomas`, `medals`, `library`, `shoes`.

## Code map

| File | What it does |
| --- | --- |
| `src/main.ts` | Decides between the simple page and the scene |
| `src/plain.ts` | The simple page: filling it, its map, and remembering the choice |
| `src/scene.ts` | The scene: boot, the gate, the close-ups and their cards, navigation, keys, the letterbox and captions, the frame loop |
| `src/content.ts` | The personal content: about, poems, medals, diplomas, work, places, shoes |
| `src/places.ts` | Country names as people say them, and the small places drawn as dots |
| `src/world.ts` | Renderer, camera, and the film look (bloom, grain, vignette, lens fringe, lo-fi) |
| `src/camera.ts` | Named shots, curved flights between them, lens shift for cards, breathing and mouse lean |
| `src/room.ts` | The study: paneling, the picture window and its frost, radiator, curtain, sconces, light through the glass |
| `src/alps.ts` | The valley: terrain, sky, lake and reflections, trees, village, train, gondola, boat, snow |
| `src/flap.ts` | The split-flap board |
| `src/evolve.ts` | The weasel program |
| `src/desk.ts` | Desk, CRT, lamp, tape deck, plant |
| `src/props/` | The watch, pad and pen, treats, Rolodex, honors wall, scratch map, bookshelf, shoes |
| `src/books.ts`, `src/reader.ts` | The public-domain texts and the two-page reader |
| `src/terminal.ts` | The BBS on the CRT |
| `src/line.ts` | The drying line and its shirts |
| `src/audio.ts` | All the sound |

## Deploying

It's a static site. On Vercel: import the repository, accept the detected Vite settings, deploy. `vercel.json` sets a strict Content-Security-Policy and the other security headers; `scripts/serve.mjs` applies the same headers locally so the Playwright tests catch anything the policy would block. Pushing to `main` deploys to production; any other branch gets a preview URL.
