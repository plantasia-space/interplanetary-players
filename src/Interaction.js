// src/Interaction.js

/**
 * Sets up click handlers for UI buttons.
 * @param {Object} options - Configuration options.
 * @param {Function} options.onPlay - Callback for Play button.
 * @param {Function} options.onPause - Callback for Pause button.
 */
export function setupInteractions({ onPlay, onPause }) {
    // Select UI buttons
    const playButton = document.getElementById('playButton');
    const pauseButton = document.getElementById('pauseButton');

    if (playButton) {
        playButton.addEventListener('click', () => {
            console.log('Play button clicked:', playButton);
            onPlay();
        });
    } else {
        console.warn('Play button with ID "playButton" not found.');
    }

    if (pauseButton) {
        pauseButton.addEventListener('click', () => {
            console.log('Pause button clicked:', pauseButton);
            onPause();
        });
    } else {
        console.warn('Pause button with ID "pauseButton" not found.');
    }
}