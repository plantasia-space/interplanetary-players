// Interaction.js

import { ButtonGroup } from './ButtonGroup.js';

/**
 * Setup interactions for dynamic placeholder updates.
 * @param {DataManager} dataManager - The DataManager instance.
 * @param {AudioPlayer} audioPlayer - The AudioPlayer instance.
 */
export function setupInteractions(dataManager, audioPlayer) {
    if (typeof bootstrap === 'undefined') {
        console.error('Bootstrap is not loaded. Ensure bootstrap.bundle.min.js is included.');
        return;
    }

    // Initialize all button groups
    const buttonGroups = document.querySelectorAll('.button-group-container');
    buttonGroups.forEach((group) => {
        const groupType = group.getAttribute('data-group');
        new ButtonGroup(
            `.button-group-container[data-group="${groupType}"]`,
            'ul.dropdown-menu',
            'button.dropdown-toggle',
            'a.dropdown-item',
            '.button-icon',
            audioPlayer // Pass audioPlayer here
        );
    });

    // Handle other action buttons (if any)
    document.querySelectorAll('.action-button').forEach((button) => {
        const action = button.getAttribute('aria-label'); // Use aria-label for action

        if (!button.classList.contains('toggle-play-pause')) {
            button.addEventListener('click', () => {
                console.log(`[Button Action] ${action} button clicked`);

                // Add specific logic for each button
                switch (action.toLowerCase()) {
                    case 'balance 1':
                    case 'balance 2':
                    case 'balance 3':
                        console.log(`Adjusting ${action}`);
                        // Add balance adjustment logic here
                        break;
                    case 'cosmic lfo':
                        console.log('Regenerating...');
                        // Add cosmic-lfo logic here
                        break;
                    default:
                        console.warn('Unknown action.');
                }
            });
        }
    });

    // Initialize other UI components or interactions as needed
}