import "./style.css";
import type { Toy } from "../../toy";
import type { Application } from "pixi.js";
import { playNote, unlockAudio } from "../../audio";
import { createComicCallout, createToyFinish } from "../../comic";
import { COLS, ROWS, TILE_COUNT, TRAIL_COUNT, crawlStart, getTrail, moveTo, neighbor, nextHint, trailComplete } from "./trails";
import type { TrailMove } from "./trails";
import { makeUnicorn } from "./unicorn";

const TILE_INFO: Record<string, [string, string, string]> = {
  U: ["start", "♢", "Unicorn start"],
  G: ["cottage", "✦", "Star cottage"],
  "*": ["star", "★", "Lost star"],
  "~": ["stream", "", "Stream"],
  "#": ["hedge", "✤", "Hedge"],
  o: ["berries", "●", "Chime berries"],
  "=": ["bridge", "╫", "Lantern bridge"],
  a: ["lantern", "✸", "Bridge lantern"],
  "@": ["portal", "●", "Mushroom shortcut"],
  ".": ["grass", "", "Grass"],
};
const TINKLES = [523.25, 659.25, 783.99, 1046.5];
const STEP_LIMIT = 120;

export function createUnicornTrails(): Toy {
  const screen = document.createElement("section");
  screen.className = "unicorn-trails";
  screen.setAttribute("aria-label", "Unicorn Trails");
  screen.innerHTML = `
    <header class="trail-heading">
      <h1>Unicorn Trails</h1>
      <p class="trail-location"></p>
      <p class="trail-instructions"></p>
    </header>
    <div class="trail-board">
      <div class="trail-grid" role="group" aria-label="Trail board"></div>
      <div class="trail-ribbon" aria-hidden="true"></div>
      <div class="trail-rider" aria-hidden="true"></div>
    </div>
    <div class="trail-controls">
      <p class="trail-status" role="status"></p>
      <div class="trail-actions">
        <button type="button" class="play-button trail-undo">Undo</button>
        <button type="button" class="play-button trail-clear">Clear</button>
        <button type="button" class="play-button trail-hint">Hint</button>
        <button type="button" class="play-button trail-trot">Trot!</button>
      </div>
    </div>
  `;
  const board = screen.querySelector<HTMLElement>(".trail-board")!;
  const grid = screen.querySelector<HTMLElement>(".trail-grid")!;
  const ribbon = screen.querySelector<HTMLElement>(".trail-ribbon")!;
  const rider = screen.querySelector<HTMLElement>(".trail-rider")!;
  rider.append(makeUnicorn());
  const location = screen.querySelector<HTMLElement>(".trail-location")!;
  const instructions = screen.querySelector<HTMLElement>(".trail-instructions")!;
  const status = screen.querySelector<HTMLElement>(".trail-status")!;
  const undo = screen.querySelector<HTMLButtonElement>(".trail-undo")!;
  const clear = screen.querySelector<HTMLButtonElement>(".trail-clear")!;
  const hint = screen.querySelector<HTMLButtonElement>(".trail-hint")!;
  const trot = screen.querySelector<HTMLButtonElement>(".trail-trot")!;
  const callout = createComicCallout();
  const finish = createToyFinish("Star parade!", "You returned the stars on all six trails. Keep playing to try mirrored trails.", () => loadTrail(0, true));
  const events = new AbortController();
  const options = { signal: events.signal };
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stepTime = reduceMotion ? 90 : 215;

  let app: Application;
  let index = 0;
  let trail = getTrail(0);
  let path: TrailMove[] = [crawlStart(trail)];
  let cells: HTMLButtonElement[] = [];
  let phase: "draw" | "walk" | "done" = "draw";
  let hintCell = -1;
  let focusCell = trail.start;
  let facing = 1;
  let timer = 0;
  let contact: { id: number; x: number; y: number } | undefined;

  const lastMove = () => path[path.length - 1];

  function showStatus(value: string) {
    if (status.textContent !== value) status.textContent = value;
  }

  function place(node: HTMLElement, cell: number) {
    node.style.left = `${(cell % COLS + 0.5) * 100 / COLS}%`;
    node.style.top = `${(Math.floor(cell / COLS) + 0.5) * 100 / ROWS}%`;
  }

  function placeRider(cell: number, previous = cell) {
    place(rider, cell);
    if (previous % COLS !== cell % COLS) facing = previous % COLS < cell % COLS ? 1 : -1;
    rider.style.setProperty("--facing", String(facing));
  }

  function updateControls() {
    undo.disabled = clear.disabled = phase !== "draw" || path.length < 2;
    hint.disabled = phase !== "draw";
    trot.disabled = phase === "draw" && path.length < 2;
    finish.button.disabled = phase === "walk";
    trot.textContent = phase === "walk" ? "Stop" : phase === "done" ? "Next trail" : "Trot!";
    board.dataset.phase = phase;
  }

  function focusTile(cell: number, focus = false) {
    cells[focusCell]?.setAttribute("tabindex", "-1");
    focusCell = cell;
    cells[cell].tabIndex = 0;
    if (focus) cells[cell].focus();
  }

  function showTiles(move: TrailMove, cleared: number) {
    for (const [index, button] of cells.entries()) {
      const tile = trail.tiles[index];
      button.toggleAttribute("data-lit", move.lit && (tile === "a" || tile === "="));
      button.toggleAttribute("data-picked", tile === "*" && (cleared & (1 << index)) !== 0);
      button.toggleAttribute("data-hint", index === hintCell);
      button.toggleAttribute("data-tip", phase === "draw" && index === lastMove().cell);
    }
  }

  function routePiece(from: number, to: number) {
    const horizontal = Math.floor(from / COLS) === Math.floor(to / COLS);
    const piece = document.createElement("span");
    piece.className = horizontal ? "trail-piece trail-piece--horizontal" : "trail-piece trail-piece--vertical";
    place(piece, Math.min(from, to));
    return piece;
  }

  function renderRoute() {
    const art = document.createDocumentFragment();
    for (let i = 1; i < path.length; i++) {
      const { entry, cell } = path[i];
      art.append(routePiece(path[i - 1].cell, entry));
      if (entry !== cell) {
        for (const tile of [entry, cell]) {
          const ring = document.createElement("span");
          ring.className = "trail-hop-ring";
          place(ring, tile);
          art.append(ring);
        }
      }
    }
    ribbon.replaceChildren(art);
    const move = lastMove();
    showTiles(move, move.stars);
    const stars = trail.tiles.filter((tile, index) => tile === "*" && (move.stars & (1 << index))).length;
    showStatus(trailComplete(trail, move) ? "Stars ready. Tap Trot!"
      : `${stars}/${trail.starCount} stars on your trail`);
    updateControls();
  }

  function loadTrail(next: number, moveFocus = false) {
    clearTimeout(timer);
    contact = undefined;
    index = next;
    trail = getTrail(index);
    hintCell = -1;
    phase = "draw";
    path = [crawlStart(trail)];
    location.textContent = `${trail.name} · ${index % TRAIL_COUNT + 1}/${TRAIL_COUNT}`;
    instructions.textContent = index >= TRAIL_COUNT ? `Mirror trail. ${trail.hint}` : trail.hint;
    trail.colors.forEach((color, i) => screen.style.setProperty(`--trail-sky-${i}`, color));
    cells = trail.tiles.map((tile, index) => {
      const button = document.createElement("button");
      const [type, icon, label] = TILE_INFO[tile];
      button.className = `trail-tile trail-tile--${type}`;
      button.type = "button";
      button.tabIndex = -1;
      button.dataset.cell = String(index);
      button.setAttribute("aria-label", `${label}, row ${Math.floor(index / COLS) + 1}, column ${index % COLS + 1}`);
      const graphic = document.createElement("span");
      graphic.className = "trail-tile-icon";
      graphic.setAttribute("aria-hidden", "true");
      graphic.textContent = icon;
      button.append(graphic);
      return button;
    });
    grid.replaceChildren(...cells);
    rider.className = "trail-rider";
    facing = trail.start % COLS >= COLS / 2 ? -1 : 1;
    placeRider(trail.start);
    focusTile(trail.start, moveFocus);
    renderRoute();
  }

  function stepBack() {
    if (phase !== "draw" || path.length === 1) return;
    path.pop();
    hintCell = -1;
    focusTile(lastMove().cell);
    renderRoute();
  }

  function sketchTo(cell: number, explain = false) {
    if (phase !== "draw" || cell === lastMove().cell) return;
    const step = moveTo(trail, lastMove(), cell);
    if (!step) {
      if (explain && trail.tiles[cell] === "=" && !lastMove().lit) showStatus("Visit the lantern to light this bridge.");
      return;
    }
    if (path.length >= STEP_LIMIT) return;
    path.push(step);
    hintCell = -1;
    focusTile(step.cell);
    renderRoute();
  }

  function findCell(x: number, y: number, bounds: DOMRect) {
    if (x < bounds.left || x >= bounds.right || y < bounds.top || y >= bounds.bottom) return -1;
    return Math.floor((y - bounds.top) / bounds.height * ROWS) * COLS + Math.floor((x - bounds.left) / bounds.width * COLS);
  }

  function pointerDown(event: PointerEvent) {
    if (event.button !== 0 || contact || phase !== "draw") return;
    unlockAudio();
    event.preventDefault();
    contact = { id: event.pointerId, x: event.clientX, y: event.clientY };
    board.setPointerCapture(event.pointerId);
    sketchTo(findCell(contact.x, contact.y, grid.getBoundingClientRect()), true);
  }

  function pointerMove(event: PointerEvent) {
    if (contact?.id !== event.pointerId) return;
    const bounds = grid.getBoundingClientRect();
    const dx = event.clientX - contact.x;
    const dy = event.clientY - contact.y;
    const count = Math.max(1, Math.min(TILE_COUNT, Math.ceil(Math.hypot(dx, dy) / (bounds.width / COLS * 0.35))));
    for (let i = 1; i <= count; i++) {
      const cell = findCell(contact.x + dx * i / count, contact.y + dy * i / count, bounds);
      const from = lastMove().cell;
      sketchTo(cell);
      // A shortcut ends this drag at the matching mushroom.
      if (from !== lastMove().cell && path.at(-1)!.entry !== lastMove().cell) break;
    }
    contact.x = event.clientX;
    contact.y = event.clientY;
  }

  function endPointer(event: PointerEvent) {
    if (contact?.id === event.pointerId) contact = undefined;
  }

  function onBoardKey(event: KeyboardEvent) {
    const directions: Record<string, [number, number]> = {
      ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1],
    };
    const direction = directions[event.key];
    if (!direction || phase !== "draw") return;
    event.preventDefault();
    const cell = neighbor(lastMove().cell, ...direction);
    if (cell !== -1) sketchTo(cell, true);
    cells[lastMove().cell].focus();
  }

  function react(word: string, cell: number) {
    const rect = grid.getBoundingClientRect();
    const x = rect.left + (cell % COLS + 0.5) * rect.width / COLS;
    const y = rect.top + (Math.floor(cell / COLS) + 0.5) * rect.height / ROWS;
    callout.show(word, x / window.innerWidth, y / window.innerHeight);
  }

  function endWalk() {
    rider.classList.remove("is-walking", "is-hopping");
    if (trailComplete(trail, lastMove())) {
      phase = "done";
      rider.classList.add("is-celebrating");
      react("STAR PARADE!", trail.home);
      playNote(783.99);
      playNote(1046.5);
      showStatus("Stars delivered!");
      if (index === TRAIL_COUNT - 1) finish.complete();
      updateControls();
      return;
    }
    phase = "draw";
    placeRider(trail.start);
    renderRoute();
    showStatus(lastMove().stars === trail.starMask
      ? "Great haul! Extend your trail to the cottage."
      : "Keep drawing to pick up every star.");
  }

  function walk(step: number) {
    if (step >= path.length) {
      endWalk();
      return;
    }
    const move = path[step];
    const before = path[step - 1];
    placeRider(move.entry, before.cell);
    const tile = trail.tiles[move.entry];
    timer = window.setTimeout(() => {
      showTiles(move, move.stars);
      if (tile === "@" && move.entry !== move.cell) {
        rider.classList.add("is-hopping");
        playNote(392);
        placeRider(move.cell);
        react("HOP!", move.cell);
      } else if (move.stars !== before.stars) {
        playNote(TINKLES[trail.tiles.slice(0, move.cell).filter((tile) => tile === "*").length]);
        react("SHINE!", move.cell);
      } else if (tile === "o") {
        playNote(659.25);
        playNote(987.77);
        react("CHIME!", move.cell);
      } else if (tile === "a" && !before.lit) {
        playNote(587.33);
        react("GLOW!", move.cell);
      }
      timer = window.setTimeout(() => {
        rider.classList.remove("is-hopping");
        walk(step + 1);
      }, tile === "@" ? stepTime : 12);
    }, stepTime);
  }

  function activate() {
    if (phase === "done") {
      loadTrail(index + 1, true);
      return;
    }
    if (phase === "walk") {
      clearTimeout(timer);
      phase = "draw";
      rider.classList.remove("is-walking", "is-hopping");
      placeRider(trail.start);
      renderRoute();
      return;
    }
    if (path.length < 2) return;
    unlockAudio();
    phase = "walk";
    hintCell = -1;
    showStatus("Here comes the unicorn…");
    showTiles(path[0], 0);
    placeRider(trail.start);
    rider.classList.add("is-walking");
    updateControls();
    walk(1);
  }

  board.addEventListener("pointerdown", pointerDown, options);
  board.addEventListener("pointermove", pointerMove, options);
  board.addEventListener("pointerup", endPointer, options);
  board.addEventListener("pointercancel", endPointer, options);
  board.addEventListener("lostpointercapture", endPointer, options);
  board.addEventListener("keydown", onBoardKey, options);
  grid.addEventListener("click", (event) => {
    if (event.detail !== 0) return;
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-cell]");
    if (button) sketchTo(Number(button.dataset.cell));
  }, options);
  undo.addEventListener("click", stepBack, options);
  clear.addEventListener("click", () => {
    path.length = 1;
    hintCell = -1;
    focusTile(trail.start);
    renderRoute();
  }, options);
  hint.addEventListener("click", () => {
    hintCell = nextHint(trail, lastMove());
    showTiles(lastMove(), lastMove().stars);
    showStatus(hintCell === -1 ? "Tap Trot to follow your trail." : "Draw to the glowing tile.");
  }, options);
  trot.addEventListener("click", activate, options);

  return {
    mount(a) {
      app = a;
      app.stop();
      app.canvas.hidden = true;
      document.body.append(screen, callout.layer, finish.dialog, finish.button);
      loadTrail(0);
    },
    unmount() {
      events.abort();
      clearTimeout(timer);
      finish.remove();
      callout.remove();
      screen.remove();
      app.canvas.hidden = false;
      app.start();
    },
  };
}
