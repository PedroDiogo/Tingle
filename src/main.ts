import { Application } from "pixi.js";
import type { Toy } from "./toy";
import { TOYS } from "./toyRegistry";
import { setAmbientLevel, setMuted, startAmbient, unlockAudio } from "./audio";
import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });

const STORAGE_KEY = "toys.selected";
const MUTE_KEY = "toys.muted";

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

  // Restore saved mute state before audio is ever unlocked
  let isMuted = localStorage.getItem(MUTE_KEY) === "true";
  setMuted(isMuted);

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

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "toy-toggle";
  toggle.setAttribute("aria-label", "Choose toy");
  toggle.setAttribute("aria-expanded", "false");
  picker.appendChild(toggle);

  const menu = document.createElement("div");
  menu.className = "toy-menu";
  menu.setAttribute("role", "menu");
  picker.appendChild(menu);

  const setOpen = (open: boolean) => {
    picker.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  };

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(!picker.classList.contains("open"));
  });

  document.addEventListener("pointerdown", (e) => {
    if (!picker.contains(e.target as Node)) setOpen(false);
  });

  const buttons = new Map<string, HTMLButtonElement>();
  for (const entry of TOYS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toy-btn";
    btn.setAttribute("role", "menuitem");
    btn.setAttribute("aria-label", entry.label);
    btn.innerHTML = `<span class="emoji">${entry.emoji}</span><span class="label">${entry.label}</span>`;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      switchTo(entry.id);
      setOpen(false);
    });
    menu.appendChild(btn);
    buttons.set(entry.id, btn);
  }
  document.body.appendChild(picker);

  // Mute button — top-left, mirrors the toy picker
  const muteBtn = document.createElement("button");
  muteBtn.type = "button";
  muteBtn.className = "mute-btn" + (isMuted ? " muted" : "");
  muteBtn.setAttribute("aria-label", isMuted ? "Unmute" : "Mute");
  muteBtn.textContent = isMuted ? "🔇" : "🔊";
  muteBtn.addEventListener("click", () => {
    isMuted = !isMuted;
    setMuted(isMuted);
    localStorage.setItem(MUTE_KEY, isMuted ? "true" : "false");
    muteBtn.textContent = isMuted ? "🔇" : "🔊";
    muteBtn.setAttribute("aria-label", isMuted ? "Unmute" : "Mute");
    muteBtn.classList.toggle("muted", isMuted);
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
      btn.classList.toggle("active", bid === id);
    }
    toggle.textContent = entry.emoji;
  }

  switchTo(initialId);
}

boot();
