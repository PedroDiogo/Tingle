import { Application, Container, Graphics, Rectangle, type FederatedPointerEvent } from "pixi.js";
import type { Toy } from "../../toy";
import { Bubble } from "./Bubble";
import { pickKind, type BubbleKind } from "./palette";
import { playNote, unlockAudio } from "../../audio";
import { createComicCallout, createComicHud, createToyFinish, drawStar } from "../../comic";
import { Background } from "./background";

const TARGET_COUNT = 9;
const MAX_HELD_BUBBLES = 4;
const BLOW_DELAY = 0.24;
const WORLDS = [
  { name: "Bubble Meadow", sky: [0xa9e6ec, 0xdaf2e4, 0xffebbf], lanes: [0.5, 0.29, 0.71], drift: 10, height: 0.47 },
  { name: "Soda Sea", sky: [0x80d8ed, 0xc9b4ef, 0xffd6e2], lanes: [0.3, 0.72, 0.5], drift: 30, height: 0.57 },
  { name: "Moon Fizz", sky: [0xb0a5e7, 0xdac1f6, 0xa7e0df], lanes: [0.73, 0.29, 0.47], drift: 40, height: 0.5 },
  { name: "Rainbow Rush", sky: [0xffa9be, 0xffdba2, 0x9ee0cb], lanes: [0.5, 0.72, 0.29], drift: 49, height: 0.64 },
] as const;

interface Particle {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

export function createBubblePop(): Toy {
  const root = new Container();
  const bg = new Background(WORLDS[0].sky);
  const bubbleLayer = new Container();
  const particleLayer = new Container();
  const holdLayer = new Container();
  root.addChild(bg, bubbleLayer, particleLayer, holdLayer);
  root.eventMode = "static";

  const hud = createComicHud("Bubble Bash", "bubble", "Pop the star bubbles · ☆☆☆");
  const callout = createComicCallout();
  let stars = 0;
  let parties = 0;
  let world = 0;
  const finish = createToyFinish("Bubble party!", "You threw a bubble party in all four worlds.", restartRound);

  const hint = document.createElement("p");
  hint.className = "toy-hint";
  hint.textContent = "Swipe to pop · Hold to blow bubbles";

  const heldBubbles = new Map<number, {
    preview: Graphics;
    kind: BubbleKind;
    elapsed: number;
    x: number;
    y: number;
  }>();

  const swipes = new Set<number>();
  const bubbles: Bubble[] = [];
  const particles: Particle[] = [];
  let intensity = 0; // 0 = calm, ~1 = frenzy; raised by pops, decays over time
  let app: Application | null = null;
  let tickerFn: ((t: any) => void) | null = null;
  let resizeFn: (() => void) | null = null;

  function width() {
    return app!.screen.width;
  }
  function height() {
    return app!.screen.height;
  }

  function tryPlaceBubble(): { x: number; y: number; r: number; kind: BubbleKind } | null {
    const r = Math.min(55, width() * 0.13) + Math.random() * 21;
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = r + Math.random() * (width() - r * 2);
      const y = height() + r + Math.random() * 200;
      if (!collidesAny(x, y, r)) {
        return { x, y, r, kind: pickKind() };
      }
    }
    return null;
  }

  function initialPlace(): { x: number; y: number; r: number; kind: BubbleKind } | null {
    const r = Math.min(55, width() * 0.13) + Math.random() * 21;
    for (let attempt = 0; attempt < 60; attempt++) {
      const x = r + Math.random() * (width() - r * 2);
      const y = r + Math.random() * (height() - r * 2);
      if (!collidesAny(x, y, r)) {
        return { x, y, r, kind: pickKind() };
      }
    }
    return null;
  }

  function collidesAny(x: number, y: number, r: number): boolean {
    for (const b of bubbles) {
      const dx = b.x - x;
      const dy = b.y - y;
      const rr = b.radius + r + 2;
      if (dx * dx + dy * dy < rr * rr) return true;
    }
    return false;
  }

  function spawnBubble(fromBottom: boolean) {
    const spot = fromBottom ? tryPlaceBubble() : initialPlace();
    if (!spot) return false;
    addBubble(spot.kind, spot.r, spot.x, spot.y);
    return true;
  }

  function addBubble(kind: BubbleKind, radius: number, x: number, y: number, star = false) {
    const bubble = new Bubble(kind, radius, x, y, star);
    bubble.on("pointerdown", (event) => {
      event.stopPropagation();
      unlockAudio();
      swipes.add(event.pointerId);
      pop(bubble);
    });
    bubbles.push(bubble);
    if (star) bubbleLayer.addChild(bubble);
    else bubbleLayer.addChildAt(bubble, 0);
    return bubble;
  }

  function startBlowing(event: FederatedPointerEvent) {
    if (event.button !== 0 || heldBubbles.size >= MAX_HELD_BUBBLES) return;
    unlockAudio();
    const preview = new Graphics();
    preview.eventMode = "none";
    preview.position.copyFrom(event.global);
    holdLayer.addChild(preview);
    heldBubbles.set(event.pointerId, { preview, kind: pickKind(), elapsed: 0, x: event.global.x, y: event.global.y });
  }

  function moveBubble(event: FederatedPointerEvent) {
    const held = heldBubbles.get(event.pointerId);
    if (held) {
      held.preview.position.copyFrom(event.global);
      if (held.elapsed < BLOW_DELAY && Math.hypot(event.global.x - held.x, event.global.y - held.y) > 18) {
        held.preview.destroy();
        heldBubbles.delete(event.pointerId);
        swipes.add(event.pointerId);
      }
    }
    if (event.buttons === 0) swipes.delete(event.pointerId);
    if (!swipes.has(event.pointerId)) return;
    const hit = [...bubbles].reverse().find((bubble) =>
      Math.hypot(event.global.x - bubble.x, event.global.y - bubble.y) <= bubble.radius + 5
    );
    if (hit) pop(hit);
  }

  function blownRadius(elapsed: number) {
    return Math.min(68, Math.min(width(), height()) * 0.24, 19 + (elapsed - BLOW_DELAY) * 48);
  }

  function finishBlowing(pointerId: number, release: boolean) {
    swipes.delete(pointerId);
    const held = heldBubbles.get(pointerId);
    if (!held) return;
    heldBubbles.delete(pointerId);
    if (release && held.elapsed >= BLOW_DELAY && bubbles.length < TARGET_COUNT + MAX_HELD_BUBBLES) {
      const radius = blownRadius(held.elapsed);
      const x = Math.max(radius, Math.min(width() - radius, held.preview.x));
      const y = Math.max(radius, Math.min(height() - radius, held.preview.y));
      addBubble(held.kind, radius, x, y);
      hint.remove();
    }
    held.preview.destroy();
  }

  root.on("pointerdown", startBlowing);
  root.on("globalpointermove", moveBubble);
  root.on("pointerup", (event) => finishBlowing(event.pointerId, true));
  root.on("pointerupoutside", (event) => finishBlowing(event.pointerId, false));
  root.on("pointercancel", (event) => finishBlowing(event.pointerId, false));

  function spawnStar() {
    const chapter = WORLDS[world];
    const radius = Math.min(48, width() * (world === 1 ? 0.15 : 0.12));
    const x = width() * chapter.lanes[stars];
    const y = height() * chapter.height;
    const star = addBubble({ color: 0xffca66, freq: 783.99 }, radius, x, y, true);
    star.vx = chapter.drift * (stars === 2 ? -1 : 1);
    star.vy = -24;
  }

  function updateProgress() {
    hud.detail.textContent = `${WORLDS[world].name} · Pop ${"★".repeat(stars)}${"☆".repeat(3 - stars)} · ${Math.min(parties, WORLDS.length)}/${WORLDS.length}`;
  }

  function pop(b: Bubble) {
    playNote(b.kind.freq);
    let word = "POP!";
    if (b.star) {
      stars++;
      word = "STAR!";
      if (stars === 3) {
        word = "BUBBLE PARTY!";
        for (let i = 0; i < 7; i++) {
          const radius = 23 + Math.random() * 9;
          addBubble(pickKind(), radius, width() * (i + 1) / 8, height() * 0.84 + (i % 2) * 45);
        }
        playNote(1046.5);
        stars = 0;
        parties++;
        world = (world + 1) % WORLDS.length;
        bg.setPalette(WORLDS[world].sky);
        if (parties === WORLDS.length) finish.complete();
      }
      updateProgress();
    }
    callout.show(word, b.x / width(), b.y / height());
    intensity = Math.min(1.5, intensity + 0.25);
    const count = 10;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 120 + Math.random() * 180;
      const g = new Graphics();
      const pr = 4 + Math.random() * 6;
      if (b.star) drawStar(g, 0, 0, pr, b.kind.color);
      else g.circle(0, 0, pr).fill({ color: b.kind.color, alpha: 0.9 });
      g.x = b.x;
      g.y = b.y;
      particleLayer.addChild(g);
      particles.push({
        g,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        max: 0.45 + Math.random() * 0.2
      });
    }
    const idx = bubbles.indexOf(b);
    if (idx >= 0) bubbles.splice(idx, 1);
    b.destroy();
  }

  function resolveCollisions() {
    for (let i = 0; i < bubbles.length; i++) {
      const a = bubbles[i];
      for (let j = i + 1; j < bubbles.length; j++) {
        const b = bubbles[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minDist = a.radius + b.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 === 0 || d2 >= minDist * minDist) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        const overlap = minDist - d;
        // Star bubbles keep their path while ordinary bubbles bounce off them.
        const weightA = a.star ? 0 : b.star ? 1 : 0.5;
        const weightB = 1 - weightA;
        a.x -= nx * overlap * weightA;
        a.y -= ny * overlap * weightA;
        b.x += nx * overlap * weightB;
        b.y += ny * overlap * weightB;
        const va = a.vx * nx + a.vy * ny;
        const vb = b.vx * nx + b.vy * ny;
        const diff = vb - va;
        a.vx += diff * nx * weightA * 2;
        a.vy += diff * ny * weightA * 2;
        b.vx -= diff * nx * weightB * 2;
        b.vy -= diff * ny * weightB * 2;
      }
    }
  }

  function step(dt: number) {
    bg.update(dt);
    for (const held of heldBubbles.values()) {
      held.elapsed += dt;
      if (held.elapsed < BLOW_DELAY) continue;
      const radius = blownRadius(held.elapsed);
      held.preview.clear()
        .circle(0, 0, radius).fill({ color: held.kind.color, alpha: 0.45 })
        .circle(0, 0, radius).stroke({ color: 0xfffaf0, width: 3 })
        .ellipse(-radius * 0.3, -radius * 0.34, radius * 0.18, radius * 0.12)
        .fill({ color: 0xfffaf0, alpha: 0.9 });
    }

    // intensity decays ~half per second when idle
    intensity = Math.max(0, intensity - dt * 0.4);
    const buoyancy = 8 + intensity * 220; // calm ~8, frenzy ~340
    const damping = 0.995 - intensity * 0.004; // less damping when frenzied

    const w = width();
    for (const b of bubbles) {
      b.vy -= buoyancy * dt;
      // drift damping so they don't accelerate forever
      b.vx *= Math.pow(damping, dt * 60);
      b.vy *= Math.pow(damping, dt * 60);

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // bounce off side walls
      if (b.x - b.radius < 0) {
        b.x = b.radius;
        b.vx = Math.abs(b.vx);
      } else if (b.x + b.radius > w) {
        b.x = w - b.radius;
        b.vx = -Math.abs(b.vx);
      }
    }

    // resolve a few collision passes for stability
    for (let k = 0; k < 3; k++) resolveCollisions();

    // recycle bubbles that floated off top
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if (b.y + b.radius < -30) {
        bubbles.splice(i, 1);
        b.destroy();
      }
    }

    if (!bubbles.some((bubble) => bubble.star)) spawnStar();

    while (bubbles.length < TARGET_COUNT) {
      if (!spawnBubble(true)) break;
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      p.g.x += p.vx * dt;
      p.g.y += p.vy * dt;
      p.vy += 400 * dt;
      p.g.alpha = Math.max(0, 1 - p.life / p.max);
      if (p.life >= p.max) {
        p.g.destroy();
        particles.splice(i, 1);
      }
    }
  }

  function restartRound() {
    for (const bubble of bubbles) bubble.destroy({ children: true });
    for (const particle of particles) particle.g.destroy();
    for (const held of heldBubbles.values()) held.preview.destroy();
    bubbles.length = 0;
    particles.length = 0;
    heldBubbles.clear();
    stars = intensity = parties = world = 0;
    swipes.clear();
    bg.setPalette(WORLDS[0].sky);
    updateProgress();
    spawnStar();
    for (let i = 1; i < TARGET_COUNT; i++) spawnBubble(false);
  }

  function resize() {
    if (!app) return;
    bg.resize(width(), height());
    root.hitArea = new Rectangle(0, 0, width(), height());
  }

  return {
    mount(a: Application) {
      app = a;
      a.stage.addChild(root);
      document.body.append(hud.root, hint, callout.layer, finish.dialog, finish.button);
      resize();
      restartRound();
      tickerFn = (t) => { if (!finish.dialog.open) step(t.deltaMS / 1000); };
      a.ticker.add(tickerFn);
      resizeFn = resize;
      window.addEventListener("resize", resizeFn);
      a.renderer.on("resize", resize);
    },
    unmount() {
      if (app && tickerFn) app.ticker.remove(tickerFn);
      if (app && resizeFn) app.renderer.off("resize", resizeFn);
      if (resizeFn) window.removeEventListener("resize", resizeFn);
      hint.remove();
      hud.root.remove();
      callout.remove();
      finish.remove();
      heldBubbles.clear();
      root.destroy({ children: true });
      bubbles.length = 0;
      particles.length = 0;
      app = null;
      tickerFn = null;
      resizeFn = null;
    }
  };
}
