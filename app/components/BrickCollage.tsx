"use client";

import { useEffect, useRef } from "react";

// Scroll-driven collage in the spirit of Shopify Editions Winter '26:
// a sticky stage where two lego bricks drift in from the edges as you
// scroll, snap together with a spark, then settle. 300vh of travel.
//
// INTERACTION MODEL: scroll-driven
// STATES: approach (0-0.5) -> snap + spark (0.5-0.7) -> settle (0.7-1)

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const ease = (t: number) => t * t * (3 - 2 * t);
const vh = () => window.innerHeight / 100;

// deterministic scatter for the floating background studs
const FLOATERS = Array.from({ length: 10 }, (_, i) => {
  const s = Math.sin(i * 127.1) * 0.5 + 0.5;
  const c = Math.cos(i * 311.7) * 0.5 + 0.5;
  return {
    left: 4 + s * 92,
    top: 8 + c * 80,
    size: 10 + ((i * 37) % 22),
    rate: 0.25 + ((i * 53) % 100) / 130, // parallax factor
    hue: ["#C4281C", "#1E5AA8", "#F2CD37", "#237841", "#6B6B6B"][i % 5],
  };
});

function Stud({ size }: { size: number }) {
  return (
    <span
      className="rounded-full"
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.45), rgba(255,255,255,0.08) 55%, rgba(0,0,0,0.25))",
      }}
    />
  );
}

function Brick({ color, shade }: { color: string; shade: string }) {
  return (
    <div className="relative" style={{ width: "min(26vw, 340px)" }}>
      {/* studs */}
      <div className="absolute -top-[9%] left-0 flex w-full justify-around px-[4%]">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-0 w-[16%]" style={{ position: "relative" }}>
            <div
              className="absolute left-0 top-0 w-full rounded-t-[30%]"
              style={{
                aspectRatio: "2.2 / 1",
                background: `linear-gradient(180deg, ${color}, ${shade})`,
              }}
            />
          </div>
        ))}
      </div>
      {/* body */}
      <div
        className="rounded-[6px]"
        style={{
          aspectRatio: "2.6 / 1",
          background: `linear-gradient(165deg, ${color} 0%, ${color} 55%, ${shade} 100%)`,
          boxShadow:
            "inset 0 3px 6px rgba(255,255,255,0.28), inset 0 -6px 10px rgba(0,0,0,0.3), 0 18px 40px rgba(0,0,0,0.5)",
        }}
      />
    </div>
  );
}

export default function BrickCollage() {
  const section = useRef<HTMLElement>(null);
  const left = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);
  const spark = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const tag = useRef<HTMLParagraphElement>(null);
  const floaters = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let raf = 0;

    const apply = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const travel = el.offsetHeight - window.innerHeight;
      const p = reduced ? 1 : clamp(-rect.top / travel, 0, 1);

      // approach: bricks converge until they touch at p = 0.55
      const a = ease(clamp(p / 0.55, 0, 1));
      // settle bounce right after the snap
      const settle = ease(clamp((p - 0.55) / 0.12, 0, 1));

      // pixel-exact contact: each brick's inner edge reaches dead center
      const bw = left.current ? left.current.offsetWidth : 300;
      const startX = window.innerWidth * 0.58;
      const endX = bw / 2 - 2; // 2px overlap so the joint reads closed

      if (left.current) {
        const x = -startX + a * (startX - endX);
        const rot = -16 + a * 16; // both land level
        left.current.style.transform = `translate(${x}px, ${(8 - a * 6) * vh()}px) rotate(${rot}deg)`;
      }
      if (right.current) {
        const x = startX - a * (startX - endX);
        const rot = 14 - a * 14;
        const drop = settle * 3.4; // clicks down onto the joint, landing level
        right.current.style.transform = `translate(${x}px, ${(-20 + a * 18.6 + drop) * vh()}px) rotate(${rot}deg)`;
      }
      if (spark.current) {
        // flare exactly at contact, gone by 0.75
        const s = clamp((p - 0.55) / 0.2, 0, 1);
        const burst = Math.sin(s * Math.PI);
        spark.current.style.opacity = String(burst);
        spark.current.style.transform = `translate(-50%, -50%) scale(${0.4 + s * 1.6})`;
      }
      if (card.current) {
        // center title card docks to the top-left like the Shopify edition card
        const c = ease(clamp(p / 0.3, 0, 1));
        card.current.style.transform = `translate(${-c * 36}vw, ${-c * 34}vh) scale(${1 - c * 0.55})`;
        card.current.style.opacity = String(1 - c * 0.25);
      }
      if (tag.current) {
        const v = ease(clamp((p - 0.72) / 0.18, 0, 1));
        tag.current.style.opacity = String(v);
        tag.current.style.transform = `translateY(${(1 - v) * 18}px)`;
      }
      if (floaters.current) {
        for (let i = 0; i < floaters.current.children.length; i++) {
          const f = floaters.current.children[i] as HTMLElement;
          f.style.transform = `translateY(${-p * 130 * FLOATERS[i].rate}px)`;
        }
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
    <section
      ref={section}
      className="relative bg-[#0a0a0c]"
      style={{ height: "300vh" }}
    >
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        {/* parallax background studs */}
        <div ref={floaters} className="pointer-events-none absolute inset-0">
          {FLOATERS.map((f, i) => (
            <div
              key={i}
              className="absolute flex items-center justify-center rounded-full opacity-25"
              style={{
                left: `${f.left}%`,
                top: `${f.top}%`,
                width: f.size,
                height: f.size,
                background: `radial-gradient(circle at 35% 30%, ${f.hue}, rgba(0,0,0,0.6))`,
              }}
            />
          ))}
        </div>

        {/* title card, center -> docked corner */}
        <div
          ref={card}
          className="absolute z-10 border border-zinc-700/60 px-8 py-6 text-center backdrop-blur-[2px]"
        >
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">
            Built brick by brick
          </h2>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-500">
            Justin Chen · Selected work
          </p>
        </div>

        {/* the two bricks */}
        <div ref={left} className="absolute will-change-transform">
          <Brick color="#C4281C" shade="#7E1710" />
        </div>
        <div ref={right} className="absolute will-change-transform">
          <Brick color="#1E5AA8" shade="#123A6E" />
        </div>

        {/* spark at the moment of contact */}
        <div
          ref={spark}
          className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 opacity-0"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,214,138,0.7) 22%, rgba(255,214,138,0) 60%)",
          }}
        />

        {/* settle line */}
        <p
          ref={tag}
          className="absolute bottom-16 font-mono text-[12px] uppercase tracking-[0.3em] text-zinc-400 opacity-0"
        >
          It clicks.
        </p>
      </div>
    </section>
  );
}
