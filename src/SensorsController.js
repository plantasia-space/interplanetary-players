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

        // Track "continuous" angles to avoid jumps
        this.lastAlpha = null;
        this.lastBeta = null;
        this.lastGamma = null;

        this.accumulatedAlpha = 0; 
        this.accumulatedBeta = 0;
        this.accumulatedGamma = 0;

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

    startListening() {
        if (typeof DeviceOrientationEvent !== 'undefined') {
            window.addEventListener('deviceorientation', this.handleDeviceOrientation.bind(this), true);
        } else if (typeof DeviceMotionEvent !== 'undefined') {
            window.addEventListener('devicemotion', this.handleDeviceMotion.bind(this), true);
        }

/*         this.startDebugging();
 */    }

    stopListening() {
        window.removeEventListener('deviceorientation', this.handleDeviceOrientation);
        window.removeEventListener('devicemotion', this.handleDeviceMotion);
        this.isSensorActive = false;
        this.stopDebugging();
        notifications.showToast('Sensors deactivated.', 'info');
    }

    handleDeviceOrientation(event) {
        const { alpha, beta, gamma } = event;
        this.sensorData.alpha = alpha;
        this.sensorData.beta = beta;
        this.sensorData.gamma = gamma;
        this.sensorData.quaternion = this.eulerToQuaternion(alpha, beta, gamma);

        this.mapToParameters(alpha, beta, gamma);
    }

    handleDeviceMotion(event) {
        const rotation = event.rotationRate;
        if (rotation) {
            this.sensorData.alpha = rotation.alpha;
            this.sensorData.beta = rotation.beta;
            this.sensorData.gamma = rotation.gamma;

            this.mapToParameters(rotation.alpha, rotation.beta, rotation.gamma);
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

    /**
     * Adjusts angles to avoid jumps.
     * Detects if the angle wrapped from near 360 to 0 (or vice versa) and adjusts accordingly
     * to maintain a continuous angle.
     * 
     * @param {number} angle - Current angle in degrees.
     * @param {number|null} lastAngle - The last recorded angle.
     * @param {number} accumulatedAngle - The accumulated angle value.
     * @param {number} wrapThreshold - The threshold to detect a wrap, e.g., 180.
     * @returns {{newAccumulated: number, lastAngle: number}} - Updated accumulated angle and lastAngle.
     */
    adjustAngle(angle, lastAngle, accumulatedAngle, wrapThreshold = 180) {
        if (lastAngle !== null) {
            const diff = angle - lastAngle;
            // If we suddenly jump by more than wrapThreshold, assume wrap happened
            if (diff > wrapThreshold) {
                // Jumped forward past 360 boundary, subtract 360
                accumulatedAngle -= 360;
            } else if (diff < -wrapThreshold) {
                // Jumped backward past 0 boundary, add 360
                accumulatedAngle += 360;
            }
        }
        // Add the current angle (as a delta from lastAngle)
        if (lastAngle !== null) {
            accumulatedAngle += (angle - lastAngle);
        } else {
            // If first time, initialize without adjusting
            accumulatedAngle += angle;
        }

        return { newAccumulated: accumulatedAngle, lastAngle: angle };
    }

    mapToParameters(alpha, beta, gamma) {
        // Adjust alpha, beta, gamma to continuous angles
        let result = this.adjustAngle(alpha, this.lastAlpha, this.accumulatedAlpha);
        this.accumulatedAlpha = result.newAccumulated;
        this.lastAlpha = result.lastAngle;

        result = this.adjustAngle(beta, this.lastBeta, this.accumulatedBeta);
        this.accumulatedBeta = result.newAccumulated;
        this.lastBeta = result.lastAngle;

        result = this.adjustAngle(gamma, this.lastGamma, this.accumulatedGamma);
        this.accumulatedGamma = result.newAccumulated;
        this.lastGamma = result.lastAngle;

        // Now we have continuous angles: accumulatedAlpha, accumulatedBeta, accumulatedGamma
        // Normalize these continuous angles to [0, 1] range as needed.
        // One strategy is to mod them by 360 to keep them in [0, 360) then divide by 360.
        // But doing modulo will reintroduce the jump. Instead, we can choose a rolling window.

        // For simplicity, let's just map them into a window. For example:
        // We'll take the current accumulated angle mod 360 to a [0,360) range:
        const modAlpha = ((this.accumulatedAlpha % 360) + 360) % 360;
        const modBeta = ((this.accumulatedBeta % 360) + 360) % 360;
        const modGamma = ((this.accumulatedGamma % 360) + 360) % 360;

        const x = modAlpha / 360; 
        const y = modBeta / 360;
        const z = modGamma / 360;

        this.parameterManager.setNormalizedValue('x', x);
        this.parameterManager.setNormalizedValue('y', y);
        this.parameterManager.setNormalizedValue('z', z);

        console.debug(`[SensorController] Updated parameters: x=${x.toFixed(2)}, y=${y.toFixed(2)}, z=${z.toFixed(2)}`);
    }
/* 
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
    } */

    stopDebugging() {
        if (this.debugInterval) {
            clearInterval(this.debugInterval);
            this.debugInterval = null;
        }
    }
}

export const SensorControllerInstance = SensorController.isSupported() ? new SensorController() : null;