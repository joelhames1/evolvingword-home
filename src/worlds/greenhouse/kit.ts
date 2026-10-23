// The Greenhouse: the studio in a Victorian glasshouse against an old garden
// wall, at golden hour. Dust turns in the shafts of low sun; now and then a
// shower passes and rain runs down the glass. Along the staging the visitor's
// own flowers grow, each from a genome of its own: pick one, then another, and
// the bee carries the pollen across and a seed into an empty pot, and in about
// twenty seconds you see what came of it. The tools are at the end of the
// staging; the seed catalog on the drawers wants a few varieties nobody has yet.
// The word is bedded out on the bank across the lawn. ‹ › walks you from the
// potting bench to the prizes, the books and seeds, the map and the line, and
// the flowers.
import * as THREE from 'three';
import { SHOTS, type Shot } from '../../camera';
import { canvas, texture } from '../../textures';
import type { Kit, KitModule, Studio, Wiring } from '../kit';
import { buildBed } from './bed';
import { buildBee } from './bee';
import { buildCatalog } from './catalog';
import { buildFlowers } from './flowers';
import { compost, emptyPot, forget, growth, inBloom, keep, load, newStamps, prune, receive, settle, shareLink, sow, starter, thirst, water, type Garden, type Plant } from './garden';
import { decode, describe, encode, gardenName, hash, latinName, traits, WANTED, type Genome } from './genome';
import { BANK, buildGrounds } from './grounds';
import { buildHouse } from './house';
import { buildLight, castsSun } from './light';
import { clear, GIFT_POT, HOUSE, POT, POT_AT, POTS, route, SHOW_POT, solid, SUN } from './plan';
import { buildBand } from './sound';
import { arrangeStudio, CATALOG } from './studio';
import { buildTools } from './tools';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** Close-ups with a card on the left slide their picture right to make room (as in scene.ts). */
const CARD = 0.13;
const SLOTS = POT_AT.length;
/** The prize plant at the show: the catalog's hardest, to show it can be done. */
const SHOW = WANTED.find((w) => w.id === 'midnight-lily')!;
const GRADE = ['', 'Easily raised', 'Wants patience', 'A rare prize'];
const FOLIAGE = ['#3a6a2a', '#5a9a32', '#6a908a', '#7a5428'];

/** In the open, with a hand's width of air on every side: somewhere the camera can stand. */
const roomy = (p: THREE.Vector3) => !solid(p, 0.06);

/** A plant label pushed into the soil: "a gift from a friend". */
function giftLabel() {
  const [c, g] = canvas(256, 96);
  g.fillStyle = '#f1e8d2';
  g.fillRect(0, 0, 256, 96);
  g.strokeStyle = '#b08a5a';
  g.lineWidth = 4;
  g.strokeRect(2, 2, 252, 92);
  g.fillStyle = '#3a2a1a';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '600 38px "Caveat", cursive';
  g.fillText('a gift from', 128, 30);
  g.fillText('a friend', 128, 66);
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ map: texture(c), roughness: 0.85 });
  const card = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.032, 0.002), mat);
  card.position.y = 0.075;
  group.add(card);
  const stake = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.07, 0.002), new THREE.MeshStandardMaterial({ color: '#efe6d0', roughness: 0.8 }));
  stake.position.y = 0.035;
  group.add(stake);
  group.traverse((o) => (o.castShadow = true));
  return group;
}

export const buildKit: KitModule['buildKit'] = ({ quality, scene, log }) => {
  log('OPENING THE VENTS', 40);
  const grounds = buildGrounds(quality);
  const house = buildHouse(quality);
  house.glass.uniforms.uSunDir.value.copy(SUN);
  const bed = buildBed(grounds.daylight);
  log('WATERING THE STAGING', 55);
  const flowers = buildFlowers(quality);
  const light = buildLight(quality);
  const bee = buildBee();
  const tools = buildTools(house.materials.wood);
  const catalog = buildCatalog();
  catalog.group.position.copy(CATALOG.at);
  catalog.group.rotation.set(CATALOG.tilt, Math.PI, 0, 'YXZ');
  const band = buildBand();
  const extras = new THREE.Group();
  scene.environmentIntensity = 0.07;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- the garden: this browser's own, and any gift that came with the link ----------------------
  let garden: Garden = load();
  // A gift left waiting on the bench last time goes into a pot if one's free now.
  if (settle(garden) >= 0) keep(garden);
  let giftAt: number | null = null;
  const asked = new URLSearchParams(location.search).get('bloom');
  if (asked !== null) {
    // Whatever's in the link is a stranger's typing: only a well-formed code gets in (see decode).
    giftAt = receive(garden, asked.slice(0, 32), Date.now());
    if (giftAt !== null) keep(garden);
  }
  // Genomes by code, worked out once (the frame asks every frame).
  const known = new Map<string, Genome | null>();
  const genomeOf = (code: string | null | undefined): Genome | null => {
    if (!code) return null;
    let g = known.get(code);
    if (g === undefined) {
      g = decode(code);
      if (known.size > 500) known.clear();
      known.set(code, g);
    }
    return g;
  };
  const showPlant: Plant = { code: encode(SHOW.example), born: 0, watered: Date.now(), parents: null, gift: false };
  /** What's in each slot: the staging's pots, the gift waiting on the bench, the show plant. */
  const plantIn = (i: number): Plant | null => (i < POTS ? garden.pots[i] : i === GIFT_POT ? garden.waiting : showPlant);
  const genomeIn = (i: number): Genome | null => genomeOf(plantIn(i)?.code);
  /** How fast things grow (the tests speed it up). */
  let speed = 1;
  const grown = (i: number, now = Date.now()) => {
    const p = plantIn(i);
    return p ? growth(p, now, speed) : 0;
  };
  const blooming = (i: number, now = Date.now()) => grown(i, now) >= 0.86;
  const nameOf = (code: string | null | undefined) => {
    const g = genomeOf(code);
    return g ? gardenName(g) : 'a flower';
  };

  // Labels on gifts, one per slot, shown when there's a gift in it.
  const labels = POT_AT.map((p) => {
    const l = giftLabel();
    l.position.copy(p).add(v(0.05, POT.h * 0.8, 0.06));
    l.rotation.set(-0.15, 0.4, 0.1);
    l.visible = false;
    extras.add(l);
    return l;
  });

  // What's showing in each slot, so a pot is only rebuilt when it changes.
  const shown: (string | null)[] = Array.from({ length: SLOTS }, () => null);
  const opened = new Uint8Array(SLOTS);
  const sync = () => {
    const now = Date.now();
    for (let i = 0; i < SLOTS; i++) {
      const p = plantIn(i);
      const code = p?.code ?? null;
      if (code !== shown[i]) {
        shown[i] = code;
        flowers.set(i, genomeOf(code), code ? hash(`${code}${i}`) : 0);
        // Already in flower when it arrived: no bell for it.
        opened[i] = p && inBloom(p, now, speed) ? 1 : 0;
      }
      labels[i].visible = !!p?.gift;
    }
  };
  sync();

  const droop = new Float32Array(SLOTS);
  const droopV = new Float32Array(SLOTS);
  let selected = -1;
  let pending = -1;
  let lensOn = -1;
  let hoverSlot = -1;
  let hoverAt = -1;
  let clock = 0;
  let busy = false;
  let wiring: Wiring | null = null;
  let arrived = '';
  let welcomed = false;
  let rain = 0;
  let showerOn = false;
  let forced: boolean | null = null;
  let nextShower = 70 + Math.random() * 50;
  let showerEnd = 0;
  let beeNext = 0;
  /** The notes of the flowers in bloom, gathered each frame (the same array every time), and a sum to tell when they change. */
  const notes: number[] = [];
  let notesKey = -1;
  const say = (text: string) => wiring?.say(text);
  const card: Wiring['card'] = (kicker, title, body, actions) => wiring?.card(kicker, title, body, actions);

  // --- where things are, for the bee and the camera ---------------------------------------------------
  const mainBloom = (i: number) => flowers.blooms(i)[0] ?? { at: flowers.top(i), axis: v(0, 1, 0), size: 0.06 };
  /** Where the bee lands on a flower: on its face, a little out. */
  const landing = (i: number) => {
    const b = mainBloom(i);
    return b.at.clone().addScaledVector(b.axis, 0.018).add(v(0, 0.012, 0));
  };
  /** The close look at a flower: in front of its main bloom and a little above, out over the aisle. */
  const bloomShot = (i: number): Shot => {
    const b = mainBloom(i);
    const dir = v(b.axis.x * 0.25, 0.42, 1).normalize();
    const pos = b.at.clone().addScaledVector(dir, 0.34 + b.size * 2.5);
    for (let k = 0; k < 12 && !roomy(pos); k++) pos.addScaledVector(dir, 0.1);
    return { pos, target: b.at.clone().add(v(0, -0.008, 0)), fov: 30, near: 0.02, lean: 0.006, shift: CARD };
  };

  // --- the cards ------------------------------------------------------------------------------------
  const counts = () => {
    const now = Date.now();
    let inFlower = 0;
    let young = 0;
    let dry = 0;
    garden.pots.forEach((p, i) => {
      if (!p) return;
      if (blooming(i, now)) inFlower++;
      else young++;
      if (thirst(p, now) > 0.05) dry++;
    });
    return { inFlower, young, dry, empty: garden.pots.filter((p) => !p).length };
  };
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const stagingCard = () => {
    const c = counts();
    card(
      'The staging',
      'Breed a flower',
      [
        'Click a flower, then another, and the bee carries the pollen from one to the other. The seed goes into an empty pot and grows in about twenty seconds.',
        'Children take after both parents, with now and then a surprise.',
        { note: `${plural(c.inFlower, 'flower', 'flowers')} in bloom · ${c.young ? `${c.young} growing · ` : ''}${c.empty ? plural(c.empty, 'empty pot', 'empty pots') : 'no empty pots (compost one to make room)'}${c.dry ? ` · ${plural(c.dry, 'plant', 'plants')} thirsty` : ''}` },
      ],
      [
        ...(c.dry ? [{ label: 'Water them all', run: () => void waterAll() }] : []),
        { label: 'Pick a flower by name', run: () => pickCard() },
        { label: 'The seed catalog', run: () => wiring?.goTo('catalog') },
        { label: 'Start the garden over', quiet: true, run: () => startOverCard() },
      ],
    );
  };
  /** The flowers in bloom, as buttons: for picking one without pointing at it. */
  const inFlower = (except = -1) => garden.pots.map((p, i) => (p && i !== except && blooming(i) ? i : -1)).filter((i) => i >= 0);
  const pickCard = () =>
    card('The staging', 'Pick a flower', [{ note: 'The flowers in bloom, by name and pot.' }], [
      ...inFlower().map((i) => ({ label: `${nameOf(garden.pots[i]?.code)} · ${i + 1}`, run: () => select(i) })),
      { label: 'Back', quiet: true, run: () => stagingCard() },
    ]);
  const crossCard = (a: number) =>
    card(`Cross ${nameOf(garden.pots[a]?.code)} with`, 'Which flower?', [{ note: 'The bee takes the pollen to it, and a seed to an empty pot.' }], [
      ...inFlower(a).map((b) => ({ label: `${nameOf(garden.pots[b]?.code)} · ${b + 1}`, run: () => void cross(a, b) })),
      { label: 'Back', quiet: true, run: () => plantCard(a) },
    ]);
  const parentage = (p: Plant) => (p.gift ? 'A gift from a friend.' : p.parents ? `Seed of ${nameOf(p.parents[0])} and ${nameOf(p.parents[1])}.` : 'One of the first seeds in the house.');
  const emptyCard = () =>
    card('On the staging', 'An empty pot', ['Fresh soil, waiting. Pick two flowers and the bee brings their seed to the first empty pot.'], [{ label: 'The seed catalog', quiet: true, run: () => wiring?.goTo('catalog') }]);
  const fullCard = () =>
    card('On the staging', 'Every pot is full', ['There’s nowhere for the seed to go. Compost one you can spare first: click it, then the compost bin (or its Compost button).'], [
      { label: 'Never mind', quiet: true, run: () => putBack() },
    ]);
  /** Lets go of a picked flower: back to the staging's card. */
  const putBack = () => {
    selected = -1;
    if (atFlowers()) stagingCard();
  };
  const atFlowers = () => ['staging', 'bloom'].includes(wiring?.current() ?? '');
  const plantCard = (i: number) => {
    const p = garden.pots[i];
    const g = genomeIn(i);
    if (!p || !g) return emptyCard();
    const dry = thirst(p, Date.now()) > 0.05;
    card(
      `On the staging · pot ${i + 1}`,
      gardenName(g),
      [describe(g), { note: `${latinName(g)}. ${p.gift ? 'A gift from a friend. ' : ''}${dry ? 'It’s thirsty. ' : ''}Now click another flower to cross them.` }],
      [
        { label: 'Cross it with…', run: () => crossCard(i) },
        { label: 'Look through the lens', run: () => closer(i) },
        { label: 'Water it', run: () => void waterPot(i) },
        { label: 'Share this flower', run: () => void share(i) },
        { label: 'Cut it back', quiet: true, run: () => void prunePot(i) },
        { label: 'Compost it', quiet: true, run: () => void compostPot(i) },
        { label: 'Never mind', quiet: true, run: () => putBack() },
      ],
    );
  };
  const seedlingCard = (i: number) => {
    const p = garden.pots[i];
    if (!p) return emptyCard();
    const left = Math.max(1, Math.ceil(((0.86 - grown(i)) * 20) / speed));
    card(`On the staging · pot ${i + 1}`, 'A seedling', [`${parentage(p)} It flowers in about ${plural(left, 'second', 'seconds')}.`, { note: 'Nobody knows what it will be until it opens.' }], [
      { label: 'Water it', run: () => void waterPot(i) },
      { label: 'Compost it', quiet: true, run: () => void compostPot(i) },
    ]);
  };
  const lensCard = (i: number) => {
    const p = plantIn(i);
    const g = genomeIn(i);
    if (!p || !g) return;
    if (!blooming(i)) {
      card('Under the lens', 'A seedling', ['Too young to say. The lens tells you everything once it flowers.', { note: parentage(p) }], [{ label: 'Back to the staging', quiet: true, run: () => wiring?.goTo('staging') }]);
      return;
    }
    card(`Under the lens · “${gardenName(g)}”`, latinName(g), [{ list: traits(g) }, { note: parentage(p) }], [
      ...(i < POTS ? [{ label: 'Share it', run: () => void share(i) }, { label: 'Water it', run: () => void waterPot(i) }] : []),
      { label: 'Back', quiet: true, run: () => wiring?.goTo('staging') },
    ]);
  };
  const startOverCard = () =>
    card('The staging', 'Start the garden over?', ['Every plant goes to the compost, the catalog loses its rosettes, and the first seeds come back. There’s no undoing it.'], [
      {
        label: 'Start over',
        run: () => {
          forget();
          garden = starter(Date.now());
          keep(garden);
          selected = -1;
          sync();
          catalog.show(catalog.page(), (id) => garden.stamps.includes(id));
          wiring?.sound.click();
          say('A FRESH START · THE FIRST SEEDS ARE BACK');
          stagingCard();
        },
      },
      { label: 'Keep my garden', quiet: true, run: () => stagingCard() },
    ]);
  /** The flower in bloom that's nearest to a wanted variety. */
  const nearest = (id: string) => {
    const w = WANTED.find((x) => x.id === id)!;
    let best = -1;
    let score = -1;
    garden.pots.forEach((p, i) => {
      const g = p && blooming(i) ? genomeOf(p.code) : null;
      if (g && w.near(g) > score) {
        score = w.near(g);
        best = i;
      }
    });
    return best;
  };
  const catalogCard = () => {
    const i = catalog.page();
    const w = WANTED[i];
    const done = garden.stamps.includes(w.id);
    const near = nearest(w.id);
    const g = near >= 0 ? genomeIn(near) : null;
    card(
      `The seed catalog · ${garden.stamps.length} of ${WANTED.length} rosettes`,
      w.name,
      [w.line, done ? 'Bred here: its page has the rosette.' : `${GRADE[w.difficulty]}. ${w.hint}`, ...(g && !done ? [{ note: `Nearest in your garden: ${gardenName(g)}, in pot ${near + 1}.` }] : [])],
      [
        { label: '‹ Back a page', run: () => turnPage(-1) },
        { label: 'Next page ›', run: () => turnPage(1) },
        { label: 'To the flowers', quiet: true, run: () => wiring?.goTo('staging') },
      ],
    );
  };
  const turnPage = (d: number) => {
    catalog.show(catalog.page() + d, (id) => garden.stamps.includes(id));
    wiring?.sound.page();
    if (wiring?.current() === 'catalog') catalogCard();
  };
  const showCard = () =>
    card('Best in show', SHOW.name, [SHOW.line, 'The prize of the house’s own show. It’s in the catalog, if you’d like to raise one yourself.'], [{ label: 'The seed catalog', run: () => wiring?.goTo('catalog') }]);
  const waitingCard = () =>
    card('On the potting bench', 'A gift from a friend', ['It came while every pot was full, so it’s waiting here. Compost one on the staging and it moves into the pot.'], [{ label: 'To the flowers', run: () => wiring?.goTo('staging') }]);

  // --- doing things -----------------------------------------------------------------------------
  const wait = (s: number) => new Promise<void>((r) => window.setTimeout(r, s * 1000));
  const select = (i: number) => {
    selected = i;
    wiring?.sound.click();
    if (!busy) void bee.fly([landing(i)], reduced ? 0.3 : 1.4 + bee.at().distanceTo(landing(i)) * 0.6);
    plantCard(i);
  };
  const closer = (i: number) => {
    const same = lensOn === i;
    selected = i;
    lensOn = i;
    Object.assign(SHOTS.bloom, bloomShot(i));
    // Already looking at this one: the card and the lens again.
    if (same && wiring?.current() === 'bloom' && !wiring.moving()) arrived = '';
    else {
      // Another flower: the lens goes back to its hook while the camera moves across.
      if (wiring?.current() === 'bloom') tools.hold(null);
      wiring?.goTo('bloom');
    }
  };
  /** The bee carries pollen from a to b, then a seed to an empty pot. */
  const cross = async (a: number, b: number) => {
    if (busy) return null;
    if (emptyPot(garden) < 0) return fullCard();
    busy = true;
    selected = -1;
    // (A garden started over while the bee's on its way is a different garden: the seed is lost.)
    const mine = garden;
    const here = (show: () => void) => garden === mine && atFlowers() && show();
    const nameA = nameOf(garden.pots[a]?.code);
    const nameB = nameOf(garden.pots[b]?.code);
    say(`POLLEN FROM ${nameA.toUpperCase()} TO ${nameB.toUpperCase()}`);
    here(() => card('The bee', 'Off it goes', [`From ${nameA} to ${nameB} with the pollen, then a seed to an empty pot.`], []));
    try {
      const A = landing(a);
      const B = landing(b);
      if (bee.at().distanceTo(A) > 0.03) await bee.fly([A], reduced ? 0.3 : 1.2 + bee.at().distanceTo(A) * 0.5);
      if (!reduced) await wait(0.5);
      await bee.fly([A.clone().lerp(B, 0.5).add(v(0, 0.22, 0.12)), B], reduced ? 0.3 : 1.4 + A.distanceTo(B) * 0.6, { pollen: true });
      if (!reduced) await wait(0.6);
      const pot = emptyPot(garden);
      if (garden !== mine) return null;
      if (pot < 0) return here(fullCard), null;
      const above = POT_AT[pot].clone().add(v(0, POT.h + 0.22, 0));
      await bee.fly([B.clone().lerp(above, 0.5).add(v(0, 0.18, 0.1)), above], reduced ? 0.3 : 1.2 + B.distanceTo(above) * 0.6, { seed: true });
      bee.drop();
      await wait(0.22);
      band.plop();
      if (garden !== mine) return null;
      const sown = sow(garden, a, b, Date.now());
      if (!sown) return here(fullCard), null;
      keep(garden);
      sync();
      say(`A SEED IN POT ${sown.pot + 1} · ABOUT TWENTY SECONDS`);
      here(() => card('On the staging', 'A seed is in', [`From ${nameA} and ${nameB}, in pot ${sown.pot + 1}. In about twenty seconds you’ll see what it is.`, { note: 'Pick two more whenever you like.' }], [{ label: 'Back to the staging', quiet: true, run: () => stagingCard() }]));
      // Then off to rest on a flower.
      window.setTimeout(() => {
        const open = [...Array(POTS).keys()].filter((i) => blooming(i));
        if (open.length && !busy) void bee.fly([landing(open[Math.floor(Math.random() * open.length)])], 2);
      }, 800);
      return sown;
    } finally {
      busy = false;
    }
  };
  const waterPot = async (i: number) => {
    if (tools.busy() || !garden.pots[i]) return;
    say('A GOOD DRINK');
    const going = tools.water(flowers.top(i));
    await wait(reduced ? 0 : 0.95);
    band.pour();
    water(garden, i, Date.now());
    keep(garden);
    await going;
    if (wiring?.current() === 'staging' && selected === i) plantCard(i);
  };
  const waterAll = async () => {
    const now = Date.now();
    const dry = garden.pots.map((p, i) => (p && thirst(p, now) > 0.05 ? i : -1)).filter((i) => i >= 0);
    for (const i of dry.slice(0, 8)) await waterPot(i);
    if (wiring?.current() === 'staging') stagingCard();
  };
  const prunePot = async (i: number) => {
    if (tools.busy() || busy || !garden.pots[i]) return;
    const plan = flowers.plan(i);
    const going = tools.snip(POT_AT[i].clone().add(v(0, POT.h + (plan ? plan.height * 0.5 : 0.1), 0.02)));
    await wait(reduced ? 0 : 0.85);
    band.snip();
    prune(garden, i, Date.now());
    keep(garden);
    opened[i] = 0;
    say('CUT BACK · IT WILL FLOWER AGAIN IN A MOMENT');
    await going;
  };
  const compostPot = async (i: number) => {
    if (tools.busy() || busy || !garden.pots[i]) return;
    const g = genomeIn(i);
    const top = flowers.top(i);
    if (selected === i) selected = -1;
    compost(garden, i);
    keep(garden);
    sync();
    say('TO THE COMPOST');
    await tools.compost(top.add(v(0, -0.15, 0)), new THREE.Color(g ? FOLIAGE[g.foliage] : FOLIAGE[0]));
    band.thunk();
    if (wiring?.current() === 'staging') stagingCard();
  };
  const share = async (i: number) => {
    const p = garden.pots[i];
    if (!p) return;
    const link = shareLink(location.origin, p.code);
    let copied = false;
    try {
      await navigator.clipboard.writeText(link);
      copied = true;
    } catch {
      // No clipboard here (or not allowed): the link is on the card to copy by hand.
    }
    const g = decode(p.code)!;
    /** Selects the link on the card, ready to copy by hand. */
    const selectLink = () => {
      const note = document.querySelector('#card-body .note');
      const sel = window.getSelection();
      if (note && sel) sel.selectAllChildren(note);
    };
    card('Share this flower', gardenName(g), [copied ? 'The link is copied. Send it to a friend and the flower grows in a pot in their greenhouse.' : 'Copy this link and send it to a friend; the flower grows in a pot in their greenhouse.', { note: link }], [
      ...(copied ? [] : [{ label: 'Select the link', run: selectLink }]),
      { label: 'Back to the flower', quiet: true, run: () => plantCard(i) },
    ]);
    if (copied) say('LINK COPIED · SEND IT TO A FRIEND');
    else selectLink();
  };
  const clickPot = (i: number) => {
    if (i === SHOW_POT) {
      if (wiring?.current() !== 'honors') wiring?.goTo('honors');
      return showCard();
    }
    if (i === GIFT_POT) return waitingCard();
    const here = wiring?.current();
    if (here !== 'staging' && here !== 'bloom') {
      pending = i;
      wiring?.goTo('staging');
      return;
    }
    const p = garden.pots[i];
    if (!p) return emptyCard();
    if (!blooming(i)) return seedlingCard(i);
    if (busy) return say('THE BEE IS BUSY · A MOMENT');
    if (here === 'bloom') {
      if (lensOn !== i) closer(i);
      return;
    }
    if (selected < 0) return select(i);
    if (selected === i) return closer(i);
    void cross(selected, i);
  };

  // --- the kit ---------------------------------------------------------------------------------------
  let line: Studio['line'] | null = null;
  /** The little things on the bench: a few pixels from out on the lawn, so not drawn until the camera's in the house. */
  let trinkets: THREE.Object3D[] = [];
  let dressing: ReturnType<typeof arrangeStudio> | null = null;
  const walls = [
    { id: 'desk', name: 'The potting bench' },
    { id: 'honors', name: 'The prizes', members: ['diplomas', 'medals'] },
    { id: 'library', name: 'Books & seeds', members: ['catalog'] },
    { id: 'places', name: 'Map, shirts & shoes', members: ['map', 'shoes', 'projects'] },
    { id: 'staging', name: 'The flowers', members: ['bloom'] },
  ];
  const right = new THREE.Vector3();
  const toBee = new THREE.Vector3();
  const toCam = new THREE.Vector3();
  const side = new THREE.Vector3();
  const UP = v(0, 1, 0);

  const kit: Kit = {
    objects: [grounds.group, house.group, bed.group, flowers.group, light.group, bee.group, tools.group, catalog.group, extras],
    board: bed,
    shots: {
      // Out on the lawn, a little above it, looking in through the front glass: the bench, the books, the flowers.
      vista: { pos: v(-1.6, 2.7, -6.9), target: v(0.4, 1.65, 1.0), fov: 50, lean: 0.25 },
      // Nose to the front glass over the bench, looking out toward the sun.
      window: { pos: v(1.15, 1.6, -1.55), target: v(-1.2, 1.5, -14), fov: 54, lean: 0.04 },
      // The bedding on the bank across the lawn: close to the glass between two bars, so none crosses
      // the letters, and wide enough for all sixteen beds.
      board: { pos: v(0.9, 1.7, -1.95), target: BANK.center.clone().add(v(0, 0.05, 0)), fov: 34, lean: 0.01 },
    },
    // Along the front of the house to the open door at the sunny end, in, and back along the aisle to the bench.
    intro: { via: [v(-4.8, 2.3, -5.6), v(-8.3, 1.8, -3.0), v(HOUSE.x0 - 1.5, 1.55, HOUSE.door.z), v(HOUSE.x0 + 0.9, 1.55, HOUSE.door.z), v(-2.5, 1.5, 0.95)], duration: 11, lines: ['EVOLVING WORD', 'A LITTLE STUDIO UNDER GLASS', 'WHERE WE MAKE THINGS TOGETHER'] },
    tagline: 'A LITTLE STUDIO UNDER GLASS.',
    band,
    walls,
    route,

    arrange(s: Studio) {
      line = s.line;
      trinkets = [s.watch.group, s.pad.group, s.treats.group, s.rolodex.group];
      dressing = arrangeStudio(s, house.materials);
      extras.add(dressing.group);
      // The sun is the light in here: the desk lamp still lights, but leaves the shadows to the sun.
      s.desk.group.traverse((o) => {
        if ((o as THREE.SpotLight).isSpotLight) o.castShadow = false;
      });
      // In the low sun, the bigger pieces throw shadows (the bench, the CRT, the lamp, the shirts and
      // herbs, the shoes, the frames); the small things don't need to, and every caster costs a draw.
      for (const o of [s.desk.group, s.watch.group, s.pad.group, s.treats.group, s.rolodex.group, s.honors.group, s.map.group, s.shelf.group]) castsSun(o, false);
      for (const o of s.desk.group.children) if ((o as THREE.Mesh).geometry?.type === 'RoundedBoxGeometry') castsSun(o);
      for (const o of s.shelf.group.children) if ((o as THREE.Mesh).geometry?.type === 'BoxGeometry' || (o as THREE.InstancedMesh).isInstancedMesh) castsSun(o);
      for (const d of s.honors.diplomas) castsSun(d.children[0]);
      castsSun(s.map.group.children[0]);
      for (const o of [s.desk.lamp, s.desk.crtScreen.parent!, s.line.group, s.shoes.group, ...dressing.casters]) castsSun(o);
    },

    closeups() {
      const first = garden.pots.findIndex((p) => !!p);
      return {
        staging: { pos: v(-3.35, 2.0, 1.0), target: v(-3.5, 1.05, -1.55), fov: 52, lean: 0.04, shift: CARD },
        bloom: bloomShot(Math.max(0, first)),
        catalog: { pos: CATALOG.at.clone().add(v(0, 0.6, -0.68)), target: CATALOG.at.clone().add(v(0, 0.02, 0)), fov: 36, near: 0.03, lean: 0.01, shift: CARD },
        honors: { pos: v(3.45, 1.66, 0.45), target: v(3.45, 1.7, HOUSE.back), fov: 44, lean: 0.04 },
        library: { pos: v(0.62, 1.5, 0.25), target: v(0.62, 1.12, HOUSE.back), fov: 54, lean: 0.04, shift: 0.1 },
        places: { pos: v(-3.7, 1.62, -0.25), target: v(-3.7, 1.42, HOUSE.back), fov: 62, lean: 0.05 },
      };
    },

    // Each shirt from straight out in front of it, in the aisle.
    projectShot(focus) {
      return { pos: v(focus.x + 0.15, focus.y + 0.04, focus.z - 1.6), target: focus.clone().add(v(0, 0.02, 0)), fov: 38, lean: 0.04, shift: CARD };
    },

    wire(w) {
      wiring = w;
      // Keys before the studio's own: Esc first lets go of a picked flower (then steps back as usual),
      // and the arrows turn the catalog's pages when you're reading it.
      window.addEventListener(
        'keydown',
        (e) => {
          if (e.metaKey || e.ctrlKey || e.altKey || document.getElementById('reader')?.hidden === false) return;
          const here = w.current();
          if (e.key === 'Escape' && here === 'staging' && selected >= 0 && !busy) {
            putBack();
            w.sound.click();
          } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && here === 'catalog' && !w.moving()) turnPage(e.key === 'ArrowRight' ? 1 : -1);
          else return;
          e.preventDefault();
          e.stopImmediatePropagation();
        },
        true,
      );
      flowers.pick.forEach((object, i) =>
        w.touch({
          object,
          noGlow: true,
          when: () => i !== GIFT_POT || !!garden.waiting,
          label: () => {
            hoverSlot = i;
            hoverAt = clock;
            if (i === SHOW_POT) return 'Best in show';
            const p = plantIn(i);
            if (!p) return 'An empty pot';
            if (i === GIFT_POT) return 'A gift from a friend';
            if (!blooming(i)) return 'A seedling';
            const name = nameOf(p.code);
            if (selected >= 0 && selected !== i) return `Cross with ${name}`;
            if (selected === i) return 'Look closer';
            return name;
          },
          onClick: () => clickPot(i),
        }),
      );
      const atFlowers = () => ['staging', 'bloom'].includes(w.current());
      w.touch({
        object: tools.can,
        label: () => (selected >= 0 ? `Water ${nameOf(garden.pots[selected]?.code)}` : 'The watering can'),
        onClick: () => {
          if (!atFlowers()) return w.goTo('staging');
          if (selected >= 0) return void waterPot(selected);
          if (counts().dry) return void waterAll();
          card('The tools', 'The watering can', ['Everything’s had a drink. Plants left a long while without one start to droop; a drink brings them straight back up.'], []);
        },
      });
      w.touch({
        object: tools.shears,
        label: 'The shears',
        onClick: () => {
          if (!atFlowers()) return w.goTo('staging');
          if (selected >= 0) return void prunePot(selected);
          card('The tools', 'The shears', ['Pick a flower first, then the shears cut it back to its leaves. It flowers again in a few seconds.'], []);
        },
      });
      w.touch({
        object: tools.lens,
        label: 'The hand lens',
        onClick: () => {
          if (!atFlowers()) return w.goTo('staging');
          if (selected >= 0) return closer(selected);
          card('The tools', 'The hand lens', ['Pick a flower first, then look at it through the lens: its name, everything about it, and where it came from.'], []);
        },
      });
      w.touch({
        object: tools.bin,
        label: () => (selected >= 0 ? `Compost ${nameOf(garden.pots[selected]?.code)}` : 'The compost bin'),
        onClick: () => {
          if (!atFlowers()) return w.goTo('staging');
          if (selected >= 0) return void compostPot(selected);
          const n = garden.composted;
          card('The tools', 'The compost bin', [`Pick a flower first, then the bin, and it goes on the heap to make room. ${n ? `${n} so far.` : 'Nothing on it yet.'}`], []);
        },
      });
      w.touch({
        object: catalog.book,
        label: () => (w.current() === 'catalog' ? 'Turn the page' : 'The seed catalog'),
        onClick: () => (w.current() === 'catalog' ? turnPage(1) : w.goTo('catalog')),
      });
      for (const r of dressing?.rosettes ?? []) w.touch({ object: r, label: 'A rosette', onClick: () => w.goTo('medals') });
    },

    frame({ t, dt, camera, renderer, shot, ready }) {
      clock = t;
      const now = Date.now();
      sync();
      // Each plant: its age, a spring for its droop (so water brings it up with a little bounce), a glow when picked or pointed at.
      notes.length = 0;
      let key = 0;
      for (let i = 0; i < SLOTS; i++) {
        const p = plantIn(i);
        const g = p ? growth(p, now, speed) : 0;
        const aim = p && i !== SHOW_POT ? thirst(p, now) * 0.85 : 0;
        droopV[i] += ((aim - droop[i]) * 36 - droopV[i] * 4.5) * dt;
        droop[i] = THREE.MathUtils.clamp(droop[i] + droopV[i] * dt, -0.3, 1);
        // (Not under the lens: there it's the only flower you're looking at.)
      const glow = (i === selected && shot !== 'bloom' ? 0.6 + 0.25 * Math.sin(t * 2.6) : 0) + (i === hoverSlot && t - hoverAt < 0.15 && shot !== 'bloom' ? 0.45 : 0);
        flowers.state(i, g, droop[i], glow);
        if (!p || g < 0.86) continue;
        const genome = genomeOf(p.code);
        if (!genome) continue;
        notes.push(genome.note);
        key = (Math.imul(key, 31) + genome.note + 1) | 0;
        // A flower opening: its note, and if it's one the catalog wants, a rosette.
        if (!opened[i]) {
          opened[i] = 1;
          band.bloom(genome.note);
          // Only what's bred here earns a rosette: not the first seeds, not a gift.
          const fresh = i < POTS && p.parents ? newStamps(garden, genome) : [];
          if (fresh.length) {
            garden.stamps.push(...fresh);
            keep(garden);
            for (const id of fresh) catalog.stamp(id);
            band.stamp();
            say(`${WANTED.find((x) => x.id === fresh[0])!.name.toUpperCase()} · BRED HERE · THE CATALOG HAS ITS ROSETTE`);
          }
        }
      }
      if (key !== notesKey) {
        notesKey = key;
        band.setNotes(notes);
      }

      // The bee: when you're at the flowers and it isn't busy, it potters from one to another.
      const atFlowers = shot === 'staging' || shot === 'bloom';
      if (atFlowers && !busy && selected < 0 && !bee.flying() && t > beeNext) {
        beeNext = t + 5 + Math.random() * 6;
        const open = [...Array(POTS).keys()].filter((i) => blooming(i, now));
        if (open.length) {
          const to = landing(open[Math.floor(Math.random() * open.length)]);
          void bee.fly([bee.at().lerp(to, 0.5).add(v(0, 0.15, 0.1)), to], 2 + bee.at().distanceTo(to) * 0.5);
        }
      }
      bee.tick(t, dt);
      right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      bee.at(toBee).sub(camera.position);
      const dist = toBee.length();
      band.bee(bee.buzz(), THREE.MathUtils.clamp(1 - dist / 4, 0, 1), toBee.normalize().dot(right));

      // Arriving somewhere of ours: its card.
      const still = wiring ? !wiring.moving() : true;
      const here = still && ready ? shot : '';
      if (here !== arrived) {
        arrived = here;
        if (here === 'staging') {
          if (pending >= 0) {
            const i = pending;
            pending = -1;
            if (!garden.pots[i]) emptyCard();
            else if (!blooming(i)) seedlingCard(i);
            else select(i);
          } else if (selected >= 0) plantCard(selected);
          else stagingCard();
          if (!welcomed && giftAt === null) {
            welcomed = true;
            say('PICK A FLOWER, THEN ANOTHER · THE BEE DOES THE REST');
          }
        }
        if (here === 'catalog') catalogCard();
        if (here === 'bloom' && lensOn >= 0) {
          const b = mainBloom(lensOn);
          toCam.copy(camera.position).sub(b.at).normalize();
          side.crossVectors(toCam, UP).normalize();
          // The lens held beside the bloom, low and to the right, a little toward the eye.
          tools.hold(b.at.clone().addScaledVector(toCam, 0.1).addScaledVector(side, -(b.size * 0.85 + 0.03)).add(v(0, -b.size * 0.5, 0)), camera.position.clone());
          lensCard(lensOn);
        }
      }
      if (shot !== 'bloom' && lensOn >= 0) {
        lensOn = -1;
        tools.hold(null);
      }
      if (shot !== 'staging' && shot !== 'bloom') selected = -1;
      // A gift: say so once we're in.
      if (ready && giftAt !== null && !welcomed) {
        welcomed = true;
        say(giftAt >= 0 ? `A GIFT FROM A FRIEND IS GROWING IN POT ${giftAt + 1} · GO AND SEE` : 'A GIFT FROM A FRIEND IS WAITING ON THE POTTING BENCH');
      }

      // Now and then a shower passes over.
      if (forced === null) {
        if (!showerOn && t > nextShower) {
          showerOn = true;
          showerEnd = t + 50 + Math.random() * 30;
        } else if (showerOn && t > showerEnd) {
          showerOn = false;
          nextShower = t + 200 + Math.random() * 160;
        }
      }
      const wet = forced ?? showerOn;
      rain += ((wet ? 1 : 0) - rain) * (1 - Math.exp(-dt / 5));
      house.tick(t, rain);
      grounds.setRain(rain);
      light.tick(t, rain);
      band.rain(rain);

      const indoors = kit.outside(camera) < 1;
      for (const o of trinkets) o.visible = indoors;
      tools.tick(t, dt);
      catalog.tick(t, dt);
      // (The scent's motes keep their size in meters whatever the lens.)
      flowers.tick(t, renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)));
      grounds.tick(t);
      // The rosettes stir a little in the air from the vents.
      for (const r of dressing?.rosettes ?? []) r.rotation.z = Math.sin(t * 0.8 + (r.userData.phase as number)) * 0.03;
    },

    outside(camera) {
      const p = camera.position;
      if (p.x < HOUSE.x0 || p.x > HOUSE.x1 || p.z < HOUSE.front || p.z > HOUSE.back) return 1;
      // In the house, the garden (and the rain on the glass) is louder the nearer the glass you are.
      return THREE.MathUtils.clamp(1 - (p.z - HOUSE.front) / 2.6, 0, 1) * 0.6;
    },

    debug: {
      grounds,
      house,
      bed,
      flowers,
      bee,
      tools,
      catalog,
      light,
      band,
      shots: SHOTS,
      garden: () => garden,
      /** Growth this many times faster (for the tests). */
      speed: (k: number) => {
        // Each plant keeps its place in its growing as the clock changes.
        const now = Date.now();
        for (const p of garden.pots) if (p) p.born = now - ((now - p.born) * speed) / k;
        speed = k;
      },
      select: (i: number) => select(i),
      breed: (a: number, b: number) => cross(a, b),
      water: (i: number) => waterPot(i),
      prune: (i: number) => prunePot(i),
      compost: (i: number) => compostPot(i),
      lens: (i: number) => closer(i),
      shareLink: (i: number) => (garden.pots[i] ? shareLink(location.origin, garden.pots[i]!.code) : null),
      /** Make it rain (true), clear (false), or let the weather do as it likes (null); `now` skips the easing. */
      shower: (on: boolean | null, now = false) => {
        forced = on;
        if (now && on !== null) rain = on ? 1 : 0;
      },
      busy: () => busy || tools.busy() || bee.flying(),
      line: () => line,
      solid: (p: THREE.Vector3) => solid(p),
      roomy: (p: THREE.Vector3) => roomy(p),
      settle: () => (settle(garden), keep(garden)),
      /**
       * For the tests: every walk between two places (each wall, each close-up,
       * each shirt, each flower's close look, and the way in) checked for
       * anything solid within a few centimeters, and every place for room to stand.
       */
      blocked: () => {
        const out: string[] = [];
        const at: Record<string, THREE.Vector3> = {};
        for (const w of walls) for (const n of [w.id, ...(w.members ?? [])]) if (n !== 'projects' && n !== 'bloom' && SHOTS[n]) at[n] = SHOTS[n].pos;
        for (const n of ['signal', 'about', 'watch', 'pad', 'treats', 'work', 'window', 'board']) at[n] = SHOTS[n].pos;
        line?.items.forEach((it, i) => (at[`projects ${i + 1}`] = kit.projectShot!(it.focus.clone(), i)!.pos));
        for (let i = 0; i < POTS; i++) if (garden.pots[i]) at[`bloom ${i + 1}`] = bloomShot(i).pos;
        for (const [a, p] of Object.entries(at)) if (!roomy(p)) out.push(`${a} has no room`);
        for (const [a, p] of Object.entries(at))
          for (const [b, q] of Object.entries(at)) if (a !== b && !clear(p, q, route(p, q) ?? [], 0.03)) out.push(`${a} -> ${b}`);
        if (!clear(kit.shots.vista.pos, SHOTS.desk.pos, kit.intro.via, 0.03)) out.push('the way in');
        const way = new THREE.CatmullRomCurve3([kit.shots.vista.pos, ...kit.intro.via, SHOTS.desk.pos], false, 'centripetal');
        for (let i = 1; i < 10; i++) {
          const p = way.getPoint(i / 10);
          for (const [b, q] of Object.entries(at)) if (!clear(p, q, route(p, q) ?? [], 0.03)) out.push(`the way in (${i}/10) -> ${b}`);
        }
        return out;
      },
    },
  };
  return kit;
};
