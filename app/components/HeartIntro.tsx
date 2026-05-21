"use client";

import { useEffect, useRef } from "react";

type Pixel = {
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hue: number; // 270..305
  sat: number; // 50..78
  light: number; // 38..72
  delay: number; // 0..1.3s
};

export default function HeartIntro() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    const c: HTMLCanvasElement = canvas;
    const g: CanvasRenderingContext2D = ctx;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const pointer = { x: -9999, y: -9999, active: false };
    let pixels: Pixel[] = [];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let start = performance.now();

    function seed() {
      pixels = [];
      const cx = width / 2;
      const cy = height / 2;
      // heart fits within ~70% of the smaller viewport dimension
      const scale = Math.min(width, height) * 0.022;

      const target = Math.min(
        950,
        Math.max(380, Math.floor((width * height) / 1500)),
      );
      let attempts = 0;

      // Interior fill via rejection sampling on the implicit heart equation
      // (x^2 + y^2 - 1)^3 - x^2 * y^3 < 0
      while (pixels.length < target * 0.82 && attempts < target * 30) {
        attempts++;
        const hx = (Math.random() - 0.5) * 36;
        const hy = (Math.random() - 0.5) * 32;
        const nx = hx / 17;
        const ny = hy / 17;
        const v = Math.pow(nx * nx + ny * ny - 1, 3) - nx * nx * ny * ny * ny;
        if (v > 0) continue;

        const px = cx + hx * scale;
        const py = cy - hy * scale;

        // density bias: more particles toward the curve edges (where v is closer to 0)
        // skip some deep-interior points so the outline reads stronger
        if (v < -0.55 && Math.random() < 0.45) continue;

        pixels.push(makePixel(px, py, width, height, true));
      }

      // Outline emphasis via parametric sampling
      const outline = Math.floor(target * 0.18);
      for (let i = 0; i < outline; i++) {
        const t = (i / outline) * Math.PI * 2 + Math.random() * 0.04;
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy =
          13 * Math.cos(t) -
          5 * Math.cos(2 * t) -
          2 * Math.cos(3 * t) -
          Math.cos(4 * t);
        const px = cx + hx * scale;
        const py = cy - hy * scale;
        pixels.push(makePixel(px, py, width, height, false));
      }
    }

    function makePixel(
      homeX: number,
      homeY: number,
      w: number,
      h: number,
      interior: boolean,
    ): Pixel {
      // start perfectly inside the bounds
      return {
        homeX,
        homeY,
        x: homeX,
        y: homeY,
        vx: 0,
        vy: 0,
        size: interior ? 2.5 + Math.random() * 5.5 : 3 + Math.random() * 5,
        hue: 270 + Math.random() * 35,
        sat: 50 + Math.random() * 28,
        light: 38 + Math.random() * 32,
        delay: Math.random() * 1.3,
      };
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = c.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      start = performance.now();
    }

    function onMove(e: PointerEvent) {
      const rect = c.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    }
    function onLeave() {
      pointer.active = false;
      pointer.x = -9999;
      pointer.y = -9999;
    }

    let scrollY = 0;
    const onScroll = () => {
      scrollY = window.scrollY;
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });
    c.addEventListener("pointermove", onMove);
    c.addEventListener("pointerleave", onLeave);

    const repelR = 110;
    const repelR2 = repelR * repelR;

    let raf = 0;
    function frame(now: number) {
      const elapsed = (now - start) / 1000;
      g.clearRect(0, 0, width, height);

      // Astro-dither background underlayer
      const bgGridSize = 24;
      g.font = `12px monospace`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "rgba(255, 255, 255, 0.05)";
      
      const offsetX = (scrollY * 0.05) % bgGridSize;
      const offsetY = (scrollY * 0.25) % bgGridSize;
      
      for (let x = -bgGridSize; x < width + bgGridSize; x += bgGridSize) {
        for (let y = -bgGridSize; y < height + bgGridSize; y += bgGridSize) {
           const char = (Math.floor(x/bgGridSize) + Math.floor(y/bgGridSize)) % 3 === 0 ? "+" : "·";
           g.fillText(char, x - offsetX, y - offsetY);
        }
      }

      const cx = width / 2;
      const cy = height / 2;
      // gentle, slow pulse, 3.5s period, 4% amplitude
      const pulse = 1 + Math.sin(elapsed * ((Math.PI * 2) / 3.5)) * 0.04;

      for (const p of pixels) {
        const aT = Math.max(0, Math.min(1, (elapsed - p.delay) / 1.4));
        const eased = 1 - Math.pow(1 - aT, 4); // ease-out quart

        const tx = cx + (p.homeX - cx) * pulse;
        const ty = cy + (p.homeY - cy) * pulse;

        if (reducedMotion) {
          p.x = p.homeX;
          p.y = p.homeY;
        } else if (aT < 1) {
          // assembling: lerp toward home with growing pull
          const k = 0.03 + eased * 0.17;
          p.x += (tx - p.x) * k;
          p.y += (ty - p.y) * k;
        } else {
          // physics: spring to home, cursor repel, damping
          p.vx += (tx - p.x) * 0.12;
          p.vy += (ty - p.y) * 0.12;

          if (pointer.active) {
            const dx = p.x - pointer.x;
            const dy = p.y - pointer.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < repelR2 && d2 > 0.5) {
              const d = Math.sqrt(d2);
              const f = 1 - d / repelR;
              const force = f * f * 8.5;
              p.vx += (dx / d) * force;
              p.vy += (dy / d) * force;
            }
          }

          let nextX = p.x + p.vx;
          let nextY = p.y + p.vy;

          // Math constraint: rigid heart border
          // Re-evaluate heart implicit equation for the next position
          const scale = Math.min(width, height) * 0.022;
          const hx = (nextX - cx) / scale;
          const hy = (cy - nextY) / scale;
          const nx = hx / 17;
          const ny = hy / 17;
          const v = Math.pow(nx * nx + ny * ny - 1, 3) - nx * nx * ny * ny * ny;

          if (v > 0) {
            // Out of bounds: bounce!
            p.vx *= -0.5;
            p.vy *= -0.5;
            // don't update p.x / p.y to keep it strictly inside
          } else {
            p.x = nextX;
            p.y = nextY;
          }

          p.vx *= 0.82;
          p.vy *= 0.82;
        }

        const alpha = eased * (0.55 + ((p.light - 38) / 32) * 0.4);
        
        // Save computed state to p for the rendering pass
        (p as any).alpha = alpha;
      }

      // Astro-dither inspired ASCII grid rendering
      const GRID_SIZE = 14;
      const chars = ["·", ":", "+", "*", "%", "#", "@"];
      
      const grid = new Map<string, { totalAlpha: number; hue: number; sat: number; light: number }>();

      for (const p of pixels) {
        const alpha = (p as any).alpha;
        const gx = Math.round(p.x / GRID_SIZE) * GRID_SIZE;
        const gy = Math.round(p.y / GRID_SIZE) * GRID_SIZE;
        const key = `${gx},${gy}`;
        
        const cell = grid.get(key);
        if (!cell) {
          grid.set(key, { totalAlpha: alpha, hue: p.hue, sat: p.sat, light: p.light });
        } else {
          cell.totalAlpha += alpha;
        }
      }

      g.font = `bold ${GRID_SIZE * 1.1}px monospace`;
      g.textAlign = "center";
      g.textBaseline = "middle";

      for (const [key, cell] of grid.entries()) {
        const density = cell.totalAlpha / 3.0;
        
        // Cull very faint strays to clean up the heart shape and remove sparse outliers
        if (density < 0.15) continue;

        const [gx, gy] = key.split(",").map(Number);
        const charIdx = Math.min(chars.length - 1, Math.floor(density * chars.length));
        const char = chars[charIdx];
        
        g.fillStyle = `hsl(${cell.hue} ${cell.sat}% ${cell.light}% / ${Math.min(1, density * 1.2)})`;
        g.fillText(char, gx, gy);
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      c.removeEventListener("pointermove", onMove);
      c.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <section
      aria-label="Intro"
      className="relative h-[100svh] w-full overflow-hidden"
      style={{ background: "var(--bg-deep)" }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full"
      />

      {/* wordmark overlaid across the heart, screen-blended so dense pixel
          areas brighten through the type */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
        <h1
          className="text-center uppercase"
          style={{
            fontFamily: "var(--font-archivo-black), sans-serif",
            color: "var(--velvet-cream)",
            fontSize: "clamp(2.6rem, 11vw, 9.5rem)",
            letterSpacing: "-0.025em",
            lineHeight: 0.88,
            mixBlendMode: "screen",
            transform: "scaleX(1.08)",
            transformOrigin: "center",
          }}
        >
          Justin Chen
        </h1>
      </div>

    </section>
  );
}
