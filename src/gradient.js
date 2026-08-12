// The mesh gradient runtime. This is the SINGLE SOURCE OF TRUTH: the editor runs
// this exact code, and "Export Code" ships this file verbatim. No dependencies.
//
//   const gradient = initMeshGradient(canvas, config, options);
//   gradient.play(); gradient.pause(); gradient.setConfig({ ... });
//
import { VERT, FRAG } from './shader.glsl.js';
import { VERT_MESH, FRAG_MESH } from './shader-mesh.js';

export const MAX_POINTS = 16;
const MESH_TESS = 128; // matches Figma's default tessellation quality

export const DEFAULT_CONFIG = {
  // 'points' = free inverse-distance points; 'mesh' = 4x4 Catmull-Rom bicubic
  // grid (Figma-compatible). In mesh mode, points[] holds exactly 16 entries in
  // row-major grid order (p00,p10,p20,p30, p01,...), spread is ignored.
  mode: 'points',
  points: [
    { x: 0.15, y: 0.20, color: '#5b3cc4' }, // indigo
    { x: 0.85, y: 0.15, color: '#9d4edd' }, // violet
    { x: 0.20, y: 0.80, color: '#ff5d8f' }, // pink
    { x: 0.60, y: 0.95, color: '#ff8a5b' }, // coral
    { x: 0.90, y: 0.75, color: '#ffd166' }, // gold
  ],
  animation: { play: true, speed: 0.85, noiseScale: 1.3, noiseSpeed: 0.12, warp: 0.7 },
  effects:   { falloff: 1.1, grain: 0.045, vignette: 0.18 },
  // Editor/export metadata only — the runtime ignores this and sizes to its
  // container. It sets the design aspect ratio and the PNG export resolution.
  frame:     { width: 1920, height: 1080 },
};

// ---- small helpers -----------------------------------------------------------
function clone(o) { return JSON.parse(JSON.stringify(o)); }

function mergeConfig(base, over) {
  const c = clone(base);
  if (!over) return c;
  if (over.mode) c.mode = over.mode;
  if (over.points) c.points = clone(over.points);
  if (over.animation) Object.assign(c.animation, over.animation);
  if (over.effects) Object.assign(c.effects, over.effects);
  if (over.frame) Object.assign(c.frame, over.frame);
  return c;
}

function hexToRgb(hex) {
  let h = (hex || '#000000').replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function srgb2lin(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error('Shader compile error: ' + log);
  }
  return s;
}

// ---- the engine --------------------------------------------------------------
export function initMeshGradient(canvas, userConfig = {}, options = {}) {
  const opts = Object.assign({
    maxDpr: 2,
    respectReducedMotion: true,
    pauseWhenHidden: true,
    autoStart: true,
  }, options);

  const gl = canvas.getContext('webgl', {
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true, // needed for reliable PNG capture
  });
  if (!gl) throw new Error('WebGL is not supported in this browser.');

  let config = mergeConfig(DEFAULT_CONFIG, userConfig);

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG(MAX_POINTS)));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('Program link error: ' + gl.getProgramInfoLog(prog));
  }
  gl.useProgram(prog);

  // full-screen quad
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPosition = gl.getAttribLocation(prog, 'aPosition');
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  const ARRAY_UNIFORMS = { uPoints: 1, uColors: 1, uSpread: 1 };
  ['uTime', 'uResolution', 'uAspect', 'uCount', 'uPoints', 'uColors', 'uSpread',
   'uWarp', 'uNoiseScale', 'uFalloff', 'uGrain', 'uVignette']
    .forEach((n) => { U[n] = gl.getUniformLocation(prog, ARRAY_UNIFORMS[n] ? n + '[0]' : n); });

  const posBuf = new Float32Array(MAX_POINTS * 2);
  const colBuf = new Float32Array(MAX_POINTS * 3);
  const spreadBuf = new Float32Array(MAX_POINTS).fill(1);

  // ---- bicubic mesh mode: second program + tessellated (s,t) grid ------------
  const meshProg = gl.createProgram();
  gl.attachShader(meshProg, compile(gl, gl.VERTEX_SHADER, VERT_MESH));
  gl.attachShader(meshProg, compile(gl, gl.FRAGMENT_SHADER, FRAG_MESH));
  gl.linkProgram(meshProg);
  if (!gl.getProgramParameter(meshProg, gl.LINK_STATUS)) {
    throw new Error('Mesh program link error: ' + gl.getProgramInfoLog(meshProg));
  }
  const MU = {};
  ['uCtrlPos', 'uCtrlColor', 'uTime', 'uGrain'].forEach((n) => {
    MU[n] = gl.getUniformLocation(meshProg, (n === 'uCtrlPos' || n === 'uCtrlColor') ? n + '[0]' : n);
  });
  const aST = gl.getAttribLocation(meshProg, 'aST');

  // (s,t) grid: (T+1)^2 vertices, T*T*2 triangles, Uint16 indices (WebGL1-safe)
  const T = MESH_TESS, NV = T + 1;
  const stData = new Float32Array(NV * NV * 2);
  for (let j = 0, o = 0; j < NV; j++) for (let i = 0; i < NV; i++) {
    stData[o++] = i / T; stData[o++] = j / T;
  }
  const idxData = new Uint16Array(T * T * 6);
  for (let j = 0, o = 0; j < T; j++) for (let i = 0; i < T; i++) {
    const i0 = j * NV + i, i1 = i0 + 1, i2 = i0 + NV, i3 = i2 + 1;
    idxData[o++] = i0; idxData[o++] = i2; idxData[o++] = i1;
    idxData[o++] = i1; idxData[o++] = i2; idxData[o++] = i3;
  }
  const stBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, stBuf);
  gl.bufferData(gl.ARRAY_BUFFER, stData, gl.STATIC_DRAW);
  const idxBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxData, gl.STATIC_DRAW);

  const ctrlPosBuf = new Float32Array(16 * 2);
  const ctrlColBuf = new Float32Array(16 * 3);

  let time = 0;
  let lastT = 0;
  let raf = null;
  let playing = false;
  const reduce = opts.respectReducedMotion &&
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Size the backing store. With no args, tracks the container responsively
  // (this is what the exported runtime always does). With forced w/h it renders
  // at an exact resolution — used only for capture/export.
  function resize(forceW, forceH) {
    let w, h;
    if (forceW) {
      w = Math.max(1, Math.round(forceW));
      h = Math.max(1, Math.round(forceH));
    } else {
      const dpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr);
      w = Math.max(1, Math.round((canvas.clientWidth || canvas.width) * dpr));
      h = Math.max(1, Math.round((canvas.clientHeight || canvas.height) * dpr));
    }
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function render() {
    if (config.mode === 'mesh' && config.points.length === 16) renderMesh();
    else renderPoints();
  }

  // Deterministic per-point phase hash (no Math.random — keeps renders stable).
  function hash01(n) { const s = Math.sin(n) * 43758.5453; return s - Math.floor(s); }

  function renderMesh() {
    const a = config.animation, e = config.effects;
    // The mesh animates by drifting the 16 control points themselves, so the
    // bicubic surface genuinely flexes. Each point gets a two-band oscillator
    // with hashed phases/frequencies. Border points may only slide ALONG their
    // edge and corners stay pinned — the boundary curve of the surface depends
    // solely on its border points, so frame edges stay exactly straight.
    const t = time * a.noiseSpeed * 10.0;
    const amp = a.warp * 0.14;
    const fs = a.noiseScale;
    let mr = 0, mg = 0, mb = 0;
    for (let i = 0; i < 16; i++) {
      const p = config.points[i];
      let dx = 0, dy = 0;
      if (amp > 0) {
        const f1 = fs * (0.8 + 0.5 * hash01(i * 12.99 + 1));
        const f2 = fs * (1.7 + 0.9 * hash01(i * 12.99 + 2));
        const f3 = fs * (0.9 + 0.5 * hash01(i * 12.99 + 3));
        const f4 = fs * (1.5 + 0.9 * hash01(i * 12.99 + 4));
        const P = 6.2832;
        dx = amp * (0.65 * Math.sin(t * f1 + P * hash01(i * 78.23 + 1)) +
                    0.35 * Math.sin(t * f2 + P * hash01(i * 78.23 + 2)));
        dy = amp * (0.65 * Math.sin(t * f3 + P * hash01(i * 78.23 + 3)) +
                    0.35 * Math.sin(t * f4 + P * hash01(i * 78.23 + 4)));
        // pin motion perpendicular to any frame edge the point sits on
        if (Math.abs(p.x) < 0.02 || Math.abs(p.x - 1) < 0.02) dx = 0;
        if (Math.abs(p.y) < 0.02 || Math.abs(p.y - 1) < 0.02) dy = 0;
      }
      ctrlPosBuf[i * 2] = p.x + dx;
      ctrlPosBuf[i * 2 + 1] = p.y + dy; // mesh vertex shader is y-down, like the UI
      const rgb = hexToRgb(p.color);
      ctrlColBuf[i * 3] = srgb2lin(rgb[0]);
      ctrlColBuf[i * 3 + 1] = srgb2lin(rgb[1]);
      ctrlColBuf[i * 3 + 2] = srgb2lin(rgb[2]);
      mr += rgb[0]; mg += rgb[1]; mb += rgb[2];
    }
    gl.useProgram(meshProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, stBuf);
    gl.enableVertexAttribArray(aST);
    gl.vertexAttribPointer(aST, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.uniform2fv(MU.uCtrlPos, ctrlPosBuf);
    gl.uniform3fv(MU.uCtrlColor, ctrlColBuf);
    gl.uniform1f(MU.uTime, time * a.noiseSpeed);
    gl.uniform1f(MU.uGrain, e.grain);
    // clear to the mean control color so any warp-exposed sliver isn't black
    gl.clearColor(mr / 16, mg / 16, mb / 16, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, T * T * 6, gl.UNSIGNED_SHORT, 0);
  }

  function renderPoints() {
    const pts = config.points.slice(0, MAX_POINTS);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
    for (let i = 0; i < pts.length; i++) {
      posBuf[i * 2] = pts[i].x;
      posBuf[i * 2 + 1] = 1.0 - pts[i].y; // flip: UI y-down -> GL y-up
      const rgb = hexToRgb(pts[i].color);
      colBuf[i * 3] = rgb[0];
      colBuf[i * 3 + 1] = rgb[1];
      colBuf[i * 3 + 2] = rgb[2];
      spreadBuf[i] = pts[i].spread != null ? pts[i].spread : 1.0;
    }
    const a = config.animation, e = config.effects;
    gl.uniform1f(U.uTime, time * a.noiseSpeed);
    gl.uniform2f(U.uResolution, canvas.width, canvas.height);
    gl.uniform1f(U.uAspect, canvas.width / Math.max(1, canvas.height));
    gl.uniform1i(U.uCount, pts.length);
    gl.uniform2fv(U.uPoints, posBuf);
    gl.uniform3fv(U.uColors, colBuf);
    gl.uniform1fv(U.uSpread, spreadBuf);
    gl.uniform1f(U.uWarp, a.warp);
    gl.uniform1f(U.uNoiseScale, a.noiseScale);
    gl.uniform1f(U.uFalloff, e.falloff);
    gl.uniform1f(U.uGrain, e.grain);
    gl.uniform1f(U.uVignette, e.vignette);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function draw() { resize(); render(); }

  function frame(now) {
    if (!playing) return;
    const dt = lastT ? (now - lastT) / 1000 : 0;
    lastT = now;
    time += dt * config.animation.speed;
    draw();
    raf = requestAnimationFrame(frame);
  }

  function play() {
    if (playing) return;
    if (reduce) { draw(); return; } // honor reduced-motion: render a still frame
    playing = true;
    lastT = 0;
    raf = requestAnimationFrame(frame);
  }

  function pause() {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    draw();
  }

  // pause when the tab is hidden so we never burn GPU in the background
  let resumeOnShow = false;
  function onVisibility() {
    if (!opts.pauseWhenHidden) return;
    if (document.hidden) { resumeOnShow = playing; pause(); }
    else if (resumeOnShow) { play(); }
  }
  document.addEventListener('visibilitychange', onVisibility);

  // pause when scrolled off-screen
  let io = null;
  if (opts.pauseWhenHidden && typeof IntersectionObserver === 'function') {
    io = new IntersectionObserver((entries) => {
      const visible = entries[0].isIntersecting;
      if (!visible && playing) { resumeOnShow = true; pause(); }
      else if (visible && resumeOnShow) { resumeOnShow = false; play(); }
    }, { threshold: 0 });
    io.observe(canvas);
  }

  let ro = null;
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(() => { if (!playing) draw(); });
    ro.observe(canvas);
  }

  const controller = {
    canvas, gl,
    play, pause,
    toggle() { playing ? pause() : play(); return playing; },
    isPlaying() { return playing; },
    redraw: draw,
    reset() { time = 0; draw(); },
    seek(t) { time = t; draw(); },
    getTime() { return time; },
    getConfig() { return clone(config); },
    setConfig(partial) {
      config = mergeConfig(config, partial);
      // sync animation.play intent
      if (partial.animation && typeof partial.animation.play === 'boolean') {
        partial.animation.play ? play() : pause();
      } else if (!playing) {
        draw();
      }
    },
    // Freeze the current frame, render it at an exact resolution (defaults to
    // the config frame size), read it back, then restore the responsive canvas.
    // Stays paused on the captured frame. Returns a Promise<Blob>.
    capture(width, height, type = 'image/png', quality) {
      const w = width || config.frame.width;
      const h = height || config.frame.height;
      pause();
      resize(w, h);
      render();
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resize(); render(); // back to on-screen responsive size
          resolve(blob);
        }, type, quality);
      });
    },
    captureDataURL(width, height, type = 'image/png', quality) {
      const w = width || config.frame.width;
      const h = height || config.frame.height;
      pause();
      resize(w, h);
      render();
      const url = canvas.toDataURL(type, quality);
      resize(); render();
      return url;
    },
    destroy() {
      pause();
      document.removeEventListener('visibilitychange', onVisibility);
      if (io) io.disconnect();
      if (ro) ro.disconnect();
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
      gl.deleteProgram(meshProg);
      gl.deleteBuffer(stBuf);
      gl.deleteBuffer(idxBuf);
    },
  };

  draw();
  if (opts.autoStart && config.animation.play) play();
  return controller;
}
