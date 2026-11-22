import type { Toy } from "./toy";
import { createBubblePop } from "./toys/bubblePop";
import { createPiano } from "./toys/piano";
import { createPuppyPlane } from "./toys/puppyPlane";
import { createCritterBounce } from "./toys/critterBounce";
import { createCloudKitchen } from "./toys/cloudKitchen";

export interface ToyEntry {
  id: string;
  label: string;
  create: () => Toy;
}

function createLazySkyCircus(): Toy {
  let toy: Toy | undefined;
  let cancelled = false;
  const loading = document.createElement("p");
  loading.className = "toy-hint";
  loading.setAttribute("role", "status");
  loading.textContent = "Opening Sky Circus…";
  return {
    mount(app) {
      document.body.appendChild(loading);
      void import("./toys/skyCircus").then(({ createSkyCircus }) => {
        if (cancelled) return;
        toy = createSkyCircus();
        toy.mount(app);
        loading.remove();
      }).catch(() => {
        if (!cancelled) loading.textContent = "Sky Circus couldn't load. Pick another toy in the Toy Box.";
      });
    },
    unmount() {
      cancelled = true;
      loading.remove();
      toy?.unmount();
    },
  };
}

export const TOYS: ToyEntry[] = [
  { id: "bubbles", label: "Bubbles", create: createBubblePop },
  { id: "piano", label: "Piano", create: createPiano },
  { id: "puppyPlane", label: "Puppy Plane", create: createPuppyPlane },
  { id: "skyCircus", label: "Sky Circus", create: createLazySkyCircus },
  { id: "critterBounce", label: "Critter Bounce", create: createCritterBounce },
  { id: "cloudKitchen", label: "Cloud Kitchen", create: createCloudKitchen },
];
