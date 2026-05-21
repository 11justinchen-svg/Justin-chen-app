"use client";

import { useState } from "react";
import Scene from "./Scene";
import { projects, type Project } from "../data/projects";

export default function Showcase() {
  const [active, setActive] = useState<Project | null>(null);

  return (
    <section
      aria-label="Project showcase"
      className="relative h-[100svh] w-full overflow-hidden"
      style={{ background: "var(--bg-base)" }}
    >
      <Scene onHover={setActive} onLeave={() => setActive(null)} />

      <header className="pointer-events-none absolute left-6 top-6 z-30 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--fg-mute)]">
        <div className="text-[var(--fg-primary)]">Justin Chen</div>
        <div className="mt-1 opacity-70">The Harker School</div>
      </header>

      <div className="pointer-events-none absolute right-6 top-6 z-30 text-right font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--fg-mute)] opacity-70">
        <div>Gallery, Vol. 01</div>
        <div className="mt-1">
          {String(projects.length).padStart(2, "0")} works
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-10 left-8 z-30 max-w-[42ch]">
        <div
          className="font-display uppercase leading-[0.92] transition-[color,opacity] duration-300"
          style={{
            fontSize: "clamp(3rem, 8vw, 7rem)",
            color: active ? "var(--accent-cadmium)" : "var(--fg-mute)",
            opacity: active ? 1 : 0.32,
            letterSpacing: "-0.01em",
          }}
        >
          {active?.name ?? "Gallery"}
        </div>
        <div className="mt-3 flex items-baseline gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--fg-mute)]">
          {active ? (
            <>
              <span className="text-[var(--fg-primary)] opacity-90">
                {active.tagline}
              </span>
              <span className="opacity-60">[{active.status}]</span>
            </>
          ) : (
            <span className="opacity-70">
              hover a plane to read, click to open
            </span>
          )}
        </div>
      </div>

      <footer className="pointer-events-none absolute bottom-6 right-6 z-30 font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--fg-mute)] opacity-60">
        Darkroom edition, 2026
      </footer>
    </section>
  );
}
