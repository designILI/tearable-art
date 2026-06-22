"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type TearableStoryProps = {
  imageUrls: string[];
  title: string;
  disabled?: boolean;
  onCompleteReveal?: () => void;
  onReset?: () => void;
};

type LayerSource = {
  image: string;
  palette: [string, string, string];
  name: string;
  kind: "intro" | "image";
};

type StoryLayer = LayerSource & {
  index: number;
  art: HTMLCanvasElement;
  artCtx: CanvasRenderingContext2D;
  artTexture: THREE.CanvasTexture;
  mask: HTMLCanvasElement;
  maskCtx: CanvasRenderingContext2D;
  maskTexture: THREE.CanvasTexture;
  material: THREE.MeshBasicMaterial;
  geometry: THREE.PlaneGeometry;
  mesh: THREE.Mesh;
  imageElement: HTMLImageElement | null;
  hidden: boolean;
  peeling: boolean;
  peelStart: number;
  basePositions: Float32Array | number[] | null;
};

type SeamPoint = {
  x: number;
  y: number;
  radius: number;
};

type StoryAudio = {
  context: AudioContext;
  master: GainNode;
  lastTearAt: number;
};

const palettes: [string, string, string][] = [
  ["#d9c4a0", "#7c725f", "#1a1714"],
  ["#9fc9ca", "#4f7f84", "#111f24"],
  ["#d7b2bc", "#965f70", "#24141b"],
  ["#becb90", "#65764d", "#141b13"],
  ["#c9ac8f", "#8a5743", "#160f0c"],
];

export function TearableStory({ imageUrls, title, disabled = false, onCompleteReveal, onReset }: TearableStoryProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const introOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const statusRef = useRef<HTMLParagraphElement | null>(null);
  const resetRef = useRef<HTMLButtonElement | null>(null);
  const completedRef = useRef(false);
  const introDismissedRef = useRef(false);
  const [introVisible, setIntroVisible] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const introOverlayCanvas = introOverlayRef.current;
    const resetButton = resetRef.current;
    const layerStatus = statusRef.current;
    if (!canvas || !resetButton || !layerStatus) return;
    const stageCanvas = canvas;
    const statusElement = layerStatus;
    const introOverlayCtx = introOverlayCanvas?.getContext("2d") ?? null;

    const layerSources: LayerSource[] = [
      {
        image: "",
        palette: ["#efe7d7", "#8d7d67", "#211b16"],
        name: "Invitation",
        kind: "intro",
      },
      ...imageUrls.slice(0, 5).map((image, index) => ({
        image,
        palette: palettes[index] ?? palettes[0],
        name: `Layer ${index + 1}`,
        kind: "image" as const,
      })),
    ];

    const renderer = new THREE.WebGLRenderer({
      canvas: stageCanvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x0f0e0c, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 40);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.25));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.9);
    keyLight.position.set(-2.5, 3.4, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    const sideLight = new THREE.DirectionalLight(0xbfdcff, 0.55);
    sideLight.position.set(4, -1, 4);
    scene.add(sideLight);

    const state = {
      width: 1,
      height: 1,
      dpr: 1,
      worldWidth: 1,
      worldHeight: 1,
      layers: [] as StoryLayer[],
      activeLayer: 0,
      pointers: new Map<number, THREE.Vector2>(),
      tearing: false,
      pointer: new THREE.Vector2(),
      head: new THREE.Vector2(),
      velocity: new THREE.Vector2(),
      lastHead: null as THREE.Vector2 | null,
      brush: 0.055,
      seam: [] as SeamPoint[],
      tearPercent: 0,
      peelTransition: null as { layer: StoryLayer; startedAt: number; duration: number } | null,
    };
    let storyAudio: StoryAudio | null = null;

    const flap = {
      geometry: new THREE.BufferGeometry(),
      material: new THREE.MeshStandardMaterial({
        transparent: true,
        opacity: 0.96,
        side: THREE.DoubleSide,
        roughness: 0.92,
        metalness: 0,
        depthWrite: false,
      }),
      mesh: null as THREE.Mesh | null,
    };
    flap.mesh = new THREE.Mesh(flap.geometry, flap.material);
    flap.mesh.castShadow = true;
    flap.mesh.renderOrder = 20;
    flap.mesh.visible = false;
    scene.add(flap.mesh);

    function makeLayer(source: LayerSource, index: number): StoryLayer {
      const art = document.createElement("canvas");
      const mask = document.createElement("canvas");
      const artCtx = art.getContext("2d");
      const maskCtx = mask.getContext("2d");
      if (!artCtx || !maskCtx) throw new Error("Canvas rendering is not available.");

      const artTexture = new THREE.CanvasTexture(art);
      const maskTexture = new THREE.CanvasTexture(mask);

      for (const texture of [artTexture, maskTexture]) {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
      }

      const material = new THREE.MeshBasicMaterial({
        map: artTexture,
        alphaMap: maskTexture,
        transparent: true,
        alphaTest: 0.03,
        side: THREE.DoubleSide,
      });

      const geometry = new THREE.PlaneGeometry(2, 2, 96, 64);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = -index * 0.12;
      mesh.receiveShadow = true;
      mesh.castShadow = index === 0;
      mesh.renderOrder = layerSources.length - index;
      scene.add(mesh);

      return {
        ...source,
        index,
        art,
        artCtx,
        artTexture,
        mask,
        maskCtx,
        maskTexture,
        material,
        geometry,
        mesh,
        imageElement: null,
        hidden: false,
        peeling: false,
        peelStart: 0,
        basePositions: null,
      };
    }

    function setupLayers() {
      state.layers = layerSources.map(makeLayer);
      state.layers.forEach((layer) => {
        if (layer.kind === "intro") {
          paintLayer(layer);
          render();
          return;
        }

        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => {
          layer.imageElement = image;
          paintLayer(layer);
          render();
        };
        image.onerror = () => {
          layer.imageElement = null;
          paintLayer(layer);
          render();
        };
        image.src = layer.image;
      });
    }

    function resize() {
      state.width = Math.max(1, window.innerWidth);
      state.height = Math.max(1, window.innerHeight);
      state.dpr = Math.min(window.devicePixelRatio || 1, 2);
      state.worldWidth = state.width / state.height >= 1 ? state.width / state.height : 1;
      state.worldHeight = state.width / state.height >= 1 ? 1 : state.height / state.width;

      renderer.setPixelRatio(state.dpr);
      renderer.setSize(state.width, state.height, false);

      camera.left = -state.worldWidth;
      camera.right = state.worldWidth;
      camera.top = state.worldHeight;
      camera.bottom = -state.worldHeight;
      camera.updateProjectionMatrix();

      state.layers.forEach((layer) => {
        layer.art.width = Math.round(state.width * state.dpr);
        layer.art.height = Math.round(state.height * state.dpr);
        layer.mask.width = layer.art.width;
        layer.mask.height = layer.art.height;
        layer.artCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
        layer.maskCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

        layer.geometry.dispose();
        layer.geometry = new THREE.PlaneGeometry(state.worldWidth * 2, state.worldHeight * 2, 112, 72);
        layer.mesh.geometry = layer.geometry;
        layer.basePositions = Array.from(layer.geometry.attributes.position.array);

        paintLayer(layer);
        resetMask(layer);
      });

      resetIntroOverlayMask();
      resetGesture();
      render();
    }

    function paintLayer(layer: StoryLayer) {
      const ctx = layer.artCtx;
      ctx.clearRect(0, 0, state.width, state.height);

      if (layer.kind === "intro") {
        paintIntroLayer(ctx, layer.palette);
      } else if (layer.imageElement) {
        drawImageContain(ctx, layer.imageElement, state.width, state.height, layer.palette);
      } else {
        paintPlaceholder(ctx, layer);
      }

      addPaperFibers(ctx, layer.index);
      addVignette(ctx);
      layer.artTexture.needsUpdate = true;
    }

    function paintIntroLayer(ctx: CanvasRenderingContext2D, palette: [string, string, string]) {
      const [light, mid, dark] = palette;
      const gradient = ctx.createLinearGradient(0, 0, state.width, state.height);
      gradient.addColorStop(0, light);
      gradient.addColorStop(0.56, "#d8cbb7");
      gradient.addColorStop(1, "#a99a83");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, state.width, state.height);

      const centerX = state.width / 2;
      const maxWidth = Math.min(state.width * 0.76, 760);
      const titleSize = clamp(state.width * 0.055, 34, 76);
      const bodySize = clamp(state.width * 0.024, 17, 25);
      const smallSize = clamp(state.width * 0.018, 13, 17);

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = dark;
      ctx.font = `600 ${titleSize}px Georgia, serif`;
      wrapText(ctx, "Someone has shared a Moment with you", centerX, state.height * 0.31, maxWidth, titleSize * 1.08);

      ctx.font = `500 ${bodySize}px Arial, sans-serif`;
      ctx.fillStyle = "rgba(33, 27, 22, 0.78)";
      wrapText(
        ctx,
        "To experience it, place your finger on the screen and move it along the surface.",
        centerX,
        state.height * 0.5,
        maxWidth,
        bodySize * 1.45,
      );

      ctx.font = `600 ${smallSize}px Arial, sans-serif`;
      ctx.fillStyle = mid;
      wrapText(
        ctx,
        "You have 3 cycles of this Moment before it fades. Visit Momentoria to make and share your own Moment.",
        centerX,
        state.height * 0.68,
        Math.min(maxWidth, 620),
        smallSize * 1.5,
      );

      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerX - maxWidth * 0.25, state.height * 0.41);
      ctx.lineTo(centerX + maxWidth * 0.25, state.height * 0.41);
      ctx.stroke();
      ctx.restore();
    }

    function paintPlaceholder(ctx: CanvasRenderingContext2D, layer: StoryLayer) {
      const [light, mid, dark] = layer.palette;
      const gradient = ctx.createLinearGradient(0, 0, state.width, state.height);
      gradient.addColorStop(0, light);
      gradient.addColorStop(0.48, mid);
      gradient.addColorStop(1, dark);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, state.width, state.height);
    }

    function drawImageContain(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number, palette: string[]) {
      const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      const [light, mid, dark] = palette;
      const matte = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.72);
      matte.addColorStop(0, light);
      matte.addColorStop(0.58, mid);
      matte.addColorStop(1, dark);
      ctx.fillStyle = matte;
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    }

    function addPaperFibers(ctx: CanvasRenderingContext2D, seed: number) {
      ctx.save();
      ctx.globalAlpha = 0.075;
      ctx.strokeStyle = "rgba(255, 248, 230, 0.48)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 42; i += 1) {
        const y = (state.height / 41) * i;
        ctx.beginPath();
        ctx.moveTo(-40, y);
        for (let x = -40; x < state.width + 80; x += 48) {
          ctx.lineTo(x, y + Math.sin(x * 0.011 + i * 0.77 + seed) * 8);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 0.055;
      for (let i = 0; i < 6000; i += 1) {
        const x = noise01(i * 16.93 + seed * 40.1) * state.width;
        const y = noise01(i * 8.17 + seed * 91.4) * state.height;
        ctx.fillStyle = "rgba(255, 248, 230, 0.52)";
        ctx.fillRect(x, y, 1, noise01(i * 0.41) > 0.72 ? 2 : 1);
      }
      ctx.restore();
    }

    function addVignette(ctx: CanvasRenderingContext2D) {
      const gradient = ctx.createRadialGradient(
        state.width / 2,
        state.height / 2,
        Math.min(state.width, state.height) * 0.18,
        state.width / 2,
        state.height / 2,
        Math.max(state.width, state.height) * 0.75,
      );
      gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0.36)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, state.width, state.height);
    }

    function resetMask(layer: StoryLayer) {
      layer.hidden = false;
      layer.peeling = false;
      layer.mesh.visible = true;
      layer.maskCtx.globalCompositeOperation = "source-over";
      layer.maskCtx.clearRect(0, 0, state.width, state.height);
      layer.maskCtx.fillStyle = "#fff";
      layer.maskCtx.fillRect(0, 0, state.width, state.height);
      layer.maskTexture.needsUpdate = true;
      restoreMesh(layer);
    }

    function pointerFromEvent(event: PointerEvent) {
      const rect = stageCanvas.getBoundingClientRect();
      return new THREE.Vector2(event.clientX - rect.left, event.clientY - rect.top);
    }

    function beginPointer(event: PointerEvent) {
      if (disabled || state.peelTransition || state.activeLayer >= state.layers.length - 1) return;

      ensureAudio();
      const point = pointerFromEvent(event);
      state.pointers.set(event.pointerId, point);
      state.pointer.copy(averagePointers());
      state.head.copy(state.pointer);
      state.velocity.set(0, 0);
      state.lastHead = null;
      state.seam = [];
      state.tearing = true;
      state.brush = clamp(Math.min(state.width, state.height) * 0.075, 44, 96);
      stageCanvas.classList.add("is-tearing");
      stageCanvas.setPointerCapture(event.pointerId);
    }

    function movePointer(event: PointerEvent) {
      if (!state.pointers.has(event.pointerId)) return;
      state.pointers.set(event.pointerId, pointerFromEvent(event));
      state.pointer.copy(averagePointers());

      for (let i = 0; i < 3; i += 1) {
        advanceSpring();
        carveBetweenHeads();
      }
    }

    function endPointer(event: PointerEvent) {
      state.pointers.delete(event.pointerId);
      if (state.pointers.size) {
        state.pointer.copy(averagePointers());
        return;
      }

      for (let i = 0; i < 10; i += 1) {
        advanceSpring();
        carveBetweenHeads();
      }
      state.tearing = false;
      stageCanvas.classList.remove("is-tearing");
      maybeDropLayer();
      hideFlap();
    }

    function averagePointers() {
      const point = new THREE.Vector2();
      state.pointers.forEach((value) => point.add(value));
      return point.divideScalar(state.pointers.size || 1);
    }

    let animationId = 0;
    function animate() {
      animationId = requestAnimationFrame(animate);
      updatePeelTransition();

      if (state.tearing) {
        advanceSpring();
        carveBetweenHeads();
      }

      deformActiveMesh();
      updateFlap();
      render();
    }

    function render() {
      renderer.render(scene, camera);
    }

    function advanceSpring() {
      const pull = state.pointer.clone().sub(state.head).multiplyScalar(0.18);
      state.velocity.add(pull).multiplyScalar(0.72);
      state.head.add(state.velocity);
      const speed = state.velocity.length();
      state.brush = clamp(state.brush * 0.84 + (48 + Math.min(speed * 1.2, 58)) * 0.16, 40, 108);
    }

    function carveBetweenHeads() {
      const layer = state.layers[state.activeLayer];
      if (!layer || !state.tearing) return;

      if (!state.lastHead) {
        state.lastHead = state.head.clone();
        cutOrganicHole(layer, state.head, state.brush * 0.5);
        return;
      }

      const distance = state.head.distanceTo(state.lastHead);
      const steps = Math.max(1, Math.ceil(distance / 6));
      playTearSound(state.velocity.length());
      for (let i = 1; i <= steps; i += 1) {
        const point = state.lastHead.clone().lerp(state.head, i / steps);
        const radius = state.brush * (0.82 + Math.sin(point.x * 0.012 + point.y * 0.008) * 0.08);
        cutOrganicHole(layer, point, radius);
        addSeamPoint(point, radius);
      }
      state.lastHead.copy(state.head);
      layer.maskTexture.needsUpdate = true;
    }

    function cutOrganicHole(layer: StoryLayer, point: THREE.Vector2, radius: number) {
      const ctx = layer.maskCtx;
      const count = 36;

      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      for (let i = 0; i <= count; i += 1) {
        const angle = (Math.PI * 2 * i) / count;
        const wobble = 0.94 + Math.sin(point.x * 0.009 + point.y * 0.011 + i * 0.7) * 0.06;
        const x = point.x + Math.cos(angle) * radius * wobble;
        const y = point.y + Math.sin(angle) * radius * wobble;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 0.38;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = radius * 0.95;
      ctx.strokeStyle = "#000";
      ctx.beginPath();
      ctx.moveTo(point.x - radius * 0.22, point.y);
      ctx.lineTo(point.x + radius * 0.22, point.y);
      ctx.stroke();

      const feather = ctx.createRadialGradient(point.x, point.y, radius * 0.48, point.x, point.y, radius * 1.35);
      feather.addColorStop(0, "rgba(0, 0, 0, 0.32)");
      feather.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.globalAlpha = 0.34;
      ctx.fillStyle = feather;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius * 1.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (layer.kind === "intro") {
        cutIntroOverlayHole(point, radius);
      }
    }

    function addSeamPoint(point: THREE.Vector2, radius: number) {
      const previous = state.seam[state.seam.length - 1] || point;
      const dx = point.x - previous.x;
      const dy = point.y - previous.y;
      const length = Math.hypot(dx, dy) || 1;
      const jitter = Math.sin(point.x * 0.015 + point.y * 0.013) * radius * 0.11;

      state.seam.push({
        x: point.x + (-dy / length) * jitter,
        y: point.y + (dx / length) * jitter,
        radius,
      });

      if (state.seam.length > 120) state.seam.splice(0, state.seam.length - 120);
    }

    function deformActiveMesh() {
      const layer = state.layers[state.activeLayer];
      if (!layer || !layer.basePositions) return;

      const positions = layer.geometry.attributes.position.array;
      const head = screenToWorld(state.head.x, state.head.y);
      const pointer = screenToWorld(state.pointer.x, state.pointer.y);
      const pull = pointer.clone().sub(head);
      const radius = state.brush * ((state.worldWidth * 2) / state.width) * 4.2;

      for (let i = 0; i < positions.length; i += 3) {
        const baseX = layer.basePositions[i];
        const baseY = layer.basePositions[i + 1];
        const dx = baseX - head.x;
        const dy = baseY - head.y;
        const distance = Math.hypot(dx, dy);
        const influence = Math.max(0, 1 - distance / radius);
        const ease = influence * influence * (3 - 2 * influence);

        positions[i] = baseX + pull.x * ease * 0.18;
        positions[i + 1] = baseY + pull.y * ease * 0.18;
        positions[i + 2] = Math.sin(ease * Math.PI) * 0.18 + ease * 0.08;
      }

      layer.geometry.attributes.position.needsUpdate = true;
      layer.geometry.computeVertexNormals();
    }

    function restoreMesh(layer: StoryLayer) {
      if (!layer.basePositions) return;
      layer.geometry.attributes.position.array.set(layer.basePositions);
      layer.geometry.attributes.position.needsUpdate = true;
      layer.geometry.computeVertexNormals();
    }

    function updateFlap() {
      const layer = state.layers[state.activeLayer];
      if (!state.tearing || !layer || state.seam.length < 4 || !flap.mesh) {
        hideFlap();
        return;
      }

      const path = state.seam.slice(-46);
      const normal = recentNormal(path);
      const speed = state.velocity.length();
      const lift = clamp(speed * 0.006 + 0.08, 0.09, 0.34);
      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];

      path.forEach((point, index) => {
        const world = screenToWorld(point.x, point.y);
        const width = (point.radius / state.width) * state.worldWidth * 2;
        const curl = Math.sin((index / Math.max(1, path.length - 1)) * Math.PI) * lift;
        const rough = Math.sin(point.x * 0.018 + point.y * 0.012) * width * 0.12;

        const inner = world.clone().addScaledVector(normal, -width * 0.38 + rough * 0.2);
        const outer = world.clone().addScaledVector(normal, width * 0.75 + curl + rough);
        const z = 0.34 + Math.sin(index * 0.45) * 0.018;

        positions.push(inner.x, inner.y, z * 0.45, outer.x, outer.y, z + curl * 0.55);
        uvs.push(point.x / state.width, 1 - point.y / state.height, point.x / state.width, 1 - point.y / state.height);

        if (index < path.length - 1) {
          const a = index * 2;
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      });

      flap.geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      flap.geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      flap.geometry.setIndex(indices);
      flap.geometry.computeVertexNormals();
      flap.material.map = layer.artTexture;
      flap.material.needsUpdate = true;
      flap.mesh.visible = true;
    }

    function hideFlap() {
      if (flap.mesh) flap.mesh.visible = false;
    }

    function recentNormal(path: SeamPoint[]) {
      const first = screenToWorld(path[0].x, path[0].y);
      const last = screenToWorld(path[path.length - 1].x, path[path.length - 1].y);
      const direction = last.clone().sub(first);
      if (direction.lengthSq() < 0.0001) return new THREE.Vector2(0, 1);
      direction.normalize();

      const normal = new THREE.Vector2(-direction.y, direction.x);
      const toPointer = screenToWorld(state.pointer.x, state.pointer.y).sub(last);
      if (normal.dot(toPointer) < 0) normal.multiplyScalar(-1);
      return normal;
    }

    function maybeDropLayer() {
      const layer = state.layers[state.activeLayer];
      if (!layer || state.activeLayer >= state.layers.length - 1) {
        resetGesture();
        return;
      }

      state.tearPercent = estimateRevealed(layer);
      if (state.tearPercent > 0.35 || traveledSeamLength() > Math.max(state.width, state.height) * 1.2) {
        startCenterPeel(layer);
      }

      resetGesture();
    }

    function startCenterPeel(layer: StoryLayer) {
      layer.peeling = true;
      layer.peelStart = performance.now();
      state.peelTransition = { layer, startedAt: layer.peelStart, duration: 1100 };
      state.activeLayer += 1;
      playDropSound();
      updateStatus();

      if (state.activeLayer === state.layers.length - 1 && !completedRef.current) {
        completedRef.current = true;
        window.setTimeout(() => onCompleteReveal?.(), 1200);
      }
    }

    function updatePeelTransition() {
      const transition = state.peelTransition;
      if (!transition) return;

      const { layer, startedAt, duration } = transition;
      const progress = clamp((performance.now() - startedAt) / duration, 0, 1);
      const eased = easeInOutCubic(progress);
      const cx = state.width / 2;
      const cy = state.height / 2;
      const radius = Math.hypot(state.width, state.height) * (0.08 + eased * 0.74);

      layer.maskCtx.save();
      layer.maskCtx.globalCompositeOperation = "destination-out";
      const gradient = layer.maskCtx.createRadialGradient(cx, cy, radius * 0.62, cx, cy, radius);
      gradient.addColorStop(0, "rgba(0, 0, 0, 0.72)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      layer.maskCtx.fillStyle = gradient;
      layer.maskCtx.beginPath();
      layer.maskCtx.arc(cx, cy, radius, 0, Math.PI * 2);
      layer.maskCtx.fill();
      layer.maskCtx.restore();
      layer.maskTexture.needsUpdate = true;

      if (layer.kind === "intro") {
        cutIntroOverlayPeel(radius);
      }

      peelMeshFromCenter(layer, eased);

      if (progress >= 1) {
        layer.peeling = false;
        layer.hidden = true;
        layer.mesh.visible = false;
        state.peelTransition = null;
        if (layer.kind === "intro") {
          introDismissedRef.current = true;
          setIntroVisible(false);
        }
        restoreMesh(layer);
      }
    }

    function peelMeshFromCenter(layer: StoryLayer, progress: number) {
      if (!layer.basePositions) return;

      const positions = layer.geometry.attributes.position.array;
      const maxDistance = Math.hypot(state.worldWidth, state.worldHeight);
      const opening = progress * maxDistance * 1.55;

      for (let i = 0; i < positions.length; i += 3) {
        const baseX = layer.basePositions[i];
        const baseY = layer.basePositions[i + 1];
        const distance = Math.hypot(baseX, baseY);
        const local = clamp((opening - distance + 0.28) / 0.56, 0, 1);
        const lift = local * local * (3 - 2 * local);
        const dirX = distance > 0.001 ? baseX / distance : 0;
        const dirY = distance > 0.001 ? baseY / distance : 0;

        positions[i] = baseX + dirX * lift * progress * 0.18;
        positions[i + 1] = baseY + dirY * lift * progress * 0.18;
        positions[i + 2] = lift * (0.16 + progress * 0.5);
      }

      layer.geometry.attributes.position.needsUpdate = true;
      layer.geometry.computeVertexNormals();
    }

    function estimateRevealed(layer: StoryLayer) {
      const data = layer.maskCtx.getImageData(0, 0, layer.mask.width, layer.mask.height).data;
      const stride = Math.max(1, Math.floor((layer.mask.width * layer.mask.height) / 9000));
      let clear = 0;
      let total = 0;
      for (let i = 3; i < data.length; i += 4 * stride) {
        total += 1;
        if (data[i] < 20) clear += 1;
      }
      return total ? clear / total : 0;
    }

    function traveledSeamLength() {
      let total = 0;
      for (let i = 1; i < state.seam.length; i += 1) {
        total += Math.hypot(state.seam[i].x - state.seam[i - 1].x, state.seam[i].y - state.seam[i - 1].y);
      }
      return total;
    }

    function screenToWorld(x: number, y: number) {
      return new THREE.Vector2(
        (x / state.width - 0.5) * state.worldWidth * 2,
        (0.5 - y / state.height) * state.worldHeight * 2,
      );
    }

    function resetGesture() {
      state.tearing = false;
      state.pointers.clear();
      state.lastHead = null;
      state.seam = [];
      state.velocity.set(0, 0);
      stageCanvas.classList.remove("is-tearing");
      hideFlap();
      state.layers.forEach((layer) => {
        if (!layer.peeling) restoreMesh(layer);
      });
    }

    function resetArtwork() {
      completedRef.current = false;
      const resetLayer = introDismissedRef.current ? 1 : 0;
      setIntroVisible(!introDismissedRef.current);
      state.peelTransition = null;
      state.activeLayer = resetLayer;
      state.layers.forEach(resetMask);
      if (!introDismissedRef.current) resetIntroOverlayMask();
      resetGesture();
      updateStatus();
      onReset?.();
    }

    function updateStatus() {
      statusElement.textContent =
        state.activeLayer === 0
          ? "Invitation"
          : `Layer ${Math.min(state.activeLayer, imageUrls.length)} of ${imageUrls.length}`;
    }

    function resetIntroOverlayMask() {
      if (!introOverlayCanvas || !introOverlayCtx) return;

      introOverlayCanvas.width = Math.round(state.width * state.dpr);
      introOverlayCanvas.height = Math.round(state.height * state.dpr);
      introOverlayCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      introOverlayCtx.globalCompositeOperation = "source-over";
      introOverlayCtx.clearRect(0, 0, state.width, state.height);
      paintIntroLayer(introOverlayCtx, ["#efe7d7", "#8d7d67", "#211b16"]);
      addPaperFibers(introOverlayCtx, 0);
      addVignette(introOverlayCtx);
    }

    function cutIntroOverlayHole(point: THREE.Vector2, radius: number) {
      if (!introOverlayCtx) return;

      introOverlayCtx.save();
      introOverlayCtx.globalCompositeOperation = "destination-out";
      introOverlayCtx.beginPath();
      for (let i = 0; i <= 32; i += 1) {
        const angle = (Math.PI * 2 * i) / 32;
        const wobble = 0.94 + Math.sin(point.x * 0.01 + point.y * 0.013 + i * 0.73) * 0.06;
        const x = point.x + Math.cos(angle) * radius * wobble;
        const y = point.y + Math.sin(angle) * radius * wobble;
        if (i === 0) introOverlayCtx.moveTo(x, y);
        else introOverlayCtx.lineTo(x, y);
      }
      introOverlayCtx.closePath();
      introOverlayCtx.fill();

      const feather = introOverlayCtx.createRadialGradient(point.x, point.y, radius * 0.52, point.x, point.y, radius * 1.32);
      feather.addColorStop(0, "rgba(0, 0, 0, 0.28)");
      feather.addColorStop(1, "rgba(0, 0, 0, 0)");
      introOverlayCtx.fillStyle = feather;
      introOverlayCtx.beginPath();
      introOverlayCtx.arc(point.x, point.y, radius * 1.32, 0, Math.PI * 2);
      introOverlayCtx.fill();
      introOverlayCtx.restore();
    }

    function cutIntroOverlayPeel(radius: number) {
      if (!introOverlayCtx) return;

      const cx = state.width / 2;
      const cy = state.height / 2;
      introOverlayCtx.save();
      introOverlayCtx.globalCompositeOperation = "destination-out";
      const gradient = introOverlayCtx.createRadialGradient(cx, cy, radius * 0.62, cx, cy, radius);
      gradient.addColorStop(0, "rgba(0, 0, 0, 0.72)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      introOverlayCtx.fillStyle = gradient;
      introOverlayCtx.beginPath();
      introOverlayCtx.arc(cx, cy, radius, 0, Math.PI * 2);
      introOverlayCtx.fill();
      introOverlayCtx.restore();
    }

    function ensureAudio() {
      if (storyAudio) return storyAudio;

      const AudioContextConstructor =
        window.AudioContext ||
        (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) return null;

      const context = new AudioContextConstructor();
      const master = context.createGain();
      master.gain.value = 0.18;
      master.connect(context.destination);
      storyAudio = { context, master, lastTearAt: 0 };

      if (context.state === "suspended") {
        void context.resume();
      }

      return storyAudio;
    }

    function playTearSound(speed: number) {
      const audio = ensureAudio();
      if (!audio) return;

      const now = audio.context.currentTime;
      if (now - audio.lastTearAt < 0.065) return;
      audio.lastTearAt = now;

      const duration = 0.075;
      const buffer = audio.context.createBuffer(1, Math.floor(audio.context.sampleRate * duration), audio.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        const envelope = 1 - i / data.length;
        data[i] = (Math.random() * 2 - 1) * envelope;
      }

      const source = audio.context.createBufferSource();
      const filter = audio.context.createBiquadFilter();
      const gain = audio.context.createGain();
      source.buffer = buffer;
      filter.type = "bandpass";
      filter.frequency.value = 820 + clamp(speed, 0, 48) * 18;
      filter.Q.value = 0.82;
      gain.gain.setValueAtTime(0.014 + Math.min(speed / 2200, 0.035), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(audio.master);
      source.start(now);
      source.stop(now + duration);
    }

    function playDropSound() {
      const audio = ensureAudio();
      if (!audio) return;

      const now = audio.context.currentTime;
      const oscillator = audio.context.createOscillator();
      const toneGain = audio.context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(122, now);
      oscillator.frequency.exponentialRampToValueAtTime(68, now + 0.22);
      toneGain.gain.setValueAtTime(0.05, now);
      toneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      oscillator.connect(toneGain);
      toneGain.connect(audio.master);
      oscillator.start(now);
      oscillator.stop(now + 0.34);

      const duration = 0.22;
      const buffer = audio.context.createBuffer(1, Math.floor(audio.context.sampleRate * duration), audio.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        const envelope = Math.exp((-6 * i) / data.length);
        data[i] = (Math.random() * 2 - 1) * envelope;
      }

      const source = audio.context.createBufferSource();
      const filter = audio.context.createBiquadFilter();
      const gain = audio.context.createGain();
      source.buffer = buffer;
      filter.type = "lowpass";
      filter.frequency.value = 430;
      gain.gain.setValueAtTime(0.055, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(audio.master);
      source.start(now);
      source.stop(now + duration);
    }

    function wrapText(
      ctx: CanvasRenderingContext2D,
      text: string,
      x: number,
      y: number,
      maxWidth: number,
      lineHeight: number,
    ) {
      const words = text.split(" ");
      const lines: string[] = [];
      let line = "";

      words.forEach((word) => {
        const testLine = line ? `${line} ${word}` : word;
        if (ctx.measureText(testLine).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = testLine;
        }
      });
      if (line) lines.push(line);

      const startY = y - ((lines.length - 1) * lineHeight) / 2;
      lines.forEach((lineText, index) => {
        ctx.fillText(lineText, x, startY + index * lineHeight);
      });
    }

    function noise01(value: number) {
      const result = Math.sin(value * 127.1 + 311.7) * 43758.5453123;
      return result - Math.floor(result);
    }

    function clamp(value: number, min: number, max: number) {
      return Math.max(min, Math.min(max, value));
    }

    function easeInOutCubic(value: number) {
      return value < 0.5 ? 4 * value ** 3 : 1 - Math.pow(-2 * value + 2, 3) / 2;
    }

    window.addEventListener("resize", resize);
    stageCanvas.addEventListener("pointerdown", beginPointer);
    stageCanvas.addEventListener("pointermove", movePointer);
    stageCanvas.addEventListener("pointerup", endPointer);
    stageCanvas.addEventListener("pointercancel", endPointer);
    resetButton.addEventListener("click", resetArtwork);

    setupLayers();
    resize();
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      stageCanvas.removeEventListener("pointerdown", beginPointer);
      stageCanvas.removeEventListener("pointermove", movePointer);
      stageCanvas.removeEventListener("pointerup", endPointer);
      stageCanvas.removeEventListener("pointercancel", endPointer);
      resetButton.removeEventListener("click", resetArtwork);
      if (storyAudio) {
        void storyAudio.context.close();
      }
      state.layers.forEach((layer) => {
        layer.geometry.dispose();
        layer.material.dispose();
        layer.artTexture.dispose();
        layer.maskTexture.dispose();
      });
      flap.geometry.dispose();
      flap.material.dispose();
      renderer.dispose();
    };
  }, [disabled, imageUrls, onCompleteReveal, onReset]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <canvas ref={canvasRef} className="stage-canvas block h-full w-full" aria-label={title} />
      <canvas
        ref={introOverlayRef}
        className={`pointer-events-none absolute inset-0 z-20 h-full w-full shadow-[inset_0_0_120px_rgba(33,27,22,0.24)] ${
          introVisible && !disabled ? "block" : "hidden"
        }`}
        aria-label="Someone has shared a Moment with you. To experience it, place your finger on the screen and move it along the surface. You have 3 cycles of this Moment before it fades. Visit Momentoria to make and share your own Moment."
      />
      <div className="absolute bottom-5 right-5 z-10 flex items-end gap-3 text-right text-cream sm:bottom-8 sm:right-8">
        <div>
          <p ref={statusRef} className="text-xs font-semibold uppercase tracking-[0.16em] text-cream/74">
            Invitation
          </p>
        </div>
        <button
          ref={resetRef}
          type="button"
          className="min-h-11 rounded-full border border-cream/28 bg-dusk/40 px-5 text-xs font-semibold uppercase tracking-[0.12em] text-cream backdrop-blur transition hover:border-cream/60 hover:bg-cream/12"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
