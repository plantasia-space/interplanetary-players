// sensors.js

import { Quaternion, Euler, Vector3, MathUtils } from 'three';
import { 
    INTERNAL_SENSORS_USABLE, 
    EXTERNAL_SENSORS_USABLE, 
    setExternalSensorsUsable, 
    UNIQUE_ID 
} from './Constants.js';
import QRCode from 'qrcode';
import notifications from './AppNotifications';

/**
 * @class SensorController
 * @description Manages device orientation sensor inputs and maps them to user parameters.
 * Handles toggle-based activation/deactivation of sensor axes (x, y, z).
 * Integrates with a user-defined `User1Manager` for real-time updates.
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
        this.isSensorActive = false;
        this.user1Manager = user1Manager;
        this.quaternion = new Quaternion();
        this.referenceVector = new Vector3(1, 0, 0); // Fixed reference axis for mapping.
        this.rotatedVector = new Vector3(); // Stores the rotated vector after quaternion transformation.
        this.activeAxes = { x: false, y: false, z: false };
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

        // WebSocket and signaling
        this.ws = null; // WebSocket instance
        this.peerConnection = null; // Peer-to-peer connection instance
        this.dataChannel = null; // DataChannel for communication
        this.targetClientId = null; // Mobile clientId to target for signaling
        this.clientId = null; // Desktop's own clientId

        // Ping-Pong mechanism variables
        this.pingInterval = null;
        this.pingTimeout = null;

        this.initializeSignalingServer(); // Initialize WebSocket connection
    }

    /**
     * Initializes the toggles for sensor axes (x, y, z) and binds their change events.
     * Assumes toggles are standard checkbox inputs.
     * Logs the initial state of each toggle for debugging purposes.
     */
    initializeToggles() {
        ['toggleSensorX', 'toggleSensorY', 'toggleSensorZ'].forEach((id) => {
            const toggle = document.getElementById(id);
            const axis = id.replace('toggleSensor', '').toLowerCase();

            if (toggle) {
                console.debug(`[Init Debug] Toggle ID: ${id}, Axis: ${axis}, Initial state: ${toggle.checked}`);

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

    /**
     * Generates a connection modal with a QR code for pairing the mobile device.
     * This function should be called after the desktop has received its clientId from the server.
     */
    generateConnectionModal() {
        console.log('[SensorController] Generating connection modal...');

        // Ensure clientId is received before generating QR code
        if (!this.clientId) {
            console.error('[SensorController] Cannot generate QR code before receiving clientId from server.');
            notifications.showToast('Cannot generate QR code yet. Please wait for registration.', 'error');
            return;
        }

        // Generate pairing URL with uniqueId
        const baseUrl = 'https://connect.maar.world/';
        const wsUrl = 'wss://connect.maar.world/ws/';
        const uniqueId = UNIQUE_ID; // Use the persistent uniqueId from constants

        // Generate a readable HTTPS URL for pairing
        const pairingInfo = `${baseUrl}?uniqueId=${uniqueId}&wsUrl=${encodeURIComponent(wsUrl)}`;
        console.log(`[SensorController] Pairing info: ${pairingInfo}`);

        // Generate QR Code
        QRCode.toDataURL(pairingInfo, { width: 150 })
            .then((url) => {
                console.log('[SensorController] QR Code successfully generated:', url);

                const modalContent = `
                    <div style="text-align: center; padding: 15px;">
                        <p style="margin-bottom: 10px;">Scan the QR code with your mobile device to pair it as an external sensor.</p>
                        <img src="${url}" alt="QR Code" style="display: block; margin: 0 auto; max-width: 150px; height: auto;" />
                        <p style="margin-top: 10px; font-size: 12px; word-break: break-word; color: #555;">
                            Or enter this URL manually:<br />
                            <a href="${pairingInfo}" target="_blank" style="color: #007bff;">${pairingInfo}</a>
                        </p>
                    </div>
                `;

                // Show modal
                notifications
                    .showUniversalModal('Connect External Sensor', modalContent, 'Close')
                    .then(() => console.log('[SensorController] Modal closed.'));
            })
            .catch((error) => {
                console.error('[SensorController] Error generating QR Code:', error);
                notifications.showToast('Error generating QR Code.', 'error');
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

    /**
     * Initializes the WebSocket signaling server connection and handles WebRTC setup.
     */
    initializeSignalingServer() {
        this.ws = new WebSocket('wss://connect.maar.world/ws/');

        this.ws.onopen = () => {
            console.log('[Desktop] Connected to WebSocket server.');
            console.log('[Desktop] Sending registration as desktop client.');
            this.ws.send(JSON.stringify({ type: 'register', clientType: 'desktop', uniqueId: UNIQUE_ID }));
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log('[Desktop] Message received from server:', message);

                switch (message.type) {
                    case 'registered':
                        console.log(`[Desktop] Registered with server. Client ID: ${message.clientId}`);
                        this.clientId = message.clientId;
                        // Automatically generate the QR code after registration
                        this.generateConnectionModal();
                        break;

                    case 'mobileConnected':
                        console.log(`[Desktop] Mobile client connected: ${message.clientId}`);
                        this.targetClientId = message.clientId;
                        // Now that mobile is connected, proceed to create WebRTC offer
                        this.createAndSendOffer();
                        break;

                    case 'answer':
                        console.log('[Desktop] Received SDP Answer from mobile:', message.answer.sdp);
                        if (this.peerConnection) {
                            this.peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer))
                                .then(() => console.log('[Desktop] Remote description set successfully.'))
                                .catch((err) => console.error('[Desktop] Error setting remote description:', err));
                        } else {
                            console.error('[Desktop] PeerConnection not initialized.');
                        }
                        break;

                    case 'candidate':
                        console.log('[Desktop] Received ICE Candidate from mobile:', message.candidate);
                        if (this.peerConnection) {
                            this.peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate))
                                .then(() => console.log('[Desktop] ICE Candidate added successfully.'))
                                .catch((err) => console.error('[Desktop] Error adding ICE Candidate:', err));
                        } else {
                            console.error('[Desktop] PeerConnection not initialized.');
                        }
                        break;

                    case 'pong':
                        console.log('[Desktop] Pong received from mobile:', message.message);
                        notifications.showToast('Connection confirmed with mobile device.', 'success');
                        // Reset the ping timeout
                        if (this.pingTimeout) {
                            clearTimeout(this.pingTimeout);
                            this.pingTimeout = null;
                        }
                        break;

                    case 'error':
                        console.error(`[Desktop] Server Error: ${message.message}`);
                        break;

                    case 'mobileDisconnected':
                        console.warn(`[Desktop] Mobile client disconnected: ${message.clientId}`);
                        // Clean up WebRTC connection if necessary
                        this.cleanupConnection();
                        break;

                    default:
                        console.warn('[Desktop] Unknown message type:', message.type);
                }
            } catch (error) {
                console.error('[Desktop] Error parsing WebSocket message:', event.data, error);
            }
        };

        this.ws.onclose = () => {
            console.warn('[Desktop] WebSocket connection closed. Attempting to reconnect...');
            this.reconnectSignalingServer();
        };

        this.ws.onerror = (error) => {
            console.error('[Desktop] WebSocket error:', error);
        };
    }

    /**
     * Creates a WebRTC offer and sends it to the mobile client via WebSocket.
     */
    createAndSendOffer() {
        if (!this.targetClientId) {
            console.error('[Desktop] No target clientId set. Cannot send offer.');
            return;
        }
    
        if (this.peerConnection) {
            console.warn('[Desktop] PeerConnection already exists.');
            return;
        }
    
        this.peerConnection = new RTCPeerConnection();
        console.log('[Desktop] PeerConnection created.');
    
        // Handle ICE candidate generation
        this.peerConnection.onicecandidate = (e) => {
            if (e.candidate) {
                console.log('[Desktop] Sending ICE Candidate:', e.candidate);
                this.ws.send(JSON.stringify({
                    type: 'candidate',
                    candidate: e.candidate,
                    targetClientId: this.targetClientId
                }));
            } else {
                console.log('[Desktop] ICE Candidate generation complete.');
            }
        };
    
        // Create and assign DataChannel
        this.dataChannel = this.peerConnection.createDataChannel('sensorData');
        console.log('[Desktop] DataChannel created.');
    
        // DataChannel event handling
        this.dataChannel.onopen = () => {
            console.log('[Desktop] DataChannel open and ready for communication.');
            this.startPingPong(); // Start ping-pong once DataChannel is open
            this.sendWelcomeMessage(); // Send initial welcome message
    
            // Optionally, send test data to verify communication
            this.sendTestData();
        };
    
        this.dataChannel.onmessage = (event) => {
            console.log(`[Desktop] DataChannel message received: ${event.data}`);
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'randomData') {
                    console.log(`[Desktop] Random data received: ${message.value}`);
                } else {
                    console.log(`[Desktop] Unknown data type: ${message.type}`);
                }
            } catch (error) {
                console.error(`[Desktop] Error parsing DataChannel message: ${event.data}`, error);
            }
        };
    
        this.dataChannel.onerror = (error) => console.error('[Desktop] DataChannel error:', error);
        this.dataChannel.onclose = () => console.log('[Desktop] DataChannel closed.');
    
        // Create SDP Offer
        this.peerConnection.createOffer()
            .then((offer) => {
                return this.peerConnection.setLocalDescription(offer);
            })
            .then(() => {
                console.log('[Desktop] Sending SDP Offer:', this.peerConnection.localDescription.sdp);
                this.ws.send(JSON.stringify({
                    type: 'offer',
                    offer: this.peerConnection.localDescription,
                    targetClientId: this.targetClientId
                }));
            })
            .catch((error) => console.error('[Desktop] Error creating SDP offer:', error));
    }

    /**
     * Reconnects to the signaling server in case of disconnection.
     */
    reconnectSignalingServer() {
        console.log('[Desktop] Attempting to reconnect to signaling server...');
        setTimeout(() => {
            this.initializeSignalingServer();
        }, 5000); // Retry after 5 seconds
    }

    /**
     * Sends a ping message to the mobile client to confirm the connection.
     */
    sendPing() {
        if (this.ws && this.targetClientId) {
            this.ws.send(JSON.stringify({ type: 'ping', targetClientId: this.targetClientId, message: 'Ping from desktop.' }));
            console.log('[Desktop] Ping sent to mobile client.');
        } else {
            console.warn('[Desktop] Cannot send ping. WebSocket or targetClientId not available.');
        }
    }

    /**
     * Starts the ping-pong mechanism to maintain the connection.
     */
    startPingPong() {
        // Send a ping every 30 seconds
        this.pingInterval = setInterval(() => {
            this.sendPing();
            // Set a timeout to check if pong is received
            this.pingTimeout = setTimeout(() => {
                console.warn('[Desktop] Pong not received within timeout. Reconnecting...');
                this.cleanupConnection();
                this.reconnectSignalingServer();
            }, 10000); // 10 seconds timeout
        }, 30000); // Every 30 seconds
    }

    /**
     * Stops the ping-pong mechanism.
     */
    stopPingPong() {
        if (this.pingInterval) clearInterval(this.pingInterval);
        if (this.pingTimeout) clearTimeout(this.pingTimeout);
    }

    /**
     * Sends a welcome message to the mobile client upon establishing the DataChannel.
     */
    sendWelcomeMessage() {
        const welcomeMessage = { type: 'welcome', message: 'Hello Mobile! Connection established.' };
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify(welcomeMessage));
            console.log('[Desktop] Welcome message sent to mobile client.');
        } else {
            console.warn('[Desktop] DataChannel not open. Cannot send welcome message.');
        }
    }

    /**
     * Handles incoming messages on the DataChannel.
     * @param {string} data - The received message data.
     */
/*     handleDataChannelMessage(data) {
        try {
            const message = JSON.parse(data);
            console.log('[Desktop] DataChannel Message:', message);

            switch (message.type) {
                case 'pong':
                    console.log('[Desktop] Pong received from mobile:', message.message);
                    // Reset the ping timeout
                    if (this.pingTimeout) {
                        clearTimeout(this.pingTimeout);
                        this.pingTimeout = null;
                    }
                    break;
                case 'sensorData':
                    console.log('[Desktop] Sensor Data received:', message.payload);
                    // Process sensor data here
                    this.processSensorData(message.payload);
                    break;
                case 'ack':
                    console.log('[Desktop] Acknowledgment received from mobile:', message.message);
                    break;
                default:
                    console.warn('[Desktop] Unknown DataChannel message type:', message.type);
            }
        } catch (error) {
            console.error('SensorController: Error parsing DataChannel message:', error);
        }
    }
 */
    /**
     * Processes incoming sensor data from the mobile client.
     * @param {Object} data - The sensor data received from the mobile client.
     */
/*     processSensorData(data) {
        if (data && data.orientation) {
            const { alpha, beta, gamma } = data.orientation;
            console.log(`SensorController: Received Sensor Data - alpha: ${alpha}, beta: ${beta}, gamma: ${gamma}`);
            // Update user1Manager or other components with the received data
            this.user1Manager.setNormalizedValue('x', alpha / 360); // Example normalization
            this.user1Manager.setNormalizedValue('y', beta / 360);
            this.user1Manager.setNormalizedValue('z', gamma / 360);
        } else {
            console.warn('SensorController: Invalid sensor data received:', data);
        }
    } */

    /**
     * Sends sensor data to the mobile client via DataChannel.
     * @param {Object} data - The sensor data to send.
     */
    sendSensorDataToMobile(data) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            console.log('[Desktop] Sending sensor data to mobile:', data); // Log outgoing data
            this.dataChannel.send(JSON.stringify({ type: 'sensorData', payload: data }));
            console.log('[Desktop] Sensor data sent:', data);
        } else {
            console.warn('[Desktop] DataChannel not open. Cannot send sensor data.');
        }
    }

    /**
     * Sends test data to the mobile client to verify DataChannel functionality.
     */
    sendTestData() {
        const testData = {
            test: 'This is a test message from desktop to mobile.',
            timestamp: Date.now()
        };
        this.sendSensorDataToMobile(testData);
    }

    /**
     * Cleans up the existing WebRTC connection.
     */
    cleanupConnection() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
            console.log('[Desktop] PeerConnection closed.');
        }
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
            console.log('[Desktop] DataChannel closed.');
        }
        this.targetClientId = null;
        this.stopPingPong();
    }

    /**
     * Handles changes to toggle states for sensor axes.
     * Updates the `activeAxes` state and manages sensor activation/deactivation.
     * @param {HTMLElement} toggle - The toggle element.
     * @param {string} axis - The axis ('x', 'y', or 'z') corresponding to the toggle.
     */
    handleToggleChange(toggle, axis) {
        const isActive = toggle.checked;

        console.debug(`[Toggle Debug] Toggle ID: ${toggle.id}, Axis: ${axis}, State: ${isActive}`);

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