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
