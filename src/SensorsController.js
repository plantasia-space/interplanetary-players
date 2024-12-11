/**
 * @file SensorController.js
 * @description Handles access to device motion/orientation sensors, requesting permission if needed and providing data.
 * @version 1.0.0
 * @author 
 * @license MIT
 * @date 2024-12-07
 */

import { notifications } from './Main.js';

export class SensorController {
    constructor() {
        if (SensorController.instance) {
            return SensorController.instance;
        }

        /**
         * Indicates if sensor data access is enabled.
         * @type {boolean}
         */
        this.isSensorActive = false;

        /**
         * Last known sensor data, to be updated on each event.
         * For example, store quaternion, Euler angles, acceleration, etc.
         * @type {object}
         */
        this.sensorData = {
            alpha: null, // Rotation around Z axis
            beta: null,  // Rotation around X axis
            gamma: null, // Rotation around Y axis
            // If you want quaternions, you will need to convert from Euler angles
            // quaternion: [w, x, y, z]
        };

        SensorController.instance = this;
    }

    /**
     * Checks if Device Orientation is supported.
     * Some browsers need user interaction or permission request.
     * @returns {boolean}
     */
    static isSupported() {
        return (typeof DeviceMotionEvent !== 'undefined' || typeof DeviceOrientationEvent !== 'undefined');
    }

    /**
     * Requests permission to access device sensors if necessary (iOS 13+).
     * In other browsers, no permission prompt may be needed.
     * @async
     * @returns {Promise<boolean>} - True if permission granted, false otherwise.
     */
    async requestPermission() {
        // For iOS devices, need to request permission explicitly
        if (typeof DeviceMotionEvent !== 'undefined' 
            && typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                const response = await DeviceMotionEvent.requestPermission();
                return (response === 'granted');
            } catch (err) {
                console.error('SensorController: Permission request error', err);
                return false;
            }
        }

        // If not iOS or no requestPermission, assume allowed
        return true;
    }

    /**
     * Activates sensor data listening if supported and user grants permission.
     * @async
     * @public
     * @returns {Promise<void>}
     */
    async activateSensors() {
        if (!SensorController.isSupported()) {
            notifications.showToast('Device sensors not supported by this browser/device.', 'warning');
            return;
        }

        const permissionGranted = await this.requestPermission();
        if (!permissionGranted) {
            notifications.showToast('Permission to access device sensors denied.', 'error');
            return;
        }

        this.startListening();
        this.isSensorActive = true;
        notifications.showToast('Device sensors activated!', 'success');
    }

    /**
     * Starts listening to device orientation or motion events and updates sensor data.
     * @private
     */
    startListening() {
        // Prefer DeviceOrientationEvent for angles (alpha, beta, gamma)
        if (typeof DeviceOrientationEvent !== 'undefined') {
            window.addEventListener('deviceorientation', this.handleDeviceOrientation.bind(this), true);
        } else if (typeof DeviceMotionEvent !== 'undefined') {
            // As a fallback, use DeviceMotionEvent and derive orientation if needed
            window.addEventListener('devicemotion', this.handleDeviceMotion.bind(this), true);
        }
    }

    /**
     * Stops listening to sensor events.
     * @public
     */
    stopListening() {
        window.removeEventListener('deviceorientation', this.handleDeviceOrientation);
        window.removeEventListener('devicemotion', this.handleDeviceMotion);
        this.isSensorActive = false;
        notifications.showToast('Device sensors deactivated.', 'info');
    }

    /**
     * Handle device orientation events.
     * Orientation gives alpha, beta, gamma in degrees.
     * @private
     * @param {DeviceOrientationEvent} event
     */
    handleDeviceOrientation(event) {
        const { alpha, beta, gamma } = event;
        this.sensorData.alpha = alpha;
        this.sensorData.beta = beta;
        this.sensorData.gamma = gamma;

        // If needed, convert to quaternions here
        // this.sensorData.quaternion = this.eulerToQuaternion(alpha, beta, gamma);
    }

    /**
     * Handle device motion events (acceleration, accelerationIncludingGravity, rotationRate).
     * This is an alternative if DeviceOrientationEvent is not available.
     * @private
     * @param {DeviceMotionEvent} event
     */
    handleDeviceMotion(event) {
        const rotation = event.rotationRate;
        if (rotation) {
            this.sensorData.alpha = rotation.alpha; // rotation around Z axis
            this.sensorData.beta = rotation.beta;   // rotation around X axis
            this.sensorData.gamma = rotation.gamma; // rotation around Y axis
        }
        // Acceleration could also be used if needed
    }

    /**
     * Converts Euler angles (alpha, beta, gamma) to a quaternion.
     * Alpha (Z), Beta (X), Gamma (Y) in degrees.
     * @private
     * @param {number} alpha - rotation around Z axis in degrees
     * @param {number} beta  - rotation around X axis in degrees
     * @param {number} gamma - rotation around Y axis in degrees
     * @returns {[number, number, number, number]} quaternion [w, x, y, z]
     */
    eulerToQuaternion(alpha, beta, gamma) {
        // Convert degrees to radians
        const _x = beta * Math.PI / 180;
        const _y = gamma * Math.PI / 180;
        const _z = alpha * Math.PI / 180;

        const cX = Math.cos(_x / 2);
        const cY = Math.cos(_y / 2);
        const cZ = Math.cos(_z / 2);
        const sX = Math.sin(_x / 2);
        const sY = Math.sin(_y / 2);
        const sZ = Math.sin(_z / 2);

        // Formula from Euler (Z-Y-X) to quaternion
        const w = cX * cY * cZ - sX * sY * sZ;
        const x = sX * cY * cZ - cX * sY * sZ;
        const y = cX * sY * cZ + sX * cY * sZ;
        const z = cX * cY * sZ + sX * sY * cZ;

        return [w, x, y, z];
    }

    /**
     * Returns the latest sensor data.
     * @public
     * @returns {object} sensorData
     */
    getSensorData() {
        return this.sensorData;
    }
}

export const SensorControllerInstance = SensorController.isSupported() ? new SensorController() : null;