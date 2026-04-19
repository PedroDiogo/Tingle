import { Application, Container, Graphics, Text } from "pixi.js";
import type { Toy } from "../../toy";
import { playPiano, unlockAudio } from "../../audio";
import { Key } from "./keys";
import { MELODIES, type Melody } from "./melodies";
import { Chip, makeFloatingNotes } from "./ui";
import { ConfettiLayer } from "./confetti";
import { Background } from "../bubblePop/background";

const WHITE_MIDIS = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83];

// Black keys sit between white keys whose upper pitch class is in {1,3,6,8,10}.
function blackAfter(midi: number): number | null {
  const pc = (midi + 1) % 12;
  if (pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10) return midi + 1;
  return null;
}

// Minimal computer-keyboard bindings (free-play fun for desktops).
const KEY_TO_WHITE: Record<string, number> = {
  a: 60, s: 62, d: 64, f: 65, g: 67, h: 69, j: 71,
  k: 72, l: 74, ";": 76, "'": 77,
};
const KEY_TO_BLACK: Record<string, number> = {
  w: 61, e: 63, t: 66, y: 68, u: 70, o: 73, p: 75,
};

type Mode = "free" | "play";

export function createPiano(): Toy {
  const root = new Container();
  const bgLayer = new Container();
  const bg = new Background();
  bgLayer.addChild(bg);
  const floating = makeFloatingNotes(14, window.innerWidth, window.innerHeight);
  bgLayer.addChild(floating.layer);
  const keyboardBackdrop = new Graphics();
  const modeBg = new Graphics();
  const secondaryBg = new Graphics();
  const melodyBg = new Graphics();

  const uiLayer = new Container();
  const keyboardLayer = new Container();
  const whiteLayer = new Container();
  const blackLayer = new Container();
  keyboardLayer.addChild(whiteLayer, blackLayer);
  const confetti = new ConfettiLayer();

  const title = new Text({
    text: "Piano Party",
    style: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 26,
      fontWeight: "700",
      letterSpacing: 0.5,
      fill: 0xffffff,
      dropShadow: { color: 0x000000, alpha: 0.25, blur: 4, distance: 1, angle: Math.PI / 2 },
    },
  });
  title.anchor.set(0.5, 0);

  const subtitle = new Text({
    text: "Tap any key!",
    style: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 14,
      fontWeight: "500",
      fill: 0xffffff,
      dropShadow: { color: 0x000000, alpha: 0.2, blur: 3, distance: 1, angle: Math.PI / 2 },
    },
  });
  subtitle.alpha = 0.8;
  subtitle.anchor.set(0.5, 0);

  root.addChild(
    bgLayer,
    keyboardBackdrop,
    keyboardLayer,
    modeBg,
    secondaryBg,
    melodyBg,
    uiLayer,
    confetti,
  );
  uiLayer.addChild(title, subtitle);

  // Mode chips
  const freeChip = new Chip({ label: "Free Play", emoji: "🎹", tone: "primary", active: true });
  const playChip = new Chip({ label: "Play-Along", emoji: "🎵", tone: "primary", active: false });
  const listenChip = new Chip({ label: "Listen", emoji: "👂", tone: "happy" });
  const restartChip = new Chip({ label: "Restart", emoji: "🔄", tone: "happy" });
  uiLayer.addChild(freeChip, playChip, listenChip, restartChip);

  // Melody chips
  const melodyChips: Chip[] = MELODIES.map((m, i) =>
    new Chip({
      label: m.name,
      emoji: m.emoji,
      tone: "neutral",
      active: i === 0,
      onTap: () => selectMelody(m),
    }),
  );
  for (const c of melodyChips) uiLayer.addChild(c);

  // State
  let mode: Mode = "free";
  let selectedMelody: Melody = MELODIES[0];
  let melodyIndex = 0;
  let listenTimers: number[] = [];
  let celebrateT = 0;
  const chipsByMelody = new Map<string, Chip>();
  melodyChips.forEach((c, i) => chipsByMelody.set(MELODIES[i].id, c));

  freeChip.setOnTap(() => setMode("free"));
  playChip.setOnTap(() => setMode("play"));
  listenChip.setOnTap(() => listen());
  restartChip.setOnTap(() => restart());

  // Keys
  const keys: Key[] = [];
  const whiteKeys: Key[] = [];
  const blackKeys: Key[] = [];

  // Build keys up-front with placeholder sizes; layout() will resize them.
  for (const midi of WHITE_MIDIS) {
    const k = new Key(midi, false, 60, 260);
    k.onPress = onKeyPress;
    whiteKeys.push(k);
    keys.push(k);
    whiteLayer.addChild(k);
    const b = blackAfter(midi);
    if (b !== null && b <= 83) {
      const bk = new Key(b, true, 40, 160);
      bk.onPress = onKeyPress;
      blackKeys.push(bk);
      keys.push(bk);
      blackLayer.addChild(bk);
    }
  }

  let app: Application | null = null;
  let tickerFn: ((t: any) => void) | null = null;
  let resizeFn: (() => void) | null = null;
  let keyDownFn: ((e: KeyboardEvent) => void) | null = null;

  function width() {
    return app!.screen.width;
  }
  function height() {
    return app!.screen.height;
  }

  function layout() {
    const w = width();
    const h = height();
    bg.resize(w, h);
    floating.resize(w, h);

    // Title
    title.x = w / 2;
    title.y = 12;
    subtitle.x = w / 2;
    subtitle.y = 46;

    // Layout helpers for "glass pill" groups (matches the bottom toy picker)
    const GROUP_PAD = 6;
    const CHIP_GAP = 6;
    const CHIP_H = 34;

    function drawGroupBg(g: Graphics, x: number, y: number, gw: number, gh: number) {
      const r = gh / 2;
      g.clear();
      g.roundRect(x, y, gw, gh, r).fill({ color: 0x0a101c, alpha: 0.55 });
      g.roundRect(x, y, gw, gh, r).stroke({ color: 0xffffff, width: 1, alpha: 0.12 });
    }

    function layoutRow(chips: Chip[], y: number, bgGfx: Graphics | null): number {
      let rowW = 0;
      for (const c of chips) rowW += c.width2;
      rowW += CHIP_GAP * (chips.length - 1);
      const groupW = rowW + GROUP_PAD * 2;
      const groupH = CHIP_H + GROUP_PAD * 2;
      const groupX = (w - groupW) / 2;
      if (bgGfx) drawGroupBg(bgGfx, groupX, y, groupW, groupH);
      let x = groupX + GROUP_PAD;
      for (const c of chips) {
        c.x = x;
        c.y = y + GROUP_PAD;
        x += c.width2 + CHIP_GAP;
      }
      return y + groupH;
    }

    // Mode row
    const modeY = 74;
    let cursorY = layoutRow([freeChip, playChip], modeY, modeBg);

    // Secondary row (listen/restart) — play mode only
    const showSecondary = mode === "play";
    listenChip.visible = showSecondary;
    restartChip.visible = showSecondary;
    if (showSecondary) {
      cursorY += 8;
      cursorY = layoutRow([listenChip, restartChip], cursorY, secondaryBg);
    } else {
      secondaryBg.clear();
    }

    // Melody chips: balanced grid inside a single pill
    let melodyBottom = cursorY;
    if (mode === "play") {
      const maxRowW = Math.min(w - 40, 900) - GROUP_PAD * 2;
      // How many chips fit on a single row?
      let fit = 0;
      let accW = 0;
      for (let i = 0; i < melodyChips.length; i++) {
        const cw = melodyChips[i].width2 + (i > 0 ? CHIP_GAP : 0);
        if (accW + cw > maxRowW) break;
        accW += cw;
        fit++;
      }
      fit = Math.max(1, fit);
      // Balance: pick `cols` so the number of rows is minimised but chips split evenly.
      const n = melodyChips.length;
      const nRows = Math.max(1, Math.ceil(n / fit));
      const cols = Math.ceil(n / nRows);
      const rows: { chips: Chip[]; width: number }[] = [];
      for (let i = 0; i < n; i += cols) {
        const chunk = melodyChips.slice(i, i + cols);
        let rw = 0;
        for (let j = 0; j < chunk.length; j++) rw += chunk[j].width2 + (j > 0 ? CHIP_GAP : 0);
        rows.push({ chips: chunk, width: rw });
      }

      const groupInnerW = Math.max(...rows.map((r) => r.width));
      const groupW = groupInnerW + GROUP_PAD * 2;
      const rowH = CHIP_H + CHIP_GAP;
      const groupH = rows.length * CHIP_H + (rows.length - 1) * CHIP_GAP + GROUP_PAD * 2;
      const groupX = (w - groupW) / 2;
      const groupY = cursorY + 8;
      drawGroupBg(melodyBg, groupX, groupY, groupW, groupH);

      let yCur = groupY + GROUP_PAD;
      for (const row of rows) {
        let rx = (w - row.width) / 2;
        for (const c of row.chips) {
          c.x = rx;
          c.y = yCur;
          c.visible = true;
          rx += c.width2 + CHIP_GAP;
        }
        yCur += rowH;
      }
      melodyBottom = groupY + groupH;
    } else {
      melodyBg.clear();
      for (const c of melodyChips) c.visible = false;
    }

    // Keyboard
    const topReserve = melodyBottom + 16;
    const keyboardMaxH = Math.max(180, h - topReserve - 24);
    const whiteCount = WHITE_MIDIS.length;
    const whiteW = Math.max(44, Math.min(90, (w - 32) / whiteCount));
    const keyboardW = whiteW * whiteCount;
    const keyboardH = Math.min(keyboardMaxH, whiteW * 4.2);
    const kx = (w - keyboardW) / 2;
    const ky = h - keyboardH - 18;
    keyboardLayer.x = kx;
    keyboardLayer.y = ky;

    // Soft translucent panel behind the keyboard for contrast on the bright sky
    const pad = 14;
    keyboardBackdrop.clear();
    keyboardBackdrop
      .roundRect(kx - pad, ky - pad, keyboardW + pad * 2, keyboardH + pad * 2, 24)
      .fill({ color: 0x1a2238, alpha: 0.18 });

    for (let i = 0; i < whiteKeys.length; i++) {
      const k = whiteKeys[i];
      k.resize(whiteW - 4, keyboardH);
      k.x = i * whiteW + 2;
      k.y = 0;
    }
    const blackW = whiteW * 0.62;
    const blackH = keyboardH * 0.62;
    let bi = 0;
    for (let i = 0; i < whiteKeys.length - 1; i++) {
      const midi = whiteKeys[i].midi;
      const b = blackAfter(midi);
      if (b === null || b > 83) continue;
      const bk = blackKeys[bi++];
      bk.resize(blackW, blackH);
      bk.x = (i + 1) * whiteW - blackW / 2;
      bk.y = 0;
    }
  }

  function onKeyPress(k: Key) {
    unlockAudio();
    if (mode === "free") {
      playPiano(k.midi);
      k.press();
      sparkle(k);
    } else {
      // Play-along: play next melody note regardless of which key was tapped
      const notes = selectedMelody.notes;
      if (melodyIndex >= notes.length) {
        restart();
        return;
      }
      const n = notes[melodyIndex];
      playPiano(n.midi);
      // Find matching key to animate (fall back to tapped key)
      const target = findKeyByMidi(n.midi) ?? k;
      target.press();
      sparkle(target);
      melodyIndex++;
      updateHint();
      if (melodyIndex >= notes.length) {
        celebrate();
      }
    }
  }

  function findKeyByMidi(midi: number): Key | null {
    for (const k of keys) if (k.midi === midi) return k;
    return null;
  }

  function sparkle(k: Key) {
    const globalPos = k.toGlobal({ x: k.keyWidth / 2, y: 10 });
    const local = confetti.toLocal(globalPos);
    confetti.burst(local.x, local.y, 8, Math.PI * 0.8, true);
  }

  function celebrate() {
    celebrateT = 1.6;
    subtitle.text = "Yay! You did it! 🎉";
    const w = width();
    const h = height();
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        confetti.burst(w * 0.2 + Math.random() * w * 0.6, h * 0.3, 40, Math.PI * 2, false);
      }, i * 140);
    }
  }

  function setMode(m: Mode) {
    mode = m;
    freeChip.setActive(m === "free");
    playChip.setActive(m === "play");
    if (m === "free") {
      subtitle.text = "Tap any key to play!";
      clearHints();
    } else {
      subtitle.text = `Tap any key — play ${selectedMelody.emoji} ${selectedMelody.name}!`;
      melodyIndex = 0;
      updateHint();
    }
    layout();
  }

  function selectMelody(m: Melody) {
    selectedMelody = m;
    melodyIndex = 0;
    for (const [id, chip] of chipsByMelody) chip.setActive(id === m.id);
    subtitle.text = `Tap any key — play ${m.emoji} ${m.name}!`;
    updateHint();
  }

  function clearHints() {
    for (const k of keys) k.setHint(false);
  }

  function updateHint() {
    clearHints();
    if (mode !== "play") return;
    if (melodyIndex >= selectedMelody.notes.length) return;
    const nextMidi = selectedMelody.notes[melodyIndex].midi;
    const k = findKeyByMidi(nextMidi);
    if (k) k.setHint(true);
  }

  function restart() {
    clearListenTimers();
    melodyIndex = 0;
    subtitle.text = `Tap any key — play ${selectedMelody.emoji} ${selectedMelody.name}!`;
    updateHint();
  }

  function clearListenTimers() {
    for (const t of listenTimers) clearTimeout(t);
    listenTimers = [];
  }

  function listen() {
    clearListenTimers();
    clearHints();
    const beat = 60 / selectedMelody.bpm;
    let t = 0;
    selectedMelody.notes.forEach((n, i) => {
      const when = t * 1000;
      listenTimers.push(
        window.setTimeout(() => {
          playPiano(n.midi);
          const k = findKeyByMidi(n.midi);
          if (k) {
            k.press();
            sparkle(k);
          }
          if (i === selectedMelody.notes.length - 1) {
            listenTimers.push(
              window.setTimeout(() => {
                if (mode === "play") updateHint();
              }, n.beats * beat * 1000 + 200),
            );
          }
        }, when),
      );
      t += n.beats * beat;
    });
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.repeat) return;
    const key = e.key.toLowerCase();
    const midi = KEY_TO_WHITE[key] ?? KEY_TO_BLACK[key];
    if (midi === undefined) return;
    const k = findKeyByMidi(midi);
    if (!k) return;
    onKeyPress(k);
  }

  function step(dt: number) {
    bg.update(dt);
    floating.update(dt);
    for (const k of keys) k.update(dt);
    for (const c of melodyChips) c.update(dt);
    freeChip.update(dt);
    playChip.update(dt);
    listenChip.update(dt);
    restartChip.update(dt);
    confetti.update(dt);

    if (celebrateT > 0) {
      celebrateT = Math.max(0, celebrateT - dt);
      const bounce = 1 + Math.sin(celebrateT * 18) * 0.08 * (celebrateT / 1.6);
      title.scale.set(bounce);
    } else {
      title.scale.set(1);
    }
  }

  return {
    mount(a: Application) {
      app = a;
      a.stage.addChild(root);
      layout();
      updateHint();

      tickerFn = (t) => step(t.deltaMS / 1000);
      a.ticker.add(tickerFn);

      resizeFn = () => layout();
      window.addEventListener("resize", resizeFn);
      a.renderer.on("resize", resizeFn);

      keyDownFn = handleKeyDown;
      window.addEventListener("keydown", keyDownFn);
    },
    unmount() {
      clearListenTimers();
      if (app && tickerFn) app.ticker.remove(tickerFn);
      if (app && resizeFn) app.renderer.off("resize", resizeFn);
      if (resizeFn) window.removeEventListener("resize", resizeFn);
      if (keyDownFn) window.removeEventListener("keydown", keyDownFn);
      root.destroy({ children: true });
      keys.length = 0;
      whiteKeys.length = 0;
      blackKeys.length = 0;
      app = null;
      tickerFn = null;
      resizeFn = null;
      keyDownFn = null;
    },
  };
}
