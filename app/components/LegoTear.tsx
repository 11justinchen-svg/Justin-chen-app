"use client";

import { useEffect, useRef } from "react";

// Scroll-scrubbed cover transition in the spirit of Shopify Editions
// Winter '26: a black sheet whose top edge is a torn lego wall climbs
// over the pinned hero and ends as a blank black page. Progress is a
// pure function of scroll position, so scrolling back reverses it.

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

// quantize SVG coordinates so server and client render identical
// attribute strings (raw Math.sin differs in the last bits between
// runtimes, which trips React hydration)
const q = (v: number) => Math.round(v * 100) / 100;

interface BrickSeg {
  x: number;
  w: number;
  h: number;
  studs: number;
}

// deterministic irregular skyline of bricks across a 1200-unit strip
// (never Math.random — must match between server and client renders)
function buildEdge(seed: number): BrickSeg[] {
  const rand = (n: number) => {
    const s = Math.sin(seed * 997 + n * 127.1) * 43758.5453;
    return s - Math.floor(s);
  };
  const bricks: BrickSeg[] = [];
  let x = 0;
  for (let i = 0; x < 1200; i++) {
    const w = 72 + rand(i * 3) * 96; // 6-14% of the strip
    // non-periodic profile: mostly single-brick steps, some double-height
    // stacks, occasional deep notch (rendered heights of a 10vh strip)
    const kind = rand(i * 3 + 1);
    const h =
      kind < 0.15
        ? 8 + rand(i * 7 + 4) * 8 // deep notch: 0.8-1.6vh
        : kind < 0.4
          ? 52 + rand(i * 7 + 4) * 20 // double step: 5.2-7.2vh
          : 22 + rand(i * 7 + 4) * 24; // single step: 2.2-4.6vh
    const studs = 2 + Math.floor(rand(i * 3 + 2) * 3); // 2-4 studs
    bricks.push({ x: q(x), w: q(Math.min(w, 1200 - x)), h: q(h), studs });
    x += w;
  }
  return bricks;
}

const FRONT_BRICKS = buildEdge(3);
const BACK_BRICKS = buildEdge(11);

function BrickEdge({ bricks, fill }: { bricks: BrickSeg[]; fill: string }) {
  return (
    <svg
      className="block w-full"
      style={{ height: "10vh" }}
      viewBox="0 0 1200 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {bricks.map((b, i) => {
        const pitch = b.w / b.studs;
        const studW = pitch / 2;
        return (
          <g key={i} fill={fill}>
            <rect x={b.x} y={q(100 - b.h)} width={b.w} height={b.h} />
            {Array.from({ length: b.studs }, (_, s) => (
              <rect
                key={s}
                x={q(b.x + (s + 0.5) * pitch - studW / 2)}
                y={q(100 - b.h - 9)}
                width={q(studW)}
                height={10}
                rx={2}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function Sheet({
  bricks,
  fill,
  layerRef,
}: {
  bricks: BrickSeg[];
  fill: string;
  layerRef: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={layerRef}
      className="absolute inset-x-0 top-0 will-change-transform"
      style={{ transform: "translateY(100vh)" }}
    >
      <BrickEdge bricks={bricks} fill={fill} />
      {/* -1px overlap kills sub-pixel seams between edge and body */}
      <div style={{ height: "130vh", marginTop: -1, background: fill }} />
    </div>
  );
}

export default function LegoTear() {
  const region = useRef<HTMLElement>(null);
  const front = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = region.current;
    if (!el) return;
    let raf = 0;

    const apply = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const travel = el.offsetHeight - window.innerHeight;
      const p = clamp(-rect.top / travel, 0, 1);

      // black sheet: bottom of viewport -> fully past the top
      const y = 100 - p * 130;
      if (front.current) {
        front.current.style.transform = `translateY(${y}vh)`;
      }
      // dim deckle band leads the black edge by 2-4vh, converging as
      // it climbs (tracks at a slightly slower rate than the sheet)
      if (back.current) {
        back.current.style.transform = `translateY(${y - 4 + p * 2}vh)`;
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    // pulled up over the sticky hero so the tear starts moving on the
    // very first scroll instead of after a dead viewport of travel
    <section
      ref={region}
      className="relative z-20 -mt-[100vh]"
      style={{ height: "250vh" }}
    >
      <div className="pointer-events-none sticky top-0 h-screen">
        <Sheet bricks={BACK_BRICKS} fill="#1a1a1f" layerRef={back} />
        <Sheet bricks={FRONT_BRICKS} fill="#000000" layerRef={front} />
      </div>
    </section>
  );
}
