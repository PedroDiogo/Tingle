import * as T from "three";

const INK = 0x3b2946;
const ink = new T.MeshBasicMaterial({ color: INK, side: T.BackSide });
const sphere = new T.SphereGeometry(1, 16, 12);
const box = new T.BoxGeometry(1, 1, 1);
const shade = new T.DataTexture(new Uint8Array([105, 169, 255]), 3, 1, T.RedFormat);
shade.needsUpdate = true;
const paints = new Map<number, T.MeshToonMaterial>();

export function paint(color: number) {
  let material = paints.get(color);
  if (!material) {
    material = new T.MeshToonMaterial({ color, gradientMap: shade });
    paints.set(color, material);
  }
  return material;
}

export function shape(geometry: T.BufferGeometry, color: number, x: number, y: number, z: number,
               sx: number, sy: number, sz: number, outline = true) {
  const mesh = new T.Mesh(geometry, paint(color));
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  if (outline) {
    const edge = new T.Mesh(geometry, ink);
    edge.scale.setScalar(1.045);
    mesh.add(edge);
  }
  return mesh;
}

export function makePlane() {
  const plane = new T.Group();
  plane.add(
    shape(sphere, 0xe95264, 0, 0, 0.02, 0.43, 0.38, 1.15),
    shape(sphere, 0xffbb55, 0, 0.16, -0.35, 0.36, 0.27, 0.65),
    shape(sphere, 0xf15e6a, 0, -0.13, -0.1, 1.58, 0.085, 0.39),
    shape(sphere, 0xffc553, 0, 0.46, -0.13, 1.52, 0.09, 0.33),
    shape(sphere, 0x6cd7c6, 0, 0.12, 0.78, 0.62, 0.055, 0.3),
    shape(sphere, 0xe95264, 0, 0.26, 0.91, 0.08, 0.34, 0.31),
  );
  for (const side of [-1, 1]) {
    plane.add(shape(box, 0x92505b, side * 0.9, 0.19, -0.06, 0.065, 0.53, 0.075));
  }

  const pilot = new T.Group();
  pilot.position.set(0, 0.69, 0.1);
  const head = new T.Group();
  head.rotation.y = Math.PI;
  pilot.add(
    shape(sphere, 0xe95264, 0, -0.22, 0, 0.32, 0.073, 0.32),
    head,
  );
  const scarf = shape(sphere, 0xe95264, 0, -0.22, 0.4, 0.07, 0.035, 0.35);
  pilot.add(scarf);
  head.add(
    shape(sphere, 0xf5bd7c, 0, 0.06, 0, 0.31, 0.3, 0.3),
    shape(sphere, 0xffe1a9, 0, -0.065, 0.22, 0.185, 0.115, 0.13),
    shape(sphere, INK, 0, -0.023, 0.33, 0.067, 0.045, 0.025, false),
  );
  const ears: T.Group[] = [];
  const eyes: T.Group[] = [];
  for (const side of [-1, 1]) {
    const ear = new T.Group();
    ear.position.set(side * 0.22, 0.17, 0.03);
    ear.add(shape(sphere, 0x9a5370, side * 0.08, -0.15, 0, 0.115, 0.245, 0.14));
    head.add(ear);
    ears.push(ear);
    const eye = new T.Group();
    eye.position.set(side * 0.115, 0.107, 0.245);
    eye.add(
      shape(sphere, 0xfff4dc, 0, 0, 0, 0.095, 0.084, 0.06),
      shape(sphere, INK, 0, 0, 0.05, 0.046, 0.051, 0.035, false),
      shape(sphere, 0xfffafa, -0.014, 0.018, 0.081, 0.015, 0.015, 0.01, false),
    );
    head.add(eye, shape(sphere, 0xf48a88, side * 0.184, -0.02, 0.236, 0.053, 0.03, 0.022, false));
    eyes.push(eye);
  }
  const grin = new T.Group();
  grin.position.set(0, -0.108, 0.322);
  grin.add(
    shape(sphere, INK, 0, 0, 0, 0.095, 0.049, 0.022, false),
    shape(sphere, 0xf88ca7, 0, -0.019, 0.015, 0.045, 0.02, 0.012, false),
  );
  head.add(grin);
  grin.visible = false;
  let t = 0;
  let glance = 0;
  let settle = 0;

  function lookBack(duration = 1.7) {
    glance = Math.max(glance, duration);
  }

  function animatePilot(dt: number, bank: number, excited = false) {
    t += dt;
    glance = Math.max(0, glance - dt);
    const facingBack = glance > 0;
    settle = T.MathUtils.lerp(settle, facingBack ? 1 : 0, 1 - Math.exp(-dt * 6.2));
    const steering = T.MathUtils.clamp(bank, -0.28, 0.28);
    head.rotation.y = Math.PI * (1 - settle) + steering * (1 - settle);
    head.rotation.x = Math.sin(t * 3.4) * 0.06 - settle * 0.11;
    head.rotation.z = -steering * 0.33 + settle * Math.sin(t * 6) * 0.12;
    scarf.rotation.y = Math.sin(t * 11) * 0.35 + steering;
    scarf.rotation.x = Math.sin(t * 9) * 0.18;
    const blink = Math.max(0.1, Math.min(1, Math.abs(t % 4.8 - 3.9) * 11));
    for (const eye of eyes) eye.scale.y = blink;
    for (const [i, ear] of ears.entries()) {
      ear.rotation.z = Math.sin(t * (excited ? 15 : 9) + i * 1.8) * (excited ? 0.26 : 0.13);
      ear.rotation.x = 0.17 + Math.sin(t * 7 + i) * 0.12;
    }
    grin.visible = settle > 0.62;
  }

  const propeller = new T.Group();
  propeller.position.set(0, 0, -1.15);
  propeller.add(
    shape(sphere, 0x784864, 0, 0, 0, 0.07, 0.59, 0.055),
    shape(sphere, 0xffc553, 0, 0, 0.015, 0.14, 0.14, 0.12),
  );
  plane.add(pilot, propeller);
  return { plane, propeller, animatePilot, lookBack };
}

const hoopGeometry = new T.TorusGeometry(1.36, 0.19, 9, 35);
const rimGeometry = new T.TorusGeometry(1.36, 0.075, 7, 35);
export function makeHoop() {
  const hoop = new T.Group();
  const body = shape(hoopGeometry, 0x40c8b2, 0, 0, 0, 1, 1, 1);
  const rim = shape(rimGeometry, 0xfff4d5, 0, 0, 0.17, 1, 1, 1, false);
  hoop.add(body, rim);
  for (let i = 0; i < 8; i++) {
    const angle = (i + 0.5) * Math.PI / 4;
    hoop.add(shape(box, 0xffe193, 1.36 * Math.cos(angle), 1.36 * Math.sin(angle),
      0.2, 0.095, 0.095, 0.07, false));
  }
  return { hoop, body };
}

const starGeometry = new T.ExtrudeGeometry(makeStar(), { depth: 0.15, bevelEnabled: false });
function makeStar() {
  const star = new T.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + i * Math.PI / 5;
    const r = i % 2 ? 0.48 : 1;
    const [x, y] = [r * Math.cos(angle), r * Math.sin(angle)];
    if (i) star.lineTo(x, y);
    else star.moveTo(x, y);
  }
  star.closePath();
  return star;
}

const balloonString = new T.TubeGeometry(new T.CatmullRomCurve3([
  new T.Vector3(0, -0.73, 0), new T.Vector3(-0.09, -0.93, 0),
  new T.Vector3(0.13, -1.1, 0),
]), 8, 0.018, 4);

export function makeBalloon(color: number) {
  const balloon = new T.Group();
  balloon.add(
    shape(sphere, color, 0, 0, 0, 0.59, 0.7, 0.54),
    shape(sphere, 0xfff5e5, -0.2, 0.21, 0.44, 0.1, 0.18, 0.022, false),
    shape(sphere, color, 0, -0.69, 0, 0.13, 0.09, 0.11),
    shape(starGeometry, 0xffed9d, 0.14, -1.2, 0.03, 0.19, 0.19, 0.28),
  );
  balloon.add(new T.Mesh(balloonString, paint(INK)));
  return balloon;
}

export function makeCloud() {
  const cloud = new T.Group();
  const puffs = [[-1.55, 0, 0.88], [-0.47, 0.38, 1.25], [0.62, 0.18, 1.05], [1.51, 0, 0.71]];
  for (const [x, y, scale] of puffs) {
    cloud.add(shape(sphere, 0xfff2dc, x, y, 0, scale, scale * 0.65, scale, false));
  }
  return cloud;
}

export function makeIsland(color: number) {
  const island = new T.Group();
  island.add(
    shape(sphere, 0xab6c88, 0, -0.65, 0, 3.5, 1.25, 2.3),
    shape(sphere, color, 0, 0, 0, 3.6, 0.74, 2.35),
    shape(sphere, 0x4daf9e, -1.0, 0.7, 0, 0.46, 0.94, 0.42),
    shape(sphere, 0x69c5a6, 1.3, 0.55, 0.2, 0.41, 0.77, 0.36),
    shape(starGeometry, 0xffd465, -1, 1.92, 0, 0.42, 0.42, 0.55),
  );
  return island;
}
