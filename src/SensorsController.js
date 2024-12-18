import { Quaternion, Euler, Vector3, MathUtils } from 'three';
import { INTERNAL_SENSORS_USABLE, EXTERNAL_SENSORS_USABLE, setExternalSensorsUsable } from './Constants.js';
import QRCode from 'qrcode';
import notifications from './AppNotifications';

/**
 * @class SensorController
 * @description Manages device orientation sensor inputs and maps them to user parameters.
 * Handles toggle-based activation/deactivation of sensor axes (x, y, z).
 * Integrates with a user-defined `ParameterManager` for real-time updates.
 */
export class SensorController {
    static getInstance(user1Manager) {
        if (!SensorController.instance) {
            SensorController.instance = new SensorController(user1Manager);
        }
        return SensorController.instance;
    }
    constructor(user1Manager) {
        if (SensorController.instance) return SensorController.instance;

        /**
         * @type {boolean} Indicates if the sensor is actively listening to device orientation events.
         */
        this.isSensorActive = false;

        /**
         * @type {User1Manager} Manages parameter updates and subscriptions.
         */
        this.user1Manager = user1Manager;

        // Initialize Three.js Quaternion and Vector3 for sensor calculations.
        this.quaternion = new Quaternion();
        this.referenceVector = new Vector3(1, 0, 0); // Fixed reference axis for mapping.
        this.rotatedVector = new Vector3(); // Stores the rotated vector after quaternion transformation.

        /**
         * @type {Object} Tracks activation states for each axis ('x', 'y', 'z'). Defaults to inactive.
         */
        this.activeAxes = { x: false, y: false, z: false };

        // Throttle updates to prevent excessive parameter updates.
        this.throttleUpdate = this.throttle(this.updateParameters.bind(this), 100);

        // Bind toggle handlers for event listeners.
        this.handleToggleChange = this.handleToggleChange.bind(this);

        // Initialize toggles for controlling sensor axes.
        this.initializeToggles();

        // Determine whether internal or external sensors are usable
        this.useInternalSensors = INTERNAL_SENSORS_USABLE;
        this.useExternalSensors = EXTERNAL_SENSORS_USABLE;

        // Initialize sensors based on availability
        if (this.useInternalSensors) {
            this.initializeInternalSensors();
        } else if (this.useExternalSensors) {
            this.initializeExternalSensors();
        } else {
            console.warn('SensorController: No usable sensors detected.');
        }

        // Singleton pattern.
        SensorController.instance = this;
    }

    /**
     * Initializes the toggles for sensor axes (x, y, z) and binds their change events.
     * Assumes toggles are WebAudioSwitch elements with `state` representing activation.
     * Logs the initial state of each toggle for debugging purposes.
     */
    initializeToggles() {
        ['toggleSensorX', 'toggleSensorY', 'toggleSensorZ'].forEach((id) => {
            const toggle = document.getElementById(id);
            const axis = id.replace('toggleSensor', '').toLowerCase();

            if (toggle) {
                console.debug(`[Init Debug] Toggle ID: ${id}, Axis: ${axis}, Initial state: ${toggle.state}`);

                // Bind change event to the toggle.
                toggle.addEventListener('change', () => this.handleToggleChange(toggle, axis));
            } else {
                console.warn(`SensorController: Toggle element '${id}' not found.`);
            }
        });
    }

    /**
     * Checks if the device supports orientation sensors.
     * @static
     * @returns {boolean} True if `DeviceOrientationEvent` is supported, false otherwise.
     */
    static isSupported() {
        return typeof DeviceOrientationEvent !== 'undefined';
    }
    generateConnectionModal() {
        console.log('[SensorController] generateConnectionModal called.');
    
        const pairingInfo = {
            desktopClientId: 'unique-desktop-client-id',
            signalingServer: 'wss://media.maar.world/ws/',
        };
    
        QRCode.toDataURL(JSON.stringify(pairingInfo), { width: 150 })
            .then(url => {
                const modalContent = `
                    <div style="text-align: center; padding: 15px;">
                        <p style="margin-bottom: 10px;">Scan the QR code with your mobile device to pair it as an external sensor.</p>
                        <img src="${url}" alt="QR Code" style="display: block; margin: 0 auto; max-width: 150px; height: auto;" />
                    </div>
                `;
    
                notifications
                    .showUniversalModal('Connect External Sensor', modalContent, 'Close')
                    .then(() => {
                        console.log('[SensorController] Connection modal closed.');
                    });
    
                // Send pairing info to the signaling server
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({ type: 'pairing-request', payload: pairingInfo }));
                    console.log('[SensorController] Pairing request sent.');
                } else {
                    console.error('[SensorController] WebSocket is not connected.');
                    notifications.showToast('Unable to send pairing request.', 'error');
                }
            })
            .catch(error => {
                console.error('Failed to generate QR code:', error);
                notifications.showToast('Failed to generate QR code.', 'error');
            });
    }
    /**
     * Requests user permission to access orientation sensors (iOS 13+ only).
     * @async
     * @returns {Promise<boolean>} Resolves to `true` if permission is granted, `false` otherwise.
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
                console.error('SensorController: Error requesting permission:', error);
                return false;
            }
        }
        return true; // Assume permission is granted on non-iOS devices.
    }
    initializeSignalingServer() {
        console.log('[SensorController] Initializing signaling server connection...');
        this.ws = new WebSocket('wss://media.maar.world/ws/');
    
        this.ws.onopen = () => {
            console.log('[SensorController] Connected to signaling server.');
            notifications.showToast('Connected to signaling server.', 'success');
        };
    
        this.ws.onmessage = (message) => {
            console.log('[SensorController] Message received from server:', message.data);
            this.handleSignalingMessage(JSON.parse(message.data));
        };
    
        this.ws.onclose = () => {
            console.warn('[SensorController] Signaling server connection closed.');
            notifications.showToast('Connection to signaling server closed.', 'warning');
        };
    
        this.ws.onerror = (error) => {
            console.error('[SensorController] Error with signaling server:', error);
            notifications.showToast('Error with signaling server.', 'error');
        };
    }

    handleSignalingMessage(data) {
        switch (data.type) {
            case 'pairing-ack':
                console.log('[SensorController] Pairing acknowledged:', data);
                notifications.showToast('Pairing successful!', 'success');
                break;
            case 'sensor-data':
                console.log('[SensorController] Sensor data received:', data);
                // Handle sensor data
                break;
            default:
                console.warn('[SensorController] Unknown message type:', data.type);
        }
    }


    /**
     * Activates the device orientation sensor if supported and permission is granted.
     * Binds the `deviceorientation` event to listen for orientation changes.
     * @async
     */
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

    /**
     * Starts listening for `deviceorientation` events to capture orientation changes.
     * Ensures that only one listener is active at a time.
     * @private
     */
    startListening() {
        if (!this.isSensorActive) {
            window.addEventListener('deviceorientation', this.handleDeviceOrientation.bind(this), true);
            console.log('SensorController: Started listening to deviceorientation events.');
        }
    }

    /**
     * Stops listening for `deviceorientation` events.
     * Resets the `isSensorActive` flag.
     * @public
     */
    stopListening() {
        if (this.isSensorActive) {
            window.removeEventListener('deviceorientation', this.handleDeviceOrientation.bind(this), true);
            this.isSensorActive = false;
            console.log('SensorController: Stopped listening to deviceorientation events.');
        }
    }

    /**
     * Handles changes to toggle states for sensor axes.
     * Updates the `activeAxes` state and manages sensor activation/deactivation.
     * @param {HTMLElement} toggle - The toggle element.
     * @param {string} axis - The axis ('x', 'y', or 'z') corresponding to the toggle.
     */
    handleToggleChange(toggle, axis) {
        const isActive = toggle.state === 1;

        console.debug(`[Toggle Debug] Toggle ID: ${toggle.id}, Axis: ${axis}, State: ${toggle.state}`);

        if (axis in this.activeAxes) {
            this.activeAxes[axis] = isActive;
            console.log(`SensorController: Axis '${axis.toUpperCase()}' is now ${isActive ? 'active' : 'inactive'}.`);

            if (isActive) {
                if (!this.isSensorActive) this.activateSensors();
            } else {
                const anyActive = Object.values(this.activeAxes).some(val => val);
                if (!anyActive && this.isSensorActive) this.stopListening();
            }
        }

        console.debug(`[Toggle Debug] ActiveAxes After:`, this.activeAxes);
    }

    /**
     * Handles `deviceorientation` events, converts orientation data to a quaternion,
     * and maps the quaternion to normalized parameters for active axes.
     * @param {DeviceOrientationEvent} event - The orientation event containing `alpha`, `beta`, and `gamma` angles.
     */
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

            this.throttleUpdate(this.quaternion);
        } catch (error) {
            console.error('SensorController: Error in handleDeviceOrientation:', error);
        }
    }

    /**
     * Maps a quaternion to normalized parameters and updates the `user1Manager`.
     * @param {THREE.Quaternion} q - The quaternion representing the current device orientation.
     * @private
     */
    updateParameters(q) {
        try {
            this.rotatedVector.copy(this.referenceVector).applyQuaternion(q);

            const mapTo01 = (v) => (v + 1) / 2;

            const xNorm = MathUtils.clamp(mapTo01(this.rotatedVector.x), 0, 1);
            const yNorm = MathUtils.clamp(mapTo01(this.rotatedVector.y), 0, 1);
            const zNorm = MathUtils.clamp(mapTo01(this.rotatedVector.z), 0, 1);

            console.log(`SensorController: Normalized Parameters - x: ${xNorm.toFixed(3)}, y: ${yNorm.toFixed(3)}, z: ${zNorm}`);

            if (this.activeAxes.x) this.user1Manager.setNormalizedValue('x', xNorm);
            if (this.activeAxes.y) this.user1Manager.setNormalizedValue('y', yNorm);
            if (this.activeAxes.z) this.user1Manager.setNormalizedValue('z', zNorm);
        } catch (error) {
            console.error('SensorController: Error in updateParameters:', error);
        }
    }

    /**
     * Throttles a function call to a specified limit.
     * Prevents excessive executions of expensive operations.
     * @param {Function} func - The function to throttle.
     * @param {number} limit - The time in milliseconds to throttle executions.
     * @returns {Function} The throttled function.
     */
    throttle(func, limit) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => (inThrottle = false), limit);
            }
        };
    }
}

