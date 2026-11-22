import { FillGradient, Graphics } from "pixi.js";
import { COMIC_INK } from "./comic";

export function paintPaperSky(
  graphics: Graphics,
  width: number,
  height: number,
  colors: readonly [number, number, number],
  sunX: number,
) {
  graphics.clear().rect(0, 0, width, height).fill(new FillGradient({
    start: { x: 0, y: 0 },
    end: { x: 0, y: height },
    colorStops: [
      { offset: 0, color: colors[0] },
      { offset: 0.58, color: colors[1] },
      { offset: 1, color: colors[2] },
    ],
    textureSpace: "global",
  }));

  const x = width * sunX;
  const y = height * 0.24;
  const r = Math.min(48, Math.max(22, Math.min(width, height) * 0.09));
  graphics.circle(x + 3, y + 4, r).fill({ color: 0xa3604c, alpha: 0.11 })
    .circle(x, y, r).fill(0xf8d887)
    .stroke({ color: 0xd69965, width: 2, alpha: 0.7 })
    .moveTo(x + (r - 5) * Math.cos(Math.PI * 0.95), y + (r - 5) * Math.sin(Math.PI * 0.95))
    .arc(x, y, r - 5, Math.PI * 0.95, Math.PI * 1.52)
    .stroke({ color: 0xfff4cb, width: 2, cap: "round" });

  // Position the grain deterministically so resizing never makes it shimmer.
  const spacing = Math.max(11, Math.ceil(Math.sqrt(width * height / 3400)));
  for (let y = 3; y < height; y += spacing) {
    for (let x = 3; x < width; x += spacing) {
      const offset = (Math.floor(y / spacing) % 2) * spacing / 2;
      graphics.circle(x + offset, y, 0.8);
    }
  }
  graphics.fill({ color: COMIC_INK, alpha: 0.13 });
}

export function makePaperCloud() {
  const cloud = new Graphics();
  function silhouette(offset: number) {
    cloud.moveTo(-63, 16 + offset)
      .bezierCurveTo(-86, 13 + offset, -80, -19 + offset, -54, -16 + offset)
      .bezierCurveTo(-50, -43 + offset, -12, -47 + offset, -3, -22 + offset)
      .bezierCurveTo(13, -38 + offset, 42, -29 + offset, 45, -11 + offset)
      .bezierCurveTo(80, -20 + offset, 86, 17 + offset, 60, 19 + offset)
      .bezierCurveTo(28, 24 + offset, -36, 23 + offset, -63, 16 + offset)
      .closePath();
  }
  silhouette(5);
  cloud.fill({ color: 0x74689e, alpha: 0.13 });
  silhouette(0);
  return cloud.fill(0xfff9ec)
    .stroke({ color: COMIC_INK, width: 2, alpha: 0.56 })
    .moveTo(-46, 11).quadraticCurveTo(-12, 20, 20, 15)
    .stroke({ color: 0xe8d5e1, width: 2, cap: "round" });
}
