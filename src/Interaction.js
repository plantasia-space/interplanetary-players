// Interaction.js

import { ButtonGroup } from './ButtonGroup.js';
import { MIDIControllerInstance } from './MIDIController.js';

/**
 * Setup interactions for dynamic placeholder updates.
 * @param {DataManager} dataManager - The shared DataManager instance.
 * @param {AudioPlayer} audioPlayer - The shared AudioPlayer instance.
 */
export function setupInteractions(dataManager, audioPlayer) {
  if (typeof bootstrap === 'undefined') {
      console.error('Bootstrap is not loaded. Ensure bootstrap.bundle.min.js is included.');
      return;
  }

  // Bind event listeners to dropdown items for manual interactions
  document.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', event => {
          event.preventDefault(); // Prevent default link behavior
          const action = item.getAttribute('data-value'); // Get action value
          console.log(`Dropdown action triggered: ${action}`);
          // Additional functionality for dropdown actions can be added here
      });
  });

  // Initialize all button groups
  const buttonGroups = [];
  document.querySelectorAll('.button-group-container').forEach(group => {
      const groupType = group.getAttribute('data-group');
      console.log(`Initializing ButtonGroup for group type: ${groupType}`);

      const buttonGroup = new ButtonGroup(
          `.button-group-container[data-group="${groupType}"]`,
          'ul.dropdown-menu',
          'button.dropdown-toggle',
          'a.dropdown-item',
          '.button-icon',
          audioPlayer,    // Pass shared AudioPlayer
          dataManager     // Pass shared DataManager
      );

      buttonGroups.push(buttonGroup);
  });

  // Register dropdown items with MIDIController for MIDI interactions
  registerMenuItemsWithMIDIController(buttonGroups);
}

/**
* Registers all dropdown items in the initialized ButtonGroups with MIDIController.
* @param {Array} buttonGroups - List of initialized ButtonGroup instances.
*/
function registerMenuItemsWithMIDIController(buttonGroups) {
  const midiController = MIDIControllerInstance;

  buttonGroups.forEach(buttonGroup => {
      buttonGroup.menuItems.forEach(item => {
          const itemId = item.id || item.getAttribute('data-value');
          if (itemId) {
              midiController.registerWidget(itemId, item);
              console.log(`Registered dropdown item with MIDIController: ${itemId}`);
          } else {
              console.warn("Menu item missing 'id' or 'data-value' attribute:", item);
          }
      });
  });

  console.log('All dropdown items registered with MIDIController.');
}

/**
 * Displays a universal modal using Bootstrap and returns a promise that resolves when the modal is closed.
 * @param {string} title - The title of the modal.
 * @param {string|HTMLElement} content - The content of the modal.
 * @param {string} buttonText - The text for the primary button.
 * @returns {Promise} - Resolves when the modal is closed.
 */
export function showUniversalModal(title, content, buttonText = "Okay") {
  return new Promise((resolve) => {
    const modal = document.getElementById('universalModal');
    if (!modal) {
      console.error('Universal Modal element not found.');
      resolve();
      return;
    }

    // Update modal content
    const modalTitle = modal.querySelector('.modal-title');
    const modalBody = modal.querySelector('.modal-body');
    const modalFooterButton = modal.querySelector('.modal-footer button');

    if (!modalTitle || !modalBody || !modalFooterButton) {
      console.error('Universal Modal structure is incorrect.');
      resolve();
      return;
    }

    modalTitle.textContent = title;
    modalBody.innerHTML = ''; // Clear previous content
    if (typeof content === 'string') {
      modalBody.textContent = content;
    } else if (content instanceof HTMLElement) {
      modalBody.appendChild(content);
    }

    modalFooterButton.textContent = buttonText;

    // Handle button click
    const buttonHandler = () => {
      modalFooterButton.removeEventListener('click', buttonHandler);
      const bsModal = bootstrap.Modal.getInstance(modal);
      bsModal.hide();
      resolve();
    };

    modalFooterButton.addEventListener('click', buttonHandler);

    // Show the modal using Bootstrap
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
  });
}

/**
 * Displays a Parameter Selection Modal with a list of available parameters.
 * @param {string[]} availableParams - List of available parameters.
 * @returns {Promise<string|null>} - Resolves with the selected parameter or null if canceled.
 */
export function showParameterSelectionModal(availableParams) {
  return new Promise((resolve) => {
    const modal = document.getElementById('parameterSelectionModal');
    const parameterList = document.getElementById('parameterList');
    const modalTitle = modal.querySelector('.modal-title');

    if (!modal || !parameterList || !modalTitle) {
      console.error('Parameter Selection Modal structure is incorrect.');
      resolve(null);
      return;
    }

    // Clear previous list
    parameterList.innerHTML = '';

    // Populate the list with available parameters
    availableParams.forEach(param => {
      const listItem = document.createElement('li');
      listItem.classList.add('list-group-item', 'list-group-item-action');
      listItem.textContent = param;
      listItem.addEventListener('click', () => {
        modalTitle.textContent = `Mapping MIDI to '${param}'`;
        const bsModal = bootstrap.Modal.getInstance(modal);
        bsModal.hide();
        resolve(param);
      });
      parameterList.appendChild(listItem);
    });

    // Handle modal dismissal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    modal.addEventListener('hidden.bs.modal', () => {
      resolve(null);
    }, { once: true });
  });
}
/**
 * Apply colors to the document from track data.
 * @param {object} trackData - The track data containing color information.
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
        console.log(`[COLORS] Set --color1 to ${color1}`);
    }

    if (color2) {
        document.documentElement.style.setProperty('--color2', color2);
        console.log(`[COLORS] Set --color2 to ${color2}`);
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
}

/**
 * Dynamically create and update knobs based on track data.
 * @param {object} trackData - The track data containing sound engine parameters.
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
        knob.setAttribute('sensitivity', .3);
        knob.setAttribute("data-automatable", "true");

        // Append knob to the container
        container.appendChild(knob);

        console.log(`Created ${knob.id}: min=${param.min}, max=${param.max}, value=${param.initValue}`);
    });


  
}