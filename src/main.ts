import { Application } from "pixi.js";
import type { Toy } from "./toy";
import { TOYS } from "./toyRegistry";
import { setAmbientLevel, startAmbient, unlockAudio } from "./audio";
import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });

const STORAGE_KEY = "toys.selected";

async function boot() {
  const app = new Application();
  await app.init({
    background: "#0b1a2b",
    resizeTo: window,
    resolution: Math.min(window.devicePixelRatio || 1, 1.5),
    autoDensity: true,
    antialias: false,
    powerPreference: "low-power",
  });
  document.body.appendChild(app.canvas);

  const unlock = () => {
    unlockAudio();
    startAmbient();
    window.removeEventListener("pointerdown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });

  let current: Toy | null = null;
  let currentId: string | null = null;

  const saved = localStorage.getItem(STORAGE_KEY);
  const initialId = TOYS.find((t) => t.id === saved)?.id ?? TOYS[0].id;

  const picker = document.createElement("div");
  picker.className = "toy-picker";
  const buttons = new Map<string, HTMLButtonElement>();
  for (const entry of TOYS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toy-btn";
    btn.setAttribute("aria-label", entry.label);
    btn.innerHTML = `<span class="emoji">${entry.emoji}</span><span class="label">${entry.label}</span>`;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      switchTo(entry.id);
    });
    picker.appendChild(btn);
    buttons.set(entry.id, btn);
  }
  document.body.appendChild(picker);

  function switchTo(id: string) {
    if (id === currentId) return;
    const entry = TOYS.find((t) => t.id === id);
    if (!entry) return;
    if (current) current.unmount();
    current = entry.create();
    currentId = id;
    current.mount(app);
    setAmbientLevel(id === "piano" ? 0 : 1);
    localStorage.setItem(STORAGE_KEY, id);
    for (const [bid, btn] of buttons) {
      btn.classList.toggle("active", bid === id);
    }
  }

  switchTo(initialId);
}

boot();
