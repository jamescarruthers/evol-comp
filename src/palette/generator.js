// palette/generator.js — Palette generation strategies

import { hslToRgb, rgbToLab } from './harmony.js';

/**
 * Build a colour object from HSL values.
 */
function makeColour(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const rgb = hslToRgb(h, s, l);
  const lab = rgbToLab(rgb[0], rgb[1], rgb[2]);
  return { h, s, l, rgb, lab };
}

/**
 * Generate variations of a hue with different saturation/lightness.
 */
function hueVariations(hue, count) {
  const colours = [];
  for (let i = 0; i < count; i++) {
    const s = 0.4 + Math.random() * 0.5;   // 0.4–0.9
    const l = 0.25 + Math.random() * 0.45;  // 0.25–0.7
    colours.push(makeColour(hue, s, l));
  }
  return colours;
}

/**
 * Complementary palette — base hue + hue+180, with tints/shades.
 */
export function generateComplementary() {
  const base = Math.random() * 360;
  const colours = [
    ...hueVariations(base, 3),
    ...hueVariations(base + 180, 3)
  ];
  return colours;
}

/**
 * Analogous palette — base hue ± 30.
 */
export function generateAnalogous() {
  const base = Math.random() * 360;
  const colours = [
    ...hueVariations(base - 30, 2),
    ...hueVariations(base, 2),
    ...hueVariations(base + 30, 2)
  ];
  return colours;
}

/**
 * Triadic palette — base hue, +120, +240.
 */
export function generateTriadic() {
  const base = Math.random() * 360;
  const colours = [
    ...hueVariations(base, 2),
    ...hueVariations(base + 120, 2),
    ...hueVariations(base + 240, 2)
  ];
  return colours;
}

/**
 * Split-complementary palette — base hue, +150, +210.
 */
export function generateSplitComplementary() {
  const base = Math.random() * 360;
  const colours = [
    ...hueVariations(base, 2),
    ...hueVariations(base + 150, 2),
    ...hueVariations(base + 210, 2)
  ];
  return colours;
}

/**
 * Monochromatic palette — single hue, vary saturation and lightness.
 */
export function generateMonochromatic() {
  const hue = Math.random() * 360;
  const colours = [];
  for (let i = 0; i < 6; i++) {
    const s = 0.2 + Math.random() * 0.8;
    const l = 0.2 + Math.random() * 0.6;
    colours.push(makeColour(hue, s, l));
  }
  return colours;
}

/**
 * Random harmonious — pick hues from Matsuda-inspired template sectors.
 * Simplified: pick a random template type and sample hues from allowed sectors.
 */
export function generateRandomHarmonious() {
  const templates = [
    // Each template defines angular sectors (centre, width) on the hue wheel
    [{ c: 0, w: 36 }],                                    // i-type (single sector)
    [{ c: 0, w: 36 }, { c: 180, w: 36 }],                // V-type (complementary sectors)
    [{ c: 0, w: 36 }, { c: 90, w: 36 }],                 // L-type (right angle)
    [{ c: 0, w: 18 }, { c: 180, w: 18 }],                // I-type (narrow complementary)
    [{ c: 0, w: 60 }, { c: 180, w: 36 }],                // T-type
    [{ c: 0, w: 60 }, { c: 120, w: 36 }, { c: 240, w: 36 }], // Y-type
  ];

  const template = templates[Math.floor(Math.random() * templates.length)];
  const rotation = Math.random() * 360;

  const colours = [];
  const count = 4 + Math.floor(Math.random() * 3); // 4–6 colours
  for (let i = 0; i < count; i++) {
    const sector = template[Math.floor(Math.random() * template.length)];
    const hue = rotation + sector.c + (Math.random() - 0.5) * sector.w;
    const s = 0.35 + Math.random() * 0.55;
    const l = 0.25 + Math.random() * 0.45;
    colours.push(makeColour(hue, s, l));
  }
  return colours;
}

/**
 * All strategies mapped by name.
 */
export const STRATEGIES = {
  complementary: generateComplementary,
  analogous: generateAnalogous,
  triadic: generateTriadic,
  'split-complementary': generateSplitComplementary,
  monochromatic: generateMonochromatic,
  random: generateRandomHarmonious
};

/**
 * Generate a palette using a named strategy (or random strategy if not specified).
 */
export function generatePalette(strategyName) {
  if (strategyName && STRATEGIES[strategyName]) {
    return STRATEGIES[strategyName]();
  }
  // Pick a random strategy
  const keys = Object.keys(STRATEGIES);
  const key = keys[Math.floor(Math.random() * keys.length)];
  return STRATEGIES[key]();
}
