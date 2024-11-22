// Interaction.js

import { Constants } from './Constants.js';
/**
 * Load SVGs dynamically into buttons and labels.
 */
function loadDynamicSVGs() {
    const dynamicIcons = document.querySelectorAll('[data-src]');
    dynamicIcons.forEach((icon) => {
        const src = icon.getAttribute('data-src');
        if (src) {
            fetch(src)
                .then((response) => response.text())
                .then((svgContent) => {
                    const parser = new DOMParser();
                    const svgDocument = parser.parseFromString(svgContent, 'image/svg+xml');
                    const svgElement = svgDocument.documentElement;

                    if (svgElement && svgElement.tagName.toLowerCase() === 'svg') {
                        svgElement.setAttribute('fill', 'currentColor');
                        svgElement.classList.add('icon-svg');
                        icon.innerHTML = ''; // Clear existing content
                        icon.appendChild(svgElement);
                    }
                })
                .catch(console.error);
        }
    });
}


/**
 * Toggles the play/pause button dynamically.
 * @param {HTMLElement} button - The button element to toggle.
 */
function togglePlayPause(button) {
    const currentState = button.getAttribute('data-state'); // "paused" or "playing"
    const newState = currentState === 'paused' ? 'playing' : 'paused';
    const newIconSrc = newState === 'paused' ? '/assets/icons/play_circle.svg' : '/assets/icons/pause_circle.svg';
    const newLabel = newState === 'paused' ? 'Play' : 'Pause';

    // Update button state
    button.setAttribute('data-state', newState);
    button.setAttribute('aria-label', newLabel);
    button.setAttribute('data-src', newIconSrc);

    // Reload the SVG dynamically
    fetch(newIconSrc)
        .then((response) => response.text())
        .then((svgContent) => {
            const parser = new DOMParser();
            const svgDocument = parser.parseFromString(svgContent, 'image/svg+xml');
            const svgElement = svgDocument.documentElement;

            if (svgElement && svgElement.tagName.toLowerCase() === 'svg') {
                svgElement.setAttribute('fill', 'currentColor');
                svgElement.classList.add('icon-svg');
                button.innerHTML = ''; // Clear existing content
                button.appendChild(svgElement);
            }
        })
        .catch(console.error);
}


/**
 * Setup interactions for dynamic placeholder updates.
 */
export function setupInteractions(dataManager) {

if (typeof bootstrap === 'undefined') {
    console.error('Bootstrap is not loaded. Ensure bootstrap.bundle.min.js is included.');
    return;
}

document.querySelectorAll('.action-button').forEach((button) => {
    const action = button.getAttribute('aria-label'); // Use aria-label for action

    if (button.classList.contains('toggle-play-pause')) {
        // Special case for the play/pause button
        button.addEventListener('click', () => {
            console.log(`[Button Action] Toggling Play/Pause`);
            togglePlayPause(button);

            // Add play/pause logic if needed
            const state = button.getAttribute('data-state');
            if (state === 'playing') {
                console.log('Playing...');
                // Add logic to start playback
            } else {
                console.log('Paused...');
                // Add logic to pause playback
            }
        });
    } else {
        // Default behavior for other buttons
        button.addEventListener('click', () => {
            console.log(`[Button Action] ${action} button clicked`);

            // Add specific logic for each button
            switch (action) {
                case 'Balance 1':
                case 'Balance 2':
                case 'Balance 3':
                    console.log(`Adjusting ${action}`);
                    // Add balance adjustment logic here
                    break;
                case 'Regen':
                    console.log('Regenerating...');
                    // Add regen logic here
                    break;
                default:
                    console.warn('Unknown action.');
            }
        });
    }
});





const toggleButton = document.querySelector('.menu-info-toggle');
const collapseContent = document.getElementById('collapseInfoMenu');

if (!toggleButton || !collapseContent) {
    console.error('Required elements not found.');
    return;
}

const collapseInstance = new bootstrap.Collapse(collapseContent, { toggle: false });

// Handle toggle button click
toggleButton.addEventListener('click', () => {
    const isExpanded = toggleButton.getAttribute('aria-expanded') === 'true';

    if (isExpanded) {
        collapseInstance.hide(); // Collapse the menu
        dataManager.clearPlaceholders(); // Clear placeholders when collapsed
    } else {
        collapseInstance.show(); // Expand the menu
    }

    toggleButton.setAttribute('aria-expanded', (!isExpanded).toString());
});

// Handle icon clicks
document.querySelectorAll('.menu-info-icon').forEach((icon) => {
    icon.addEventListener('click', () => {
        const target = icon.dataset.target;
        console.log("target", target);

        if (target) {
            // Ensure the menu is expanded when an icon is clicked
            if (!collapseContent.classList.contains('show')) {
                collapseInstance.show();
                toggleButton.setAttribute('aria-expanded', 'true');
            }

            // Validate and populate placeholders dynamically
            if (!Constants.TRACK_DATA) {
                console.error('[Interactions] TRACK_DATA is not loaded. Ensure fetchAndUpdateConfig is called.');
                return;
            }

            console.log(`[Interactions] Populating placeholders for target: ${target}`);
            dataManager.populatePlaceholders(target);
        } else {
            console.warn('No data-target attribute found on the clicked icon.');
        }
    });
});
if (!Constants.TRACK_DATA) {
    console.error('[Interactions] TRACK_DATA is not loaded. Ensure fetchAndUpdateConfig is called.');
    return;
}
// Clear placeholders when menu is hidden
collapseContent.addEventListener('hidden.bs.collapse', () => {
    dataManager.clearPlaceholders();
    toggleButton.setAttribute('aria-expanded', 'false');
});

// Ensure aria-expanded is updated when menu is shown
collapseContent.addEventListener('shown.bs.collapse', () => {
    toggleButton.setAttribute('aria-expanded', 'true');
});
}
// Initialize SVG loading and interactions
loadDynamicSVGs();


/////////// KNOBS ////////////

document.getElementById("xKnob").addEventListener("input", (event)=>{
    //console.log(event.target.value);
  });

  function loadDynamicKnobSVGs() {
    const knobs = document.querySelectorAll('webaudio-knob');

    knobs.forEach((knob) => {
        const baseSrc = knob.getAttribute('data-src-base'); // Base SVG source
        const pointerSrc = knob.getAttribute('data-src-pointer'); // Pointer SVG source

        // Inject the base SVG
        if (baseSrc) {
            fetch(baseSrc)
                .then((response) => response.text())
                .then((svgContent) => {
                    const parser = new DOMParser();
                    const svgBase = parser.parseFromString(svgContent, 'image/svg+xml').documentElement;

                    if (svgBase && svgBase.tagName.toLowerCase() === 'svg') {
                        svgBase.classList.add('knob-base');
                        knob.appendChild(svgBase);
                    }
                })
                .catch(console.error);
        }

        // Inject the pointer SVG
        if (pointerSrc) {
            fetch(pointerSrc)
                .then((response) => response.text())
                .then((svgContent) => {
                    const parser = new DOMParser();
                    const svgPointer = parser.parseFromString(svgContent, 'image/svg+xml').documentElement;

                    if (svgPointer && svgPointer.tagName.toLowerCase() === 'svg') {
                        svgPointer.classList.add('knob-pointer');
                        knob.appendChild(svgPointer);

                        // Set initial rotation and transform origin for the pointer
                        svgPointer.style.transformOrigin = 'center';
                        svgPointer.style.transform = 'rotate(0deg)';
                    }
                })
                .catch(console.error);
        }
    });
}

// Run the injection function after the DOM is loaded
document.addEventListener('DOMContentLoaded', loadDynamicKnobSVGs);
// Run the function after DOM is loaded
function updateKnobRotation(knob, value, min, max) {
    const range = max - min;
    const rotation = ((value - min) / range) * 270 - 135; // Scale value to degrees

    const pointer = knob.querySelector('.knob-pointer');
    if (pointer) {
        pointer.style.transform = `rotate(${rotation}deg)`; // Apply rotation
    }
}

// Example: Add an input listener for testing
document.querySelectorAll('webaudio-knob').forEach((knob) => {
    knob.addEventListener('input', (e) => {
        const value = parseFloat(knob.getAttribute('value') || '0');
        const min = parseFloat(knob.getAttribute('min') || '0');
        const max = parseFloat(knob.getAttribute('max') || '100');
        updateKnobRotation(knob, value, min, max);
    });
});

function injectSVGColors() {
    const knobs = document.querySelectorAll('webaudio-knob');

    knobs.forEach((knob) => {
        const rootStyles = getComputedStyle(document.documentElement);
        const color1 = rootStyles.getPropertyValue('--col1').trim(); // Primary color
        const color2 = rootStyles.getPropertyValue('--col2').trim(); // Secondary color

        // Apply colors to the base SVG
        const base = knob.querySelector('.knob-base');
        if (base) {
            base.querySelectorAll('path, circle, rect').forEach((element) => {
                element.setAttribute('fill', color1);
            });
        }

        // Apply colors to the pointer SVG
        const pointer = knob.querySelector('.knob-pointer');
        if (pointer) {
            pointer.querySelectorAll('path, circle, rect').forEach((element) => {
                element.setAttribute('fill', color2);
            });
        }
    });
}

// Ensure the colors are applied after the knobs are initialized
setTimeout(injectSVGColors, 1000);