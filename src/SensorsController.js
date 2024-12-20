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
 * @description Manages device orientation sensor inputs and maps them to user parameters.
 * Handles toggle-based activation/deactivation of sensor axes (x, y, z).
 * Integrates with a user-defined `User1Manager` for real-time updates.
 */
export class SensorController {
    // Private static instance variable
    static #instance = null;

    /**
     * Returns the singleton instance of SensorController.
     * @param {User1Manager} user1Manager - The user manager instance.
     * @param {Function} onDataUpdate - Callback function to handle sensor data updates.
     * @returns {SensorController} The singleton instance.
     */
    static getInstance(user1Manager, onDataUpdate) {
        if (!SensorController.#instance) {
            SensorController.#instance = new SensorController(user1Manager, onDataUpdate);
        }
        return SensorController.#instance;
    }

    /**
     * Private constructor to prevent direct instantiation.
     * @param {User1Manager} user1Manager - The user manager instance.
     * @param {Function} onDataUpdate - Callback function to handle sensor data updates.
     */
    constructor(user1Manager, onDataUpdate) {
        if (SensorController.#instance) {
            throw new Error('Use SensorController.getInstance() to get the singleton instance.');
        }

        // Initialize properties
        this.isSensorActive = false;
        this.user1Manager = user1Manager;
        this.quaternion = new Quaternion();
        this.referenceVector = new Vector3(1, 0, 0); // Fixed reference axis for mapping.
        this.rotatedVector = new Vector3(); // Stores the rotated vector after quaternion transformation.
        this.activeAxes = { x: false, y: false, z: false };
        this.throttleUpdate = this.throttle(this.updateParameters.bind(this), 100);

        // Callback for data updates (e.g., to send over communication channel)
        this.onDataUpdate = onDataUpdate;

        // Bind toggle handlers for event listeners.
        this.handleToggleChange = this.handleToggleChange.bind(this);

        // Bind handleDeviceOrientation once to maintain reference
        this.boundHandleDeviceOrientation = this.handleDeviceOrientation.bind(this);

        // Initialize toggles for controlling sensor axes.
        this.initializeToggles();

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
    }

    /**
     * Initializes the toggles for sensor axes (x, y, z) and binds their change events.
     * Assumes toggles are custom web components with a 'state' attribute.
     * Logs the initial state of each toggle for debugging purposes.
     */
    initializeToggles() {
        ['toggleSensorX', 'toggleSensorY', 'toggleSensorZ'].forEach((id) => {
            const toggle = document.getElementById(id);
            const axis = id.replace('toggleSensor', '').toLowerCase();

            if (toggle) {
                // Retrieve the initial state from the 'state' attribute
                const stateAttr = toggle.getAttribute('state');
                const stateValue = stateAttr !== null ? parseInt(stateAttr, 10) : 0;
                const initialState = stateValue === 1;
                this.activeAxes[axis] = initialState;

                console.debug(`[SensorController Init] Toggle ID: ${id}, Axis: ${axis}, State: ${stateValue}`);

                // Bind event listener for 'change' events
                toggle.addEventListener('change', () => this.handleToggleChange(toggle, axis));

                // If initially active, ensure sensors are activated
                if (initialState && !this.isSensorActive) {
                    console.log(`SensorController: Initial toggle for axis '${axis}' is active. Activating sensors.`);
                    this.activateSensors();
                }
            } else {
                console.warn(`SensorController: Toggle element '${id}' not found.`);
            }
        });

        console.log(`[SensorController] Initialized activeAxes:`, this.activeAxes);
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
     * Activates the device orientation sensor if supported and permission is granted.
     * Binds the `deviceorientation` event to listen for orientation changes.
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
     * Starts listening for `deviceorientation` events to capture orientation changes.
     * Ensures that only one listener is active at a time.
     * @private
     */
    startListening() {
        if (!this.isSensorActive && Object.values(this.activeAxes).some(val => val)) {
            window.addEventListener('deviceorientation', this.boundHandleDeviceOrientation, true);
            this.isSensorActive = true;
            console.log('SensorController: Started listening to deviceorientation events.');
        }
    }

    /**
     * Stops listening for `deviceorientation` events.
     * Resets the `isSensorActive` flag.
     * @public
     */
    stopListening() {
        if (this.isSensorActive) {
            window.removeEventListener('deviceorientation', this.boundHandleDeviceOrientation, true);
            this.isSensorActive = false;
            console.log('SensorController: Stopped listening to deviceorientation events.');
        }
    }

    /**
     * Handles `deviceorientation` events, converts orientation data to a quaternion,
     * and maps the quaternion to normalized parameters for active axes.
     * @param {DeviceOrientationEvent} event - The orientation event containing `alpha`, `beta`, and `gamma` angles.
     */
    handleDeviceOrientation(event) {
        try {
            const { alpha, beta, gamma } = event;

            const euler = new Euler(
                MathUtils.degToRad(beta || 0),
                MathUtils.degToRad(alpha || 0),
                MathUtils.degToRad(gamma || 0),
                'ZXY'
            );
            this.quaternion.setFromEuler(euler);

            this.throttleUpdate(this.quaternion);
        } catch (error) {
            console.error('SensorController: Error in handleDeviceOrientation:', error);
        }
    }

    /**
     * Maps a quaternion to normalized parameters and updates the `user1Manager`.
     * Also invokes the `onDataUpdate` callback with the normalized data.
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

            console.log(`SensorController: Normalized Parameters - x: ${xNorm.toFixed(3)}, y: ${yNorm.toFixed(3)}, z: ${zNorm.toFixed(3)}`);

            if (this.activeAxes.x) {
                this.user1Manager.setNormalizedValue('x', xNorm);
                console.log(`SensorController: Updated 'x' to ${xNorm}`);
            }
            if (this.activeAxes.y) {
                this.user1Manager.setNormalizedValue('y', yNorm);
                console.log(`SensorController: Updated 'y' to ${yNorm}`);
            }
            if (this.activeAxes.z) {
                this.user1Manager.setNormalizedValue('z', zNorm);
                console.log(`SensorController: Updated 'z' to ${zNorm}`);
            }

            console.log('[SensorController] BEFORE onDataUpdate callback.');

            // Invoke callback with normalized data
            if (this.onDataUpdate) {
                console.log('[SensorController] Invoking onDataUpdate callback with:', {
                    x: this.activeAxes.x ? xNorm : null,
                    y: this.activeAxes.y ? yNorm : null,
                    z: this.activeAxes.z ? zNorm : null
                });
                this.onDataUpdate({
                    x: this.activeAxes.x ? xNorm : null,
                    y: this.activeAxes.y ? yNorm : null,
                    z: this.activeAxes.z ? zNorm : null
                });
            }
        } catch (error) {
            console.error('SensorController: Error in updateParameters:', error);
        }
    }

    /**
     * Handles changes to toggle states for sensor axes.
     * Updates the `activeAxes` state and manages sensor activation/deactivation.
     * @param {HTMLElement} toggle - The toggle element.
     * @param {string} axis - The axis ('x', 'y', or 'z') corresponding to the toggle.
     */
    handleToggleChange(toggle, axis) {
        // Retrieve the updated state from the 'state' attribute
        const stateAttr = toggle.getAttribute('state');
        const stateValue = stateAttr !== null ? parseInt(stateAttr, 10) : 0;
        const isActive = stateValue === 1;

        console.debug(`[Toggle Debug] Toggle ID: ${toggle.id}, Axis: ${axis}, State: ${isActive}`);

        if (axis in this.activeAxes) {
            this.activeAxes[axis] = isActive;
            console.log(`SensorController: Axis '${axis.toUpperCase()}' is now ${isActive ? 'active' : 'inactive'}.`);

            if (isActive) {
                // Activate sensors if not already active
                if (!this.isSensorActive) {
                    console.log('SensorController: Activating sensors due to active axis.');
                    this.activateSensors();
                }
            } else {
                // Deactivate sensors only if no axes are active
                const anyActive = Object.values(this.activeAxes).some(val => val);
                if (!anyActive && this.isSensorActive) {
                    console.log('SensorController: Deactivating sensors as no axes are active.');
                    this.stopListening();
                }
            }

            console.debug(`[SensorController Debug] ActiveAxes After:`, this.activeAxes);
        } else {
            console.warn(`SensorController: Unknown axis '${axis}' for toggle.`);
        }
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
     * Test method to manually trigger onDataUpdate for debugging.
     */
    testDataUpdate() {
        const mockData = { x: 0.5, y: 0.5, z: 0.5 };
        console.log('[SensorController] Testing onDataUpdate with:', mockData);
        if (this.onDataUpdate) {
            this.onDataUpdate(mockData);
        }
    }
}