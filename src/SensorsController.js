// src/SensorsController.js
import { Quaternion, Euler, Vector3, MathUtils } from 'three';

export class SensorController {
    constructor(user1Manager) {
        if (SensorController.instance) {
            return SensorController.instance;
        }

        this.isSensorActive = false;
        this.user1Manager = user1Manager;

        // Initialize Three.js Quaternion and Vector3
        this.quaternion = new Quaternion();
        this.referenceVector = new Vector3(1, 0, 0);
        this.rotatedVector = new Vector3();

        // Axis activation states (default to inactive)
        this.activeAxes = { x: false, y: false, z: false };

        // Bind toggle handlers
        this.handleToggleChange = this.handleToggleChange.bind(this);

        // Set up sensor toggles
        this.initializeToggles();

        SensorController.instance = this;
    }

    /**
     * Initializes the toggles and binds their change events.
     */
    initializeToggles() {
        ['toggleSensorX', 'toggleSensorY', 'toggleSensorZ'].forEach((id) => {
            const toggle = document.getElementById(id);
            const axis = id.replace('toggleSensor', '').toLowerCase();

            if (toggle) {
                // Log the initial state for debugging
                console.debug(`[Init Debug] Toggle ID: ${id}, Axis: ${axis}, Initial state: ${toggle.state}`);

                // Listen for state changes
                toggle.addEventListener('change', () => this.handleToggleChange(toggle, axis));
            } else {
                console.warn(`SensorController: Toggle element '${id}' not found.`);
            }
        });
    }

    static isSupported() {
        return typeof DeviceOrientationEvent !== 'undefined';
    }

    async requestPermission() {
        if (
            typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function'
        ) {
            try {
                const response = await DeviceOrientationEvent.requestPermission();
                if (response === 'granted') {
                    return true;
                } else {
                    console.warn('SensorController: Sensor access denied by user.');
                    return false;
                }
            } catch (error) {
                console.error('SensorController: Error requesting permission:', error);
                return false;
            }
        }
        return true;
    }

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

    startListening() {
        window.addEventListener('deviceorientation', this.handleDeviceOrientation.bind(this), true);
        console.log('SensorController: Started listening to deviceorientation events.');
    }

    stopListening() {
        window.removeEventListener('deviceorientation', this.handleDeviceOrientation.bind(this), true);
        this.isSensorActive = false;
        this.stopDebugging();
        console.log('SensorController: Stopped listening to deviceorientation events.');
    }


    /**
     * Handles changes to toggle states.
     * @param {HTMLElement} toggle - The toggle element.
     * @param {string} axis - The axis ('x', 'y', or 'z').
     */
    handleToggleChange(toggle, axis) {
        const isActive = toggle.state === 1; // Use the `state` property of WebAudioSwitch

        console.debug(`[Toggle Debug] Toggle ID: ${toggle.id}, Axis: ${axis}, State: ${toggle.state}`);

        if (axis in this.activeAxes) {
            this.activeAxes[axis] = isActive;
            console.log(`SensorController: Axis '${axis.toUpperCase()}' is now ${isActive ? 'active' : 'inactive'}.`);

            if (isActive) {
                // Activate sensors if this is the first active axis
                if (!this.isSensorActive) {
                    this.activateSensors();
                }
            } else {
                // Deactivate sensors if no axes are active
                const anyActive = Object.values(this.activeAxes).some(val => val);
                if (!anyActive && this.isSensorActive) {
                    this.stopListening();
                }
            }
        }

        console.debug(`[Toggle Debug] ActiveAxes After:`, this.activeAxes);
    }


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

            this.mapQuaternionToParameters(this.quaternion);
        } catch (error) {
            console.error('SensorController: Error in handleDeviceOrientation:', error);
        }
    }

    mapQuaternionToParameters(q) {
        try {
            this.rotatedVector.copy(this.referenceVector).applyQuaternion(q);

            const mapTo01 = (v) => (v + 1) / 2;

            const xNorm = MathUtils.clamp(mapTo01(this.rotatedVector.x), 0, 1);
            const yNorm = MathUtils.clamp(mapTo01(this.rotatedVector.y), 0, 1);
            const zNorm = MathUtils.clamp(mapTo01(this.rotatedVector.z), 0, 1);

            console.log(`SensorController: Normalized Parameters - x: ${xNorm.toFixed(3)}, y: ${yNorm.toFixed(3)}, z: ${zNorm.toFixed(3)}`);

            if (this.activeAxes.x) this.user1Manager.setNormalizedValue('x', xNorm);
            if (this.activeAxes.y) this.user1Manager.setNormalizedValue('y', yNorm);
            if (this.activeAxes.z) this.user1Manager.setNormalizedValue('z', zNorm);

            console.debug(`[SensorController] Updated parameters via quaternion: x=${xNorm}, y=${yNorm}, z=${zNorm}`);
        } catch (error) {
            console.error('SensorController: Error in mapQuaternionToParameters:', error);
        }
    }

    /* startDebugging() {
        if (this.debugInterval) return;

        this.debugInterval = setInterval(() => {
            if (this.isSensorActive) {
                const { alpha, beta, gamma } = this.sensorData;
                console.log(
                    `Sensor Data - Alpha: ${alpha?.toFixed(2)}°, Beta: ${beta?.toFixed(2)}°, Gamma: ${gamma?.toFixed(2)}°`
                );
            }
        }, 5000);

        console.log('SensorController: Started debugging interval.');
    } */

    stopDebugging() {
        if (this.debugInterval) {
            clearInterval(this.debugInterval);
            this.debugInterval = null;
            console.log('SensorController: Stopped debugging interval.');
        }
    }
}