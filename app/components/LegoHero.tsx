"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  buildSkyline,
  GRID_W,
  GRID_H,
  WINDOW_LIT,
  CLOUD_DAY,
  CLOUD_NIGHT,
  LETTER_RED,
  type Cell,
} from "../lib/skyline";
import { layoutWord } from "../lib/legoFont";

const CYCLE = 32; // seconds for a full day -> night -> day loop
const LETTER_Y = 28; // grid row where JUSTIN's baseline sits

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
  { cy: 33, rx: 6, ry: 2.2, speed: 0.55, offset: 10 },
  { cy: 36, rx: 4, ry: 1.6, speed: 0.8, offset: 40 },
  { cy: 30, rx: 5, ry: 1.8, speed: 0.4, offset: 62 },
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

  // Initialize: hidden (scale 0) unless reduced motion, and allocate instanceColor
  useEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const col = new THREE.Color();
    bricks.forEach((b, i) => {
      pos.set(b.x, b.y, b.z);
      const s = reducedMotion ? 1 : 0.0001;
      scl.set(s, s, s * b.sz);
      m.compose(pos, q, scl);
      mesh.current.setMatrixAt(i, m);
      mesh.current.setColorAt(i, col.setRGB(1, 1, 1));
    });
    mesh.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.current.instanceMatrix.needsUpdate = true;
    assembled.current = reducedMotion;
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
      if (allDone) assembled.current = true;
    }

    // --- ambient loop: day/night, clouds, twinkle, shimmer ---
    const phase = reducedMotion ? 0.12 : ((t + CYCLE * 0.08) % CYCLE) / CYCLE;
    const n = nightAmount(phase);

    // cloud blob positions this frame
    const clouds = CLOUDS.map((c) => ({
      ...c,
      cx: ((c.offset + t * c.speed) % (GRID_W + 2 * c.rx)) - c.rx,
    }));

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
        for (const c of clouds) {
          const dx = (cell.x - c.cx) / c.rx;
          const dy = (cell.y - c.cy) / c.ry;
          const d = dx * dx + dy * dy;
          if (d < 0.85) {
            const cd = CLOUD_DAY,
              cn = CLOUD_NIGHT;
            const f = 0.94 + cell.seed * 0.1;
            r = (cd[0] + (cn[0] - cd[0]) * n) * f;
            g = (cd[1] + (cn[1] - cd[1]) * n) * f;
            bl = (cd[2] + (cn[2] - cd[2]) * n) * f;
            break;
          }
        }
        // sparse stars at night
        if (n > 0.6 && cell.seed > 0.985) {
          const tw = 0.6 + 0.4 * Math.sin(t * 2.5 + cell.seed * 90);
          const s = n * tw;
          r += (0.9 - r) * s;
          g += (0.9 - g) * s;
          bl += (0.95 - bl) * s;
        }
      } else if (cell.kind === "window" && n > 0.4) {
        // windows light up as night falls, each on its own rhythm
        const on = Math.sin(t * 1.2 + cell.seed * 100) > 0.25 ? 1 : 0;
        const warm = on * n * (0.8 + 0.2 * Math.sin(t * 3 + cell.seed * 50));
        r += (WINDOW_LIT[0] - r) * warm;
        g += (WINDOW_LIT[1] - g) * warm;
        bl += (WINDOW_LIT[2] - bl) * warm;
      } else if (cell.kind === "pearl" && n > 0.5) {
        const pulse = 1 + 0.15 * Math.sin(t * 1.6 + cell.y);
        r = Math.min(1, r * pulse);
        bl = Math.min(1, bl * pulse);
      } else if (cell.kind === "river") {
        const sh = 0.05 * Math.sin(cell.x * 0.7 + t * 1.8 + cell.seed * 6);
        r += sh;
        g += sh * 1.4;
        bl += sh * 1.6;
      }

      col.setRGB(Math.max(0, r), Math.max(0, g), Math.max(0, bl));
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
    const fitAll = Math.min(
      size.height / (GRID_H + 10),
      size.width / (GRID_W + 6),
    );
    // on narrow screens, size to the JUSTIN centerpiece (35 cols) and let
    // the skyline flanks crop instead of shrinking everything
    camera.zoom = size.width < 640 ? size.width / 44 : fitAll;
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
      <p className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
        Justin Chen · Portfolio
      </p>
    </section>
  );
}
