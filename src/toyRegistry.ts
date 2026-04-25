import type { Toy } from "./toy";
import { createBubblePop } from "./toys/bubblePop";
import { createPiano } from "./toys/piano";
import { createPuppyPlane } from "./toys/puppyPlane";

export interface ToyEntry {
  id: string;
  label: string;
  emoji: string;
  create: () => Toy;
}

export const TOYS: ToyEntry[] = [
  { id: "bubbles", label: "Bubbles", emoji: "🫧", create: createBubblePop },
  { id: "piano", label: "Piano", emoji: "🎹", create: createPiano },
  { id: "puppyPlane", label: "Puppy Plane", emoji: "🐶", create: createPuppyPlane },
];
