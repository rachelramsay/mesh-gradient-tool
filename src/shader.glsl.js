// Shader source for the animated mesh gradient.
// Kept dependency-free and WebGL1 (GLSL ES 1.00) for maximum portability.

export const VERT = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// FRAG is a function of MAX_POINTS so the same source powers both the editor
// and the exported standalone runtime (which inlines this file verbatim).
export const FRAG = (maxPoints) => `
precision highp float;
#define MAX_POINTS ${maxPoints}

varying vec2 vUv;

uniform float uTime;
uniform vec2  uResolution;
uniform float uAspect;
uniform int   uCount;
uniform vec2  uPoints[MAX_POINTS];
uniform vec3  uColors[MAX_POINTS];
uniform float uSpread[MAX_POINTS]; // per-point radius of influence

uniform float uWarp;        // domain-warp amount
uniform float uNoiseScale;  // spatial frequency of the flow
uniform float uFalloff;     // blend falloff (higher = sharper points)
uniform float uGrain;       // film grain amount
uniform float uVignette;    // corner darkening

// --- 2D simplex noise (Ashima / Stefan Gustavson, public domain) ---
vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x){ return mod289(((x * 34.0) + 1.0) * x); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 uv = vUv;
  vec2 aspect = vec2(uAspect, 1.0);

  // --- domain warp: noise offsets the sample point over time -> organic flow
  float t = uTime;
  vec2 warp = vec2(
    snoise(uv * uNoiseScale + vec2(0.0, t)),
    snoise(uv * uNoiseScale + vec2(5.2, t + 1.3))
  );
  vec2 p = uv + warp * (uWarp * 0.18);

  // --- weighted blend of all color points (inverse-distance mesh)
  vec3 color = vec3(0.0);
  float total = 0.0;
  for (int i = 0; i < MAX_POINTS; i++) {
    if (i >= uCount) break;
    vec2 d = (p - uPoints[i]) * aspect;
    float s = max(uSpread[i], 0.05);
    float dist2 = dot(d, d) / (s * s) + 0.0008; // larger spread -> wider reach
    float w = 1.0 / pow(dist2, uFalloff);
    color += uColors[i] * w; // blend in sRGB/gamma space to match Figma & CSS
    total += w;
  }
  color = color / max(total, 0.0001);

  // --- vignette
  float vig = smoothstep(1.1, 0.35, distance(uv, vec2(0.5)));
  color = mix(color, color * vig, uVignette);

  // --- film grain
  float g = fract(sin(dot(uv * uResolution + uTime, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  color += g * uGrain;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;
