import { Container, Graphics } from "pixi.js";
import type { BubbleKind } from "./palette";

export class Bubble extends Container {
  readonly kind: BubbleKind;
  readonly radius: number;
  vx: number;
  vy: number;

  constructor(kind: BubbleKind, radius: number, x: number, y: number) {
    super();
    this.kind = kind;
    this.radius = radius;
    this.x = x;
    this.y = y;

    const speed = 30 + Math.random() * 40;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2; // mostly upward
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    const body = new Graphics();
    body.circle(0, 0, radius).fill({ color: kind.color, alpha: 0.72 });
    body.circle(0, 0, radius).stroke({ color: 0xffffff, width: 3, alpha: 0.7 });
    body
      .circle(-radius * 0.35, -radius * 0.35, radius * 0.22)
      .fill({ color: 0xffffff, alpha: 0.8 });
    body
      .circle(radius * 0.3, radius * 0.35, radius * 0.1)
      .fill({ color: 0xffffff, alpha: 0.35 });
    body.cacheAsTexture(true);
    this.addChild(body);

    this.eventMode = "static";
    this.cursor = "pointer";
    this.hitArea = {
      contains: (px: number, py: number) => {
        const r = radius + 18;
        return px * px + py * py <= r * r;
      }
    };
  }
}
