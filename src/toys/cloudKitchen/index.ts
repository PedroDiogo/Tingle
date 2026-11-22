import type { Application } from "pixi.js";
import "./style.css";
import { playNote, unlockAudio } from "../../audio";
import { createComicCallout, createComicHud, createToyFinish } from "../../comic";
import type { Toy } from "../../toy";

const INGREDIENTS = [
  { name: "Berry", icon: "●", color: "#ef7498", note: 523.25 },
  { name: "Starfruit", icon: "★", color: "#ffd365", note: 659.25 },
  { name: "Mint", icon: "❧", color: "#77d9b2", note: 587.33 },
  { name: "Moon Drop", icon: "☾", color: "#b09beb", note: 783.99 },
];
const RECIPES = [
  { ingredients: [0, 1, 2], name: "Sunshine Sundae", reaction: "SUNSHINE!", color: "#ffde83" },
  { ingredients: [3, 0, 3], name: "Moonberry Swirl", reaction: "MOON MAGIC!", color: "#cab0ff" },
  { ingredients: [2, 2, 1], name: "Minty Stardust", reaction: "STAR CHEF!", color: "#a3e9c1" },
  { ingredients: [1, 3, 0], name: "Comet Crunch", reaction: "COMET CRUNCH!", color: "#ffaec4" },
  { ingredients: [0, 0, 1, 1], name: "Double Berry Blast", reaction: "BERRY BLAST!", color: "#ef8da7" },
  { ingredients: [3, 3, 2, 2], name: "Moon Mint Tower", reaction: "TO THE MOON!", color: "#b9b0ef" },
  { ingredients: [2, 0, 3, 1], name: "Rainbow Stack", reaction: "TASTE THE RAINBOW!", color: "#8fe4d6" },
  { ingredients: [1, 1, 1, 3], name: "Three-Star Special", reaction: "STAR SPECIAL!", color: "#ffd477" },
];

function ingredientIcon(index: number) {
  const { icon, color } = INGREDIENTS[index];
  return `<span class="ingredient-icon ingredient-icon--${index}" style="--flavor:${color}" aria-hidden="true">${icon}</span>`;
}

export function createCloudKitchen(): Toy {
  const screen = document.createElement("section");
  screen.className = "cloud-kitchen";
  screen.setAttribute("aria-label", "Cloud Kitchen play area");
  const hud = createComicHud("Cloud Kitchen", "kitchen", "Make the picture order or invent your own");
  const callout = createComicCallout();
  const finish = createToyFinish("Star chef!", "You served eight matching picture orders, including the tall specials.", () => {
    matches = 0;
    orderIndex = 0;
    resetOrder();
  });
  const recipeCard = document.createElement("div");
  recipeCard.className = "kitchen-order";
  recipeCard.setAttribute("aria-live", "polite");
  const plate = document.createElement("div");
  plate.className = "kitchen-plate";
  plate.innerHTML = `<div class="kitchen-cloud" aria-hidden="true">
    <div class="cloud-puff cloud-puff--left"></div>
    <div class="cloud-puff cloud-puff--top"></div>
    <div class="cloud-puff cloud-puff--right"></div>
    <div class="cloud-face"><i></i><i></i><b></b></div>
  </div>
  <div class="kitchen-toppings" aria-label="Toppings added"></div>
  <div class="kitchen-dish" aria-hidden="true"></div>`;
  const cloud = plate.querySelector<HTMLElement>(".kitchen-cloud")!;
  const toppings = plate.querySelector<HTMLElement>(".kitchen-toppings")!;
  const tray = document.createElement("div");
  tray.className = "kitchen-tray";
  const shelf = document.createElement("div");
  shelf.className = "kitchen-shelf";
  const serve = document.createElement("button");
  serve.type = "button";
  serve.className = "play-button kitchen-serve";
  serve.textContent = "Serve!";
  shelf.append(tray, serve);
  screen.append(recipeCard, plate, shelf);
  const events = new AbortController();
  const options = { signal: events.signal };

  let game: Application;
  let toppingsAdded: number[] = [];
  let orderIndex = 0;
  let matches = 0;
  let serving = false;
  let nextOrder = 0;
  let drag: { id: number; x: number; y: number; moved: boolean; ghost?: HTMLElement } | undefined;

  function updateGoal() {
    hud.detail.textContent = `Match the picture · ${Math.min(matches, RECIPES.length)}/${RECIPES.length}`;
  }

  function resetOrder() {
    window.clearTimeout(nextOrder);
    toppingsAdded = [];
    serving = false;
    cloud.style.removeProperty("--scoop");
    plate.classList.remove("kitchen-plate--served");
    updateGoal();
    updateOrder();
    updateToppings();
  }

  function updateOrder() {
    const order = RECIPES[orderIndex];
    screen.classList.toggle("cloud-kitchen--specials", order.ingredients.length === 4);
    recipeCard.innerHTML = `<strong>${order.name}</strong><div>${order.ingredients.map(ingredientIcon).join("")}</div>`;
    recipeCard.setAttribute("aria-label", `Order for ${order.name}: ${order.ingredients.map((i) => INGREDIENTS[i].name).join(", ")}`);
  }

  function updateToppings() {
    toppings.replaceChildren();
    toppingsAdded.forEach((index, slot) => {
      const button = document.createElement("button");
      button.type = "button";
      button.disabled = serving;
      button.setAttribute("aria-label", `Remove ${INGREDIENTS[index].name}`);
      button.innerHTML = ingredientIcon(index);
      button.addEventListener("click", () => {
        toppingsAdded.splice(slot, 1);
        updateToppings();
        toppings.querySelector("button")?.focus();
      });
      toppings.appendChild(button);
    });
    serve.disabled = !toppingsAdded.length || serving;
    tray.querySelectorAll("button").forEach((button) => {
      button.disabled = serving || toppingsAdded.length >= RECIPES[orderIndex].ingredients.length;
    });
  }

  function add(index: number) {
    if (serving || toppingsAdded.length >= RECIPES[orderIndex].ingredients.length) return;
    unlockAudio();
    toppingsAdded.push(index);
    playNote(INGREDIENTS[index].note);
    cloud.getAnimations().forEach((animation) => animation.cancel());
    cloud.animate([{ scale: "1" }, { scale: "1.05 .95" }, { scale: "1" }], { duration: 260 });
    updateToppings();
  }

  function serveOrder() {
    if (!toppingsAdded.length || serving) return;
    unlockAudio();
    const order = RECIPES[orderIndex];
    const expected = [...order.ingredients].sort();
    const exact = toppingsAdded.length === expected.length
      && [...toppingsAdded].sort().every((item, i) => item === expected[i]);
    serving = true;
    updateToppings();
    cloud.style.setProperty("--scoop", exact ? order.color : INGREDIENTS[toppingsAdded[0]].color);
    plate.classList.add("kitchen-plate--served");
    const signature = toppingsAdded.length >= 2 && toppingsAdded.every((item) => item === toppingsAdded[0]);
    callout.show(exact ? order.reaction : signature ? "MEGA SCOOP!" : "NEW FLAVOR!", 0.5, 0.48);
    playNote(659.25);
    playNote(exact ? 1046.5 : 783.99);
    if (exact) {
      matches++;
      updateGoal();
      if (matches === RECIPES.length) finish.complete();
    }
    nextOrder = window.setTimeout(() => {
      orderIndex = (orderIndex + 1) % RECIPES.length;
      resetOrder();
    }, 760);
  }

  function finishDrag(event: PointerEvent, drop: boolean, index: number) {
    if (!drag || drag.id !== event.pointerId) return;
    const { moved, ghost } = drag;
    drag = undefined;
    ghost?.remove();
    plate.classList.remove("kitchen-plate--target");
    if (!drop) return;
    if (!moved) {
      add(index);
      return;
    }
    const target = plate.getBoundingClientRect();
    if (event.clientX >= target.left && event.clientX <= target.right
        && event.clientY >= target.top && event.clientY <= target.bottom) {
      add(index);
    }
  }

  INGREDIENTS.forEach(({ name }, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "play-button ingredient";
    button.innerHTML = `${ingredientIcon(index)}<span>${name}</span>`;
    button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || drag) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      button.setPointerCapture(event.pointerId);
    }, options);
    button.addEventListener("pointermove", (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) >= 9) {
        drag.moved = true;
        drag.ghost = document.createElement("div");
        drag.ghost.className = "ingredient-ghost";
        drag.ghost.innerHTML = ingredientIcon(index);
        screen.appendChild(drag.ghost);
        plate.classList.add("kitchen-plate--target");
      }
      if (drag.ghost) {
        drag.ghost.style.left = `${event.clientX}px`;
        drag.ghost.style.top = `${event.clientY}px`;
      }
    }, options);
    button.addEventListener("pointerup", (event) => finishDrag(event, true, index), options);
    button.addEventListener("pointercancel", (event) => finishDrag(event, false, index), options);
    button.addEventListener("lostpointercapture", (event) => finishDrag(event, false, index), options);
    button.addEventListener("click", (event) => {
      // Pointer releases are handled above. Keyboard activation still uses click.
      if (event.detail === 0) add(index);
    }, options);
    tray.appendChild(button);
  });
  serve.addEventListener("click", serveOrder, options);

  return {
    mount(app) {
      game = app;
      app.stop();
      app.canvas.hidden = true;
      document.body.append(screen, hud.root, callout.layer, finish.dialog, finish.button);
      resetOrder();
    },
    unmount() {
      events.abort();
      clearTimeout(nextOrder);
      screen.remove();
      hud.root.remove();
      callout.remove();
      finish.remove();
      game.canvas.hidden = false;
      game.start();
    },
  };

}
