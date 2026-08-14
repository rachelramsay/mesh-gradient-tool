// Plugin panel editor. Runs against the SAME engine code as the web tool —
// the build script (build_plugin.py) bundles src/*.js above this file, plus an
// ENGINE_SRC string used for the code exports. Outside Figma (opened directly
// in a browser for testing) Figma-side actions are stubbed.

const PANEL_VERSION = 15; // bump on each build_plugin.py rebuild worth telling apart
const IN_FIGMA = window.parent !== window;
const $ = (id) => document.getElementById(id);
const post = (msg) => { if (IN_FIGMA) parent.postMessage({ pluginMessage: msg }, '*'); };

const statusEl = $('status');
function setStatus(text, isError) {
  statusEl.textContent = text || '';
  statusEl.className = isError ? 'err' : '';
}

// ---- state ------------------------------------------------------------------
let config = JSON.parse(JSON.stringify(PRESETS['Figma Lattice']));
config.frame = { width: 1440, height: 580 };
let mode = 'light';
let selected = 0;
let userPresets = {}; // name -> config, persisted via clientStorage

const resolveDark = (p) => p.darkColor || deriveDark(p.color);
const pointColor = (p) => (mode === 'dark' ? resolveDark(p) : p.color);

const canvas = $('cv');
const engine = initMeshGradient(canvas, config, { pauseWhenHidden: false });

function pushCfg() {
  engine.setConfig({
    mode: config.mode || 'points',
    points: config.points.map((p) => ({ x: p.x, y: p.y, spread: p.spread, color: pointColor(p) })),
    animation: config.animation,
    effects: config.effects,
  });
}

// ---- playback / mode --------------------------------------------------------
function syncPlayUI() {
  const playing = engine.isPlaying();
  $('play').textContent = playing ? '❚❚' : '►';
  $('handles').classList.toggle('hide', playing);
}
$('play').onclick = () => { engine.toggle(); syncPlayUI(); };
canvas.addEventListener('click', () => {
  if (engine.isPlaying()) { engine.pause(); syncPlayUI(); }
});
$('modebtn').onclick = () => {
  mode = mode === 'light' ? 'dark' : 'light';
  $('modebtn').textContent = mode === 'dark' ? '◑ Dark' : '◐ Light';
  renderPoints(); pushCfg();
};

// ---- point handles + swatches ----------------------------------------------
function renderPoints() {
  const layer = $('handles');
  layer.innerHTML = '';
  config.points.forEach((p, i) => {
    const h = document.createElement('button');
    h.className = 'handle' + (i === selected ? ' on' : '');
    h.style.left = (p.x * 100) + '%';
    h.style.top = (p.y * 100) + '%';
    h.style.setProperty('--c', pointColor(p));
    h.addEventListener('pointerdown', (e) => startDrag(e, i, h));
    layer.appendChild(h);
  });
  const sw = $('swatches');
  sw.innerHTML = '';
  config.points.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'swatch' + (i === selected ? ' on' : '');
    b.style.setProperty('--c', pointColor(p));
    b.onclick = () => { selected = i; renderPoints(); };
    sw.appendChild(b);
  });
  const p = config.points[selected];
  $('clight').value = p.color;
  $('cdark').value = resolveDark(p);
  $('cauto').style.opacity = p.darkColor ? 1 : 0.4;
}

function startDrag(e, i, h) {
  e.preventDefault();
  selected = i;
  renderPoints();
  const rect = $('stage').getBoundingClientRect();
  const move = (ev) => {
    const x = Math.min(1.35, Math.max(-0.35, (ev.clientX - rect.left) / rect.width));
    const y = Math.min(1.35, Math.max(-0.35, (ev.clientY - rect.top) / rect.height));
    config.points[i].x = x;
    config.points[i].y = y;
    h.style.left = (x * 100) + '%';
    h.style.top = (y * 100) + '%';
    pushCfg();
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

$('clight').oninput = (e) => { config.points[selected].color = e.target.value; renderPoints(); pushCfg(); };
$('cdark').oninput = (e) => { config.points[selected].darkColor = e.target.value; renderPoints(); pushCfg(); };
$('cauto').onclick = () => { delete config.points[selected].darkColor; renderPoints(); pushCfg(); };

// ---- sliders ----------------------------------------------------------------
const SLIDERS = [
  ['Speed', 'animation', 'speed', 0, 3, 0.01],
  ['Warp', 'animation', 'warp', 0, 2, 0.01],
  ['Flow scale', 'animation', 'noiseScale', 0.2, 4, 0.01],
  ['Flow speed', 'animation', 'noiseSpeed', 0, 0.6, 0.005],
  ['Softness', 'effects', 'falloff', 0.6, 2.2, 0.01],
  ['Grain', 'effects', 'grain', 0, 0.3, 0.005],
];
function renderSliders() {
  const host = $('sliders');
  host.innerHTML = '';
  for (const [label, group, key, min, max, step] of SLIDERS) {
    const row = document.createElement('div');
    row.className = 'sld';
    const out = document.createElement('output');
    const input = document.createElement('input');
    input.type = 'range'; input.min = min; input.max = max; input.step = step;
    input.value = config[group][key];
    out.value = (+config[group][key]).toFixed(2);
    input.oninput = () => {
      config[group][key] = +input.value;
      out.value = (+input.value).toFixed(2);
      pushCfg();
    };
    const span = document.createElement('span');
    span.textContent = label;
    row.append(span, input, out);
    host.appendChild(row);
  }
}

// ---- presets ----------------------------------------------------------------
function renderPresets() {
  const sel = $('preset');
  sel.innerHTML = '<option value="">Presets…</option>';
  for (const name of Object.keys(PRESETS)) sel.add(new Option(name, 'b:' + name));
  for (const name of Object.keys(userPresets)) sel.add(new Option(name + ' (saved)', 'u:' + name));
}
$('preset').onchange = () => {
  const v = $('preset').value;
  if (!v) return;
  const src = v[0] === 'b' ? PRESETS[v.slice(2)] : userPresets[v.slice(2)];
  if (src) {
    const frame = config.frame;
    config = JSON.parse(JSON.stringify(src));
    if (!config.frame) config.frame = frame;
    selected = 0;
    applyAll();
    if (pulledPalette && pulledPalette.length) {
      setStatus('Preset loaded with its own colors — press "Pull colors" to apply your tokens to this layout.');
    }
  }
  $('preset').value = '';
};
$('savepreset').onclick = () => {
  const name = prompt('Save preset as:');
  if (!name) return;
  userPresets[name] = JSON.parse(JSON.stringify(config));
  post({ type: 'save-presets', presets: userPresets });
  renderPresets();
  setStatus('Preset saved.');
};

// ---- Figma actions ----------------------------------------------------------
$('importsel').onclick = () => {
  if (!IN_FIGMA) return setStatus('Import needs to run inside Figma.', true);
  setStatus('Reading selection…');
  post({ type: 'import-selection' });
};

// When a custom shader mapping is captured, Apply targets the user's own
// shader (e.g. the bundled custom-shader/, which animates on the canvas)
// instead of the stock account-library mesh shader.
let customShaderMap = null;

function updateShaderTarget() {
  $('shadertarget').textContent = customShaderMap
    ? 'target: your custom shader'
    : 'target: stock mesh';
}

const LATTICE = [0, 33, 67, 100];
const NUM_DEFAULTS = { 128: 'tessellation', 0.6: 'speed', 0.5: 'warp', 1.2: 'flowScale' };
function deriveShaderMap(id, properties) {
  const slots = new Array(16).fill(null);
  const nums = {};
  for (const key in properties) {
    const v = properties[key];
    if (v && typeof v === 'object' && typeof v.x === 'number') {
      for (let i = 0; i < 16; i++) {
        if (Math.abs(v.x - LATTICE[i % 4]) < 1.5 && Math.abs(v.y - LATTICE[(i / 4) | 0]) < 1.5) {
          slots[i] = key;
          break;
        }
      }
    } else if (typeof v === 'number') {
      for (const d in NUM_DEFAULTS) {
        if (Math.abs(v - +d) < 0.001) { nums[NUM_DEFAULTS[d]] = key; break; }
      }
    }
  }
  if (slots.some((s) => !s)) return null; // needs the shader at default positions
  return { id, slots, nums };
}

function buildCustomPaint() {
  const m = customShaderMap;
  const properties = {};
  config.points.forEach((p, i) => {
    const [r, g, b] = hexToRgb01(p.color);
    properties[m.slots[i]] = { x: p.x * 100, y: p.y * 100, color: { r, g, b, a: 1 } };
  });
  if (m.nums.tessellation) properties[m.nums.tessellation] = 128;
  if (m.nums.speed) properties[m.nums.speed] = config.animation.speed;
  if (m.nums.warp) properties[m.nums.warp] = config.animation.warp;
  if (m.nums.flowScale) properties[m.nums.flowScale] = config.animation.noiseScale;
  return { type: 'SHADER', visible: true, opacity: 1, blendMode: 'NORMAL', id: m.id, properties };
}

$('captureshader').onclick = () => {
  if (!IN_FIGMA) return setStatus('Capture needs to run inside Figma.', true);
  setStatus('Reading selection’s shader…');
  post({ type: 'capture-shader' });
};

$('applymesh').onclick = () => {
  try {
    if (config.mode !== 'mesh' || config.points.length !== 16) {
      throw new Error('Figma shader export requires mesh mode with 16 grid points.');
    }
    const paint = customShaderMap ? buildCustomPaint() : configToFigmaShaderPaint(config);
    if (!IN_FIGMA) return setStatus('Apply needs to run inside Figma.', true);
    post({ type: 'apply-shader', paint });
  } catch (err) {
    setStatus(err.message, true); // e.g. not in mesh mode
  }
};

$('applyimg').onclick = () => {
  if (!IN_FIGMA) return setStatus('Apply needs to run inside Figma.', true);
  setStatus('Checking selection…');
  post({ type: 'image-size-request' });
};

$('mkvars').onclick = () => {
  if (!IN_FIGMA) return setStatus('Variables need to run inside Figma.', true);
  const palette = config.points.map((p, i) => ({
    name: 'mesh/point-' + String(i + 1).padStart(2, '0'),
    light: p.color,
    dark: resolveDark(p),
  }));
  post({ type: 'make-variables', palette });
};

// ---- variable collection link: pull/push point colors from Figma variables --
// The last pulled token palette is the ACTIVE palette: it tiles across all
// points of the current design and re-applies whenever a preset loads, so
// presets supply layout/motion while the tokens supply color.
let pulledPalette = null;
function applyPulledPalette() {
  if (!pulledPalette || !pulledPalette.length) return;
  config.points.forEach((p, i) => {
    const v = pulledPalette[i % pulledPalette.length];
    p.color = rgb01ToHex(v.light.r, v.light.g, v.light.b);
    if (v.dark) p.darkColor = rgb01ToHex(v.dark.r, v.dark.g, v.dark.b);
    else delete p.darkColor;
  });
}
$('varcol').onchange = () => {
  const id = $('varcol').value;
  if (!IN_FIGMA) return setStatus('Variables need to run inside Figma.', true);
  post({ type: 'link-collection', collectionId: id || null });
  if (!id) { $('varmodes').hidden = true; $('varmodes').innerHTML = ''; pulledPalette = null; }
  setStatus(id
    ? 'Linked. Pull loads its Light/Dark values; Push writes edits back. (Figma can’t bind shader colors to variables yet — this sync is the bridge; re-pull after token changes.)'
    : 'Variables unlinked.');
};
$('pullvars').onclick = () => {
  if (!IN_FIGMA) return setStatus('Variables need to run inside Figma.', true);
  if (!$('varcol').value) return setStatus('Link a variable collection first.', true);
  setStatus('Resolving variables…');
  post({ type: 'pull-variables' });
};

// ---- web tool sync (optional — needs serve.py running) ----------------------
const WEB_BASE = 'http://localhost:5599';
$('pullweb').onclick = async () => {
  try {
    const data = await (await fetch(WEB_BASE + '/api/design')).json();
    const paint = data && data.payload && data.payload.paint;
    if (!paint) return setStatus('Web tool has no mesh design published.', true);
    const frame = (data.payload.frame) || { width: 1440, height: 580 };
    config = figmaShaderToConfig(paint.properties, frame);
    config.frame = frame;
    selected = 0;
    applyAll();
    setStatus('Loaded the web tool’s current design.');
  } catch (e) {
    setStatus('Web tool not reachable — run "python3 serve.py 5599".', true);
  }
};
$('sendweb').onclick = async () => {
  try {
    const paint = configToFigmaShaderPaint(config);
    await fetch(WEB_BASE + '/api/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ width: config.frame.width, height: config.frame.height, properties: paint.properties }),
    });
    setStatus('Sent — an import banner appears in the web tool.');
  } catch (e) {
    setStatus(e.message.includes('mesh') ? e.message : 'Web tool not reachable — run "python3 serve.py 5599".', true);
  }
};

// ---- code exports -----------------------------------------------------------
function standaloneJS() {
  const cfg = engine.getConfig();
  return '/* Animated mesh gradient - self-contained, no dependencies.\n' +
    '   Add <canvas id="gradient" style="width:100%;height:100vh"></canvas> to your page. */\n' +
    '(function (root) {\n' + ENGINE_SRC + '\n' +
    'var CONFIG = ' + JSON.stringify(cfg, null, 2) + ';\n' +
    'function boot() { var c = document.getElementById("gradient"); if (c) root.meshGradient = initMeshGradient(c, CONFIG); }\n' +
    'if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", boot); } else { boot(); }\n' +
    'root.initMeshGradient = initMeshGradient;\n' +
    '})(typeof window !== "undefined" ? window : this);\n';
}
function standaloneHTML() {
  const js = standaloneJS().replace(/<\/script/gi, '<\\/script');
  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>Mesh Gradient</title>\n' +
    '<style>html,body{margin:0;height:100%}#gradient{display:block;width:100vw;height:100vh}</style>\n' +
    '</head>\n<body>\n<canvas id="gradient"></canvas>\n<script>\n' + js + '\n</scr' + 'ipt>\n</body>\n</html>\n';
}
function copyText(text, label) {
  const ta = $('clip');
  ta.value = text;
  ta.select();
  try {
    document.execCommand('copy');
    setStatus(label + ' copied to clipboard.');
  } catch (e) {
    setStatus('Copy failed: ' + e.message, true);
  }
  ta.blur();
}
$('copyjs').onclick = () => copyText(standaloneJS(), 'JS drop-in');
$('copyhtml').onclick = () => copyText(standaloneHTML(), 'HTML page');

// ---- messages from the Figma main thread ------------------------------------
window.onmessage = async (event) => {
  const msg = event.data && event.data.pluginMessage;
  if (!msg) return;

  if (msg.type === 'status') {
    setStatus(msg.error || msg.ok, !!msg.error);

  } else if (msg.type === 'presets') {
    userPresets = msg.presets || {};
    renderPresets();

  } else if (msg.type === 'shader-map') {
    customShaderMap = msg.map || null;
    updateShaderTarget();

  } else if (msg.type === 'collections') {
    const sel = $('varcol');
    sel.innerHTML = '<option value="">Variables: not linked</option>';
    for (const c of msg.list) {
      sel.add(new Option(c.name + ' (' + c.colorCount + ' colors)', c.id));
    }
    if (msg.linkedId) sel.value = msg.linkedId;
    setStatus('Ready (v' + PANEL_VERSION + ') — ' + msg.list.length + ' variable collection(s) found.');

  } else if (msg.type === 'collection-modes') {
    // The linked collection's aliases pass through collections with their own
    // themes (multiple modes, none named light/dark) — render a picker for
    // each so the user chooses which theme the Light/Dark values resolve in.
    const host = $('varmodes');
    host.innerHTML = '';
    host.hidden = !msg.hops.length;
    for (const hop of msg.hops) {
      const row = document.createElement('div');
      row.className = 'row';
      const label = document.createElement('span');
      label.className = 'lbl';
      label.textContent = hop.name + ' theme';
      const sel = document.createElement('select');
      for (const m of hop.modes) sel.add(new Option(m.name, m.modeId));
      sel.value = (msg.overrides && msg.overrides[hop.id]) || hop.defaultModeId;
      sel.onchange = () => {
        post({ type: 'set-mode-override', collectionId: hop.id, modeId: sel.value });
        setStatus('Theme set — Pull colors to re-resolve.');
      };
      row.append(label, sel);
      host.appendChild(row);
    }

  } else if (msg.type === 'variables-pulled') {
    pulledPalette = msg.palette.filter((v) => v.light);
    if (!pulledPalette.length) {
      pulledPalette = null;
      return setStatus('No resolvable colors in that collection.', true);
    }
    applyPulledPalette();
    renderPoints();
    pushCfg();
    setStatus('Applied ' + pulledPalette.length + ' token colors across ' + config.points.length +
      ' points. Preset switches keep their own colors — Pull again to re-apply tokens.');

  } else if (msg.type === 'shader-captured') {
    const map = deriveShaderMap(msg.id, msg.properties);
    if (!map) {
      setStatus('Couldn’t map that shader — apply it with DEFAULT point positions first, then capture.', true);
    } else {
      customShaderMap = map;
      post({ type: 'save-shader-map', map });
      updateShaderTarget();
      setStatus('Apply now targets your shader (' + Object.keys(map.nums).length + ' animation params mapped).');
    }

  } else if (msg.type === 'selection-mesh') {
    // properties + node size + optional PNG reference for topology refinement
    let cfg = figmaShaderToConfig(msg.properties, { width: msg.width, height: msg.height });
    if (cfg.mode === 'mesh' && msg.refBytes) {
      try {
        const blob = new Blob([new Uint8Array(msg.refBytes)], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        const refined = await refineGridOrderByReference(cfg.points, url);
        cfg.points = refined.points;
        URL.revokeObjectURL(url);
      } catch (e) { /* fall back to the analytic recovery */ }
    }
    config = cfg;
    config.frame = { width: msg.width, height: msg.height };
    selected = 0;
    applyAll();
    setStatus('Imported ' + config.points.length + '-point mesh from selection.');

  } else if (msg.type === 'image-size') {
    setStatus('Rendering frame…');
    const blob = await engine.capture(msg.width, msg.height);
    syncPlayUI(); // capture pauses
    const bytes = new Uint8Array(await blob.arrayBuffer());
    post({ type: 'apply-image', bytes });
  }
};

// ---- boot -------------------------------------------------------------------
function applyAll() {
  mode = 'light';
  $('modebtn').textContent = '◐ Light';
  pushCfg();
  renderPoints();
  renderSliders();
  syncPlayUI();
}
applyAll();
renderPresets();
updateShaderTarget();
post({ type: 'get-presets' });
post({ type: 'get-shader-map' });
post({ type: 'get-collections' });
if (!IN_FIGMA) setStatus('Browser test mode — Figma actions disabled.');
