import { createToyFinish } from "../../comic";
import * as T from "three";
import { playNote, unlockAudio } from "../../audio";
import type { Toy } from "../../toy";
import { makeBalloon, makeCloud, makeHoop, makeIsland, makePlane, paint } from "./scenery";

const ACTS = [
  { sky: 0x8fddeb, hoop: 0x39bda8, name: "Bubble Bay" },
  { sky: 0xf3adc5, hoop: 0xea648c, name: "Cotton Candy Clouds" },
  { sky: 0xb8adeb, hoop: 0xffb84a, name: "Starlight Parade" },
];
const COLORS = [0xff678d, 0xffc44e, 0x49d7c9, 0xa685ec, 0xff9664];
const NOTES = [392, 440, 523.25, 587.33, 659.25, 783.99];
const FOG_NEAR = 14;
const FOG_FAR = 73;

interface DriftObject {
  model: T.Group;
  lane: number;
  height: number;
}

interface Particle {
  position: T.Vector3;
  velocity: T.Vector3;
  color: T.Color;
  life: number;
}

export function createSkyCircus(): Toy {
  let teardown: (() => void) | undefined;
  return {
    mount(app) {
      app.stop();
      app.canvas.hidden = true;
      const screen = document.createElement("section");
      screen.className = "sky-circus";
      screen.setAttribute("aria-label", "Sky Circus");
      document.body.appendChild(screen);
      try {
        teardown = startCircus(screen);
      } catch (error) {
        console.warn("Sky Circus could not start", error);
        const message = document.createElement("p");
        message.className = "sky-fallback";
        message.textContent = "Sky Circus needs WebGL 2. Pick another toy in the Toy Box.";
        screen.replaceChildren(message);
      }
      const dispose = teardown;
      teardown = () => {
        dispose?.();
        screen.remove();
        app.canvas.hidden = false;
        app.start();
      };
    },
    unmount() {
      teardown?.();
      teardown = undefined;
    },
  };
}

function startCircus(screen: HTMLElement) {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.domElement.setAttribute("aria-label", "Fly with arrows or drag to steer");
  screen.appendChild(renderer.domElement);

  const scene = new T.Scene();
  scene.background = new T.Color(ACTS[0].sky);
  scene.fog = new T.Fog(ACTS[0].sky, FOG_NEAR, FOG_FAR);
  const camera = new T.PerspectiveCamera(45, 1, 0.1, 100);
  const ambient = new T.HemisphereLight(0xfff4e5, 0xa89ac9, 2.1);
  const sunlight = new T.DirectionalLight(0xffead2, 2.6);
  sunlight.position.set(-4, 8, 6);
  scene.add(ambient, sunlight);
  const { plane, propeller, animatePilot, lookBack } = makePlane();
  const planeRig = new T.Group();
  planeRig.add(plane);
  scene.add(planeRig);

  const target = new T.Vector3(0, 1.8, 0);
  planeRig.position.copy(target);
  const worldRay = new T.Raycaster();
  const flightPlane = new T.Plane(new T.Vector3(0, 0, 1));
  const pointer = new T.Vector2();
  const point = new T.Vector3();
  const safeCenter = new T.Vector3();
  const skyTarget = new T.Color(ACTS[0].sky);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pressed = new Set<string>();
  let pointerId: number | null = null;
  let halfWidth = 4;
  let minY = -0.1;
  let maxY = 4;
  let age = 0;
  let act = 0;
  let stamps = 0;
  let skiesCleared = 0;
  const finish = createToyFinish("Sky tour complete!", "You flew through nine hoops across all three skies.", () => {
    act = stamps = skiesCleared = 0;
    target.set(0, 1.8, 0);
    planeRig.position.copy(target);
    roll = 0;
    pressed.clear();
    skyTarget.set(ACTS[0].sky);
    hoops.forEach(({ model, body }, index) => {
      model.position.z = -13 - index * 12;
      body.material = paint(ACTS[0].hoop);
    });
    updateHud();
  });
  screen.appendChild(finish.dialog);
  let roll = 0;
  let nextLookBack = 19;
  let lastLookBack = -10;
  let shake = 0;
  let frame = 0;
  let lastTime = 0;
  let callout: HTMLElement | undefined;

  const hoops = Array.from({ length: 3 }, (_, index) => {
    const { hoop, body } = makeHoop();
    scene.add(hoop);
    return { model: hoop, body, lane: [0, -0.55, 0.54][index], height: [1.8, 3.1, 0.38][index] };
  });
  const balloons: DriftObject[] = COLORS.map((color, index) => {
    const model = makeBalloon(color);
    model.position.z = -15 - index * 7;
    scene.add(model);
    return { model, lane: [-0.65, 0.66, -0.3, 0.44, 0][index], height: 1.2 + ((index * 3) % 5) * 0.53 };
  });
  const clouds = Array.from({ length: 12 }, (_, index) => {
    const model = makeCloud();
    model.scale.setScalar(0.8 + (index % 4) * 0.32);
    model.position.set((index % 2 ? 1 : -1) * (4.6 + index % 5), -0.8 + index % 4 * 1.3, -8 - index * 5.3);
    scene.add(model);
    return model;
  });
  const islands = Array.from({ length: 5 }, (_, index) => {
    const model = makeIsland(index % 2 ? 0x92d49f : 0x81c6a4);
    model.position.set((index % 2 ? 1 : -1) * (5 + index % 3), -2.9 - (index % 3) * 0.55, -17 - index * 10.5);
    model.scale.setScalar(0.7 + (index % 3) * 0.25);
    scene.add(model);
    return model;
  });

  const sun = new T.Mesh(
    new T.SphereGeometry(5, 22, 16),
    new T.MeshBasicMaterial({ color: 0xffe395, fog: false }),
  );
  scene.add(sun);

  const particles: Particle[] = [];
  const particleCount = 175;
  const particlePositions = new Float32Array(particleCount * 3);
  const particleColors = new Float32Array(particleCount * 3);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.BufferAttribute(particlePositions, 3));
  geometry.setAttribute("color", new T.BufferAttribute(particleColors, 3));
  const confetti = new T.Points(geometry, new T.PointsMaterial({ size: 0.15, vertexColors: true, fog: false }));
  confetti.frustumCulled = false;
  scene.add(confetti);

  const hud = document.createElement("div");
  hud.className = "circus-hud";
  hud.innerHTML = `<div class="circus-sign">
    <h1>Sky Circus</h1>
    <p class="circus-act" aria-live="polite"></p>
    <div class="circus-stamps" aria-label="Hoops collected"></div>
  </div>
  <p class="circus-hint">Drag through hoops <span>•</span> Tap balloons to pop</p>
  <button class="circus-roll" type="button" aria-keyshortcuts="Space">Barrel roll!</button>`;
  screen.appendChild(hud);
  const actLabel = hud.querySelector<HTMLElement>(".circus-act")!;
  const stampLabel = hud.querySelector<HTMLElement>(".circus-stamps")!;
  const hint = hud.querySelector<HTMLElement>(".circus-hint")!;
  const rollButton = hud.querySelector<HTMLButtonElement>(".circus-roll")!;

  function updateHud() {
    actLabel.textContent = ACTS[act].name;
    actLabel.dataset.progress = `${Math.min(skiesCleared, ACTS.length)}/${ACTS.length}`;
    actLabel.setAttribute("aria-label", `${ACTS[act].name}, ${Math.min(skiesCleared, ACTS.length)} of ${ACTS.length} skies cleared`);
    stampLabel.setAttribute("aria-label", `${stamps} of 3 hoops collected`);
    stampLabel.innerHTML = Array.from({ length: 3 }, (_, i) =>
      `<span class="${i < stamps ? "collected" : ""}" aria-hidden="true">★</span>`).join("");
  }

  function resize() {
    const w = screen.clientWidth;
    const h = screen.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.position.set(0, 3.2, w < h ? 10.4 : 9.3);
    camera.lookAt(0, 0.6, -8);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    sun.position.set(w < h ? 7.7 : 16, 13, -58);
    const edge = worldPosition(0.86, 0);
    const upper = worldPosition(0, 0.57);
    const lower = worldPosition(0, -0.58);
    halfWidth = Math.max(1.4, Math.min(6.2, edge.x - 0.45));
    minY = Math.max(-0.65, lower.y);
    maxY = Math.min(5, upper.y);
    target.x = T.MathUtils.clamp(target.x, -halfWidth, halfWidth);
    target.y = T.MathUtils.clamp(target.y, minY, maxY);
  }

  function worldPosition(x: number, y: number) {
    worldRay.setFromCamera(pointer.set(x, y), camera);
    return worldRay.ray.intersectPlane(flightPlane, new T.Vector3()) ?? new T.Vector3();
  }

  function steer(event: PointerEvent) {
    const bounds = renderer.domElement.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width * 2 - 1;
    const y = 1 - (event.clientY - bounds.top) / bounds.height * 2;
    const desired = worldPosition(x, y);
    target.set(T.MathUtils.clamp(desired.x, -halfWidth, halfWidth), T.MathUtils.clamp(desired.y, minY, maxY), 0);
  }

  function onDown(event: PointerEvent) {
    if (event.button !== 0 || pointerId !== null) return;
    unlockAudio();
    pointerId = event.pointerId;
    renderer.domElement.setPointerCapture(event.pointerId);
    steer(event);
    const hits = worldRay.intersectObjects(balloons.map(({ model }) => model));
    if (hits.length) {
      const hitObject = hits[0].object;
      const balloon = balloons.find(({ model }) => model.children.some((child) =>
        child === hitObject || child.children.includes(hitObject)));
      if (balloon) pop(balloon);
    }
  }

  function onMove(event: PointerEvent) {
    if (pointerId === event.pointerId) steer(event);
  }

  function onUp(event: PointerEvent) {
    if (pointerId === event.pointerId) pointerId = null;
  }

  function onKeyDown(event: KeyboardEvent) {
    if (document.querySelector("dialog[open]")) return;
    if (event.code === "Space" && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      if (!event.repeat) barrelRoll();
    }
    if (event.key.startsWith("Arrow")) {
      pressed.add(event.key);
      event.preventDefault();
    }
  }

  function onKeyUp(event: KeyboardEvent) {
    pressed.delete(event.key);
  }

  function barrelRoll() {
    if (roll > 0) return;
    unlockAudio();
    roll = 0.85;
    if (age - lastLookBack >= 5) {
      lookBack(1.65);
      lastLookBack = age;
      nextLookBack = age + 21;
    }
    playNote(311.13);
    burst(planeRig.position, COLORS, 34);
    say("WHOOSH!", planeRig.position);
  }

  function burst(position: T.Vector3, colors: number[], count: number) {
    for (let i = 0; i < count && particles.length < particleCount; i++) {
      particles.push({
        position: position.clone(),
        velocity: new T.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.28) * 5, Math.random() * 3),
        color: new T.Color(colors[i % colors.length]),
        life: 0.45 + Math.random() * 0.85,
      });
    }
  }

  function say(word: string, position: T.Vector3) {
    point.copy(position).project(camera);
    const effect = document.createElement("div");
    effect.className = "circus-pow";
    effect.textContent = word;
    effect.style.left = `${T.MathUtils.clamp((point.x + 1) * 50, 18, 82)}%`;
    effect.style.top = `${T.MathUtils.clamp((1 - point.y) * 50, 22, 75)}%`;
    callout?.remove();
    callout = effect;
    screen.appendChild(effect);
    effect.addEventListener("animationend", () => {
      effect.remove();
      if (callout === effect) callout = undefined;
    }, { once: true });
  }

  function pop(balloon: DriftObject) {
    const position = balloon.model.position;
    const index = balloons.indexOf(balloon);
    playNote(NOTES[index]);
    burst(position, [COLORS[index], 0xfff9de, 0xffffff], 24);
    say("POP!", position);
    position.z = Math.min(...balloons.map(({ model }) => model.position.z), -32) - 7;
    balloon.lane = (Math.random() * 2 - 1) * 0.84;
  }

  function collect(position: T.Vector3) {
    burst(position, COLORS, 34);
    playNote(NOTES[stamps]);
    stamps++;
    if (stamps < 3) {
      say("NICE!", position);
    } else {
      skiesCleared++;
      if (skiesCleared === ACTS.length) finish.complete();
      act = (act + 1) % ACTS.length;
      stamps = 0;
      say("SHOWTIME!", position);
      lookBack(2.05);
      lastLookBack = age;
      nextLookBack = age + 21;
      burst(position, COLORS, 85);
      playNote(NOTES[4]);
      playNote(NOTES[5]);
      shake = 0.35;
      skyTarget.set(ACTS[act].sky);
      for (const hoop of hoops) hoop.body.material = paint(ACTS[act].hoop);
    }
    updateHud();
  }

  function step(dt: number) {
    age += dt;
    const rolling = roll > 0;
    roll = Math.max(0, roll - dt);
    const progress = 1 - roll / 0.85;
    const speed = rolling ? 15 : 7.3;
    target.x = T.MathUtils.clamp(target.x + (Number(pressed.has("ArrowRight")) - Number(pressed.has("ArrowLeft"))) * dt * 5, -halfWidth, halfWidth);
    target.y = T.MathUtils.clamp(target.y + (Number(pressed.has("ArrowUp")) - Number(pressed.has("ArrowDown"))) * dt * 4, minY, maxY);
    const drift = target.x - planeRig.position.x;
    planeRig.position.lerp(target, 1 - Math.exp(-dt * 5.4));
    plane.rotation.z = -drift * 0.14 + (rolling ? progress * Math.PI * 2 : 0);
    plane.rotation.y = T.MathUtils.clamp(-drift * 0.1, -0.32, 0.32);
    plane.position.y = Math.sin(age * 3.6) * 0.055;
    propeller.rotation.z += dt * (rolling ? 45 : 24);
    if (age >= nextLookBack) {
      lookBack(1.25);
      lastLookBack = age;
      nextLookBack = age + 22;
    }
    animatePilot(dt, -drift * 0.12, rolling);

    for (const item of hoops) {
      const p = item.model.position;
      const oldZ = p.z;
      p.z += speed * dt;
      p.x = item.lane * halfWidth;
      p.y = item.height;
      item.model.rotation.z = age * 0.28;
      if (oldZ < 0 && p.z >= 0 && Math.hypot(p.x - planeRig.position.x, p.y - planeRig.position.y) < 1.42) {
        collect(p);
        p.z = 2;
      }
      if (p.z > 1.6) p.z = Math.min(...hoops.map(({ model }) => model.position.z), -15) - 10;
    }

    for (const [i, item] of balloons.entries()) {
      const p = item.model.position;
      p.z += speed * dt * 0.76;
      p.x = item.lane * halfWidth + Math.sin(age * 1.3 + i) * 0.24;
      p.y = item.height + Math.sin(age * 2.2 + i) * 0.2;
      item.model.rotation.z = Math.sin(age * 2 + i) * 0.16;
      if (p.distanceTo(planeRig.position) < 0.93) pop(item);
      if (p.z > 5) p.z = Math.min(...balloons.map(({ model }) => model.position.z), -27) - 7;
    }

    for (const cloud of clouds) {
      cloud.position.z += speed * dt * 0.6;
      if (cloud.position.z > 8) cloud.position.z -= 69;
    }
    for (const island of islands) {
      island.position.z += speed * dt * 0.91;
      if (island.position.z > 8) island.position.z -= 70;
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      particle.life -= dt;
      if (particle.life <= 0) particles.splice(i, 1);
      else {
        particle.velocity.y -= dt * 4;
        particle.position.addScaledVector(particle.velocity, dt);
      }
    }
    for (const [i, particle] of particles.entries()) {
      particle.position.toArray(particlePositions, i * 3);
      particle.color.toArray(particleColors, i * 3);
    }
    geometry.setDrawRange(0, particles.length);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;

    if (age > 10) hint.hidden = true;
    shake = Math.max(0, shake - dt);
    const backdrop = scene.background as T.Color;
    backdrop.lerp(skyTarget, 1 - Math.exp(-dt * 2.8));
    scene.fog!.color.copy(backdrop);
    if (!reduceMotion) {
      safeCenter.set(0, 0.6 + Math.sin(age * 23) * shake * 0.25, -8);
      camera.lookAt(safeCenter);
    }
  }

  function animate(time: number) {
    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.06) : 0;
    lastTime = time;
    if (!finish.dialog.open) step(dt);
    renderer.render(scene, camera);
    frame = requestAnimationFrame(animate);
  }

  const events = new AbortController();
  const options = { signal: events.signal };
  renderer.domElement.addEventListener("pointerdown", onDown, options);
  renderer.domElement.addEventListener("pointermove", onMove, options);
  renderer.domElement.addEventListener("pointerup", onUp, options);
  renderer.domElement.addEventListener("pointercancel", onUp, options);
  renderer.domElement.addEventListener("lostpointercapture", onUp, options);
  window.addEventListener("keydown", onKeyDown, options);
  window.addEventListener("keyup", onKeyUp, options);
  window.addEventListener("blur", () => { pressed.clear(); pointerId = null; }, options);
  window.addEventListener("resize", resize, options);
  rollButton.addEventListener("click", barrelRoll, options);

  hoops.forEach(({ model }, index) => { model.position.z = -13 - index * 12; });
  updateHud();
  resize();
  frame = requestAnimationFrame(animate);
  return () => {
    cancelAnimationFrame(frame);
    events.abort();
    finish.remove();
    geometry.dispose();
    confetti.material.dispose();
    sun.geometry.dispose();
    sun.material.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };
}
