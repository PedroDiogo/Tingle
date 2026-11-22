import type { createSideFlightView } from "./view";
import { COMIC_INK, createComicCallout, createComicHud, createToyFinish, drawStar } from "../../comic";
import { makePaperCloud } from "../../paperScene";
import { Application, Container, FederatedPointerEvent, Graphics, Rectangle } from "pixi.js";
import type { Toy } from "../../toy";
import { Background } from "./background";
import { Airplane } from "./airplane";
import { Spawner } from "./obstacles";
import { Music } from "./music";
import { ConfettiLayer } from "../piano/confetti";
import { playNote, unlockAudio } from "../../audio";

const ROUTES = [
  { name: "Cloud Lane", sky: [0xaee3f6, 0xbab9f1, 0xfbd2cd], stops: [[0.73, 0.31], [0.35, 0.7]], drift: 0 },
  { name: "Sunset Post", sky: [0xffbfa5, 0xf6adc8, 0xb5b8ed], stops: [[0.66, 0.66], [0.36, 0.32]], drift: 0.045 },
  { name: "Moonbeam Mail", sky: [0xa8a7e5, 0xb0d6f0, 0xe9c6ea], stops: [[0.54, 0.3], [0.64, 0.62]], drift: 0.07 },
  { name: "Rainbow Route", sky: [0xa4e5d9, 0xe9d0a6, 0xf8b6ca], stops: [[0.35, 0.58], [0.69, 0.38]], drift: 0.085 },
] as const;
const COURSE_CHECKPOINT = 20;
const COURSE_WAVES = 3;

export function createPuppyPlane(): Toy {
  const root = new Container();
  const bg = new Background();
  const obstacleLayer = new Container();
  const plane = new Airplane();
  const confetti = new ConfettiLayer();
  const trail = new Graphics();
  const mailbox = new Container();
  const targetCloud = makePaperCloud();
  targetCloud.position.set(0, 27);
  const post = new Graphics()
    .roundRect(-5, 1, 10, 42, 3).fill(0xc98874).stroke({ color: COMIC_INK, width: 3 })
    .roundRect(-26, -24, 53, 31, 10).fill(0xf99c75).stroke({ color: COMIC_INK, width: 3 })
    .roundRect(-20, -17, 29, 17, 3).fill(0xffd968).stroke({ color: COMIC_INK, width: 2 })
    .moveTo(-20, -16).lineTo(-5, -7).lineTo(9, -16).stroke({ color: COMIC_INK, width: 2 })
    .moveTo(19, -12).lineTo(19, -36).lineTo(36, -36).stroke({ color: COMIC_INK, width: 3 });
  drawStar(post, 37, -36, 9);
  mailbox.addChild(targetCloud, post);
  mailbox.visible = false;
  root.addChild(bg, obstacleLayer, trail, mailbox, plane, confetti);
  const hud = createComicHud("Puppy Post", "deliveries", "Bump a balloon to pick up a letter");
  const callout = createComicCallout();
  let cargo = false;
  let deliveries = 0;
  let courseBestWave = 0;
  let flightTime = 0;
  const finish = createToyFinish("Special delivery!", "You delivered eight letters across four routes.", () => {
    deliveries = courseBestWave = 0;
    updateRoute();
    resetWorld();
    updateDeliveryHud();
  });

  const flightButton = document.createElement("button");
  flightButton.type = "button";
  flightButton.className = "play-button flight-mode";
  flightButton.textContent = "Obstacle course";
  flightButton.setAttribute("aria-pressed", "false");
  flightButton.addEventListener("click", () => {
    clearCrashNotes();
    spawner.challenge = !spawner.challenge;
    finish.clear();
    if (spawner.challenge) courseBestWave = 0;
    else deliveries = 0;
    updateRoute();
    flightButton.setAttribute("aria-pressed", String(spawner.challenge));
    resetWorld();
    updateDeliveryHud();
    music.stop();
    if (spawner.challenge) music.start();
  });

  const spawner = new Spawner(obstacleLayer);
  const music = new Music();

  let app: Application | null = null;
  let view: ReturnType<typeof createSideFlightView> | undefined;
  let tickerFn: ((t: any) => void) | null = null;
  let resizeFn: (() => void) | null = null;

  let dragPointer: number | null = null;
  const crashNotes: number[] = [];
  const wisps: { x: number; y: number; age: number }[] = [];
  let nextWisp = 0;
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
    plane.scale.set(planeScale());
  }

  function planeScale() {
    return Math.min(1, Math.min(width(), height()) / 490);
  }

  function startDrag(event: FederatedPointerEvent) {
    if (plane.crashing || dragPointer !== null || event.button !== 0) return;
    unlockAudio();
    dragPointer = event.pointerId;
    updateTarget(event.global.x, event.global.y);
  }

  function moveDrag(event: FederatedPointerEvent) {
    if (dragPointer !== event.pointerId || plane.crashing) return;
    updateTarget(event.global.x, event.global.y);
  }

  function endDrag(event: FederatedPointerEvent) {
    if (dragPointer === event.pointerId) dragPointer = null;
  }

  function updateTarget(x: number, y: number) {
    const margin = 100 * planeScale();
    const right = spawner.challenge ? Math.max(margin, width() * 0.55) : width() - margin;
    targetX = Math.max(margin, Math.min(right, x));
    targetY = Math.max(54, Math.min(height() - 54, y));
  }

  function updateRoute() {
    spawner.route = spawner.challenge ? courseBestWave % ROUTES.length : Math.floor(deliveries / 2) % ROUTES.length;
    bg.setPalette(ROUTES[spawner.route].sky);
  }

  function updateDeliveryHud() {
    const instruction = spawner.challenge ? `Wave ${Math.min(courseBestWave + 1, COURSE_WAVES)} · Dodge obstacles`
      : cargo ? "Fly to the cloud mailbox" : "Bump a balloon to pick up a letter";
    const progress = spawner.challenge
      ? `${Math.min(COURSE_CHECKPOINT * COURSE_WAVES, Math.floor(spawner.worldTime))}/${COURSE_CHECKPOINT * COURSE_WAVES} s`
      : `✉ ${Math.min(deliveries, ROUTES.length * 2)}/${ROUTES.length * 2}`;
    const label = `${instruction} · ${progress}`;
    if (hud.detail.textContent !== label) hud.detail.textContent = label;
  }

  function placeMailbox() {
    const route = ROUTES[spawner.route];
    const [x, y] = route.stops[deliveries % 2];
    const sway = Math.sin(flightTime * 1.25) * route.drift;
    mailbox.position.set(width() * (x + sway), height() * (y + sway * 0.56));
    mailbox.scale.set(Math.min(1, width() / 410));
  }

  function deliver() {
    if (!cargo || Math.hypot(plane.x - mailbox.x, plane.y - mailbox.y) > 57) return;
    playNote(523.25);
    playNote(783.99);
    confetti.burst(mailbox.x, mailbox.y, 38);
    cargo = false;
    deliveries++;
    if (deliveries % 2 === 0) {
      updateRoute();
      callout.show(ROUTES[spawner.route].name.toUpperCase(), mailbox.x / width(), mailbox.y / height());
      playNote(987.77);
    } else {
      callout.show("AIR MAIL!", mailbox.x / width(), mailbox.y / height());
    }
    if (deliveries === ROUTES.length * 2) finish.complete();
    mailbox.visible = false;
    updateDeliveryHud();
  }

  function handleCollision() {
    const planeRadius = plane.collisionRadius * planeScale();
    for (const obstacle of spawner.obstacles) {
      const collided = obstacle.circles.some((circle) =>
        Math.hypot(obstacle.x + circle.dx - plane.x, obstacle.y + circle.dy - plane.y)
          < circle.r + planeRadius
      );
      if (!collided) continue;
      if (spawner.challenge) {
        triggerCrash();
      } else {
        confetti.burst(obstacle.x, obstacle.y, 20);
        playNote(659.25);
        callout.show(cargo ? "POP!" : "PICKUP!", obstacle.x / width(), obstacle.y / height());
        if (!cargo) {
          cargo = true;
          placeMailbox();
          mailbox.visible = true;
          updateDeliveryHud();
        }
        spawner.remove(obstacle);
      }
      break;
    }
  }

  function clearCrashNotes() {
    for (const timeout of crashNotes) clearTimeout(timeout);
    crashNotes.length = 0;
  }

  function triggerCrash() {
    if (plane.crashing) return;
    plane.startCrash();
    spawner.paused = true;
    music.duckFor(1100);
    // crash sound: descending tone
    playNote(220);
    clearCrashNotes();
    crashNotes.push(window.setTimeout(() => playNote(165), 90));
    crashNotes.push(window.setTimeout(() => playNote(110), 180));

    // scatter puppy-colored confetti from the plane
    confetti.burst(plane.x, plane.y, 18);
    crashTimer = 1.3;
  }

  function resetWorld(resumeWave = false) {
    spawner.reset();
    if (resumeWave) spawner.worldTime = courseBestWave * COURSE_CHECKPOINT;
    cargo = false;
    mailbox.visible = false;
    dragPointer = null;
    wisps.length = 0;
    trail.clear();
    nextWisp = 0;
    placePlane(Math.max(100 * planeScale(), width() * 0.22), height() * 0.5);
  }

  function step(dt: number) {
    flightTime += dt;
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
      if (crashTimer <= 0) resetWorld(true);
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
    if (spawner.challenge) {
      updateDeliveryHud();
      const wave = Math.min(COURSE_WAVES, Math.floor(spawner.worldTime / COURSE_CHECKPOINT));
      if (wave > courseBestWave) {
        courseBestWave = wave;
        updateRoute();
        callout.show("WAVE CLEAR!", 0.52, 0.43);
        playNote(783.99);
        if (wave === COURSE_WAVES) finish.complete("You cleared all three waves.", "Course clear!");
      }
    }

    if (cargo) placeMailbox();
    deliver();
    handleCollision();
    drawTrail(dt);
  }

  function drawTrail(dt: number) {
    nextWisp -= dt;
    if (!spawner.challenge && nextWisp <= 0 && bg.isInCloud(plane.x, plane.y)) {
      wisps.push({ x: plane.x - 70 * planeScale(), y: plane.y, age: 0 });
      nextWisp = 0.12;
    }
    trail.clear();
    for (let i = wisps.length - 1; i >= 0; i--) {
      const wisp = wisps[i];
      wisp.age += dt;
      wisp.x -= 46 * dt;
      if (wisp.age > 0.8) {
        wisps.splice(i, 1);
        continue;
      }
      const radius = 5 + wisp.age * 18;
      const y = wisp.y - wisp.age * 16;
      trail.moveTo(wisp.x + radius * Math.cos(0.2), y + radius * Math.sin(0.2))
        .arc(wisp.x, y, radius, 0.2, Math.PI * 1.7)
        .stroke({ color: 0xfffdf6, width: 3, alpha: 1 - wisp.age / 0.8, cap: "round" });
    }
  }

  function resize() {
    if (!app) return;
    bg.resize(width(), height());
    spawner.resize(width(), height());
    placeMailbox();
    plane.scale.set(planeScale());
    view?.resize(width(), height());
    updateTarget(targetX, targetY);
    // keep stage hit area in sync
    app.stage.hitArea = new Rectangle(0, 0, width(), height());
  }

  function stop3DView() {
    view?.destroy();
    view = undefined;
    bg.useFlatClouds(true);
    obstacleLayer.renderable = true;
    mailbox.renderable = true;
    plane.renderable = true;
  }

  function render3D(dt: number) {
    view?.draw(dt, {
      plane,
      scale: planeScale(),
      speed: spawner.worldSpeed(),
      cargo,
      mailbox,
      obstacles: spawner.obstacles,
    });
  }

  return {
    mount(a: Application) {
      app = a;
      a.stage.addChild(root);
      a.stage.eventMode = "static";
      a.stage.hitArea = new Rectangle(0, 0, width(), height());

      bg.resize(width(), height());
      spawner.resize(width(), height());
      resetWorld();
      document.body.append(hud.root, flightButton, callout.layer, finish.dialog, finish.button);
      updateDeliveryHud();

      a.stage.on("pointerdown", startDrag);
      a.stage.on("globalpointermove", moveDrag);
      a.stage.on("pointerup", endDrag);
      a.stage.on("pointerupoutside", endDrag);
      a.stage.on("pointercancel", endDrag);

      tickerFn = (t) => {
        const dt = t.deltaMS / 1000;
        if (finish.dialog.open) return;
        step(dt);
        render3D(dt);
      };
      a.ticker.add(tickerFn);

      resizeFn = resize;
      window.addEventListener("resize", resizeFn);
      a.renderer.on("resize", resize);
      void import("./view").then(({ createSideFlightView }) => {
        if (app !== a) return;
        view = createSideFlightView(bg, stop3DView);
        view.resize(width(), height());
        bg.useFlatClouds(false);
        obstacleLayer.renderable = false;
        mailbox.renderable = false;
        plane.renderable = false;
      }).catch(() => { if (app === a) stop3DView(); });

    },
    unmount() {
      music.stop();
      stop3DView();
      clearCrashNotes();
      flightButton.remove();
      hud.root.remove();
      callout.remove();
      finish.remove();
      if (app && tickerFn) app.ticker.remove(tickerFn);
      if (app && resizeFn) app.renderer.off("resize", resizeFn);
      if (resizeFn) window.removeEventListener("resize", resizeFn);
      if (app) {
        app.stage.off("pointerdown", startDrag);
        app.stage.off("globalpointermove", moveDrag);
        app.stage.off("pointerup", endDrag);
        app.stage.off("pointerupoutside", endDrag);
        app.stage.off("pointercancel", endDrag);
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
