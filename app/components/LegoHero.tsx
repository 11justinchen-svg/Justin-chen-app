"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  buildSkyline,
  GRID_W,
  GRID_H,
  RIVER_TOP,
  BEACONS,
  WINDOW_LIT,
  CLOUD_DAY,
  CLOUD_NIGHT,
  LETTER_RED,
  BIRD_COLOR,
  BOAT_HULL,
  BOAT_LIGHT,
  BEAM_COLOR,
  type Cell,
} from "../lib/skyline";
import { layoutWord } from "../lib/legoFont";

const CYCLE = 32; // seconds for a full day -> night -> day loop
const LETTER_Y = 32; // grid row where JUSTIN's baseline sits

// the assemble sequence plays once per visit, not on every remount
let assembledOnce = false;

interface Brick {
  x: number; // world x
  y: number; // world y
  z: number; // resting z
  sz: number; // z scale (letters are chunkier)
  delay: number;
  seed: number;
  cell: Cell | null; // null = letter brick
  color: [number, number, number]; // letters only
}

function smooth(t: number) {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

// 0 = day, 1 = night
function nightAmount(p: number) {
  if (p < 0.32) return 0;
  if (p < 0.46) return smooth((p - 0.32) / 0.14);
  if (p < 0.8) return 1;
  if (p < 0.94) return 1 - smooth((p - 0.8) / 0.14);
  return 0;
}

function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

const CLOUDS = [
  { cy: 44, rx: 6, ry: 2.2, speed: 0.7, offset: 10 },
  { cy: 48, rx: 4, ry: 1.6, speed: 1.0, offset: 40 },
  { cy: 40, rx: 5, ry: 1.8, speed: 0.55, offset: 62 },
  { cy: 36, rx: 3, ry: 1.2, speed: 0.85, offset: 24 },
];

const BIRDS = [
  { base: 30, speed: 2.2, offset: 6, wobble: 1.4 },
  { base: 32, speed: 2.5, offset: 2, wobble: 1.1 },
  { base: 28, speed: 2.0, offset: 12, wobble: 1.6 },
  { base: 34, speed: 2.8, offset: 44, wobble: 0.9 },
];

const SPARKLE_HUES: [number, number, number][] = [
  [1.0, 0.8, 0.4], // gold
  [1.0, 0.5, 0.7], // pink
  [0.5, 0.85, 1.0], // cyan
];

function useBricks(): Brick[] {
  return useMemo(() => {
    const bricks: Brick[] = [];
    const toWorld = (gx: number, gy: number): [number, number] => [
      gx - GRID_W / 2 + 0.5,
      gy - GRID_H / 2 + 0.5,
    ];

    for (const cell of buildSkyline()) {
      const [x, y] = toWorld(cell.x, cell.y);
      bricks.push({
        x,
        y,
        z: 0,
        sz: 1,
        delay: (cell.y / GRID_H) * 1.4 + cell.seed * 0.5,
        seed: cell.seed,
        cell,
        color: [0, 0, 0],
      });
    }

    const letterCells = layoutWord("JUSTIN", GRID_W, LETTER_Y);
    const minX = Math.min(...letterCells.map((c) => c.x));
    letterCells.forEach((lc, i) => {
      const [x, y] = toWorld(lc.x, lc.y);
      const j = ((i * 31 + 7) % 13) / 13; // stable pseudo-jitter
      bricks.push({
        x,
        y,
        z: 0.55,
        sz: 1.8,
        delay: 2.1 + (lc.x - minX) * 0.045 + j * 0.08,
        seed: j,
        cell: null,
        color: [
          Math.min(1, LETTER_RED[0] * (0.95 + j * 0.1)),
          LETTER_RED[1] * (0.95 + j * 0.1),
          LETTER_RED[2] * (0.95 + j * 0.1),
        ],
      });
    });

    return bricks;
  }, []);
}

function Scene({ reducedMotion }: { reducedMotion: boolean }) {
  const bricks = useBricks();
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const group = useRef<THREE.Group>(null!);
  const dirLight = useRef<THREE.DirectionalLight>(null!);
  const ambLight = useRef<THREE.AmbientLight>(null!);
  const mouse = useRef({ x: 0, y: 0 });
  const assembled = useRef(false);
  const time = useRef(0);

  const geometry = useMemo(() => {
    const plate = new THREE.BoxGeometry(0.98, 0.98, 0.3);
    plate.translate(0, 0, 0.15);
    const stud = new THREE.CylinderGeometry(0.34, 0.34, 0.18, 20);
    stud.rotateX(Math.PI / 2);
    stud.translate(0, 0, 0.39);
    const merged = mergeGeometries([plate, stud]);
    plate.dispose();
    stud.dispose();
    return merged;
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    if (!reducedMotion) window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [reducedMotion]);

  // Initialize hidden (scale 0) unless the assemble already played this visit
  useEffect(() => {
    const skipAssemble = reducedMotion || assembledOnce;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const col = new THREE.Color();
    bricks.forEach((b, i) => {
      pos.set(b.x, b.y, b.z);
      const s = skipAssemble ? 1 : 0.0001;
      scl.set(s, s, s * b.sz);
      m.compose(pos, q, scl);
      mesh.current.setMatrixAt(i, m);
      mesh.current.setColorAt(i, col.setRGB(1, 1, 1));
    });
    mesh.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.current.instanceMatrix.needsUpdate = true;
    assembled.current = skipAssemble;
  }, [bricks, reducedMotion]);

  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      pos: new THREE.Vector3(),
      scl: new THREE.Vector3(),
      col: new THREE.Color(),
    }),
    [],
  );

  useFrame((_, delta) => {
    // own the clock: THREE.Clock is deprecated in r185 and its elapsedTime
    // doesn't reliably start at mount; clamping delta also keeps the
    // assemble sequence intact when a hidden tab resumes rAF
    time.current += Math.min(delta, 0.05);
    const t = reducedMotion ? 0 : time.current;
    const { m, q, pos, scl, col } = tmp;

    // --- assemble: scale-pop with z press-in, bottom rows first, JUSTIN last ---
    if (!assembled.current) {
      let allDone = true;
      for (let i = 0; i < bricks.length; i++) {
        const b = bricks[i];
        const p = Math.min(1, Math.max(0, (t - b.delay) / 0.45));
        if (p < 1) allDone = false;
        const e = p === 0 ? 0.0001 : easeOutBack(p);
        pos.set(b.x, b.y, b.z + (1 - p) * 10);
        scl.set(
          Math.max(0.0001, e),
          Math.max(0.0001, e),
          Math.max(0.0001, e) * b.sz,
        );
        m.compose(pos, q, scl);
        mesh.current.setMatrixAt(i, m);
      }
      mesh.current.instanceMatrix.needsUpdate = true;
      if (allDone) {
        assembled.current = true;
        assembledOnce = true;
      }
    }

    // --- ambient loop: day/night, clouds, birds, boat, beams, twinkle ---
    const phase = reducedMotion ? 0.12 : ((t + CYCLE * 0.08) % CYCLE) / CYCLE;
    const n = nightAmount(phase);
    const day = 1 - n;

    const clouds = CLOUDS.map((c) => ({
      ...c,
      cx: ((c.offset + t * c.speed) % (GRID_W + 2 * c.rx)) - c.rx,
    }));

    // birds glide across the day sky
    const birds =
      day > 0.2
        ? BIRDS.map((b, i) => ({
            x: Math.round(((b.offset + t * b.speed) % (GRID_W + 8)) - 4),
            y: Math.round(b.base + Math.sin(t * 1.5 + i * 2.1) * b.wobble),
          }))
        : [];

    // a ferry crosses the Huangpu day and night
    const boatX = Math.round(((t * 1.1) % (GRID_W + 10)) - 5);
    const boatRow = RIVER_TOP; // top river row: stays visible when the band crops

    // searchlight beams sweep the night sky from the two tallest towers
    const beams = BEACONS.map((bcn, k) => {
      // wide sweep so the rays rake across the strip of sky above the towers
      const ang = Math.sin(t * 0.3 + k * 2.4) * 1.05; // radians off vertical
      return { bx: bcn.x, by: bcn.y, sin: Math.sin(ang), cos: Math.cos(ang) };
    });

    for (let i = 0; i < bricks.length; i++) {
      const b = bricks[i];
      const cell = b.cell;
      if (!cell) {
        col.setRGB(b.color[0], b.color[1], b.color[2]);
        mesh.current.setColorAt(i, col);
        continue;
      }
      let r = cell.day[0] + (cell.night[0] - cell.day[0]) * n;
      let g = cell.day[1] + (cell.night[1] - cell.day[1]) * n;
      let bl = cell.day[2] + (cell.night[2] - cell.day[2]) * n;

      if (cell.kind === "sky") {
        // drifting quantized clouds
        let clouded = false;
        for (const c of clouds) {
          const dx = (cell.x - c.cx) / c.rx;
          const dy = (cell.y - c.cy) / c.ry;
          if (dx * dx + dy * dy < 0.85) {
            const cd = CLOUD_DAY,
              cn = CLOUD_NIGHT;
            const f = 0.94 + cell.seed * 0.1;
            r = (cd[0] + (cn[0] - cd[0]) * n) * f;
            g = (cd[1] + (cn[1] - cd[1]) * n) * f;
            bl = (cd[2] + (cn[2] - cd[2]) * n) * f;
            clouded = true;
            break;
          }
        }
        if (!clouded) {
          // day: birds
          for (const bird of birds) {
            if (cell.x === bird.x && cell.y === bird.y) {
              const a = day;
              r += (BIRD_COLOR[0] - r) * a;
              g += (BIRD_COLOR[1] - g) * a;
              bl += (BIRD_COLOR[2] - bl) * a;
              break;
            }
          }
          if (n > 0.4) {
            // night: searchlight beams sweeping the air
            for (const beam of beams) {
              const dy = cell.y - beam.by;
              if (dy > 0 && dy < 22) {
                const dx = cell.x - beam.bx;
                const perp = Math.abs(dx * beam.cos - dy * beam.sin);
                if (perp < 1.6) {
                  const s = (1 - perp / 1.6) * (1 - dy / 22) * n * 0.8;
                  r += (BEAM_COLOR[0] - r) * s;
                  g += (BEAM_COLOR[1] - g) * s;
                  bl += (BEAM_COLOR[2] - bl) * s;
                }
              }
            }
            // night: distant fireworks flashing in the air
            if (cell.y > 24) {
              const f = (t * 0.12 + cell.seed * 13) % 1;
              if (f < 0.05) {
                const burst = Math.sin((f / 0.05) * Math.PI) * n;
                const hue = SPARKLE_HUES[Math.floor(cell.seed * 3) % 3];
                r += (hue[0] - r) * burst;
                g += (hue[1] - g) * burst;
                bl += (hue[2] - bl) * burst;
              }
            }
            // sparse stars
            if (cell.seed > 0.985) {
              const tw = 0.6 + 0.4 * Math.sin(t * 2.5 + cell.seed * 90);
              const s = n * tw;
              r += (0.9 - r) * s;
              g += (0.9 - g) * s;
              bl += (0.95 - bl) * s;
            }
          }
        }
      } else if (cell.kind === "window") {
        if (n > 0.4) {
          const on = Math.sin(t * 1.2 + cell.seed * 100) > 0.25 ? 1 : 0;
          const warm = on * n * (0.8 + 0.2 * Math.sin(t * 3 + cell.seed * 50));
          r += (WINDOW_LIT[0] - r) * warm;
          g += (WINDOW_LIT[1] - g) * warm;
          bl += (WINDOW_LIT[2] - bl) * warm;
        }
      } else if (cell.kind === "building" && cell.accent && n > 0.3) {
        // facades wash in colored floodlight like the real Bund at night
        const amt = n * (0.35 + 0.18 * Math.sin(t * 0.5 + cell.seed * 20));
        r += (cell.accent[0] - r) * amt;
        g += (cell.accent[1] - g) * amt;
        bl += (cell.accent[2] - bl) * amt;
      } else if (cell.kind === "pearl" && n > 0.5) {
        const pulse = 1 + 0.15 * Math.sin(t * 1.6 + cell.y);
        r = Math.min(1, r * pulse);
        bl = Math.min(1, bl * pulse);
      } else if (cell.kind === "river") {
        const sh = 0.05 * Math.sin(cell.x * 0.7 + t * 1.8 + cell.seed * 6);
        r += sh;
        g += sh * 1.4;
        bl += sh * 1.6;
        // the ferry: 3-cell hull, middle cell glows warm after dark
        const dxb = cell.x - boatX;
        if (cell.y === boatRow && dxb >= -1 && dxb <= 1) {
          if (dxb === 0 && n > 0.4) {
            r = BOAT_LIGHT[0];
            g = BOAT_LIGHT[1];
            bl = BOAT_LIGHT[2];
          } else {
            r = BOAT_HULL[0] * (1 - n * 0.55);
            g = BOAT_HULL[1] * (1 - n * 0.55);
            bl = BOAT_HULL[2] * (1 - n * 0.5);
          }
        } else if (cell.y === boatRow && (dxb === -2 || dxb === 2)) {
          const wake = 0.25 * day + 0.1;
          r += (0.8 - r) * wake * 0.4;
          g += (0.85 - g) * wake * 0.4;
          bl += (0.9 - bl) * wake * 0.4;
        }
      }

      // aircraft warning lights blink on the tallest tips at night
      if (n > 0.4) {
        for (let k = 0; k < BEACONS.length; k++) {
          if (cell.x === BEACONS[k].x && cell.y === BEACONS[k].y) {
            const blink = Math.sin(t * 3.5 + k * 1.7) > 0.55 ? n : 0;
            r += (1.0 - r) * blink;
            g += (0.23 - g) * blink;
            bl += (0.19 - bl) * blink;
          }
        }
      }

      col.setRGB(Math.max(0, r), Math.max(0, g), Math.max(0, Math.min(1, bl)));
      mesh.current.setColorAt(i, col);
    }
    if (mesh.current.instanceColor)
      mesh.current.instanceColor.needsUpdate = true;

    // lights dim into the night
    dirLight.current.intensity = 1.3 - 0.75 * n;
    ambLight.current.intensity = 0.65 - 0.25 * n;

    // --- mouse parallax around a gentle base tilt ---
    const targetY = 0.08 + mouse.current.x * 0.09;
    const targetX = -0.1 + mouse.current.y * 0.07;
    group.current.rotation.y += (targetY - group.current.rotation.y) * 0.06;
    group.current.rotation.x += (targetX - group.current.rotation.x) * 0.06;
  });

  return (
    <group ref={group} rotation={[-0.1, 0.08, 0]}>
      <ambientLight ref={ambLight} intensity={0.65} />
      <directionalLight
        ref={dirLight}
        position={[-16, 22, 24]}
        intensity={1.3}
      />
      <instancedMesh
        ref={mesh}
        args={[geometry, undefined, bricks.length]}
        frustumCulled={false}
      >
        <meshStandardMaterial roughness={0.35} metalness={0} />
      </instancedMesh>
    </group>
  );
}

function FitCamera() {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const size = useThree((s) => s.size);
  useEffect(() => {
    const wide = size.width / size.height >= 1.05;
    if (wide) {
      // full-bleed: cover the viewport, overscan for the parallax tilt
      const zoom = Math.max(size.width / GRID_W, size.height / GRID_H) * 1.08;
      camera.zoom = zoom;
      // when rows crop, favor a band that keeps JUSTIN (rows 32-38) and
      // as much river as fits
      const visRows = size.height / zoom;
      const half = visRows / 2;
      const centerRow = Math.min(GRID_H - half, Math.max(half, 41 - half));
      camera.position.y = centerRow - GRID_H / 2;
    } else {
      // narrow screens: size to the JUSTIN centerpiece, crop the flanks
      camera.zoom = size.width / 44;
      camera.position.y = 0;
    }
    camera.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

export default function LegoHero() {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  return (
    <section className="relative h-screen w-full overflow-hidden bg-[#0a0a0c]">
      <Canvas
        orthographic
        dpr={[1, 2]}
        camera={{ position: [0, 0, 100], zoom: 16, near: 0.1, far: 400 }}
      >
        <FitCamera />
        <Scene reducedMotion={reducedMotion} />
      </Canvas>
      <p className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-400">
        Justin Chen · Portfolio
      </p>
    </section>
  );
}
