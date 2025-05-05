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
import { ButtonSingle } from './ButtonSingle.js';  // Import ButtonSingle
import { MIDIControllerInstance } from './MIDIController.js';
import { MIDI_SUPPORTED, SENSORS_SUPPORTED, INTERNAL_SENSORS_USABLE, EXTERNAL_SENSORS_USABLE  } from './Constants.js'; // Ensure SENSORS_SUPPORTED is defined
import notifications from './AppNotifications.js';
import { SensorController } from './SensorsController.js'; // Import the class instead of instance
import { PlaybackController } from "./PlaybackController.js";
import { updateOrbitColor } from './Scene.js';
/**
 * Sets up interactions for dynamic placeholder updates.
 * Initializes ButtonGroups and Single Buttons, registers MIDI controllers if supported.
 * @memberof CoreModule 
 * @function setupInteractions
 * @param {DataManager} dataManager - The shared DataManager instance.
 * @param {Orbiter} orbiter - The shared Orbiter instance.
 * @param {User1Manager} user1Manager - The user manager instance.
 */

export function setupInteractions(dataManager, orbiter, user1Manager) {
    if (typeof bootstrap === 'undefined') {
      console.error('Bootstrap is not loaded. Ensure bootstrap.bundle.min.js is included.');
      return;
    }
  
    // Assign user1Manager to ModeManager
    ModeManagerInstance.user1Manager = user1Manager;
  
    // 1) Setup all ButtonGroup dropdowns
    const buttonGroups = [];
    document.querySelectorAll('.button-group-container').forEach(group => {
      const groupType = group.getAttribute('data-group');
      const btnGroupInstance = new ButtonGroup(
        `.button-group-container[data-group="${groupType}"]`,
        'ul.dropdown-menu',
        'button.dropdown-toggle',
        'a.dropdown-item',
        '.button-icon',
        orbiter,
        dataManager,
        user1Manager
      );
      buttonGroups.push(btnGroupInstance);
    });
    // 2) Initialize PlaybackController here
    const playbackController = new PlaybackController(orbiter);

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
    if (!trackData || !trackData.orbiter || !trackData.orbiter.orbiterColors) {
        console.warn('[COLORS] No color data available in track data.');
        return;
    }

    const { color1, color2 } = trackData.orbiter.orbiterColors;

    // Update CSS variables for colors
    if (color1) {
        document.documentElement.style.setProperty('--color1', color1);
        //console.log(`[COLORS] Set --color1 to ${color1}`);
    }

    if (color2) {
        document.documentElement.style.setProperty('--color2', color2);
        //console.log(`[COLORS] Set --color2 to ${color2}`);
    }

    // sync 3D orbit color from CSS
 

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
    updateOrbitColor();
    //console.log('[COLORS] Applied colors from track data to UI components.');
}

/**
 * Dynamically creates and updates knobs based on track data.
 * Configures UI components for orbiter parameters.
 * @memberof CoreModule 
 * @function updateKnobsFromTrackData
 * @param {object} trackData - The track data containing orbiter parameters.
 * @returns {void}
 * @throws Will log an error if track data or orbiter information is missing.
 */
export function updateKnobsFromTrackData(trackData) {
    if (!trackData || !trackData.orbiter) {
        console.error('No valid track data or orbiter information found.');
        return;
    }

    // Extract x, y, z parameters from the track data
    const { x, y, z } = trackData.orbiter.orbiterParams;

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
            console.warn(`Parameter '${paramKey}' is missing or undefined in orbiter data.`);
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