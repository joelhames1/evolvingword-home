# Evolving Word

The home page for evolvingword.com: a small print studio five floors above a rainy neon city, rendered live in the browser. You arrive in the street, the camera rises up the building and through the window, and from the desk you can visit the projects (shirts on a drying line), read the About notepad, use the CRT, or watch the billboard across the street evolve words out of random letters.

Everything is made in code as the page runs: no photos, no 3D models, no audio files. The whole site is about 300 KB of compressed JavaScript plus fonts.

## What's in the room

- **The billboard** runs Richard Dawkins' "weasel program" from *The Blind Watchmaker*: copy the phrase with random mistakes, keep the best copy, repeat. Press **E** (or click the billboard) to type your own phrase on the CRT and watch it get bred out of noise.
- **The window** projects the city's light into the room through the rain: the frame's shadow and the running drops land on the desk, tinted by whatever color the billboard is showing.
- **A patrol spinner** drifts past every minute or so and sweeps its searchlight through the room.
- **The tape deck** plays a lo-fi loop synthesized with Web Audio (electric piano, bass, swung drums, tape wobble) over rain and vinyl crackle. Sound starts off; the gate offers it.
- **Lo-fi** mode drops the picture to chunky pixels and scanlines.

Keys: `1` projects, `2` about, `3` signal, `E` evolve a word, `W` window, `L` lamp, `T` tape, `Esc` back to the desk.

Phones, small screens, `prefers-reduced-motion` and browsers without WebGL 2 get a plain, fast page with the same projects and contact details (`?lite` forces it, `?full` forces the scene).

## Adding a project

Projects live in `src/projects.ts`. Each one becomes a shirt on the drying line, a job ticket, a line on the CRT and an entry on the plain page. Put its artwork in `public/projects/` (a square PNG with a transparent background prints best on the shirt).

## Working on it

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (the evolver, phrase cleaning)
npx playwright test  # builds, serves with the production headers, drives the real page
npm run build        # type-checks and builds to dist/
```

Handy while tuning the look (they use the software renderer, so no GPU is needed):

- `node scripts/shots.mjs shots http://localhost:5173` screenshots every camera position.
- `node scripts/og.mjs street shots/og.png http://localhost:5173` renders the link-preview still (save it as `public/og.jpg`).
- `node scripts/lightaudit.mjs shots/audit http://localhost:5173/?shot=desk&full` shoots the desk with each light switched off in turn.
- `?shot=desk|window|projects|about|signal|street&full` skips the gate and jumps straight to a shot.

## Code map

| File | What it does |
| --- | --- |
| `src/main.ts` | Boot, the gate, navigation, keys, the letterbox and captions, the frame loop |
| `src/world.ts` | Renderer, camera, and the film look (bloom, grain, vignette, lens fringe, lo-fi) |
| `src/camera.ts` | Named shots, curved flights between them, breathing and mouse lean |
| `src/room.ts` | The studio, the window and its rain, the building's face, signs, fire escape, lights |
| `src/desk.ts` | Desk, CRT, lamp, tape deck, mug, notepad, phone, plant |
| `src/city.ts` | Towers, street, rain, trains, spinners, signs, the billboard |
| `src/flyby.ts` | The patrol spinner and its searchlight |
| `src/evolve.ts` | The weasel program |
| `src/terminal.ts` | The BBS on the CRT |
| `src/line.ts` | The drying line and its shirts |
| `src/audio.ts` | All the sound |

## Deploying

It's a static site. On Vercel: import the repository, accept the detected Vite settings, deploy. `vercel.json` sets a strict Content-Security-Policy and the other security headers; `scripts/serve.mjs` applies the same headers locally so the Playwright tests catch anything the policy would block.
