// SensorController.js

import { Quaternion, Euler, Vector3, MathUtils } from 'three';
import { 
    INTERNAL_SENSORS_USABLE, 
    EXTERNAL_SENSORS_USABLE, 
    setExternalSensorsUsable, 
    UNIQUE_ID 
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
        this.quaternion = new Quaternion();
        this.referenceVector = new Vector3(1, 0, 0); // Fixed reference axis for mapping.
        this.rotatedVector = new Vector3(); // Stores the rotated vector after quaternion transformation.
        this.activeAxes = { x: false, y: false, z: false, distance: false };
        this.throttleUpdate = this.throttle(this.updateParameters.bind(this), 33); // ~30 FPS

        // Translation properties
        this.velocityY = 0;
        this.positionY = 0;
        this.initialAccelerationY = 0;
        this.lastTimestamp = null;
        this.calibrated = false;
        this.previousAccY = 0; // Initialize previous acceleration Y

        // Friction (Sensitivity) parameters for each axis
        this.friction = {
            x: 1.0,       // Default friction for X-axis
            y: 1.0,       // Default friction for Y-axis
            distance: 1.0 // Default friction for Distance
        };

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

        // Listen for a short duration to capture initial orientation and acceleration
        const calibrationDuration = 2000; // 2 seconds
        let orientationSum = { alpha: 0, beta: 0, gamma: 0 };
        let accelerationSum = 0;
        let count = 0;

        const handleOrientation = (event) => {
            orientationSum.alpha += event.alpha || 0;
            orientationSum.beta += event.beta || 0;
            orientationSum.gamma += event.gamma || 0;
            count++;
        };

        const handleMotion = (event) => {
            accelerationSum += event.accelerationIncludingGravity.y || 0;
        };

        window.addEventListener('deviceorientation', handleOrientation);
        window.addEventListener('devicemotion', handleMotion);

        setTimeout(() => {
            window.removeEventListener('deviceorientation', handleOrientation);
            window.removeEventListener('devicemotion', handleMotion);

            if (count === 0) {
                console.warn('SensorController: Calibration failed. No sensor data received.');
                notifications.showToast('Calibration failed. No sensor data received.', 'error');
                return;
            }

            // Average the collected data
            this.initialAlpha = orientationSum.alpha / count;
            this.initialBeta = orientationSum.beta / count;
            this.initialGamma = orientationSum.gamma / count;
            this.initialAccelerationY = accelerationSum / count;
            this.calibrated = true;

            console.log('SensorController: Calibration complete.');
            console.log(`Initial Yaw (alpha): ${this.initialAlpha.toFixed(2)}°`);
            console.log(`Initial Pitch (beta): ${this.initialBeta.toFixed(2)}°`);
            console.log(`Initial Roll (gamma): ${this.initialGamma.toFixed(2)}°`);
            console.log(`Initial Acceleration Y: ${this.initialAccelerationY.toFixed(2)} m/s²`);

            // Reset translation parameters
            this.velocityY = 0;
            this.positionY = 0;
            this.lastTimestamp = null;
        }, calibrationDuration);
    }

    /**
     * Handles `deviceorientation` events, converts orientation data to a quaternion,
     * and maps the quaternion to normalized parameters for active axes.
     * @param {DeviceOrientationEvent} event - The orientation event containing `alpha`, `beta`, and `gamma` angles.
     */
    handleDeviceOrientation(event) {
        if (!this.calibrated) {
            // Ignore orientation events until calibration is complete
            return;
        }

        try {
            const { alpha, beta, gamma } = event;

            // Calculate relative angles based on calibration
            let relativeAlpha = (alpha || 0) - this.initialAlpha;
            let relativeBeta = (beta || 0) - this.initialBeta;
            let relativeGamma = (gamma || 0) - this.initialGamma;

            // Normalize angles to be within -180° to +180°
            relativeAlpha = MathUtils.clamp(relativeAlpha, -180, 180);
            relativeBeta = MathUtils.clamp(relativeBeta, -180, 180);
            relativeGamma = MathUtils.clamp(relativeGamma, -180, 180);

            // Apply friction (sensitivity) by scaling the relative angles
            const scaledAlpha = relativeAlpha / this.friction.x;
            const scaledBeta = relativeBeta / this.friction.y;
            const scaledGamma = relativeGamma / this.friction.y; // Assuming friction.y applies to pitch and roll

            // Convert degrees to radians
            const euler = new Euler(
                MathUtils.degToRad(scaledBeta),
                MathUtils.degToRad(scaledAlpha),
                MathUtils.degToRad(scaledGamma),
                'ZXY'
            );
            this.quaternion.setFromEuler(euler);

            this.throttleUpdate(this.quaternion);
        } catch (error) {
            console.error('SensorController: Error in handleDeviceOrientation:', error);
        }
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
            const alphaFilter = 0.8; // Smoothing factor
            const filteredAccY = alphaFilter * deltaAccY + (1 - alphaFilter) * (this.previousAccY || 0);
            this.previousAccY = filteredAccY;

            // Integrate acceleration to get velocity
            this.velocityY += filteredAccY * deltaTime;

            // Integrate velocity to get position
            this.positionY += this.velocityY * deltaTime;

            // Normalize distance (0 near, 1 at 0.8 meters), adjusted by friction
            const normalizedDistance = Math.min(Math.abs(this.positionY) / (0.8 * this.friction.distance), 1);

            // Update user manager if 'distance' axis is active
            if (this.activeAxes.distance) {
                this.user1Manager.setNormalizedValue('distance', normalizedDistance);
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
     * Maps a quaternion to normalized parameters and updates the `user1Manager`.
     * @param {THREE.Quaternion} q - The quaternion representing the current device orientation.
     * @private
     */
    updateParameters(q) {
        try {
            this.rotatedVector.copy(this.referenceVector).applyQuaternion(q);

            const mapTo01 = (v) => (v + 1) / 2;

            const xNorm = MathUtils.clamp(mapTo01(this.rotatedVector.x), 0, 1);
            const yNorm = MathUtils.clamp(mapTo01(this.rotatedVector.y), 0, 1);
            const zNorm = MathUtils.clamp(mapTo01(this.rotatedVector.z), 0, 1);

            // Update movementData object
            const euler = new Euler().setFromQuaternion(q, 'ZXY');
            this.movementData = {
                yaw: ((MathUtils.radToDeg(euler.y) + 360) % 360), // Normalize to [0, 360)
                pitch: MathUtils.clamp(MathUtils.radToDeg(euler.x), -90, 90),
                roll: MathUtils.radToDeg(euler.z),
                distance: this.activeAxes.distance ? Math.min(Math.abs(this.positionY) / 0.8, 1) : 0
            };

            console.log(`SensorController: Yaw: ${this.movementData.yaw.toFixed(2)}°, Pitch: ${this.movementData.pitch.toFixed(2)}°, Roll: ${this.movementData.roll.toFixed(2)}°, Distance: ${this.movementData.distance.toFixed(3)}`);

            // Update user manager based on active axes
            if (this.activeAxes.x) this.user1Manager.setNormalizedValue('x', xNorm);
            if (this.activeAxes.y) this.user1Manager.setNormalizedValue('y', yNorm);
            if (this.activeAxes.z) this.user1Manager.setNormalizedValue('z', zNorm);
            if (this.activeAxes.distance) this.user1Manager.setNormalizedValue('distance', this.movementData.distance);
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
     * Allows setting friction (sensitivity) for each axis.
     * Can be called during calibration or via UI controls.
     * @param {Object} frictionValues - Object containing friction values for each axis.
     */
    setFriction(frictionValues) {
        ['x', 'y', 'distance'].forEach(axis => {
            if (frictionValues[axis] !== undefined) {
                this.friction[axis] = frictionValues[axis];
                console.log(`SensorController: Friction for '${axis}' set to ${this.friction[axis]}`);
            }
        });
    }
}