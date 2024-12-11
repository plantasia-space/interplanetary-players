import { ParameterManager } from './ParameterManager.js';
import { notifications } from './Main.js';
import * as THREE from 'three';

export class SensorController {
    constructor() {
        if (SensorController.instance) {
            return SensorController.instance;
        }

        this.isSensorActive = false;
        this.parameterManager = ParameterManager.getInstance();
        this.debugInterval = null;

        // Initialize Three.js Quaternion and Vector3
        this.quaternion = new THREE.Quaternion();
        this.referenceVector = new THREE.Vector3(1, 0, 0); // Reference axis to map
        this.rotatedVector = new THREE.Vector3();

        SensorController.instance = this;
    }

    /**
     * Checks if Device Orientation or Motion is supported.
     * @returns {boolean}
     */
    static isSupported() {
        return (
            typeof DeviceMotionEvent !== 'undefined' || 
            typeof DeviceOrientationEvent !== 'undefined'
        );
    }

    /**
     * Requests permission to access sensors if needed (iOS 13+).
     * @async
     * @returns {Promise<boolean>} - True if permission granted, false otherwise.
     */
    async requestPermission() {
        if (
            typeof DeviceMotionEvent !== 'undefined' &&
            typeof DeviceMotionEvent.requestPermission === 'function'
        ) {
            try {
                const response = await DeviceMotionEvent.requestPermission();
                if (response === 'granted') {
                    notifications.showToast('Sensor access granted.', 'success');
                    return true;
                } else {
                    notifications.showToast('Sensor access denied.', 'error');
                    return false;
                }
            } catch (error) {
                console.error('SensorController: Error requesting permission:', error);
                notifications.showToast('Error requesting sensor access.', 'error');
                return false;
            }
        }

        // Assume permissions are granted for non-iOS devices
        notifications.showToast('Sensor access available (no explicit request needed).', 'info');
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
            notifications.showToast('Permission to access sensors denied.', 'error');
            return;
        }

        this.startListening();
        this.isSensorActive = true;
        notifications.showToast('Sensors activated successfully!', 'success');
    }

    /**
     * Starts listening to device orientation or motion events.
     * @private
     */
    startListening() {
        if (typeof DeviceOrientationEvent !== 'undefined') {
            window.addEventListener('deviceorientation', this.handleDeviceOrientation.bind(this), true);
        } else if (typeof DeviceMotionEvent !== 'undefined') {
            window.addEventListener('devicemotion', this.handleDeviceMotion.bind(this), true);
        }

        this.startDebugging();
    }

    /**
     * Stops listening to sensor events.
     * @public
     */
    stopListening() {
        window.removeEventListener('deviceorientation', this.handleDeviceOrientation);
        window.removeEventListener('devicemotion', this.handleDeviceMotion);
        this.isSensorActive = false;
        this.stopDebugging();
        notifications.showToast('Sensors deactivated.', 'info');
    }

    /**
     * Handles device orientation events.
     * Converts Euler angles to quaternion and maps to parameters.
     * @param {DeviceOrientationEvent} event - The orientation event.
     * @private
     */
    handleDeviceOrientation(event) {
        const { alpha, beta, gamma } = event;
        this.sensorData.alpha = alpha;
        this.sensorData.beta = beta;
        this.sensorData.gamma = gamma;

        // Convert Euler angles to quaternion using Three.js
        // Three.js uses 'ZXY' order for device orientation by default
        const euler = new THREE.Euler(
            THREE.MathUtils.degToRad(beta || 0),
            THREE.MathUtils.degToRad(alpha || 0),
            THREE.MathUtils.degToRad(gamma || 0),
            'ZXY'
        );
        this.quaternion.setFromEuler(euler);

        this.mapQuaternionToParameters(this.quaternion);
    }

    /**
     * Handles device motion events.
     * Not typically used for orientation, but included for completeness.
     * @param {DeviceMotionEvent} event - The motion event.
     * @private
     */
    handleDeviceMotion(event) {
        const { rotationRate } = event;
        if (rotationRate) {
            const { alpha, beta, gamma } = rotationRate;
            this.sensorData.alpha = alpha;
            this.sensorData.beta = beta;
            this.sensorData.gamma = gamma;

            // Convert rotation rates to quaternion if needed
            // Typically, deviceorientation is preferred for stable orientation
            // Here, we'll skip mapping rotation rates directly as they represent angular velocity
        }
    }

    /**
     * Maps a quaternion to normalized x, y, z parameters by rotating a reference vector.
     * @param {THREE.Quaternion} q - The quaternion representing orientation.
     * @private
     */
    mapQuaternionToParameters(q) {
        // Apply quaternion to reference vector
        this.rotatedVector.copy(this.referenceVector).applyQuaternion(q);

        // Normalize vector components from [-1, 1] to [0, 1]
        const mapTo01 = (v) => (v + 1) / 2;

        const xNorm = THREE.MathUtils.clamp(mapTo01(this.rotatedVector.x), 0, 1);
        const yNorm = THREE.MathUtils.clamp(mapTo01(this.rotatedVector.y), 0, 1);
        const zNorm = THREE.MathUtils.clamp(mapTo01(this.rotatedVector.z), 0, 1);

        // Update parameters
        this.parameterManager.setNormalizedValue('x', xNorm);
        this.parameterManager.setNormalizedValue('y', yNorm);
        this.parameterManager.setNormalizedValue('z', zNorm);

        console.debug(`[SensorController] Updated parameters via quaternion: x=${xNorm.toFixed(3)}, y=${yNorm.toFixed(3)}, z=${zNorm.toFixed(3)}`);
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
Alpha: ${alpha?.toFixed(2)}°, Beta: ${beta?.toFixed(2)}°, Gamma: ${gamma?.toFixed(2)}°
Quaternion: [${quaternion?.map(v => v.toFixed(2)).join(', ')}]`,
                    'info'
                );
            }
        }, 5000);
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