// ModeManager.js
import { SensorController } from './SensorsController.js'; // Import the class
import notifications from './AppNotifications.js';
import { MIDIControllerInstance } from './MIDIController.js'; // Ensure MIDIController is properly exported
import { INTERNAL_SENSORS_USABLE, EXTERNAL_SENSORS_USABLE, setExternalSensorsUsable } from './Constants.js';
import { WebRTCManager } from './WebRTCManager.js';

export class ModeManager {
    constructor() {
        this.currentMode = 'JAM'; // default mode
        this.subscribers = [];
        this.modes = {};
    }

    registerMode(name, { onEnter, onExit }) {
        this.modes[name] = { onEnter, onExit };
    }
    activateMode(newMode) {
        // Check if the mode being activated is already active
        if (this.currentMode === newMode) {
            console.log(`[ModeManager] Mode "${newMode}" is already active. No action taken.`);
            return;
        }
    
        console.log(`[ModeManager] Switching mode from "${this.currentMode}" to "${newMode}".`);
    
        // Exit current mode
        const oldMode = this.currentMode;
        if (this.modes[oldMode] && this.modes[oldMode].onExit) {
            console.log(`[ModeManager] Exiting mode: ${oldMode}`);
            this.modes[oldMode].onExit();
        }
    
        // Set the new mode
        this.currentMode = newMode;
    
        // Enter new mode
        if (this.modes[newMode] && this.modes[newMode].onEnter) {
            console.log(`[ModeManager] Entering mode: ${newMode}`);
            this.modes[newMode].onEnter();
        } else {
            console.warn(`[ModeManager] No onEnter function defined for mode: ${newMode}`);
        }
    
        // Notify subscribers
        this.subscribers.forEach(cb => cb(newMode));
    }

    subscribe(callback) {
        this.subscribers.push(callback);
    }

    getActiveMode() {
        return this.currentMode;
    }
}

export const ModeManagerInstance = new ModeManager();

// Register all modes here
ModeManagerInstance.registerMode('JAM', {
    onEnter: () => {
        console.log('[ModeManager] Entered JAM mode.');
        notifications.showToast("Switched to Jam mode.");
        // Add any JAM mode-specific UI changes here
    },
    onExit: () => {
        console.log('[ModeManager] Exited JAM mode.');
        // Clean up JAM mode-specific UI changes here
    }
});

ModeManagerInstance.registerMode('MIDI_LEARN', {
    onEnter: async () => {
        console.log('[ModeManager] Entered MIDI_LEARN mode.');
        try {

            // Show sensor toggle buttons as part of MIDI Learn mode
            document.querySelectorAll('.xyz-sensors-toggle').forEach(button => {
                console.log(`Showing sensor toggle button: ${button.id}`);
                button.style.display = 'block';
            });
            
            if (MIDIControllerInstance) {
                await MIDIControllerInstance.activateMIDI();
                MIDIControllerInstance.enableMidiLearn();
                console.log('[ModeManager] MIDI Learn functionality enabled.');
                notifications.showToast("MIDI Learn mode activated.");
            } else {
                console.error('[ModeManager] MIDIControllerInstance is not available.');
                notifications.showToast("MIDI Controller is not available.", 'error');
            }


        } catch (error) {
            console.error('[ModeManager] Error activating MIDI Learn mode:', error);
            notifications.showToast("Error activating MIDI Learn mode.", 'error');
        }
    },
    onExit: () => {
        console.log('[ModeManager] Exited MIDI_LEARN mode.');
        if (MIDIControllerInstance) {
            MIDIControllerInstance.exitMidiLearnMode();
            console.log('[ModeManager] MIDI Learn functionality disabled.');
        }

        // Hide sensor toggle buttons when leaving MIDI Learn mode
        document.querySelectorAll('.xyz-sensors-toggle').forEach(button => {
            console.log(`Hiding sensor toggle button: ${button.id}`);
            button.style.display = 'none';
        });

        notifications.showToast("Exited MIDI Learn mode.");
    }
});
ModeManagerInstance.registerMode('SENSORS', {
    onEnter: async () => {
        console.log('[ModeManager] Entering SENSORS mode...');

        if (ModeManagerInstance.user1Manager) {
            const sensorController = SensorController.getInstance(ModeManagerInstance.user1Manager);
            const webRTCManager = WebRTCManager.getInstance((data) => {
                sensorController.setExternalSensorData(data);
            });

            if (INTERNAL_SENSORS_USABLE && SensorController.isSupported()) {
                console.log('[ModeManager] Activating internal sensors...');
                const permissionGranted = await sensorController.requestPermission();
                if (permissionGranted) {
                    await sensorController.activateSensors();
                    sensorController.switchSensorSource(false); // Internal sensors
                    notifications.showToast('Internal sensors activated.', 'success');
                } else {
                    console.warn('[ModeManager] Permission denied for internal sensors.');
                    notifications.showToast('Permission denied for internal sensors.', 'error');
                }
            } else if (!INTERNAL_SENSORS_USABLE && EXTERNAL_SENSORS_USABLE) {
                console.log('[ModeManager] Switching to external sensors via WebRTC...');
                sensorController.switchSensorSource(true); // External sensors
                if (webRTCManager) {
                    webRTCManager.generateConnectionModal();
                    notifications.showToast('Using external sensors via QR code.', 'info');
                } else {
                    console.error('[ModeManager] Failed to initialize WebRTCManager.');
                    notifications.showToast('Error initializing WebRTC Manager.', 'error');
                }
            } else {
                console.warn('[ModeManager] No sensors available.');
                notifications.showToast('No sensors detected.', 'warning');
            }

            document.querySelectorAll('.xyz-sensors-toggle').forEach(button => {
                button.style.display = 'block';
            });

            ModeManagerInstance.sensorControllerInstance = sensorController;
        } else {
            console.error('[ModeManager] user1Manager is not initialized.');
            notifications.showToast('Sensors cannot be activated.', 'error');
        }
    },
    onExit: () => {
        console.log('[ModeManager] Exiting SENSORS mode...');
        document.querySelectorAll('.xyz-sensors-toggle').forEach(button => {
            button.style.display = 'none';
        });
    }
});
ModeManagerInstance.registerMode('COSMIC_LFO', {
    onEnter: () => {
        console.log('[ModeManager] Entered COSMIC_LFO mode.');
        notifications.showToast("Cosmic LFO mode activated.");
        // Add any COSMIC_LFO mode-specific UI changes here
    },
    onExit: () => {
        console.log('[ModeManager] Exited COSMIC_LFO mode.');
        notifications.showToast("Exited Cosmic LFO mode.");
        // Clean up COSMIC_LFO mode-specific UI changes here
    }
});

// Optionally, set user1Manager here if it's globally accessible
// ModeManagerInstance.user1Manager = user1Manager; // Set it when user1Manager is available

// Initially start in JAM mode
ModeManagerInstance.activateMode('JAM');

// Subscribe to mode changes if needed elsewhere
ModeManagerInstance.subscribe((newMode) => {
    console.log(`[ModeManager] Mode changed to: ${newMode}`);
});