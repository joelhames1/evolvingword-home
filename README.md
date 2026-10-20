# Evolving Word

The home page for evolvingword.com, rendered live in the browser. You arrive at a row of snow globes, one per world, each with a picture of its view inside and its own weather falling in the glass. Pick one and it shakes, you dive into it, and you're in the studio:

- **The Lake House**: a wood-paneled study in a chalet above an alpine lake at dusk, snow falling, a split-flap board over the window.
- **Night Studio**: the same room five floors above a rainy neon city, the word board a billboard across the street, a patrol spinner going by now and then.
- **The Tower**: the cab at the top of an airport control tower at first light. Glass leans out all along the front and wraps round the corners; a radar scope hangs from the ceiling, painting the planes it sees; the flight strips sit in their bay and the binoculars on the sill. Out on the field the runway, taxiway and apron lights are still on as the first flights push back, taxi out, line up and take off, and others come down out of the dawn to land. The word board is an amber dot-matrix departures board.
- **The Monastery**: a plain stone cell in Assisi in the afternoon, walls of the pale pink Subasio stone, chestnut beams, a terracotta floor. You come in through a small round window of colored glass, and its light falls across the room. Two round arches open onto a walled garden with olive trees, cypresses, a fountain and sparrows, cloister arcades down either side, the bell tower a little way down the hill and the valley below in its haze, with the moon already up. A wooden Tau hangs by the window; candles burn on the walls. The word board is a painted band over the arches.

The studio is the same in every world: the watch, the pen and pad, the coffee and chocolate, the Rolodex, the medals and diplomas, the scratch map, the bookshelf, the running shoes, the projects on the drying line and the CRT. Only the room's shell, the view, the weather and the sounds change. The globes remember where you were last; the **Worlds** button takes you back to them. They sit in one row when the screen is wide enough and two when it isn't (four go two by two, five go three over two); the chooser is laid out for at most five.

Everything is made in code as the page runs: no photos, no 3D models, no audio files. The mountains, the lake and its reflections, the city, the trains and the gondola, the airfield and its planes, the monastery, its garden and its valley are all generated.

## Choosing which worlds show

Every world is built and stays in the code; you pick which ones get a globe (three is the sweet spot, five at most). Hidden worlds still open by link, like `/?world=tower`, and `/?worlds=all` shows every globe, for looking at ones you've hidden.

There are two ways to choose, and the live one wins when it's set:

- **The list in the repo:** `src/worlds/shown.ts`. Edit it (GitHub's web editor works from a phone) and it goes live with the next deploy, about a minute later.
- **The owner page, live:** `evolvingword.com/owner.html`. Tick the worlds, put them in order, type the password and save; the globes change at once, no deploy. "Use the list in the repo" clears your live choice. The page isn't linked from anywhere and asks search engines to skip it, but the password is what keeps it yours.

The owner page saves through a small function (`api/worlds.ts`) to a Vercel Edge Config store. To set it up, once, in the Vercel dashboard:

1. **Storage → Create → Edge Config**, name it anything, and connect it to this project. That sets `EDGE_CONFIG` for you.
2. **Account Settings → Tokens → Create**: a token scoped to the account or team that owns the project. Copy it.
3. **Project → Settings → Environment Variables**, for Production: `OWNER_PASSWORD` (a long passphrase only you know), `VERCEL_API_TOKEN` (the token from step 2), and, if the project belongs to a team, `VERCEL_TEAM_ID` (the team's id, from its settings page).
4. Redeploy once so the function picks them up.

Until then the page says the switch isn't set up, and the globes follow the list in the repo. A wrong password costs a second each try.

## Looking around

You start at the desk, facing the window. The room has four walls, and the **‹ ›** buttons at the edges of the screen (or the left and right arrow keys) turn you to the next one; each button says where it goes.

- **The desk**: the window and the word board, the CRT, the watch, the pad, the treats, the Rolodex. **About** (`2`) is a card at the desk.
- **Medals & diplomas** (the right wall).
- **The library** (the back wall): the bookshelf.
- **Map, shirts & shoes** (the left wall): the scratch map, the project shirts on their drying line, and the running shoes on the floor under the map.

Click anything that glows to step up to it. `Esc` steps back: from a close-up to the wall it's on, from a wall to the desk.

## What's in the room

- **The word board** (the split-flap board by the lake, the billboard in the city, the departures board in the tower, the painted band in the monastery) runs Richard Dawkins' "weasel program" from *The Blind Watchmaker*: copy the phrase with random mistakes, keep the best copy, repeat. Press **E** (or click the board) to type your own phrase on the CRT and watch it get bred out of noise. In the tower the newest flight's destination breeds, letters still wrong glowing dim, and when it's done it moves up the board to boarding. In the monastery the wrong letters are only the faint red underdrawing of a fresco, and each one that comes right is painted in, in red ochre; most of the band's phrases are from St. Francis's Canticle of the Creatures in Matthew Arnold's translation (public domain).
- **The watch** is a chronograph that keeps your real local time. Its pushers start, stop and reset it.
- **The pad and fountain pen**: click the pad and the pen writes out one of five poems, turning to a fresh sheet when a poem runs long.
- **The bowl and the cup**: click a chocolate to eat it; click the cappuccino to take a sip. Both refill.
- **The Rolodex** flips through work history.
- **The medals** (5K, 10K, half, full: the best race at each distance, from Strava) swing when clicked. **The diplomas** hang next to them.
- **The scratch map** starts with the visited countries scratched off (places too small for the outline map, like Singapore, are dots). Drag across the foil to scratch more; it remembers per browser. Slipped? The map's card has **Undo** (or Cmd/Ctrl+Z) for the last stroke, **Lay foil back** to rub the foil back over a country, and **Start over** to go back to the list in `src/content.ts`.
- **The bookshelf** has public-domain books you can open and page through: Dante's Inferno, Purgatorio and Paradiso (Longfellow), the Odyssey (Pope), Poe, the Rubáiyát (FitzGerald), Shakespeare, Dickinson, Frost, Whitman, the Romantics, Yeats and Thoreau. Long books open on a contents page and remember where you left off.
- **The project shirts** hang on a drying line along the left wall, next to the map.
- **The running shoes** sit on the floor under the map. Click them for the pair and their miles.
- **The tape deck** plays music synthesized with Web Audio over the world's weather, and each world has its own band. By the lake it's slow, swung electric piano over brushes and a round bass, with a celesta falling like snow, and wind and far-off cowbells outside. In the city it's slow analog synth pads that swell over each bar, an arpeggio drifting in a long echo, a plucked synth bass and a quiet drum machine, with rain and a neon hum outside and the patrol spinner's whoosh. In the tower it's soft airy pads, a sub bass and a ping now and then like a sweep on the scope, over the cab's air handling and the radio: a squelch, a few chirps of data, a courtesy beep (all made up from tones and noise; there are no voices and nothing recorded). When a plane starts its takeoff roll you hear the engines spool up far off, louder with your nose to the glass. In the monastery a line of plainsong in the Dorian mode, sung by synthesized voices through vowel formants, rises over a drone on D and A in a long stone room, with birdsong and wind from the garden and the bell in the tower now and then. All of them are mixed to sit under everything else. The globes have a sound switch; it's on unless you turn it off.
- **Lo-fi** mode drops the picture to chunky pixels and scanlines.

Keys: left and right arrows turn to the next wall (and flip through projects, the Rolodex and book pages when you're looking at them), `Esc` steps back, `1` projects, `2` about, `3` signal, `E` evolve a word, `B` books, `M` map, `W` window, `L` lamp, `T` tape.

## The simple page

Everyone who can't or doesn't want the scene gets a quiet, typeset page with the same content: projects, about, the poems, the medals, work and education, a world map with the visited countries filled, and the bookshelf (the books open in the same reader). It's what phones, small screens, `prefers-reduced-motion` and browsers without WebGL 2 get, and anyone can switch to it with the **Simple** button in the scene or the link under the globes. If frames come slowly after you step inside, the scene offers it once. The choice is remembered; "Step inside the full scene" undoes it. `?lite` and `?full` force one or the other.

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
npm test             # unit tests (the evolver, every world's board, the books and their pages, the map names)
npx playwright test  # builds, serves with the production headers, drives the real page
npm run build        # type-checks and builds to dist/
```

Handy while tuning the look (they use the software renderer, so no GPU is needed, but expect about one frame a second):

- `node scripts/shots.mjs shots http://localhost:5173` screenshots every camera position.
- `node scripts/stills.mjs http://localhost:5173` renders the pictures inside the globes.
- `node scripts/og.mjs vista shots/og.png http://localhost:5173` renders the link-preview still (save it as `public/og.jpg`).
- `node scripts/lightaudit.mjs shots/audit http://localhost:5173/?shot=desk&full` shoots the desk with each light switched off in turn.
- `?shot=<name>&full` skips the globes and jumps straight to a shot: `vista`, `desk`, `window`, `board`, `projects`, `about`, `signal`, `watch`, `pad`, `treats`, `work`, `honors`, `diplomas`, `medals`, `library`, `places`, `map`, `shoes`. Add `&world=city`, `&world=tower` or `&world=monastery` for the other worlds.
- `WORLD=tower node scripts/shots.mjs shots http://localhost:5173` shoots another world; the `chooser` shot is the globes.
- `node scripts/stills.mjs http://localhost:5173 tower monastery` renders just the globes you name.

## Adding a world

A world is a folder in `src/worlds/` with a `kit.ts` that builds its room shell, what's outside, its word board, its three shots (`vista`, the way in; `window`; `board`), the flight in, the CRT tagline and whatever has to happen each frame (see `src/worlds/kit.ts`). The room's footprint is shared (`src/layout.ts`), so every prop lands in the same place. Then:

1. Add it to `WORLDS` in `src/worlds/index.ts` (name, line, glow color, and what falls in its globe: snow, rain, mist or petals; add a kind in `src/chooser.ts` if it needs another) and to `KITS` in `src/scene.ts`. The chooser is laid out for up to five globes (`MAX_WORLDS`).
2. Give it a band and outside sounds in `src/audio.ts`: add it to `Weather` and `SCORES`, start its weather in `start()` and play its band in `schedule()`.
3. Run `node scripts/stills.mjs http://localhost:5173 <id>` to render the picture for its globe into `public/worlds/`.

Anything outside the window should light itself with `src/worlds/outdoor.ts` (a sun, a sky, haze and low mist, and lights that stay a few pixels across however far off they are), so the room's lamps don't shine through the walls onto the view. The tower and the monastery both use it.

Each world's code is its own chunk, fetched only when someone picks it.

## Code map

| File | What it does |
| --- | --- |
| `src/main.ts` | Decides between the simple page, the globes and a world asked for by link (`?world=city`) |
| `src/chooser.ts` | The snow globes: which ones show, weather in the glass, the shake and the dive (and the pull back out), remembering the choice |
| `src/worlds/shown.ts` | Which worlds have a globe, unless the owner has chosen live |
| `owner.html`, `src/owner.ts`, `api/worlds.ts` | The owner page and the function behind it, for choosing the globes live |
| `src/plain.ts` | The simple page: filling it, its map, and remembering the choice |
| `src/scene.ts` | The studio every world shares: boot, the close-ups and their cards, navigation, keys, the letterbox and captions, the frame loop |
| `src/worlds/kit.ts` | What a world brings to the studio |
| `src/worlds/alps/` | The Lake House: the pine study and its frosted window (`room.ts`), the valley (`valley.ts`), the split-flap board (`flap.ts`) |
| `src/worlds/city/` | Night Studio: the plaster room, rain on the glass and the building's neon face (`room.ts`), the city and its billboard (`city.ts`), the patrol spinner (`flyby.ts`) |
| `src/worlds/tower/` | The Tower: the cab, its glass, scope, strip bay and the tower outside (`cab.ts`), the airfield, its lights and the planes' day (`airfield.ts`), the dot-matrix departures board (`board.ts`) |
| `src/worlds/monastery/` | The Monastery: the stone cell, its round window, candles and the house outside (`room.ts`), the garden, cloister, bell tower, birds and valley (`valley.ts`), the painted band (`band.ts`) |
| `src/worlds/outdoor.ts` | Daylight for everything outside: sun, sky, haze and mist, and far-off point lights |
| `src/layout.ts` | The room's footprint, the same in every world |
| `src/content.ts` | The personal content: about, poems, medals, diplomas, work, places, shoes |
| `src/places.ts` | Country names as people say them, and the small places drawn as dots |
| `src/world.ts` | Renderer, camera, and the film look (bloom, grain, vignette, lens fringe, lo-fi) |
| `src/camera.ts` | Named shots, curved flights between them, lens shift for cards, breathing and mouse lean |
| `src/evolve.ts` | The weasel program |
| `src/desk.ts` | Desk, CRT, lamp, tape deck, plant |
| `src/props/` | The watch, pad and pen, treats, Rolodex, honors wall, scratch map, bookshelf, shoes |
| `src/books.ts`, `src/reader.ts` | The public-domain texts and the two-page reader |
| `src/terminal.ts` | The BBS on the CRT |
| `src/line.ts` | The drying line and its shirts |
| `src/audio.ts` | All the sound, with each world's weather |

## Deploying

It's a static site. On Vercel: import the repository, accept the detected Vite settings, deploy. `vercel.json` sets a strict Content-Security-Policy and the other security headers; `scripts/serve.mjs` applies the same headers locally so the Playwright tests catch anything the policy would block. Pushing to `main` deploys to production; any other branch gets a preview URL.
