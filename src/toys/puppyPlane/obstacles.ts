import { Container, Graphics } from "pixi.js";

const STROKE = 0x3a2a18;
const BALLOON_COLORS = [0xff6b9d, 0xffd166, 0x8ee36b, 0x6bc7ff, 0xc490ff, 0xff9a6b];

export interface CollisionCircle {
  dx: number;
  dy: number;
  r: number;
}

export interface Obstacle {
  container: Container;
  x: number;
  y: number;
  speedMul: number;
  circles: CollisionCircle[];
  alive: boolean;
  update(dt: number, worldSpeed: number): void;
}

export class Spawner {
  obstacles: Obstacle[] = [];
  layer: Container;
  width = 0;
  height = 0;
  timeSinceSpawn = 0;
  worldTime = 0;
  paused = false;

  constructor(layer: Container) {
    this.layer = layer;
  }

  resize(w: number, h: number) {
    this.width = w;
    this.height = h;
  }

  reset() {
    for (const o of this.obstacles) o.container.destroy();
    this.obstacles = [];
    this.timeSinceSpawn = 0;
    this.worldTime = 0;
    this.paused = false;
  }

  worldSpeed(): number {
    return 200 + Math.min(600, this.worldTime * 12);
  }

  update(dt: number) {
    if (!this.paused) {
      this.worldTime += dt;
      this.timeSinceSpawn += dt;
      const interval = Math.max(0.4, 1.5 - this.worldTime * 0.022);
      if (this.timeSinceSpawn >= interval) {
        this.timeSinceSpawn = 0;
        this.spawnRandom();
      }
    }

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.update(dt, this.worldSpeed());
      let maxR = 0;
      for (const c of o.circles) maxR = Math.max(maxR, c.r + Math.abs(c.dx));
      if (o.x + maxR + 80 < 0) {
        o.container.destroy();
        this.obstacles.splice(i, 1);
      }
    }
  }

  private add(o: Obstacle) {
    this.obstacles.push(o);
    this.layer.addChild(o.container);
  }

  spawnRandom() {
    const r = Math.random();
    if (r < 0.4) this.add(makeMountain(this.width, this.height));
    else if (r < 0.75) this.add(makeBalloon(this.width, this.height));
    else {
      const baseY = this.height * (0.15 + Math.random() * 0.55);
      const count = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const b = makeBird(this.width, baseY + (Math.random() - 0.5) * 60);
        b.x += i * (70 + Math.random() * 30);
        applyXY(b);
        this.add(b);
      }
    }
  }
}

function applyXY(o: Obstacle) {
  o.container.x = o.x;
  o.container.y = o.y;
}

// ---------- Mountain ----------
function makeMountain(width: number, height: number): Obstacle {
  const c = new Container();
  const peakH = height * (0.35 + Math.random() * 0.3);
  const baseHalf = peakH * (0.55 + Math.random() * 0.25);
  const skew = (Math.random() - 0.5) * baseHalf * 0.4;

  // back ridge (lighter, slight offset)
  const back = new Graphics();
  back
    .poly([-baseHalf - 18, 0, skew - 8, -peakH * 0.92, baseHalf - 4, 0])
    .fill({ color: 0x6b8a76 })
    .stroke({ color: STROKE, width: 2 });
  // main mountain
  const front = new Graphics();
  front
    .poly([-baseHalf, 0, skew, -peakH, baseHalf, 0])
    .fill({ color: 0x8fc7a4 })
    .stroke({ color: STROKE, width: 2 });
  // snow cap
  const capBase = peakH * 0.78;
  const capLeft = skew - baseHalf * 0.18;
  const capRight = skew + baseHalf * 0.18;
  front
    .poly([
      capLeft, -capBase,
      skew - 4, -capBase + 6, skew + 6, -capBase + 4, skew + 12, -capBase + 8,
      capRight, -capBase,
      skew, -peakH
    ])
    .fill({ color: 0xffffff });

  c.addChild(back, front);

  const obs: Obstacle = {
    container: c,
    x: width + baseHalf + 40,
    y: height,
    speedMul: 1.0,
    // a few stacked collision circles approximating the triangle
    circles: [
      { dx: skew * 0.2, dy: -peakH * 0.18, r: baseHalf * 0.7 },
      { dx: skew * 0.5, dy: -peakH * 0.5, r: baseHalf * 0.4 },
      { dx: skew * 0.8, dy: -peakH * 0.78, r: baseHalf * 0.22 }
    ],
    alive: true,
    update(dt, worldSpeed) {
      this.x -= worldSpeed * this.speedMul * dt;
      applyXY(this);
    }
  };
  applyXY(obs);
  return obs;
}

// ---------- Hot air balloon ----------
function makeBalloon(width: number, height: number): Obstacle {
  const c = new Container();
  const balloonR = 32 + Math.random() * 10;
  const color = BALLOON_COLORS[(Math.random() * BALLOON_COLORS.length) | 0];
  const accent = BALLOON_COLORS[(Math.random() * BALLOON_COLORS.length) | 0];

  const g = new Graphics();
  // balloon body (circle pulled down a bit)
  g.ellipse(0, 0, balloonR, balloonR * 1.1)
    .fill({ color })
    .stroke({ color: STROKE, width: 2 });
  // vertical stripe accent
  g.ellipse(0, 0, balloonR * 0.35, balloonR * 1.05).fill({ color: accent, alpha: 0.85 });
  // ropes
  g.moveTo(-balloonR * 0.55, balloonR * 0.85);
  g.lineTo(-10, balloonR * 1.55);
  g.moveTo(balloonR * 0.55, balloonR * 0.85);
  g.lineTo(10, balloonR * 1.55);
  g.stroke({ color: STROKE, width: 1.5 });
  // basket
  g.roundRect(-12, balloonR * 1.5, 24, 18, 3)
    .fill({ color: 0x9a6a3c })
    .stroke({ color: STROKE, width: 2 });

  c.addChild(g);

  const baseY = height * (0.18 + Math.random() * 0.55);
  const bobAmp = 8 + Math.random() * 10;
  const bobSpeed = 0.8 + Math.random() * 0.6;
  let phase = Math.random() * Math.PI * 2;

  const obs: Obstacle = {
    container: c,
    x: width + 80,
    y: baseY,
    speedMul: 0.85,
    circles: [
      { dx: 0, dy: 0, r: balloonR * 0.95 },
      { dx: 0, dy: balloonR * 1.55, r: 14 }
    ],
    alive: true,
    update(dt, worldSpeed) {
      this.x -= worldSpeed * this.speedMul * dt;
      phase += dt * bobSpeed;
      this.y = baseY + Math.sin(phase) * bobAmp;
      applyXY(this);
    }
  };
  applyXY(obs);
  return obs;
}

// ---------- Bird ----------
function makeBird(width: number, y: number): Obstacle {
  const c = new Container();
  const g = new Graphics();
  c.addChild(g);

  const drawBird = (flap: number) => {
    g.clear();
    // body
    g.ellipse(0, 0, 11, 7).fill({ color: 0x3a2a18 });
    // wings: two arcs that flap
    const tip = -8 - flap * 6;
    g.moveTo(-2, -2);
    g.quadraticCurveTo(-12, tip, -22, -1);
    g.lineTo(-12, 2);
    g.closePath().fill({ color: 0x3a2a18 });
    g.moveTo(2, -2);
    g.quadraticCurveTo(12, tip, 22, -1);
    g.lineTo(12, 2);
    g.closePath().fill({ color: 0x3a2a18 });
    // tiny beak
    g.poly([10, 0, 16, -1, 10, 1]).fill({ color: 0xffaa3a });
  };
  drawBird(0);

  let flapPhase = Math.random() * Math.PI * 2;

  const obs: Obstacle = {
    container: c,
    x: width + 60,
    y,
    speedMul: 1.4,
    circles: [{ dx: 0, dy: 0, r: 12 }],
    alive: true,
    update(dt, worldSpeed) {
      this.x -= worldSpeed * this.speedMul * dt;
      flapPhase += dt * 14;
      drawBird(0.5 + 0.5 * Math.sin(flapPhase));
      applyXY(this);
    }
  };
  applyXY(obs);
  return obs;
}
