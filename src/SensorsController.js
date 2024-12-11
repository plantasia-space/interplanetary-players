import { ParameterManager } from './ParameterManager.js';
import { notifications } from './Main.js';
import * as THREE from 'three';

export class SensorController {
    constructor() {
        if (SensorController.instance) return SensorController.instance;

        this.isSensorActive = false;
        this.parameterManager = ParameterManager.getInstance();
        this.debugInterval = null;

        // Quaternion representing device orientation
        this.quaternion = new THREE.Quaternion();

        // A fixed reference vector. We'll rotate this vector by the quaternion.
        // Choose whatever axis fits your application best.
        this.referenceVector = new THREE.Vector3(1,0,0);

        SensorController.instance = this;
    }

    static isSupported() {
        return (typeof DeviceMotionEvent !== 'undefined' || typeof DeviceOrientationEvent !== 'undefined');
    }

    async requestPermission() {
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
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
        // DeviceOrientationEvent gives us alpha, beta, gamma
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
        
        // Convert alpha, beta, gamma to quaternion
        // Typically 'ZXY' order is used for device orientation
        const euler = new THREE.Euler(
            beta * THREE.Math.DEG2RAD,
            alpha * THREE.Math.DEG2RAD,
            gamma * THREE.Math.DEG2RAD,
            'ZXY'
        );
        this.quaternion.setFromEuler(euler);

        this.updateParametersFromQuaternion();
    }

    handleDeviceMotion(event) {
        const rotation = event.rotationRate;
        if (rotation) {
            const euler = new THREE.Euler(
                rotation.beta * THREE.Math.DEG2RAD,
                rotation.alpha * THREE.Math.DEG2RAD,
                rotation.gamma * THREE.Math.DEG2RAD,
                'ZXY'
            );
            this.quaternion.setFromEuler(euler);
            this.updateParametersFromQuaternion();
        }
    }

    updateParametersFromQuaternion() {
        // Apply the quaternion to the reference vector
        const rotatedVector = this.referenceVector.clone().applyQuaternion(this.quaternion);

        // rotatedVector components are in [-1, 1]. Map them to [0,1].
        const mapTo01 = v => (v + 1) / 2;
        
        const xNorm = mapTo01(rotatedVector.x);
        const yNorm = mapTo01(rotatedVector.y);
        const zNorm = mapTo01(rotatedVector.z);

        this.parameterManager.setNormalizedValue('x', xNorm);
        this.parameterManager.setNormalizedValue('y', yNorm);
        this.parameterManager.setNormalizedValue('z', zNorm);

        console.debug(`[SensorController] Updated parameters from quaternion: x=${xNorm.toFixed(2)}, y=${yNorm.toFixed(2)}, z=${zNorm.toFixed(2)}`);
    }

    startDebugging() {
        if (this.debugInterval) return;
        this.debugInterval = setInterval(() => {
            if (this.isSensorActive) {
                notifications.showToast('Sensors active and updating parameters.', 'info');
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