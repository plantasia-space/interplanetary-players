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
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`Failed to load SVG: ${src}`);
                    }
                    return response.text();
                })
                .then((svgContent) => {
                    const parser = new DOMParser();
                    const svgDocument = parser.parseFromString(svgContent, 'image/svg+xml');
                    const svgElement = svgDocument.documentElement;

                    if (svgElement && svgElement.tagName.toLowerCase() === 'svg') {
                        // Add compatibility with currentColor
                        svgElement.setAttribute('fill', 'currentColor');
                        svgElement.setAttribute('role', 'img'); // Accessibility
                        svgElement.classList.add('icon-svg'); // Custom class for additional styling

                        // Clear existing content and append the SVG
                        icon.innerHTML = '';
                        icon.appendChild(svgElement);
                    }
                })
                .catch((error) => {
                    console.error(`Error loading SVG from ${src}:`, error);
                });
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
                case 'cosmic-lfo':
                    console.log('Regenerating...');
                    // Add cosmic-lfo logic here
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


/////////// DROPDOWN MENU ////////////



// Update the main button icon dynamically
const dropdownItems = document.querySelectorAll('.dropdown-item');
const interactionMenuIcon = document.getElementById('interactionMenuIcon');

dropdownItems.forEach((item) => {
    item.addEventListener('click', (e) => {
        e.preventDefault();

        // Get the selected icon path and value
        const newIconPath = item.getAttribute('data-icon');
        const newValue = item.getAttribute('data-value');

        // Update the button's SVG dynamically
        interactionMenuIcon.setAttribute('data-src', newIconPath);
        interactionMenuIcon.setAttribute('aria-label', newValue);

        // Reload the SVG for the button
        loadDynamicSVGs();
    });
});