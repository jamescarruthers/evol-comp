// renderer/filter.js — Post-processing filters for an analogue aesthetic
//
// Applies blur, sharpen, grain, and vignette to any canvas to soften
// the hard digital edges and give compositions a more organic, printed look.
//
// Blur and sharpen share a common abstraction: separable 1D convolution.
// Gaussian blur is a direct application of a Gaussian kernel in two passes
// (horizontal then vertical).  Sharpen is an unsharp mask — defined in terms
// of blur: output = original + strength × (original − blurred).

/**
 * Apply analogue-style post-processing filters to a canvas.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width  - canvas width in pixels
 * @param {number} height - canvas height in pixels
 * @param {Object} options
 * @param {number} options.blurAmount     - blur intensity 0–1 (0 = off, maps to radius 0–8)
 * @param {number} options.sharpenAmount  - sharpen intensity 0–1 (0 = off, unsharp mask)
 * @param {number} options.grainAmount    - grain intensity 0–1 (0 = off, 0.3 = subtle, 0.6+ = heavy)
 * @param {number} options.vignetteAmount - vignette intensity 0–1 (0 = off)
 */
export function applyAnalogueFilter(ctx, width, height, options = {}) {
  const { blurAmount = 0, sharpenAmount = 0, grainAmount = 0, vignetteAmount = 0 } = options;

  // Order: blur → sharpen → grain → vignette
  // Structural spatial effects first, then noise, then overlay.
  if (blurAmount > 0)    applyBlur(ctx, width, height, blurAmount);
  if (sharpenAmount > 0) applySharpen(ctx, width, height, sharpenAmount);
  if (grainAmount > 0)   applyGrain(ctx, width, height, grainAmount);
  if (vignetteAmount > 0) applyVignette(ctx, width, height, vignetteAmount);
}

// ---- Separable Convolution Engine ----
// The shared abstraction behind both blur and sharpen.
// A 1D kernel is applied in two passes (horizontal then vertical),
// giving O(w×h×r) per pass instead of O(w×h×r²) for a 2D kernel.

/**
 * Generate a normalised 1D Gaussian kernel.
 * @param {number} radius - integer ≥ 1, kernel has 2*radius+1 taps
 * @returns {Float64Array}
 */
function gaussianKernel1D(radius) {
  const sigma = radius / 2;
  const size = 2 * radius + 1;
  const kernel = new Float64Array(size);
  let sum = 0;
  for (let i = 0; i < size; i++) {
    const x = i - radius;
    kernel[i] = Math.exp(-0.5 * (x * x) / (sigma * sigma));
    sum += kernel[i];
  }
  for (let i = 0; i < size; i++) kernel[i] /= sum;
  return kernel;
}

/**
 * Apply a separable 1D convolution to raw pixel data (two passes).
 *
 * @param {Uint8ClampedArray} data - source pixel data (RGBA, length = w*h*4)
 * @param {number} width
 * @param {number} height
 * @param {Float64Array} kernel - normalised 1D kernel, length must be odd
 * @returns {Uint8ClampedArray} new pixel data with the convolution applied
 */
function separableConvolve(data, width, height, kernel) {
  const radius = (kernel.length - 1) / 2;
  const len = width * height * 4;
  // Intermediate buffer in floating point to avoid rounding between passes
  const temp = new Float64Array(len);
  const out = new Uint8ClampedArray(len);

  // Horizontal pass → temp
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = -radius; k <= radius; k++) {
        const sx = Math.min(Math.max(x + k, 0), width - 1); // clamp edges
        const idx = (y * width + sx) * 4;
        const w = kernel[k + radius];
        r += data[idx]     * w;
        g += data[idx + 1] * w;
        b += data[idx + 2] * w;
        a += data[idx + 3] * w;
      }
      const oi = (y * width + x) * 4;
      temp[oi]     = r;
      temp[oi + 1] = g;
      temp[oi + 2] = b;
      temp[oi + 3] = a;
    }
  }

  // Vertical pass → out
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = -radius; k <= radius; k++) {
        const sy = Math.min(Math.max(y + k, 0), height - 1); // clamp edges
        const idx = (sy * width + x) * 4;
        const w = kernel[k + radius];
        r += temp[idx]     * w;
        g += temp[idx + 1] * w;
        b += temp[idx + 2] * w;
        a += temp[idx + 3] * w;
      }
      const oi = (y * width + x) * 4;
      out[oi]     = clamp(r);
      out[oi + 1] = clamp(g);
      out[oi + 2] = clamp(b);
      out[oi + 3] = clamp(a);
    }
  }

  return out;
}

/**
 * Gaussian blur via separable convolution.
 * Amount (0–1) maps to an integer blur radius (0–8 pixels).
 */
function applyBlur(ctx, width, height, amount) {
  const radius = Math.round(amount * 8);
  if (radius < 1) return;

  const imageData = ctx.getImageData(0, 0, width, height);
  const kernel = gaussianKernel1D(radius);
  imageData.data.set(separableConvolve(imageData.data, width, height, kernel));
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Sharpen via unsharp mask — defined in terms of blur.
 *
 * output = original + strength × (original − blurred)
 *
 * Uses a small fixed blur radius (2px) to isolate detail; the amount
 * slider (0–1) controls how aggressively that detail is amplified.
 */
function applySharpen(ctx, width, height, amount) {
  const strength = amount * 2; // 0–1 slider → 0–2× amplification
  if (strength <= 0) return;

  const imageData = ctx.getImageData(0, 0, width, height);
  const original = imageData.data;
  const kernel = gaussianKernel1D(2);
  const blurred = separableConvolve(original, width, height, kernel);

  for (let i = 0; i < original.length; i += 4) {
    original[i]     = clamp(original[i]     + strength * (original[i]     - blurred[i]));
    original[i + 1] = clamp(original[i + 1] + strength * (original[i + 1] - blurred[i + 1]));
    original[i + 2] = clamp(original[i + 2] + strength * (original[i + 2] - blurred[i + 2]));
    // Alpha unchanged
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Overlay luminance noise (film grain).
 *
 * Each pixel receives a random brightness offset.  The offset is blended
 * using "overlay" compositing so darks and lights are affected proportionally
 * — this mimics real film grain more closely than simple additive noise.
 */
function applyGrain(ctx, width, height, amount) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  // amount maps to max noise amplitude in RGB units (0–255)
  const amplitude = amount * 80;

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 2 * amplitude;
    data[i]     = clamp(data[i] + noise);     // R
    data[i + 1] = clamp(data[i + 1] + noise); // G
    data[i + 2] = clamp(data[i + 2] + noise); // B
    // Alpha unchanged
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Draw a radial vignette (darkened edges).
 *
 * Uses a radial gradient from transparent at the centre to semi-opaque
 * black at the corners.  The gradient follows an ellipse that matches
 * the canvas proportions so the effect is even on non-square canvases.
 */
function applyVignette(ctx, width, height, amount) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.sqrt(cx * cx + cy * cy);

  const gradient = ctx.createRadialGradient(cx, cy, radius * 0.35, cx, cy, radius);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, `rgba(0,0,0,${amount * 0.7})`);

  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function clamp(val) {
  return val < 0 ? 0 : val > 255 ? 255 : val;
}
