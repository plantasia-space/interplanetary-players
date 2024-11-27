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
            handleMoreDropdown(action); // Call the handler
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

    // Handle other action buttons (if any)
    document.querySelectorAll('.action-button').forEach(button => {
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
                        break;
                    case 'cosmic lfo':
                        console.log('Regenerating...');
                        break;
                    default:
                        console.warn('Unknown action.');
                }
            });
        }
    });



    
}

function handleMoreDropdown(action) {
    switch (action) {
        case 'Share':
            console.log('Share action triggered');
            break;
        case 'Fullscreen':
            console.log('Fullscreen action triggered');
            break;
        default:
            console.log('Unknown action');
    }
}