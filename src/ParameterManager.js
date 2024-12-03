// ParameterManager.js

import { linear, logarithmic } from './Transformations';

export class ParameterManager {
  constructor() {
    if (ParameterManager.instance) {
      return ParameterManager.instance;
    }

    this.parameters = new Map(); // Map of parameterName -> parameter object
    ParameterManager.instance = this;
  }

  /**
   * Provides access to the Singleton instance.
   * @returns {ParameterManager} - The Singleton instance.
   */
  static getInstance() {
    if (!ParameterManager.instance) {
      ParameterManager.instance = new ParameterManager();
    }
    return ParameterManager.instance;
  }

  /**
   * Adds a new parameter to the manager with optional bidirectional communication and transformation functions.
   * If the parameter already exists, updates its settings and notifies subscribers of the current value.
   * @param {string} name - The parameter name.
   * @param {number} normalizedValue - The initial normalized value of the parameter [0, 1].
   * @param {number} min - The minimum raw value for the parameter range.
   * @param {number} max - The maximum raw value for the parameter range.
   * @param {boolean} isBidirectional - Indicates if the parameter supports bidirectional updates.
   * @param {function} inputTransform - Function to transform input normalized values to raw values.
   * @param {function} outputTransform - Function to transform raw values to normalized values.
   */
  addParameter(
    name,
    normalizedValue = 0,
    min = 0,
    max = 1,
    isBidirectional = false,
    inputTransform = (x) => x, // Default linear transform
    outputTransform = (x) => x  // Default linear transform
  ) {
    if (this.parameters.has(name)) {
      console.warn(`[addParameter] Parameter '${name}' already exists. Updating settings.`);
      const param = this.parameters.get(name);

      // Apply inputTransform to the incoming normalizedValue to get rawValue
      const transformedRawValue = inputTransform(normalizedValue);
      const clampedRawValue = Math.min(max, Math.max(min, transformedRawValue)); // Clamp rawValue to the new range
      const updatedNormalizedValue = this.normalize(clampedRawValue, min, max);

      // Update settings
      param.rawValue = clampedRawValue;
      param.normalizedValue = updatedNormalizedValue;
      param.min = min;
      param.max = max;
      param.isBidirectional = isBidirectional;
      param.inputTransform = inputTransform;
      param.outputTransform = outputTransform;

      console.debug(`[addParameter] Updated parameter '${name}' with rawValue: ${param.rawValue}, normalizedValue: ${param.normalizedValue}, min: ${min}, max: ${max}, bidirectional: ${isBidirectional}`);

      // Notify subscribers of the current value with updated transforms
      param.subscribers.forEach(({ controller }) => {
        if (typeof controller.onParameterChanged === 'function') {
          // Apply the output transformation before notifying
          const transformedValue = outputTransform(param.rawValue);
          console.debug(`[addParameter] Notifying controller of '${name}' with updated value=${transformedValue}`);
          controller.onParameterChanged(name, transformedValue);
        } else {
          console.warn(`[addParameter] Controller does not implement 'onParameterChanged':`, controller);
        }
      });

      return;
    }

    // Otherwise, create a new parameter
    // Apply inputTransform to the incoming normalizedValue to get rawValue
    const transformedRawValue = inputTransform(normalizedValue);
    const clampedRawValue = Math.min(max, Math.max(min, transformedRawValue)); // Clamp rawValue to the range
    const normalized = this.normalize(clampedRawValue, min, max);

    this.parameters.set(name, {
      name,
      rawValue: clampedRawValue,
      normalizedValue: normalized,
      min,
      max,
      subscribers: new Set(),
      isBidirectional,
      lastPriority: Infinity,
      lastUpdateTimestamp: 0, // Initialize timestamp
      lastController: null, // Initialize controller
      inputTransform,
      outputTransform,
    });

    console.debug(`[addParameter] Added new parameter '${name}' with rawValue: ${clampedRawValue}, normalizedValue: ${normalized}, min: ${min}, max: ${max}`);
  }

  /**
   * Subscribes a controller to a parameter with a specified priority.
   * @param {object} controller - The controller subscribing to the parameter.
   * @param {string} parameterName - The name of the parameter.
   * @param {number} priority - The priority of the controller (1 is highest).
   */
  subscribe(controller, parameterName, priority = Infinity) {
    if (typeof controller.onParameterChanged !== 'function') {
      console.error(`Controller must implement 'onParameterChanged' method.`);
      return;
    }

    if (this.parameters.has(parameterName)) {
      const param = this.parameters.get(parameterName);
      param.subscribers.add({ controller, priority });
      console.debug(`[subscribe] Controller subscribed to '${parameterName}' with priority ${priority}`);
    } else {
      console.warn(`Parameter '${parameterName}' does not exist. Adding with default values.`);
      // Initialize with default normalized value 0
      this.addParameter(parameterName, 0, 0, 1, false);
      const param = this.parameters.get(parameterName);
      param.subscribers.add({ controller, priority });
      console.debug(`[subscribe] Controller subscribed to newly added parameter '${parameterName}' with priority ${priority}`);
    }

    // Immediately notify the controller of the current value
    const param = this.parameters.get(parameterName);
    if (param && typeof controller.onParameterChanged === 'function') {
      const transformedValue = param.outputTransform(param.rawValue);
      controller.onParameterChanged(parameterName, transformedValue);
    }
  }

  /**
   * Unsubscribes a controller from a parameter.
   * @param {object} controller - The controller to remove.
   * @param {string} parameterName - The parameter to unsubscribe from.
   */
  unsubscribe(controller, parameterName) {
    if (this.parameters.has(parameterName)) {
      const param = this.parameters.get(parameterName);
      const initialSize = param.subscribers.size;
      param.subscribers = new Set(
        [...param.subscribers].filter((sub) => sub.controller !== controller)
      );
      if (param.subscribers.size < initialSize) {
        console.debug(`[unsubscribe] Controller unsubscribed from '${parameterName}'`);
      } else {
        console.warn(`[unsubscribe] Controller was not subscribed to '${parameterName}'`);
      }
    } else {
      console.warn(`[unsubscribe] Parameter '${parameterName}' does not exist.`);
    }
  }

  /**
   * Updates the raw value of a parameter and notifies subscribers.
   * Handles bidirectional updates if enabled and ensures priority rules.
   * @param {string} parameterName - The parameter name.
   * @param {number} rawValue - The new raw value to set.
   * @param {object|null} sourceController - The controller making the change (optional).
   * @param {number} priority - The priority of the update (1 is highest).
   */
  setRawValue(parameterName, rawValue, sourceController = null, priority = Infinity) {
    if (this.parameters.has(parameterName)) {
      const param = this.parameters.get(parameterName);

      const now = Date.now();
      const simultaneousThreshold = 50; // 50 ms for "simultaneous" updates

      // Determine if this update is "simultaneous"
      const isSimultaneous = now - (param.lastUpdateTimestamp || 0) < simultaneousThreshold;

      // Check if the source controller is the same
      const isSameController = sourceController === param.lastController;

      if (
        (!isSimultaneous || priority < param.lastPriority) ||
        (isSimultaneous && isSameController)
      ) {
        // Apply inputTransform to the incoming rawValue
        const transformedRawValue = param.inputTransform(rawValue);

        const clampedRawValue = Math.min(param.max, Math.max(param.min, transformedRawValue)); // Clamp rawValue to the range
        const normalizedValue = this.normalize(clampedRawValue, param.min, param.max);

        if (param.rawValue !== clampedRawValue) {
          param.rawValue = clampedRawValue;
          param.normalizedValue = normalizedValue;
          param.lastPriority = priority;
          param.lastUpdateTimestamp = now;
          param.lastController = sourceController;

          console.debug(`[setRawValue] Updated '${parameterName}' to rawValue=${param.rawValue}, normalizedValue=${param.normalizedValue}`);

          // Notify subscribers
          param.subscribers.forEach(({ controller }) => {
            if (controller !== sourceController || param.isBidirectional) {
              if (typeof controller.onParameterChanged === 'function') {
                // Apply the output transformation before notifying
                const transformedValue = param.outputTransform(param.rawValue);
                console.debug(`[setRawValue] Notifying controller of '${parameterName}' with value=${transformedValue}`);
                controller.onParameterChanged(parameterName, transformedValue);
              } else {
                console.warn(`[setRawValue] Controller does not implement 'onParameterChanged':`, controller);
              }
            }
          });
        } else {
          console.debug(`[setRawValue] No change in rawValue for '${parameterName}'. Update skipped.`);
        }
      } else {
        console.debug(`[setRawValue] Update for '${parameterName}' ignored due to priority or simultaneous threshold.`);
      }
    } else {
      console.warn(`[setRawValue] Parameter '${parameterName}' not found.`);
    }
  }

  /**
   * Sets the value from a controller by applying the inputTransform.
   * @param {string} parameterName - The parameter name.
   * @param {number} controllerValue - The normalized value from the controller [0, 1].
   * @param {object|null} sourceController - The controller making the change (optional).
   * @param {number} priority - The priority of the update (1 is highest).
   */
  setControllerValue(parameterName, controllerValue, sourceController = null, priority = Infinity) {
    if (this.parameters.has(parameterName)) {
      const param = this.parameters.get(parameterName);
      // Apply inputTransform to controllerValue to get rawValue
      const rawValue = param.inputTransform(controllerValue);
      this.setRawValue(parameterName, rawValue, sourceController, priority);
    } else {
      console.warn(`[ParameterManager] setControllerValue: Parameter '${parameterName}' not found.`);
    }
  }

  /**
   * Updates the normalized value of a parameter and notifies subscribers.
   * Converts normalized to raw before updating.
   * @param {string} parameterName - The parameter name.
   * @param {number} normalizedValue - The new normalized value to set [0, 1].
   * @param {object|null} sourceController - The controller making the change (optional).
   * @param {number} priority - The priority of the update (1 is highest).
   */
  setNormalizedValue(parameterName, normalizedValue, sourceController = null, priority = Infinity) {
    if (this.parameters.has(parameterName)) {
      const param = this.parameters.get(parameterName);

      const now = Date.now();
      const simultaneousThreshold = 50; // 50 ms for "simultaneous" updates

      // Determine if this update is "simultaneous"
      const isSimultaneous = now - (param.lastUpdateTimestamp || 0) < simultaneousThreshold;

      // Check if the source controller is the same
      const isSameController = sourceController === param.lastController;

      if (
        (!isSimultaneous || priority < param.lastPriority) ||
        (isSimultaneous && isSameController)
      ) {
        // Denormalize the normalized value to rawValue
        const denormalizedValue = this.denormalize(normalizedValue, param.min, param.max);

        // Apply inputTransform to the denormalized value
        const transformedRawValue = param.inputTransform(denormalizedValue);

        const clampedRawValue = Math.min(param.max, Math.max(param.min, transformedRawValue)); // Clamp rawValue to the range
        const updatedNormalizedValue = this.normalize(clampedRawValue, param.min, param.max);

        if (param.rawValue !== clampedRawValue || param.normalizedValue !== normalizedValue) {
          param.rawValue = clampedRawValue;
          param.normalizedValue = updatedNormalizedValue;
          param.lastPriority = priority;
          param.lastUpdateTimestamp = now;
          param.lastController = sourceController;

          console.debug(`[setNormalizedValue] Updated '${parameterName}' to rawValue=${param.rawValue}, normalizedValue=${param.normalizedValue}`);

          // Notify subscribers
          param.subscribers.forEach(({ controller }) => {
            if (controller !== sourceController || param.isBidirectional) {
              if (typeof controller.onParameterChanged === 'function') {
                // Apply the output transformation before notifying
                const transformedValue = param.outputTransform(param.rawValue);
                console.debug(`[setNormalizedValue] Notifying controller of '${parameterName}' with value=${transformedValue}`);
                controller.onParameterChanged(parameterName, transformedValue);
              } else {
                console.warn(`[setNormalizedValue] Controller does not implement 'onParameterChanged':`, controller);
              }
            }
          });
        } else {
          console.debug(`[setNormalizedValue] No change in normalizedValue for '${parameterName}'. Update skipped.`);
        }
      } else {
        console.debug(`[setNormalizedValue] Update for '${parameterName}' ignored due to priority or simultaneous threshold.`);
      }
    }
  }

  /**
   * Retrieves the current raw value of a parameter.
   * @param {string} parameterName - The parameter name.
   * @returns {number|null} - The raw value of the parameter or null if it doesn't exist.
   */
  getRawValue(parameterName) {
    return this.parameters.get(parameterName)?.rawValue ?? null;
  }

  /**
   * Retrieves the current normalized value of a parameter.
   * @param {string} parameterName - The parameter name.
   * @returns {number|null} - The normalized value of the parameter or null if it doesn't exist.
   */
  getNormalizedValue(parameterName) {
    return this.parameters.get(parameterName)?.normalizedValue ?? null;
  }

  /**
   * Normalizes a raw value to a [0, 1] range based on min and max.
   * @param {number} rawValue - The raw value to normalize.
   * @param {number} min - The minimum range.
   * @param {number} max - The maximum range.
   * @returns {number} - The normalized value.
   */
  normalize(rawValue, min, max) {
    return (rawValue - min) / (max - min);
  }

  /**
   * Denormalizes a normalized value [0, 1] to the raw range.
   * @param {number} normalizedValue - The normalized value to denormalize.
   * @param {number} min - The minimum range.
   * @param {number} max - The maximum range.
   * @returns {number} - The denormalized raw value.
   */
  denormalize(normalizedValue, min, max) {
    return normalizedValue * (max - min) + min;
  }

  /**
   * Lists all registered parameters with their current values and settings.
   * Useful for debugging.
   * @returns {Array} - An array of parameter details.
   */
  listParameters() {
    return Array.from(this.parameters.entries()).map(([name, param]) => ({
      name,
      rawValue: param.rawValue,
      normalizedValue: param.normalizedValue,
      min: param.min,
      max: param.max,
      isBidirectional: param.isBidirectional,
      lastPriority: param.lastPriority,
      subscribers: [...param.subscribers],
      inputTransform: param.inputTransform,
      outputTransform: param.outputTransform,
    }));
  }
}

// Export the Singleton instance
export const user1Manager = ParameterManager.getInstance();