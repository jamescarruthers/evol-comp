// palette/harmony.js — Colour space conversions and perceptual distance utilities

/**
 * Convert HSL to RGB.
 * @param {number} h - Hue 0–360
 * @param {number} s - Saturation 0–1
 * @param {number} l - Lightness 0–1
 * @returns {number[]} [r, g, b] each 0–255
 */
export function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r, g, b;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  ];
}

/**
 * Convert RGB to XYZ (D65 illuminant).
 */
function rgbToXyz(r, g, b) {
  let rr = r / 255;
  let gg = g / 255;
  let bb = b / 255;

  rr = rr > 0.04045 ? Math.pow((rr + 0.055) / 1.055, 2.4) : rr / 12.92;
  gg = gg > 0.04045 ? Math.pow((gg + 0.055) / 1.055, 2.4) : gg / 12.92;
  bb = bb > 0.04045 ? Math.pow((bb + 0.055) / 1.055, 2.4) : bb / 12.92;

  rr *= 100; gg *= 100; bb *= 100;

  return [
    rr * 0.4124564 + gg * 0.3575761 + bb * 0.1804375,
    rr * 0.2126729 + gg * 0.7151522 + bb * 0.0721750,
    rr * 0.0193339 + gg * 0.1191920 + bb * 0.9503041
  ];
}

/**
 * Convert XYZ to CIELAB (D65 reference white).
 */
function xyzToLab(x, y, z) {
  const Xn = 95.047, Yn = 100.000, Zn = 108.883;
  let fx = x / Xn;
  let fy = y / Yn;
  let fz = z / Zn;

  const epsilon = 0.008856;
  const kappa = 903.3;

  fx = fx > epsilon ? Math.cbrt(fx) : (kappa * fx + 16) / 116;
  fy = fy > epsilon ? Math.cbrt(fy) : (kappa * fy + 16) / 116;
  fz = fz > epsilon ? Math.cbrt(fz) : (kappa * fz + 16) / 116;

  return [
    116 * fy - 16,
    500 * (fx - fy),
    200 * (fy - fz)
  ];
}

/**
 * Convert RGB to CIELAB.
 * @param {number} r 0–255
 * @param {number} g 0–255
 * @param {number} b 0–255
 * @returns {number[]} [L, a, b]
 */
export function rgbToLab(r, g, b) {
  const [x, y, z] = rgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
}

/**
 * CIEDE2000 colour difference.
 * Reference: Sharma, Wu & Dalal (2005).
 * @param {number[]} lab1 [L, a, b]
 * @param {number[]} lab2 [L, a, b]
 * @returns {number} perceptual colour difference
 */
export function deltaE00(lab1, lab2) {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;

  const avgL = (L1 + L2) / 2;
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const avgC = (C1 + C2) / 2;

  const avgC7 = Math.pow(avgC, 7);
  const G = 0.5 * (1 - Math.sqrt(avgC7 / (avgC7 + Math.pow(25, 7))));

  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);
  const avgCp = (C1p + C2p) / 2;

  let h1p = Math.atan2(b1, a1p) * (180 / Math.PI);
  if (h1p < 0) h1p += 360;
  let h2p = Math.atan2(b2, a2p) * (180 / Math.PI);
  if (h2p < 0) h2p += 360;

  let dhp;
  if (Math.abs(h1p - h2p) <= 180) {
    dhp = h2p - h1p;
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360;
  } else {
    dhp = h2p - h1p + 360;
  }

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI) / 360);

  let avgHp;
  if (Math.abs(h1p - h2p) <= 180) {
    avgHp = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    avgHp = (h1p + h2p + 360) / 2;
  } else {
    avgHp = (h1p + h2p - 360) / 2;
  }

  const T = 1
    - 0.17 * Math.cos(((avgHp - 30) * Math.PI) / 180)
    + 0.24 * Math.cos((2 * avgHp * Math.PI) / 180)
    + 0.32 * Math.cos(((3 * avgHp + 6) * Math.PI) / 180)
    - 0.20 * Math.cos(((4 * avgHp - 63) * Math.PI) / 180);

  const SL = 1 + (0.015 * Math.pow(avgL - 50, 2)) / Math.sqrt(20 + Math.pow(avgL - 50, 2));
  const SC = 1 + 0.045 * avgCp;
  const SH = 1 + 0.015 * avgCp * T;

  const avgCp7 = Math.pow(avgCp, 7);
  const RC = 2 * Math.sqrt(avgCp7 / (avgCp7 + Math.pow(25, 7)));
  const dTheta = 30 * Math.exp(-Math.pow((avgHp - 275) / 25, 2));
  const RT = -RC * Math.sin((2 * dTheta * Math.PI) / 180);

  const kL = 1, kC = 1, kH = 1;

  return Math.sqrt(
    Math.pow(dLp / (kL * SL), 2) +
    Math.pow(dCp / (kC * SC), 2) +
    Math.pow(dHp / (kH * SH), 2) +
    RT * (dCp / (kC * SC)) * (dHp / (kH * SH))
  );
}

/**
 * Shortest angular distance between two hues (0–360).
 */
export function hueDistance(h1, h2) {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Gaussian scoring helper — peak at ideal, drops off with sigma.
 * @returns {number} 0–1
 */
export function gaussianScore(value, ideal, sigma) {
  return Math.exp(-Math.pow(value - ideal, 2) / (2 * sigma * sigma));
}
