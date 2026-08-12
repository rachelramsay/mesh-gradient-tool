// Convert a Figma "Mesh gradient" SHADER fill's parameters into a tool config.
// Figma exposes a shader fill as { type:'SHADER', id, properties } where each
// color-point property is { x, y (in %), color:{r,g,b,a} } and numeric props
// (e.g. tessellation) are plain numbers. We map the color-points into our
// free-point engine (inverse-distance). This is the "quick" import — a faithful
// 4x4 Catmull-Rom bicubic mode is a planned follow-up.

import { rgb01ToHex } from './color.js';
import { initMeshGradient } from './gradient.js';

// Recover the 4x4 grid topology from unlabeled points: Figma hashes the
// p00..p33 property names, so we re-derive each point's lattice slot. Meshes
// are edited by dragging the default grid, so a greedy nearest-slot assignment
// (all point/slot pairs sorted by distance to the default lattice positions,
// closest pairs claimed first) recovers the topology for typical meshes.
// Extremely tangled meshes are inherently ambiguous without the labels.
function recoverGridOrder(points) {
  const slotPos = (i) => (i === 3 ? 1.0 : i / 3); // default lattice: 0, 1/3, 2/3, 1
  const pairs = [];
  for (let s = 0; s < 16; s++) {
    const sx = slotPos(s % 4), sy = slotPos(Math.floor(s / 4));
    for (let p = 0; p < 16; p++) {
      const dx = points[p].x - sx, dy = points[p].y - sy;
      pairs.push({ s, p, d: dx * dx + dy * dy });
    }
  }
  pairs.sort((a, b) => a.d - b.d);
  const grid = new Array(16);
  const usedSlot = new Array(16).fill(false);
  const usedPt = new Array(16).fill(false);
  for (const { s, p } of pairs) {
    if (usedSlot[s] || usedPt[p]) continue;
    grid[s] = points[p];
    usedSlot[s] = true;
    usedPt[p] = true;
  }
  return grid;
}

// Refine a recovered grid against a reference render of the actual Figma node.
// The analytic recovery can mis-slot heavily dragged points (the hashed keys
// destroy the labels, and distance heuristics can't see the truth). Rendering
// candidate assignments and scoring them against the reference can: hill-climb
// pairwise slot swaps, keeping any swap that reduces the pixel delta.
// referenceURL: same-origin or data: URL of the Figma node render.
export async function refineGridOrderByReference(gridPoints, referenceURL) {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = referenceURL; });
  // small working resolution: plenty for scoring, fast to render/read
  const W = 160, H = Math.max(8, Math.round(160 * img.naturalHeight / img.naturalWidth));
  const rc = document.createElement('canvas');
  rc.width = W; rc.height = H;
  rc.getContext('2d').drawImage(img, 0, 0, W, H);
  const rd = rc.getContext('2d').getImageData(0, 0, W, H).data;

  const cv = document.createElement('canvas');
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  cv.style.position = 'fixed'; cv.style.left = '-9999px';
  document.body.appendChild(cv);
  const engine = initMeshGradient(cv, {
    mode: 'mesh', points: gridPoints,
    animation: { play: false, speed: 0, noiseScale: 1, noiseSpeed: 0, warp: 0 },
    effects: { falloff: 1, grain: 0, vignette: 0 },
  }, { autoStart: false, pauseWhenHidden: false, maxDpr: 1 });

  const gl = engine.gl;
  const px = new Uint8Array(W * H * 4);
  const SX = 24, SY = 10; // dense sample lattice — sparse grids alias topologies
  function score(points) {
    engine.setConfig({ points });
    engine.redraw();
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let sum = 0;
    for (let gy = 0; gy < SY; gy++) for (let gx = 0; gx < SX; gx++) {
      const x = Math.floor((gx + 0.5) / SX * W), y = Math.floor((gy + 0.5) / SY * H);
      const ri = (y * W + x) * 4;
      const oi = ((H - 1 - y) * W + x) * 4; // readPixels rows are bottom-up
      sum += Math.abs(rd[ri] - px[oi]) + Math.abs(rd[ri + 1] - px[oi + 1]) + Math.abs(rd[ri + 2] - px[oi + 2]);
    }
    return sum;
  }

  // Best-improvement hill-climb: evaluate every pairwise slot swap, apply only
  // the single best one, repeat. (First-improvement wanders into score-neutral
  // local optima when many control points share a color.)
  let order = gridPoints.slice();
  let best = score(order);
  for (let round = 0; round < 16 && best > 0; round++) {
    let bestSwap = null, bestScore = best;
    for (let i = 0; i < 15; i++) for (let j = i + 1; j < 16; j++) {
      const trial = order.slice();
      [trial[i], trial[j]] = [trial[j], trial[i]];
      const s = score(trial);
      if (s < bestScore) { bestScore = s; bestSwap = [i, j]; }
    }
    if (!bestSwap) break;
    [order[bestSwap[0]], order[bestSwap[1]]] = [order[bestSwap[1]], order[bestSwap[0]]];
    best = bestScore;
  }
  engine.destroy();
  cv.remove();
  return { points: order, residual: best };
}

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
      });
    }
  }

  // Faithful path: exactly 16 points -> Figma-compatible bicubic mesh mode,
  // with grid order recovered. Otherwise fall back to free-point approximation.
  const isMesh = points.length === 16 && opts.mode !== 'points';
  const ordered = isMesh
    ? recoverGridOrder(points)
    : points.slice(0, 16).map((p) => ({ ...p, spread: 1 }));

  return {
    mode: isMesh ? 'mesh' : 'points',
    points: ordered,
    // Start close to the (static) Figma look; motion is there to dial up.
    animation: { play: true, speed: 0.6, noiseScale: 1.2, noiseSpeed: 0.08, warp: 0.3 },
    effects: { falloff: 1.0, grain: 0, vignette: 0 },
    frame: { width, height },
  };
}
