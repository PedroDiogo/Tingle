import { Container, Graphics, Text } from "pixi.js";

// Pastel tints cycled across the 7 white notes (C D E F G A B)
const WHITE_TINTS = [
  0xfff4fb, // C pink tint
  0xfff9e8, // D yellow tint
  0xf1fbe8, // E green tint
  0xe8f6ff, // F sky tint
  0xf3eaff, // G lavender tint
  0xffeee0, // A peach tint
  0xffe8ee, // B rose tint
];

const HINT_COLOR = 0xffe066;

export class Key extends Container {
  readonly midi: number;
  readonly isBlack: boolean;
  keyWidth: number;
  keyHeight: number;
  private body: Graphics;
  private glow: Graphics;
  private labelText: Text;
  private pressT = 0;
  private hintT = 0;
  private _hint = false;
  onPress?: (k: Key) => void;

  constructor(midi: number, isBlack: boolean, w: number, h: number) {
    super();
    this.midi = midi;
    this.isBlack = isBlack;
    this.keyWidth = w;
    this.keyHeight = h;

    this.glow = new Graphics();
    this.body = new Graphics();
    this.labelText = new Text({
      text: this.noteName(),
      style: {
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: Math.max(10, Math.min(16, w * 0.28)),
        fill: isBlack ? 0xffffff : 0x6b7a8f,
        fontWeight: "600",
      },
    });
    this.labelText.anchor.set(0.5, 1);

    this.addChild(this.glow, this.body, this.labelText);
    this.redraw();

    this.eventMode = "static";
    this.cursor = "pointer";
    this.on("pointerdown", (e) => {
      e.stopPropagation();
      this.onPress?.(this);
    });
  }

  private noteName(): string {
    const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const octave = Math.floor(this.midi / 12) - 1;
    return names[this.midi % 12] + octave;
  }

  resize(w: number, h: number) {
    this.keyWidth = w;
    this.keyHeight = h;
    this.redraw();
  }

  private redraw() {
    const w = this.keyWidth;
    const h = this.keyHeight;
    const r = Math.min(12, w * 0.25);

    this.body.clear();
    if (this.isBlack) {
      this.body
        .roundRect(0, 0, w, h, r)
        .fill({ color: 0x2a3142 })
        .roundRect(2, 2, w - 4, h * 0.35, r * 0.8)
        .fill({ color: 0x3a4358, alpha: 0.8 });
    } else {
      const tint = WHITE_TINTS[this.whiteIndex()];
      this.body
        .roundRect(0, 0, w, h, r)
        .fill({ color: 0xffffff })
        .roundRect(0, h * 0.6, w, h * 0.4, r)
        .fill({ color: tint });
      // side shading
      this.body
        .roundRect(0, 0, w, h, r)
        .stroke({ color: 0xd7deeb, width: 1.5 });
    }

    this.labelText.x = w / 2;
    this.labelText.y = h - 8;
    this.labelText.visible = !this.isBlack;

    this.glow.clear();
  }

  private whiteIndex(): number {
    const map: Record<number, number> = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };
    return map[this.midi % 12] ?? 0;
  }

  setHint(on: boolean) {
    this._hint = on;
    if (!on) this.hintT = 0;
  }

  press() {
    this.pressT = 1;
  }

  update(dt: number) {
    if (this.pressT > 0) {
      this.pressT = Math.max(0, this.pressT - dt * 4);
    }
    if (this._hint) {
      this.hintT += dt;
    }

    // squash on press
    const squash = 1 - this.pressT * 0.06;
    this.scale.y = squash;
    this.scale.x = 1 + this.pressT * 0.02;

    // glow for hint or press
    this.glow.clear();
    if (this._hint || this.pressT > 0.01) {
      const pulse = this._hint ? (0.55 + 0.45 * Math.sin(this.hintT * 4)) : this.pressT;
      const w = this.keyWidth;
      const h = this.keyHeight;
      const pad = 10 + pulse * 8;
      const color = this._hint ? HINT_COLOR : (this.isBlack ? 0xffffff : 0xffd166);
      this.glow
        .roundRect(-pad, -pad, w + pad * 2, h + pad * 2, 16)
        .fill({ color, alpha: 0.18 + pulse * 0.35 });
    }
  }
}
