export function makeUnicorn() {
  const canvas = document.createElement("canvas");
  canvas.width = 208;
  canvas.height = 168;
  canvas.setAttribute("aria-hidden", "true");
  const ink = "#563351";
  const art = canvas.getContext("2d")!;
  art.scale(2, 2);
  art.lineWidth = 2.4;
  art.lineJoin = "round";
  art.lineCap = "round";

  function stroke(fill: string) {
    art.fillStyle = fill;
    art.fill();
    art.strokeStyle = ink;
    art.stroke();
  }

  function path(start: [number, number], curves: number[][], color: string) {
    art.beginPath();
    art.moveTo(...start);
    for (const [a, b, c, d, e, f] of curves) art.bezierCurveTo(a, b, c, d, e, f);
    art.closePath();
    stroke(color);
  }

  function dot(x: number, y: number, size: number, color: string) {
    art.fillStyle = color;
    art.beginPath();
    art.arc(x, y, size, 0, Math.PI * 2);
    art.fill();
  }

  // Tail, back legs and shaded hooves.
  path([30, 39], [[13, 25, 11, 44, 20, 45], [5, 47, 8, 66, 24, 61], [27, 58, 33, 52, 33, 46]], "#bda8ef");
  for (const x of [33, 56]) {
    art.beginPath();
    if (art.roundRect) art.roundRect(x, 55, 10, 21, 3);
    else art.rect(x, 55, 10, 21);
    stroke("#d8c3ed");
  }
  // Body and front hooves.
  art.beginPath();
  art.ellipse(47, 51, 24, 15, 0.08, 0, Math.PI * 2);
  stroke("#fff6e8");
  for (const x of [31, 57]) {
    art.beginPath();
    if (art.roundRect) art.roundRect(x, 60, 10, 17, 4);
    else art.rect(x, 60, 10, 17);
    stroke("#fff6e8");
    art.fillStyle = "#bd9fe3";
    art.fillRect(x + 1, 70, 8, 5);
  }
  path([50, 44], [[46, 30, 49, 17, 64, 17], [71, 11, 79, 20, 74, 26],
    [87, 27, 93, 36, 90, 45], [87, 54, 69, 56, 62, 48]], "#fff6e8");
  path([54, 25], [[49, 26, 46, 34, 47, 43], [40, 44, 37, 39, 42, 31],
    [36, 24, 47, 17, 55, 17], [62, 9, 73, 14, 72, 21], [65, 19, 62, 29, 54, 25]], "#f48eaf");
  path([64, 19], [[60, 13, 59, 8, 61, 6], [66, 8, 70, 12, 69, 18]], "#fff6e8");
  path([71, 19], [[72, 14, 76, 5, 79, 4], [81, 8, 81, 15, 79, 22]], "#ffd575");
  art.strokeStyle = "#d28b6c";
  art.lineWidth = 1.2;
  art.beginPath();
  art.moveTo(74, 13);
  art.lineTo(80, 16);
  art.stroke();
  dot(75, 31, 3.1, ink);
  dot(76, 30, 1, "#fff");
  dot(80, 40, 4.2, "#f5a2b6");
  art.strokeStyle = ink;
  art.beginPath();
  art.moveTo(84, 43);
  art.quadraticCurveTo(87, 45, 90, 42);
  art.stroke();
  dot(44, 49, 3.1, "#ffcc70");
  dot(41, 53, 1.95, "#e99cb9");
  return canvas;
}
