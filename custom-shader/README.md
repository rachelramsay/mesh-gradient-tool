# Animated mesh gradient — your own custom Figma shader

> **Status (verified 2026-08-13): Figma's shader build system rejects
> user-authored shaders that read `frame.time` / `frame.deltaTime`, so the
> animated version in `main.ts` does NOT build as-is.** Live animation in
> custom shader fills is currently a first-party-only capability (e.g. the
> stock "Glowing wave"). `main.ts` is kept as the intended port in case the
> platform opens this up. Figma's shader builder will happily produce the
> **static** variant (16 bicubic points + tessellation) from this source —
> that static build works with the plugin's "Use selection's shader for
> Apply" capture, since it keeps the default lattice and unique defaults.
>
> Animation paths that DO work today: the web tool / plugin preview and code
> exports (true animation), paused-frame image fills via the plugin, and
> hand-keyframing the shader's 16 points in Figma's Motion mode (the Plugin
> API cannot automate shader-property keyframes — its keyframe allowlist
> covers transforms/opacity/solid fills/effects only).

This folder is a custom Figma shader fill: the same 4×4 bicubic mesh as
Figma's stock mesh gradient, plus (unsupported today, see above) live canvas
animation — each control point drifting with the exact motion model used by
the web tool and plugin. Once created it lives in *your* shader library — no
dependency on the premade one.

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
