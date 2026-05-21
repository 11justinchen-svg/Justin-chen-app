# Justin Chen — Portfolio Website PRD

### BASIC OVERVIEW:
This entire website is dedicated to Justin Chen's portfolio. Justin is a student at **The Harker School**. The site centers on his projects and works-in-progress (WIP), with a playful, distinctive feel — not a generic dev portfolio.

### avoids:
Should not look like a generic website never use arial font for headers and big ideas, avoid em dahes and --- 01 formatin within the website. Never use basic logos that are given to you from the beggining, wait for inputs on logos

### do:
take inspiration from other websites that I give using playwright mcp and --chrome plug-in, ADD YOUR OWN INPUT BUT WAIT FOR MY CONFIRMATION

---

## 1. Goals & Non-Goals

### Goals
- Make Justin's projects (shipped + WIP) the centerpiece
- Establish a memorable, playful brand
- Surface Harker School background as part of Justin's story
- Give each project a tactile, interactive entry point — not a flat grid

### Non-Goals
- Not a blog
- Not a CMS-backed site; content lives in code
- Not an "everything about me" site

## 2. Users
- Recruiters and program reviewers evaluating Justin's work
- Peers and collaborators discovering projects
- Future Justin, as a living archive

## 3. Site Structure
Three sections, single-page or routed (TBD):

1. **Hero** — name, one-line identity, Harker callout, hint at playful interaction
2. **Projects** — the showcase (see §4, this is the centerpiece)
3. **Contact** — how to reach Justin

## 4. Project Showcase — Design Direction
The showcase MUST be unique. Two candidate directions:

### Option A — Rotating Namecard (React Three Fiber)
- Each project rendered as a 3D "namecard" floating in space
- Cards rotate slowly; hover or drag to spin; click to open project
- Built with react-three-fiber and drei
- Vibe: tangible, collectible, physical

### Option B — Floating Screens
- Project previews float as soft-edged "screens" or panels
- Hover state softens edges further; click leads to the project's live site
- Could be 2D (CSS + Framer Motion) or 3D (R3F with planes and soft shadows)
- Vibe: dreamy, ambient, browsable

**Decision pending**, to be made after reference-site research.

## 5. Tech Stack (proposed, pending confirmation)
- **Framework:** Next.js (App Router) or Vite + React
- **3D:** react-three-fiber, drei, optionally leva for tuning
- **Styling:** Tailwind CSS
- **Motion:** Framer Motion for 2D transitions
- **Deploy:** Vercel (default unless Justin prefers otherwise)

## 6. Collaboration Protocol
- Justin sends reference sites; Claude inspects them via Playwright MCP + Chrome plugin
- Claude proposes design directions with reasoning and its own input
- **Justin confirms before Claude writes implementation code**
- No logos, no final font picks, no color palette locked without Justin's sign-off

## 7. Open Questions
1. **Showcase choice** — Rotating namecard (A) or floating screens (B)?
2. **Tech stack** — Next.js vs Vite?
3. **Tone beyond "playful"** — minimal-playful, maximalist-playful, retro-playful?
4. **Reference sites** — which ones inspire you?
5. **Contact section** — form, email link, social icons, or all three?
6. **Projects list** — how many projects exist today? Any WIP to feature first?
7. **Deploy target + domain** — Vercel default? Custom domain?
8. **Resume / CV** — link to PDF, or skip?
9. **Dark mode** — required, optional, or single-theme?

## 8. Milestones
- **M0** — PRD locked (after open questions resolved)
- **M1** — Reference research (Playwright tour of inspiration sites, mood agreed)
- **M2** — Showcase prototype (build Option A or B in isolation)
- **M3** — Hero + Contact (frame the showcase)
- **M4** — Content pass (real project data, copy, Harker callout)
- **M5** — Polish + deploy
