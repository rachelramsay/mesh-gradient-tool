// Faithful bicubic mesh mode — a port of Figma's "Mesh gradient" shader (WGSL)
// to WebGL1 GLSL ES 1.00. Forward tessellation: a triangle grid in (s,t) space
// is warped by a 4x4 Catmull-Rom bicubic control net in the VERTEX shader, and
// colors are Gouraud-interpolated in linear light (like Figma), then converted
// back to sRGB in the fragment shader. Optional time-based warp adds motion.
//
// Control points are supplied as 16 entries in row-major grid order:
//   index = row*4 + col   (p_{col,row}: col=x, row=y), matching Figma's layout.

export const VERT_MESH = `
attribute vec2 aST;

uniform vec2  uCtrlPos[16];   // grid positions, x/y in 0..1 (y down)
uniform vec3  uCtrlColor[16]; // grid colors, LINEAR light

varying vec3 vColor;

// --- Catmull-Rom basis ---
float cr1(float a,float b,float c,float d,float t){
  return 0.5*((2.0*b)+(-a+c)*t+(2.0*a-5.0*b+4.0*c-d)*t*t+(-a+3.0*b-3.0*c+d)*t*t*t);
}
vec2 cr2(vec2 a,vec2 b,vec2 c,vec2 d,float t){ return vec2(cr1(a.x,b.x,c.x,d.x,t),cr1(a.y,b.y,c.y,d.y,t)); }
vec3 cr3(vec3 a,vec3 b,vec3 c,vec3 d,float t){ return vec3(cr1(a.x,b.x,c.x,d.x,t),cr1(a.y,b.y,c.y,d.y,t),cr1(a.z,b.z,c.z,d.z,t)); }

// ES 1.00-safe dynamic fetch (loop counter indexing is allowed; k is dynamic).
vec2 getP(int k){ for(int n=0;n<16;n++){ if(n==k) return uCtrlPos[n]; } return uCtrlPos[15]; }
vec3 getC(int k){ for(int n=0;n<16;n++){ if(n==k) return uCtrlColor[n]; } return uCtrlColor[15]; }
int idx(int i,int j){ int ci=(i<0)?0:((i>3)?3:i); int cj=(j<0)?0:((j>3)?3:j); return cj*4+ci; }

void main(){
  float uu = aST.x*3.0; float vv = aST.y*3.0;
  int i = int(floor(uu)); i = (i<0)?0:((i>2)?2:i);
  int j = int(floor(vv)); j = (j<0)?0:((j>2)?2:j);
  float fu = uu-float(i); float fv = vv-float(j);

  vec2 prow[4]; vec3 crow[4];
  for(int m=0;m<4;m++){
    int jj = j-1+m;
    prow[m] = cr2(getP(idx(i-1,jj)), getP(idx(i,jj)), getP(idx(i+1,jj)), getP(idx(i+2,jj)), fu);
    crow[m] = cr3(getC(idx(i-1,jj)), getC(idx(i,jj)), getC(idx(i+1,jj)), getC(idx(i+2,jj)), fu);
  }
  vec2 pos = cr2(prow[0],prow[1],prow[2],prow[3],fv);
  vec3 col = cr3(crow[0],crow[1],crow[2],crow[3],fv);

  // Pure bicubic evaluation — motion comes from the engine animating the
  // 16 control points themselves (uCtrlPos), so the surface genuinely flexes.
  gl_Position = vec4(pos.x*2.0-1.0, 1.0-pos.y*2.0, 0.0, 1.0);
  vColor = col;
}
`;

export const FRAG_MESH = `
precision highp float;
varying vec3 vColor;
uniform float uGrain;
uniform float uTime;

vec3 lin2srgb(vec3 c){
  vec3 lo = c*12.92;
  vec3 hi = 1.055*pow(clamp(c,vec3(0.0),vec3(1.0)),vec3(1.0/2.4))-0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}

void main(){
  vec3 c = lin2srgb(clamp(vColor,0.0,1.0));
  float g = fract(sin(dot(gl_FragCoord.xy + uTime, vec2(12.9898,78.233)))*43758.5453)-0.5;
  c += g*uGrain;
  gl_FragColor = vec4(clamp(c,0.0,1.0),1.0);
}
`;
