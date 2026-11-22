import { Container, Graphics } from "pixi.js";
import { makePaperCloud, paintPaperSky } from "../../paperScene";

interface DriftCloud {
  g: Graphics;
  vx: number;
}

export class Background extends Container {
  private sky = new Graphics();
  private cloudLayer = new Container();
  private clouds: DriftCloud[] = [];
  private w = 0;
  private h = 0;

  constructor() {
    super();
    this.addChild(this.sky, this.cloudLayer);
  }

  resize(w: number, h: number) {
    if (this.w === w && this.h === h) return;
    this.w = w;
    this.h = h;
    this.sky.cacheAsTexture(false);
    this.drawSky();
    this.rebuildClouds();
    this.sky.cacheAsTexture(true);
  }

  private drawSky() {
    paintPaperSky(this.sky, this.w, this.h, [0xaee3f6, 0xbab9f1, 0xfbd2cd], 0.23);
  }

  private rebuildClouds() {
    for (const child of this.cloudLayer.removeChildren()) child.destroy();
    this.clouds = [];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const g = makePaperCloud();
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

  isInCloud(x: number, y: number) {
    return this.clouds.some(({ g }) =>
      Math.hypot((g.x - x) / 65, (g.y - y) / 37) < g.scale.x
    );
  }

  update(dt: number, worldSpeed = 200) {
    const speedFactor = worldSpeed / 200;
    for (const c of this.clouds) {
      c.g.x += c.vx * speedFactor * dt;
      const margin = 200;
      if (c.g.x < -margin) {
        c.g.x = this.w + margin;
        c.g.y = this.h * (0.05 + Math.random() * 0.55);
      }
    }
  }
}
