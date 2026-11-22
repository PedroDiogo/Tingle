import { Container, Graphics, Rectangle, type Application, type FederatedPointerEvent, type Ticker } from "pixi.js";
import { COMIC_INK, COMIC_PALETTE, createComicCallout, createComicHud, createToyFinish, drawStar } from "../../comic";
import { makeCritter } from "../../critter";
import { playNote, unlockAudio } from "../../audio";
import { makePaperCloud, paintPaperSky } from "../../paperScene";
import type { Toy } from "../../toy";
import { ConfettiLayer } from "../piano/confetti";

const WORLDS = [
  { sky: [0xe0b7f1, 0xb7e6fd, 0xffedb9], ground: 0x92d5a9, name: "Marshmallow Meadow", lanes: [0.5, 0.68, 0.32], drift: 0, gravity: 860, height: 0.39 },
  { sky: [0xffbcc5, 0xfac98e, 0xffefb9], ground: 0xf4bb81, name: "Peach Puff Park", lanes: [0.37, 0.65, 0.49], drift: 0.045, gravity: 940, height: 0.34 },
  { sky: [0xb3c0ff, 0xc8e5f8, 0xc4efd6], ground: 0x9c97db, name: "Moonberry Hill", lanes: [0.62, 0.35, 0.5], drift: 0.07, gravity: 590, height: 0.36 },
  { sky: [0xf3ace2, 0xc7aefa, 0xffe69d], ground: 0x77cbc0, name: "Starfall Spring", lanes: [0.45, 0.65, 0.35], drift: 0.09, gravity: 760, height: 0.32 },
] as const;
const NOTES = [392, 493.88, 587.33, 783.99];

export function createCritterBounce(): Toy {
  const root = new Container({ eventMode: "static" });
  const backdrop = new Container();
  const sky = new Graphics();
  const ground = new Graphics();
  const cloudOne = makePaperCloud();
  const cloudTwo = makePaperCloud();
  const spring = new Graphics();
  const star = new Graphics();
  const confetti = new ConfettiLayer();
  const { critter, expression } = makeCritter(COMIC_PALETTE[2], "bunny");
  backdrop.addChild(sky, cloudOne, cloudTwo, ground);
  root.addChild(backdrop, star, spring, critter, confetti);

  const hud = createComicHud("Critter Bounce", "bounce", "");
  const callout = createComicCallout();
  const finish = createToyFinish("Star party!", "You bounced through all four meadows.", () => {
    stars = 0;
    world = rounds = 0;
    x = target = paddle = w / 2;
    y = floor - 80 * scale;
    vx = vy = 0;
    active = false;
    drawBackdrop();
    showProgress();
  });
  const jumpButton = document.createElement("button");
  jumpButton.type = "button";
  jumpButton.className = "circus-roll comic-action";
  jumpButton.textContent = "Bounce!";
  const controls = new AbortController();
  const options = { signal: controls.signal };

  let app: Application;
  let w = 0;
  let h = 0;
  let floor = 0;
  let scale = 1;
  let target = 0;
  let paddle = 0;
  let x = 0;
  let y = 0;
  let vx = 0;
  let vy = 0;
  let clock = 0;
  let pressedPointer: number | null = null;
  let active = false;
  let stars = 0;
  let world = 0;
  let rounds = 0;
  let airSteer = 0;
  let squash = 0;
  let happy = false;
  const keys = new Set<string>();

  function showProgress() {
    hud.detail.textContent = (stars || world)
      ? `${WORLDS[world].name} · ${"★".repeat(stars)}${"☆".repeat(3 - stars)} · ${Math.min(rounds, WORLDS.length)}/${WORLDS.length}`
      : "Move the spring · Bounce into stars";
  }

  function drawBackdrop() {
    backdrop.cacheAsTexture(false);
    paintPaperSky(sky, w, h, WORLDS[world].sky, 0.82);
    cloudOne.position.set(w * 0.21, h * 0.3);
    cloudTwo.position.set(w * 0.79, h * 0.53);
    cloudTwo.scale.set(0.72);
    ground.clear().moveTo(0, floor + 30)
      .bezierCurveTo(w * 0.26, floor - 3, w * 0.51, floor + 48, w, floor + 20)
      .lineTo(w, h).lineTo(0, h).closePath()
      .fill(WORLDS[world].ground).stroke({ color: COMIC_INK, width: 2 });
    backdrop.cacheAsTexture(true);
  }

  function resize() {
    const oldWidth = w;
    const oldHeight = h;
    w = app.screen.width;
    h = app.screen.height;
    if (w === oldWidth && h === oldHeight) return;
    floor = h - Math.max(57, h * 0.12);
    scale = Math.min(1.2, Math.max(0.54, Math.min(w, h) / 465));
    root.hitArea = new Rectangle(0, 0, w, h);
    x = oldWidth ? x * w / oldWidth : w / 2;
    y = oldHeight ? Math.min(floor - 30 * scale, y * h / oldHeight) : floor - 80 * scale;
    paddle = target = oldWidth ? target * w / oldWidth : w / 2;
    drawBackdrop();
    star.clear();
    drawStar(star, 0, 0, 24 * scale);
  }

  function goalPosition() {
    const meadow = WORLDS[world];
    star.position.set(
      w * (meadow.lanes[stars] + Math.sin(clock * 1.9 + stars) * meadow.drift),
      h * meadow.height + Math.sin(clock * 2.6) * (9 + world * 4),
    );
    star.rotation = Math.sin(clock * 2) * 0.23;
  }

  function launch() {
    unlockAudio();
    active = true;
    vy = -Math.sqrt(2 * WORLDS[world].gravity * Math.max(105, y - h * 0.19));
    vx = (target - x) * 1.35;
    airSteer = 0.9;
    squash = 0.75;
    playNote(329.63);
  }

  function collectStar() {
    const completed = stars === 2;
    playNote(NOTES[stars]);
    confetti.burst(star.x, star.y, completed ? 53 : 20);
    callout.show(completed ? "STAR PARTY!" : "BOING!", star.x / w, star.y / h);
    if (completed) {
      stars = 0;
      rounds++;
      world = (world + 1) % WORLDS.length;
      drawBackdrop();
      playNote(NOTES[3]);
      if (rounds === WORLDS.length) finish.complete();
    } else {
      stars++;
    }
    showProgress();
  }

  function handleDown(event: FederatedPointerEvent) {
    if (event.button !== 0 || pressedPointer !== null) return;
    unlockAudio();
    active = true;
    pressedPointer = event.pointerId;
    target = event.global.x;
    if (Math.hypot(event.global.x - x, event.global.y - y) < 48 * scale) launch();
  }

  function handleMove(event: FederatedPointerEvent) {
    if (pressedPointer === event.pointerId) target = event.global.x;
  }

  function handleUp(event: FederatedPointerEvent) {
    if (pressedPointer === event.pointerId) pressedPointer = null;
  }

  function drawSpring() {
    const half = 63 * scale;
    spring.clear().ellipse(paddle, floor + 22, half, 13 * scale).fill(0x5b4a7b, 0.18);
    for (const side of [-1, 1]) {
      const leg = paddle + side * (half - 12 * scale);
      spring.moveTo(leg, floor).lineTo(leg + side * 9 * scale, floor + 18 * scale)
        .stroke({ color: COMIC_INK, width: 5 * scale, cap: "round" });
    }
    spring.roundRect(paddle - half, floor - 5 * scale, half * 2, 12 * scale, 6 * scale)
      .fill(0xf68ca9).stroke({ color: COMIC_INK, width: 3 * scale });
  }

  function update(ticker: Ticker) {
    if (finish.dialog.open) return;
    const dt = Math.min(ticker.deltaMS * 0.001, 0.035);
    clock += dt;
    const steer = Number(keys.has("ArrowRight")) - Number(keys.has("ArrowLeft"));
    target = Math.max(47 * scale, Math.min(w - 47 * scale, target + steer * dt * 470));
    paddle += (target - paddle) * Math.min(1, dt * 12);

    const radius = 34 * scale;
    const oldBottom = y + radius;
    const speed = WORLDS[world].gravity;
    if (airSteer > 0) {
      airSteer -= dt;
      vx += ((target - x) * 2.45 - vx) * Math.min(1, dt * 3.8);
    }
    x += vx * dt;
    if (x < radius || x > w - radius) {
      x = Math.max(radius, Math.min(w - radius, x));
      vx *= -0.8;
    }
    vy += dt * speed;
    y += dt * vy;
    if (oldBottom <= floor && y + radius >= floor && Math.abs(x - paddle) < 76 * scale) {
      y = floor - radius;
      const height = active ? h * 0.7 : h * 0.24;
      vy = -Math.sqrt(2 * speed * height);
      vx = (x - paddle) * 3.05;
      airSteer = 0;
      squash = 1;
      if (active) playNote(261.63);
    } else if (y + radius >= floor + 35 * scale && vy > 0) {
      y = floor + 35 * scale - radius;
      vy = -Math.sqrt(2 * speed * h * 0.35);
      vx = (paddle - x) * 1.2;
      squash = 0.45;
    }

    squash = Math.max(0, squash - dt * 4.3);
    critter.position.set(x, y);
    critter.scale.set(scale * (1 + squash * 0.18), scale * (1 - squash * 0.22));
    critter.rotation = Math.max(-0.28, Math.min(0.28, vx * 0.0017));
    if (happy !== (vy < -95)) {
      happy = vy < -95;
      expression(happy);
    }
    goalPosition();
    if (active && Math.hypot(x - star.x, y - star.y) < radius + 20 * scale) collectStar();
    drawSpring();
    confetti.update(dt);
  }

  return {
    mount(application) {
      app = application;
      app.stage.addChild(root);
      document.body.append(hud.root, jumpButton, callout.layer, finish.dialog, finish.button);
      resize();
      showProgress();
      root.on("pointerdown", handleDown);
      root.on("globalpointermove", handleMove);
      root.on("pointerup", handleUp);
      root.on("pointerupoutside", handleUp);
      root.on("pointercancel", handleUp);
      jumpButton.addEventListener("click", launch, options);
      window.addEventListener("keydown", (event) => {
        if (document.querySelector("dialog[open]")) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          keys.add(event.key);
          active = true;
          unlockAudio();
          event.preventDefault();
        }
      }, options);
      window.addEventListener("keyup", (event) => keys.delete(event.key), options);
      window.addEventListener("blur", () => keys.clear(), options);
      app.renderer.on("resize", resize);
      app.ticker.add(update);
    },
    unmount() {
      controls.abort();
      app.renderer.off("resize", resize);
      app.ticker.remove(update);
      root.destroy({ children: true });
      hud.root.remove();
      jumpButton.remove();
      callout.remove();
      finish.remove();
    },
  };
}
