# Evolving Word

The home page for evolvingword.com, rendered live in the browser. You arrive at a row of snow globes, one per world you've chosen to show, each with a picture of its view inside and its own weather falling in the glass. Pick one and it shakes, you dive into it, and you're in the studio:

- **The Lake House**: a wood-paneled study in a chalet above an alpine lake at dusk, snow falling, a split-flap board over the window.
- **Night Studio**: the same room five floors above a rainy neon city, the word board a billboard across the street, a patrol spinner going by now and then.
- **The Tower**: the cab at the top of an airport control tower at first light. Glass leans out all along the front and wraps round the corners; a radar scope hangs from the ceiling, painting the planes it sees; the flight strips sit in their bay and the binoculars on the sill. Out on the field the runway, taxiway and apron lights are still on as the first flights push back, taxi out, line up and take off, and others come down out of the dawn to land. The word board is an amber dot-matrix departures board.
- **The Monastery**: a plain stone cell in Assisi in the afternoon, walls of the pale pink Subasio stone, chestnut beams, a terracotta floor. You come in through a small round window of colored glass, and its light falls across the room. Two round arches open onto a walled garden with olive trees, cypresses, a fountain and sparrows, cloister arcades down either side, the bell tower a little way down the hill and the valley below in its haze, with the moon already up. A wooden Tau hangs by the window; candles burn on the walls. The word board is a painted band over the arches.
- **The Library**: an endless library of hexagonal galleries, after the one in Borges's story that holds every possible book, almost all of them nonsense. Warm lamps, shelves of books whose spines spell nothing, a spiral stair winding down a well past floor after floor, a pale skylight far above. You come in down the well. ‹ › walks you from gallery to gallery: the reading room with the desk, a paneled wall of medals and diplomas, a lit alcove of the books you can read, the map with the shirts and shoes, and the well itself. A lantern is carried down the stair now and then; a book you just saw slides home on its shelf; across the well there's a reading table you can see and never reach; an old mirror really reflects. The word board is a great open book floating over the well: its pages are noise like every other book here, and on each one a line breeds a phrase out of that noise, inked in red as each letter comes right.
- **The Heavens**: an observatory on a remote snowy peak at night. The dome's slit is open on the Milky Way, thousands of stars in their real colors, three planets, meteors, and a sea of cloud below. The room is round and the dome turns with you, so each stop for ‹ › is a station under its own piece of sky: the desk, the medals and diplomas on a brass rail, the bookcases round the wall, the telescope, and the map on its easel with the shirts and shoes. Click the telescope and it swings round to Saturn, Jupiter and its moons, the Lagoon Nebula or the Hercules cluster, with a view through the eyepiece. The word board is a constellation out past the slit: stars wander, then settle into letters.
- **The Living Word**: inside a single living cell, lit like a cathedral: stained-glass light through the cell wall, the violet dome of the nucleus with gold light at its pores, mitochondria, the Golgi and the endoplasmic reticulum drifting, microtubules rising like columns with filaments arching between them, motor proteins walking cargo along them. You come in through the cell wall. The stops for ‹ › are parts of the cell: the desk in a clearing, the medals and diplomas before a mitochondrion, the library inside the nucleus, the map at a window in the wall, the shirts on a line where ribosomes are building, the shoes beside a walking motor protein. The word board is a strand of DNA: each letter is three bases, and the weasel program happens to it literally, the bases flashing as they mutate until the strand reads the phrase. "In the beginning was the Word" (John 1:1).
- **The Night Train**: a sleeper compartment on a train crossing at night: wood panels with inlaid marquetry, brass fittings and reading lamps, a made-up bunk, curtains tied back from a window that drops open. The land streams by under the moon and stars: moonlit fields with farmhouses and a level crossing, its bells ringing and a car waiting at the barrier; a stone viaduct high over a gorge with a river at the bottom; a snowy pass with avalanche sheds and a long, loud tunnel; a city at 3am; a lake. You come in from the gorge, through the corridor window across from the door. The CRT and the lamp are on the fold-down table under the window, the medals hang on the coat hooks, the bookshelf stands by the door and the map is over the bunk, with a route plate under it that shows the line tonight, a light where the train is and the branches you picked. Out in the corridor the diplomas are framed between the windows and the shirts hang from a brass rail. A points lever lights up as each junction comes near: pull it and the train takes the other branch, or leave it and the train picks. The emergency brake makes a long screeching stop, sparks flying under the wheels, then it's quiet but for the crickets until the train eases away. The cord (or `H`) sounds the horn, which echoes off whatever's out there. The conductor's ticket on the table takes a new hole each time you click it and a stamp for each landscape you cross. The train stops at stations with lamps, a bench and a clock. The word board is a split-flap board over the window, and each station's sign flips to the same phrase as you pull in.

The studio is the same in every world: the watch, the pen and pad, the coffee and chocolate, the Rolodex, the medals and diplomas, the scratch map, the bookshelf, the running shoes, the projects on the drying line and the CRT. In the first four worlds only the room's shell, the view, the weather and the sounds change; the Library, the Heavens, the Living Word and the Night Train set the same pieces out in places of their own. The globes remember where you were last; the **Worlds** button takes you back to them. They sit in one row when the screen is wide enough and two when it isn't (four go two by two, five go three over two); the chooser is laid out for at most five.

Everything is made in code as the page runs: no photos, no 3D models, no audio files. The mountains, the lake and its reflections, the city, the trains and the gondola, the airfield and its planes, the monastery, its garden and its valley, the library's books and stair, the night sky and the telescope's views, the cell and its strand of DNA, the sleeper car and the land it crosses are all generated.

## Choosing which worlds show

Every world is built and stays in the code; you pick which ones get a globe (three is the sweet spot, five at most). Hidden worlds still open by link, like `/?world=tower`, and `/?worlds=all` shows every globe, for looking at ones you've hidden.

There are two ways to choose, and the live one wins when it's set:

- **The list in the repo:** `src/worlds/shown.ts`. Edit it (GitHub's web editor works from a phone) and it goes live with the next deploy, about a minute later.
- **The owner page, live:** `evolvingword.com/owner.html`. Tick the worlds, put them in order, type the password and save; the globes change at once, no deploy. "Use the list in the repo" clears your live choice. The page isn't linked from anywhere and asks search engines to skip it, but the password is what keeps it yours.

The owner page saves through a small function (`api/worlds.ts`) to a tiny Upstash Redis store. Its keys reach that one store and nothing else, so no account-wide Vercel token is involved. To set it up, once, in the Vercel dashboard:

1. **Storage → Upstash** (pick **Upstash for Redis**, the free plan is plenty), name it anything, and connect it to this project. That sets `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you.
2. **Project → Settings → Environment Variables**, for Production: `OWNER_PASSWORD`, a long passphrase only you know.
3. If you tried the older Edge Config setup, delete `VERCEL_API_TOKEN` and `VERCEL_TEAM_ID` from the project and revoke that token; nothing uses them now.
4. Redeploy once so the function picks them up.

Until then the page says the switch isn't set up, and the globes follow the list in the repo. A wrong password costs a second each try; after 8 wrong tries from one address the switch stops checking for 15 minutes, and after 40 from anywhere, for an hour (the counters live in the store as `evolvingword:shown:wrong:*`; deleting them in Upstash's Browser lifts a lockout at once). A new choice can take up to ten seconds to reach every visitor, because the CDN holds the answer that long.

## Looking around

You start at the desk, facing the window. The room has four walls, and the **‹ ›** buttons at the edges of the screen (or the left and right arrow keys) turn you to the next one; each button says where it goes.

- **The desk**: the window and the word board, the CRT, the watch, the pad, the treats, the Rolodex. **About** (`2`) is a card at the desk.
- **Medals & diplomas** (the right wall).
- **The library** (the back wall): the bookshelf.
- **Map, shirts & shoes** (the left wall): the scratch map, the project shirts on their drying line, and the running shoes on the floor under the map.

Click anything that glows to step up to it. `Esc` steps back: from a close-up to the wall it's on, from a wall to the desk.

## What's in the room

- **The word board** (the split-flap board by the lake, the billboard in the city, the departures board in the tower, the painted band in the monastery, the open book in the library, the constellation in the heavens, the strand of DNA in the cell, the split-flap board over the window and the station signs on the night train) runs Richard Dawkins' "weasel program" from *The Blind Watchmaker*: copy the phrase with random mistakes, keep the best copy, repeat. Press **E** (or click the board) to type your own phrase on the CRT and watch it get bred out of noise. In the tower the newest flight's destination breeds, letters still wrong glowing dim, and when it's done it moves up the board to boarding. In the monastery the wrong letters are only the faint red underdrawing of a fresco, and each one that comes right is painted in, in red ochre; most of the band's phrases are from St. Francis's Canticle of the Creatures in Matthew Arnold's translation (public domain).
- **The watch** is a chronograph that keeps your real local time. Its pushers start, stop and reset it.
- **The pad and fountain pen**: click the pad and the pen writes out one of five poems, turning to a fresh sheet when a poem runs long.
- **The bowl and the cup**: click a chocolate to eat it; click the cappuccino to take a sip. Both refill.
- **The Rolodex** flips through work history.
- **The medals** (5K, 10K, half, full: the best race at each distance, from Strava) swing when clicked. **The diplomas** hang next to them.
- **The scratch map** starts with the visited countries scratched off (places too small for the outline map, like Singapore, are dots). Drag across the foil to scratch more; it remembers per browser. Slipped? The map's card has **Undo** (or Cmd/Ctrl+Z) for the last stroke, **Lay foil back** to rub the foil back over a country, and **Start over** to go back to the list in `src/content.ts`.
- **The bookshelf** has public-domain books you can open and page through: Dante's Inferno, Purgatorio and Paradiso (Longfellow), the Odyssey (Pope), Poe, the Rubáiyát (FitzGerald), Shakespeare, Dickinson, Frost, Whitman, the Romantics, Yeats and Thoreau. Long books open on a contents page and remember where you left off.
- **The project shirts** hang on a drying line along the left wall, next to the map.
- **The running shoes** sit on the floor under the map. Click them for the pair and their miles.
- **The tape deck** plays music synthesized with Web Audio over the world's weather, and each world has its own band. By the lake it's slow, swung electric piano over brushes and a round bass, with a celesta falling like snow, and wind and far-off cowbells outside. In the city it's slow analog synth pads that swell over each bar, an arpeggio drifting in a long echo, a plucked synth bass and a quiet drum machine, with rain and a neon hum outside and the patrol spinner's whoosh. In the tower it's soft airy pads, a sub bass and a ping now and then like a sweep on the scope, over the cab's air handling and the radio: a squelch, a few chirps of data, a courtesy beep (all made up from tones and noise; there are no voices and nothing recorded). When a plane starts its takeoff roll you hear the engines spool up far off, louder with your nose to the glass. In the monastery a line of plainsong in the Dorian mode, sung by synthesized voices through vowel formants, rises over a drone on D and A in a long stone room, with birdsong and wind from the garden and the bell in the tower now and then. In the library a slow organ holds D and A while soft voices change chord in the Dorian mode and a felt piano falls like dust, with air moving up the well, far-off footsteps, pages turning and books being shelved. In the heavens a slow glass piano plays over a deep pad and a sub in a reverb as big as the night, with wind at altitude, the dome's motor when it turns and a tiny chime for each meteor. In the cell a slow heartbeat sits under a warm choir on four chords in E flat, with a breathing melody on a glassy flute, falling runs in the echo, and bubbles and drops over the flow. On the night train a small late-night band plays in D minor: brushes on the snare that keep time with the clack of the wheels, an upright bass, an accordion holding the chords, an electric piano and a reedy lead like a harmonica. It slows and quickens with the train, over the rails, the wind, creaks in the panelling, the bells at the crossing and the roar of the tunnel. All of them are mixed to sit under everything else. The globes have a sound switch; it's on unless you turn it off.
- **Lo-fi** mode drops the picture to chunky pixels and scanlines.

Keys: left and right arrows turn to the next wall (and flip through projects, the Rolodex and book pages when you're looking at them), `Esc` steps back, `1` projects, `2` about, `3` signal, `E` evolve a word, `B` books, `M` map, `W` window, `L` lamp, `T` tape, and on the night train `H` the horn.

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
- `?shot=<name>&full` skips the globes and jumps straight to a shot: `vista`, `desk`, `window`, `board`, `projects`, `about`, `signal`, `watch`, `pad`, `treats`, `work`, `honors`, `diplomas`, `medals`, `library`, `places`, `map`, `shoes`. Add `&world=<id>` for another world: `city`, `tower`, `monastery`, `library`, `heavens`, `cell`, `train`. The night train adds `lever`, `brake`, `sparks`, `ticket`, `corridor` and `route`.
- `WORLD=tower node scripts/shots.mjs shots http://localhost:5173` shoots another world; the `chooser` shot is the globes.
- `node scripts/stills.mjs http://localhost:5173 tower monastery` renders just the globes you name.

## Adding a world

A world is a folder in `src/worlds/` with a `kit.ts` (see `src/worlds/kit.ts`). At the least it builds what's around the studio and what's outside, its word board, its three shots (`vista`, the way in, which is also the picture in its globe; `window`; `board`), the flight in, the CRT tagline and whatever has to happen each frame. By default the studio's pieces stand where they do in the usual room (`src/layout.ts`), so a world can be just a new shell and a new view. A world that wants to present the studio its own way can also:

- `arrange(studio)`: move, turn, hide or restyle the shared pieces (they keep working the same; each close-up moves with its piece).
- `closeups(studio)`: add or replace shots once the pieces are placed.
- `walls`: the places ‹ › turns between, in order, instead of the room's four walls (must include `desk`; close-ups list which place they step back to).
- `route(from, to)`: waypoints for the camera, so flights go through doorways rather than walls.
- `wire(w)`: its own clickable things and cards, like the observatory's telescope.
- `band`: its own music and weather (a `Band`, see `src/audio.ts`), kept in its folder as `sound.ts`.

Then:

1. Add it to `WORLDS` in `src/worlds/index.ts` (name, line, glow color, and what falls in its globe: snow, rain, mist, petals, dust, stars, motes or lamps going by; add a kind in `src/chooser.ts` if it needs another), to `KITS` in `src/scene.ts`, and a base and plaque for its globe at the end of `src/style.css`.
2. Run `node scripts/stills.mjs http://localhost:5173 <id>` to render the picture for its globe into `public/worlds/`.
3. Show it: add it to `src/worlds/shown.ts`, or tick it on the owner page.

Anything outside a window should light itself with `src/worlds/outdoor.ts` (a sun, a sky, haze and low mist, and lights that stay a few pixels across however far off they are), so the room's lamps don't shine through the walls onto the view.

Each world's code is its own chunk, fetched only when someone picks it. Tests go in `tests/e2e/<id>.spec.ts` and `tests/unit/<id>.test.ts`; `PW_PORT=4181 npx playwright test` runs a suite on another port, to run two side by side.

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
| `src/worlds/library/` | The Library: the plan of the galleries (`plan.ts`), the hexagon stamped through them (`hall.ts`, `shelves.ts`, `paint.ts`), its lamps (`light.ts`), the mirror (`mirror.ts`), the open book (`book.ts`), the music and air (`sound.ts`) |
| `src/worlds/heavens/` | The Heavens: the observatory and its turning dome (`dome.ts`), what the pieces stand on (`stations.ts`), the telescope and its eyepiece (`telescope.ts`, `eyepiece.ts`), the sky (`sky.ts`), the peak (`peak.ts`), the constellation board (`board.ts`), the music (`sound.ts`) |
| `src/worlds/cell/` | The Living Word: the cell's look (`shaders.ts`), its wall (`membrane.ts`), what floats in it (`organelles.ts`), its columns and arches (`skeleton.ts`), the strand of DNA (`dna.ts`), the music (`sound.ts`) |
| `src/worlds/train/` | The Night Train: the line, its junctions, stations and brakes (`journey.ts`), the car's plan and the ways through it (`plan.ts`), the sleeper car (`car.ts`, `paint.ts`), the rest of the train (`consist.ts`), the lever, brake and cord (`controls.ts`), the ticket (`ticket.ts`), the route plate (`routemap.ts`), the land streamed past in pieces (`chunks.ts`, `ground.ts`, `scenery.ts`, `mesher.ts`, `signs.ts`), the night light and sky (`night.ts`, `sky.ts`), the split-flap board (`board.ts`), the music (`sound.ts`) |
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
