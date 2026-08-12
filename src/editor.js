// Editor app: draggable points, color/animation/effect controls, playback,
// capture, presets, and export. Wraps the runtime engine in gradient.js.

import { initMeshGradient, MAX_POINTS, DEFAULT_CONFIG } from './gradient.js';
import { el, slider } from './controls.js';
import { deriveDark } from './color.js';
import {
  figmaShaderToConfig, refineGridOrderByReference, configToFigmaShaderPaint,
  buildFigmaApplyScript, buildFigmaReadScript, parseFigmaMeshJSON,
} from './figma-import.js?v=6';
import { downloadPNG } from './capture.js';
import {
  PRESETS, configToJSON, parseConfigJSON,
  buildStandaloneJS, buildStandaloneHTML, buildCSSFallback,
} from './presets.js';

const POINT_COLORS = ['#ff6b9d', '#ffd166', '#4d96ff', '#43e6c0', '#845ec2', '#ff9a3c'];
const LS_KEY = 'meshgradient.userpresets';

const FRAME_PRESETS = [
  { label: 'Desktop — 1920 × 1080', w: 1920, h: 1080 },
  { label: 'Laptop — 1440 × 900', w: 1440, h: 900 },
  { label: 'Wide — 2560 × 1440', w: 2560, h: 1440 },
  { label: 'Square — 1080 × 1080', w: 1080, h: 1080 },
  { label: 'Story — 1080 × 1920', w: 1080, h: 1920 },
  { label: 'Banner — 1500 × 500', w: 1500, h: 500 },
];

const stage = document.getElementById('stage');
const frameEl = document.getElementById('frame');
const canvas = document.getElementById('canvas');
const handleLayer = document.getElementById('handles');

const gradient = initMeshGradient(canvas, {}, { pauseWhenHidden: false, autoStart: true });
let config = gradient.getConfig();
let selected = 0;
let mode = 'light'; // 'light' | 'dark' — which palette the editor previews/edits

// Each point stores a light `color` and an optional `darkColor` override;
// when absent, the dark value is derived perceptually from the light color.
function resolveDark(p) { return p.darkColor || deriveDark(p.color); }
function pointColor(p) { return mode === 'dark' ? resolveDark(p) : p.color; }

// ---------------------------------------------------------------- point handles
function pushConfig() {
  const points = config.points.map((p) => ({ x: p.x, y: p.y, spread: p.spread, color: pointColor(p) }));
  gradient.setConfig({ mode: config.mode || 'points', points, animation: config.animation, effects: config.effects });
  if (!gradient.isPlaying()) gradient.redraw();
}

function applyMode(m) {
  mode = m === 'dark' ? 'dark' : 'light';
  const btn = document.getElementById('mode');
  if (btn) btn.textContent = mode === 'dark' ? '◑ Dark' : '◐ Light';
  renderHandles();
  renderPointPanel();
  pushConfig();
}

// Map a point's spread to a handle diameter (px) so the dot reflects its reach.
function handleSize(spread) {
  const s = spread != null ? spread : 1;
  return Math.round(Math.max(14, Math.min(48, 14 + s * 10)));
}

// Full rebuild of handle nodes — only for structural changes (add/remove/load).
function renderHandles() {
  handleLayer.innerHTML = '';
  config.points.forEach((p, i) => {
    const sz = handleSize(p.spread);
    const h = el('button', {
      class: 'handle' + (i === selected ? ' handle--active' : ''),
      style: `left:${p.x * 100}%;top:${p.y * 100}%;width:${sz}px;height:${sz}px;--c:${pointColor(p)}`,
      title: `Point ${i + 1}`,
      'aria-label': `Point ${i + 1}`,
    });
    h.addEventListener('pointerdown', (e) => startDrag(e, i, h));
    handleLayer.appendChild(h);
  });
}

// Lightweight: update active state without recreating nodes (so an in-flight
// drag keeps its element + listeners).
function updateSelectionUI() {
  handleLayer.querySelectorAll('.handle').forEach((h, i) =>
    h.classList.toggle('handle--active', i === selected));
  renderPointPanel();
}

function startDrag(e, i, h) {
  e.preventDefault();
  selected = i;
  updateSelectionUI();
  const rect = frameEl.getBoundingClientRect();
  const move = (ev) => {
    const x = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height));
    config.points[i].x = x;
    config.points[i].y = y;
    h.style.left = x * 100 + '%';
    h.style.top = y * 100 + '%';
    pushConfig();
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function selectPoint(i) {
  selected = i;
  updateSelectionUI();
}

// -------------------------------------------------------------- frame / canvas size
// Letterbox the frame to config.frame's aspect ratio inside the stage, so the
// editor is WYSIWYG for what you'll export. The engine tracks the canvas size.
function fitFrame() {
  const pad = 24;
  const availW = Math.max(1, stage.clientWidth - pad * 2);
  const availH = Math.max(1, stage.clientHeight - pad * 2);
  const ar = config.frame.width / config.frame.height;
  let w = availW;
  let h = w / ar;
  if (h > availH) { h = availH; w = h * ar; }
  frameEl.style.width = Math.round(w) + 'px';
  frameEl.style.height = Math.round(h) + 'px';
  gradient.redraw(); // pick up the new size + aspect immediately
}
if (typeof ResizeObserver === 'function') {
  new ResizeObserver(() => fitFrame()).observe(stage);
}

const framePanel = document.getElementById('frame-panel');
function renderFramePanel() {
  framePanel.innerHTML = '';
  const f = config.frame;
  const matches = FRAME_PRESETS.find((p) => p.w === f.width && p.h === f.height);

  const sel = el('select', { class: 'select' });
  FRAME_PRESETS.forEach((p) =>
    sel.append(el('option', { value: p.w + 'x' + p.h, text: p.label })));
  sel.append(el('option', { value: 'custom', text: 'Custom…' }));
  sel.value = matches ? matches.w + 'x' + matches.h : 'custom';
  sel.addEventListener('change', () => {
    if (sel.value === 'custom') return;
    const [w, h] = sel.value.split('x').map(Number);
    setFrame(w, h);
  });

  const num = (val, on) => el('input', {
    type: 'number', min: '16', max: '8192', step: '1', value: val, class: 'num',
    onchange: (e) => on(Math.max(16, Math.min(8192, Math.round(+e.target.value || 16)))),
  });
  const wIn = num(f.width, (v) => setFrame(v, config.frame.height));
  const hIn = num(f.height, (v) => setFrame(config.frame.width, v));
  const swap = el('button', {
    class: 'btn', text: '⇄', title: 'Swap width/height',
    onclick: () => setFrame(config.frame.height, config.frame.width),
  });

  framePanel.append(
    sel,
    el('div', { class: 'row' }, [
      el('label', { class: 'num-field' }, [el('span', { class: 'muted small', text: 'W' }), wIn]),
      el('label', { class: 'num-field' }, [el('span', { class: 'muted small', text: 'H' }), hIn]),
      swap,
    ]),
    el('div', { class: 'muted small', text: `Exports (PNG / Figma) at ${f.width} × ${f.height}px · code stays responsive` }),
  );
}
function setFrame(w, h) {
  config.frame.width = w;
  config.frame.height = h;
  gradient.setConfig({ frame: config.frame });
  fitFrame();
  renderFramePanel();
}

// ------------------------------------------------------------------ panel: points
const pointsPanel = document.getElementById('points-panel');
function renderPointPanel() {
  pointsPanel.innerHTML = '';
  const p = config.points[selected];

  const swatches = el('div', { class: 'swatch-row' },
    config.points.map((pt, i) =>
      el('button', {
        class: 'swatch' + (i === selected ? ' swatch--active' : ''),
        style: `--c:${pointColor(pt)}`,
        title: `Point ${i + 1}`,
        onclick: () => selectPoint(i),
      })
    )
  );

  const lightInput = el('input', {
    type: 'color', value: p.color,
    oninput: (e) => { config.points[selected].color = e.target.value; renderHandles(); renderPointPanel(); pushConfig(); },
  });
  const overridden = p.darkColor != null;
  const darkInput = el('input', {
    type: 'color', value: resolveDark(p),
    oninput: (e) => { config.points[selected].darkColor = e.target.value; renderHandles(); renderPointPanel(); pushConfig(); },
  });
  const darkTag = overridden
    ? el('button', { class: 'btn btn--ghost small', text: 'auto', title: 'Reset dark to auto-derived',
        onclick: () => { delete config.points[selected].darkColor; renderHandles(); renderPointPanel(); pushConfig(); } })
    : el('span', { class: 'muted small', text: 'auto' });

  const spreadCtl = slider({
    label: 'Spread', min: 0.2, max: 3, step: 0.01,
    value: p.spread != null ? p.spread : 1,
    onInput: (v) => {
      config.points[selected].spread = v;
      const hEl = handleLayer.children[selected];
      if (hEl) { const sz = handleSize(v); hEl.style.width = sz + 'px'; hEl.style.height = sz + 'px'; }
      pushConfig();
    },
  });

  const addBtn = el('button', {
    class: 'btn', text: '+ Add', disabled: config.points.length >= MAX_POINTS ? '' : null,
    onclick: () => {
      if (config.points.length >= MAX_POINTS) return;
      config.points.push({ x: 0.5, y: 0.5, color: POINT_COLORS[config.points.length % POINT_COLORS.length], spread: 1 });
      selected = config.points.length - 1;
      renderHandles();
      renderPointPanel();
      pushConfig();
    },
  });
  const delBtn = el('button', {
    class: 'btn btn--danger', text: 'Remove', disabled: config.points.length <= 2 ? '' : null,
    onclick: () => {
      if (config.points.length <= 2) return;
      config.points.splice(selected, 1);
      selected = Math.max(0, selected - 1);
      renderHandles(); renderPointPanel(); pushConfig();
    },
  });

  const isMesh = config.mode === 'mesh';
  pointsPanel.append(
    swatches,
    el('div', { class: 'row' }, [el('span', { class: 'muted', text: 'Light' }), lightInput]),
    el('div', { class: 'row' }, [el('span', { class: 'muted', text: 'Dark' }), darkInput, darkTag]),
  );
  if (isMesh) {
    pointsPanel.append(
      el('div', { class: 'muted small', text: '4×4 bicubic mesh (Figma-compatible) · 16 fixed grid points · drag dots to move' }),
    );
  } else {
    pointsPanel.append(
      spreadCtl.row,
      el('div', { class: 'row' }, [addBtn, delBtn]),
      el('div', { class: 'muted small', text: `${config.points.length}/${MAX_POINTS} points · drag dots on the canvas to move` }),
    );
  }
}

// -------------------------------------------------------------- panel: animation
const animPanel = document.getElementById('anim-panel');
function renderAnimPanel() {
  animPanel.innerHTML = '';
  const a = config.animation;
  const mk = (key, opts) => slider(Object.assign({
    value: a[key], onInput: (v) => { a[key] = v; pushConfig(); },
  }, opts));
  animPanel.append(
    mk('speed', { label: 'Speed', min: 0, max: 3, step: 0.01 }).row,
    mk('warp', { label: 'Warp', min: 0, max: 2, step: 0.01 }).row,
    mk('noiseScale', { label: 'Flow scale', min: 0.2, max: 4, step: 0.01 }).row,
    mk('noiseSpeed', { label: 'Flow speed', min: 0, max: 0.6, step: 0.005 }).row,
  );
}

// ----------------------------------------------------------------- panel: effects
const fxPanel = document.getElementById('fx-panel');
function renderFxPanel() {
  fxPanel.innerHTML = '';
  const e = config.effects;
  const mk = (key, opts) => slider(Object.assign({
    value: e[key], onInput: (v) => { e[key] = v; pushConfig(); },
  }, opts));
  fxPanel.append(
    mk('falloff', { label: 'Softness', min: 0.6, max: 2.2, step: 0.01, format: (v) => (+v).toFixed(2) }).row,
    mk('vignette', { label: 'Vignette', min: 0, max: 1, step: 0.01 }).row,
    mk('grain', { label: 'Grain', min: 0, max: 0.3, step: 0.005 }).row,
  );
}

// ---------------------------------------------------------------------- playback
const playBtn = document.getElementById('play');
function syncPlayBtn() {
  const playing = gradient.isPlaying();
  playBtn.textContent = playing ? '❚❚ Pause' : '► Play';
  // Points are editing handles: hide them during playback, show when paused.
  handleLayer.classList.toggle('is-hidden', playing);
  // Signal that clicking the gradient will pause it.
  frameEl.classList.toggle('is-playing', playing);
}

// Clicking the gradient pauses it and reveals the points for editing.
// (No-op when already paused, so it never interferes with dragging a point.)
frameEl.addEventListener('click', () => {
  if (gradient.isPlaying()) { gradient.pause(); syncPlayBtn(); }
});
playBtn.addEventListener('click', () => { gradient.toggle(); syncPlayBtn(); });
document.getElementById('reset').addEventListener('click', () => gradient.reset());
document.getElementById('capture').addEventListener('click', () => {
  downloadPNG(gradient, 'mesh-gradient.png', config.frame.width, config.frame.height);
  syncPlayBtn();
});
document.getElementById('mode').addEventListener('click', () => applyMode(mode === 'dark' ? 'light' : 'dark'));

// ----------------------------------------------------------------------- presets
const presetSel = document.getElementById('preset-select');
function loadUserPresets() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
function refreshPresetOptions() {
  const user = loadUserPresets();
  presetSel.innerHTML = '';
  presetSel.append(el('option', { value: '', text: 'Presets…' }));
  const add = (label, keys) => {
    const g = el('optgroup', { label });
    keys.forEach((k) => g.append(el('option', { value: label + ':' + k, text: k })));
    if (keys.length) presetSel.append(g);
  };
  add('Built-in', Object.keys(PRESETS));
  add('Saved', Object.keys(user));
}
presetSel.addEventListener('change', () => {
  const v = presetSel.value;
  if (!v) return;
  const [group, key] = v.split(':');
  const src = group === 'Built-in' ? PRESETS[key] : loadUserPresets()[key];
  if (src) applyConfig(src);
  presetSel.value = '';
});
document.getElementById('save-preset').addEventListener('click', () => {
  const name = prompt('Save preset as:');
  if (!name) return;
  const user = loadUserPresets();
  user[name] = gradient.getConfig();
  localStorage.setItem(LS_KEY, JSON.stringify(user));
  refreshPresetOptions();
});

function applyConfig(next) {
  const prevFrame = config.frame;
  config = JSON.parse(JSON.stringify(next));
  if (!config.mode) config.mode = 'points';
  if (!config.animation) config.animation = { ...DEFAULT_CONFIG.animation };
  if (!config.effects) config.effects = { ...DEFAULT_CONFIG.effects };
  // Color presets carry no frame — keep the user's current canvas size.
  // Imported configs that specify a frame use theirs.
  if (!config.frame) config.frame = { ...(prevFrame || DEFAULT_CONFIG.frame) };
  selected = 0;
  gradient.setConfig(config);
  renderAll();
  syncPlayBtn();
}

// ------------------------------------------------------------------------ figma
const figmaPanel = document.getElementById('figma-panel');

function copyButton(label, getText) {
  const btn = el('button', { class: 'btn', text: label });
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(getText());
      const old = btn.textContent;
      btn.textContent = '✓ Copied';
      setTimeout(() => { btn.textContent = old; }, 1500);
    } catch (err) {
      alert('Copy failed: ' + err.message);
    }
  });
  return btn;
}

function renderFigmaPanel() {
  figmaPanel.innerHTML = '';

  // --- import: always available; how a design gets INTO mesh mode ------------
  const pasteArea = el('textarea', {
    class: 'paste-area', rows: '4', hidden: '',
    placeholder: 'Paste the JSON copied by the read script…',
  });
  const importBtn = el('button', {
    class: 'btn btn--primary', hidden: '', text: 'Import',
    onclick: () => {
      try {
        const { properties, width, height } = parseFigmaMeshJSON(pasteArea.value);
        window.meshGradientEditor.importFigmaShader(properties, {
          width: width || config.frame.width,
          height: height || config.frame.height,
        });
      } catch (err) {
        alert('Import failed: ' + err.message);
      }
    },
  });
  const pasteToggle = el('button', {
    class: 'btn', text: 'Paste mesh JSON…',
    onclick: () => {
      const show = pasteArea.hidden;
      pasteArea.hidden = !show;
      importBtn.hidden = !show;
      if (show) pasteArea.focus();
    },
  });
  figmaPanel.append(
    el('div', { class: 'row wrap' }, [
      copyButton('Copy read script', () => buildFigmaReadScript()),
      pasteToggle,
    ]),
    pasteArea,
    el('div', { class: 'row' }, [importBtn]),
    el('div', { class: 'muted small', text: 'Import: select the meshed layer in Figma desktop, run the read script in Plugins → Development → Console (it copies the mesh as JSON), then paste it here.' }),
  );

  // --- push: mesh mode only --------------------------------------------------
  if (config.mode !== 'mesh' || config.points.length !== 16) {
    figmaPanel.append(
      el('div', { class: 'muted small', text: 'Native Figma export needs a 4×4 mesh design. Start from the "Figma Lattice" preset or import a mesh above — free-point designs can’t map onto Figma’s shader grid.' }),
    );
    return;
  }
  figmaPanel.append(
    el('div', { class: 'row wrap' }, [
      copyButton('Copy apply script', () => buildFigmaApplyScript(config)),
      copyButton('Copy paint JSON', () => JSON.stringify(configToFigmaShaderPaint(config), null, 2)),
    ]),
    el('div', { class: 'muted small', text: 'Push: select the target frame in Figma desktop, run the apply script in the console — the gradient lands as a live editable mesh shader fill. Paint JSON is the raw shader paint, for plugins or an MCP-driven push.' }),
  );
}

// ------------------------------------------------------------------------ export
function download(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.getElementById('export-json').addEventListener('click', () =>
  download('mesh-gradient.json', configToJSON(gradient.getConfig()), 'application/json'));

document.getElementById('import-json').addEventListener('click', () =>
  document.getElementById('import-file').click());
document.getElementById('import-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try { applyConfig(parseConfigJSON(reader.result)); }
    catch (err) { alert('Import failed: ' + err.message); }
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('export-js').addEventListener('click', async () => {
  try { download('mesh-gradient.js', await buildStandaloneJS(gradient.getConfig()), 'text/javascript'); }
  catch (err) { alert('Export failed: ' + err.message); }
});
document.getElementById('export-html').addEventListener('click', async () => {
  try { download('mesh-gradient.html', await buildStandaloneHTML(gradient.getConfig()), 'text/html'); }
  catch (err) { alert('Export failed: ' + err.message); }
});
document.getElementById('export-css').addEventListener('click', () =>
  download('mesh-gradient.css', buildCSSFallback(gradient.getConfig()), 'text/css'));

// --------------------------------------------------------------------------- init
function renderAll() {
  renderFramePanel();
  fitFrame();
  renderHandles();
  renderPointPanel();
  renderAnimPanel();
  renderFxPanel();
  renderFigmaPanel();
}
refreshPresetOptions();
renderAll();
syncPlayBtn();

// Expose the current design for the Figma integration (config + palette + PNG).
window.meshGradientEditor = {
  getConfig: () => JSON.parse(JSON.stringify(config)),
  // Resolved light + dark hex per point — feeds the Figma Light/Dark variables.
  getPalette: () => config.points.map((p, i) => ({ index: i + 1, light: p.color, dark: resolveDark(p) })),
  getMode: () => mode,
  setMode: (m) => applyMode(m),
  capturePNG: (w, h) => gradient.captureDataURL(w || config.frame.width, h || config.frame.height),
  // Import a Figma "Mesh gradient" SHADER fill's raw `properties` object.
  importFigmaShader: (properties, opts) => {
    applyMode('light');
    applyConfig(figmaShaderToConfig(properties, opts));
    pushConfig();
    return config.points.length;
  },
  // Build a native Figma SHADER paint from the current mesh-mode design —
  // assign it into any node's fills via the Plugin API to apply this gradient
  // as a live, editable Figma mesh shader fill.
  getFigmaShaderPaint: (opts) => configToFigmaShaderPaint(config, opts),
  // Verified import: additionally refines the recovered 4x4 grid topology
  // against a reference render of the Figma node (same-origin or data: URL),
  // hill-climbing slot swaps until the pixel delta stops improving.
  importFigmaShaderVerified: async (properties, referenceURL, opts) => {
    const cfg = figmaShaderToConfig(properties, opts);
    let residual = null;
    if (cfg.mode === 'mesh' && referenceURL) {
      const refined = await refineGridOrderByReference(cfg.points, referenceURL);
      cfg.points = refined.points;
      residual = refined.residual;
    }
    applyMode('light');
    applyConfig(cfg);
    pushConfig();
    return { points: config.points.length, mode: cfg.mode, residual };
  },
};
