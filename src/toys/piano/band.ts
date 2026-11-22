import { Container, Graphics, Text } from "pixi.js";
import { COMIC_INK, COMIC_PALETTE, drawStar } from "../../comic";
import { makeCritter } from "../../critter";

export function makeBand(onTap: (note: number) => void) {
  const stage = new Container();
  const riser = new Graphics();
  const sign = new Text({
    text: "THE TINGLE BAND",
    style: { fontFamily: "Trebuchet MS", fontWeight: "900", fontStyle: "italic", fontSize: 14, fill: COMIC_INK },
  });
  sign.anchor.set(0.5);
  sign.position.set(0, 49);
  riser.ellipse(0, 36, 145, 29).fill(0xc88dc6).stroke({ color: COMIC_INK, width: 3 })
    .ellipse(0, 26, 145, 21).fill(0xffd969).stroke({ color: COMIC_INK, width: 3 });
  drawStar(riser, -140, -34, 15, 0xffdb72);
  drawStar(riser, 147, -40, 11, 0xf296ad);
  drawStar(riser, 118, -64, 10, 0x86d6be);
  stage.addChild(riser, sign);

  const players = (["cat", "bunny", "bear"] as const).map((style, index) => {
    const player = makeCritter(COMIC_PALETTE[[0, 2, 3][index]], style);
    player.critter.x = (index - 1) * 89;
    player.critter.eventMode = "static";
    player.critter.cursor = "pointer";
    player.critter.on("pointerdown", () => onTap(index));
    stage.addChild(player.critter);
    return { ...player, bounce: 0 };
  });

  return {
    stage,
    play(note: number) {
      const player = players[note % players.length];
      player.bounce = 1;
      player.expression(true);
    },
    update(dt: number) {
      for (const player of players) {
        if (!player.bounce) continue;
        player.bounce = Math.max(0, player.bounce - dt * 2.8);
        const wave = Math.sin(player.bounce * Math.PI);
        player.critter.y = -wave * 24;
        player.critter.rotation = wave * 0.14;
        if (!player.bounce) player.expression(false);
      }
    },
  };
}
