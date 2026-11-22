import { Graphics } from "pixi.js";

export const COMIC_INK = 0x4d3154;
export const COMIC_PALETTE = [0xf687a1, 0xffd565, 0x76d9c6, 0xa8a1f1, 0xffad73];

export function drawStar(art: Graphics, x: number, y: number, size: number, color = 0xffd565) {
  const outline: number[] = [];
  for (let index = 0; index < 10; index++) {
    const angle = Math.PI * (index / 5 - 0.5);
    const radius = size * (index % 2 === 0 ? 1 : 0.48);
    outline.push(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  return art.poly(outline).fill(color).stroke({ color: COMIC_INK, width: Math.max(1, size * 0.09), join: "round" });
}

export function createComicHud(name: string, theme: string, instruction: string) {
  const root = document.createElement("header");
  root.className = `comic-hud comic-hud--${theme}`;
  const title = document.createElement("h1");
  title.textContent = name;
  const detail = document.createElement("p");
  detail.textContent = instruction;
  root.append(title, detail);
  return { root, detail };
}

export function createComicCallout() {
  const layer = document.createElement("div");
  layer.className = "comic-effects";
  layer.setAttribute("aria-hidden", "true");
  let current: HTMLElement | undefined;

  return {
    layer,
    show(word: string, x: number, y: number) {
      current?.remove();
      const effect = document.createElement("div");
      effect.className = "circus-pow";
      effect.textContent = word;
      const margin = word.length > 8 ? 32 : 24;
      effect.style.left = `${Math.max(margin, Math.min(100 - margin, x * 100))}%`;
      effect.style.top = `${Math.max(22, Math.min(79, y * 100))}%`;
      current = effect;
      layer.appendChild(effect);
      effect.addEventListener("animationend", () => {
        effect.remove();
        if (current === effect) current = undefined;
      }, { once: true });
    },
    remove() {
      current?.remove();
      layer.remove();
    },
  };
}

export function createToyFinish(title: string, message: string, reset: () => void) {
  const dialog = document.createElement("dialog");
  dialog.className = "play-dialog toy-finish";
  dialog.setAttribute("aria-label", title);

  const stamp = document.createElement("span");
  stamp.className = "finish-star";
  stamp.setAttribute("aria-hidden", "true");
  stamp.textContent = "★";
  const heading = document.createElement("h2");
  heading.textContent = title;
  const detail = document.createElement("p");
  detail.textContent = message;
  const actions = document.createElement("div");
  actions.className = "finish-actions";
  const again = document.createElement("button");
  again.className = "play-button";
  again.textContent = "Play again";
  const keepPlaying = document.createElement("button");
  keepPlaying.className = "play-button";
  keepPlaying.textContent = "Keep playing";
  actions.append(again, keepPlaying);
  dialog.append(stamp, heading, detail, actions);

  let timer = 0;
  let finished = false;
  again.addEventListener("click", () => {
    dialog.close();
    finished = false;
    reset();
  });
  keepPlaying.addEventListener("click", () => dialog.close());

  function show() {
    if (!dialog.isConnected) return;
    if (document.querySelector("dialog[open]")) {
      timer = window.setTimeout(show, 250);
      return;
    }
    dialog.showModal();
  }

  return {
    dialog,
    complete(result = message, headline = title) {
      if (finished) return;
      finished = true;
      heading.textContent = headline;
      detail.textContent = result;
      dialog.setAttribute("aria-label", headline);
      timer = window.setTimeout(show, 650);
    },
    remove() {
      window.clearTimeout(timer);
      dialog.remove();
    },
  };
}
