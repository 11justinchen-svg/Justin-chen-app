export type Project = {
  id: string;
  name: string;
  tagline: string;
  url: string;
  status: "live" | "wip";
  /** procedural placeholder pigment until real screenshots land */
  pigment: [number, number, number];
};

/**
 * Placeholder roster. Swap for real projects once URLs + screenshots land.
 * Pigments chosen as muted complements that still read against the deep-blue void.
 */
export const projects: Project[] = [
  {
    id: "sidekick",
    name: "Sidekick",
    tagline: "AI study partner",
    url: "https://example.com/sidekick",
    status: "wip",
    pigment: [0.72, 0.42, 0.28],
  },
  {
    id: "altar",
    name: "Altar",
    tagline: "Daily journal that argues back",
    url: "https://example.com/altar",
    status: "live",
    pigment: [0.42, 0.5, 0.7],
  },
  {
    id: "circuit",
    name: "Circuit",
    tagline: "Hardware lab notebook",
    url: "https://example.com/circuit",
    status: "wip",
    pigment: [0.5, 0.62, 0.45],
  },
  {
    id: "recess",
    name: "Recess",
    tagline: "Campus study spot finder",
    url: "https://example.com/recess",
    status: "live",
    pigment: [0.78, 0.62, 0.32],
  },
  {
    id: "editions",
    name: "Editions",
    tagline: "Newsletter for Harker",
    url: "https://example.com/editions",
    status: "live",
    pigment: [0.6, 0.32, 0.45],
  },
];
