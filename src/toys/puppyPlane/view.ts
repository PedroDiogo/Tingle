import * as T from "three";
import { makeCloud, makeIsland, makePlane, paint, shape } from "../skyCircus/scenery";
import type { Obstacle } from "./obstacles";
import type { Background } from "./background";

const orb = new T.SphereGeometry(1, 18, 14);
const box = new T.BoxGeometry(1, 1, 1);
const rod = new T.CylinderGeometry(1, 1, 1, 8);
const ridge = new T.ConeGeometry(1, 1, 6);
ridge.rotateY(Math.PI / 6);
const ink = 0x543853;

function link(group: T.Group, from: T.Vector3, to: T.Vector3, radius: number, color: number) {
  const beam = new T.Mesh(rod, paint(color));
  beam.position.copy(from).lerp(to, 0.5);
  const span = to.clone().sub(from);
  beam.scale.set(radius, span.length(), radius);
  beam.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), span.normalize());
  group.add(beam);
}

function balloonModel(art: Extract<Obstacle["art"], { kind: "balloon" }>) {
  const group = new T.Group();
  const r = art.radius;
  group.add(
    shape(orb, art.color, 0, 0, 0, r, r * 1.1, r * 0.82),
    shape(orb, art.accent, 0, 0, 1, r * 0.42, r * 1.105, r * 0.835, false),
    shape(orb, 0xfff7dd, -r * 0.38, r * 0.33, r * 0.7, r * 0.13, r * 0.18, r * 0.075, false),
    shape(box, 0xd59669, 0, -r * 1.64, 0, r * 0.61, r * 0.49, r * 0.51),
    shape(box, 0xffe49b, 0, -r * 1.61, r * 0.27, r * 0.35, r * 0.22, 1.6, false),
  );
  for (const side of [-1, 1]) {
    link(group, new T.Vector3(side * r * 0.57, -r * 0.82, r * 0.19),
      new T.Vector3(side * r * 0.25, -r * 1.47, r * 0.19), 1.25, ink);
  }
  return group;
}

function mountainModel(art: Extract<Obstacle["art"], { kind: "mountain" }>) {
  const group = new T.Group();
  const height = art.height;
  group.add(
    shape(ridge, 0x91ceb2, art.skew * 0.35, height / 2, -34, art.halfWidth * 1.13, height, 78),
    shape(ridge, 0xfff6df, art.skew * 0.35, height * 0.865, -32, art.halfWidth * 0.31, height * 0.28, 23),
  );
  group.rotation.y = 0.12;
  return group;
}

function birdModel() {
  const group = new T.Group();
  group.add(
    shape(orb, 0xb394e6, 0, 0, 0, 11, 7, 7),
    shape(orb, 0xffca73, 11, 1, 2, 5, 2, 3),
    shape(orb, ink, 5, 3, 6, 2.4, 2.4, 1.5, false),
  );
  for (const side of [-1, 1]) {
    const wing = new T.Group();
    wing.position.z = side * 3;
    wing.add(shape(orb, 0x8b68c3, -4, 0, side * 8, 10, 2.7, 10));
    group.add(wing);
  }
  return group;
}

function mailboxModel() {
  const group = new T.Group();
  const cloud = makeCloud();
  cloud.scale.set(23, 18, 20);
  cloud.position.set(0, -25, -18);
  const boxGroup = new T.Group();
  boxGroup.rotation.y = -0.3;
  boxGroup.add(
    shape(box, 0xb37a68, 0, -15, 0, 10, 49, 12),
    shape(box, 0xed826d, 0, 9, 0, 52, 26, 32),
    shape(orb, 0xf7a780, 0, 20, 0, 26, 12, 16),
    shape(box, 0xffdc76, 0, 10, 17, 29, 16, 3),
    shape(box, 0xffcb56, 27, 26, 4, 4, 26, 5),
    shape(box, 0xea7080, 34, 36, 4, 15, 8, 5),
  );
  link(boxGroup, new T.Vector3(-13, 17, 19), new T.Vector3(0, 8, 19), 1.3, ink);
  link(boxGroup, new T.Vector3(0, 8, 19), new T.Vector3(13, 17, 19), 1.3, ink);
  group.add(cloud, boxGroup);
  return group;
}

interface SideFlightFrame {
  plane: { x: number; y: number; vx: number; vy: number; crashing: boolean; rotation: number };
  scale: number;
  speed: number;
  cargo: boolean;
  mailbox: { x: number; y: number; visible: boolean };
  obstacles: Obstacle[];
}

export function createSideFlightView(background: Background, onLost: () => void) {
  const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const canvas = renderer.domElement;
  canvas.className = "side-flight-webgl";
  canvas.setAttribute("aria-hidden", "true");
  canvas.addEventListener("webglcontextlost", onLost);
  document.body.appendChild(canvas);

  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(0, 1, 1, 0, 0.1, 1700);
  camera.position.z = 750;
  const light = new T.DirectionalLight(0xffeddf, 2.3);
  light.position.set(-2, 6, 7);
  scene.add(light, new T.HemisphereLight(0xfff7ea, 0xa999d2, 1.7));
  const { plane, propeller, animatePilot } = makePlane();
  const planePosition = new T.Group();
  planePosition.add(plane);
  scene.add(planePosition);
  const mail = mailboxModel();
  scene.add(mail);
  const parcel = shape(box, 0xffd566, 0, 0.26, 0.63, 0.42, 0.27, 0.36);
  parcel.add(shape(box, 0xfff0ae, 0, 0.505, 0, 0.25, 0.02, 1.01, false));
  plane.add(parcel);

  const clouds = Array.from({ length: 9 }, () => {
    const model = makeCloud();
    scene.add(model);
    return model;
  });
  const islands = Array.from({ length: 3 }, (_, i) => {
    const island = makeIsland([0x98cfb5, 0x9fbae4, 0xc3b3e8][i]);
    island.scale.setScalar(25 + 5 * i);
    island.rotation.y = 0.35;
    scene.add(island);
    return island;
  });
  const obstacleModels = new Map<Obstacle, T.Group>();
  let width = 1;
  let height = 1;
  let clock = 0;
  let angle = -2.08;
  let scroll = 0;

  function resize(w: number, h: number) {
    width = w;
    height = h;
    renderer.setSize(w, h, false);
    camera.right = w;
    camera.top = h;
    camera.updateProjectionMatrix();
  }

  return {
    resize,
    draw(dt: number, frame: SideFlightFrame) {
      clock += dt;
      const flight = frame.plane;
      const turn = -2.08 + T.MathUtils.clamp(flight.vx / 2000, -0.13, 0.13);
      angle = T.MathUtils.lerp(angle, turn, 1 - Math.exp(-dt * 5));
      planePosition.position.set(flight.x, height - flight.y, 100);
      planePosition.rotation.z = -flight.rotation;
      plane.rotation.y = angle;
      plane.rotation.x = Math.sin(clock * 3) * 0.07 + T.MathUtils.clamp(flight.vy / 2500, -0.13, 0.13);
      plane.scale.setScalar(69 * frame.scale);
      propeller.rotation.z += dt * (frame.speed > 150 ? 34 : 23);
      parcel.visible = frame.cargo;
      animatePilot(dt, -flight.vy / 1100, frame.speed > 190 || flight.crashing);
      mail.visible = frame.mailbox.visible;
      mail.position.set(frame.mailbox.x, height - frame.mailbox.y, 40);
      mail.scale.setScalar(Math.min(1, width / 410));

      background.forEachCloud((x, y, scale, i) => {
        const cloud = clouds[i];
        cloud.position.set(x, height - y, -90 - i * 19);
        cloud.scale.set(29 * scale, 25 * scale, 25 * scale);
        cloud.rotation.y = 0.13 * Math.sin(i * 4);
      });
      scroll += frame.speed * dt * 0.22;
      const span = width + 430;
      for (const [i, island] of islands.entries()) {
        const lane = (span * (1 + i / 3) - scroll % span) % span - 140;
        island.position.set(lane, height * (0.12 + i * 0.059), -350 - i * 50);
      }

      const live = new Set(frame.obstacles);
      for (const [obstacle, model] of obstacleModels) {
        if (live.has(obstacle)) continue;
        scene.remove(model);
        obstacleModels.delete(obstacle);
      }
      for (const obstacle of frame.obstacles) {
        let model = obstacleModels.get(obstacle);
        if (!model) {
          const art = obstacle.art;
          model = art.kind === "balloon" ? balloonModel(art)
            : art.kind === "mountain" ? mountainModel(art) : birdModel();
          obstacleModels.set(obstacle, model);
          scene.add(model);
        }
        model.position.set(obstacle.x, height - obstacle.y, 0);
        if (obstacle.art.kind === "balloon") model.rotation.y = Math.sin(clock * 1.7 + obstacle.x * 0.02) * 0.35;
        if (obstacle.art.kind === "bird") {
          model.children[3].rotation.x = Math.sin(clock * 15) * 0.9;
          model.children[4].rotation.x = -model.children[3].rotation.x;
        }
      }
      renderer.render(scene, camera);
    },
    destroy() {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.remove();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
