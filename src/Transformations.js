/**
 * @file Transformations.js
 * @description Provides transformation functions for non-linear parameter mappings.
 * Each transformation includes an `inputTransform` and an `outputTransform`.
 * 
 * @version 2.0.0
 * @autor 𝐵𝓇𝓊𝓃𝒶 𝒢𝓊𝒶𝓇𝓃𝒾𝑒𝓇𝒾
 * @license MIT
 * @date 2024-12-08
 * 
 * @example
 * // Example of using logarithmic transformation with ParameterManager
 * import { logarithmic } from './Transformations.js';
 * import { ParameterManager } from './ParameterManager.js';
 * 
 * const paramManager = ParameterManager.getInstance();
 * 
 * paramManager.addParameter(
 *   'volume',
 *   0.5, // Initial normalized value
 *   0,   // Min raw value
 *   100, // Max raw value
 *   true, // isBidirectional
 *   logarithmic.inverse, // inputTransform
 *   logarithmic.forward // outputTransform
 * );
 */

/**
 * @typedef {Object} Transformation
 * @property {function(number): number} forward - Transforms a raw value to a normalized value.
 * @property {function(number): number} inverse - Transforms a normalized value back to a raw value.
 */

/**
 * Linear transformation (identity).
 * Suitable for parameters where linear scaling is appropriate.
 * 
 * @type {Transformation}
 * @property {function(number): number} forward - Returns the input value unchanged.
 * @property {function(number): number} inverse - Returns the input value unchanged.
 */
export const linear = {
  forward: (x) => x,
  inverse: (normalized) => normalized,
};

/**
 * Logarithmic transformation.
 * Converts a normalized [0,1] value to a dB scale suitable for audio volume.
 * Handles edge cases by clamping input to avoid invalid logarithmic operations.
 * 
 * @type {Transformation}
 * @property {function(number): number} forward - Maps normalized [0,1] to dB scale.
 * @property {function(number): number} inverse - Maps dB scale back to normalized [0,1].
 */
export const logarithmic = {
  forward: (normalized) => {
    const minDb = -60; // Minimum decibels
    const maxDb = 6;    // Maximum decibels
    // Map normalized [0,1] to [minDb, maxDb] with logarithmic scaling
    return minDb + (maxDb - minDb) * normalized;
  },
  inverse: (db) => {
    const minDb = -60;
    const maxDb = 6;
    // Normalize dB to [0,1]
    return (db - minDb) / (maxDb - minDb);
  },
};

/**
 * Exponential transformation.
 * Accelerates scaling, useful for parameters requiring rapid increase.
 * 
 * @type {Transformation}
 * @property {function(number): number} forward - Applies exponential scaling.
 * @property {function(number): number} inverse - Applies inverse exponential scaling.
 */
export const exponential = {
  forward: (x) => Math.pow(x, 2), // Quadratic scaling as an example
  inverse: (y) => Math.sqrt(y),   // Inverse of quadratic scaling
};

/**
 * Square Root transformation.
 * Decelerates scaling, useful for parameters requiring gentle increase.
 * 
 * @type {Transformation}
 * @property {function(number): number} forward - Applies square root scaling.
 * @property {function(number): number} inverse - Applies inverse square scaling.
 */
export const squareRoot = {
  forward: (x) => Math.sqrt(x),
  inverse: (y) => Math.pow(y, 2),
};

/**
 * Cubic transformation.
 * Provides more aggressive scaling compared to quadratic.
 * 
 * @type {Transformation}
 * @property {function(number): number} forward - Applies cubic scaling.
 * @property {function(number): number} inverse - Applies inverse cubic scaling.
 */
export const cubic = {
  forward: (x) => Math.pow(x, 3),
  inverse: (y) => Math.cbrt(y),
};

/**
 * Sine transformation.
 * Creates smooth oscillations, useful for parameters modulated by sine waves.
 * 
 * @type {Transformation}
 * @property {function(number): number} forward - Applies sine-based easing (ease-in).
 * @property {function(number): number} inverse - Applies inverse sine-based easing.
 */
export const sine = {
  forward: (x) => Math.sin(x * Math.PI / 2), // Maps [0,1] to [0,1] with ease-in
  inverse: (y) => (2 / Math.PI) * Math.asin(y), // Inverse sine transformation
};

/**
 * Inverse Sine transformation.
 * Applies the inverse of the sine transformation.
 * 
 * @type {Transformation}
 * @property {function(number): number} forward - Applies inverse sine-based easing (ease-out).
 * @property {function(number): number} inverse - Applies sine-based easing.
 */
export const inverseSine = {
  forward: (x) => (2 / Math.PI) * Math.asin(x), // Maps [0,1] to [0,1] with ease-out
  inverse: (y) => Math.sin((Math.PI / 2) * y),
};

/**
 * Creates a custom logarithmic transformation with adjustable dB range.
 * 
 * @function logarithmicCustom
 * @param {number} [minDb=-60] - The minimum dB value.
 * @param {number} [maxDb=6] - The maximum dB value.
 * @returns {Transformation} - An object containing `forward` and `inverse` transformation functions.
 * 
 * @example
 * const customLog = logarithmicCustom(-80, 0);
 * paramManager.addParameter(
 *   'bass',
 *   0.5, // Initial normalized value
 *   -80, // Min dB
 *   0,   // Max dB
 *   true, // isBidirectional
 *   customLog.inverse, // inputTransform
 *   customLog.forward // outputTransform
 * );
 */
export const logarithmicCustom = (minDb = -60, maxDb = 6) => ({
  /**
   * Custom logarithmic forward transformation.
   * Maps normalized [0,1] to a linear amplitude scale based on dB.
   * 
   * @param {number} x - Normalized input [0,1].
   * @returns {number} - Transformed amplitude value.
   */
  forward: (x) => {
    const clampedX = Math.max(0, x);
    const db = minDb + (maxDb - minDb) * clampedX;
    return Math.pow(10, db / 20);
  },
  /**
   * Custom logarithmic inverse transformation.
   * Maps amplitude value back to normalized [0,1].
   * 
   * @param {number} y - Transformed amplitude value.
   * @returns {number} - Normalized output [0,1].
   */
  inverse: (y) => {
    const clampedY = Math.max(0.0001, y); // Prevent log(0)
    const db = 20 * Math.log10(clampedY);
    return (db - minDb) / (maxDb - minDb);
  },
});

/**
 * Creates a piecewise linear transformation.
 * Allows defining multiple linear segments for more complex mappings.
 * 
 * @function piecewiseLinear
 * @param {Array<{x: number, y: number}>} points - Array of points defining the piecewise linear function.
 * Must be sorted in ascending order of `x`.
 * 
 * @returns {Transformation} - An object containing `forward` and `inverse` transformation functions.
 * 
 * @example
 * const piecewise = piecewiseLinear([
 *   { x: 0, y: 0 },
 *   { x: 0.5, y: 0.3 },
 *   { x: 1, y: 1 },
 * ]);
 * paramManager.addParameter(
 *   'filter',
 *   0.5, // Initial normalized value
 *   0,   // Min raw value
 *   1,   // Max raw value
 *   true, // isBidirectional
 *   piecewise.inverse, // inputTransform
 *   piecewise.forward // outputTransform
 * );
 */
export const piecewiseLinear = (points) => {
  // Ensure points are sorted by x
  const sortedPoints = [...points].sort((a, b) => a.x - b.x);

  /**
   * Forward transformation function.
   * Maps normalized input to output based on piecewise linear segments.
   * 
   * @param {number} x - Normalized input [0,1].
   * @returns {number} - Transformed output value.
   */
  const forward = (x) => {
    if (x <= sortedPoints[0].x) return sortedPoints[0].y;
    if (x >= sortedPoints[sortedPoints.length - 1].x) return sortedPoints[sortedPoints.length - 1].y;

    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const p0 = sortedPoints[i];
      const p1 = sortedPoints[i + 1];
      if (x >= p0.x && x <= p1.x) {
        const t = (x - p0.x) / (p1.x - p0.x);
        return p0.y + t * (p1.y - p0.y);
      }
    }
    return x; // Fallback to linear if no segment matches
  };

  /**
   * Inverse transformation function.
   * Maps output value back to normalized input based on piecewise linear segments.
   * 
   * @param {number} y - Transformed output value.
   * @returns {number} - Normalized input [0,1].
   */
  const inverse = (y) => {
    if (y <= sortedPoints[0].y) return sortedPoints[0].x;
    if (y >= sortedPoints[sortedPoints.length - 1].y) return sortedPoints[sortedPoints.length - 1].x;

    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const p0 = sortedPoints[i];
      const p1 = sortedPoints[i + 1];
      if (y >= p0.y && y <= p1.y) {
        const t = (y - p0.y) / (p1.y - p0.y);
        return p0.x + t * (p1.x - p0.x);
      }
    }
    return y; // Fallback to linear if no segment matches
  };

  return { forward, inverse };
};