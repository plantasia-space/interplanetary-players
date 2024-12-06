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
   * Adds or updates a parameter with the given configuration.
   * @param {string} name - The name of the parameter.
   * @param {number} normalizedValue - The normalized value [0,1].
   * @param {number} min - The minimum raw value.
   * @param {number} max - The maximum raw value.
   * @param {boolean} isBidirectional - If true, allows two-way updates.
   * @param {function} inputTransform - Function to transform input values.
   * @param {function} outputTransform - Function to transform output values.
   */
  addParameter(
    name,
    normalizedValue = 0,
    min = 0,
    max = 1,
    isBidirectional = false,
    scale = "linear",
    inputTransform = (x) => x,
    outputTransform = (x) => x
  ) {
    if (this.parameters.has(name)) {
      const param = this.parameters.get(name);
      let rangeChanged = false;
      let scaleChanged = false;
  
      if (min !== param.min || max !== param.max) {
        rangeChanged = true;
        param.min = min;
        param.max = max;
      }
  
      if (scale !== param.scale) {
        scaleChanged = true;
        param.scale = scale;
      }
  
      // Update raw and normalized values
      const transformedRawValue = inputTransform(normalizedValue);
      const clampedRawValue = Math.min(max, Math.max(min, transformedRawValue));
      const updatedNormalizedValue = this.normalize(clampedRawValue, min, max);
  
      param.rawValue = clampedRawValue;
      param.normalizedValue = updatedNormalizedValue;
      param.isBidirectional = isBidirectional;
      param.inputTransform = inputTransform;
      param.outputTransform = outputTransform;
  
      if (rangeChanged) {
        // Emit range update event
        this.emitRangeUpdate(name, min, max);
      }
  
      if (scaleChanged) {
        // Emit scale update event
        this.emitScaleUpdate(name, scale);
      }
  
      // Notify subscribers of value change
      this.emitValueUpdate(name, param.outputTransform(param.rawValue));
  
      return;
    }
  
    // Otherwise, create a new parameter
    const transformedRawValue = inputTransform(normalizedValue);
    const clampedRawValue = Math.min(max, Math.max(min, transformedRawValue));
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
      lastUpdateTimestamp: 0,
      lastController: null,
      scale,
      inputTransform,
      outputTransform,
    });
  
    // Emit both range and value update events
    this.emitRangeUpdate(name, min, max);
    this.emitValueUpdate(name, transformedRawValue);
    this.emitScaleUpdate(name, scale);
  }
  /**
   * Emits a range update event for a parameter.
   * @param {string} name - The parameter name.
   * @param {number} min - The new minimum value.
   * @param {number} max - The new maximum value.
   */
  emitRangeUpdate(name, min, max) {
    const param = this.parameters.get(name);
    param.subscribers.forEach(({ controller }) => {
      if (typeof controller.onRangeChanged === 'function') {
        controller.onRangeChanged(name, min, max);
      }
    });
    //console.debug(`[ParameterManager] Emitted range update for '${name}' with min=${min}, max=${max}`);
  }

    /**
     * Emits a value update event for a parameter.
     * @param {string} name - The parameter name.
     * @param {number} value - The new value.
     */
    emitValueUpdate(name, value) {
      const param = this.parameters.get(name);
      param.subscribers.forEach(({ controller }) => {
        if (typeof controller.onParameterChanged === 'function') {
          controller.onParameterChanged(name, value);
        }
      });
      //console.debug(`[ParameterManager] Emitted value update for '${name}' with value=${value}`);
    }
/**
 * Emits a scale update event for a parameter.
 * @param {string} name - The parameter name.
 * @param {string} scale - The new scale value (e.g., "linear" or "logarithmic").
 */
emitScaleUpdate(name, scale) {
  const param = this.parameters.get(name);
  param.subscribers.forEach(({ controller }) => {
    if (typeof controller.onScaleChanged === 'function') {
      controller.onScaleChanged(name, scale);
    }
  });
  console.debug(`[ParameterManager] Emitted scale update for '${name}' with scale=${scale}`);
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
      //console.debug(`[subscribe] Controller subscribed to '${parameterName}' with priority ${priority}`);
    } else {
     // console.warn(`Parameter '${parameterName}' does not exist. Adding with default values.`);
      // Initialize with default normalized value 0
      this.addParameter(parameterName, 0, 0, 1, false);
      const param = this.parameters.get(parameterName);
      param.subscribers.add({ controller, priority });
      //console.debug(`[subscribe] Controller subscribed to newly added parameter '${parameterName}' with priority ${priority}`);
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
        //console.debug(`[unsubscribe] Controller unsubscribed from '${parameterName}'`);
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

          //console.debug(`[setRawValue] Updated '${parameterName}' to rawValue=${param.rawValue}, normalizedValue=${param.normalizedValue}`);

          // Notify subscribers
          param.subscribers.forEach(({ controller }) => {
            if (controller !== sourceController || param.isBidirectional) {
              if (typeof controller.onParameterChanged === 'function') {
                // Apply the output transformation before notifying
                const transformedValue = param.outputTransform(param.rawValue);
                //console.debug(`[setRawValue] Notifying controller of '${parameterName}' with value=${transformedValue}`);
                controller.onParameterChanged(parameterName, transformedValue);
              } else {
                console.warn(`[setRawValue] Controller does not implement 'onParameterChanged':`, controller);
              }
            }
          });
        } else {
          //console.debug(`[setRawValue] No change in rawValue for '${parameterName}'. Update skipped.`);
        }
      } else {
        //console.debug(`[setRawValue] Update for '${parameterName}' ignored due to priority or simultaneous threshold.`);
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
        console.debug(
          `[setNormalizedValue] rootParam: '${parameterName}', source: ${sourceController?.constructor.name}, ` +
          `rawValue: ${param.rawValue}, normalizedValue: ${param.normalizedValue}, isBidirectional: ${param.isBidirectional}`
      );
      
        if (param.rawValue !== clampedRawValue || param.normalizedValue !== normalizedValue) {
          param.rawValue = clampedRawValue;
          param.normalizedValue = updatedNormalizedValue;
          param.lastPriority = priority;
          param.lastUpdateTimestamp = now;
          param.lastController = sourceController;

          //console.debug(`[setNormalizedValue] Updated '${parameterName}' to rawValue=${param.rawValue}, normalizedValue=${param.normalizedValue}`);
          console.log("getIt0");

          // Notify subscribers
          param.subscribers.forEach(({ controller }) => {
            console.debug(`[Notification Check] Controller: ${controller.constructor.name}, Source: ${sourceController?.constructor.name}`);
            if (controller !== sourceController || param.isBidirectional) {
                console.debug(`[Notify Subscriber] Notifying '${controller.constructor.name}' for '${parameterName}' with value=${param.rawValue}`);
                if (typeof controller.onParameterChanged === 'function') {
                    const transformedValue = param.outputTransform(param.rawValue);
                    controller.onParameterChanged(parameterName, transformedValue);
                } else {
                    console.warn(`[Notification Warning] Controller does not implement 'onParameterChanged':`, controller);
                }
            } else {
                console.debug(`[Notification Skipped] SourceController matches and parameter is not bidirectional.`);
            }
        });
        } else {
          //console.debug(`[setNormalizedValue] No change in normalizedValue for '${parameterName}'. Update skipped.`);
        }
      } else {
        //console.debug(`[setNormalizedValue] Update for '${parameterName}' ignored due to priority or simultaneous threshold.`);
      }
    }
  }
  // The new straightforward setToMiddle function
  /**
   * Sets the parameter to the middle (normalized value of 0.5) directly,
   * without any priority or simultaneous logic.
   * @param {string} parameterName - The parameter name.
   * @param {object|null} sourceController - The controller making the change (optional).
   */
  setToMiddle(parameterName) {
    const param = this.parameters.get(parameterName);
    if (!param) {
      console.warn(`[setToMiddle] Parameter '${parameterName}' does not exist.`);
      return;
    }

    // Calculate the middle in raw terms
    const rawMid = (param.min + param.max) / 2;
    param.rawValue = rawMid;
    param.normalizedValue = 0.5;

    // Directly notify all subscribers (no checks)
    param.subscribers.forEach(({ controller }) => {
      if (typeof controller.onParameterChanged === 'function') {
        const transformedValue = param.outputTransform(param.rawValue);
        controller.onParameterChanged(parameterName, transformedValue);
      }
    });
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
      scale: param.scale,
      inputTransform: param.inputTransform,
      outputTransform: param.outputTransform,
    }));
  }


/**
 * Gets the details of a specific parameter by name.
 * Useful for accessing and debugging individual parameters.
 * @param {string} paramName - The name of the parameter to retrieve.
 * @returns {Object|null} - The parameter details or null if not found.
 */
getParameter(paramName) {
  if (this.parameters.has(paramName)) {
    const param = this.parameters.get(paramName);
    return {
      name: paramName,
      rawValue: param.rawValue,
      normalizedValue: param.normalizedValue,
      min: param.min,
      max: param.max,
      isBidirectional: param.isBidirectional,
      lastPriority: param.lastPriority,
      subscribers: [...param.subscribers],
      scale: param.scale,
      inputTransform: param.inputTransform,
      outputTransform: param.outputTransform,
    };
  }
  return null; // Parameter not found
}

}// Export the Singleton instance
export const user1Manager = ParameterManager.getInstance();