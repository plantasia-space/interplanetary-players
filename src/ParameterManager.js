export class ParameterManager {
  constructor() {
    this.parameters = new Map(); // Map of parameterName -> { value, subscribers, isBidirectional, lastPriority }
  }

  /**
   * Adds a new parameter to the manager with optional bidirectional communication.
   * @param {string} name - The parameter name.
   * @param {number} initialValue - The initial value of the parameter.
   * @param {boolean} isBidirectional - Indicates if the parameter supports bidirectional updates.
   */
  addParameter(name, initialValue = 0, isBidirectional = false) {
    if (!this.parameters.has(name)) {
      this.parameters.set(name, {
        value: initialValue,
        subscribers: new Set(),
        isBidirectional: isBidirectional,
        lastPriority: Infinity, // Higher number means lower priority initially
      });
    }
  }

  /**
   * Subscribes a controller to a parameter with a specified priority.
   * Lower priority numbers take precedence over higher numbers.
   * @param {object} controller - The controller subscribing to the parameter.
   * @param {string} parameterName - The name of the parameter.
   * @param {number} priority - The priority of the controller (1 is highest).
   */
  subscribe(controller, parameterName, priority = Infinity) {
    if (this.parameters.has(parameterName)) {
      const param = this.parameters.get(parameterName);
      param.subscribers.add({ controller, priority });
    } else {
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
   * Updates the value of a parameter and notifies subscribers.
   * Handles bidirectional updates if enabled and ensures priority rules.
   * @param {string} parameterName - The parameter name.
   * @param {number} value - The new value to set.
   * @param {object|null} sourceController - The controller making the change (optional).
   * @param {number} priority - The priority of the update (1 is highest).
   */
  setValue(parameterName, value, sourceController = null, priority = Infinity) {
    if (this.parameters.has(parameterName)) {
      const param = this.parameters.get(parameterName);
      //console.log("subscriptor", parameterName, "value", value);

      // Update only if the new priority is higher (numerically lower)
      if (priority <= param.lastPriority) {
        if (param.value !== value) {
          param.value = value;
          param.lastPriority = priority;

          // Notify subscribers of the change
          param.subscribers.forEach(({ controller }) => {
            if (controller !== sourceController || param.isBidirectional) {
              controller.onParameterChanged(parameterName, value);
            }
          });
        }
      }
    }
  }

  /**
   * Retrieves the current value of a parameter.
   * @param {string} parameterName - The parameter name.
   * @returns {number|null} - The value of the parameter or null if it doesn't exist.
   */
  getValue(parameterName) {
    return this.parameters.get(parameterName)?.value || null;
  }

  /**
   * Lists all registered parameters with their current values and settings.
   * Useful for debugging.
   * @returns {Array} - An array of parameter details.
   */
  listParameters() {
    return Array.from(this.parameters.entries()).map(([name, param]) => ({
      name,
      value: param.value,
      isBidirectional: param.isBidirectional,
      lastPriority: param.lastPriority,
      subscribers: [...param.subscribers],
    }));
  }
}