// renderer/xbr.js — Pixel art upscaling filter using the xBR algorithm
//
// Applies a "downscale → xBR upscale" pipeline to give compositions a
// distinctive retro-remastered look: hard digital edges become smoothed
// with rounded corners and anti-aliased diagonals.
//
// xBR algorithm by Hyllian (Hyllian's xBR).
// JS implementation adapted from xbr-js by Josep del Rio (joseprio), MIT license.
// https://github.com/joseprio/xBRjs

/**
 * Apply pixel art upscaling filter to a canvas.
 *
 * Downscales the canvas image by the given factor using nearest-neighbor
 * sampling (creates hard pixel edges), then upscales back using the xBR
 * algorithm which intelligently smooths those edges.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width  - canvas width in pixels
 * @param {number} height - canvas height in pixels
 * @param {Object} options
 * @param {number} options.scaleFactor - 2, 3, or 4 (default 4)
 */
export function applyPixelArtFilter(ctx, width, height, options = {}) {
  const scale = options.scaleFactor || 4;
  const smallW = Math.floor(width / scale);
  const smallH = Math.floor(height / scale);

  // Guard: xBR needs at least a 2x2 input
  if (smallW < 2 || smallH < 2) return;

  // 1. Get source pixel data
  const imageData = ctx.getImageData(0, 0, width, height);

  // 2. Nearest-neighbor downsample to create hard pixel edges
  const smallPixels = nearestNeighborDownscale(imageData.data, width, height, smallW, smallH);

  // 3. Apply xBR upscaling
  const xbrFn = scale === 2 ? xbr2x : scale === 3 ? xbr3x : xbr4x;
  const scaledPixels = xbrFn(smallPixels, smallW, smallH);
  const scaledW = smallW * scale;
  const scaledH = smallH * scale;

  // 4. Write result back to the canvas
  // The scaled size may differ from the original due to rounding,
  // so we use an offscreen canvas + drawImage to stretch to exact size.
  const offscreen = new OffscreenCanvas(scaledW, scaledH);
  const offCtx = offscreen.getContext('2d');
  const outData = offCtx.createImageData(scaledW, scaledH);
  uint32ToRgba(scaledPixels, outData.data);
  offCtx.putImageData(outData, 0, 0);

  // Stretch to original canvas dimensions (smooth scaling for minor size differences)
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(offscreen, 0, 0, width, height);
}

// ---- Pixel format conversion ----
// Canvas ImageData is RGBA bytes.  On little-endian systems (all modern
// browsers), a Uint32Array view gives packed pixels as (A<<24)|(B<<16)|(G<<8)|R.
// This matches the xBR mask layout exactly, so conversion is a direct view.

function nearestNeighborDownscale(srcRgba, srcW, srcH, dstW, dstH) {
  const src32 = new Uint32Array(srcRgba.buffer, srcRgba.byteOffset, srcW * srcH);
  const dst = new Uint32Array(dstW * dstH);
  for (let y = 0; y < dstH; y++) {
    const srcY = Math.floor(y * srcH / dstH);
    for (let x = 0; x < dstW; x++) {
      const srcX = Math.floor(x * srcW / dstW);
      dst[y * dstW + x] = src32[srcY * srcW + srcX];
    }
  }
  return dst;
}

function uint32ToRgba(src32, dstRgba) {
  const dst = new Uint32Array(dstRgba.buffer, dstRgba.byteOffset, src32.length);
  dst.set(src32);
}

// ============================================================================
// xBR Algorithm — adapted from xbr-js by joseprio (MIT license)
// https://github.com/joseprio/xBRjs
// ============================================================================

const
  REDMASK   = 0x000000FF,
  GREENMASK = 0x0000FF00,
  BLUEMASK  = 0x00FF0000,
  ALPHAMASK = 0xFF000000,
  THRESHHOLD_Y = 48,
  THRESHHOLD_U = 7,
  THRESHHOLD_V = 6;

function getYuv(p) {
  const
    r = (p & REDMASK),
    g = (p & GREENMASK) >> 8,
    b = (p & BLUEMASK) >> 16;
  return [
    r * .299000 + g * .587000 + b * .114000,
    r * -.168736 + g * -.331264 + b * .500000,
    r * .500000 + g * -.418688 + b * -.081312
  ];
}

function yuvDifference(A, B, scaleAlpha) {
  const
    alphaA = ((A & ALPHAMASK) >> 24) & 0xff,
    alphaB = ((B & ALPHAMASK) >> 24) & 0xff;
  if (alphaA === 0 && alphaB === 0) return 0;
  if (!scaleAlpha && (alphaA < 255 || alphaB < 255)) return 1000000;
  if (alphaA === 0 || alphaB === 0) return 1000000;
  const yuvA = getYuv(A), yuvB = getYuv(B);
  return Math.abs(yuvA[0] - yuvB[0]) * THRESHHOLD_Y
       + Math.abs(yuvA[1] - yuvB[1]) * THRESHHOLD_U
       + Math.abs(yuvA[2] - yuvB[2]) * THRESHHOLD_V;
}

function isEqual(A, B, scaleAlpha) {
  const
    alphaA = ((A & ALPHAMASK) >> 24) & 0xff,
    alphaB = ((B & ALPHAMASK) >> 24) & 0xff;
  if (alphaA === 0 && alphaB === 0) return true;
  if (!scaleAlpha && (alphaA < 255 || alphaB < 255)) return false;
  if (alphaA === 0 || alphaB === 0) return false;
  const yuvA = getYuv(A), yuvB = getYuv(B);
  return Math.abs(yuvA[0] - yuvB[0]) <= THRESHHOLD_Y
      && Math.abs(yuvA[1] - yuvB[1]) <= THRESHHOLD_U
      && Math.abs(yuvA[2] - yuvB[2]) <= THRESHHOLD_V;
}

function pixelInterpolate(A, B, q1, q2) {
  const
    alphaA = ((A & ALPHAMASK) >> 24) & 0xff,
    alphaB = ((B & ALPHAMASK) >> 24) & 0xff;
  let r, g, b;
  if (alphaA === 0) {
    r = B & REDMASK;
    g = (B & GREENMASK) >> 8;
    b = (B & BLUEMASK) >> 16;
  } else if (alphaB === 0) {
    r = A & REDMASK;
    g = (A & GREENMASK) >> 8;
    b = (A & BLUEMASK) >> 16;
  } else {
    r = (q2 * (B & REDMASK) + q1 * (A & REDMASK)) / (q1 + q2);
    g = (q2 * ((B & GREENMASK) >> 8) + q1 * ((A & GREENMASK) >> 8)) / (q1 + q2);
    b = (q2 * ((B & BLUEMASK) >> 16) + q1 * ((A & BLUEMASK) >> 16)) / (q1 + q2);
  }
  const a = (q2 * alphaB + q1 * alphaA) / (q1 + q2);
  return ((~~r) | ((~~g) << 8) | ((~~b) << 16) | ((~~a) << 24));
}

function getRelatedPoints(v, x, y, w, h) {
  const xm1 = Math.max(x - 1, 0), xm2 = Math.max(x - 2, 0);
  const xp1 = Math.min(x + 1, w - 1), xp2 = Math.min(x + 2, w - 1);
  const ym1 = Math.max(y - 1, 0), ym2 = Math.max(y - 2, 0);
  const yp1 = Math.min(y + 1, h - 1), yp2 = Math.min(y + 2, h - 1);
  return [
    v[xm1 + ym2 * w], v[x + ym2 * w], v[xp1 + ym2 * w],
    v[xm2 + ym1 * w], v[xm1 + ym1 * w], v[x + ym1 * w], v[xp1 + ym1 * w], v[xp2 + ym1 * w],
    v[xm2 + y * w], v[xm1 + y * w], v[x + y * w], v[xp1 + y * w], v[xp2 + y * w],
    v[xm2 + yp1 * w], v[xm1 + yp1 * w], v[x + yp1 * w], v[xp1 + yp1 * w], v[xp2 + yp1 * w],
    v[xm1 + yp2 * w], v[x + yp2 * w], v[xp1 + yp2 * w]
  ];
}

// ---- Blend helpers ----
function alphaBlend32W(d, s, bc) { return bc ? pixelInterpolate(d, s, 7, 1) : d; }
function alphaBlend64W(d, s, bc) { return bc ? pixelInterpolate(d, s, 3, 1) : d; }
function alphaBlend128W(d, s, bc) { return bc ? pixelInterpolate(d, s, 1, 1) : d; }
function alphaBlend192W(d, s, bc) { return bc ? pixelInterpolate(d, s, 1, 3) : s; }
function alphaBlend224W(d, s, bc) { return bc ? pixelInterpolate(d, s, 1, 7) : s; }

// ---- 2x kernel ----
function kernel2Xv5(pe, pi, ph, pf, pg, pc, pd, pb, f4, i4, h5, i5, n1, n2, n3, bc, sa) {
  if (pe === ph || pe === pf) return [n1, n2, n3];
  const e = (yuvDifference(pe, pc, sa) + yuvDifference(pe, pg, sa) + yuvDifference(pi, h5, sa) + yuvDifference(pi, f4, sa)) + (yuvDifference(ph, pf, sa) << 2);
  const i = (yuvDifference(ph, pd, sa) + yuvDifference(ph, i5, sa) + yuvDifference(pf, i4, sa) + yuvDifference(pf, pb, sa)) + (yuvDifference(pe, pi, sa) << 2);
  const px = (yuvDifference(pe, pf, sa) <= yuvDifference(pe, ph, sa)) ? pf : ph;
  if ((e < i) && (!isEqual(pf, pb, sa) && !isEqual(ph, pd, sa) || isEqual(pe, pi, sa) && (!isEqual(pf, i4, sa) && !isEqual(ph, i5, sa)) || isEqual(pe, pg, sa) || isEqual(pe, pc, sa))) {
    const ke = yuvDifference(pf, pg, sa), ki = yuvDifference(ph, pc, sa);
    const ex2 = (pe !== pc && pb !== pc), ex3 = (pe !== pg && pd !== pg);
    if (((ke << 1) <= ki) && ex3 || (ke >= (ki << 1)) && ex2) {
      if (((ke << 1) <= ki) && ex3) { n3 = alphaBlend192W(n3, px, bc); n2 = alphaBlend64W(n2, px, bc); }
      if ((ke >= (ki << 1)) && ex2) { n3 = alphaBlend192W(n3, px, bc); n1 = alphaBlend64W(n1, px, bc); }
    } else {
      n3 = alphaBlend128W(n3, px, bc);
    }
  } else if (e <= i) {
    n3 = alphaBlend64W(n3, px, bc);
  }
  return [n1, n2, n3];
}

function computeXbr2x(src, x, y, w, h, dst, dx, dy, dw, bc, sa) {
  const [a1, b1, c1, a0, pa, pb, pc, c4, d0, pd, pe, pf, f4, g0, pg, ph, pi, i4, g5, h5, i5] = getRelatedPoints(src, x, y, w, h);
  let e0, e1, e2, e3;
  e0 = e1 = e2 = e3 = pe;
  [e1, e2, e3] = kernel2Xv5(pe, pi, ph, pf, pg, pc, pd, pb, f4, i4, h5, i5, e1, e2, e3, bc, sa);
  [e0, e3, e1] = kernel2Xv5(pe, pc, pf, pb, pi, pa, ph, pd, b1, c1, f4, c4, e0, e3, e1, bc, sa);
  [e2, e1, e0] = kernel2Xv5(pe, pa, pb, pd, pc, pg, pf, ph, d0, a0, b1, a1, e2, e1, e0, bc, sa);
  [e3, e0, e2] = kernel2Xv5(pe, pg, pd, ph, pa, pi, pb, pf, h5, g5, d0, g0, e3, e0, e2, bc, sa);
  dst[dx + dy * dw] = e0;
  dst[dx + 1 + dy * dw] = e1;
  dst[dx + (dy + 1) * dw] = e2;
  dst[dx + 1 + (dy + 1) * dw] = e3;
}

// ---- 3x kernel ----
function kernel3X(pe, pi, ph, pf, pg, pc, pd, pb, f4, i4, h5, i5, n2, n5, n6, n7, n8, bc, sa) {
  if (pe === ph || pe === pf) return [n2, n5, n6, n7, n8];
  const e = (yuvDifference(pe, pc, sa) + yuvDifference(pe, pg, sa) + yuvDifference(pi, h5, sa) + yuvDifference(pi, f4, sa)) + (yuvDifference(ph, pf, sa) << 2);
  const i = (yuvDifference(ph, pd, sa) + yuvDifference(ph, i5, sa) + yuvDifference(pf, i4, sa) + yuvDifference(pf, pb, sa)) + (yuvDifference(pe, pi, sa) << 2);
  const state = (e < i) && (!isEqual(pf, pb, sa) && !isEqual(pf, pc, sa) || !isEqual(ph, pd, sa) && !isEqual(ph, pg, sa) || isEqual(pe, pi, sa) && (!isEqual(pf, f4, sa) && !isEqual(pf, i4, sa) || !isEqual(ph, h5, sa) && !isEqual(ph, i5, sa)) || isEqual(pe, pg, sa) || isEqual(pe, pc, sa));
  if (state) {
    const ke = yuvDifference(pf, pg, sa), ki = yuvDifference(ph, pc, sa);
    const ex2 = (pe !== pc && pb !== pc), ex3 = (pe !== pg && pd !== pg);
    const px = (yuvDifference(pe, pf, sa) <= yuvDifference(pe, ph, sa)) ? pf : ph;
    if (((ke << 1) <= ki) && ex3 && (ke >= (ki << 1)) && ex2) {
      const bn7 = alphaBlend192W(n7, px, bc), bn6 = alphaBlend64W(n6, px, bc);
      n7 = bn7; n5 = bn7; n6 = bn6; n2 = bn6; n8 = px;
    } else if (((ke << 1) <= ki) && ex3) {
      n7 = alphaBlend192W(n7, px, bc); n5 = alphaBlend64W(n5, px, bc); n6 = alphaBlend64W(n6, px, bc); n8 = px;
    } else if ((ke >= (ki << 1)) && ex2) {
      n5 = alphaBlend192W(n5, px, bc); n7 = alphaBlend64W(n7, px, bc); n2 = alphaBlend64W(n2, px, bc); n8 = px;
    } else {
      n8 = alphaBlend224W(n8, px, bc); n5 = alphaBlend32W(n5, px, bc); n7 = alphaBlend32W(n7, px, bc);
    }
  } else if (e <= i) {
    n8 = alphaBlend128W(n8, ((yuvDifference(pe, pf, sa) <= yuvDifference(pe, ph, sa)) ? pf : ph), bc);
  }
  return [n2, n5, n6, n7, n8];
}

function computeXbr3x(src, x, y, w, h, dst, dx, dy, dw, bc, sa) {
  const [a1, b1, c1, a0, pa, pb, pc, c4, d0, pd, pe, pf, f4, g0, pg, ph, pi, i4, g5, h5, i5] = getRelatedPoints(src, x, y, w, h);
  let e0, e1, e2, e3, e4, e5, e6, e7, e8;
  e0 = e1 = e2 = e3 = e4 = e5 = e6 = e7 = e8 = pe;
  [e2, e5, e6, e7, e8] = kernel3X(pe, pi, ph, pf, pg, pc, pd, pb, f4, i4, h5, i5, e2, e5, e6, e7, e8, bc, sa);
  [e0, e1, e8, e5, e2] = kernel3X(pe, pc, pf, pb, pi, pa, ph, pd, b1, c1, f4, c4, e0, e1, e8, e5, e2, bc, sa);
  [e6, e3, e2, e1, e0] = kernel3X(pe, pa, pb, pd, pc, pg, pf, ph, d0, a0, b1, a1, e6, e3, e2, e1, e0, bc, sa);
  [e8, e7, e0, e3, e6] = kernel3X(pe, pg, pd, ph, pa, pi, pb, pf, h5, g5, d0, g0, e8, e7, e0, e3, e6, bc, sa);
  dst[dx + dy * dw] = e0;
  dst[dx + 1 + dy * dw] = e1;
  dst[dx + 2 + dy * dw] = e2;
  dst[dx + (dy + 1) * dw] = e3;
  dst[dx + 1 + (dy + 1) * dw] = e4;
  dst[dx + 2 + (dy + 1) * dw] = e5;
  dst[dx + (dy + 2) * dw] = e6;
  dst[dx + 1 + (dy + 2) * dw] = e7;
  dst[dx + 2 + (dy + 2) * dw] = e8;
}

// ---- 4x kernel ----
function kernel4Xv2(pe, pi, ph, pf, pg, pc, pd, pb, f4, i4, h5, i5, n15, n14, n11, n3, n7, n10, n13, n12, bc, sa) {
  if (pe === ph || pe === pf) return [n15, n14, n11, n3, n7, n10, n13, n12];
  const e = (yuvDifference(pe, pc, sa) + yuvDifference(pe, pg, sa) + yuvDifference(pi, h5, sa) + yuvDifference(pi, f4, sa)) + (yuvDifference(ph, pf, sa) << 2);
  const i = (yuvDifference(ph, pd, sa) + yuvDifference(ph, i5, sa) + yuvDifference(pf, i4, sa) + yuvDifference(pf, pb, sa)) + (yuvDifference(pe, pi, sa) << 2);
  const px = (yuvDifference(pe, pf, sa) <= yuvDifference(pe, ph, sa)) ? pf : ph;
  if ((e < i) && (!isEqual(pf, pb, sa) && !isEqual(ph, pd, sa) || isEqual(pe, pi, sa) && (!isEqual(pf, i4, sa) && !isEqual(ph, i5, sa)) || isEqual(pe, pg, sa) || isEqual(pe, pc, sa))) {
    const ke = yuvDifference(pf, pg, sa), ki = yuvDifference(ph, pc, sa);
    const ex2 = (pe !== pc && pb !== pc), ex3 = (pe !== pg && pd !== pg);
    if (((ke << 1) <= ki) && ex3 || (ke >= (ki << 1)) && ex2) {
      if (((ke << 1) <= ki) && ex3) {
        n15 = px; n14 = px; n11 = alphaBlend192W(n11, px, bc);
        n13 = alphaBlend192W(n13, px, bc); n12 = alphaBlend64W(n12, px, bc); n10 = alphaBlend64W(n10, px, bc);
      }
      if ((ke >= (ki << 1)) && ex2) {
        n15 = px; n14 = alphaBlend192W(n14, px, bc); n11 = px;
        n3 = alphaBlend64W(n3, px, bc); n7 = alphaBlend192W(n7, px, bc); n10 = alphaBlend64W(n10, px, bc);
      }
    } else {
      n15 = px; n14 = alphaBlend128W(n14, px, bc); n11 = alphaBlend128W(n11, px, bc);
    }
  } else if (e <= i) {
    n15 = alphaBlend128W(n15, px, bc);
  }
  return [n15, n14, n11, n3, n7, n10, n13, n12];
}

function computeXbr4x(src, x, y, w, h, dst, dx, dy, dw, bc, sa) {
  const [a1, b1, c1, a0, pa, pb, pc, c4, d0, pd, pe, pf, f4, g0, pg, ph, pi, i4, g5, h5, i5] = getRelatedPoints(src, x, y, w, h);
  let e0, e1, e2, e3, e4, e5, e6, e7, e8, e9, ea, eb, ec, ed, ee, ef;
  e0 = e1 = e2 = e3 = e4 = e5 = e6 = e7 = e8 = e9 = ea = eb = ec = ed = ee = ef = pe;
  [ef, ee, eb, e3, e7, ea, ed, ec] = kernel4Xv2(pe, pi, ph, pf, pg, pc, pd, pb, f4, i4, h5, i5, ef, ee, eb, e3, e7, ea, ed, ec, bc, sa);
  [e3, e7, e2, e0, e1, e6, eb, ef] = kernel4Xv2(pe, pc, pf, pb, pi, pa, ph, pd, b1, c1, f4, c4, e3, e7, e2, e0, e1, e6, eb, ef, bc, sa);
  [e0, e1, e4, ec, e8, e5, e2, e3] = kernel4Xv2(pe, pa, pb, pd, pc, pg, pf, ph, d0, a0, b1, a1, e0, e1, e4, ec, e8, e5, e2, e3, bc, sa);
  [ec, e8, ed, ef, ee, e9, e4, e0] = kernel4Xv2(pe, pg, pd, ph, pa, pi, pb, pf, h5, g5, d0, g0, ec, e8, ed, ef, ee, e9, e4, e0, bc, sa);
  dst[dx + dy * dw] = e0;     dst[dx + 1 + dy * dw] = e1;     dst[dx + 2 + dy * dw] = e2;     dst[dx + 3 + dy * dw] = e3;
  dst[dx + (dy+1) * dw] = e4; dst[dx + 1 + (dy+1) * dw] = e5; dst[dx + 2 + (dy+1) * dw] = e6; dst[dx + 3 + (dy+1) * dw] = e7;
  dst[dx + (dy+2) * dw] = e8; dst[dx + 1 + (dy+2) * dw] = e9; dst[dx + 2 + (dy+2) * dw] = ea; dst[dx + 3 + (dy+2) * dw] = eb;
  dst[dx + (dy+3) * dw] = ec; dst[dx + 1 + (dy+3) * dw] = ed; dst[dx + 2 + (dy+3) * dw] = ee; dst[dx + 3 + (dy+3) * dw] = ef;
}

// ---- Public xBR scaling functions ----
function xbr2x(pixelArray, width, height) {
  const out = new Uint32Array(width * height * 4);
  for (let c = 0; c < width; c++)
    for (let d = 0; d < height; d++)
      computeXbr2x(pixelArray, c, d, width, height, out, c * 2, d * 2, width * 2, true, false);
  return out;
}

function xbr3x(pixelArray, width, height) {
  const out = new Uint32Array(width * height * 9);
  for (let c = 0; c < width; c++)
    for (let d = 0; d < height; d++)
      computeXbr3x(pixelArray, c, d, width, height, out, c * 3, d * 3, width * 3, true, false);
  return out;
}

function xbr4x(pixelArray, width, height) {
  const out = new Uint32Array(width * height * 16);
  for (let c = 0; c < width; c++)
    for (let d = 0; d < height; d++)
      computeXbr4x(pixelArray, c, d, width, height, out, c * 4, d * 4, width * 4, true, false);
  return out;
}
