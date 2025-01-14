// SensorController.js

import { MathUtils, Quaternion, Euler } from 'three';
import { 
    INTERNAL_SENSORS_USABLE, 
    EXTERNAL_SENSORS_USABLE 
} from './Constants.js';
import notifications from './AppNotifications.js';

/**
 * @class SensorController
 * @description Manages device orientation and motion sensor inputs and maps them to user parameters.
 * Handles toggle-based activation/deactivation of sensor axes (x, y, z, distance).
 * Integrates with a user-defined `User1Manager` for real-time updates.
 */
export class SensorController {
    // Private static instance variable
    static #instance = null;

    /**
     * Returns the singleton instance of SensorController.
     * @param {User1Manager} user1Manager - The user manager instance.
     * @returns {SensorController} The singleton instance.
     */
    static getInstance(user1Manager) {
        if (!SensorController.#instance) {
            SensorController.#instance = new SensorController(user1Manager);
        }
        return SensorController.#instance;
    }

    /**
     * Private constructor to prevent direct instantiation.
     * @param {User1Manager} user1Manager - The user manager instance.
     */
    constructor(user1Manager) {
        if (SensorController.#instance) {
            throw new Error('Use SensorController.getInstance() to get the singleton instance.');
        }

        // Initialize properties
        this.isSensorActive = false;
        this.user1Manager = user1Manager;
        this.activeAxes = { x: false, y: false, z: false, distance: false };
        this.throttleUpdate = this.throttle(this.updateParameters.bind(this), 33); // ~30 FPS

        // Rotation tracking
        this.currentYaw = 0.5;   // Normalized [0,1], 0.5 is center
        this.currentPitch = 0.5; // Normalized [0,1], 0.5 is center
        this.currentRoll = 0.5;  // Normalized [0,1], 0.5 is center

        this.lastAlpha = null; 
        this.accYaw = 0; // in degrees, can clamp to ±180

        this.lastBeta = null;
        this.accPitch = 0; // in degrees, can clamp to ±90

        this.lastGamma = null;
        this.accRoll = 0; // in degrees, can clamp to ±90

        // Motion tracking
        this.velocityY = 0;
        this.positionY = 0;
        this.initialAccelerationY = 0;
        this.lastTimestamp = null;
        this.calibrated = false;
        this.previousAccY = 0; // Initialize previous acceleration Y

        // Bind toggle handlers for event listeners.
        this.handleToggleChange = this.handleToggleChange.bind(this);

        // Bind handleDeviceOrientation and handleDeviceMotion once to maintain reference
        this.boundHandleDeviceOrientation = this.handleDeviceOrientation.bind(this);
        this.boundHandleDeviceMotion = this.handleDeviceMotion.bind(this);

        // Initialize toggles for controlling sensor axes.
        this.initializeToggles();
        this.initializeCalibrationButton();

        // Determine whether internal or external sensors are usable
        this.useInternalSensors = INTERNAL_SENSORS_USABLE;
        this.useExternalSensors = EXTERNAL_SENSORS_USABLE;

        // Initialize sensors based on availability
        if (this.useInternalSensors) {
            this.initializeInternalSensors();
        } else if (this.useExternalSensors) {
            this.initializeExternalSensors();
        } else {
            console.warn('SensorController: No usable sensors detected.');
        }

        // Initiate calibration
        this.calibrateDevice();
    }

    /**
     * Initializes the toggles for sensor axes (x, y, z, distance) and binds their change events.
     * Assumes toggles are custom web components with a 'state' attribute.
     * Logs the initial state of each toggle for debugging purposes.
     */
    initializeToggles() {
        ['toggleSensorX', 'toggleSensorY', 'toggleSensorZ', 'toggleSensorDistance'].forEach((id) => {
            const toggle = document.getElementById(id);
            const axis = id.replace('toggleSensor', '').toLowerCase();

            if (toggle) {
                console.debug(`[Init Debug] Toggle ID: ${id}, Axis: ${axis}, Initial state: ${toggle.state}`);

                // Bind change event to the toggle.
                toggle.addEventListener('change', () => this.handleToggleChange(toggle, axis));
            } else {
                console.warn(`SensorController: Toggle element '${id}' not found.`);
            }
        });
    }

    /**
     * Checks if the device supports orientation sensors.
     * @static
     * @returns {boolean} True if `DeviceOrientationEvent` is supported, false otherwise.
     */
    static isSupported() {
        return typeof DeviceOrientationEvent !== 'undefined';
    }

    /**
     * Initializes internal sensors.
     * Placeholder for any internal sensor initialization logic.
     */
    initializeInternalSensors() {
        console.log('SensorController: Initializing internal sensors.');
        // Add internal sensor initialization logic here if needed.
    }

    /**
     * Initializes external sensors.
     * Placeholder for any external sensor initialization logic.
     */
    initializeExternalSensors() {
        console.log('SensorController: Initializing external sensors.');
        // Add external sensor initialization logic here if needed.
    }

    /**
     * Requests user permission to access orientation sensors (iOS 13+ only).
     * @async
     * @returns {Promise<boolean>} Resolves to `true` if permission is granted, `false` otherwise.
     */
    async requestPermission() {
        if (
            typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function'
        ) {
            try {
                const response = await DeviceOrientationEvent.requestPermission();
                return response === 'granted';
            } catch (error) {
                console.error('SensorController: Error requesting permission:', error);
                return false;
            }
        }
        return true; // Assume permission is granted on non-iOS devices.
    }

    /**
     * Activates the device orientation and motion sensors if supported and permission is granted.
     * Binds the `deviceorientation` and `devicemotion` events to listen for changes.
     * @async
     */
    async activateSensors() {
        if (!SensorController.isSupported()) {
            console.warn('SensorController: Device orientation not supported by this browser/device.');
            return;
        }

        const permissionGranted = await this.requestPermission();
        if (!permissionGranted) {
            console.warn('SensorController: Permission to access sensors denied.');
            return;
        }

        this.startListening();
        this.isSensorActive = true;
        console.log('SensorController: Sensors activated.');
    }

    /**
     * Starts listening for `deviceorientation` and `devicemotion` events to capture orientation and motion changes.
     * Ensures that only one listener is active at a time.
     * @private
     */
    startListening() {
        if (!this.isSensorActive) {
            window.addEventListener('deviceorientation', this.boundHandleDeviceOrientation, true);
            window.addEventListener('devicemotion', this.boundHandleDeviceMotion, true);
            console.log('SensorController: Started listening to deviceorientation and devicemotion events.');
        }
    }

    /**
     * Stops listening for `deviceorientation` and `devicemotion` events.
     * Resets the `isSensorActive` flag.
     * @public
     */
    stopListening() {
        if (this.isSensorActive) {
            window.removeEventListener('deviceorientation', this.boundHandleDeviceOrientation, true);
            window.removeEventListener('devicemotion', this.boundHandleDeviceMotion, true);
            this.isSensorActive = false;
            console.log('SensorController: Stopped listening to deviceorientation and devicemotion events.');
        }
    }

    /**
     * Calibrates the device by setting initial reference points for orientation and acceleration.
     * Prompts the user to hold the device steady near their body.
     * @private
     */
    calibrateDevice() {
        console.log('Starting simplified calibration.');
      
        // We reset to 0.5
        this.currentYaw = 0.5;
        this.currentPitch = 0.5;
        this.currentRoll = 0.5;
      
        // Then read one orientation event
        const onCalibrate = (event) => {
          this.initialAlpha = event.alpha || 0;
          this.initialBeta  = event.beta || 0;
          this.initialGamma = event.gamma || 0;
      
          this.calibrated = true;
          console.log('Calibration done. initialAlpha:', this.initialAlpha, 
                      'initialBeta:', this.initialBeta, 'initialGamma:', this.initialGamma);
      
          window.removeEventListener('deviceorientation', onCalibrate);
        };
        window.addEventListener('deviceorientation', onCalibrate, { once: true });
      }
    /**
     * Handles `deviceorientation` events, maps yaw, pitch, and roll directly to normalized X, Y, Z.
     * Prevents overshooting and sticks to limits until direction changes.
     * Skips processing for inactive axes for efficiency.
     * @param {DeviceOrientationEvent} event - Orientation event containing `alpha`, `beta`, and `gamma`.
     */
/**
 * Handles `deviceorientation` events from internal sensors.
 * @param {DeviceOrientationEvent} event - Orientation event containing `alpha`, `beta`, and `gamma`.
 */
handleDeviceOrientation(event) {
    this.processSensorData(event, false);
}

/**
 * Processes sensor data and maps it to normalized x, y, z values using quaternions.
 * Ensures smooth, continuous mapping without gimbal lock or jumps.
 * @param {Object} event - Sensor data (alpha, beta, gamma).
 * @param {boolean} isExternal - Whether the data is from an external source.
 */
processSensorData(event, isExternal = false) {
    if (!this.calibrated) return;

    const { alpha = 0, beta = 0, gamma = 0 } = event;

    // Convert Euler angles to a Quaternion
    const quaternion = this.eulerToQuaternion(alpha, beta, gamma);

    // Normalize quaternion components to the [0, 1] range
    const normalizedX = this.mapRange(quaternion.x, -1, 1, 0, 1);
    const normalizedY = this.mapRange(quaternion.y, -1, 1, 0, 1);
    const normalizedZ = this.mapRange(quaternion.z, -1, 1, 0, 1);

    // Apply continuity and update user manager
    if (this.activeAxes.x) {
        this.currentYaw = this.smoothValue(this.currentYaw, normalizedX, 0.8);
        this.user1Manager.setNormalizedValue('x', this.currentYaw);
    }

    if (this.activeAxes.y) {
        this.currentPitch = this.smoothValue(this.currentPitch, normalizedY, 0.8);
        this.user1Manager.setNormalizedValue('y', this.currentPitch);
    }

    if (this.activeAxes.z) {
        this.currentRoll = this.smoothValue(this.currentRoll, normalizedZ, 0.8);
        this.user1Manager.setNormalizedValue('z', this.currentRoll);
    }

    console.log(
        `[SensorController] Processed Sensor Data -> ` +
        `X: ${this.currentYaw.toFixed(2)}, ` +
        `Y: ${this.currentPitch.toFixed(2)}, ` +
        `Z: ${this.currentRoll.toFixed(2)}`
    );
}


    /**
     * Converts Euler angles (Z -> X -> Y) in degrees to a Quaternion.
     * @param {number} alpha - Rotation around Z axis in degrees.
     * @param {number} beta - Rotation around X axis in degrees.
     * @param {number} gamma - Rotation around Y axis in degrees.
     * @returns {Quaternion} The resulting quaternion.
     */
    eulerToQuaternion(alpha, beta, gamma) {
        const _x = MathUtils.degToRad(beta || 0); // Convert beta (X-axis rotation) to radians
        const _y = MathUtils.degToRad(gamma || 0); // Convert gamma (Y-axis rotation) to radians
        const _z = MathUtils.degToRad(alpha || 0); // Convert alpha (Z-axis rotation) to radians
    
        const cX = Math.cos(_x / 2);
        const cY = Math.cos(_y / 2);
        const cZ = Math.cos(_z / 2);
        const sX = Math.sin(_x / 2);
        const sY = Math.sin(_y / 2);
        const sZ = Math.sin(_z / 2);
    
        return new Quaternion(
            cZ * sX * cY + sZ * cX * sY, // x
            cZ * cX * sY - sZ * sX * cY, // y
            sZ * cX * cY - cZ * sX * sY, // z
            cZ * cX * cY + sZ * sX * sY  // w
        );
    }
    /**
     * Clamps a value from one range to another.
     * @param {number} value - The value to clamp.
     * @param {number} min - The minimum value.
     * @param {number} max - The maximum value.
     * @returns {number} The clamped value.
     */
    clamp(value, min, max) {
        return MathUtils.clamp(value, min, max);
    }

/**
 * mapRange - maps 'val' in [inMin..inMax] to [outMin..outMax].
 */
mapRange(val, inMin, inMax, outMin, outMax) {
    return (
      ((val - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin
    );
  }
  
  /**
   * smoothValue - applies exponential smoothing factor 'alpha' in range (0..1).
   * Higher alpha => more weight on the old value => smoother, slower to update.
   */
  smoothValue(oldVal, newVal, alpha = 0.8) {
    return alpha * oldVal + (1 - alpha) * newVal;
  }
  
  /**
   * clampDelta - ensures we don't jump more than 'maxDelta' in one step.
   */
  clampDelta(oldVal, newVal, maxDelta = 0.1) {
    const delta = newVal - oldVal;
    if (Math.abs(delta) > maxDelta) {
      return oldVal + Math.sign(delta) * maxDelta;
    }
    return newVal;
  }

    /**
     * Applies a dead zone near 0 and 1 to prevent jitter.
     * @param {number} value - Normalized axis value.
     * @param {number} threshold - Dead zone threshold (default: 0.05).
     * @returns {number} Adjusted value after applying dead zone.
     */
    applyDeadZone(value, threshold = 0.05) {
        if (Math.abs(value - 1) < threshold) return 1; // Snap to 1
        if (Math.abs(value - 0) < threshold) return 0; // Snap to 0
        return value; // Otherwise, return the value unchanged
    }

    /**
     * Handles `devicemotion` events to calculate translation distance based on Y-axis acceleration.
     * @param {DeviceMotionEvent} event - The motion event containing acceleration data.
     */
    handleDeviceMotion(event) {
        if (!this.calibrated) {
            // Ignore motion events until calibration is complete
            return;
        }

        try {
            const currentTime = event.timeStamp;
            const deltaTime = this.lastTimestamp ? (currentTime - this.lastTimestamp) / 1000 : 0; // Convert ms to seconds
            this.lastTimestamp = currentTime;

            // Get Y-axis acceleration and remove the initial calibration offset
            const accY = event.accelerationIncludingGravity.y || 0;
            const deltaAccY = accY - this.initialAccelerationY;

            // Apply a simple low-pass filter to reduce noise
            const alpha = 0.8; // Smoothing factor
            const filteredAccY = alpha * deltaAccY + (1 - alpha) * (this.previousAccY || 0);
            this.previousAccY = filteredAccY;

            // Integrate acceleration to get velocity
            this.velocityY += filteredAccY * deltaTime;

            // Integrate velocity to get position
            this.positionY += this.velocityY * deltaTime;

            // Normalize distance (0 near, 1 at 0.8 meters)
            const normalizedDistance = Math.min(Math.abs(this.positionY) / 0.8, 1);

            // Update user manager if 'distance' axis is active
            if (this.activeAxes.distance) {
                // Assuming 0.5 is center for distance as well
                const distanceNorm = Math.min(Math.max(normalizedDistance, 0), 1);
                this.user1Manager.setNormalizedValue('distance', distanceNorm);
            }

            // Optionally, reset position and velocity if device is stationary (to prevent drift)
            if (Math.abs(filteredAccY) < 0.05) { // Threshold for considering the device as stationary
                this.velocityY *= 0.9; // Dampen velocity
                this.positionY *= 0.9; // Dampen position
            }

            // Optionally, expose the distance for debugging
            // console.log(`Estimated Distance: ${normalizedDistance} (0: near, 1: 80cm)`);
        } catch (error) {
            console.error('SensorController: Error in handleDeviceMotion:', error);
        }
    }

    /**
     * Maps normalized parameters and updates the `user1Manager`.
     * @private
     */
    updateParameters() {
        try {
            // Since we're directly mapping normalized values in handleDeviceOrientation,
            // this method can be simplified or removed if not needed.
            // If additional processing is required, implement here.
        } catch (error) {
            console.error('SensorController: Error in updateParameters:', error);
        }
    }

    /**
     * Handles changes to toggle states for sensor axes.
     * Updates the `activeAxes` state and manages sensor activation/deactivation.
     * @param {HTMLElement} toggle - The toggle element.
     * @param {string} axis - The axis ('x', 'y', 'z', or 'distance') corresponding to the toggle.
     */
    handleToggleChange(toggle, axis) {
        const isActive = toggle.state;

        console.debug(`[Toggle Debug] Toggle ID: ${toggle.id}, Axis: ${axis}, State: ${isActive}`);

        if (axis in this.activeAxes || axis === 'distance') {
            if (axis === 'distance') {
                this.activeAxes.distance = isActive;
            } else {
                this.activeAxes[axis] = isActive;
            }
            console.log(`SensorController: Axis '${axis.toUpperCase()}' is now ${isActive ? 'active' : 'inactive'}.`);

            if (isActive) {
                if (!this.isSensorActive) this.activateSensors();
            } else {
                const anyActive = Object.values(this.activeAxes).some(val => val);
                if (!anyActive && this.isSensorActive) this.stopListening();
            }
        }

        console.debug(`[Toggle Debug] ActiveAxes After:`, this.activeAxes);
    }

    /**
     * Throttles a function call to a specified limit.
     * Prevents excessive executions of expensive operations.
     * @param {Function} func - The function to throttle.
     * @param {number} limit - The time in milliseconds to throttle executions.
     * @returns {Function} The throttled function.
     */
    throttle(func, limit) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => (inThrottle = false), limit);
            }
        };
    }

    /**
     * Loads dynamic SVG icons for the calibration button.
     * Ensures the SVG is fetched and injected dynamically.
     * @public
     */
    loadCalibrationButtonSVG() {
        const calibrationButtonIcon = document.querySelector('#sensor-calibration .button-icon');
        if (!calibrationButtonIcon) {
            console.warn('SensorController: Calibration button icon element not found.');
            return;
        }
        console.log('SensorController: LOADING.');

        const src = calibrationButtonIcon.getAttribute('data-src');
        if (src) {
            this.fetchAndSetSVG(src, calibrationButtonIcon, true);
        }
    }

    /**
     * Fetches and sets SVG content into a specified element.
     * @param {string} src - URL of the SVG file to fetch.
     * @param {HTMLElement} element - DOM element to insert the fetched SVG into.
     * @param {boolean} [isInline=true] - Whether to insert the SVG inline.
     * @private
     */
    fetchAndSetSVG(src, element, isInline = true) {
        if (!isInline) return;
        console.log('SensorController: Calibration fetchAndSetSVG.');

        fetch(src)
            .then(response => {
                if (!response.ok) throw new Error(`Failed to load SVG: ${src}`);
                return response.text();
            })
            .then(svgContent => {
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
                const svgElement = svgDoc.documentElement;

                if (svgElement && svgElement.tagName.toLowerCase() === 'svg') {
                    svgElement.setAttribute('fill', 'currentColor');
                    svgElement.setAttribute('role', 'img');
                    svgElement.classList.add('icon-svg');
                    element.innerHTML = ''; // Clear existing content
                    element.appendChild(svgElement); // Insert the SVG
                } else {
                    console.error(`Invalid SVG content fetched from: ${src}`);
                }
            })
            .catch(error => console.error(`Error loading SVG from ${src}:`, error));
    }

    /**
     * Initializes the sensor calibration button and SVG loading.
     * Call this method after the DOM is fully loaded.
     * @public
     */
    initializeCalibrationButton() {
        const calibrationButton = document.getElementById('sensor-calibration');
        if (!calibrationButton) {
            console.warn('SensorController: Calibration button not found.');
            return;
        }

        // Attach an event listener for calibration
        calibrationButton.addEventListener('click', () => {
            console.log('SensorController: Calibration button clicked.');
            this.calibrateDevice();
        });

        // Load the SVG dynamically
        this.loadCalibrationButtonSVG();
    }

/**
 * Sets sensor values externally (e.g., via WebRTC).
 * @param {Object} data - Sensor data from external device.
 * @param {number} data.alpha - Rotation around Z axis (degrees).
 * @param {number} data.beta - Rotation around X axis (degrees).
 * @param {number} data.gamma - Rotation around Y axis (degrees).
 */
setExternalSensorData(data) {
    if (this.useExternalSensors) {
        this.processSensorData(data, true);
    } else {
        console.warn('[SensorController] External sensors are not enabled.');
    }
}
/**
 * Switch between internal and external sensor sources.
 * @param {boolean} useExternal - If true, use external sensors; otherwise, use internal.
 */
switchSensorSource(useExternal) {
    this.useExternalSensors = useExternal;
    this.useInternalSensors = !useExternal;

    if (useExternal) {
        console.log('[SensorController] Switched to external sensor input.');
        this.stopListening(); // Stop internal sensor listeners
    } else {
        console.log('[SensorController] Switched to internal sensor input.');
        this.startListening(); // Start internal sensor listeners
    }
}


}