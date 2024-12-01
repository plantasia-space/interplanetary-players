export class ParameterManager {
  constructor() {
    this.parameters = new Map(); // Map of parameterName -> { rawValue, normalizedValue, min, max, subscribers, isBidirectional, lastPriority }
  }

  /**
   * Adds a new parameter to the manager with optional bidirectional communication.
   * @param {string} name - The parameter name.
   * @param {number} rawValue - The initial raw value of the parameter.
   * @param {number} min - The minimum value for the parameter range.
   * @param {number} max - The maximum value for the parameter range.
   * @param {boolean} isBidirectional - Indicates if the parameter supports bidirectional updates.
   */
  addParameter(name, rawValue = 0, min = 0, max = 1, isBidirectional = false) {
    if (!this.parameters.has(name)) {
      const normalizedValue = this.normalize(rawValue, min, max);

      this.parameters.set(name, {
        rawValue,
        normalizedValue,
        min,
        max,
        subscribers: new Set(),
        isBidirectional: isBidirectional,
        lastPriority: Infinity, // Higher number means lower priority initially
      });
    }
  }

  /**
   * Subscribes a controller to a parameter with a specified priority.
   * @param {object} controller - The controller subscribing to the parameter.
   * @param {string} parameterName - The name of the parameter.
   * @param {number} priority - The priority of the controller (1 is highest).
   */
  subscribe(controller, parameterName, priority = Infinity) {
    if (this.parameters.has(parameterName)) {
      const param = this.parameters.get(parameterName);
      param.subscribers.add({ controller, priority });
    } else {
      console.warn(`Parameter '${parameterName}' does not exist. Adding with default values.`);
      this.addParameter(parameterName);
      this.parameters.get(parameterName).subscribers.add({ controller, priority });
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
      param.subscribers = new Set(
        [...param.subscribers].filter((sub) => sub.controller !== controller)
      );
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

      if (priority <= param.lastPriority) {
        const normalizedValue = this.normalize(rawValue, param.min, param.max);

        if (param.rawValue !== rawValue) {
          param.rawValue = rawValue;
          param.normalizedValue = normalizedValue;
          param.lastPriority = priority;

          // Notify subscribers
          param.subscribers.forEach(({ controller }) => {
            if (controller !== sourceController || param.isBidirectional) {
              controller.onParameterChanged(parameterName, rawValue);
            }
          });
        }
      }
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

      if (priority <= param.lastPriority) {
        const rawValue = this.denormalize(normalizedValue, param.min, param.max);

        if (param.normalizedValue !== normalizedValue) {
          param.normalizedValue = normalizedValue;
          param.rawValue = rawValue;
          param.lastPriority = priority;

          // Notify subscribers
          param.subscribers.forEach(({ controller }) => {
            if (controller !== sourceController || param.isBidirectional) {
              controller.onParameterChanged(parameterName, rawValue);
            }
          });
        }
      }
    }
  }

  /**
   * Retrieves the current raw value of a parameter.
   * @param {string} parameterName - The parameter name.
   * @returns {number|null} - The raw value of the parameter or null if it doesn't exist.
   */
  getRawValue(parameterName) {
    return this.parameters.get(parameterName)?.rawValue || null;
  }

  /**
   * Retrieves the current normalized value of a parameter.
   * @param {string} parameterName - The parameter name.
   * @returns {number|null} - The normalized value of the parameter or null if it doesn't exist.
   */
  getNormalizedValue(parameterName) {
    return this.parameters.get(parameterName)?.normalizedValue || null;
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
    }));
  }
}