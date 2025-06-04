// WebRTCManager.js

import { UNIQUE_ID, isMobileDevice } from './Constants.js';
import QRCode from 'qrcode';
import notifications from './AppNotifications.js';
import { SensorController } from './SensorsController.js'; // Import the class

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

        // Basic properties
        this.ws = null;                // WebSocket instance
        this.peerConnection = null;    // Peer-to-peer RTCPeerConnection
        this.dataChannel = null;       // DataChannel for communication
        this.targetClientId = null;    // Mobile clientId to target for signaling
        this.clientId = null;          // This desktop's own clientId
        this.isConnected = false;      // Tracks if we have a live connection

        // We have removed the custom ping/pong to rely on ICE + DataChannel detection
        // So we do not keep pingInterval or pingTimeout for the disconnection logic

        // onSensorData callback if needed
        this.onSensorData = onSensorData;

        // Tracks if the standard “Connect External Sensor” modal has been shown once
        this.modalGenerated = false;

        // Possibly track if we have explicitly disconnected
        this.disconnectedMode = false;

        // Init
        this.initializeConnectionButton();
        this.initializeSignalingServer();
    }

    /**
     * Initializes the WebSocket to the signaling server & handles main events.
     */
    initializeSignalingServer() {
        const clientType = isMobileDevice() ? 'mobile' : 'desktop'; // Check device type

        if (isMobileDevice()) {
            console.log('[WebRTCManager] Mobile device detected. External connection is not needed.');
            return; // Do nothing for mobile, no external sensor needed
        }

        this.ws = new WebSocket('wss://connect.plantasia.space/ws/');

        this.ws.onopen = () => {
            console.log('[WebRTCManager] Connected to WebSocket server.');
            console.log(`[WebRTCManager] Sending registration as ${clientType} client.`);
            this.ws.send(JSON.stringify({ type: 'register', clientType, uniqueId: UNIQUE_ID }));
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log('[WebRTCManager] Message received from server:', message);

                switch (message.type) {
                    case 'registered':
                        console.log(`[WebRTCManager] Registered with server. Client ID: ${message.clientId}`);
                        this.clientId = message.clientId;
                        if (clientType === 'desktop') {
                            if (this.disconnectedMode) {
                                // Show disconnection modal if flagged as disconnected
                                this.generateDisconnectionModal();
                            } else {
                                this.generateConnectionModal();
                            }
                        }
                        break;

                    case 'mobileConnected':
                        console.log(`[WebRTCManager] Mobile client connected: ${message.clientId}`);
                        this.targetClientId = message.clientId;
                        this.isConnected = true;
                        // Clear disconnected flag, since we're connected again
                        this.disconnectedMode = false;
                        this.updateConnectionStatus();
                        notifications.closeModal();
                        console.log('[WebRTCManager] Connection modal closed.');
                        this.createAndSendOffer();
                        break;

                    case 'mobileDisconnected':
                        console.warn(`[WebRTCManager] Mobile client disconnected: ${message.clientId}`);
                        this.cleanupConnection();
                        this.isConnected = false;
                        this.disconnectedMode = true;
                        this.updateConnectionStatus();
                        notifications.showToast('Device disconnected.', 'warning');
                        this.generateDisconnectionModal();
                        break;

                    case 'answer':
                        console.log('[WebRTCManager] Received SDP Answer:', message.answer.sdp);
                        if (this.peerConnection) {
                            this.peerConnection.setRemoteDescription(
                                new RTCSessionDescription(message.answer)
                            ).then(() => {
                                console.log('[WebRTCManager] Remote description set successfully.');
                            }).catch(err => {
                                console.error('[WebRTCManager] Error setting remote description:', err);
                            });
                        } else {
                            console.error('[WebRTCManager] PeerConnection not initialized.');
                        }
                        break;

                    case 'candidate':
                        console.log('[WebRTCManager] Received ICE Candidate:', message.candidate);
                        if (this.peerConnection) {
                            this.peerConnection.addIceCandidate(
                                new RTCIceCandidate(message.candidate)
                            ).then(() => {
                                console.log('[WebRTCManager] ICE Candidate added successfully.');
                            }).catch(err => {
                                console.error('[WebRTCManager] Error adding ICE Candidate:', err);
                            });
                        } else {
                            console.error('[WebRTCManager] PeerConnection not initialized.');
                        }
                        break;

                    case 'pong':
                        console.log('[WebRTCManager] Pong received from mobile:', message.message);
                        // We no longer keep pingTimeout or pingInterval, so do nothing
                        break;

                    case 'error':
                        console.error(`[WebRTCManager] Server Error: ${message.message}`);
                        if (message.message.includes('Another instance has connected')) {
                            // Treat like a forced disconnection
                            this.cleanupConnection();
                            this.isConnected = false;
                            this.disconnectedMode = true;
                            notifications.showToast('Connection lost: Another instance connected.', 'error');
                            this.generateDisconnectionModal();
                        }
                        break;

                    default:
                        console.warn('[WebRTCManager] Unknown message type:', message.type);
                }
            } catch (error) {
                console.error('[WebRTCManager] Error parsing WebSocket message:', event.data, error);
            }
        };

        // If the WS closes unexpectedly, treat it like a disconnection
        this.ws.onclose = () => {
            console.warn('[WebRTCManager] WebSocket connection closed. Attempting to reconnect...');
            if (this.isConnected) {
                this.cleanupConnection();
                this.isConnected = false;
                this.disconnectedMode = true;
                notifications.showToast('Connection lost.', 'warning');
                this.generateDisconnectionModal();
            }
            this.reconnectSignalingServer();
        };

        this.ws.onerror = (error) => {
            console.error('[WebRTCManager] WebSocket error:', error);
        };
    }

    /**
     * If you want to show sensor toggles or connect external sensors, use this.
     * (Retained from your original code.)
     */
    async manageSensors() {
        if (this.useInternalSensors && SensorController.isSupported()) {
            console.log('SensorController: Attempting to activate internal sensors...');
            const permissionGranted = await this.requestPermission();
            if (permissionGranted) {
                await this.activateSensors();
                notifications.showToast('Internal sensors activated.', 'success');
            } else {
                console.warn('SensorController: Permission denied for internal sensors.');
                notifications.showToast('Permission denied for internal sensors.', 'error');
            }
        } else if (this.useExternalSensors) {
            console.log('SensorController: No internal sensors detected, showing connection modal...');
            const webRTCManager = WebRTCManager.getInstance();
            // webRTCManager.generateConnectionModal();
        } else {
            console.warn('SensorController: No usable sensors detected.');
            notifications.showToast('No sensors available.', 'warning');
        }
    }

    /**
     * Shows the "Connect External Sensor" modal with a QR code.
     */
    generateConnectionModal(force = false) {
        if (this.isConnected) {
            console.log('[WebRTCManager] Connection already established. Modal not shown.');
            return;
        }
        if (!force && this.modalGenerated) {
            console.log('[WebRTCManager] Connection modal has already been generated.');
            return;
        }

        console.log('[WebRTCManager] Attempting to generate connection modal...');

        if (!this.clientId) {
            console.warn('[WebRTCManager] clientId not yet available. Retrying...');
            setTimeout(() => this.generateConnectionModal(force), 500);
            return;
        }
        if (!force) {
            this.modalGenerated = true;
        }

        const baseUrl = 'https://connect.plantasia.space/';
        const wsUrl = 'wss://connect.plantasia.space/ws/';
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
                    .then(() => {
                        console.log('[WebRTCManager] Modal closed.');
                    });
            })
            .catch((error) => {
                console.error('[WebRTCManager] Error generating QR code:', error);
                notifications.showToast('Error generating QR code.', 'error');
            });
    }

    /**
     * Shows the "Reconnect External Sensor" modal with different text.
     */
    generateDisconnectionModal() {
        console.log('[WebRTCManager] Generating disconnection modal...');
        notifications.closeModal();

        if (!this.clientId) {
            console.warn('[WebRTCManager] clientId not available. Retrying...');
            setTimeout(() => this.generateDisconnectionModal(), 500);
            return;
        }

        const baseUrl = 'https://connect.plantasia.space/';
        const wsUrl = 'wss://connect.plantasia.space/ws/';
        const uniqueId = UNIQUE_ID;

        const pairingInfo = `${baseUrl}?uniqueId=${uniqueId}&wsUrl=${encodeURIComponent(wsUrl)}`;
        console.log(`[WebRTCManager] Disconnection pairing info: ${pairingInfo}`);

        QRCode.toDataURL(pairingInfo, { width: 150 })
            .then((url) => {
                console.log('[WebRTCManager] Disconnection QR Code generated:', url);

                const modalContent = `
                  <div style="text-align: center; padding: 15px;">
                    <p style="margin-bottom: 10px; font-weight: bold;">Mobile Device Disconnected</p>
                    <p style="margin-bottom: 10px;">
                      Your mobile device has been disconnected.<br>
                      Please refresh your mobile device or re-open the connection to reconnect.
                    </p>
                    <img src="${url}" alt="QR Code" style="display: block; margin: 0 auto; max-width: 150px; height: auto;" />
                    <p style="margin-top: 10px; font-size: 12px; word-break: break-word; color: #555;">
                      Or enter this URL manually:<br>
                      <a href="${pairingInfo}" target="_blank" style="color: #007bff;">${pairingInfo}</a>
                    </p>
                  </div>
                `;

                notifications
                    .showUniversalModal('Reconnect External Sensor', modalContent, 'Close')
                    .then(() => {
                        console.log('[WebRTCManager] Disconnection modal closed.');
                    });
            })
            .catch((error) => {
                console.error('[WebRTCManager] Error generating disconnection QR code:', error);
                notifications.showToast('Error generating disconnection QR code.', 'error');
            });
    }

    /**
     * The "Connect/Disconnect" button event: always shows connection modal for user to re-initiate.
     */
    handleConnectionButtonClick() {
        console.log('[WebRTCManager] Connection button clicked. Showing connection modal.');
        // Clear the disconnection flag if any
        this.disconnectedMode = false;
        this.generateConnectionModal(true);
    }

    /**
     * Creates a RTCPeerConnection and sends an offer to the mobile.
     */
    createAndSendOffer() {
        if (!this.targetClientId) {
            console.error('[WebRTCManager] No targetClientId set. Cannot send offer.');
            return;
        }
        if (this.peerConnection) {
            console.warn('[WebRTCManager] PeerConnection already exists.');
            return;
        }

        this.peerConnection = new RTCPeerConnection();
        console.log('[WebRTCManager] PeerConnection created.');

        // 1) ICE candidates
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

        // 2) ICE connection state: if we get disconnected/failed, we do immediate cleanup
        this.peerConnection.oniceconnectionstatechange = () => {
            const state = this.peerConnection.iceConnectionState;
            console.log('[WebRTCManager] ICE Connection State changed to:', state);
            if (state === 'disconnected' || state === 'failed') {
                console.warn('[WebRTCManager] ICE disconnected/failed -> cleanup + disconnection modal');
                this.cleanupConnection();
                this.disconnectedMode = true;
                notifications.showToast('Connection lost.', 'warning');
                this.generateDisconnectionModal();
            }
        };

        // 3) Create DataChannel
        this.dataChannel = this.peerConnection.createDataChannel('sensorData');
        console.log('[WebRTCManager] DataChannel created.');

        // 4) DataChannel event handling
        this.dataChannel.onopen = () => {
            console.log('[WebRTCManager] DataChannel open and ready for communication.');
            this.sendWelcomeMessage(); // Send initial welcome message
        };
        this.dataChannel.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleDataChannelMessage(message);
            } catch (err) {
                console.error('[WebRTCManager] Error parsing DataChannel msg:', err);
            }
        };
        this.dataChannel.onerror = (error) => {
            console.error('[WebRTCManager] DataChannel error:', error);
        };
        this.dataChannel.onclose = () => {
            console.warn('[WebRTCManager] DataChannel closed -> cleanup + disconnection modal');
            this.cleanupConnection();
            this.disconnectedMode = true;
            notifications.showToast('Connection lost.', 'warning');
            this.generateDisconnectionModal();
        };

        // 5) Create SDP Offer
        this.peerConnection.createOffer()
            .then((offer) => this.peerConnection.setLocalDescription(offer))
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
     * The Connection button in your UI, also calls updateConnectionStatus, etc.
     */
    initializeConnectionButton() {
        this.statusButton = document.getElementById('connectionStatus');
        this.iconSpan = document.getElementById('connectionStatusIcon');
        this.textSpan = document.getElementById('connectionStatusText');

        if (!this.statusButton || !this.iconSpan || !this.textSpan) {
            console.error('[WebRTCManager] Button or elements missing in DOM.');
            return;
        }

        if (isMobileDevice()) {
            console.log('[WebRTCManager] Mobile device detected. Hiding connection button.');
            this.statusButton.style.display = 'none';
            return;
        }

        console.log('[WebRTCManager] Desktop device detected. Initializing connection button.');
        this.statusButton.removeEventListener('click', this.handleConnectionButtonClick.bind(this));
        this.statusButton.addEventListener('click', this.handleConnectionButtonClick.bind(this));
        this.updateConnectionStatus();
    }

    toggleConnection() {
        if (this.isConnected) {
            this.cleanupConnection();
        } else {
            this.createAndSendOffer();
        }
        this.updateConnectionStatus();
    }

    /**
     * Refresh your button icon/color depending on isConnected.
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

        this.statusButton.setAttribute('aria-label', config.label);
        this.textSpan.textContent = config.text;
        this.statusButton.style.color = config.color;
        this.loadSVGIcon(config.iconPath);
    }

    /**
     * Dynamically load an SVG into the icon span.
     */
    loadSVGIcon(src) {
        fetch(src)
            .then((response) => {
                if (!response.ok) throw new Error(`Failed to load SVG: ${src}`);
                return response.text();
            })
            .then((svgContent) => {
                this.iconSpan.innerHTML = svgContent;
            })
            .catch((error) => {
                console.error(`[WebRTCManager] Error loading SVG: ${error}`);
                this.iconSpan.innerHTML = '<span class="icon-placeholder">⚠️</span>';
            });
    }

    /**
     * DataChannel message parsing: sensorData, ack, etc.
     */
    handleDataChannelMessage(message) {
        console.log('[WebRTCManager] Message type:', message.type);
        switch (message.type) {
            case 'sensorData':
                this.processExternalSensorData(message.payload);
                break;
            case 'pong':
                // In the new approach, we are not using custom ping/pong
                // But if the server or mobile sends 'pong', we can log it:
                console.log('[WebRTCManager] Received a "pong" datachannel message:', message.message);
                break;
            case 'ack':
                console.log('[WebRTCManager] Acknowledgment received:', message.message);
                break;
            default:
                console.warn('[WebRTCManager] Unknown message type:', message.type);
        }
    }

    /**
     * For passing sensor data to your SensorController if needed.
     */
    processExternalSensorData(payload) {
        if (!payload || typeof payload !== 'object') {
            console.warn('[WebRTCManager] Invalid sensor data payload:', payload);
            return;
        }
        const { alpha, beta, gamma } = payload;
        const sensorData = {
            alpha: typeof alpha === 'number' ? alpha : 0,
            beta: typeof beta === 'number' ? beta : 0,
            gamma: typeof gamma === 'number' ? gamma : 0
        };
        try {
            const sensorController = SensorController.getInstance();
            sensorController.setExternalSensorData(sensorData);
        } catch (error) {
            console.error('[WebRTCManager] Failed to update SensorController:', error.message);
        }
    }

    /**
     * If the server forcibly closes or we want to attempt a new connection.
     */
    reconnectSignalingServer() {
        console.log('[WebRTCManager] Attempting to reconnect to signaling server...');
        setTimeout(() => {
            this.initializeSignalingServer();
        }, 5000);
    }

    /**
     * Optionally send a welcome message on the data channel, if needed.
     */
    sendWelcomeMessage() {
        const welcomeMessage = { type: 'welcome', message: 'Hello Mobile! Connection established.' };
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify(welcomeMessage));
            console.log('[WebRTCManager] Welcome message sent to mobile client.');
        } else {
            console.warn('[WebRTCManager] DataChannel not open. Cannot send welcome message yet.');
        }
    }

    /**
     * Test function to send data if needed.
     */
    sendSensorDataToMobile(data) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            console.log('[WebRTCManager] Sending sensor data to mobile:', data);
            this.dataChannel.send(JSON.stringify({ type: 'sensorData', payload: data }));
        } else {
            console.warn('[WebRTCManager] DataChannel not open. Cannot send sensor data.');
        }
    }

    /**
     * Example testing method
     */
    sendTestData() {
        const testData = { test: 'Test message from desktop to mobile.', timestamp: Date.now() };
        this.sendSensorDataToMobile(testData);
    }

    /**
     * Cleans up the existing WebRTC connection, DataChannel, etc.
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
        this.isConnected = false;

        // We no longer do ping/pong, so no need to stop intervals
        // if you had them, you could do this:
        // this.stopPingPong(); 
        // But they were removed to rely on ICE & DataChannel

        this.updateConnectionStatus();
        // Reset the modal so that user can see a new QR if needed
        this.modalGenerated = false;
    }
}