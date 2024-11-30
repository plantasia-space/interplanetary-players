export class ParameterManager {
    constructor() {
      this.parameters = new Map(); // Map of parameterName -> { value, subscribers, isBidirectional }
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
        });
      }
    }
  
    /**
     * Subscribes a controller to a parameter.
     * @param {object} controller - The controller subscribing to the parameter.
     * @param {string} parameterName - The name of the parameter.
     */
    subscribe(controller, parameterName) {
      if (this.parameters.has(parameterName)) {
        this.parameters.get(parameterName).subscribers.add(controller);
      } else {
        // Automatically create the parameter if it doesn't exist
        this.addParameter(parameterName);
        this.parameters.get(parameterName).subscribers.add(controller);
      }
    }
  
    /**
     * Unsubscribes a controller from a parameter.
     * @param {object} controller - The controller to remove.
     * @param {string} parameterName - The parameter to unsubscribe from.
     */
    unsubscribe(controller, parameterName) {
      if (this.parameters.has(parameterName)) {
        this.parameters.get(parameterName).subscribers.delete(controller);
      }
    }
  
    /**
     * Updates the value of a parameter and notifies subscribers.
     * Handles bidirectional updates if enabled.
     * @param {string} parameterName - The parameter name.
     * @param {number} value - The new value to set.
     * @param {object|null} sourceController - The controller making the change (optional).
     */
    setValue(parameterName, value, sourceController = null) {
      if (this.parameters.has(parameterName)) {
        const param = this.parameters.get(parameterName);
  
        if (param.value !== value) {
          param.value = value;
  
          // Notify subscribers of the change
          param.subscribers.forEach((controller) => {
            if (controller !== sourceController || param.isBidirectional) {
              controller.onParameterChanged(parameterName, value);
            }
          });
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
        subscribers: [...param.subscribers],
      }));
    }
  }