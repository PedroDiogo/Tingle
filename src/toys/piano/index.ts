import { createComicCallout, createToyFinish } from "../../comic";
import { makeBand } from "./band";
import { Application, Container, Graphics } from "pixi.js";
import type { Toy } from "../../toy";
import { playPiano, unlockAudio } from "../../audio";
import { Key } from "./keys";
import { MELODIES, type Melody } from "./melodies";
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
  const bg = new Background([0xf2bce8, 0xffd4c2, 0xffeac0]);
  const keyboardBackdrop = new Graphics();
  const keyboardLayer = new Container();
  const whiteLayer = new Container();
  const blackLayer = new Container();
  keyboardLayer.addChild(whiteLayer, blackLayer);
  const confetti = new ConfettiLayer();
  const callout = createComicCallout();
  const finish = createToyFinish("Encore!", "You played a whole song with the Tingle Band.", () => {
    melodyIndex = 0;
    updateHint();
  });
  const band = makeBand((index) => {
    unlockAudio();
    playPiano([60, 64, 67][index]);
    band.play(index);
  });
  root.addChild(bg, band.stage, keyboardBackdrop, keyboardLayer, confetti);

  const controls = document.createElement("div");
  controls.className = "piano-controls";
  controls.setAttribute("role", "group");
  controls.setAttribute("aria-label", "Piano controls");

  function control(label: string, action: () => void) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "play-button";
    button.textContent = label;
    button.addEventListener("click", action);
    controls.appendChild(button);
    return button;
  }

  const freeButton = control("Free Play", () => setMode("free"));
  const playButton = control("Play-Along", () => setMode("play"));
  const songButton = control("", () => songs.showModal());
  songButton.classList.add("song-choice");
  songButton.setAttribute("aria-haspopup", "dialog");
  const listenButton = control("▶︎ Listen", () => {
    if (listenTimers.length) stopListening();
    else listen();
  });

  const songs = document.createElement("dialog");
  songs.className = "play-dialog";
  songs.setAttribute("aria-labelledby", "song-picker-title");
  songs.innerHTML = `<header class="dialog-header">
    <h2 id="song-picker-title">Choose a song</h2>
    <button class="play-button close-button" type="button" aria-label="Close song picker">×</button>
  </header>`;
  songs.querySelector("button")!.addEventListener("click", () => songs.close());
  songs.addEventListener("click", (event) => {
    if (event.target === songs) songs.close();
  });

  const songChoices = document.createElement("div");
  songChoices.className = "song-choices";
  const songButtons = new Map<string, HTMLButtonElement>();
  for (const song of MELODIES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "play-button";
    button.innerHTML = `<span aria-hidden="true">${song.emoji}</span>${song.name}`;
    button.addEventListener("click", () => {
      selectMelody(song);
      songs.close();
    });
    songChoices.appendChild(button);
    songButtons.set(song.id, button);
  }
  songs.appendChild(songChoices);

  let mode: Mode = "free";
  let selectedMelody: Melody = MELODIES[0];
  let melodyIndex = 0;
  let listenTimers: number[] = [];

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
    const compact = w < 650;
    const whiteCount = compact ? 7 : WHITE_MIDIS.length;
    const sidePad = 12;
    const whiteW = Math.min(94, (w - sidePad * 2) / whiteCount);
    const keyboardW = whiteW * whiteCount;
    const bounds = controls.getBoundingClientRect();
    const canvasTop = app!.canvas.getBoundingClientRect().top;
    const bottomGap = 20;
    const keyArea = h - (bounds.bottom - canvasTop) - bottomGap - 14;
    const keyboardH = Math.max(32, Math.min(keyArea * 0.67, whiteW * (compact ? 4.2 : 3.15)));
    const kx = (w - keyboardW) / 2;
    const ky = h - keyboardH - bottomGap;
    keyboardLayer.position.set(kx, ky);
    const bandRoom = ky - bounds.bottom + canvasTop - 18;
    band.stage.visible = bandRoom >= 45;
    band.stage.scale.set(Math.min(1.5, w / 348, bandRoom / 134));
    band.stage.position.set(w / 2, bounds.bottom - canvasTop + 10 + bandRoom / 2);

    keyboardBackdrop.clear();
    keyboardBackdrop
      .roundRect(kx - 8, ky - 9, keyboardW + 16, keyboardH + 20, 18)
      .fill(0xc58ebe)
      .stroke({ color: 0x4d3154, width: 3 });

    for (let i = 0; i < whiteKeys.length; i++) {
      const key = whiteKeys[i];
      key.visible = i < whiteCount;
      if (!key.visible) continue;
      key.resize(whiteW - 4, keyboardH);
      key.position.set(i * whiteW + 2, 0);
    }

    blackLayer.visible = !compact;
    for (const key of blackKeys) {
      const index = WHITE_MIDIS.indexOf(key.midi - 1);
      const blackW = whiteW * 0.62;
      key.resize(blackW, keyboardH * 0.62);
      key.position.set((index + 1) * whiteW - blackW / 2, 0);
    }
    if (mode === "play" && !listenTimers.length) updateHint();
  }

  function onKeyPress(k: Key) {
    unlockAudio();
    if (listenTimers.length) stopListening();
    if (mode === "free") {
      playPiano(k.midi);
      band.play(k.midi);
      k.press();
      if (isVisibleKey(k)) sparkle(k);
    } else {
      // Play-along: play next melody note regardless of which key was tapped
      const notes = selectedMelody.notes;
      if (melodyIndex >= notes.length) {
        melodyIndex = 0;
      }
      const n = notes[melodyIndex];
      playPiano(n.midi);
      band.play(n.midi);
      // Find matching key to animate (fall back to tapped key)
      const target = findVisibleNote(n.midi) ?? k;
      target.press();
      if (isVisibleKey(target)) sparkle(target);
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
    callout.show("ENCORE!", 0.5, 0.42);
    finish.complete(`You played ${selectedMelody.name} with the Tingle Band.`);
    confetti.burst(width() / 2, keyboardLayer.y, 34, Math.PI * 2, false);
  }

  function isVisibleKey(key: Key) {
    return key.visible && (key.parent !== blackLayer || blackLayer.visible);
  }

  function findVisibleNote(midi: number) {
    const exact = findKeyByMidi(midi);
    if (exact && isVisibleKey(exact)) return exact;
    return whiteKeys.find((key) => key.visible && key.midi % 12 === midi % 12);
  }

  function syncControls() {
    const isPlayingAlong = mode === "play";
    freeButton.setAttribute("aria-pressed", String(!isPlayingAlong));
    playButton.setAttribute("aria-pressed", String(isPlayingAlong));
    songButton.hidden = !isPlayingAlong;
    listenButton.hidden = !isPlayingAlong;
    songButton.innerHTML = `<span aria-hidden="true">${selectedMelody.emoji}</span> ${selectedMelody.name} ▾`;
    songButton.setAttribute("aria-label", `Choose a song: ${selectedMelody.name}`);
    for (const [id, button] of songButtons) {
      button.setAttribute("aria-pressed", String(id === selectedMelody.id));
    }
    layout();
  }

  function setMode(nextMode: Mode) {
    if (nextMode === mode) return;
    stopListening();
    mode = nextMode;
    melodyIndex = 0;
    clearHints();
    syncControls();
  }

  function selectMelody(melody: Melody) {
    stopListening();
    selectedMelody = melody;
    melodyIndex = 0;
    syncControls();
  }

  function clearHints() {
    for (const k of keys) k.setHint(false);
  }

  function updateHint() {
    clearHints();
    if (mode !== "play") return;
    if (melodyIndex >= selectedMelody.notes.length) return;
    const nextMidi = selectedMelody.notes[melodyIndex].midi;
    const k = findVisibleNote(nextMidi);
    if (k) k.setHint(true);
  }

  function stopListening() {
    for (const timer of listenTimers) clearTimeout(timer);
    listenTimers = [];
    listenButton.textContent = "▶︎ Listen";
    updateHint();
  }

  function listen() {
    unlockAudio();
    clearHints();
    listenButton.textContent = "■ Stop";
    const melody = selectedMelody;
    const beat = 60 / melody.bpm;
    let elapsed = 0;
    for (const note of melody.notes) {
      listenTimers.push(window.setTimeout(() => {
        playPiano(note.midi);
        band.play(note.midi);
        const key = findVisibleNote(note.midi);
        if (key) {
          key.press();
          sparkle(key);
        }
      }, elapsed * 1000));
      elapsed += note.beats * beat;
    }
    listenTimers.push(window.setTimeout(stopListening, elapsed * 1000));
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.repeat || document.querySelector("dialog[open]")) return;
    const key = e.key.toLowerCase();
    const midi = KEY_TO_WHITE[key] ?? KEY_TO_BLACK[key];
    if (midi === undefined) return;
    const k = findKeyByMidi(midi);
    if (!k) return;
    onKeyPress(k);
  }

  function step(dt: number) {
    bg.update(dt);
    for (const key of keys) {
      if (isVisibleKey(key)) key.update(dt);
    }
    confetti.update(dt);
    band.update(dt);
  }

  return {
    mount(a: Application) {
      app = a;
      a.stage.addChild(root);
      document.body.append(controls, songs, callout.layer, finish.dialog);
      syncControls();

      tickerFn = (t) => step(t.deltaMS / 1000);
      a.ticker.add(tickerFn);

      resizeFn = () => layout();
      window.addEventListener("resize", resizeFn);
      a.renderer.on("resize", resizeFn);

      keyDownFn = handleKeyDown;
      window.addEventListener("keydown", keyDownFn);
    },
    unmount() {
      stopListening();
      controls.remove();
      callout.remove();
      finish.remove();
      songs.remove();
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
