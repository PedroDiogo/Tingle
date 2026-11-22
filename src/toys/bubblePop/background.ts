import { Container, Graphics } from "pixi.js";
import { makePaperCloud, paintPaperSky } from "../../paperScene";

interface Cloud {
  g: Graphics;
  vx: number;
}

export class Background extends Container {
  private sky = new Graphics();
  private cloudLayer = new Container();
  private hillLayer = new Container();
  private clouds: Cloud[] = [];
  private w = 0;
  private h = 0;

  constructor(private readonly palette: readonly [number, number, number] = [0xa9e6ec, 0xdaf2e4, 0xffebbf]) {
    super();
    this.addChild(this.sky, this.cloudLayer, this.hillLayer);
  }

  resize(w: number, h: number) {
    if (this.w === w && this.h === h) return;
    this.w = w;
    this.h = h;
    // Drop cache before redrawing; re-enable after so the new geometry is cached.
    this.sky.cacheAsTexture(false);
    this.hillLayer.cacheAsTexture(false);
    this.drawSky();
    this.drawHills();
    this.rebuildClouds();
    this.sky.cacheAsTexture(true);
    this.hillLayer.cacheAsTexture(true);
  }

  private drawSky() {
    paintPaperSky(this.sky, this.w, this.h, this.palette, 0.77);
  }

  private drawHills() {
    for (const child of this.hillLayer.removeChildren()) child.destroy();
    const w = this.w;
    const h = this.h;
    const back = new Graphics()
      .moveTo(0, h * 0.87)
      .bezierCurveTo(w * 0.3, h * 0.70, w * 0.42, h * 0.92, w * 0.65, h * 0.83)
      .quadraticCurveTo(w * 0.84, h * 0.75, w, h * 0.82)
      .lineTo(w, h).lineTo(0, h).closePath().fill(0x91d6b1).stroke({ color: 0x4d3154, width: 2, alpha: 0.5 });
    const front = new Graphics()
      .moveTo(0, h * 0.91)
      .bezierCurveTo(w * 0.26, h * 0.83, w * 0.42, h * 0.99, w * 0.73, h * 0.91)
      .quadraticCurveTo(w * 0.87, h * 0.88, w, h * 0.93)
      .lineTo(w, h).lineTo(0, h).closePath().fill(0x68ba9d).stroke({ color: 0x4d3154, width: 2, alpha: 0.5 });

    for (let i = 0; i < 20; i++) {
      const x = (i + 0.5) * w / 20;
      const y = h * (0.956 + (i % 3) * 0.009);
      front.moveTo(x - 2, y).quadraticCurveTo(x, y - 5, x + 2, y - 7);
    }
    front.stroke({ color: 0x427f70, alpha: 0.5, width: 1.2 });

    this.hillLayer.addChild(back, front);
  }

  private rebuildClouds() {
    for (const child of this.cloudLayer.removeChildren()) child.destroy();
    this.clouds = [];
    const n = 4;
    for (let i = 0; i < n; i++) {
      const g = makePaperCloud();
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

  update(dt: number) {
    for (const c of this.clouds) {
      c.g.x += c.vx * dt;
      const margin = 140;
      if (c.g.x > this.w + margin) c.g.x = -margin;
    }
  }
}
