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
        this.throttleUpdate = this.throttle(this.updateParameters.bind(this), 66); // ~15 FPS

        // Current normalized values
        this.currentYaw = 0.5;   // Normalized [0,1], 0.5 is center
        this.currentPitch = 0.5; // Normalized [0,1], 0.5 is center
        this.currentRoll = 0.5;  // Normalized [0,1], 0.5 is center

        // Quaternion tracking
        this.currentQuaternion = new Quaternion(); // Represents the current orientation

        // Motion tracking
        this.velocityY = 0;
        this.positionY = 0;
        this.initialAccelerationY = 0;
        this.lastTimestamp = null;
        this.calibrated = false;

        // Bind toggle handlers for event listeners.
        this.handleToggleChange = this.handleToggleChange.bind(this);

        // Bind handleDeviceOrientation and handleDeviceMotion once to maintain reference
        this.boundHandleDeviceOrientation = this.handleDeviceOrientation.bind(this);
        this.boundHandleDeviceMotion = this.handleDeviceMotion.bind(this);

        // Initialize toggles and calibration button
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
     * Calibrates the device by setting initial reference points for orientation.
     * Prompts the user to hold the device steady near their body.
     * @private
     */
    calibrateDevice() {
        console.log('SensorController: Starting calibration.');
      
        // If we are using external sensors on a desktop, just grab the last known data
        // If we don't have it yet, we show a warning and exit.
        if (this.useExternalSensors) {
          this.calibrateFromExternal();
        } else {
          this.calibrateFromInternal();
        }
      }

      calibrateFromInternal() {
        const onCalibrate = (event) => {
          if (event.alpha != null && event.beta != null && event.gamma != null) {
            this.finishCalibration(event.alpha, event.beta, event.gamma);
            window.removeEventListener('deviceorientation', onCalibrate);
          }
        };
      
        // Listen for one valid reading
        window.addEventListener('deviceorientation', onCalibrate, { once: true });
      }
      
      calibrateFromExternal() {
        // Use the last external data your app received from the remote sensor
        if (!this.lastExternalSensorData) {
          console.warn('No external sensor data available yet. Cannot calibrate.');
          return;
        }
        const { alpha, beta, gamma } = this.lastExternalSensorData;
        if (alpha == null || beta == null || gamma == null) {
          console.warn('External sensor data is missing alpha/beta/gamma. Cannot calibrate.');
          return;
        }
        this.finishCalibration(alpha, beta, gamma);
      }
      
      // Central place to store calibration info
      finishCalibration(alpha, beta, gamma) {
        this.initialAlpha = alpha;
        this.initialBeta = beta;
        this.initialGamma = gamma;
        this.calibrated = true;
        console.log('SensorController: Calibration completed.', {
          alpha, beta, gamma
        });
      }


    /**
     * Handles `deviceorientation` events, maps yaw, pitch, and roll directly to normalized X, Y, Z.
     * Prevents overshooting and sticks to limits until direction changes.
     * Skips processing for inactive axes for efficiency.
     * @param {DeviceOrientationEvent} event - Orientation event containing `alpha`, `beta`, and `gamma`.
     */
    handleDeviceOrientation(event) {
       // console.log('[SensorController] Received deviceorientation event:', event);
        this.processSensorData(event, false);
    }

    /**
     * Processes sensor data and maps it to normalized x, y, z values using quaternions.
     * Ensures smooth, continuous mapping without gimbal lock or jumps.
     * @param {Object} event - Sensor data (alpha, beta, gamma).
     * @param {boolean} isExternal - Whether the data is from an external source.
     */
    processSensorData(event, isExternal = false) {
        // 1) Grab the raw angles
        let alpha = event.alpha ?? 0;
        let beta  = event.beta  ?? 0;
        let gamma = event.gamma ?? 0;
    
        // 2) If user has calibrated, subtract offsets—otherwise, leave them as-is
        if (this.calibrated) {
            alpha -= (this.initialAlpha || 0);
            beta  -= (this.initialBeta  || 0);
            gamma -= (this.initialGamma || 0);
        }
    
        // 3) Convert Euler angles to Quaternion
        const euler = new Euler(
            MathUtils.degToRad(beta),  // X-axis (Pitch)
            MathUtils.degToRad(gamma), // Y-axis (Roll)
            MathUtils.degToRad(alpha), // Z-axis (Yaw)
            'YXZ'
        );
        const newQuaternion = new Quaternion().setFromEuler(euler).normalize();
    
        // 4) Check continuity
        if (this.currentQuaternion.dot(newQuaternion) < 0) {
            newQuaternion.x *= -1;
            newQuaternion.y *= -1;
            newQuaternion.z *= -1;
            newQuaternion.w *= -1;
        }
    
        // 5) Smoothly interpolate (slerp factor is up to you, e.g. 0.9 = quite fast)
        this.currentQuaternion.slerp(newQuaternion, 0.9);
    
        // 6) Map quaternion components to [0..1]
        const normalizedX = this.mapRange(this.currentQuaternion.x, -1, 1, 0, 1);
        const normalizedY = this.mapRange(this.currentQuaternion.y, -1, 1, 0, 1);
        const normalizedZ = this.mapRange(this.currentQuaternion.z, -1, 1, 0, 1);
    
        // 7) Update axes if active
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
    
        debugLog({
            rawAlpha: event.alpha,
            rawBeta: event.beta,
            rawGamma: event.gamma,
            offsetAlpha: alpha,
            offsetBeta: beta,
            offsetGamma: gamma,
            quaternion: {
              x: this.currentQuaternion.x.toFixed(3),
              y: this.currentQuaternion.y.toFixed(3),
              z: this.currentQuaternion.z.toFixed(3),
              w: this.currentQuaternion.w.toFixed(3)
            },
            normalized: {
              x: this.currentYaw.toFixed(2),
              y: this.currentPitch.toFixed(2),
              z: this.currentRoll.toFixed(2)
            }
          });
        
    }
    


 debugLog(data) {
    let lastDebugTime = 0;

  const now = performance.now();
  // Only log every 500ms
  if (now - lastDebugTime > 500) {
    console.debug('[SensorController Debug]', data);
    lastDebugTime = now;
  }
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
         * Maps a value from one range to another.
         * @param {number} val - The value to map.
         * @param {number} inMin - Input range minimum.
         * @param {number} inMax - Input range maximum.
         * @param {number} outMin - Output range minimum.
         * @param {number} outMax - Output range maximum.
         * @returns {number} The mapped value.
         */
        mapRange(val, inMin, inMax, outMin, outMax) {
            return MathUtils.clamp(
                ((val - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin,
                outMin,
                outMax
            );
        }

    /**
     * smoothValue - applies exponential smoothing factor 'alpha' in range (0..1).
     * Higher alpha => more weight on the old value => smoother, slower to update.
     * @param {number} oldVal - The previous value.
     * @param {number} newVal - The new value to incorporate.
     * @param {number} alpha - The smoothing factor.
     * @returns {number} The smoothed value.
     */
    smoothValue(oldVal, newVal, alpha = 0.8) {
        return alpha * oldVal + (1 - alpha) * newVal;
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
                const distanceNorm = this.mapRange(normalizedDistance, 0, 1, 0, 1);
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
            // Since we're directly mapping normalized values in processSensorData,
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
        console.log('SensorController: LOADING SVG for calibration button.');

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
        console.log('SensorController: Fetching SVG for calibration button.');

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
                    console.log('SensorController: SVG loaded and injected.');
                } else {
                    console.error(`Invalid SVG content fetched from: ${src}`);
                }
            })
            .catch(error => console.error(`SensorController: Error loading SVG from ${src}:`, error));
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
            calibrationButton.disabled = true; // Disable button during calibration
            this.calibrateDevice();

            // Re-enable the button after a short delay to prevent multiple calibrations
            setTimeout(() => {
                calibrationButton.disabled = false;
            }, 6000); // 6 seconds (adjust based on calibration time)
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
        if (!this.useExternalSensors) {
          console.warn('[SensorController] External sensors not enabled.');
          return;
        }
      
        // e.g. data = { alpha: 123, beta: 45, gamma: -67 }
        this.lastExternalSensorData = data; 
      
        // Optionally process immediately 
        this.processSensorData(data, true);
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