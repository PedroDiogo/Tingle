import { Container, Graphics, Text } from "pixi.js";

export interface ChipOptions {
  label: string;
  emoji?: string;
  active?: boolean;
  tone?: "neutral" | "primary" | "happy";
  paddingX?: number;
  height?: number;
  onTap?: () => void;
}

export class Chip extends Container {
  private bg: Graphics;
  private txt: Text;
  private opts: ChipOptions;
  private _w = 0;
  private _h = 0;
  private pressT = 0;

  constructor(opts: ChipOptions) {
    super();
    this.opts = opts;
    this.bg = new Graphics();
    this.txt = new Text({
      text: (opts.emoji ? `${opts.emoji} ` : "") + opts.label,
      style: {
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 15,
        fontWeight: "600",
        fill: 0xffffff,
      },
    });
    this.txt.anchor.set(0.5);
    this.addChild(this.bg, this.txt);
    this.eventMode = "static";
    this.cursor = "pointer";
    this.on("pointerdown", (e) => {
      e.stopPropagation();
      this.pressT = 1;
      opts.onTap?.();
    });
    this.redraw();
  }

  setActive(active: boolean) {
    if (this.opts.active === active) return;
    this.opts.active = active;
    this.redraw();
  }

  setOnTap(fn: () => void) {
    this.opts.onTap = fn;
  }

  setLabel(label: string, emoji?: string) {
    this.opts.label = label;
    if (emoji !== undefined) this.opts.emoji = emoji;
    this.txt.text = (this.opts.emoji ? `${this.opts.emoji} ` : "") + label;
    this.redraw();
  }

  get width2() {
    return this._w;
  }

  get height2() {
    return this._h;
  }

  private redraw() {
    const padX = this.opts.paddingX ?? 14;
    const h = this.opts.height ?? 34;
    this._w = this.txt.width + padX * 2;
    this._h = h;

    const radius = this._h / 2;
    this.bg.clear();

    let textColor: number;
    if (this.opts.active) {
      this.bg
        .roundRect(0, 0, this._w, this._h, radius)
        .fill({ color: 0xffffff, alpha: 0.18 });
      textColor = 0xffffff;
    } else {
      textColor = 0xffffff;
    }

    this.txt.x = this._w / 2;
    this.txt.y = this._h / 2;
    this.txt.style.fill = textColor;
    this.txt.alpha = this.opts.active ? 1 : 0.75;
  }

  update(dt: number) {
    if (this.pressT > 0) {
      this.pressT = Math.max(0, this.pressT - dt * 5);
    }
    this.scale.set(1 - this.pressT * 0.06);
  }
}

export function makeFloatingNotes(count: number, width: number, height: number): {
  layer: Container;
  update: (dt: number) => void;
  resize: (w: number, h: number) => void;
} {
  const layer = new Container();
  const glyphs = ["🎵", "🎶", "♪", "♫", "⭐", "✨"];
  interface FN {
    t: Text;
    vy: number;
    vx: number;
    baseSize: number;
    phase: number;
  }
  const items: FN[] = [];
  let w = width;
  let h = height;

  function spawn(initial: boolean) {
    const size = 22 + Math.random() * 26;
    const tints = [0xff6b9d, 0xffb347, 0x8ee36b, 0x6bc7ff, 0xc490ff, 0xff9a6b, 0xffffff];
    const t = new Text({
      text: glyphs[(Math.random() * glyphs.length) | 0],
      style: { fontSize: size, fill: tints[(Math.random() * tints.length) | 0] },
    });
    t.alpha = 0.35 + Math.random() * 0.25;
    t.x = Math.random() * w;
    t.y = initial ? Math.random() * h : h + 40;
    layer.addChild(t);
    items.push({
      t,
      vy: -(10 + Math.random() * 22),
      vx: (Math.random() - 0.5) * 12,
      baseSize: size,
      phase: Math.random() * Math.PI * 2,
    });
  }
  for (let i = 0; i < count; i++) spawn(true);

  return {
    layer,
    update(dt: number) {
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.phase += dt;
        it.t.x += (it.vx + Math.sin(it.phase) * 6) * dt;
        it.t.y += it.vy * dt;
        it.t.rotation = Math.sin(it.phase * 0.7) * 0.15;
        if (it.t.y < -60) {
          it.t.destroy();
          items.splice(i, 1);
          spawn(false);
        }
      }
    },
    resize(nw: number, nh: number) {
      w = nw;
      h = nh;
    },
  };
}
