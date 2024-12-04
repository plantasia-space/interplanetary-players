// Interaction.js

import { ButtonGroup } from './ButtonGroup.js';

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
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', event => {
            event.preventDefault(); // Prevent default link behavior
            const action = item.getAttribute('data-value'); // Get action value
            //handleMoreDropdown(action); // Call the handler
        });
    });
    // Initialize all button groups
    document.querySelectorAll('.button-group-container').forEach(group => {
        const groupType = group.getAttribute('data-group');

        new ButtonGroup(
            `.button-group-container[data-group="${groupType}"]`,
            'ul.dropdown-menu',
            'button.dropdown-toggle',
            'a.dropdown-item',
            '.button-icon',
            audioPlayer,    // Pass shared AudioPlayer
            dataManager     // Pass shared DataManager
        );
    });

}

/**
 * Show the universal modal with dynamic content.
 * @param {string} title - The modal title.
 * @param {string|HTMLElement} content - The modal body content (string or HTML element).
 * @param {string} [buttonText="Okay"] - The footer button text.
 */
export function showUniversalModal(title, content, buttonText = "Okay") {
    console.log('showUniversalModal called with:', { title, content, buttonText });
  
    const modal = document.getElementById('universalModal');
    if (!modal) {
      console.error('Universal Modal element not found.');
      return;
    }
  
    // Ensure Bootstrap modal instance
    const modalInstance = bootstrap.Modal.getInstance(modal) || new bootstrap.Modal(modal);
  
    // Update modal content
    const modalTitle = modal.querySelector('.modal-title');
    const modalBody = modal.querySelector('.modal-body');
    const modalFooterButton = modal.querySelector('.modal-footer button');
  
    if (!modalTitle || !modalBody || !modalFooterButton) {
      console.error('Universal Modal structure is incorrect.');
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
  
    // Attach event listener for debugging position
    modal.addEventListener('shown.bs.modal', () => {
      console.log('Modal is now visible.');
      const rect = modal.getBoundingClientRect();
      console.log('Modal Position:', {
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      });
  
      // Check if the modal is off-screen
      if (rect.top < 0 || rect.left < 0 || rect.bottom > window.innerHeight || rect.right > window.innerWidth) {
        console.warn('Modal is rendering off-screen. Consider adjusting CSS or placement logic.');
      }
    });
  
    modal.addEventListener('hidden.bs.modal', () => {
      console.log('Modal has been hidden.');
    });
  
    // Show the modal
    modalInstance.show();

    
  }

  const modal = document.getElementById('universalModal');
const computedStyle = getComputedStyle(modal);
console.log('Modal Computed Styles:', {
  display: computedStyle.display,
  visibility: computedStyle.visibility,
  opacity: computedStyle.opacity,
  zIndex: computedStyle.zIndex,
});

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

        // Append knob to the container
        container.appendChild(knob);

        console.log(`Created ${knob.id}: min=${param.min}, max=${param.max}, value=${param.initValue}`);
    });


  
}