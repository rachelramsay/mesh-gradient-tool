// Convert a Figma "Mesh gradient" SHADER fill's parameters into a tool config.
// Figma exposes a shader fill as { type:'SHADER', id, properties } where each
// color-point property is { x, y (in %), color:{r,g,b,a} } and numeric props
// (e.g. tessellation) are plain numbers. We map the color-points into our
// free-point engine (inverse-distance). This is the "quick" import — a faithful
// 4x4 Catmull-Rom bicubic mode is a planned follow-up.

import { rgb01ToHex } from './color.js';

export function figmaShaderToConfig(properties, opts = {}) {
  const width = opts.width || 1440;
  const height = opts.height || 580;

  const points = [];
  for (const key in properties) {
    const v = properties[key];
    if (v && typeof v === 'object' && typeof v.x === 'number' && typeof v.y === 'number' && v.color) {
      points.push({
        x: v.x / 100,
        y: v.y / 100,
        color: rgb01ToHex(v.color.r, v.color.g, v.color.b),
        spread: 1,
      });
    }
  }

  return {
    points: points.slice(0, 16),
    // Start close to the (static) Figma look; motion is there to dial up.
    animation: { play: true, speed: 0.6, noiseScale: 1.2, noiseSpeed: 0.08, warp: 0.3 },
    effects: { falloff: 1.0, grain: 0, vignette: 0 },
    frame: { width, height },
  };
}
