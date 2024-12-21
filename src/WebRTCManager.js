// WebRTCManager.js

import { UNIQUE_ID } from './Constants.js';
import QRCode from 'qrcode';
import notifications from './AppNotifications.js';


/**
 * @class WebRTCManager
 * @description Handles WebSocket signaling, WebRTC connections, DataChannel communication, and external sensor integration.
 */
export class WebRTCManager {
    // Private static instance variable
    static #instance = null;

    /**
     * Returns the singleton instance of WebRTCManager.
     * @param {Function} onSensorData - Callback function to handle incoming sensor data.
     * @returns {WebRTCManager} The singleton instance.
     */
    static getInstance(onSensorData) {
        if (!WebRTCManager.#instance) {
            WebRTCManager.#instance = new WebRTCManager(onSensorData);
        }
        return WebRTCManager.#instance;
    }

    /**
     * Private constructor to prevent direct instantiation.
     * @param {Function} onSensorData - Callback function to handle incoming sensor data.
     */
    constructor(onSensorData) {
        if (WebRTCManager.#instance) {
            throw new Error('Use WebRTCManager.getInstance() to get the singleton instance.');
        }

        // Initialize properties
        this.ws = null; // WebSocket instance
        this.peerConnection = null; // Peer-to-peer connection instance
        this.dataChannel = null; // DataChannel for communication
        this.targetClientId = null; // Mobile clientId to target for signaling
        this.clientId = null; // Desktop's own clientId
        this.isConnected = false; // Tracks the connection state

        // Ping-Pong mechanism variables
        this.pingInterval = null;
        this.pingTimeout = null;

        // Callback for handling incoming sensor data
        this.onSensorData = onSensorData;


        this.initializeConnectionButton();

        // Initialize WebSocket signaling server connection
        this.initializeSignalingServer();
    }

    /**
     * Initializes the WebSocket signaling server connection and handles WebRTC setup.
     */
    initializeSignalingServer() {
        this.ws = new WebSocket('wss://connect.maar.world/ws/');

        this.ws.onopen = () => {
            console.log('[WebRTCManager] Connected to WebSocket server.');
            console.log('[WebRTCManager] Sending registration as desktop client.');
            this.ws.send(JSON.stringify({ type: 'register', clientType: 'desktop', uniqueId: UNIQUE_ID }));
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log('[WebRTCManager] Message received from server:', message);

                switch (message.type) {
                    case 'registered':
                        console.log(`[WebRTCManager] Registered with server. Client ID: ${message.clientId}`);
                        this.clientId = message.clientId;
                        // Automatically generate the QR code after registration
                        this.generateConnectionModal();
                        break;

                        case 'mobileConnected':
                            console.log(`[WebRTCManager] Mobile client connected: ${message.clientId}`);
                            this.targetClientId = message.clientId;
                            this.isConnected = true; // Update connection state
                            this.updateConnectionStatus();

                            notifications.closeModal(); // Close the modal
                            console.log('[WebRTCManager] Connection modal closed.');
                            notifications.showToast('Device successfully connected as an external sensor.', 'success');
                            this.createAndSendOffer(); // Proceed to create WebRTC offer
                            break;
                        
                        case 'mobileDisconnected':
                            console.warn(`[WebRTCManager] Mobile client disconnected: ${message.clientId}`);
                            this.cleanupConnection();
                            this.isConnected = false;
                            this.updateConnectionStatus();
                            notifications.showToast('Device disconnected.', 'warning');
                            break;
                    case 'answer':
                        console.log('[WebRTCManager] Received SDP Answer from mobile:', message.answer.sdp);
                        if (this.peerConnection) {
                            this.peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer))
                                .then(() => console.log('[WebRTCManager] Remote description set successfully.'))
                                .catch((err) => console.error('[WebRTCManager] Error setting remote description:', err));
                        } else {
                            console.error('[WebRTCManager] PeerConnection not initialized.');
                        }
                        break;

                    case 'candidate':
                        console.log('[WebRTCManager] Received ICE Candidate from mobile:', message.candidate);
                        if (this.peerConnection) {
                            this.peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate))
                                .then(() => console.log('[WebRTCManager] ICE Candidate added successfully.'))
                                .catch((err) => console.error('[WebRTCManager] Error adding ICE Candidate:', err));
                        } else {
                            console.error('[WebRTCManager] PeerConnection not initialized.');
                        }
                        break;

                    case 'pong':
                        console.log('[WebRTCManager] Pong received from mobile:', message.message);
                        notifications.showToast('Connection confirmed with mobile device.', 'success');
                        // Reset the ping timeout
                        if (this.pingTimeout) {
                            clearTimeout(this.pingTimeout);
                            this.pingTimeout = null;
                        }
                        break;

                    case 'error':
                        console.error(`[WebRTCManager] Server Error: ${message.message}`);
                        break;


                    default:
                        console.warn('[WebRTCManager] Unknown message type:', message.type);
                }
            } catch (error) {
                console.error('[WebRTCManager] Error parsing WebSocket message:', event.data, error);
            }
        };

        this.ws.onclose = () => {
            console.warn('[WebRTCManager] WebSocket connection closed. Attempting to reconnect...');
            this.reconnectSignalingServer();
        };

        this.ws.onerror = (error) => {
            console.error('[WebRTCManager] WebSocket error:', error);
        };
    }
    /**
     * Activates the sensors or triggers external connection modal based on availability.
     * @async
     */
    async manageSensors() {
        if (this.useInternalSensors && SensorController.isSupported()) {
            console.log('SensorController: Internal sensors available, attempting to activate.');
            const permissionGranted = await this.requestPermission();
            if (permissionGranted) {
                this.activateSensors();
                notifications.showToast('Internal sensors activated.', 'success');
            } else {
                console.warn('SensorController: Permission denied for internal sensors.');
                notifications.showToast('Permission denied for sensors.', 'error');
            }
        } else if (this.useExternalSensors) {
            console.log('SensorController: No internal sensors detected, showing connection modal.');
            const webRTCManager = WebRTCManager.getInstance(); // Import and use WebRTCManager
            webRTCManager.generateConnectionModal(); // Trigger modal for external sensor pairing
        } else {
            console.warn('SensorController: No usable sensors detected.');
            notifications.showToast('No sensors available for connection.', 'warning');
        }
    }
    /**
     * Generates a connection modal with a QR code for pairing the mobile device.
     * This function should be called after the desktop has received its clientId from the server.
     */
    generateConnectionModal() {

        if (this.isConnected) {
            console.log('[WebRTCManager] Connection already established. Modal not shown.');
            return;
        }

        console.log('[WebRTCManager] Attempting to generate connection modal...');
    
        // Check if clientId is available
        if (!this.clientId) {
            console.warn('[WebRTCManager] clientId not yet available. Retrying QR code generation...');
            setTimeout(() => this.generateConnectionModal(), 500); // Retry after 500ms
            return;
        }
    
        // Proceed with QR code generation if clientId is available
        const baseUrl = 'https://connect.maar.world/';
        const wsUrl = 'wss://connect.maar.world/ws/';
        const uniqueId = UNIQUE_ID;
    
        const pairingInfo = `${baseUrl}?uniqueId=${uniqueId}&wsUrl=${encodeURIComponent(wsUrl)}`;
        console.log(`[WebRTCManager] Pairing info: ${pairingInfo}`);
    
        QRCode.toDataURL(pairingInfo, { width: 150 })
            .then((url) => {
                console.log('[WebRTCManager] QR Code successfully generated:', url);
    
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
    
                notifications
                    .showUniversalModal('Connect External Sensor', modalContent, 'Close')
                    .then(() => console.log('[WebRTCManager] Modal closed.'));
            })
            .catch((error) => {
                console.error('[WebRTCManager] Error generating QR Code:', error);
                notifications.showToast('Error generating QR Code.', 'error');
            });
    }

    /**
 * Handle connection button clicks.
 * Always shows the connection modal when clicked, without disconnecting.
 */
handleConnectionButtonClick() {
    console.log('[WebRTCManager] Connection button clicked. Showing connection modal.');
    this.generateConnectionModal();
}


    /**
     * Creates a WebRTC offer and sends it to the mobile client via WebSocket.
     */
    createAndSendOffer() {
        if (!this.targetClientId) {
            console.error('[WebRTCManager] No target clientId set. Cannot send offer.');
            return;
        }
    
        if (this.peerConnection) {
            console.warn('[WebRTCManager] PeerConnection already exists.');
            return;
        }
    
        this.peerConnection = new RTCPeerConnection();
        console.log('[WebRTCManager] PeerConnection created.');
    
        // Handle ICE candidate generation
        this.peerConnection.onicecandidate = (e) => {
            if (e.candidate) {
                console.log('[WebRTCManager] Sending ICE Candidate:', e.candidate);
                this.ws.send(JSON.stringify({
                    type: 'candidate',
                    candidate: e.candidate,
                    targetClientId: this.targetClientId
                }));
            } else {
                console.log('[WebRTCManager] ICE Candidate generation complete.');
            }
        };
    
        // Create and assign DataChannel
        this.dataChannel = this.peerConnection.createDataChannel('sensorData');
        console.log('[WebRTCManager] DataChannel created.');
    
        // DataChannel event handling
        this.dataChannel.onopen = () => {
            console.log('[WebRTCManager] DataChannel open and ready for communication.');
            this.startPingPong(); // Start ping-pong once DataChannel is open
            this.sendWelcomeMessage(); // Send initial welcome message
        };
    
        this.dataChannel.onmessage = (event) => {
            console.log(`[WebRTCManager] DataChannel message received: ${event.data}`);
            try {
                const message = JSON.parse(event.data);
                this.handleDataChannelMessage(message);
            } catch (error) {
                console.error(`[WebRTCManager] Error parsing DataChannel message: ${event.data}`, error);
            }
        };
    
        this.dataChannel.onerror = (error) => console.error('[WebRTCManager] DataChannel error:', error);
        this.dataChannel.onclose = () => console.log('[WebRTCManager] DataChannel closed.');
    
        // Create SDP Offer
        this.peerConnection.createOffer()
            .then((offer) => {
                return this.peerConnection.setLocalDescription(offer);
            })
            .then(() => {
                console.log('[WebRTCManager] Sending SDP Offer:', this.peerConnection.localDescription.sdp);
                this.ws.send(JSON.stringify({
                    type: 'offer',
                    offer: this.peerConnection.localDescription,
                    targetClientId: this.targetClientId
                }));
            })
            .catch((error) => console.error('[WebRTCManager] Error creating SDP offer:', error));
    }
/**
 * Initialize the connection button and attach the click listener.
 */
initializeConnectionButton() {
    this.statusButton = document.getElementById('connectionStatus');
    this.iconSpan = document.getElementById('connectionStatusIcon');
    this.textSpan = document.getElementById('connectionStatusText');

    if (!this.statusButton || !this.iconSpan || !this.textSpan) {
        console.error('[WebRTCManager] Button or elements missing in DOM.');
        return;
    }

    // Ensure the click event listener is attached
    this.statusButton.removeEventListener('click', this.handleConnectionButtonClick.bind(this));
    this.statusButton.addEventListener('click', this.handleConnectionButtonClick.bind(this));

    this.updateConnectionStatus();
}

    /**
     * Toggle connection state.
     */
    toggleConnection() {
        if (this.isConnected) {
            this.cleanupConnection();
        } else {
            this.createAndSendOffer();
        }
    
        // Explicitly update the connection status
        this.updateConnectionStatus();
    }

    /**
     * Update button appearance and state based on connection status.
     */
    updateConnectionStatus() {
        const config = this.isConnected
            ? {
                iconPath: '/assets/icons/ext-mobile-connect.svg',
                color: '#4CAF50',
                label: 'Device Connected',
                text: ''
            }
            : {
                iconPath: '/assets/icons/ext-mobile-disconnect.svg',
                color: '#F44336',
                label: 'Device Disconnected',
                text: ''
            };

        // Update button text and label
        this.statusButton.setAttribute('aria-label', config.label);
        this.textSpan.textContent = config.text;
        this.statusButton.style.color = config.color;

        // Load and inject SVG icon
        this.loadSVGIcon(config.iconPath);
    }

    /**
     * Load SVG dynamically into the button icon span.
     * @param {string} src - SVG file path.
     */
    loadSVGIcon(src) {
        fetch(src)
            .then(response => {
                if (!response.ok) throw new Error(`Failed to load SVG: ${src}`);
                return response.text();
            })
            .then(svgContent => {
                this.iconSpan.innerHTML = svgContent;
            })
            .catch(error => {
                console.error(`[WebRTCManager] Error loading SVG: ${error}`);
                this.iconSpan.innerHTML = '<span class="icon-placeholder">⚠️</span>';
            });
    }


/**
     * Handles incoming messages on the DataChannel.
     * @param {Object} message - The received message object.
     */
    handleDataChannelMessage(message) {
        switch (message.type) {
            case 'pong':
                console.log('[WebRTCManager] Pong received from mobile:', message.message);
                // Reset the ping timeout
                if (this.pingTimeout) {
                    clearTimeout(this.pingTimeout);
                    this.pingTimeout = null;
                }
                break;
            case 'sensorData':
                console.log('[WebRTCManager] Sensor Data received:', message.payload);
                // Invoke callback to handle sensor data
                if (this.onSensorData) {
                    this.onSensorData(message.payload);
                }
                break;
            case 'ack':
                console.log('[WebRTCManager] Acknowledgment received from mobile:', message.message);
                break;
            default:
                console.warn('[WebRTCManager] Unknown DataChannel message type:', message.type);
        }
    }

    /**
     * Reconnects to the signaling server in case of disconnection.
     */
    reconnectSignalingServer() {
        console.log('[WebRTCManager] Attempting to reconnect to signaling server...');
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
            console.log('[WebRTCManager] Ping sent to mobile client.');
        } else {
            console.warn('[WebRTCManager] Cannot send ping. WebSocket or targetClientId not available.');
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
                console.warn('[WebRTCManager] Pong not received within timeout. Reconnecting...');
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
            console.log('[WebRTCManager] Welcome message sent to mobile client.');
        } else {
            console.warn('[WebRTCManager] DataChannel not open. Cannot send welcome message.');
        }
    }

    /**
     * Sends sensor data to the mobile client via DataChannel.
     * @param {Object} data - The sensor data to send.
     */
    sendSensorDataToMobile(data) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            console.log('[WebRTCManager] Sending sensor data to mobile:', data); // Log outgoing data
            this.dataChannel.send(JSON.stringify({ type: 'sensorData', payload: data }));
            console.log('[WebRTCManager] Sensor data sent:', data);
        } else {
            console.warn('[WebRTCManager] DataChannel not open. Cannot send sensor data.');
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
            console.log('[WebRTCManager] PeerConnection closed.');
        }
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
            console.log('[WebRTCManager] DataChannel closed.');
        }
        this.targetClientId = null;
        this.stopPingPong();
    
        this.isConnected = false;
        this.updateConnectionStatus();
    
    }


}