export const COLS = 6;
export const ROWS = 5;
export const TILE_COUNT = COLS * ROWS;

const SCENES = [
  { name: "Puffball Meadow", colors: ["#e7b7ed", "#b8e8df", "#fff0c4"], hint: "Drag or tap a trail through the stars to the cottage.", map: [
    "......",
    ".U*...",
    "...*..",
    "..o.G.",
    "......",
  ] },
  { name: "Strawberry Hedge", colors: ["#ffbec9", "#fce0ad", "#fceebc"], hint: "Go around the hedge. Berries play a little tune.", map: [
    "..#...",
    ".U#*..",
    ".*#...",
    ".o.*G.",
    "......",
  ] },
  { name: "Lantern Brook", colors: ["#bfb4ef", "#9fdbef", "#d8f1d5"], hint: "Trail over the lantern to light up the bridge.", map: [
    "..~...",
    ".U~*..",
    ".a=..G",
    ".*~.o.",
    "..~...",
  ] },
  { name: "Mushroom Shortcut", colors: ["#ddc2f1", "#c9efd5", "#ffe3bc"], hint: "A mushroom hops you to its matching mushroom.", map: [
    "..~...",
    ".U~*G.",
    ".@~@o.",
    ".*~...",
    "..~...",
  ] },
  { name: "Starberry Orchard", colors: ["#f7b9d8", "#c3e4ea", "#fff0c4"], hint: "Light the bridge and visit both sides of the orchard.", map: [
    ".#.~..",
    ".U.~*.",
    ".a.=G.",
    ".*#~*.",
    ".o.~..",
  ] },
  { name: "Moonbow Crossing", colors: ["#cebbf3", "#adbce8", "#f7d9f0"], hint: "Link the bridge and mushroom shortcut in one trail.", map: [
    "..~...",
    ".U~*G.",
    ".a=@#.",
    ".*~#~.",
    "..~.@*",
  ] },
];

export interface Trail {
  name: string;
  colors: string[];
  hint: string;
  tiles: string[];
  start: number;
  home: number;
  starMask: number;
  starCount: number;
  portals: number[];
}

export interface TrailMove {
  entry: number;
  cell: number;
  stars: number;
  lit: boolean;
}

export const TRAIL_COUNT = SCENES.length;

export function getTrail(index: number) {
  const scene = SCENES[index % TRAIL_COUNT];
  const mirrored = Math.floor(index / TRAIL_COUNT) % 2 === 1;
  const tiles = scene.map.flatMap((row) => mirrored ? [...row].reverse() : [...row]);
  let starMask = 0;
  const portals: number[] = [];
  for (const [cell, tile] of tiles.entries()) {
    if (tile === "*") starMask |= 1 << cell;
    if (tile === "@") portals.push(cell);
  }
  return {
    name: scene.name,
    colors: scene.colors,
    hint: scene.hint,
    tiles,
    start: tiles.indexOf("U"),
    home: tiles.indexOf("G"),
    starMask,
    starCount: tiles.filter((tile) => tile === "*").length,
    portals,
  };
}

export function neighbor(cell: number, dx: number, dy: number) {
  const x = cell % COLS + dx;
  const y = Math.floor(cell / COLS) + dy;
  return x < 0 || x >= COLS || y < 0 || y >= ROWS ? -1 : y * COLS + x;
}

export function crawlStart(trail: Trail): TrailMove {
  return { entry: trail.start, cell: trail.start, stars: 0, lit: false };
}

export function moveTo(trail: Trail, from: TrailMove, entry: number): TrailMove | null {
  const tile = trail.tiles[entry];
  if (!tile || tile === "~" || tile === "#" || (tile === "=" && !from.lit)) return null;
  if (Math.abs(from.cell % COLS - entry % COLS) + Math.abs(Math.floor(from.cell / COLS) - Math.floor(entry / COLS)) !== 1) return null;
  const cell = tile === "@" ? (trail.portals[0] === entry ? trail.portals[1] : trail.portals[0]) : entry;
  return {
    entry,
    cell,
    stars: from.stars | (trail.starMask & (1 << cell)),
    lit: from.lit || tile === "a",
  };
}

export function trailComplete(trail: Trail, move: TrailMove) {
  return move.cell === trail.home && move.stars === trail.starMask;
}

export function nextHint(trail: Trail, current: TrailMove) {
  const queue = [{ move: current, first: -1 }];
  const visited = new Set<string>();
  for (let index = 0; index < queue.length; index++) {
    const { move, first } = queue[index];
    if (trailComplete(trail, move)) return first;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const next = moveTo(trail, move, neighbor(move.cell, dx, dy));
      if (!next) continue;
      const key = `${next.cell}:${next.stars}:${next.lit}`;
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ move: next, first: first === -1 ? next.entry : first });
    }
  }
  return -1;
}
