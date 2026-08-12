// The mesh gradient runtime. This is the SINGLE SOURCE OF TRUTH: the editor runs
// this exact code, and "Export Code" ships this file verbatim. No dependencies.
//
//   const gradient = initMeshGradient(canvas, config, options);
//   gradient.play(); gradient.pause(); gradient.setConfig({ ... });
//
import { VERT, FRAG } from './shader.glsl.js';

export const MAX_POINTS = 16;

export const DEFAULT_CONFIG = {
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
    const pts = config.points.slice(0, MAX_POINTS);
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
    },
  };

  draw();
  if (opts.autoStart && config.animation.play) play();
  return controller;
}
