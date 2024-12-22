// SensorController.js

import { MathUtils } from 'three';
import { INTERNAL_SENSORS_USABLE, EXTERNAL_SENSORS_USABLE } from './Constants.js';
import notifications from './AppNotifications.js';

/**
 * @class SensorController
 * @description Manages device orientation (Yaw, Pitch, Roll) and motion sensor data.
 * Normalizes X, Y, Z axes to the range [0, 1] with axis-specific activation toggles and calibration.
 */
export class SensorController {
    static #instance = null;

    /**
     * Singleton instance of SensorController.
     * @param {User1Manager} user1Manager - User manager instance.
     * @returns {SensorController} Singleton instance.
     */
    static getInstance(user1Manager) {
        if (!SensorController.#instance) {
            SensorController.#instance = new SensorController(user1Manager);
        }
        return SensorController.#instance;
    }

    constructor(user1Manager) {
        if (SensorController.#instance) {
            throw new Error('Use SensorController.getInstance() to get the singleton instance.');
        }

        this.user1Manager = user1Manager;

        // Axis State
        this.isSensorActive = false;
        this.calibrated = false;
        this.axisValues = { x: 0.5, y: 0.5, z: 0.5, distance: 0.5 };
        this.initialAlpha = 0;
        this.initialBeta = 0;
        this.initialGamma = 0;

        // Filters and Movement
        this.filteredValues = { x: 0.5, y: 0.5, z: 0.5 };
        this.filterAlpha = 0.8; // Smoothing factor for low-pass filter

        // Active Axes
        this.activeAxes = { x: false, y: false, z: false, distance: false };

        // Motion
        this.velocityY = 0;
        this.positionY = 0;
        this.previousAccY = 0;

        // Event Bindings
        this.boundHandleDeviceOrientation = this.handleDeviceOrientation.bind(this);
        this.boundHandleDeviceMotion = this.handleDeviceMotion.bind(this);

        // Initialization
        this.initializeToggles();
        this.initializeCalibrationButton();
        this.calibrateDevice();
    }

    /**
     * Checks if orientation sensors are supported.
     * @returns {boolean}
     */
    static isSupported() {
        return typeof DeviceOrientationEvent !== 'undefined';
    }

    /**
     * Requests permission for device orientation sensors (for iOS).
     * @returns {Promise<boolean>}
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
                console.error('SensorController: Permission error:', error);
                return false;
            }
        }
        return true; // Assume granted for non-iOS devices
    }

    /**
     * Activates device orientation and motion sensors.
     */
    async activateSensors() {
        if (!SensorController.isSupported()) {
            console.warn('SensorController: Sensors not supported.');
            return;
        }

        const permissionGranted = await this.requestPermission();
        if (!permissionGranted) {
            console.warn('SensorController: Permission denied.');
            return;
        }

        window.addEventListener('deviceorientation', this.boundHandleDeviceOrientation, true);
        window.addEventListener('devicemotion', this.boundHandleDeviceMotion, true);
        this.isSensorActive = true;
        console.log('SensorController: Sensors activated.');
    }

    /**
     * Deactivates sensors.
     */
    stopListening() {
        if (this.isSensorActive) {
            window.removeEventListener('deviceorientation', this.boundHandleDeviceOrientation, true);
            window.removeEventListener('devicemotion', this.boundHandleDeviceMotion, true);
            this.isSensorActive = false;
            console.log('SensorController: Sensors deactivated.');
        }
    }

    /**
     * Calibrates sensors, resetting axes to `0.5`.
     */
    calibrateDevice() {
        console.log('SensorController: Calibration started.');

        this.axisValues = { x: 0.5, y: 0.5, z: 0.5, distance: 0.5 };
        this.calibrated = true;
        console.log('SensorController: Calibration complete.');
    }

    /**
     * Handles device orientation (`alpha`, `beta`, `gamma`) and normalizes axes.
     */
    handleDeviceOrientation(event) {
        if (!this.calibrated) return;

        try {
            const { alpha = 0, beta = 0, gamma = 0 } = event;

            // Normalize values
            const normalizedYaw = this.normalizeAxis(alpha, 0, 360); // Yaw → X-axis
            const normalizedPitch = this.normalizeAxis(beta, -90, 90); // Pitch → Y-axis
            const normalizedRoll = this.normalizeAxis(gamma, -90, 90); // Roll → Z-axis

            // Apply filters
            this.filteredValues.x = this.applyLowPassFilter(this.filteredValues.x, normalizedYaw);
            this.filteredValues.y = this.applyLowPassFilter(this.filteredValues.y, normalizedPitch);
            this.filteredValues.z = this.applyLowPassFilter(this.filteredValues.z, normalizedRoll);

            // Update active axes
            if (this.activeAxes.x) this.user1Manager.setNormalizedValue('x', this.filteredValues.x);
            if (this.activeAxes.y) this.user1Manager.setNormalizedValue('y', this.filteredValues.y);
            if (this.activeAxes.z) this.user1Manager.setNormalizedValue('z', this.filteredValues.z);

            console.log(
                `Yaw (X): ${this.filteredValues.x.toFixed(2)}, Pitch (Y): ${this.filteredValues.y.toFixed(2)}, Roll (Z): ${this.filteredValues.z.toFixed(2)}`
            );
        } catch (error) {
            console.error('SensorController: Orientation error:', error);
        }
    }

    /**
     * Apply low-pass filter to smooth sensor readings.
     */
    applyLowPassFilter(current, newValue) {
        return this.filterAlpha * newValue + (1 - this.filterAlpha) * current;
    }

    /**
     * Normalize a value to the range `[0, 1]`.
     */
    normalizeAxis(value, min, max) {
        return MathUtils.clamp((value - min) / (max - min), 0, 1);
    }

    /**
     * Initializes toggle buttons for axis activation.
     */
    initializeToggles() {
        ['toggleSensorX', 'toggleSensorY', 'toggleSensorZ'].forEach((id) => {
            const toggle = document.getElementById(id);
            const axis = id.replace('toggleSensor', '').toLowerCase();

            if (toggle) {
                toggle.addEventListener('change', () => {
                    this.activeAxes[axis] = toggle.state;
                    console.log(`Axis ${axis.toUpperCase()} is now ${toggle.state ? 'active' : 'inactive'}`);
                });
            }
        });
    }

    /**
     * Initializes calibration button.
     */
    initializeCalibrationButton() {
        const calibrationButton = document.getElementById('sensor-calibration');
        if (calibrationButton) {
            calibrationButton.addEventListener('click', () => this.calibrateDevice());
        }
    }
}