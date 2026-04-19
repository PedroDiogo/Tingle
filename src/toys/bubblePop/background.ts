import { Container, Graphics, FillGradient } from "pixi.js";

interface Cloud {
  g: Graphics;
  vx: number;
}

interface Sparkle {
  g: Graphics;
  phase: number;
  speed: number;
  baseAlpha: number;
}

export class Background extends Container {
  private sky = new Graphics();
  private cloudLayer = new Container();
  private sparkleLayer = new Container();
  private hillLayer = new Container();
  private clouds: Cloud[] = [];
  private sparkles: Sparkle[] = [];
  private w = 0;
  private h = 0;

  constructor() {
    super();
    this.addChild(this.sky, this.sparkleLayer, this.cloudLayer, this.hillLayer);
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    // Drop cache before redrawing; re-enable after so the new geometry is cached.
    this.sky.cacheAsTexture(false);
    this.hillLayer.cacheAsTexture(false);
    this.drawSky();
    this.drawHills();
    this.rebuildClouds();
    this.rebuildSparkles();
    this.sky.cacheAsTexture(true);
    this.hillLayer.cacheAsTexture(true);
  }

  private drawSky() {
    const g = this.sky;
    g.clear();
    const grad = new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 0, y: this.h },
      colorStops: [
        { offset: 0, color: 0xffd3e0 },
        { offset: 0.45, color: 0xffe7c7 },
        { offset: 0.8, color: 0xcfeaff },
        { offset: 1, color: 0xd9f5e1 }
      ],
      textureSpace: "global"
    });
    g.rect(0, 0, this.w, this.h).fill(grad);

    const cx = this.w * 0.8;
    const cy = this.h * 0.22;
    for (let i = 6; i >= 1; i--) {
      g.circle(cx, cy, 40 + i * 35).fill({ color: 0xfff4b8, alpha: 0.07 });
    }
    g.circle(cx, cy, 42).fill({ color: 0xfff1a8, alpha: 0.9 });
  }

  private drawHills() {
    this.hillLayer.removeChildren();
    const back = new Graphics();
    back.moveTo(0, this.h);
    back.lineTo(0, this.h * 0.78);
    for (let x = 0; x <= this.w; x += 40) {
      const y = this.h * 0.78 + Math.sin(x * 0.012) * 22 + Math.sin(x * 0.04) * 6;
      back.lineTo(x, y);
    }
    back.lineTo(this.w, this.h);
    back.closePath().fill({ color: 0xb6d8c0, alpha: 0.85 });

    const front = new Graphics();
    front.moveTo(0, this.h);
    front.lineTo(0, this.h * 0.88);
    for (let x = 0; x <= this.w; x += 30) {
      const y = this.h * 0.88 + Math.sin(x * 0.018 + 1.4) * 18 + Math.sin(x * 0.06) * 4;
      front.lineTo(x, y);
    }
    front.lineTo(this.w, this.h);
    front.closePath().fill({ color: 0x8fc7a4 });

    this.hillLayer.addChild(back, front);
  }

  private rebuildClouds() {
    this.cloudLayer.removeChildren();
    this.clouds = [];
    const n = 4;
    for (let i = 0; i < n; i++) {
      const g = makeCloud();
      const scale = 0.5 + Math.random() * 0.7;
      g.scale.set(scale);
      g.x = Math.random() * this.w;
      g.y = this.h * (0.1 + Math.random() * 0.4);
      g.alpha = 0.8 + Math.random() * 0.15;
      g.cacheAsTexture(true);
      this.cloudLayer.addChild(g);
      this.clouds.push({ g, vx: 6 + Math.random() * 10 });
    }
  }

  private rebuildSparkles() {
    this.sparkleLayer.removeChildren();
    this.sparkles = [];
    const n = 14;
    for (let i = 0; i < n; i++) {
      const g = new Graphics();
      const r = 2 + Math.random() * 3;
      g.circle(0, 0, r).fill({ color: 0xffffff, alpha: 1 });
      g.x = Math.random() * this.w;
      g.y = Math.random() * this.h * 0.7;
      this.sparkleLayer.addChild(g);
      this.sparkles.push({
        g,
        phase: Math.random() * Math.PI * 2,
        speed: 1 + Math.random() * 2,
        baseAlpha: 0.3 + Math.random() * 0.4
      });
    }
  }

  update(dt: number) {
    for (const c of this.clouds) {
      c.g.x += c.vx * dt;
      const margin = 140;
      if (c.g.x > this.w + margin) c.g.x = -margin;
    }
    for (const sp of this.sparkles) {
      sp.phase += sp.speed * dt;
      sp.g.alpha = sp.baseAlpha * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(sp.phase)));
    }
  }
}

function makeCloud(): Graphics {
  const g = new Graphics();
  const puffs: [number, number, number][] = [
    [0, 0, 55],
    [-45, 10, 42],
    [45, 10, 42],
    [-22, -18, 38],
    [25, -14, 40],
    [-70, 20, 30],
    [70, 20, 30]
  ];
  for (const [x, y, r] of puffs) {
    g.circle(x, y, r).fill({ color: 0xffffff, alpha: 0.95 });
  }
  return g;
}
