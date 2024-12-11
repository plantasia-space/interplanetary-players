import { ParameterManager } from './ParameterManager.js';
import { notifications } from './Main.js';

export class SensorController {
    constructor() {
        if (SensorController.instance) {
            return SensorController.instance;
        }

        this.isSensorActive = false;

        this.sensorData = {
            alpha: null,
            beta: null,
            gamma: null,
            quaternion: null,
        };

        this.parameterManager = ParameterManager.getInstance();

        this.debugInterval = null;

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
     * Maps sensor data to root parameters.
     * @private
     */
    startListening() {
        if (typeof DeviceOrientationEvent !== 'undefined') {
            window.addEventListener('deviceorientation', this.handleDeviceOrientation.bind(this), true);
        } else if (typeof DeviceMotionEvent !== 'undefined') {
            window.addEventListener('devicemotion', this.handleDeviceMotion.bind(this), true);
        }

/*         this.startDebugging();
 */    }

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
     * Maps alpha, beta, gamma to x, y, z parameters.
     * @param {DeviceOrientationEvent} event - The orientation event.
     * @private
     */
    handleDeviceOrientation(event) {
        const { alpha, beta, gamma } = event;
        this.sensorData.alpha = alpha;
        this.sensorData.beta = beta;
        this.sensorData.gamma = gamma;
        this.sensorData.quaternion = this.eulerToQuaternion(alpha, beta, gamma);

        // Map orientation to root parameters
        this.mapToParameters(alpha, beta, gamma);
    }

    /**
     * Handles device motion events.
     * Updates rotation rates if available.
     * @param {DeviceMotionEvent} event - The motion event.
     * @private
     */
    handleDeviceMotion(event) {
        const rotation = event.rotationRate;
        if (rotation) {
            this.sensorData.alpha = rotation.alpha;
            this.sensorData.beta = rotation.beta;
            this.sensorData.gamma = rotation.gamma;

            // Map rotation to root parameters
            this.mapToParameters(rotation.alpha, rotation.beta, rotation.gamma);
        }
    }

    /**
     * Converts Euler angles to a quaternion.
     * @param {number} alpha - The rotation around the z-axis.
     * @param {number} beta - The rotation around the x-axis.
     * @param {number} gamma - The rotation around the y-axis.
     * @returns {number[]} - The quaternion [w, x, y, z].
     */
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

    /**
     * Maps sensor values to root parameters (x, y, z).
     * @param {number} alpha - Rotation around z-axis.
     * @param {number} beta - Rotation around x-axis.
     * @param {number} gamma - Rotation around y-axis.
     * @private
     */
    mapToParameters(alpha, beta, gamma) {
        const x = alpha / 360; // Normalize alpha (0-360) to (0-1)
        const y = (beta + 180) / 360; // Normalize beta (-180 to 180) to (0-1)
        const z = (gamma + 90) / 180; // Normalize gamma (-90 to 90) to (0-1)

        this.parameterManager.setNormalizedValue('x', x);
        this.parameterManager.setNormalizedValue('y', y);
        this.parameterManager.setNormalizedValue('z', z);

        console.debug(`[SensorController] Updated parameters: x=${x}, y=${y}, z=${z}`);
    }

    /**
     * Starts periodic debugging toasts with sensor data.
     * @private
     */
/*     startDebugging() {
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
    } */

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