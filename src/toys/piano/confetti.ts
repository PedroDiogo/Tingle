import { Container, Graphics } from "pixi.js";

interface Particle {
  g: Graphics;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  life: number;
  max: number;
}

const CONFETTI_COLORS = [0xff6b9d, 0xffd166, 0x8ee36b, 0x6bc7ff, 0xc490ff, 0xff9a6b];

export class ConfettiLayer extends Container {
  private particles: Particle[] = [];

  burst(x: number, y: number, count = 10, spread = Math.PI * 2, up = false) {
    for (let i = 0; i < count; i++) {
      const angle = up
        ? -Math.PI / 2 + (Math.random() - 0.5) * spread
        : (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 140 + Math.random() * 220;
      const g = new Graphics();
      const color = CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0];
      const shape = Math.random();
      if (shape < 0.5) {
        g.rect(-4, -2, 8, 4).fill({ color });
      } else {
        g.circle(0, 0, 3 + Math.random() * 3).fill({ color });
      }
      g.x = x;
      g.y = y;
      this.addChild(g);
      this.particles.push({
        g,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 10,
        life: 0,
        max: 0.6 + Math.random() * 0.5,
      });
    }
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.g.x += p.vx * dt;
      p.g.y += p.vy * dt;
      p.vy += 500 * dt;
      p.rot += p.vr * dt;
      p.g.rotation = p.rot;
      p.g.alpha = Math.max(0, 1 - p.life / p.max);
      if (p.life >= p.max) {
        p.g.destroy();
        this.particles.splice(i, 1);
      }
    }
  }
}
