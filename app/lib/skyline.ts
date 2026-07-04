// Procedural pixel map of the Lujiazui skyline as seen from the Bund.
// Grid is y-up: rows 0-8 are the Huangpu river, row 9 the waterfront,
// buildings rise from row 10, sky fills the rest.

export const GRID_W = 64;
export const GRID_H = 52;
export const RIVER_TOP = 8; // highest river row
export const GROUND_Y = 9;

export type CellKind =
  | "sky"
  | "river"
  | "building"
  | "window"
  | "pearl"
  | "ground";

export interface Cell {
  x: number;
  y: number;
  kind: CellKind;
  day: [number, number, number]; // linear-ish RGB 0..1
  night: [number, number, number];
  accent: [number, number, number] | null; // night facade tint (per building)
  seed: number; // stable per-cell random, 0..1
}

// mulberry32 — deterministic so the mosaic is identical every load
function rng(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hex(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function mix(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function jitter(
  c: [number, number, number],
  amt: number,
  r: number,
): [number, number, number] {
  const f = 1 + (r * 2 - 1) * amt;
  return [Math.min(1, c[0] * f), Math.min(1, c[1] * f), Math.min(1, c[2] * f)];
}

// Palette: real lego plastic colors, Shanghai day -> night
const P = {
  skyTopDay: hex("#3F8FCC"),
  skyBotDay: hex("#A9D6EC"),
  skyTopNight: hex("#10162F"),
  skyBotNight: hex("#2E3E6E"),
  cloudDay: hex("#F3EFE4"),
  cloudNight: hex("#3C4460"),
  riverDay: hex("#2E6E7E"),
  riverNight: hex("#17293E"),
  groundDay: hex("#4A5158"),
  groundNight: hex("#232830"),
  concreteDay: hex("#9AA3AD"),
  concreteNight: hex("#39414E"),
  darkGlassDay: hex("#56728E"),
  darkGlassNight: hex("#242F4A"),
  blueGlassDay: hex("#4E7FB0"),
  blueGlassNight: hex("#2A3C5E"),
  goldDay: hex("#C9A353"),
  goldNight: hex("#6E5426"),
  pearlDay: hex("#C43E63"),
  pearlNight: hex("#E0537E"), // glows at night
  spireDay: hex("#8E9AA6"),
  spireNight: hex("#3A4254"),
  windowDay: hex("#B9C4CE"),
  windowNight: hex("#1E2638"), // twinkle overrides this at runtime
};

export const WINDOW_LIT: [number, number, number] = hex("#F5C86A");
export const CLOUD_DAY = P.cloudDay;
export const CLOUD_NIGHT = P.cloudNight;
export const LETTER_RED: [number, number, number] = hex("#C4281C");
export const BIRD_COLOR: [number, number, number] = hex("#2E3338");
export const BOAT_HULL: [number, number, number] = hex("#E8E4D8");
export const BOAT_LIGHT: [number, number, number] = hex("#FFD98A");
export const BEAM_COLOR: [number, number, number] = hex("#9FD4FF");

// night facade accents, inspired by the real illuminated Bund view:
// magenta, cyan, gold, crimson, violet
const ACCENTS: [number, number, number][] = [
  hex("#D2559C"),
  hex("#3FB8C9"),
  hex("#D9A441"),
  hex("#C2453E"),
  hex("#7E5BC2"),
];

type Style = "concrete" | "darkGlass" | "blueGlass" | "gold";

const STYLES: Record<
  Style,
  { day: [number, number, number]; night: [number, number, number] }
> = {
  concrete: { day: P.concreteDay, night: P.concreteNight },
  darkGlass: { day: P.darkGlassDay, night: P.darkGlassNight },
  blueGlass: { day: P.blueGlassDay, night: P.blueGlassNight },
  gold: { day: P.goldDay, night: P.goldNight },
};

export function buildSkyline(): Cell[] {
  const rand = rng(20260703);
  const grid: Cell[][] = [];
  let buildingCount = 0;

  // 1. Sky gradient everywhere
  for (let y = 0; y < GRID_H; y++) {
    grid[y] = [];
    for (let x = 0; x < GRID_W; x++) {
      const t = y / (GRID_H - 1); // 0 bottom -> 1 top
      const seed = rand();
      grid[y][x] = {
        x,
        y,
        kind: "sky",
        day: jitter(mix(P.skyBotDay, P.skyTopDay, t), 0.05, rand()),
        night: jitter(mix(P.skyBotNight, P.skyTopNight, t), 0.05, rand()),
        accent: null,
        seed,
      };
    }
  }

  const put = (
    x: number,
    y: number,
    kind: CellKind,
    day: [number, number, number],
    night: [number, number, number],
    accent: [number, number, number] | null = null,
  ) => {
    if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return;
    const c = grid[y][x];
    c.kind = kind;
    c.day = jitter(day, 0.06, rand());
    c.night = jitter(night, 0.06, rand());
    c.accent = accent;
  };

  // 2. Huangpu river (rows 0..8) and waterfront strip (row 9)
  for (let y = 0; y <= RIVER_TOP; y++) {
    for (let x = 0; x < GRID_W; x++)
      put(x, y, "river", P.riverDay, P.riverNight);
  }
  for (let x = 0; x < GRID_W; x++)
    put(x, GROUND_Y, "ground", P.groundDay, P.groundNight);

  // 3. Buildings: solid body, window cells on an offset grid, night accent tint
  const building = (x0: number, w: number, top: number, style: Style) => {
    const s = STYLES[style];
    const accent = ACCENTS[buildingCount++ % ACCENTS.length];
    for (let x = x0; x < x0 + w; x++) {
      for (let y = GROUND_Y + 1; y <= top; y++) {
        const isWindow =
          (x - x0) % 2 === 1 && (y - GROUND_Y - 1) % 2 === 0 && y < top;
        if (isWindow) put(x, y, "window", P.windowDay, P.windowNight, accent);
        else put(x, y, "building", s.day, s.night, accent);
      }
    }
  };

  // Puxi flank (left): four blocks with strong height contrast, each
  // separated by 2 empty sky columns so the silhouettes read individually
  building(1, 3, 14, "concrete");
  building(6, 3, 22, "darkGlass");
  building(11, 4, 16, "concrete");
  building(17, 3, 25, "darkGlass");
  // columns 20-22 stay open so the Pearl tripod stands alone

  // Oriental Pearl Tower (x 23..27)
  // tripod legs
  for (let y = 10; y <= 12; y++) {
    put(23, y, "building", P.spireDay, P.spireNight);
    put(25, y, "building", P.spireDay, P.spireNight);
    put(27, y, "building", P.spireDay, P.spireNight);
  }
  // lower sphere
  for (let y = 13; y <= 17; y++) {
    const half = y === 13 || y === 17 ? 1 : 2;
    for (let x = 25 - half; x <= 25 + half; x++)
      put(x, y, "pearl", P.pearlDay, P.pearlNight);
  }
  // shaft
  for (let y = 18; y <= 21; y++)
    put(25, y, "building", P.spireDay, P.spireNight);
  // upper sphere
  for (let y = 22; y <= 24; y++) {
    const half = y === 23 ? 1 : 0;
    for (let x = 25 - half; x <= 25 + half; x++)
      put(x, y, "pearl", P.pearlDay, P.pearlNight);
  }
  // antenna
  for (let y = 25; y <= 31; y++)
    put(25, y, "building", P.spireDay, P.spireNight);

  // Jin Mao Tower (gold, tiered, x 31..36)
  building(31, 6, 19, "gold");
  building(32, 4, 24, "gold");
  building(33, 2, 28, "gold");
  put(33, 29, "building", P.goldDay, P.goldNight);

  // Shanghai World Financial Center — the "bottle opener" (x 39..43)
  building(39, 5, 31, "darkGlass");
  // the trapezoid opening at the top reads as sky
  for (let y = 28; y <= 30; y++) {
    const c = grid[y][41];
    const t = y / (GRID_H - 1);
    c.kind = "sky";
    c.day = mix(P.skyBotDay, P.skyTopDay, t);
    c.night = mix(P.skyBotNight, P.skyTopNight, t);
    c.accent = null;
  }

  // Shanghai Tower (tallest, tapering blue glass, x 46..51)
  building(46, 6, 19, "blueGlass");
  building(46, 5, 25, "blueGlass");
  building(47, 4, 30, "blueGlass");
  building(48, 3, 34, "blueGlass");
  building(49, 2, 36, "blueGlass");

  // Pudong flank (right): stepping down and away from Shanghai Tower,
  // 2 empty sky columns between each block
  building(54, 3, 22, "darkGlass");
  building(59, 3, 14, "concrete");

  return grid.flat();
}

// tops of the two tallest structures, where searchlight beams originate
// and aircraft warning lights blink at night
export const BEACONS: { x: number; y: number }[] = [
  { x: 25, y: 31 }, // Oriental Pearl antenna tip
  { x: 49, y: 36 }, // Shanghai Tower cap
];
