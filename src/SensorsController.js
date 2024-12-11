/**
 * @file SensorController.js
 * @description Handles access to device motion/orientation sensors, requesting permission if needed and providing data.
 * @version 1.1.0
 * @author 
 * @license MIT
 * @date 2024-12-11
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
         * Last known sensor data.
         * @type {object}
         */
        this.sensorData = {
            alpha: null,
            beta: null,
            gamma: null,
            quaternion: null,
        };

        /**
         * Interval for debugging sensor data toasts.
         * @type {number|null}
         */
        this.debugInterval = null;

        SensorController.instance = this;
    }

    static isSupported() {
        return (
            typeof DeviceMotionEvent !== 'undefined' || 
            typeof DeviceOrientationEvent !== 'undefined'
        );
    }

    async requestPermission() {
        if (
            typeof DeviceMotionEvent !== 'undefined' &&
            typeof DeviceMotionEvent.requestPermission === 'function'
        ) {
            try {
                const response = await DeviceMotionEvent.requestPermission();
                return response === 'granted';
            } catch (err) {
                console.error('SensorController: Permission request error', err);
                return false;
            }
        }
        return true;
    }

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

    startListening() {
        if (typeof DeviceOrientationEvent !== 'undefined') {
            window.addEventListener('deviceorientation', this.handleDeviceOrientation.bind(this), true);
        } else if (typeof DeviceMotionEvent !== 'undefined') {
            window.addEventListener('devicemotion', this.handleDeviceMotion.bind(this), true);
        }

        this.startDebugging(); // Start periodic debugging toasts
    }

    stopListening() {
        window.removeEventListener('deviceorientation', this.handleDeviceOrientation);
        window.removeEventListener('devicemotion', this.handleDeviceMotion);
        this.isSensorActive = false;
        this.stopDebugging(); // Stop debugging toasts
        notifications.showToast('Device sensors deactivated.', 'info');
    }

    handleDeviceOrientation(event) {
        const { alpha, beta, gamma } = event;
        this.sensorData.alpha = alpha;
        this.sensorData.beta = beta;
        this.sensorData.gamma = gamma;
        this.sensorData.quaternion = this.eulerToQuaternion(alpha, beta, gamma);
    }

    handleDeviceMotion(event) {
        const rotation = event.rotationRate;
        if (rotation) {
            this.sensorData.alpha = rotation.alpha;
            this.sensorData.beta = rotation.beta;
            this.sensorData.gamma = rotation.gamma;
        }
    }

    eulerToQuaternion(alpha, beta, gamma) {
        const _x = beta * Math.PI / 180;
        const _y = gamma * Math.PI / 180;
        const _z = alpha * Math.PI / 180;

        const cX = Math.cos(_x / 2);
        const cY = Math.cos(_y / 2);
        const cZ = Math.cos(_z / 2);
        const sX = Math.sin(_x / 2);
        const sY = Math.sin(_y / 2);
        const sZ = Math.sin(_z / 2);

        const w = cX * cY * cZ - sX * sY * sZ;
        const x = sX * cY * cZ + cX * sY * sZ;
        const y = cX * sY * cZ - sX * cY * sZ;
        const z = cX * cY * sZ + sX * sY * cZ;

        return [w, x, y, z];
    }

    getSensorData() {
        return this.sensorData;
    }

    /**
     * Starts periodic debugging toasts with sensor data.
     * @private
     */
    startDebugging() {
        if (this.debugInterval) return;

        this.debugInterval = setInterval(() => {
            if (this.isSensorActive) {
                const { alpha, beta, gamma, quaternion } = this.sensorData;
                notifications.showToast(
                    `Sensor Data:
                    Alpha: ${alpha?.toFixed(2)}, Beta: ${beta?.toFixed(2)}, Gamma: ${gamma?.toFixed(2)}
                    Quaternion: [${quaternion?.map(v => v.toFixed(2)).join(', ')}]`,
                    'info'
                );
            }
        }, 5000); // Update every 5 seconds
    }

    /**
     * Stops periodic debugging toasts.
     * @private
     */
    stopDebugging() {
        if (this.debugInterval) {
            clearInterval(this.debugInterval);
            this.debugInterval = null;
        }
    }
}

export const SensorControllerInstance = SensorController.isSupported() ? new SensorController() : null;