import { Container, Graphics } from "pixi.js";
import { COMIC_INK } from "./comic";

export function makeCritter(color: number, style: "bunny" | "bear" | "cat") {
  const critter = new Container();
  const outline = { color: COMIC_INK, width: 3, join: "round" as const };
  const art = new Graphics();
  const earY = style === "bunny" ? -37 : -28;
  const earHeight = style === "bunny" ? 23 : 13;
  for (const side of [-1, 1]) {
    const x = side * 21;
    if (style === "cat") {
      art.poly([x - 13, -20, x - 7, -51, x + 12, -29]).fill(color).stroke(outline);
    } else {
      art.ellipse(x, earY, 11, earHeight).fill(color).stroke(outline);
      art.ellipse(x, earY, 5, earHeight * 0.65).fill(0xffead5);
    }
    art.ellipse(side * 23, 29, 13, 9).fill(0xffead5).stroke(outline);
  }
  art.ellipse(0, 1, 39, 34).fill(color).stroke(outline);
  art.ellipse(0, 13, 23, 18).fill(0xffead5);
  for (const side of [-1, 1]) {
    art.ellipse(side * 13, -6, 6, 8).fill(COMIC_INK);
    art.circle(side * 13 - 1, -9, 2).fill(0xffffff);
    art.ellipse(side * 26, 3, 6, 4).fill(0xf88ba3);
  }
  const face = new Graphics();
  critter.addChild(art, face);
  function expression(happy: boolean) {
    face.clear();
    if (happy) {
      face.ellipse(0, 8, 8, 7).fill(COMIC_INK)
        .ellipse(1, 11, 4, 2).fill(0xf88ba3);
    } else {
      face.moveTo(-7, 4).quadraticCurveTo(0, 14, 7, 4).stroke({ ...outline, cap: "round" });
    }
  }
  expression(false);
  return { critter, expression };
}
