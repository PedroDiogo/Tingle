import type { Application } from "pixi.js";

export interface Toy {
  mount(app: Application): void;
  unmount(): void;
}
