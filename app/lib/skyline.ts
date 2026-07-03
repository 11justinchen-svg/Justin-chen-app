// Procedural pixel map of the Lujiazui skyline as seen from the Bund.
// Grid is y-up: row 0 is the river's edge, row H-1 is the top of the sky.

export const GRID_W = 64;
export const GRID_H = 40;

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
  skyTopNight: hex("#131A3B"),
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
  ) => {
    if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return;
    const c = grid[y][x];
    c.kind = kind;
    c.day = jitter(day, 0.06, rand());
    c.night = jitter(night, 0.06, rand());
  };

  // 2. Huangpu river (rows 0..4) and waterfront strip (row 5)
  for (let y = 0; y <= 4; y++) {
    for (let x = 0; x < GRID_W; x++)
      put(x, y, "river", P.riverDay, P.riverNight);
  }
  for (let x = 0; x < GRID_W; x++)
    put(x, 5, "ground", P.groundDay, P.groundNight);

  // 3. Buildings: solid body, window cells on an offset grid
  const building = (x0: number, w: number, top: number, style: Style) => {
    const s = STYLES[style];
    for (let x = x0; x < x0 + w; x++) {
      for (let y = 6; y <= top; y++) {
        const isWindow = (x - x0) % 2 === 1 && (y - 6) % 2 === 0 && y < top;
        if (isWindow) put(x, y, "window", P.windowDay, P.windowNight);
        else put(x, y, "building", s.day, s.night);
      }
    }
  };

  // Puxi flank (left): older, lower blocks
  building(1, 4, 13, "concrete");
  building(6, 3, 17, "darkGlass");
  building(10, 4, 15, "concrete");
  building(15, 3, 19, "darkGlass");
  building(19, 2, 12, "concrete");

  // Oriental Pearl Tower (x 22..28)
  // tripod legs
  for (let y = 6; y <= 8; y++) {
    put(23, y, "building", P.spireDay, P.spireNight);
    put(25, y, "building", P.spireDay, P.spireNight);
    put(27, y, "building", P.spireDay, P.spireNight);
  }
  // lower sphere
  for (let y = 9; y <= 13; y++) {
    const half = y === 9 || y === 13 ? 1 : 2;
    for (let x = 25 - half; x <= 25 + half; x++)
      put(x, y, "pearl", P.pearlDay, P.pearlNight);
  }
  // shaft
  for (let y = 14; y <= 17; y++)
    put(25, y, "building", P.spireDay, P.spireNight);
  // upper sphere
  for (let y = 18; y <= 20; y++) {
    const half = y === 19 ? 1 : 0;
    for (let x = 25 - half; x <= 25 + half; x++)
      put(x, y, "pearl", P.pearlDay, P.pearlNight);
  }
  // antenna
  for (let y = 21; y <= 27; y++)
    put(25, y, "building", P.spireDay, P.spireNight);

  // Jin Mao Tower (gold, tiered, x 31..36)
  building(31, 6, 15, "gold");
  building(32, 4, 20, "gold");
  building(33, 2, 24, "gold");
  put(33, 25, "building", P.goldDay, P.goldNight);

  // Shanghai World Financial Center — the "bottle opener" (x 39..43)
  building(39, 5, 27, "darkGlass");
  // the trapezoid opening at the top reads as sky
  for (let y = 24; y <= 26; y++) {
    const c = grid[y][41];
    const t = y / (GRID_H - 1);
    c.kind = "sky";
    c.day = mix(P.skyBotDay, P.skyTopDay, t);
    c.night = mix(P.skyBotNight, P.skyTopNight, t);
  }

  // Shanghai Tower (tallest, tapering blue glass, x 46..51)
  building(46, 6, 15, "blueGlass");
  building(46, 5, 21, "blueGlass");
  building(47, 4, 26, "blueGlass");
  building(48, 3, 30, "blueGlass");
  building(49, 2, 32, "blueGlass");

  // Pudong flank (right)
  building(54, 4, 16, "darkGlass");
  building(59, 4, 12, "concrete");

  return grid.flat();
}
