const canvas = document.querySelector("#artCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
const scratchCanvas = document.createElement("canvas");
const scratchCtx = scratchCanvas.getContext("2d");
const resetButton = document.querySelector("#resetButton");
const layerStatus = document.querySelector("#layerStatus");

/*
  Replace these placeholder entries with your artwork files later.
  Example:
  { image: "assets/layers/my-painting-01.jpg", name: "First painting" }
*/
const layerSources = [
  { palette: ["#d7c4a7", "#7f6e59", "#26231f"], name: "Linen dusk" },
  { palette: ["#aec6c2", "#5f7f7c", "#172224"], name: "Blue mineral" },
  { palette: ["#dac2c5", "#9f6f7c", "#24171c"], name: "Rose wash" },
  { palette: ["#c8cc9c", "#6f7650", "#181d16"], name: "Olive field" },
  { palette: ["#c9b598", "#885f4c", "#18120f"], name: "Clay ember" },
];

const state = {
  width: 0,
  height: 0,
  dpr: 1,
  layers: [],
  activeLayer: 0,
  drawing: false,
  lastPoint: null,
  revealAmount: 0,
  pointerVelocity: 0,
  edgePoints: [],
};

function createLayer(source, index) {
  const art = document.createElement("canvas");
  const mask = document.createElement("canvas");
  const artCtx = art.getContext("2d");
  const maskCtx = mask.getContext("2d");

  return {
    ...source,
    index,
    art,
    artCtx,
    mask,
    maskCtx,
    imageElement: null,
    isComplete: false,
  };
}

function setupLayers() {
  state.layers = layerSources.map(createLayer);

  state.layers.forEach((layer) => {
    if (!layer.image) return;

    const img = new Image();
    img.onload = () => {
      layer.imageElement = img;
      paintLayer(layer);
      drawScene();
    };
    img.src = layer.image;
  });
}

function resizeCanvas() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.width = Math.floor(window.innerWidth);
  state.height = Math.floor(window.innerHeight);

  canvas.width = Math.floor(state.width * state.dpr);
  canvas.height = Math.floor(state.height * state.dpr);
  scratchCanvas.width = canvas.width;
  scratchCanvas.height = canvas.height;
  canvas.style.width = `${state.width}px`;
  canvas.style.height = `${state.height}px`;
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  scratchCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

  state.layers.forEach((layer) => {
    layer.art.width = canvas.width;
    layer.art.height = canvas.height;
    layer.mask.width = canvas.width;
    layer.mask.height = canvas.height;
    layer.artCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    layer.maskCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    paintLayer(layer);
    resetMask(layer);
  });

  drawScene();
}

function paintLayer(layer) {
  const { artCtx: layerCtx } = layer;
  layerCtx.clearRect(0, 0, state.width, state.height);

  if (layer.imageElement) {
    drawImageCover(layerCtx, layer.imageElement, state.width, state.height);
  } else {
    paintPlaceholder(layer);
  }

  addPaperGrain(layerCtx, layer.index);
  addSubtleVignette(layerCtx);
}

function paintPlaceholder(layer) {
  const [light, mid, dark] = layer.palette;
  const gradient = layer.artCtx.createRadialGradient(
    state.width * (0.24 + layer.index * 0.09),
    state.height * (0.22 + layer.index * 0.04),
    state.width * 0.08,
    state.width * 0.58,
    state.height * 0.68,
    Math.max(state.width, state.height) * 0.72,
  );
  gradient.addColorStop(0, light);
  gradient.addColorStop(0.48, mid);
  gradient.addColorStop(1, dark);

  layer.artCtx.fillStyle = gradient;
  layer.artCtx.fillRect(0, 0, state.width, state.height);

  layer.artCtx.save();
  layer.artCtx.globalAlpha = 0.28;
  for (let i = 0; i < 22; i += 1) {
    const x = ((i * 173 + layer.index * 97) % state.width) - state.width * 0.1;
    const y = ((i * 211 + layer.index * 131) % state.height) - state.height * 0.1;
    const radius = Math.max(state.width, state.height) * (0.12 + ((i % 5) * 0.025));
    const wash = layer.artCtx.createRadialGradient(x, y, 0, x, y, radius);
    wash.addColorStop(0, "rgba(255, 255, 255, 0.38)");
    wash.addColorStop(1, "rgba(255, 255, 255, 0)");
    layer.artCtx.fillStyle = wash;
    layer.artCtx.beginPath();
    layer.artCtx.arc(x, y, radius, 0, Math.PI * 2);
    layer.artCtx.fill();
  }
  layer.artCtx.restore();

  layer.artCtx.save();
  layer.artCtx.globalAlpha = 0.18;
  layer.artCtx.strokeStyle = "#fff9ec";
  layer.artCtx.lineWidth = 1;
  for (let i = 0; i < 34; i += 1) {
    const y = (state.height / 33) * i + Math.sin(i + layer.index) * 11;
    layer.artCtx.beginPath();
    layer.artCtx.moveTo(-20, y);
    for (let x = -20; x <= state.width + 20; x += 70) {
      layer.artCtx.lineTo(x, y + Math.sin(x * 0.012 + i + layer.index) * 12);
    }
    layer.artCtx.stroke();
  }
  layer.artCtx.restore();
}

function drawImageCover(layerCtx, img, width, height) {
  const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
  const drawWidth = img.naturalWidth * scale;
  const drawHeight = img.naturalHeight * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  layerCtx.drawImage(img, x, y, drawWidth, drawHeight);
}

function addPaperGrain(layerCtx, seed) {
  layerCtx.save();
  layerCtx.globalAlpha = 0.08;
  for (let i = 0; i < 8500; i += 1) {
    const x = (Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453) % 1;
    const y = (Math.sin(i * 4.1414 + seed * 19.19) * 24634.6345) % 1;
    const alpha = 0.18 + ((i + seed) % 7) * 0.05;
    layerCtx.fillStyle = `rgba(255, 250, 238, ${alpha})`;
    layerCtx.fillRect(Math.abs(x) * state.width, Math.abs(y) * state.height, 1, 1);
  }
  layerCtx.restore();
}

function addSubtleVignette(layerCtx) {
  const vignette = layerCtx.createRadialGradient(
    state.width / 2,
    state.height / 2,
    Math.min(state.width, state.height) * 0.22,
    state.width / 2,
    state.height / 2,
    Math.max(state.width, state.height) * 0.72,
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.34)");
  layerCtx.fillStyle = vignette;
  layerCtx.fillRect(0, 0, state.width, state.height);
}

function resetMask(layer) {
  layer.isComplete = false;
  layer.maskCtx.globalCompositeOperation = "source-over";
  layer.maskCtx.clearRect(0, 0, state.width, state.height);
  layer.maskCtx.fillStyle = "#fff";
  layer.maskCtx.fillRect(0, 0, state.width, state.height);
}

function getPointerPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function beginTear(event) {
  if (state.activeLayer >= state.layers.length - 1) return;

  state.drawing = true;
  state.lastPoint = getPointerPoint(event);
  state.pointerVelocity = 0;
  state.edgePoints = [];
  tearAtPoint(state.lastPoint, 20);
}

function continueTear(event) {
  if (!state.drawing || state.activeLayer >= state.layers.length - 1) return;

  const point = getPointerPoint(event);
  const last = state.lastPoint || point;
  const distance = Math.hypot(point.x - last.x, point.y - last.y);
  state.pointerVelocity = state.pointerVelocity * 0.72 + distance * 0.28;

  const steps = Math.max(1, Math.ceil(distance / 8));
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const x = last.x + (point.x - last.x) * t;
    const y = last.y + (point.y - last.y) * t;
    tearAtPoint({ x, y }, 18 + Math.min(state.pointerVelocity * 0.55, 28));
  }

  state.lastPoint = point;
  drawScene();
}

function endTear() {
  state.drawing = false;
  state.lastPoint = null;
  state.edgePoints = [];

  const current = state.layers[state.activeLayer];
  if (!current || state.activeLayer >= state.layers.length - 1) return;

  if (estimateRevealed(current) > 0.64) {
    current.isComplete = true;
    state.activeLayer += 1;
  }

  updateStatus();
  drawScene();
}

function tearAtPoint(point, radius) {
  const layer = state.layers[state.activeLayer];
  const maskCtx = layer.maskCtx;
  const roughness = 0.42;
  const points = [];
  const count = 18;

  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count;
    const wobble = 1 + Math.sin(i * 2.7 + point.x * 0.019 + point.y * 0.013) * roughness;
    const r = radius * wobble * (0.82 + ((i % 4) * 0.06));
    points.push({
      x: point.x + Math.cos(angle) * r,
      y: point.y + Math.sin(angle) * r,
    });
  }

  maskCtx.save();
  maskCtx.globalCompositeOperation = "destination-out";
  maskCtx.beginPath();
  maskCtx.moveTo(points[0].x, points[0].y);
  points.forEach((p, i) => {
    const next = points[(i + 1) % points.length];
    maskCtx.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2);
  });
  maskCtx.closePath();
  maskCtx.fill();

  maskCtx.globalAlpha = 0.58;
  maskCtx.lineWidth = Math.max(18, radius * 1.3);
  maskCtx.lineCap = "round";
  maskCtx.lineJoin = "round";
  maskCtx.strokeStyle = "#000";
  if (state.lastPoint) {
    maskCtx.beginPath();
    maskCtx.moveTo(state.lastPoint.x, state.lastPoint.y);
    maskCtx.lineTo(point.x, point.y);
    maskCtx.stroke();
  }
  maskCtx.restore();

  state.edgePoints.push(...points.filter((_, index) => index % 3 === 0));
  if (state.edgePoints.length > 140) state.edgePoints.splice(0, state.edgePoints.length - 140);
}

function estimateRevealed(layer) {
  const sample = layer.maskCtx.getImageData(0, 0, canvas.width, canvas.height).data;
  let transparent = 0;
  const stride = 48;

  for (let i = 3; i < sample.length; i += 4 * stride) {
    if (sample[i] < 30) transparent += 1;
  }

  return transparent / (sample.length / 4 / stride);
}

function drawScene() {
  ctx.clearRect(0, 0, state.width, state.height);
  ctx.fillStyle = "#100f0d";
  ctx.fillRect(0, 0, state.width, state.height);

  for (let i = state.layers.length - 1; i >= 0; i -= 1) {
    const layer = state.layers[i];
    if (layer.isComplete) continue;

    ctx.save();
    scratchCtx.clearRect(0, 0, state.width, state.height);
    scratchCtx.globalCompositeOperation = "source-over";
    scratchCtx.drawImage(layer.art, 0, 0, state.width, state.height);
    scratchCtx.globalCompositeOperation = "destination-in";
    scratchCtx.drawImage(layer.mask, 0, 0, state.width, state.height);
    scratchCtx.globalCompositeOperation = "source-over";
    ctx.drawImage(scratchCanvas, 0, 0, state.width, state.height);
    ctx.restore();

    if (i === state.activeLayer && i < state.layers.length - 1) {
      drawTornDepth();
    }
  }
}

function drawTornDepth() {
  if (!state.edgePoints.length) return;

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  state.edgePoints.forEach((point, index) => {
    const fade = index / state.edgePoints.length;
    const shadowSize = 18 + fade * 18;

    ctx.beginPath();
    ctx.fillStyle = `rgba(0, 0, 0, ${0.16 * fade})`;
    ctx.arc(point.x + 7, point.y + 10, shadowSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 247, 228, ${0.17 * fade})`;
    ctx.arc(point.x - 2, point.y - 2, 4 + fade * 4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function updateStatus() {
  layerStatus.textContent = `Layer ${Math.min(state.activeLayer + 1, state.layers.length)} of ${state.layers.length}`;
}

function resetArtwork() {
  state.activeLayer = 0;
  state.drawing = false;
  state.lastPoint = null;
  state.edgePoints = [];
  state.layers.forEach(resetMask);
  updateStatus();
  drawScene();
}

window.addEventListener("resize", resizeCanvas);
canvas.addEventListener("pointerdown", (event) => {
  canvas.setPointerCapture(event.pointerId);
  beginTear(event);
});
canvas.addEventListener("pointermove", continueTear);
canvas.addEventListener("pointerup", endTear);
canvas.addEventListener("pointercancel", endTear);
resetButton.addEventListener("click", resetArtwork);

setupLayers();
resizeCanvas();
