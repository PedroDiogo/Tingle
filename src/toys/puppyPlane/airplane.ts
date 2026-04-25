import { Container, Graphics } from "pixi.js";

const STROKE = 0x3a2a18;
const WING = 0xffaa3a;
const WING_DARK = 0xc97a36;
const PILOT_FUR = 0xf6c277;
const PILOT_FUR_DARK = 0xd49a4a;

// Three passenger puppies: distinct colors so each window reads as its own pup.
const PASSENGER_PUPS = [
  { fur: 0xffffff, spot: 0x2a3142 }, // white with black spot
  { fur: 0x9a6a3c, spot: 0x6b4a28 }, // brown
  { fur: 0xf3c5d6, spot: 0xd28aa0 }  // pink
];

export class Airplane extends Container {
  readonly collisionRadius = 42;
  vx = 0;
  vy = 0;
  crashing = false;

  private bottomWing = new Graphics();
  private topWing = new Graphics();
  private struts = new Graphics();
  private body = new Graphics();
  private tail = new Graphics();
  private cockpit = new Graphics();
  private windows = new Container();
  private pilot: Container;
  private scarfTail = new Graphics();
  private windLines = new Graphics();
  private prop = new Graphics();

  private scarfPhase = 0;
  private earPhase = 0;
  private windPhase = 0;
  private crashSpin = 0;

  constructor() {
    super();
    this.pilot = makePilot();
    this.draw();

    // z-order back→front
    this.addChild(
      this.tail,
      this.topWing,
      this.bottomWing,
      this.body,
      this.windows,
      this.struts,
      this.cockpit,
      this.scarfTail,
      this.windLines,
      this.pilot,
      this.prop
    );
  }

  private draw() {
    // ---- Tail ----
    this.tail.clear();
    this.tail
      .poly([-72, -10, -72, -44, -42, -10])
      .fill({ color: WING })
      .stroke({ color: STROKE, width: 2 });
    this.tail
      .poly([-72, 16, -64, 30, -46, 16])
      .fill({ color: WING })
      .stroke({ color: STROKE, width: 2 });

    // ---- Bottom wing (lower biplane wing, attached at fuselage bottom) ----
    const bw = this.bottomWing;
    bw.clear();
    bw.roundRect(-86, 20, 178, 13, 6).fill({ color: WING }).stroke({ color: STROKE, width: 2 });
    bw.rect(-82, 30, 170, 2).fill({ color: WING_DARK, alpha: 0.85 });
    bw.circle(-82, 26, 3.5).fill({ color: 0xff5a6e }).stroke({ color: STROKE, width: 1 });
    bw.circle(90, 26, 3.5).fill({ color: 0x6be3a0 }).stroke({ color: STROKE, width: 1 });

    // ---- Top wing ----
    const tw = this.topWing;
    tw.clear();
    tw.roundRect(-78, -64, 162, 10, 5).fill({ color: WING }).stroke({ color: STROKE, width: 2 });
    tw.rect(-74, -57, 154, 2).fill({ color: WING_DARK, alpha: 0.85 });
    tw.circle(-74, -59, 3).fill({ color: 0xff5a6e }).stroke({ color: STROKE, width: 1 });
    tw.circle(80, -59, 3).fill({ color: 0x6be3a0 }).stroke({ color: STROKE, width: 1 });

    // ---- Struts ----
    const st = this.struts;
    st.clear();
    st.rect(-30, -54, 3, 28).fill({ color: STROKE });
    st.rect(46, -54, 3, 28).fill({ color: STROKE });
    st.moveTo(-28, -54).lineTo(48, -28).stroke({ color: STROKE, width: 1, alpha: 0.55 });
    st.moveTo(48, -54).lineTo(-28, -28).stroke({ color: STROKE, width: 1, alpha: 0.55 });

    // ---- Fuselage ----
    this.body.clear();
    this.body
      .roundRect(-72, -26, 132, 54, 24)
      .fill({ color: 0xffd166 })
      .stroke({ color: STROKE, width: 2 });
    this.body
      .poly([60, -20, 60, 20, 84, 0])
      .fill({ color: 0xff9a6b })
      .stroke({ color: STROKE, width: 2 });
    this.body
      .roundRect(-66, 12, 122, 6, 3)
      .fill({ color: 0xff9a6b, alpha: 0.7 });
    for (let i = 0; i < 6; i++) {
      this.body.circle(-58 + i * 23, 15, 1.3).fill({ color: STROKE, alpha: 0.55 });
    }

    // ---- Cockpit ----
    this.cockpit.clear();
    this.cockpit
      .ellipse(20, -22, 26, 22)
      .fill({ color: 0xb6e3ff, alpha: 0.8 })
      .stroke({ color: STROKE, width: 2 });
    this.cockpit.ellipse(14, -32, 7, 3.5).fill({ color: 0xffffff, alpha: 0.85 });
    this.cockpit
      .roundRect(-6, -8, 52, 8, 3)
      .fill({ color: WING_DARK })
      .stroke({ color: STROKE, width: 2 });

    this.pilot.x = 20;
    this.pilot.y = -28;

    // ---- Three round passenger windows ----
    this.windows.removeChildren();
    const winXs = [-56, -34, -12];
    for (let i = 0; i < 3; i++) {
      const w = makePorthole(PASSENGER_PUPS[i].fur, PASSENGER_PUPS[i].spot);
      w.x = winXs[i];
      w.y = -2;
      this.windows.addChild(w);
    }

    // ---- Propeller ----
    this.prop.clear();
    this.prop.rect(-3, -32, 6, 64).fill({ color: 0x2a3142 });
    this.prop.circle(0, 0, 6).fill({ color: 0x2a3142 });
    this.prop.circle(0, 0, 2.5).fill({ color: WING });
    this.prop.x = 86;
  }

  update(dt: number, worldSpeed = 200) {
    if (this.crashing) {
      this.crashSpin += dt * 9;
      this.rotation = this.crashSpin;
      this.prop.rotation += dt * 4;
      return;
    }
    this.prop.rotation += dt * 38;

    const target = Math.max(-0.35, Math.min(0.35, this.vy * 0.0015));
    this.rotation += (target - this.rotation) * Math.min(1, dt * 8);

    const intensity = Math.min(1, (worldSpeed - 200) / 600);

    this.earPhase += dt * (9 + intensity * 20);
    this.scarfPhase += dt * (7 + intensity * 14);
    this.windPhase += dt * (3 + intensity * 11);

    pilotEarFlap(this.pilot, this.earPhase, intensity);
    pilotCheeks(this.pilot, intensity);
    this.drawScarfTail(this.scarfPhase, intensity);
    this.drawWindLines(intensity, this.windPhase);
  }

  private drawScarfTail(phase: number, intensity = 0) {
    const g = this.scarfTail;
    g.clear();
    const ax = 10;
    const ay = -22;
    const len = 56 + intensity * 65;
    const waveAmp = 6 + intensity * 20;
    const segs = 8;
    const thickness = 4 + intensity * 4;
    const top: { x: number; y: number }[] = [];
    const bot: { x: number; y: number }[] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = ax - t * len;
      const wave = Math.sin(phase + t * (4.5 + intensity * 5.5)) * waveAmp * t;
      const cy = ay + 2 + wave;
      top.push({ x, y: cy - thickness });
      bot.push({ x, y: cy + thickness });
    }
    g.moveTo(top[0].x, top[0].y);
    for (const p of top) g.lineTo(p.x, p.y);
    for (let i = bot.length - 1; i >= 0; i--) g.lineTo(bot[i].x, bot[i].y);
    g.closePath().fill({ color: 0xff5a6e }).stroke({ color: STROKE, width: 1.5 });
    for (let i = 1; i < segs; i += 2) {
      g.circle(top[i].x, (top[i].y + bot[i].y) / 2, 1.4).fill({ color: 0xffffff, alpha: 0.9 });
    }
    // Fraying streaks at the tip — deterministic with phase so no flicker
    if (intensity > 0.45) {
      const ft = (intensity - 0.45) / 0.55;
      const tip = top[top.length - 1];
      const tipB = bot[bot.length - 1];
      const mx = (tip.x + tipB.x) / 2;
      const my = (tip.y + tipB.y) / 2;
      for (let i = 0; i < 6; i++) {
        const angle = Math.PI + Math.sin(phase * 2.1 + i * 1.05) * 0.7;
        const flen = 7 + Math.abs(Math.sin(phase * 3.3 + i * 0.8)) * 14;
        g.moveTo(mx, my)
          .lineTo(mx + Math.cos(angle) * flen, my + Math.sin(angle) * flen)
          .stroke({ color: 0xff5a6e, width: 1.2, alpha: ft * 0.85 });
      }
    }
  }

  private drawWindLines(intensity: number, phase: number) {
    const g = this.windLines;
    g.clear();
    if (intensity < 0.12) return;
    const t = Math.min(1, (intensity - 0.12) / 0.55);

    // Horizontal streaks streaming leftward past the cockpit
    const lines = [
      { x: 4,  y: -38, baseLen: 26 },
      { x: 0,  y: -31, baseLen: 44 },
      { x: 5,  y: -24, baseLen: 36 },
      { x: -2, y: -17, baseLen: 22 },
      { x: 3,  y: -11, baseLen: 30 },
    ];

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const pulse = 0.5 + 0.5 * Math.sin(phase * (0.85 + i * 0.22) + i * 1.4);
      const len = (l.baseLen + t * 48) * (0.45 + 0.55 * pulse);
      const alpha = t * 0.75 * pulse;
      const width = 0.7 + t * 1.8 * pulse;
      if (alpha < 0.04) continue;
      g.moveTo(l.x, l.y)
        .lineTo(l.x - len, l.y)
        .stroke({ color: 0xffffff, width, alpha });
    }
  }

  startCrash() {
    this.crashing = true;
    this.crashSpin = this.rotation;
  }

  reset(x: number, y: number) {
    this.crashing = false;
    this.crashSpin = 0;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.rotation = 0;
    this.alpha = 1;
    this.scale.set(1);
  }
}

interface PilotRefs {
  earL: Graphics;
  earR: Graphics;
  cheeks: Graphics;
}

function makePilot(): Container & { __refs?: PilotRefs } {
  const c = new Container() as Container & { __refs?: PilotRefs };

  const earL = new Graphics();
  drawFloppyEar(earL, PILOT_FUR, PILOT_FUR_DARK);
  earL.x = -16;
  earL.y = -8;
  earL.rotation = -0.4;

  const earR = new Graphics();
  drawFloppyEar(earR, PILOT_FUR, PILOT_FUR_DARK);
  earR.x = 16;
  earR.y = -8;
  earR.rotation = 0.4;
  earR.scale.x = -1;

  c.addChild(earL, earR);

  const head = new Graphics();
  head.circle(0, 0, 22).fill({ color: PILOT_FUR }).stroke({ color: STROKE, width: 1.5 });
  head.ellipse(-7, -10, 9, 6).fill({ color: PILOT_FUR_DARK, alpha: 0.6 });
  head.ellipse(0, 9, 11, 8).fill({ color: 0xfff1d6 }).stroke({ color: STROKE, width: 1.2 });
  head.ellipse(0, 4.5, 3.2, 2.4).fill({ color: 0x2a3142 });
  head.moveTo(0, 8).quadraticCurveTo(2, 13, 5, 13).stroke({ color: STROKE, width: 1.2 });
  head.ellipse(7, 14, 4.5, 3).fill({ color: 0xff8aa6 }).stroke({ color: STROKE, width: 1 });
  head.moveTo(7, 12).lineTo(7, 16).stroke({ color: 0xc94a6b, width: 0.8 });
  c.addChild(head);

  // Dynamic per-frame overlay for cheeks and effort marks
  const cheeks = new Graphics();
  c.addChild(cheeks);

  const goggles = new Graphics();
  goggles.rect(-22, -6, 44, 5).fill({ color: 0x3a2a18 });
  const lens = (cx: number) => {
    goggles.circle(cx, -3, 7.5).fill({ color: 0x2a3142 }).stroke({ color: 0x9a6a3c, width: 2 });
    goggles.circle(cx - 2.5, -5, 2).fill({ color: 0xffffff, alpha: 0.85 });
    goggles.circle(cx + 3, -1, 1).fill({ color: 0xffffff, alpha: 0.4 });
  };
  lens(-9);
  lens(9);
  c.addChild(goggles);

  const knot = new Graphics();
  knot.ellipse(0, 20, 12, 4).fill({ color: 0xff5a6e }).stroke({ color: STROKE, width: 1.2 });
  c.addChild(knot);

  c.__refs = { earL, earR, cheeks };
  return c;
}

function pilotEarFlap(pilot: Container, phase: number, intensity: number) {
  const refs = (pilot as any).__refs as PilotRefs | undefined;
  if (!refs) return;

  // Ears blow increasingly backward as speed rises
  const blownBack = intensity * 0.9;
  const swing = (0.18 + intensity * 0.3) * Math.sin(phase);

  refs.earL.rotation = -0.4 - blownBack + swing;
  refs.earR.rotation = 0.4 + blownBack - swing;

  // Ears stretch out in the wind
  const stretch = 1 + intensity * 0.4;
  refs.earL.scale.y = stretch;
  refs.earR.scale.y = stretch;
}

function pilotCheeks(pilot: Container, intensity: number) {
  const refs = (pilot as any).__refs as PilotRefs | undefined;
  if (!refs) return;
  const g = refs.cheeks;
  g.clear();
  if (intensity < 0.06) return;

  const t = Math.min(1, (intensity - 0.06) / 0.94);
  const r = 3.5 + t * 9;
  const alpha = 0.3 + t * 0.5;

  // Puffy wind-pressed cheeks
  g.ellipse(-13, 7, r, r * 0.8).fill({ color: 0xff9aaa, alpha });
  g.ellipse(13, 7, r, r * 0.8).fill({ color: 0xff9aaa, alpha });

  // Sparkle dots on cheeks at medium+ speed
  if (t > 0.35) {
    const bt = (t - 0.35) / 0.65;
    g.circle(-16, 5, 1).fill({ color: 0xffffff, alpha: bt * 0.7 });
    g.circle(-10, 4, 0.7).fill({ color: 0xffffff, alpha: bt * 0.5 });
    g.circle(16, 5, 1).fill({ color: 0xffffff, alpha: bt * 0.7 });
    g.circle(10, 4, 0.7).fill({ color: 0xffffff, alpha: bt * 0.5 });
  }

  // Effort / strain marks near the brow at high speed
  if (t > 0.6) {
    const st = (t - 0.6) / 0.4;
    g.moveTo(-5, -13).lineTo(-9, -17).stroke({ color: STROKE, width: 1, alpha: st * 0.55 });
    g.moveTo(-3, -15).lineTo(-4, -19).stroke({ color: STROKE, width: 0.8, alpha: st * 0.4 });
    g.moveTo(5, -13).lineTo(9, -17).stroke({ color: STROKE, width: 1, alpha: st * 0.55 });
    g.moveTo(3, -15).lineTo(4, -19).stroke({ color: STROKE, width: 0.8, alpha: st * 0.4 });
  }
}

function drawFloppyEar(g: Graphics, fur: number, furDark: number) {
  g.clear();
  g.ellipse(0, 14, 8, 16).fill({ color: fur }).stroke({ color: STROKE, width: 1.2 });
  g.ellipse(2, 18, 3.5, 9).fill({ color: furDark, alpha: 0.55 });
}

// A round porthole window with a puppy face peeking out.
function makePorthole(furColor: number, spotColor: number): Container {
  const c = new Container();
  const frame = new Graphics();
  frame.circle(0, 0, 11).fill({ color: 0xb6e3ff }).stroke({ color: STROKE, width: 2 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    frame.circle(Math.cos(a) * 13, Math.sin(a) * 13, 0.9).fill({ color: STROKE, alpha: 0.7 });
  }
  c.addChild(frame);

  const head = new Graphics();
  head.ellipse(-7, -4, 3.2, 6).fill({ color: furColor }).stroke({ color: STROKE, width: 1 });
  head.ellipse(7, -4, 3.2, 6).fill({ color: furColor }).stroke({ color: STROKE, width: 1 });
  head.circle(0, 1, 8).fill({ color: furColor }).stroke({ color: STROKE, width: 1.2 });
  head.ellipse(-4, -2, 3, 3.5).fill({ color: spotColor, alpha: 0.85 });
  head.ellipse(0, 4, 4, 3).fill({ color: 0xfff1d6 });
  head.circle(-2.8, 0, 1.2).fill({ color: 0x2a3142 });
  head.circle(2.8, 0, 1.2).fill({ color: 0x2a3142 });
  head.circle(-2.5, -0.3, 0.4).fill({ color: 0xffffff });
  head.circle(3.1, -0.3, 0.4).fill({ color: 0xffffff });
  head.ellipse(0, 3, 1.4, 1).fill({ color: 0x2a3142 });
  c.addChild(head);

  const shine = new Graphics();
  shine.ellipse(-4, -7, 3, 1.4).fill({ color: 0xffffff, alpha: 0.7 });
  c.addChild(shine);

  return c;
}
