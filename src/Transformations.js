// Transformations.js

/**
 * Transformation functions for non-linear parameter mappings.
 * Each transformation includes an inputTransform and an outputTransform.
 * 
 * Usage:
 * Import the required transformation and apply it when adding parameters.
 * 
 * Example:
 * import { logarithmic } from './Transformations';
 * 
 * ParameterManagerInstance.addParameter(
 *   'volume',
 *   0.5, // Initial raw value
 *   0,   // Min raw value
 *   1,   // Max raw value
 *   true, // isBidirectional
 *   logarithmic.inverse, // inputTransform
 *   logarithmic.forward // outputTransform
 * );
 */

export const linear = {
  /**
   * Linear transformation (identity).
   * Suitable for parameters where linear scaling is appropriate.
   */
  forward: (x) => x,
  inverse: (y) => y,
};

export const logarithmic = {
  /**
   * Logarithmic transformation.
   * Converts linear [0,1] to logarithmic scale suitable for audio volume.
   * Handles edge cases by clamping input to avoid log(0).
   */
  forward: (x) => {
    const minDb = -60; // Minimum decibels
    const maxDb = 6;    // Maximum decibels
    const clampedX = Math.max(0, x); // Prevent log(0)
    const db = minDb + (maxDb - minDb) * clampedX; // Linear interpolation in dB
    return Math.pow(10, db / 20); // Convert dB to linear gain
  },
  inverse: (y) => {
    const minDb = -60;
    const maxDb = 6;
    const clampedY = Math.max(0.0001, y); // Prevent log(0) or negative values
    const db = 20 * Math.log10(clampedY);
    return (db - minDb) / (maxDb - minDb);
  },
};

export const exponential = {
  /**
   * Exponential transformation.
   * Accelerates scaling, useful for parameters requiring rapid increase.
   */
  forward: (x) => Math.pow(x, 2), // Example: quadratic scaling
  inverse: (y) => Math.sqrt(y),   // Inverse of quadratic scaling
};

export const squareRoot = {
  /**
   * Square root transformation.
   * Decelerates scaling, useful for parameters requiring gentle increase.
   */
  forward: (x) => Math.sqrt(x),
  inverse: (y) => Math.pow(y, 2),
};

export const cubic = {
  /**
   * Cubic transformation.
   * Provides more aggressive scaling compared to quadratic.
   */
  forward: (x) => Math.pow(x, 3),
  inverse: (y) => Math.cbrt(y),
};

export const sine = {
  /**
   * Sine transformation.
   * Creates smooth oscillations, useful for parameters modulated by sine waves.
   */
  forward: (x) => Math.sin(x * Math.PI / 2), // Maps [0,1] to [0,1] with ease-in
  inverse: (y) => (2 / Math.PI) * Math.asin(y), // Inverse sine transformation
};

export const inverseSine = {
  /**
   * Inverse Sine transformation.
   * Applies the inverse of the sine transformation.
   */
  forward: (x) => (2 / Math.PI) * Math.asin(x), // Maps [0,1] to [0,1] with ease-out
  inverse: (y) => Math.sin((Math.PI / 2) * y),
};

export const logarithmicCustom = (minDb = -60, maxDb = 6) => ({
  /**
   * Custom logarithmic transformation with adjustable dB range.
   * @param {number} x - Normalized input [0,1].
   * @returns {number} - Transformed value.
   */
  forward: (x) => {
    const clampedX = Math.max(0, x);
    const db = minDb + (maxDb - minDb) * clampedX;
    return Math.pow(10, db / 20);
  },
  /**
   * Inverse of the custom logarithmic transformation.
   * @param {number} y - Transformed value.
   * @returns {number} - Normalized output [0,1].
   */
  inverse: (y) => {
    const clampedY = Math.max(0.0001, y);
    const db = 20 * Math.log10(clampedY);
    return (db - minDb) / (maxDb - minDb);
  },
});

/**
 * Piecewise Linear Transformation.
 * Allows defining multiple linear segments for more complex mappings.
 * 
 * Example:
 * const piecewise = piecewiseLinear([
 *   { x: 0, y: 0 },
 *   { x: 0.5, y: 0.3 },
 *   { x: 1, y: 1 },
 * ]);
 * 
 * @param {Array} points - Array of points defining the piecewise linear function.
 * @returns {object} - Object containing forward and inverse functions.
 */
export const piecewiseLinear = (points) => {
  // Ensure points are sorted by x
  const sortedPoints = [...points].sort((a, b) => a.x - b.x);

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
    return x; // Fallback to linear
  };

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
    return y; // Fallback to linear
  };

  return { forward, inverse };
};