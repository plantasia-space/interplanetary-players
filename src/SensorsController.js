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

        this.startDebugging();
    }

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

        this.mapQuaternionToParameters(this.sensorData.quaternion);
    }

    handleDeviceMotion(event) {
        const rotation = event.rotationRate;
        if (rotation) {
            this.sensorData.alpha = rotation.alpha;
            this.sensorData.beta = rotation.beta;
            this.sensorData.gamma = rotation.gamma;
            this.sensorData.quaternion = this.eulerToQuaternion(rotation.alpha, rotation.beta, rotation.gamma);

            this.mapQuaternionToParameters(this.sensorData.quaternion);
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

        let w = cX * cY * cZ - sX * sY * sZ;
        let x = sX * cY * cZ + cX * sY * sZ;
        let y = cX * sY * cZ - sX * cY * sZ;
        let z = cX * cY * sZ + sX * sY * cZ;

        // Ensure a consistent quaternion orientation (avoid sign flips)
        if (w < 0) {
            w = -w; x = -x; y = -y; z = -z;
        }

        return [w, x, y, z];
    }

    /**
     * Convert quaternion to yaw, pitch, roll.
     * Yaw (around z), Pitch (around y), Roll (around x).
     * Ranges of these angles are typically -π to π.
     *
     * yaw   = atan2(2(wz + xy), w² + x² - y² - z²)
     * pitch = asin(2(wy - xz))
     * roll  = atan2(2(wx + yz), w² - x² - y² + z²)
     */
    quaternionToYawPitchRoll([w, x, y, z]) {
        const sinPitch = 2 * (w * y - x * z);
        const pitch = Math.abs(sinPitch) >= 1 ? Math.sign(sinPitch) * (Math.PI / 2) : Math.asin(sinPitch);
        
        const yaw = Math.atan2(2 * (w * z + x * y), w * w + x * x - y * y - z * z);
        const roll = Math.atan2(2 * (w * x + y * z), w * w - x * x - y * y + z * z);

        return { yaw, pitch, roll };
    }

    /**
     * Maps quaternion-derived yaw/pitch/roll to x, y, z parameters.
     * Each angle is in [-π, π]. We'll map to [0,1] by adding π and dividing by 2π.
     */
    mapQuaternionToParameters(quaternion) {
        const { yaw, pitch, roll } = this.quaternionToYawPitchRoll(quaternion);

        // Normalize from (-π, π) to [0, 1]
        const normalizeAngle = (angle) => (angle + Math.PI) / (2 * Math.PI);

        const xNorm = normalizeAngle(roll);   // or yaw/pitch depending on preference
        const yNorm = normalizeAngle(pitch);
        const zNorm = normalizeAngle(yaw);

        this.parameterManager.setNormalizedValue('x', xNorm);
        this.parameterManager.setNormalizedValue('y', yNorm);
        this.parameterManager.setNormalizedValue('z', zNorm);

        console.debug(`[SensorController] Updated parameters via quaternion: x=${xNorm.toFixed(2)}, y=${yNorm.toFixed(2)}, z=${zNorm.toFixed(2)}`);
    }

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

    stopDebugging() {
        if (this.debugInterval) {
            clearInterval(this.debugInterval);
            this.debugInterval = null;
        }
    }
}

export const SensorControllerInstance = SensorController.isSupported() ? new SensorController() : null;