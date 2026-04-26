import { Application, Container, FederatedPointerEvent, Rectangle } from "pixi.js";
import type { Toy } from "../../toy";
import { Background } from "./background";
import { Airplane } from "./airplane";
import { Spawner } from "./obstacles";
import { Music } from "./music";
import { ConfettiLayer } from "../piano/confetti";
import { playNote, unlockAudio } from "../../audio";

export function createPuppyPlane(): Toy {
  const root = new Container();
  const bg = new Background();
  const obstacleLayer = new Container();
  const plane = new Airplane();
  const confetti = new ConfettiLayer();
  root.addChild(bg, obstacleLayer, plane, confetti);

  const spawner = new Spawner(obstacleLayer);
  const music = new Music();

  let app: Application | null = null;
  let tickerFn: ((t: any) => void) | null = null;
  let resizeFn: (() => void) | null = null;

  let dragging = false;
  let targetX = 0;
  let targetY = 0;
  let crashTimer = 0;

  function width() {
    return app!.screen.width;
  }
  function height() {
    return app!.screen.height;
  }

  function placePlane(x: number, y: number) {
    plane.reset(x, y);
    targetX = x;
    targetY = y;
  }

  function startDrag(e: FederatedPointerEvent) {
    if (plane.crashing) return;
    dragging = true;
    updateTarget(e.global.x, e.global.y);
  }
  function moveDrag(e: FederatedPointerEvent) {
    if (!dragging || plane.crashing) return;
    updateTarget(e.global.x, e.global.y);
  }
  function endDrag() {
    dragging = false;
  }
  function updateTarget(x: number, y: number) {
    targetX = Math.max(80, Math.min(width() * 0.55, x));
    targetY = Math.max(60, Math.min(height() - 60, y));
  }

  function checkCollision(): boolean {
    const px = plane.x;
    const py = plane.y;
    const pr = plane.collisionRadius;
    for (const o of spawner.obstacles) {
      for (const c of o.circles) {
        const cx = o.x + c.dx;
        const cy = o.y + c.dy;
        const dx = cx - px;
        const dy = cy - py;
        const rr = c.r + pr;
        if (dx * dx + dy * dy < rr * rr) return true;
      }
    }
    return false;
  }

  function triggerCrash() {
    if (plane.crashing) return;
    plane.startCrash();
    spawner.paused = true;
    music.duckFor(1100);
    // crash sound: descending tone
    playNote(220);
    setTimeout(() => playNote(165), 90);
    setTimeout(() => playNote(110), 180);

    // scatter puppy-colored confetti from the plane
    confetti.burst(plane.x, plane.y, 18);
    crashTimer = 1.3;
  }

  function resetWorld() {
    spawner.reset();
    placePlane(width() * 0.22, height() * 0.5);
  }

  function step(dt: number) {
    bg.update(dt, spawner.worldSpeed());
    confetti.update(dt);

    if (plane.crashing) {
      crashTimer -= dt;
      // drift down and shrink while spinning
      plane.vy += 600 * dt;
      plane.y += plane.vy * dt;
      plane.x -= 60 * dt;
      plane.alpha = Math.max(0, plane.alpha - dt * 0.6);
      plane.update(dt);
      // obstacles keep moving so the world scrolls past
      spawner.update(dt);
      if (crashTimer <= 0) resetWorld();
      return;
    }

    // linear approach: constant speed toward target, decelerates within NEAR_PX of destination
    const MAX_SPEED = 380; // px/s hard cap
    const NEAR_PX = 80;    // deceleration zone
    const dx = targetX - plane.x;
    const dy = targetY - plane.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0.5) {
      const speed = Math.min(MAX_SPEED, (dist / NEAR_PX) * MAX_SPEED);
      const move = Math.min(dist, speed * dt);
      plane.vx = (dx / dist) * speed;
      plane.vy = (dy / dist) * speed;
      plane.x += (dx / dist) * move;
      plane.y += (dy / dist) * move;
    } else {
      plane.vx = 0;
      plane.vy = 0;
    }

    plane.update(dt, spawner.worldSpeed());
    spawner.update(dt);

    if (checkCollision()) triggerCrash();
  }

  function resize() {
    if (!app) return;
    bg.resize(width(), height());
    spawner.resize(width(), height());
    // keep stage hit area in sync
    app.stage.hitArea = new Rectangle(0, 0, width(), height());
  }

  return {
    mount(a: Application) {
      app = a;
      a.stage.addChild(root);
      a.stage.eventMode = "static";
      a.stage.hitArea = new Rectangle(0, 0, width(), height());

      bg.resize(width(), height());
      spawner.resize(width(), height());
      placePlane(width() * 0.22, height() * 0.5);

      a.stage.on("pointerdown", (e) => {
        unlockAudio();
        startDrag(e);
      });
      a.stage.on("pointermove", moveDrag);
      a.stage.on("pointerup", endDrag);
      a.stage.on("pointerupoutside", endDrag);

      tickerFn = (t) => step(t.deltaMS / 1000);
      a.ticker.add(tickerFn);

      resizeFn = resize;
      window.addEventListener("resize", resizeFn);
      a.renderer.on("resize", resize);

      music.start();
    },
    unmount() {
      music.stop();
      if (app && tickerFn) app.ticker.remove(tickerFn);
      if (app && resizeFn) app.renderer.off("resize", resizeFn);
      if (resizeFn) window.removeEventListener("resize", resizeFn);
      if (app) {
        app.stage.off("pointerdown");
        app.stage.off("pointermove");
        app.stage.off("pointerup");
        app.stage.off("pointerupoutside");
        app.stage.eventMode = "auto";
        app.stage.hitArea = null;
      }
      root.destroy({ children: true });
      app = null;
      tickerFn = null;
      resizeFn = null;
    }
  };
}
