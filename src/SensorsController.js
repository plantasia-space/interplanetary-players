// SensorController.js

import { Quaternion, Euler, Vector3, MathUtils } from 'three';
import notifications from './AppNotifications.js';

/**
 * @class SensorController
 * @description Manages device orientation and motion sensor inputs and maps them to user parameters.
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
        this.user1Manager = user1Manager;
        this.quaternion = new Quaternion();
        this.euler = new Euler('ZXY'); // Order matches sensor data
        this.referenceEuler = new Euler(); // To store calibrated reference
        this.activeAxes = { x: false, y: false, distance: false };
        this.friction = { x: 1.0, y: 1.0, distance: 1.0 };
        this.isCalibrated = false;

        // Bind event handlers
        this.handleDeviceOrientation = this.handleDeviceOrientation.bind(this);
        this.handleDeviceMotion = this.handleDeviceMotion.bind(this);

        // Initialize toggles and calibration UI
        this.initializeToggles();
        this.initializeCalibrationUI();

        // Start calibration
        this.calibrateDevice();
    }

    /**
     * Initializes the toggles for sensor axes (x, y, distance) and binds their change events.
     */
    initializeToggles() {
        ['toggleSensorX', 'toggleSensorY', 'toggleSensorDistance'].forEach(id => {
            const toggle = document.getElementById(id);
            const axis = id.replace('toggleSensor', '').toLowerCase();

            if (toggle) {
                toggle.addEventListener('change', () => this.handleToggleChange(toggle, axis));
            } else {
                console.warn(`SensorController: Toggle element '${id}' not found.`);
            }
        });
    }

    /**
     * Initializes the calibration UI elements and binds event listeners.
     */
    initializeCalibrationUI() {
        // Example: Friction sliders
        const frictionSliders = [
            { id: 'frictionX', axis: 'x' },
            { id: 'frictionY', axis: 'y' },
            { id: 'frictionDistance', axis: 'distance' }
        ];

        frictionSliders.forEach(sliderInfo => {
            const slider = document.getElementById(sliderInfo.id);
            const valueDisplay = document.getElementById(`${sliderInfo.id}Value`);

            if (slider && valueDisplay) {
                slider.addEventListener('input', () => {
                    const value = parseFloat(slider.value);
                    valueDisplay.textContent = value.toFixed(1);
                    this.friction[sliderInfo.axis] = value;
                });
            } else {
                console.warn(`SensorController: Friction slider or display for '${sliderInfo.id}' not found.`);
            }
        });

        // Calibration button
        const calibrateButton = document.getElementById('sensor-calibration');
        if (calibrateButton) {
            calibrateButton.addEventListener('click', () => this.calibrateDevice());
        } else {
            console.warn('SensorController: Calibration button not found.');
        }
    }

    /**
     * Handles toggle changes to activate or deactivate axes.
     * @param {HTMLElement} toggle - The toggle element.
     * @param {string} axis - The axis ('x', 'y', or 'distance').
     */
    handleToggleChange(toggle, axis) {
        this.activeAxes[axis] = toggle.checked;
        console.log(`SensorController: Axis '${axis.toUpperCase()}' is now ${toggle.checked ? 'active' : 'inactive'}.`);

        // Start or stop sensors based on active axes
        if (Object.values(this.activeAxes).some(val => val)) {
            this.startSensors();
        } else {
            this.stopSensors();
        }
    }

    /**
     * Starts listening to device sensors.
     */
    startSensors() {
        window.addEventListener('deviceorientation', this.handleDeviceOrientation, true);
        window.addEventListener('devicemotion', this.handleDeviceMotion, true);
        console.log('SensorController: Started listening to device sensors.');
    }

    /**
     * Stops listening to device sensors.
     */
    stopSensors() {
        window.removeEventListener('deviceorientation', this.handleDeviceOrientation, true);
        window.removeEventListener('devicemotion', this.handleDeviceMotion, true);
        console.log('SensorController: Stopped listening to device sensors.');
    }

    /**
     * Calibrates the device by setting the current orientation as the reference.
     */
    calibrateDevice() {
        console.log('SensorController: Starting calibration. Please hold the device steady.');

        // Temporary handlers to capture calibration data
        const calibrationDuration = 2000; // 2 seconds
        let orientationSum = { alpha: 0, beta: 0, gamma: 0 };
        let count = 0;

        const captureOrientation = (event) => {
            orientationSum.alpha += event.alpha || 0;
            orientationSum.beta += event.beta || 0;
            orientationSum.gamma += event.gamma || 0;
            count++;
        };

        window.addEventListener('deviceorientation', captureOrientation, true);

        setTimeout(() => {
            window.removeEventListener('deviceorientation', captureOrientation, true);

            if (count === 0) {
                console.warn('SensorController: Calibration failed. No sensor data received.');
                notifications.showToast('Calibration failed. No sensor data received.', 'error');
                return;
            }

            // Calculate average orientation
            this.referenceEuler.set(
                MathUtils.degToRad((orientationSum.beta / count)),
                MathUtils.degToRad((orientationSum.alpha / count)),
                MathUtils.degToRad((orientationSum.gamma / count)),
                'ZXY'
            );

            this.quaternion.setFromEuler(this.referenceEuler);
            this.isCalibrated = true;

            console.log('SensorController: Calibration complete.');
            console.log(`Reference Yaw (alpha): ${(orientationSum.alpha / count).toFixed(2)}°`);
            console.log(`Reference Pitch (beta): ${(orientationSum.beta / count).toFixed(2)}°`);
            console.log(`Reference Roll (gamma): ${(orientationSum.gamma / count).toFixed(2)}°`);
        }, calibrationDuration);
    }

    /**
     * Handles device orientation events.
     * @param {DeviceOrientationEvent} event 
     */
    handleDeviceOrientation(event) {
        if (!this.isCalibrated || !this.activeAxes.x && !this.activeAxes.y) return;

        const { alpha, beta, gamma } = event;

        if (alpha === null || beta === null || gamma === null) {
            console.warn('SensorController: Incomplete orientation data received.');
            return;
        }

        // Calculate rotation relative to calibration
        const relativeAlpha = MathUtils.degToRad((alpha || 0) - MathUtils.radToDeg(this.referenceEuler.y));
        const relativeBeta = MathUtils.degToRad((beta || 0) - MathUtils.radToDeg(this.referenceEuler.x));
        const relativeGamma = MathUtils.degToRad((gamma || 0) - MathUtils.radToDeg(this.referenceEuler.z));

        // Create quaternion from relative rotation
        const relativeEuler = new Euler(relativeBeta, relativeAlpha, relativeGamma, 'ZXY');
        const relativeQuaternion = new Quaternion().setFromEuler(relativeEuler);

        // Apply friction (sensitivity)
        relativeQuaternion.multiply(new Quaternion().setFromEuler(
            new Euler(
                relativeBeta / this.friction.y,
                relativeAlpha / this.friction.x,
                relativeGamma / this.friction.y,
                'ZXY'
            )
        ));

        // Update the main quaternion
        this.quaternion.copy(relativeQuaternion);

        // Convert to Euler angles for easy interpretation
        this.quaternion.toEuler(this.euler, 'ZXY');

        // Clamp angles between -180° and +180°
        this.euler.x = MathUtils.clamp(this.euler.x, MathUtils.degToRad(-180), MathUtils.degToRad(180));
        this.euler.y = MathUtils.clamp(this.euler.y, MathUtils.degToRad(-180), MathUtils.degToRad(180));

        // Normalize angles to [0, 360)
        const yaw = (MathUtils.radToDeg(this.euler.y) + 360) % 360;
        const pitch = MathUtils.radToDeg(this.euler.x);
        const roll = MathUtils.radToDeg(this.euler.z);

        // Normalize to [0,1]
        const yawNorm = yaw / 360;
        const pitchNorm = (pitch + 180) / 360; // From [-180, 180] to [0,1]
        const rollNorm = (roll + 180) / 360;

        // Update User Manager
        if (this.activeAxes.x) {
            this.user1Manager.setNormalizedValue('x', yawNorm);
        }
        if (this.activeAxes.y) {
            this.user1Manager.setNormalizedValue('y', pitchNorm);
        }

        console.log(`SensorController: Yaw: ${yaw.toFixed(2)}°, Pitch: ${pitch.toFixed(2)}°, Roll: ${roll.toFixed(2)}°`);
    }

    /**
     * Handles device motion events to calculate distance based on Y-axis acceleration.
     * @param {DeviceMotionEvent} event 
     */
    handleDeviceMotion(event) {
        if (!this.isCalibrated || !this.activeAxes.distance) return;

        const { accelerationIncludingGravity } = event;
        if (!accelerationIncludingGravity) {
            console.warn('SensorController: Incomplete motion data received.');
            return;
        }

        const accY = accelerationIncludingGravity.y || 0;

        // Simple filtering: Moving average or low-pass filter
        const alphaFilter = 0.8;
        const filteredAccY = alphaFilter * accY + (1 - alphaFilter) * (this.previousAccY || 0);
        this.previousAccY = filteredAccY;

        // Integrate acceleration to get velocity
        this.velocityY += filteredAccY * 0.033; // Assuming ~30Hz (33ms) updates

        // Integrate velocity to get position
        this.positionY += this.velocityY * 0.033;

        // Apply friction (sensitivity)
        const adjustedPositionY = this.positionY / this.friction.distance;

        // Clamp distance between 0 (near) and 1 (max)
        const distanceNorm = MathUtils.clamp(Math.abs(adjustedPositionY) / 0.8, 0, 1);

        // Update User Manager
        this.user1Manager.setNormalizedValue('distance', distanceNorm);

        // Reset if stationary to prevent drift
        if (Math.abs(filteredAccY) < 0.05 && Math.abs(this.velocityY) < 0.05) {
            this.velocityY = 0;
            this.positionY = 0;
            console.log('SensorController: Device is stationary. Resetting distance to prevent drift.');
        }

        console.log(`SensorController: Distance: ${distanceNorm.toFixed(3)}`);
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