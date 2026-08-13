# Animated mesh gradient — your own custom Figma shader

This folder is a custom Figma shader fill: the same 4×4 bicubic mesh as
Figma's stock mesh gradient, **plus live animation on the canvas** — each
control point drifts with the exact motion model used by the web tool and
plugin (orbit + breathing oscillation, border points pinned to their edge).
Once created it lives in *your* shader library — no dependency on the
premade one — with Speed / Warp / Flow scale sliders in the fill panel.

## One-time creation (Figma desktop)

1. Select any frame → **Fill** → change the fill type to **Shader** and choose
   the option to create/edit a custom shader (Figma's shader code editor).
2. Replace the editor's code with the contents of [`main.ts`](main.ts).
3. Make sure the shader is marked **animated** (this repo's `features.json`
   shows the intended settings: `isAnimated: true`).
4. Save/name it — e.g. **Animated mesh gradient**. It now appears in your
   shader library like any other fill.

## Hook it up to the plugin (also one-time)

1. Apply your new shader to any frame **with its default settings** (don't
   move points yet — the defaults are how the plugin identifies which hashed
   parameter is which).
2. Open the **Mesh Gradient** plugin, select that frame, and click
   **"Use selection's shader for Apply"**. The status line switches to
   `target: custom (animated)` and the mapping is remembered.

From then on, **Apply mesh fill** writes your designs to your own shader —
positions, colors, and the Speed/Warp/Flow scale values straight from the
plugin's sliders — and the gradient animates right on the Figma canvas.

## Notes

- The animation math here is a line-for-line port of the web tool's engine
  (`src/gradient.js` → `renderMesh`), so the plugin preview and the Figma
  canvas move the same way at the same settings.
- Corners stay pinned and edge points slide only along their edge, so frame
  edges never expose gaps while animating.
- The plugin's import and the web tool's read scripts work with fills from
  this shader automatically (they read any SHADER fill's color points by
  shape, regardless of key hashes).
