# Mesh Gradient Tool

A lightweight editor for creating **animated mesh gradients** — design them in the browser, then export a dependency-free WebGL runtime you can drop onto any vanilla-JS site.

![status](https://img.shields.io/badge/status-in%20development-blue)

## Features

- **Hand-rolled WebGL** — one fragment shader, zero dependencies, a single draw call.
- **Draggable color points** (2–16), each with its own color and **spread** (radius of influence).
- **Animation** — organic domain-warp flow with speed, warp, and flow controls; play / pause.
- **Effects** — softness, vignette, and film grain. Colors blend in sRGB/gamma space, so every point stays true to its exact hex (no color shift).
- **Canvas size** — set an export frame (Desktop / Square / Story / custom W×H) while the exported code stays fully responsive.
- **Capture** — pause and export the current frame as a PNG at the exact frame resolution.
- **Presets** — 8 built-ins plus save-your-own (localStorage).
- **Export** — self-contained **JS**, a ready-to-open **HTML** demo, a **CSS-gradient fallback**, and **config JSON** import/export.
- **Performance** — caps DPR, pauses when the tab is hidden or scrolled off-screen, and honors `prefers-reduced-motion`.

## Run locally

The app uses ES modules, so serve it over HTTP (not `file://`). The bundled
dev server disables caching so edits show up on plain reload:

```bash
python3 serve.py 5599
```

Then open <http://localhost:5599/index.html>.

## Figma plugin — the full editor inside Figma

`figma-plugin/` is a complete standalone editor (same WebGL engine as the web
tool, bundled by `build_plugin.py`). No server needed. One-time install in the
Figma **desktop** app:

1. Menu → **Plugins → Development → Import plugin from manifest…**
2. Pick `figma-plugin/manifest.json`

Open it from Plugins → Development → **Mesh Gradient**. Inside the panel:

- **Live animated preview** with pause-to-edit draggable points, per-point
  light/dark colors (OKLab auto-derived darks), animation and effect sliders
- **Import selection** — reads the selected layer's mesh gradient fill,
  including screenshot-verified grid topology recovery
- **Apply mesh fill** — writes the design onto the selection as a native,
  editable Figma mesh gradient
- **Frame → image fill** — captures the paused animation frame at the
  selection's size and applies it as an image fill (works for free-point
  designs and motion moments the static shader can't hold)
- **Light/dark variables** — creates or updates a "Mesh Gradient" variable
  collection from the current palette
- **Copy JS / Copy HTML** — the same self-contained code exports as the web
  tool, from inside Figma
- **Presets** — built-ins plus save-your-own (persisted via Figma
  clientStorage)

After changing `src/*.js` or `figma-plugin/ui-src/*`, rebuild the panel with:

```bash
python3 build_plugin.py
```

The web tool remains fully standalone, and its Figma panel keeps the
console-script fallback that needs no plugin at all.

## Use the exported runtime

Export **Code (JS)** from the editor and drop it in:

```html
<canvas id="gradient" style="width:100%;height:100vh"></canvas>
<script src="mesh-gradient.js"></script>
```

Or drive the engine directly:

```js
import { initMeshGradient } from './src/gradient.js';
const gradient = initMeshGradient(canvas, config);
gradient.play();   // gradient.pause(), gradient.setConfig({ ... }), gradient.capture(w, h)
```

## Project structure

| File | Role |
| --- | --- |
| `src/gradient.js` | The runtime engine (`initMeshGradient`) — the single source of truth that also gets exported. |
| `src/shader.glsl.js` | Vertex + fragment shader source. |
| `src/editor.js` | Editor app: handles, controls, playback, capture, presets, export. |
| `src/controls.js` | Small DOM + slider helpers. |
| `src/capture.js` | PNG capture at the frame resolution. |
| `src/presets.js` | Built-in presets, config I/O, and standalone code export. |
| `src/ui.css` | Editor styling. |
| `index.html` | Editor shell. |

## Roadmap

- **Figma integration** — capture to a Figma frame as a PNG snapshot or a native shader fill, wired to color variables for light/dark mode.

## License

MIT
