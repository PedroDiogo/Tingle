import "./style.css";
import { Application } from "pixi.js";
import type { Toy } from "./toy";
import { TOYS } from "./toyRegistry";
import { setAmbientLevel, setMuted, startAmbient, unlockAudio } from "./audio";
import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });

// Only auto-reload when the app is first opened or brought to foreground,
// never mid-session. Opens a 5-second window on each visibility event.
if ("serviceWorker" in navigator) {
  let reloadAllowed = true;
  let reloadTimer = setTimeout(() => { reloadAllowed = false; }, 5000);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      reloadAllowed = true;
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => { reloadAllowed = false; }, 5000);
    }
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadAllowed) window.location.reload();
  });
}

const STORAGE_KEY = "toys.selected";
const MUTE_KEY = "toys.muted";

async function boot() {
  const app = new Application();
  await app.init({
    background: "#f8f1df",
    resizeTo: window,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    antialias: true,
    powerPreference: "low-power",
  });
  document.body.appendChild(app.canvas);

  // Restore saved mute state before audio is ever unlocked
  let isMuted = localStorage.getItem(MUTE_KEY) === "true";
  setMuted(isMuted);

  const unlock = () => {
    unlockAudio();
    startAmbient();
  };
  window.addEventListener("pointerdown", unlock, { once: true });

  let current: Toy | null = null;
  let currentId: string | null = null;

  const saved = localStorage.getItem(STORAGE_KEY);
  const initialId = TOYS.find((t) => t.id === saved)?.id ?? TOYS[0].id;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "play-button toy-toggle";
  toggle.innerHTML = '<span class="toy-box-icon" aria-hidden="true"></span> Toy Box';
  toggle.setAttribute("aria-haspopup", "dialog");
  document.body.appendChild(toggle);

  const picker = document.createElement("dialog");
  picker.className = "play-dialog toy-picker";
  picker.setAttribute("aria-labelledby", "toy-picker-title");
  picker.innerHTML = `<header class="dialog-header">
    <h1 id="toy-picker-title">Toy Box</h1>
    <button class="play-button close-button" type="button" aria-label="Close toy box">×</button>
  </header>`;
  const choices = document.createElement("div");
  choices.className = "toy-choices";
  picker.appendChild(choices);
  document.body.appendChild(picker);

  picker.querySelector("button")!.addEventListener("click", () => picker.close());
  picker.addEventListener("click", (event) => {
    if (event.target === picker) picker.close();
  });
  toggle.addEventListener("click", () => picker.showModal());

  const buttons = new Map<string, HTMLButtonElement>();
  for (const entry of TOYS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `toy-card toy-card--${entry.id}`;
    button.innerHTML = `<span class="toy-picture" aria-hidden="true"><i></i><i></i><i></i></span><span>${entry.label}</span>`;
    button.addEventListener("click", () => {
      switchTo(entry.id);
      picker.close();
    });
    choices.appendChild(button);
    buttons.set(entry.id, button);
  }

  // Keep sound control available in every toy.
  const muteBtn = document.createElement("button");
  muteBtn.type = "button";
  muteBtn.className = "play-button mute-btn";
  function renderMute() {
    muteBtn.setAttribute("aria-pressed", String(isMuted));
    muteBtn.innerHTML = `<span class="sound-icon" aria-hidden="true">${isMuted ? "♪̸" : "♪"}</span>
      <span>Sound <span class="sound-state">${isMuted ? "off" : "on"}</span></span>`;
  }
  muteBtn.setAttribute("aria-label", "Mute sound");
  renderMute();
  muteBtn.addEventListener("click", () => {
    isMuted = !isMuted;
    setMuted(isMuted);
    localStorage.setItem(MUTE_KEY, String(isMuted));
    renderMute();
  });
  document.body.appendChild(muteBtn);

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
      btn.setAttribute("aria-pressed", String(bid === id));
    }
  }

  switchTo(initialId);
}

boot();
