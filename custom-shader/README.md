# Mesh gradient (custom) — your own Figma shader fill

`main.ts` is a custom Figma shader fill that **builds today**: the 4×4
Catmull-Rom bicubic mesh (16 draggable color-point handles, forward
tessellation, 4× MSAA resolve) with a tessellation slider — functionally
equivalent to the stock mesh gradient, but living in *your* shader library
with defaults the companion plugin can fingerprint.

## Current Figma limitations (verified 2026-08-13)

- **No animation in user-authored shaders.** The build system rejects any
  source that reads `frame.time` / `frame.deltaTime` — that capability is
  first-party-only for now. Motion lives in the web tool / plugin preview and
  the code exports; a paused frame can be applied as an image fill.
- **No variable binding on shader colors.** Figma variables can only bind to
  solid paints, so shader color-points can't reference variables directly.
  The plugin's Variables row is the bridge: link a collection, **Pull colors**
  to paint the mesh from your tokens' Light/Dark values, **Push palette →
  variables** to write edits back. Re-pull + re-apply after token changes.

## Set up (one-time)

1. In Figma's shader editor, create a new custom shader and paste `main.ts`.
   Save as e.g. "Mesh gradient (custom)".
2. Apply it to any frame **at default settings**.
3. In the Mesh Gradient plugin, select that frame and click
   **"Use selection's shader for Apply"** — from then on Apply writes to your
   shader.

## future/

`future/main-animated.ts` is the animated port (control-point drift driven by
`frame.time`, with Speed/Warp/Flow scale sliders) kept ready for the day
Figma allows animated user shaders. The plugin's capture already maps its
extra sliders automatically if that shader ever builds — no plugin changes
needed.
