/**
 * @file ParameterManager.js
 * @description Manages application parameters, including adding, updating, subscribing, and emitting parameter changes.
 * @version 2.0.0
 * @autor 𝐵𝓇𝓊𝓃𝒶 𝒢𝓊𝒶𝓇𝓃𝒾𝑒𝓇𝒾
 * @license MIT
 * @date 2024-12-08
 */

import { linear, logarithmic } from './Transformations';

/**
 * @class ParameterManager
 * @memberof CoreModule 
 * @description Singleton class responsible for managing application parameters, including their values, ranges, transformations, and subscriber notifications.
 */
export class ParameterManager {
  constructor() {
    if (ParameterManager.instance) {
      return ParameterManager.instance;
    }

    /**
     * @type {Map<string, Parameter>}
     * @description Stores parameters mapped by their names.
     */
    this.parameters = new Map(); // Map of parameterName -> parameter object

    ParameterManager.instance = this;
  }

  /**
   * Provides access to the Singleton instance of ParameterManager.
   * @static
   * @returns {ParameterManager} - The Singleton instance.
   *
   * @example
   * const paramManager = ParameterManager.getInstance();
   */
  static getInstance() {
    if (!ParameterManager.instance) {
      ParameterManager.instance = new ParameterManager();
    }
    return ParameterManager.instance;
  }

  /**
   * Adds or updates a parameter with the given configuration.
   * If the parameter already exists, it updates its properties; otherwise, it creates a new parameter.
   * @public
   * @param {string} name - The unique name of the parameter.
   * @param {number} [normalizedValue=0] - The normalized value [0,1].
   * @param {number} [min=0] - The minimum raw value of the parameter.
   * @param {number} [max=1] - The maximum raw value of the parameter.
   * @param {boolean} [isBidirectional=false] - If true, allows two-way updates between controllers and parameters.
   * @param {string} [scale="linear"] - The scaling type of the parameter ("linear" or "logarithmic").
   * @param {function} [inputTransform=(x) => x] - Function to transform input values before setting rawValue.
   * @param {function} [outputTransform=(x) => x] - Function to transform raw values before notifying subscribers.
   *
   * @returns {void}
   *
   * @example
   * const paramManager = ParameterManager.getInstance();
   * paramManager.addParameter('volume', 0.5, 0, 100, true, 'linear');
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
   * Notifies all subscribed controllers about the new range.
   * @private
   * @param {string} name - The name of the parameter.
   * @param {number} min - The new minimum value.
   * @param {number} max - The new maximum value.
   *
   * @returns {void}
   *
   * @example
   * this.emitRangeUpdate('volume', 0, 100);
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
   * Notifies all subscribed controllers about the new value.
   * @private
   * @param {string} name - The name of the parameter.
   * @param {number} value - The new transformed value.
   *
   * @returns {void}
   *
   * @example
   * this.emitValueUpdate('volume', 50);
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
   * Notifies all subscribed controllers about the new scale type.
   * @private
   * @param {string} name - The name of the parameter.
   * @param {string} scale - The new scale type (e.g., "linear" or "logarithmic").
   *
   * @returns {void}
   *
   * @example
   * this.emitScaleUpdate('frequency', 'logarithmic');
   */
  emitScaleUpdate(name, scale) {
    const param = this.parameters.get(name);
    param.subscribers.forEach(({ controller }) => {
      if (typeof controller.onScaleChanged === 'function') {
        controller.onScaleChanged(name, scale);
      }
    });
    //console.debug(`[ParameterManager] Emitted scale update for '${name}' with scale=${scale}`);
  }

  /**
   * Subscribes a controller to a parameter with a specified priority.
   * Controllers with higher priority (lower number) receive updates first.
   * @public
   * @param {Controller} controller - The controller subscribing to the parameter. Must implement callback methods.
   * @param {string} parameterName - The name of the parameter to subscribe to.
   * @param {number} [priority=Infinity] - The priority of the controller (1 is highest).
   *
   * @returns {void}
   *
   * @throws Will log an error if the controller does not implement 'onParameterChanged'.
   *
   * @example
   * const controller = {
   *   onParameterChanged: (name, value) => { console.log(`${name} changed to ${value}`); },
   *   onRangeChanged: (name, min, max) => {  },
   *   onScaleChanged: (name, scale) => {  },
   * };
   * const paramManager = ParameterManager.getInstance();
   * paramManager.subscribe(controller, 'volume', 1);
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
   * Removes the controller from the parameter's subscriber list.
   * @public
   * @param {object} controller - The controller to unsubscribe.
   * @param {string} parameterName - The name of the parameter to unsubscribe from.
   *
   * @returns {void}
   *
   * @example
   * paramManager.unsubscribe(controller, 'volume');
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
   * @public
   * @param {string} parameterName - The name of the parameter to update.
   * @param {number} rawValue - The new raw value to set.
   * @param {object|null} [sourceController=null] - The controller making the change (optional).
   * @param {number} [priority=Infinity] - The priority of the update (1 is highest).
   *
   * @returns {void}
   *
   * @example
   * paramManager.setRawValue('volume', 75, controller, 1);
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
   * Facilitates controller-driven updates with priority handling.
   * @public
   * @param {string} parameterName - The name of the parameter to update.
   * @param {number} controllerValue - The normalized value from the controller [0, 1].
   * @param {object|null} [sourceController=null] - The controller making the change (optional).
   * @param {number} [priority=Infinity] - The priority of the update (1 is highest).
   *
   * @returns {void}
   *
   * @example
   * paramManager.setControllerValue('balance', 0.8, controller, 2);
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
   * Handles priority and simultaneous updates.
   * @public
   * @param {string} parameterName - The name of the parameter to update.
   * @param {number} normalizedValue - The new normalized value to set [0, 1].
   * @param {object|null} [sourceController=null] - The controller making the change (optional).
   * @param {number} [priority=Infinity] - The priority of the update (1 is highest).
   *
   * @returns {void}
   *
   * @example
   * paramManager.setNormalizedValue('frequency', 0.75, controller, 1);
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
            //console.debug(`[Notification Check] Controller: ${controller.constructor.name}, Source: ${sourceController?.constructor.name}`);
            if (controller !== sourceController || param.isBidirectional) {
                //console.debug(`[Notify Subscriber] Notifying '${controller.constructor.name}' for '${parameterName}' with value=${param.rawValue}`);
                if (typeof controller.onParameterChanged === 'function') {
                    const transformedValue = param.outputTransform(param.rawValue);
                    controller.onParameterChanged(parameterName, transformedValue);
                } else {
                    console.warn(`[Notification Warning] Controller does not implement 'onParameterChanged':`, controller);
                }
            } else {
                //console.debug(`[Notification Skipped] SourceController matches and parameter is not bidirectional.`);
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

  /**
   * Sets the parameter to the middle (normalized value of 0.5) directly,
   * without any priority or simultaneous logic.
   * @public
   * @param {string} parameterName - The name of the parameter to set to middle.
   *
   * @returns {void}
   *
   * @example
   * paramManager.setToMiddle('balance');
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
   * @public
   * @param {string} parameterName - The name of the parameter.
   *
   * @returns {number|null} - The raw value of the parameter or null if it doesn't exist.
   *
   * @example
   * const rawVolume = paramManager.getRawValue('volume');
   */
  getRawValue(parameterName) {
    return this.parameters.get(parameterName)?.rawValue ?? null;
  }

  /**
   * Retrieves the current normalized value of a parameter.
   * @public
   * @param {string} parameterName - The name of the parameter.
   *
   * @returns {number|null} - The normalized value of the parameter or null if it doesn't exist.
   *
   * @example
   * const normalizedVolume = paramManager.getNormalizedValue('volume');
   */
  getNormalizedValue(parameterName) {
    return this.parameters.get(parameterName)?.normalizedValue ?? null;
  }

  /**
   * Normalizes a raw value to a [0, 1] range based on min and max.
   * @private
   * @param {number} rawValue - The raw value to normalize.
   * @param {number} min - The minimum range.
   * @param {number} max - The maximum range.
   *
   * @returns {number} - The normalized value.
   *
   * @example
   * const normalized = paramManager.normalize(50, 0, 100); // returns 0.5
   */
  normalize(rawValue, min, max) {
    return (rawValue - min) / (max - min);
  }

  /**
   * Denormalizes a normalized value [0, 1] to the raw range.
   * @private
   * @param {number} normalizedValue - The normalized value to denormalize.
   * @param {number} min - The minimum range.
   * @param {number} max - The maximum range.
   *
   * @returns {number} - The denormalized raw value.
   *
   * @example
   * const raw = paramManager.denormalize(0.75, 0, 100); // returns 75
   */
  denormalize(normalizedValue, min, max) {
    return normalizedValue * (max - min) + min;
  }

  /**
   * Lists all registered parameters with their current values and settings.
   * Useful for debugging and inspecting parameter states.
   * @public
   *
   * @returns {Array<Object>} - An array of parameter details.
   *
   * @example
   * const allParams = paramManager.listParameters();
   * console.log(allParams);
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
   * @public
   * @param {string} paramName - The name of the parameter to retrieve.
   *
   * @returns {Object|null} - The parameter details or null if not found.
   *
   * @example
   * const volumeParam = paramManager.getParameter('volume');
   * console.log(volumeParam);
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
}

/**
 * @typedef {Object} Parameter
 * @property {string} name - The name of the parameter.
 * @property {number} rawValue - The current raw value of the parameter.
 * @property {number} normalizedValue - The current normalized value [0,1].
 * @property {number} min - The minimum raw value.
 * @property {number} max - The maximum raw value.
 * @property {Set<Subscriber>} subscribers - Set of subscribers with their controllers and priorities.
 * @property {boolean} isBidirectional - Indicates if two-way updates are allowed.
 * @property {number} lastPriority - The priority of the last update.
 * @property {number} lastUpdateTimestamp - Timestamp of the last update.
 * @property {object|null} lastController - The controller that made the last update.
 * @property {string} scale - The scale type ("linear" or "logarithmic").
 * @property {function} inputTransform - Function to transform input values.
 * @property {function} outputTransform - Function to transform output values.
 */

/**
 * @typedef {Object} Subscriber
 * @property {Controller} controller - The controller subscribing to the parameter.
 * @property {number} priority - The priority level of the subscriber.
 */

/**
 * @typedef {Object} Controller
 * @property {function(string, number): void} onParameterChanged - Callback invoked when a parameter's value changes.
 * @property {function(string, number, number): void} onRangeChanged - Callback invoked when a parameter's range changes.
 * @property {function(string, string): void} onScaleChanged - Callback invoked when a parameter's scale changes.
 */

/**
 * @example
 * // Example of subscribing a controller to a parameter
 * const controller = {
 *   onParameterChanged: (name, value) => {
 *     console.log(`Parameter ${name} changed to ${value}`);
 *   },
 *   onRangeChanged: (name, min, max) => {
 *     console.log(`Parameter ${name} range updated to min: ${min}, max: ${max}`);
 *   },
 *   onScaleChanged: (name, scale) => {
 *     console.log(`Parameter ${name} scale changed to ${scale}`);
 *   }
 * };
 * const paramManager = ParameterManager.getInstance();
 * paramManager.subscribe(controller, 'volume', 1);
 */

