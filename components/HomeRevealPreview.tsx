"use client";

import { useEffect, useRef } from "react";

const demoImages = ["/assets/layers/layer-01.jpeg", "/assets/layers/layer-05.jpeg", "/assets/layers/layer-04.jpeg"];

type LoadedImage = {
  element: HTMLImageElement;
  loaded: boolean;
};

export function HomeRevealPreview() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const drawingCanvas = canvas;
    const drawingContext = context;
    const topCanvas = document.createElement("canvas");
    const topContext = topCanvas.getContext("2d");
    if (!topContext) return;
    const topDrawingContext = topContext;

    const images: LoadedImage[] = demoImages.map((src) => {
      const element = new Image();
      element.src = src;
      return { element, loaded: false };
    });

    let frame = 0;
    let width = 1;
    let height = 1;
    let dpr = 1;
    let disposed = false;

    images.forEach((image) => {
      image.element.onload = () => {
        image.loaded = true;
      };
    });

    function resize() {
      const rect = drawingCanvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      drawingCanvas.width = Math.round(width * dpr);
      drawingCanvas.height = Math.round(height * dpr);
      topCanvas.width = drawingCanvas.width;
      topCanvas.height = drawingCanvas.height;
      drawingContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      topDrawingContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawCover(target: CanvasRenderingContext2D, image: HTMLImageElement, alpha = 1) {
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      target.globalAlpha = alpha;
      target.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
      target.globalAlpha = 1;
    }

    function drawPaperTexture(target: CanvasRenderingContext2D) {
      const gradient = target.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "rgba(246, 239, 227, 0.28)");
      gradient.addColorStop(1, "rgba(37, 31, 25, 0.18)");
      target.fillStyle = gradient;
      target.fillRect(0, 0, width, height);

      target.globalAlpha = 0.09;
      target.strokeStyle = "#fff8e8";
      for (let index = 0; index < 28; index += 1) {
        const y = (height / 28) * index;
        target.beginPath();
        target.moveTo(-20, y);
        for (let x = -20; x < width + 40; x += 40) {
          target.lineTo(x, y + Math.sin(x * 0.016 + index) * 5);
        }
        target.stroke();
      }
      target.globalAlpha = 1;
    }

    function scratchPath(target: CanvasRenderingContext2D, progress: number) {
      const points = 64;
      const startX = width * 0.1;
      const endX = width * 0.92;
      const paths = [-0.17, 0, 0.17];

      target.save();
      target.globalCompositeOperation = "destination-out";
      target.lineCap = "round";
      target.lineJoin = "round";
      target.strokeStyle = "#000";

      paths.forEach((offset, pathIndex) => {
        const pathProgress = Math.min(1, Math.max(0, progress * 1.18 - pathIndex * 0.16));
        const pathPoints = Math.floor(points * pathProgress);

        for (let index = 0; index < pathPoints; index += 1) {
          const t = index / Math.max(1, points - 1);
          const x = startX + (endX - startX) * t;
          const y =
            height * (0.32 + 0.3 * t + offset) +
            Math.sin(t * Math.PI * 5.5 + pathIndex * 0.82) * height * 0.07;
          const radius = width * (0.052 + Math.sin(t * Math.PI * 2 + pathIndex) * 0.012);
          target.beginPath();
          target.ellipse(x, y, radius * 2.1, radius * 1.08, -0.34 + pathIndex * 0.18, 0, Math.PI * 2);
          target.fill();
        }

        target.lineWidth = width * 0.115;
        target.beginPath();
        for (let index = 0; index < pathPoints; index += 1) {
          const t = index / Math.max(1, points - 1);
          const x = startX + (endX - startX) * t;
          const y =
            height * (0.32 + 0.3 * t + offset) +
            Math.sin(t * Math.PI * 5.5 + pathIndex * 0.82) * height * 0.07;
          if (index === 0) target.moveTo(x, y);
          else target.lineTo(x, y);
        }
        target.stroke();
      });
      target.restore();

      const cursorT = Math.min(1, Math.max(0, progress));
      const cursorX = startX + (endX - startX) * cursorT;
      const cursorY = height * (0.32 + 0.3 * cursorT) + Math.sin(cursorT * Math.PI * 5.5) * height * 0.08;
      drawingContext.save();
      drawingContext.shadowColor = "rgba(37, 31, 25, 0.28)";
      drawingContext.shadowBlur = 18;
      drawingContext.fillStyle = "rgba(246, 239, 227, 0.92)";
      drawingContext.beginPath();
      drawingContext.arc(cursorX, cursorY, Math.max(16, width * 0.04), 0, Math.PI * 2);
      drawingContext.fill();
      drawingContext.restore();
    }

    function draw() {
      if (disposed) return;

      const elapsed = (performance.now() % 6200) / 6200;
      const progress = elapsed < 0.68 ? easeInOutCubic(elapsed / 0.68) : 1;

      drawingContext.clearRect(0, 0, width, height);
      drawingContext.fillStyle = "#1b1713";
      drawingContext.fillRect(0, 0, width, height);

      const bottom = images[1];
      const top = images[0];
      if (bottom?.loaded) drawCover(drawingContext, bottom.element);
      if (images[2]?.loaded) drawCover(drawingContext, images[2].element, 0.04);

      topDrawingContext.clearRect(0, 0, width, height);
      if (top?.loaded) drawCover(topDrawingContext, top.element, 1 - Math.min(0.48, Math.max(0, progress - 0.55) * 1.07));
      drawPaperTexture(topDrawingContext);
      scratchPath(topDrawingContext, progress);
      drawingContext.drawImage(topCanvas, 0, 0, width, height);

      const vignette = drawingContext.createRadialGradient(width / 2, height / 2, width * 0.1, width / 2, height / 2, width * 0.72);
      vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
      vignette.addColorStop(1, "rgba(0, 0, 0, 0.28)");
      drawingContext.fillStyle = vignette;
      drawingContext.fillRect(0, 0, width, height);

      frame = requestAnimationFrame(draw);
    }

    function easeInOutCubic(value: number) {
      return value < 0.5 ? 4 * value ** 3 : 1 - Math.pow(-2 * value + 2, 3) / 2;
    }

    resize();
    window.addEventListener("resize", resize);
    frame = requestAnimationFrame(draw);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="relative min-h-[420px] lg:min-h-[620px]" aria-hidden="true">
      <div className="absolute inset-[18%_7%_4%_20%] rotate-[5deg] overflow-hidden rounded-[6px] border border-white/50 bg-cream shadow-soft" />
      <div className="absolute inset-[9%_13%_11%_10%] -rotate-[3deg] overflow-hidden rounded-[6px] border border-white/50 bg-cream shadow-soft" />
      <div className="absolute inset-[0_0_16%_0] overflow-hidden rounded-[6px] border border-white/60 bg-cream shadow-soft">
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>
    </div>
  );
}
