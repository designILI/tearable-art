const canvas = document.querySelector("#artCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
const resetButton = document.querySelector("#resetButton");
const layerStatus = document.querySelector("#layerStatus");

/*
  Replace these placeholder entries with your artwork files later.
  Example:
  { image: "assets/layers/my-painting-01.jpg", name: "First painting" }
*/
const layerSources = [
  { image: "assets/layers/layer-01.jpg", palette: ["#d9c4a0", "#7c725f", "#1a1714"], name: "Linen dusk" },
  { image: "assets/layers/layer-02.jpg", palette: ["#9fc9ca", "#4f7f84", "#111f24"], name: "Blue mineral" },
  { image: "assets/layers/layer-03.jpg", palette: ["#d7b2bc", "#965f70", "#24141b"], name: "Rose wash" },
  { image: "assets/layers/layer-04.jpg", palette: ["#becb90", "#65764d", "#141b13"], name: "Olive field" },
  { image: "assets/layers/layer-05.jpg", palette: ["#c9ac8f", "#8a5743", "#160f0c"], name: "Clay ember" },
];

const scratchCanvas = document.createElement("canvas");
const scratchCtx = scratchCanvas.getContext("2d");

const state = {
  width: 0,
  height: 0,
  dpr: 1,
  layers: [],
  activeLayer: 0,
  pointers: new Map(),
  tearing: false,
  pointer: { x: 0, y: 0 },
  head: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  lastHead: null,
  seam: [],
  edgePoints: [],
  brush: 42,
  tearPercent: 0,
  animationId: null,
};

function makeLayer(source, index) {
  const art = document.createElement("canvas");
  const mask = document.createElement("canvas");
  return {
    ...source,
    index,
    art,
    artCtx: art.getContext("2d"),
    mask,
    maskCtx: mask.getContext("2d"),
    imageElement: null,
    hidden: false,
  };
}

function setupLayers() {
  state.layers = layerSources.map(makeLayer);

  state.layers.forEach((layer) => {
    if (!layer.image) return;

    const image = new Image();
    image.onload = () => {
      layer.imageElement = image;
      paintLayer(layer);
      requestDraw();
    };
    image.onerror = () => {
      layer.imageElement = null;
      paintLayer(layer);
      requestDraw();
    };
    image.src = layer.image;
  });
}

function resizeCanvas() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.width = Math.floor(window.innerWidth);
  state.height = Math.floor(window.innerHeight);

  for (const target of [canvas, scratchCanvas]) {
    target.width = Math.floor(state.width * state.dpr);
    target.height = Math.floor(state.height * state.dpr);
  }

  canvas.style.width = `${state.width}px`;
  canvas.style.height = `${state.height}px`;
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  scratchCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

  state.layers.forEach((layer) => {
    for (const target of [layer.art, layer.mask]) {
      target.width = canvas.width;
      target.height = canvas.height;
    }
    layer.artCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    layer.maskCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    paintLayer(layer);
    resetMask(layer);
  });

  resetGesture();
  requestDraw();
}

function paintLayer(layer) {
  const layerCtx = layer.artCtx;
  layerCtx.clearRect(0, 0, state.width, state.height);

  if (layer.imageElement) {
    drawImageCover(layerCtx, layer.imageElement, state.width, state.height);
  } else {
    paintPlaceholder(layer);
  }

  addPaperFibers(layerCtx, layer.index);
  addVignette(layerCtx);
}

function paintPlaceholder(layer) {
  const [light, mid, dark] = layer.palette;
  const gradient = layer.artCtx.createLinearGradient(0, 0, state.width, state.height);
  gradient.addColorStop(0, light);
  gradient.addColorStop(0.46, mid);
  gradient.addColorStop(1, dark);
  layer.artCtx.fillStyle = gradient;
  layer.artCtx.fillRect(0, 0, state.width, state.height);

  layer.artCtx.save();
  layer.artCtx.globalAlpha = 0.34;
  for (let i = 0; i < 18; i += 1) {
    const x = state.width * noise01(i * 13.71 + layer.index * 7.9);
    const y = state.height * noise01(i * 5.31 + layer.index * 11.4);
    const radius = Math.max(state.width, state.height) * (0.12 + noise01(i * 19.1) * 0.18);
    const wash = layer.artCtx.createRadialGradient(x, y, 0, x, y, radius);
    wash.addColorStop(0, "rgba(255, 250, 235, 0.42)");
    wash.addColorStop(1, "rgba(255, 250, 235, 0)");
    layer.artCtx.fillStyle = wash;
    layer.artCtx.beginPath();
    layer.artCtx.arc(x, y, radius, 0, Math.PI * 2);
    layer.artCtx.fill();
  }
  layer.artCtx.restore();

  layer.artCtx.save();
  layer.artCtx.globalAlpha = 0.22;
  layer.artCtx.strokeStyle = "#fff7e6";
  layer.artCtx.lineWidth = 1;
  for (let i = 0; i < 42; i += 1) {
    const y = (state.height / 41) * i;
    layer.artCtx.beginPath();
    layer.artCtx.moveTo(-40, y);
    for (let x = -40; x < state.width + 80; x += 52) {
      const lift = Math.sin(x * 0.011 + i * 0.77 + layer.index) * 9;
      layer.artCtx.lineTo(x, y + lift);
    }
    layer.artCtx.stroke();
  }
  layer.artCtx.restore();
}

function drawImageCover(targetCtx, image, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  targetCtx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function addPaperFibers(targetCtx, seed) {
  targetCtx.save();
  targetCtx.globalAlpha = 0.06;
  for (let i = 0; i < 7000; i += 1) {
    const x = noise01(i * 16.93 + seed * 40.1) * state.width;
    const y = noise01(i * 8.17 + seed * 91.4) * state.height;
    const warm = 205 + Math.floor(noise01(i + seed) * 50);
    targetCtx.fillStyle = `rgba(${warm}, ${warm - 8}, ${warm - 24}, 0.45)`;
    targetCtx.fillRect(x, y, 1, noise01(i * 0.41) > 0.72 ? 2 : 1);
  }
  targetCtx.restore();
}

function addVignette(targetCtx) {
  const gradient = targetCtx.createRadialGradient(
    state.width / 2,
    state.height / 2,
    Math.min(state.width, state.height) * 0.18,
    state.width / 2,
    state.height / 2,
    Math.max(state.width, state.height) * 0.74,
  );
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.38)");
  targetCtx.fillStyle = gradient;
  targetCtx.fillRect(0, 0, state.width, state.height);
}

function resetMask(layer) {
  layer.hidden = false;
  layer.maskCtx.globalCompositeOperation = "source-over";
  layer.maskCtx.clearRect(0, 0, state.width, state.height);
  layer.maskCtx.fillStyle = "#fff";
  layer.maskCtx.fillRect(0, 0, state.width, state.height);
}

function pointerFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function beginPointer(event) {
  if (state.activeLayer >= state.layers.length - 1) return;

  const point = pointerFromEvent(event);
  state.pointers.set(event.pointerId, point);
  state.pointer = averagePointers();
  state.head = { ...state.pointer };
  state.velocity = { x: 0, y: 0 };
  state.lastHead = null;
  state.seam = [];
  state.edgePoints = [];
  state.tearing = true;
  state.brush = clamp(Math.min(state.width, state.height) * 0.055, 28, 58);
  canvas.classList.add("is-tearing");
  canvas.setPointerCapture(event.pointerId);
  requestDraw();
}

function movePointer(event) {
  if (!state.pointers.has(event.pointerId)) return;
  state.pointers.set(event.pointerId, pointerFromEvent(event));
  state.pointer = averagePointers();

  // Pointer streams can arrive faster than paint frames, especially in tests
  // and on high-refresh devices. Advance a couple of physics steps here so
  // the tear follows fast gestures instead of waiting for the next frame.
  if (state.tearing) {
    advanceSpring();
    carveBetweenHeads();
    advanceSpring();
    carveBetweenHeads();
    requestDraw();
  }
}

function endPointer(event) {
  state.pointers.delete(event.pointerId);
  if (state.pointers.size > 0) {
    state.pointer = averagePointers();
    return;
  }

  state.tearing = false;
  for (let i = 0; i < 8; i += 1) {
    advanceSpring();
    carveBetweenHeads();
    if (Math.hypot(state.pointer.x - state.head.x, state.pointer.y - state.head.y) < 6) break;
  }
  canvas.classList.remove("is-tearing");
  maybeDropLayer();
  requestDraw();
}

function averagePointers() {
  let x = 0;
  let y = 0;
  state.pointers.forEach((point) => {
    x += point.x;
    y += point.y;
  });
  return {
    x: x / state.pointers.size,
    y: y / state.pointers.size,
  };
}

function animationLoop() {
  state.animationId = null;

  if (state.tearing) {
    advanceSpring();
    carveBetweenHeads();
  }

  drawScene();

  if (state.tearing) requestDraw();
}

function requestDraw() {
  if (state.animationId) return;
  state.animationId = requestAnimationFrame(animationLoop);
}

function advanceSpring() {
  const stiffness = 0.23;
  const damping = 0.72;
  const dx = state.pointer.x - state.head.x;
  const dy = state.pointer.y - state.head.y;

  state.velocity.x = (state.velocity.x + dx * stiffness) * damping;
  state.velocity.y = (state.velocity.y + dy * stiffness) * damping;
  state.head.x += state.velocity.x;
  state.head.y += state.velocity.y;

  const speed = Math.hypot(state.velocity.x, state.velocity.y);
  state.brush = clamp(state.brush * 0.84 + (32 + Math.min(speed * 1.1, 42)) * 0.16, 26, 76);
}

function carveBetweenHeads() {
  if (!state.lastHead) {
    state.lastHead = { ...state.head };
    cutOrganicHole(state.head, state.brush * 0.55);
    return;
  }

  const distance = Math.hypot(state.head.x - state.lastHead.x, state.head.y - state.lastHead.y);
  const steps = Math.max(1, Math.ceil(distance / 7));

  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const point = {
      x: lerp(state.lastHead.x, state.head.x, t),
      y: lerp(state.lastHead.y, state.head.y, t),
    };
    cutOrganicHole(point, state.brush * (0.72 + noise01(point.x * 0.02 + point.y * 0.01) * 0.42));
    addSeamPoint(point);
  }

  state.lastHead = { ...state.head };
}

function cutOrganicHole(point, radius) {
  const layer = state.layers[state.activeLayer];
  const maskCtx = layer.maskCtx;
  const count = 22;

  maskCtx.save();
  maskCtx.globalCompositeOperation = "destination-out";
  maskCtx.beginPath();

  for (let i = 0; i <= count; i += 1) {
    const angle = (Math.PI * 2 * i) / count;
    const wobble = 0.7 + noise01(point.x * 0.021 + point.y * 0.017 + i * 1.7) * 0.7;
    const r = radius * wobble;
    const x = point.x + Math.cos(angle) * r;
    const y = point.y + Math.sin(angle) * r;
    if (i === 0) maskCtx.moveTo(x, y);
    else maskCtx.lineTo(x, y);
  }

  maskCtx.closePath();
  maskCtx.fill();

  maskCtx.globalAlpha = 0.42;
  maskCtx.lineCap = "round";
  maskCtx.lineJoin = "round";
  maskCtx.lineWidth = radius * 0.52;
  maskCtx.strokeStyle = "#000";
  maskCtx.beginPath();
  maskCtx.moveTo(point.x - radius * 0.28, point.y);
  maskCtx.lineTo(point.x + radius * 0.28, point.y);
  maskCtx.stroke();
  maskCtx.restore();

  state.edgePoints.push({
    x: point.x,
    y: point.y,
    r: radius,
    n: noise01(point.x * 0.033 + point.y * 0.027),
  });
  if (state.edgePoints.length > 260) state.edgePoints.splice(0, state.edgePoints.length - 260);
}

function addSeamPoint(point) {
  const previous = state.seam[state.seam.length - 1] || point;
  const dx = point.x - previous.x;
  const dy = point.y - previous.y;
  const length = Math.hypot(dx, dy) || 1;
  const jitter = (noise01(point.x * 0.04 + point.y * 0.03) - 0.5) * state.brush * 0.45;

  state.seam.push({
    x: point.x + (-dy / length) * jitter,
    y: point.y + (dx / length) * jitter,
    width: state.brush * (0.85 + noise01(point.x * 0.015) * 0.55),
    age: 0,
  });

  if (state.seam.length > 90) state.seam.splice(0, state.seam.length - 90);
}

function maybeDropLayer() {
  const layer = state.layers[state.activeLayer];
  if (!layer || state.activeLayer >= state.layers.length - 1) {
    resetGesture();
    return;
  }

  state.tearPercent = estimateRevealed(layer);
  if (state.tearPercent > 0.38 || traveledSeamLength() > Math.max(state.width, state.height) * 1.15) {
    layer.hidden = true;
    state.activeLayer += 1;
    updateStatus();
  }

  resetGesture();
}

function estimateRevealed(layer) {
  const sampleSize = 90;
  const data = layer.maskCtx.getImageData(0, 0, canvas.width, canvas.height).data;
  let transparent = 0;
  let samples = 0;
  const stride = Math.max(1, Math.floor((canvas.width * canvas.height) / sampleSize ** 2));

  for (let i = 3; i < data.length; i += 4 * stride) {
    samples += 1;
    if (data[i] < 20) transparent += 1;
  }

  return samples ? transparent / samples : 0;
}

function traveledSeamLength() {
  let total = 0;
  for (let i = 1; i < state.seam.length; i += 1) {
    total += Math.hypot(state.seam[i].x - state.seam[i - 1].x, state.seam[i].y - state.seam[i - 1].y);
  }
  return total;
}

function drawScene() {
  ctx.clearRect(0, 0, state.width, state.height);
  ctx.fillStyle = "#0f0e0c";
  ctx.fillRect(0, 0, state.width, state.height);

  for (let i = state.layers.length - 1; i >= 0; i -= 1) {
    const layer = state.layers[i];
    if (layer.hidden) continue;

    scratchCtx.clearRect(0, 0, state.width, state.height);
    scratchCtx.globalCompositeOperation = "source-over";
    scratchCtx.drawImage(layer.art, 0, 0, state.width, state.height);
    scratchCtx.globalCompositeOperation = "destination-in";
    scratchCtx.drawImage(layer.mask, 0, 0, state.width, state.height);
    scratchCtx.globalCompositeOperation = "source-over";
    ctx.drawImage(scratchCanvas, 0, 0, state.width, state.height);

    if (i === state.activeLayer && i < state.layers.length - 1) {
      drawTornEdge();
      if (state.tearing) drawLiftedFlap(layer);
    }
  }
}

function drawTornEdge() {
  if (!state.edgePoints.length) return;

  ctx.save();
  for (const point of state.edgePoints) {
    const alpha = 0.05 + point.n * 0.09;
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(point.x + 7, point.y + 10, point.r * 0.74, point.r * 0.42, point.n * Math.PI, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 244, 220, ${0.08 + point.n * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(point.x - 2, point.y - 2, point.r * 0.18, point.r * 0.1, point.n * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawLiftedFlap(layer) {
  if (state.seam.length < 3) return;

  const path = state.seam.slice(-34);
  const normal = getRecentNormal(path);
  const lift = clamp(Math.hypot(state.velocity.x, state.velocity.y) * 1.8 + 30, 34, 115);
  const left = [];
  const right = [];

  path.forEach((point, index) => {
    const curl = Math.sin((index / Math.max(1, path.length - 1)) * Math.PI) * lift;
    const rough = (noise01(point.x * 0.08 + point.y * 0.06) - 0.5) * point.width * 0.55;
    left.push({
      x: point.x - normal.x * (point.width * 0.4 + rough),
      y: point.y - normal.y * (point.width * 0.4 + rough),
    });
    right.push({
      x: point.x + normal.x * (point.width * 0.38 + curl),
      y: point.y + normal.y * (point.width * 0.38 + curl),
    });
  });

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.34)";
  ctx.shadowBlur = 34;
  ctx.shadowOffsetX = normal.x * 18;
  ctx.shadowOffsetY = normal.y * 22;
  ctx.fillStyle = "rgba(255, 246, 224, 0.48)";
  tracePolygon(left, right);
  ctx.fill();
  ctx.restore();

  ctx.save();
  tracePolygon(left, right);
  ctx.clip();
  ctx.globalAlpha = 0.96;
  ctx.translate(normal.x * lift * 0.22, normal.y * lift * 0.22);
  ctx.rotate((normal.x - normal.y) * 0.015);
  ctx.drawImage(layer.art, 0, 0, state.width, state.height);
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = "rgba(255, 244, 222, 0.18)";
  ctx.fillRect(0, 0, state.width, state.height);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(255, 249, 235, 0.42)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  left.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
  ctx.restore();
}

function tracePolygon(left, right) {
  ctx.beginPath();
  left.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  for (let i = right.length - 1; i >= 0; i -= 1) {
    ctx.lineTo(right[i].x, right[i].y);
  }
  ctx.closePath();
}

function getRecentNormal(path) {
  const first = path[0];
  const last = path[path.length - 1];
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const length = Math.hypot(dx, dy) || 1;
  let normal = { x: -dy / length, y: dx / length };
  const toPointer = {
    x: state.pointer.x - last.x,
    y: state.pointer.y - last.y,
  };
  if (normal.x * toPointer.x + normal.y * toPointer.y < 0) {
    normal = { x: -normal.x, y: -normal.y };
  }
  return normal;
}

function resetGesture() {
  state.tearing = false;
  state.pointers.clear();
  state.lastHead = null;
  state.seam = [];
  state.edgePoints = [];
  state.velocity = { x: 0, y: 0 };
  canvas.classList.remove("is-tearing");
}

function resetArtwork() {
  state.activeLayer = 0;
  state.layers.forEach(resetMask);
  resetGesture();
  updateStatus();
  requestDraw();
}

function updateStatus() {
  layerStatus.textContent = `Layer ${Math.min(state.activeLayer + 1, state.layers.length)} of ${state.layers.length}`;
}

function noise01(value) {
  return fract(Math.sin(value * 127.1 + 311.7) * 43758.5453123);
}

function fract(value) {
  return value - Math.floor(value);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

window.addEventListener("resize", resizeCanvas);
canvas.addEventListener("pointerdown", beginPointer);
canvas.addEventListener("pointermove", movePointer);
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
resetButton.addEventListener("click", resetArtwork);

setupLayers();
resizeCanvas();
