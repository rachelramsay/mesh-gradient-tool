// Built-in presets, config import/export, and standalone code export.

export const PRESETS = {
  // Figma's "Mesh gradient" shader default: the pristine 4x4 lattice with its
  // stock palette, in bicubic mesh mode. Row-major grid order (p00..p33), so
  // every point maps 1:1 onto the shader's slots for round-tripping to Figma.
  'Figma Lattice': {
    mode: 'mesh',
    points: [
      { x: 0.00, y: 0.00, color: '#ff6b6b' }, { x: 0.33, y: 0.00, color: '#ffa36b' },
      { x: 0.67, y: 0.00, color: '#ffd16b' }, { x: 1.00, y: 0.00, color: '#ffd166' },
      { x: 0.00, y: 0.33, color: '#b34d99' }, { x: 0.33, y: 0.33, color: '#cc8c80' },
      { x: 0.67, y: 0.33, color: '#e6b373' }, { x: 1.00, y: 0.33, color: '#80b359' },
      { x: 0.00, y: 0.67, color: '#6680b3' }, { x: 0.33, y: 0.67, color: '#59a6a6' },
      { x: 0.67, y: 0.67, color: '#33a68c' }, { x: 1.00, y: 0.67, color: '#1a8cb3' },
      { x: 0.00, y: 1.00, color: '#05d6a1' }, { x: 0.33, y: 1.00, color: '#1ab3a6' },
      { x: 0.67, y: 1.00, color: '#1a99b3' }, { x: 1.00, y: 1.00, color: '#128ab3' },
    ],
    animation: { play: true, speed: 0.6, noiseScale: 1.2, noiseSpeed: 0.08, warp: 0.3 },
    effects: { falloff: 1.0, grain: 0, vignette: 0 },
  },
  Twilight: {
    points: [
      { x: 0.15, y: 0.20, color: '#5b3cc4' },
      { x: 0.85, y: 0.15, color: '#9d4edd' },
      { x: 0.20, y: 0.80, color: '#ff5d8f' },
      { x: 0.60, y: 0.95, color: '#ff8a5b' },
      { x: 0.90, y: 0.75, color: '#ffd166' },
    ],
    animation: { play: true, speed: 0.85, noiseScale: 1.3, noiseSpeed: 0.12, warp: 0.7 },
    effects: { falloff: 1.1, grain: 0.045, vignette: 0.18 },
  },
  Aurora: {
    points: [
      { x: 0.20, y: 0.25, color: '#00c9a7' },
      { x: 0.80, y: 0.15, color: '#4d96ff' },
      { x: 0.30, y: 0.80, color: '#845ec2' },
      { x: 0.82, y: 0.82, color: '#2ec4b6' },
      { x: 0.55, y: 0.50, color: '#b8f2e6' },
    ],
    animation: { play: true, speed: 0.8, noiseScale: 1.6, noiseSpeed: 0.16, warp: 0.9 },
    effects: { falloff: 1.05, grain: 0.05, vignette: 0.22 },
  },
  Sunset: {
    points: [
      { x: 0.15, y: 0.15, color: '#ff9a3c' },
      { x: 0.85, y: 0.20, color: '#ff5e7e' },
      { x: 0.20, y: 0.85, color: '#7b2ff7' },
      { x: 0.85, y: 0.85, color: '#f9c74f' },
      { x: 0.50, y: 0.55, color: '#ff7b54' },
    ],
    animation: { play: true, speed: 1.0, noiseScale: 1.3, noiseSpeed: 0.13, warp: 0.75 },
    effects: { falloff: 1.15, grain: 0.05, vignette: 0.20 },
  },
  Cotton: {
    points: [
      { x: 0.18, y: 0.22, color: '#ffd6a5' },
      { x: 0.82, y: 0.18, color: '#ffadad' },
      { x: 0.25, y: 0.82, color: '#fdffb6' },
      { x: 0.86, y: 0.80, color: '#ffc6ff' },
      { x: 0.50, y: 0.50, color: '#caffbf' },
    ],
    animation: { play: true, speed: 0.65, noiseScale: 1.1, noiseSpeed: 0.10, warp: 0.5 },
    effects: { falloff: 1.25, grain: 0.03, vignette: 0.10 },
  },
  Ocean: {
    points: [
      { x: 0.15, y: 0.20, color: '#012a4a' },
      { x: 0.80, y: 0.15, color: '#2a6f97' },
      { x: 0.25, y: 0.82, color: '#014f86' },
      { x: 0.85, y: 0.80, color: '#61a5c2' },
      { x: 0.55, y: 0.55, color: '#a9d6e5' },
    ],
    animation: { play: true, speed: 0.7, noiseScale: 1.4, noiseSpeed: 0.12, warp: 0.8 },
    effects: { falloff: 1.05, grain: 0.05, vignette: 0.28 },
  },
  Ember: {
    points: [
      { x: 0.15, y: 0.85, color: '#3d0e0e' },
      { x: 0.85, y: 0.80, color: '#7a1e1e' },
      { x: 0.20, y: 0.20, color: '#ff6b35' },
      { x: 0.85, y: 0.15, color: '#f7b267' },
      { x: 0.50, y: 0.55, color: '#c1121f' },
    ],
    animation: { play: true, speed: 0.75, noiseScale: 1.5, noiseSpeed: 0.14, warp: 0.7 },
    effects: { falloff: 1.1, grain: 0.07, vignette: 0.30 },
  },
  Mint: {
    points: [
      { x: 0.20, y: 0.20, color: '#d8f3dc' },
      { x: 0.80, y: 0.15, color: '#95d5b2' },
      { x: 0.25, y: 0.80, color: '#52b788' },
      { x: 0.85, y: 0.82, color: '#40916c' },
      { x: 0.55, y: 0.50, color: '#b7e4c7' },
    ],
    animation: { play: true, speed: 0.6, noiseScale: 1.2, noiseSpeed: 0.10, warp: 0.6 },
    effects: { falloff: 1.15, grain: 0.04, vignette: 0.14 },
  },
  Slate: {
    points: [
      { x: 0.20, y: 0.20, color: '#3a3f5a' },
      { x: 0.82, y: 0.22, color: '#6c7293' },
      { x: 0.25, y: 0.82, color: '#1c1e2b' },
      { x: 0.85, y: 0.82, color: '#9aa0c0' },
    ],
    animation: { play: true, speed: 0.6, noiseScale: 1.4, noiseSpeed: 0.12, warp: 0.6 },
    effects: { falloff: 1.1, grain: 0.08, vignette: 0.25 },
  },
};

// ---- config import / export --------------------------------------------------
export function configToJSON(config) {
  return JSON.stringify(config, null, 2);
}

export function parseConfigJSON(text) {
  const c = JSON.parse(text);
  if (!c || !Array.isArray(c.points)) throw new Error('Invalid config: missing points[].');
  return c;
}

// ---- standalone code export --------------------------------------------------
// We fetch the LIVE engine source so the exported snippet always matches what
// the editor runs — one source of truth, no drift.
async function fetchSource(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not read ' + url);
  return res.text();
}

function stripModuleSyntax(src) {
  return src
    .replace(/^\s*import[^\n]*\n/gm, '')      // drop import lines
    .replace(/^(\s*)export\s+(?=(async|const|function|class|let|var)\b)/gm, '$1') // drop export keyword
    .replace(/^\s*export\s+\{[^}]*\};?\s*$/gm, ''); // drop bare export { ... }
}

// Build a single self-contained IIFE: shader + engine + config + bootstrap.
export async function buildStandaloneJS(config, base = './') {
  const [shaderSrc, meshShaderSrc, engineSrc] = await Promise.all([
    fetchSource(base + 'src/shader.glsl.js'),
    fetchSource(base + 'src/shader-mesh.js'),
    fetchSource(base + 'src/gradient.js'),
  ]);

  const body = stripModuleSyntax(shaderSrc) + '\n' + stripModuleSyntax(meshShaderSrc) + '\n' + stripModuleSyntax(engineSrc);
  const cfg = JSON.stringify(config, null, 2);

  return `/* Animated mesh gradient — self-contained, no dependencies.
   Usage:  <canvas id="gradient" style="width:100%;height:100vh"></canvas>
           <script src="mesh-gradient.js"></script>
   Or pass your own canvas + config to initMeshGradient(canvas, config). */
(function (root) {
${body}

  var CONFIG = ${cfg};

  function boot() {
    var canvas = document.getElementById('gradient');
    if (!canvas) return;
    root.meshGradient = initMeshGradient(canvas, CONFIG);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }

  root.initMeshGradient = initMeshGradient;
})(typeof window !== 'undefined' ? window : this);
`;
}

// A ready-to-open HTML demo wrapping the standalone JS.
export async function buildStandaloneHTML(config, base = './') {
  // Escape </script> sequences (e.g. in the usage comment) — the HTML parser
  // would otherwise terminate the inline script block at the first one.
  const js = (await buildStandaloneJS(config, base)).replace(/<\/script/gi, '<\\/script');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mesh Gradient</title>
<style>html,body{margin:0;height:100%}#gradient{display:block;width:100vw;height:100vh}</style>
</head>
<body>
<canvas id="gradient"></canvas>
<script>
${js}
</script>
</body>
</html>
`;
}

// A CSS-only approximation for no-WebGL / prefers-reduced-motion fallbacks.
// Uses layered radial-gradients at each point's position/color.
export function buildCSSFallback(config) {
  const layers = config.points.map((p) => {
    const x = (p.x * 100).toFixed(1);
    const y = (p.y * 100).toFixed(1);
    return `radial-gradient(circle at ${x}% ${y}%, ${p.color} 0%, transparent 55%)`;
  });
  const base = config.points[0] ? config.points[0].color : '#222';
  return `.mesh-gradient {
  background-color: ${base};
  background-image:
    ${layers.join(',\n    ')};
}`;
}
