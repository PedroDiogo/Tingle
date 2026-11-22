import type { Toy } from "./toy";
import { createBubblePop } from "./toys/bubblePop";
import { createPiano } from "./toys/piano";
import { createPuppyPlane } from "./toys/puppyPlane";

export interface ToyEntry {
  id: string;
  label: string;
  create: () => Toy;
}

export const TOYS: ToyEntry[] = [
  { id: "bubbles", label: "Bubbles", create: createBubblePop },
  { id: "piano", label: "Piano", create: createPiano },
  { id: "puppyPlane", label: "Puppy Plane", create: createPuppyPlane },
];
