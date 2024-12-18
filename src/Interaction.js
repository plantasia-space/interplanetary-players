// src/Interaction.js

/**
 * @file Interaction.js
 * @description Sets up interactions for dynamic placeholder updates, button groups, handles MIDI registrations, and applies UI color configurations based on track data.
 * @version 2.0.0
 * @license MIT
 * @date 2024-12-07
 */

import { ModeManagerInstance } from './ModeManager.js';
import { ButtonGroup } from './ButtonGroup.js';
import { MIDIControllerInstance } from './MIDIController.js';
import { MIDI_SUPPORTED, SENSORS_SUPPORTED, INTERNAL_SENSORS_USABLE, EXTERNAL_SENSORS_USABLE  } from './Constants.js'; // Ensure SENSORS_SUPPORTED is defined
import notifications from './AppNotifications.js';
import { SensorController } from './SensorsController.js'; // Import the class instead of instance

/**
 * Sets up interactions for dynamic placeholder updates.
 * Initializes ButtonGroups and registers MIDI controllers if supported.
 * @memberof CoreModule 
 * @function setupInteractions
 * @param {DataManager} dataManager - The shared DataManager instance.
 * @param {AudioPlayer} audioPlayer - The shared AudioPlayer instance.
 * @param {User1Manager} user1Manager - The user manager instance.
 * @returns {void}
 * @throws Will log an error if Bootstrap is not loaded.
 */
export function setupInteractions(dataManager, audioPlayer, user1Manager) {
    if (typeof bootstrap === 'undefined') {
        console.error('Bootstrap is not loaded. Ensure bootstrap.bundle.min.js is included.');
        return;
    }

    // Assign user1Manager to ModeManager for access within mode hooks
    ModeManagerInstance.user1Manager = user1Manager;

    // Initialize all button groups
    const buttonGroups = [];
    document.querySelectorAll('.button-group-container').forEach(group => {
        const groupType = group.getAttribute('data-group');

        const buttonGroup = new ButtonGroup(
            `.button-group-container[data-group="${groupType}"]`, // containerSelector
            'ul.dropdown-menu',                                    // dropdownSelector
            'button.dropdown-toggle',                             // buttonSelector
            'a.dropdown-item',                                    // menuItemsSelector
            '.button-icon',                                       // iconSelector
            audioPlayer,                                          // audioPlayer
            dataManager,                                           // dataManager
            user1Manager
        );
        buttonGroups.push(buttonGroup);
    });

    // Register dropdown items with MIDIController for MIDI interactions
    if (MIDI_SUPPORTED && MIDIControllerInstance) {
        registerMenuItemsWithMIDIController(buttonGroups);
    } else {
        console.warn('MIDI is not supported in this environment. Skipping MIDI setup.');
    }


    const connectExternalSensor = document.getElementById('connect-external-sensor');
    if (connectExternalSensor) {
        connectExternalSensor.addEventListener('click', () => {
            const sensorController = SensorController.getInstance(user1Manager);
            sensorController.activateSensors();
        });
    }


}

/**
 * Registers all dropdown items in the initialized ButtonGroups with MIDIController.
 * Ensures that MIDI interactions are properly linked to the corresponding UI elements.
 * @memberof CoreModule 
 * @private
 * @param {Array<ButtonGroup>} buttonGroups - List of initialized ButtonGroup instances.
 * @returns {void}
 */
function registerMenuItemsWithMIDIController(buttonGroups) {
    const midiController = MIDIControllerInstance;

    // Register each button group menu item
    buttonGroups.forEach(buttonGroup => {
        buttonGroup.menuItems.forEach(item => {
            const itemId = item.id || item.getAttribute('data-value');
            if (itemId) {
                midiController.registerWidget(itemId, item);
                console.log(`[MIDIController] Registered widget: ${itemId}`);
            } else {
                console.warn("Menu item missing 'id' or 'data-value' attribute:", item);
            }
        });
    });
}

/**
 * Applies color configurations to the document based on track data.
 * Updates CSS variables and redraws UI components to reflect new colors.
 * @memberof CoreModule 
 * @function applyColorsFromTrackData
 * @param {object} trackData - The track data containing color information.
 * @returns {void}
 */
export function applyColorsFromTrackData(trackData) {
    if (!trackData || !trackData.soundEngine || !trackData.soundEngine.soundEngineColors) {
        console.warn('[COLORS] No color data available in track data.');
        return;
    }

    const { color1, color2 } = trackData.soundEngine.soundEngineColors;

    // Update CSS variables for colors
    if (color1) {
        document.documentElement.style.setProperty('--color1', color1);
        //console.log(`[COLORS] Set --color1 to ${color1}`);
    }

    if (color2) {
        document.documentElement.style.setProperty('--color2', color2);
        //console.log(`[COLORS] Set --color2 to ${color2}`);
    }

    // Update all knobs, sliders, and switches
    document.querySelectorAll('webaudio-knob').forEach(knob => knob.setupImage());
    document.querySelectorAll('webaudio-slider').forEach(slider => {
        slider.setupCanvas();
        slider.redraw();
    });
    document.querySelectorAll('webaudio-switch').forEach(webSwitch => {
        webSwitch.setupCanvas();
        webSwitch.redraw();
    });

    //console.log('[COLORS] Applied colors from track data to UI components.');
}

/**
 * Dynamically creates and updates knobs based on track data.
 * Configures UI components for sound engine parameters.
 * @memberof CoreModule 
 * @function updateKnobsFromTrackData
 * @param {object} trackData - The track data containing sound engine parameters.
 * @returns {void}
 * @throws Will log an error if track data or sound engine information is missing.
 */
export function updateKnobsFromTrackData(trackData) {
    if (!trackData || !trackData.soundEngine) {
        console.error('No valid track data or sound engine information found.');
        return;
    }

    // Extract x, y, z parameters from the track data
    const { x, y, z } = trackData.soundEngine.soundEngineParams;

    // Map parameters to their respective containers
    const paramsToContainers = {
        x: document.getElementById('xKnobContainer'),
        y: document.getElementById('yKnobContainer'),
        z: document.getElementById('zKnobContainer'),
    };

    Object.entries({ x, y, z }).forEach(([paramKey, param]) => {
        const container = paramsToContainers[paramKey];

        if (!container) {
            console.warn(`Container for ${paramKey} not found.`);
            return;
        }

        // Clear existing knob if any
        container.innerHTML = '';

        if (!param) {
            console.warn(`Parameter '${paramKey}' is missing or undefined in sound engine data.`);
            return;
        }

        // Create knob element
        const knob = document.createElement('webaudio-knob');
        knob.id = `${paramKey}Knob`;
        knob.className = 'xyz-knobs';
        knob.setAttribute('root-param', paramKey);
        knob.setAttribute('step', '0.01');
        knob.setAttribute('colors', 'var(--color1);var(--color2);var(--color3)');
        knob.setAttribute('midilearn', '1');
        knob.setAttribute('min', param.min);
        knob.setAttribute('max', param.max);
        knob.setAttribute('value', param.initValue);
        knob.setAttribute('is-bidirectional', true);
        knob.setAttribute('sensitivity', 0.3);
        knob.setAttribute('data-automatable', 'true');

        // Append knob to the container
        container.appendChild(knob);

        //console.log(`[Knob] Created and appended ${paramKey}Knob to ${container.id}`);
    });

    //console.log('[Knobs] Updated knobs from track data.');
}