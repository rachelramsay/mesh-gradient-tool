// Color helpers + a hue-preserving dark-mode derivation (OKLab).
// deriveDark() reduces perceptual lightness while keeping hue, so a dark
// variant reads as the same color family rather than a muddy sRGB multiply.

export function hexToRgb01(hex) {
  let h = (hex || '#000000').replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgb01ToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

function srgbToLinear(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function linearToSrgb(c) { return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }

function linearToOklab(r, g, b) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  ];
}

function oklabToLinear(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

// Derive a dark-mode variant of a color: keep hue (OKLab a/b direction),
// lower perceptual lightness, and ease chroma back slightly so it doesn't glow.
export function deriveDark(hex, { lightness = 0.5, chroma = 0.92 } = {}) {
  const [r, g, b] = hexToRgb01(hex);
  const [L, a, bb] = linearToOklab(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
  const lin = oklabToLinear(L * lightness, a * chroma, bb * chroma);
  return rgb01ToHex(
    linearToSrgb(Math.max(0, lin[0])),
    linearToSrgb(Math.max(0, lin[1])),
    linearToSrgb(Math.max(0, lin[2])),
  );
}
