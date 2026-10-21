// The cell wall. From inside it's the cathedral's glass: windows between dark
// ribs (the cortex just under the membrane) and stretches of plain membrane,
// each window leaded into panes of ruby, amber, rose and gold, cobalt, violet and
// teal, the light outside coming through brightest from one side and from above.
// Shafts of it reach in through the haze. From outside it's a lantern: a glassy
// skin bright at its edge with a glint on it, the glow inside showing through,
// specks drifting in the warm dark round it.
import * as THREE from 'three';
import { CELL, HAZE, NOISE, shared } from './shaders';

const WALL_VERT = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vDir;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vDir = normalize(position);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const WALL_FRAG = /* glsl */ `
  uniform vec4 uBright;
  varying vec3 vWorld;
  varying vec3 vDir;
  ${HAZE}
  ${NOISE}
  vec3 paneColor(float id, float theme) {
    // Each window keeps to a few colors: ruby and gold, amber and rose, cobalt and
    // violet, teal and gold. Now and then a pane of clear white-gold.
    vec3 ruby = vec3(0.9, 0.06, 0.12);
    vec3 rose = vec3(1.0, 0.3, 0.42);
    vec3 amber = vec3(1.0, 0.45, 0.06);
    vec3 gold = vec3(1.0, 0.74, 0.25);
    vec3 cobalt = vec3(0.12, 0.2, 0.95);
    vec3 violet = vec3(0.5, 0.18, 0.9);
    vec3 teal = vec3(0.05, 0.6, 0.62);
    vec3 a; vec3 b; vec3 c;
    if (theme < 0.3) { a = ruby; b = gold; c = amber; }
    else if (theme < 0.58) { a = amber; b = rose; c = gold; }
    else if (theme < 0.78) { a = cobalt; b = violet; c = rose; }
    else { a = teal; b = gold; c = cobalt; }
    vec3 col = id < 0.45 ? a : id < 0.8 ? b : c;
    return id > 0.96 ? vec3(1.0, 0.9, 0.7) : col;
  }
  void main() {
    vec3 d = normalize(vDir);
    // The windows, and the panes inside each.
    vec3 big = voronoi(d * 2.6);
    float edge = big.y - big.x;
    // Some of the wall is windows, some is plain membrane between them, dark and soft.
    float win = step(0.34, hash13(vec3(big.z * 37.0)));
    // Behind the map, a window always, and bright, so the map hangs against the light.
    float off = 1.0 - dot(d, uBright.xyz);
    float behind = uBright.w > 0.0 ? 1.0 - smoothstep(uBright.w, uBright.w * 1.8, off) : 0.0;
    win = max(win, behind);
    vec3 small = voronoi(d * 11.0 + big.z * 13.0);
    float lead = smoothstep(0.0, 0.05, small.y - small.x);
    vec3 pane = paneColor(small.z, big.z);
    // Light behind the glass isn't even: brighter patches, fine streaks in the glass itself.
    float patchy = 0.55 + 0.9 * vnoise(d * 6.0 + big.z * 5.0);
    float streak = 0.85 + 0.3 * vnoise(vec3(d.x * 140.0, d.y * 30.0, d.z * 140.0));
    float lit = mix(0.25 + 1.0 * pow(hash13(vec3(big.z * 91.0)), 1.4), 1.0, behind);
    float sun = max(0.4 + 1.3 * pow(max(dot(d, uSun), 0.0), 1.6), 1.5 * behind);
    float up = max(mix(0.35, 1.0, smoothstep(-0.8, 0.9, d.y)), behind);
    // Dimmer toward the frame, as light through a deep window is.
    float inset = smoothstep(0.08, 0.32, edge);
    float glow = 0.7 + 0.6 * (1.0 - smoothstep(0.0, 0.6, small.x));
    float breathe = 0.88 + 0.12 * sin(uTime * 0.21 + big.z * 30.0 + small.z * 4.0);
    vec3 glassCol = pane * lit * sun * up * glow * patchy * streak * breathe * mix(0.25, 1.0, inset);
    // Soft leading: dark, but with a little of the glass's light about it.
    glassCol = mix(glassCol * 0.12, glassCol, lead);
    // The plain membrane: a deep rose, faintly pebbled, a little sheen where the light catches it.
    vec3 fine = voronoi(d * 130.0);
    float pebble = smoothstep(0.0, 0.35, fine.x) * 0.5 + 0.5;
    vec3 wall = vec3(0.075, 0.025, 0.03) * pebble * (0.6 + 0.6 * vnoise(d * 9.0)) * sun * up;
    vec3 col = mix(wall, glassCol, win * smoothstep(0.03, 0.09, edge));
    // The ribs between the windows: darker bands with a lit edge.
    float rib = 1.0 - smoothstep(0.02, 0.07, edge);
    col = mix(col, vec3(0.03, 0.01, 0.01) + vec3(0.12, 0.05, 0.03) * smoothstep(0.0, 0.02, edge) * win, rib * 0.9);
    // Less haze on the glass itself than on what's in front of it: the windows read from anywhere.
    float f = 1.0 - exp(-insideLength(cameraPosition, vWorld) * uHazeK * 0.7);
    col = mix(col * 0.85, hazeColor(normalize(vWorld - cameraPosition)), f);
    gl_FragColor = vec4(col, 1.0);
  }
`;

// The outside of the skin: bright at its edge, a faint pattern of the windows
// across it, and mostly clear, so the lantern inside shows through.
const SKIN_FRAG = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vDir;
  ${HAZE}
  ${NOISE}
  void main() {
    vec3 d = normalize(vDir);
    vec3 v = normalize(cameraPosition - vWorld);
    float ndv = max(dot(d, v), 0.0);
    float rim = pow(1.0 - ndv, 2.2);
    vec3 big = voronoi(d * 2.6);
    float rib = 1.0 - smoothstep(0.02, 0.1, big.y - big.x);
    float sun = 0.5 + 0.8 * pow(max(dot(d, uSun), 0.0), 1.5);
    vec3 col = vec3(1.0, 0.55, 0.35) * rim * 1.1 * sun + vec3(1.0, 0.6, 0.35) * rib * 0.05 * sun;
    col += vec3(1.0, 0.75, 0.5) * pow(rim, 6.0) * 0.6;
    // A glass ball's highlights: a small bright one from the light, a broad soft sheen round it.
    vec3 r = reflect(-v, d);
    float spec = max(dot(r, normalize(uSun + vec3(-0.3, 0.1, 0.5))), 0.0);
    col += vec3(1.0, 0.92, 0.8) * (pow(spec, 220.0) * 2.5 + pow(spec, 18.0) * 0.12);
    gl_FragColor = vec4(col, 1.0);
  }
`;

// A shaft of light in from a bright window: strongest along its middle, fading
// in from the wall and out toward its end, with motes turning in it.
const SHAFT_VERT = /* glsl */ `
  varying vec3 vNrm;
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNrm = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const SHAFT_FRAG = /* glsl */ `
  uniform vec3 uTint;
  uniform float uSeed;
  varying vec3 vNrm;
  varying vec3 vWorld;
  varying vec2 vUv;
  ${HAZE}
  float h(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
  void main() {
    vec3 v = normalize(cameraPosition - vWorld);
    float core = pow(abs(dot(normalize(vNrm), v)), 2.0);
    float along = smoothstep(1.0, 0.9, vUv.y) * smoothstep(0.0, 0.18, vUv.y);
    vec2 g = vec2(vUv.x * 50.0, vUv.y * 70.0 - uTime * 0.18 + uSeed);
    float dust = step(0.986, h(floor(g))) * smoothstep(0.45, 0.0, length(fract(g) - 0.5));
    float pulse = 0.8 + 0.2 * sin(uTime * 0.13 + uSeed * 3.0);
    float a = core * along * (0.2 + dust * 1.0) * pulse;
    gl_FragColor = vec4(uTint * a * through(vWorld), 1.0);
  }
`;

export interface Membrane {
  group: THREE.Group;
  /** The outside world, seen only from the vista: specks drifting in the dark. */
  outside: THREE.Group;
  /** A bright window round this direction (from the cell's middle), this wide (1 - cos of its angle), whatever else the wall does there. */
  window(dir: THREE.Vector3, size: number): void;
  /** A shaft of light in through the wall from this direction (from the cell's middle), falling toward a point. */
  beam(from: THREE.Vector3, to: THREE.Vector3, radius: number, tint: string): void;
}

export function buildMembrane(quality: 'high' | 'low'): Membrane {
  const group = new THREE.Group();
  const segs = quality === 'high' ? 160 : 96;
  const sphere = new THREE.SphereGeometry(CELL.radius, segs, segs / 2);

  const wall = new THREE.Mesh(
    sphere,
    new THREE.ShaderMaterial({ vertexShader: WALL_VERT, fragmentShader: WALL_FRAG, uniforms: { ...shared, uBright: { value: new THREE.Vector4(0, -1, 0, 0) } }, side: THREE.BackSide }),
  );
  wall.position.copy(CELL.center);
  group.add(wall);

  const skin = new THREE.Mesh(
    sphere,
    new THREE.ShaderMaterial({
      vertexShader: WALL_VERT,
      fragmentShader: SKIN_FRAG,
      uniforms: { ...shared },
      side: THREE.FrontSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  skin.position.copy(CELL.center);
  // Drawn last, over the glow inside.
  skin.renderOrder = 10;
  group.add(skin);

  // Shafts of light in through the windows, each aimed at something.
  const beam = (from: THREE.Vector3, to: THREE.Vector3, r: number, tint: string) => {
    const start = CELL.center.clone().addScaledVector(from.clone().normalize(), CELL.radius - 0.3);
    const len = start.distanceTo(to) + 1.5;
    const geo = new THREE.CylinderGeometry(r * 0.75, r * 1.2, len, 28, 1, true);
    geo.translate(0, -len / 2, 0);
    const mat = new THREE.ShaderMaterial({
      vertexShader: SHAFT_VERT,
      fragmentShader: SHAFT_FRAG,
      uniforms: { ...shared, uTint: { value: new THREE.Color(tint) }, uSeed: { value: group.children.length * 7.3 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const shaft = new THREE.Mesh(geo, mat);
    shaft.position.copy(start);
    shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(start).normalize());
    group.add(shaft);
  };

  // --- outside: the warm dark ------------------------------------------------------
  const outside = new THREE.Group();
  // Specks drifting in the dark round it, near and far.
  const specks: number[] = [];
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    const u = r() * 2 - 1;
    const a = r() * Math.PI * 2;
    const k = CELL.radius * (1.4 + r() * 5);
    const q = Math.sqrt(1 - u * u);
    specks.push(CELL.center.x + Math.cos(a) * q * k, CELL.center.y + u * k, CELL.center.z + Math.sin(a) * q * k);
  }
  const speckGeo = new THREE.BufferGeometry();
  speckGeo.setAttribute('position', new THREE.Float32BufferAttribute(specks, 3));
  outside.add(new THREE.Points(speckGeo, new THREE.PointsMaterial({ color: '#ffb08a', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  group.add(outside);
  const bright = (dir: THREE.Vector3, size: number) => (wall.material as THREE.ShaderMaterial).uniforms.uBright.value.set(dir.x, dir.y, dir.z, size);
  return { group, outside, window: bright, beam };
}
