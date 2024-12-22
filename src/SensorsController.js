// SensorController.js

import { MathUtils } from 'three';
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
        console.log('SensorController: Starting calibration. Please hold the device steady near your body.');

        // Set normalized values to 0.5
        this.currentYaw = 0.5;
        this.currentPitch = 0.5;
        this.currentRoll = 0.5;

        this.initialAccelerationY = 0; // Reset acceleration

        this.calibrated = true;

        console.log('SensorController: Calibration complete. All normalized values set to 0.5.');
    }

/**
 * Handles `deviceorientation` events, maps yaw, pitch, and roll directly to normalized X, Y, Z.
 * Prevents overshooting and sticks to limits until direction changes.
 * Skips processing for inactive axes for efficiency.
 * @param {DeviceOrientationEvent} event - Orientation event containing `alpha`, `beta`, and `gamma`.
 */
handleDeviceOrientation(event) {
    if (!this.calibrated) return; // Ignore until calibration is complete

    try {
        // Early return if no axes are active
        if (!this.activeAxes.x && !this.activeAxes.y && !this.activeAxes.z) {
            return;
        }

        const { alpha = 0, beta = 0, gamma = 0 } = event; // Default to 0 if undefined

        // Pre-calculate only active axes to avoid unnecessary math
        let relativeYaw, relativePitch, relativeRoll;

        if (this.activeAxes.x) {
            relativeYaw = alpha - (this.initialAlpha || 0);
            relativeYaw = (relativeYaw + 360) % 360; // Normalize between 0 and 360
            if (relativeYaw > 180) relativeYaw -= 360; // Normalize to [-180, 180]
            this.currentYaw = this.applyAxisLimit(
                this.currentYaw,
                this.normalizeAxis(relativeYaw, -180, 180),
                'yaw'
            );
            this.currentYaw = this.applyDeadZone(this.currentYaw);
            this.user1Manager.setNormalizedValue('x', this.currentYaw);
        }

        if (this.activeAxes.y) {
            relativePitch = beta - (this.initialBeta || 0);
            this.currentPitch = this.applyAxisLimit(
                this.currentPitch,
                this.normalizeAxis(relativePitch, -90, 90),
                'pitch'
            );
            this.currentPitch = this.applyDeadZone(this.currentPitch);
            this.user1Manager.setNormalizedValue('y', this.currentPitch);
        }

        if (this.activeAxes.z) {
            relativeRoll = gamma - (this.initialRoll || 0);
            this.currentRoll = this.applyAxisLimit(
                this.currentRoll,
                this.normalizeAxis(relativeRoll, -90, 90),
                'roll'
            );
            this.currentRoll = this.applyDeadZone(this.currentRoll);
            this.user1Manager.setNormalizedValue('z', this.currentRoll);
        }

        // Debug log only when an axis is active
        console.log(
            `Yaw: ${this.currentYaw?.toFixed(2) || '-'}, Pitch: ${this.currentPitch?.toFixed(2) || '-'}, Roll: ${this.currentRoll?.toFixed(2) || '-'}`
        );
    } catch (error) {
        console.error('SensorController: Error in handleDeviceOrientation:', error);
    }
}

/**
 * Applies a dead zone near 0 and 1 to prevent jitter.
 * @param {number} value - Normalized axis value.
 * @param {number} threshold - Dead zone threshold (default: 0.05).
 * @returns {number} Adjusted value after applying dead zone.
 */
applyDeadZone(value, threshold = 0.05) {
    if (Math.abs(value - 1) < threshold) return 1; // Stick to upper limit
    if (Math.abs(value - 0) < threshold) return 0; // Stick to lower limit
    return value; // Otherwise, return the value unchanged
}

    /**
     * Normalize an axis value to a range between 0 and 1.
     * Calibration centers the value at 0.5.
     * @param {number} value - Current axis value.
     * @param {number} min - Minimum range of the axis.
     * @param {number} max - Maximum range of the axis.
     * @returns {number} Normalized value between 0 and 1.
     */
    normalizeAxis(value, min, max) {
        // Map value from [min, max] to [0,1]
        return MathUtils.clamp(((value - min) / (max - min)), 0, 1);
    }

    /**
     * Stick to limits until direction reverses.
     * @param {number} current - Current normalized axis value.
     * @param {number} newValue - New normalized axis value.
     * @param {string} axis - Axis name (yaw, pitch, roll) for debugging.
     * @returns {number} Updated axis value after applying stick limits.
     */
    applyAxisLimit(current, newValue, axis) {
        if (!this.direction) this.direction = { yaw: 0, pitch: 0, roll: 0 };

        const direction = newValue > current ? 1 : (newValue < current ? -1 : 0);

        // Track the direction for the specific axis
        if (axis in this.direction) {
            if (direction !== 0) {
                this.direction[axis] = direction;
            }
        }

        // Stick to the limit based on direction
        if (current === 1 && this.direction[axis] === 1) {
            return 1; // Stay at max limit if still moving in the same direction
        }

        if (current === 0 && this.direction[axis] === -1) {
            return 0; // Stay at min limit if still moving in the same direction
        }

        // Update normally if direction reverses or value is within range
        return MathUtils.clamp(newValue, 0, 1);
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
this.currentYaw
            // Integrate velocity to get position
            this.positionY += this.velocityY * deltaTime;

            // Normalize distance (0 near, 1 at 0.8 meters)
            const normalizedDistance = Math.min(Math.abs(this.positionY) / 0.8, 1);

            // Update user manager if 'distance' axis is active
            if (this.activeAxes.distance) {
                // Assuming 0.5 is center for distance as well
                this.user1Manager.setNormalizedValue('distance', Math.min(Math.max(normalizedDistance, 0), 1));
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
}