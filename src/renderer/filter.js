// renderer/filter.js — Post-processing filters for an analogue aesthetic
//
// Applies grain (luminance noise) and a vignette to any canvas to soften
// the hard digital edges and give compositions a more organic, printed look.

/**
 * Apply analogue-style post-processing filters to a canvas.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width  - canvas width in pixels
 * @param {number} height - canvas height in pixels
 * @param {Object} options
 * @param {number} options.grainAmount   - grain intensity 0–1 (0 = off, 0.3 = subtle, 0.6+ = heavy)
 * @param {number} options.vignetteAmount - vignette intensity 0–1 (0 = off)
 */
export function applyAnalogueFilter(ctx, width, height, options = {}) {
  const { grainAmount = 0, vignetteAmount = 0 } = options;

  if (grainAmount > 0) {
    applyGrain(ctx, width, height, grainAmount);
  }

  if (vignetteAmount > 0) {
    applyVignette(ctx, width, height, vignetteAmount);
  }
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
