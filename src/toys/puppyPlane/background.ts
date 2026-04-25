import { Container, Graphics, FillGradient } from "pixi.js";

interface DriftCloud {
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
  private sparkleLayer = new Container();
  private cloudLayer = new Container();
  private clouds: DriftCloud[] = [];
  private sparkles: Sparkle[] = [];
  private w = 0;
  private h = 0;

  constructor() {
    super();
    this.addChild(this.sky, this.sparkleLayer, this.cloudLayer);
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.sky.cacheAsTexture(false);
    this.drawSky();
    this.rebuildClouds();
    this.rebuildSparkles();
    this.sky.cacheAsTexture(true);
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

    const cx = this.w * 0.18;
    const cy = this.h * 0.22;
    for (let i = 6; i >= 1; i--) {
      g.circle(cx, cy, 40 + i * 35).fill({ color: 0xfff4b8, alpha: 0.07 });
    }
    g.circle(cx, cy, 42).fill({ color: 0xfff1a8, alpha: 0.9 });
  }

  private rebuildClouds() {
    this.cloudLayer.removeChildren();
    this.clouds = [];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const g = makeDriftCloud();
      const scale = 0.5 + Math.random() * 0.9;
      g.scale.set(scale);
      g.x = Math.random() * this.w;
      g.y = this.h * (0.05 + Math.random() * 0.6);
      g.alpha = 0.65 + Math.random() * 0.25;
      g.cacheAsTexture(true);
      this.cloudLayer.addChild(g);
      // farther = slower (parallax). small clouds drift slowly, big ones faster.
      this.clouds.push({ g, vx: -(20 + scale * 50 + Math.random() * 20) });
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
      const margin = 200;
      if (c.g.x < -margin) {
        c.g.x = this.w + margin;
        c.g.y = this.h * (0.05 + Math.random() * 0.55);
      }
    }
    for (const sp of this.sparkles) {
      sp.phase += sp.speed * dt;
      sp.g.alpha = sp.baseAlpha * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(sp.phase)));
    }
  }
}

function makeDriftCloud(): Graphics {
  const g = new Graphics();
  const puffs: [number, number, number][] = [
    [0, 0, 38],
    [-32, 8, 30],
    [32, 8, 30],
    [-16, -14, 26],
    [18, -10, 28]
  ];
  for (const [x, y, r] of puffs) {
    g.circle(x, y, r).fill({ color: 0xffffff, alpha: 0.9 });
  }
  return g;
}
