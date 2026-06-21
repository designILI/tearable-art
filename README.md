# Tearable Art

An elegant, single-page layered artwork. Visitors drag across the surface to tear away the current layer and reveal the artwork underneath.

## Files

- `index.html` contains the page structure and small overlay UI.
- `styles.css` controls typography, layout, and the minimal interface.
- `script.js` draws the artwork layers and handles mouse/touch tearing.
- `assets/layers/` is where your final art images should go.

## Replacing the Placeholder Art

1. Add your five image files to `assets/layers/`.

   Recommended formats: `.jpg`, `.png`, or `.webp`.

2. Open `script.js`.

3. Find the `layerSources` list near the top of the file.

4. Replace the placeholder entries with your image paths:

   ```js
   const layerSources = [
     { image: "assets/layers/layer-01.jpg", name: "Layer 1" },
     { image: "assets/layers/layer-02.jpg", name: "Layer 2" },
     { image: "assets/layers/layer-03.jpg", name: "Layer 3" },
     { image: "assets/layers/layer-04.jpg", name: "Layer 4" },
     { image: "assets/layers/layer-05.jpg", name: "Layer 5" },
   ];
   ```

The first item in the list is the top layer. The fifth item is the deepest layer.

Images are automatically scaled to cover the full screen, so large landscape images usually work best. For crisp results, use images at least `2400px` wide.

## Running Locally

Open `index.html` in a browser, or serve the folder with any simple local server.

For example:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Notes

The tear effect is generated with a canvas mask. It uses irregular brush shapes, soft cutouts, paper grain, and edge shadows to keep the motion organic while staying easy to customize.
