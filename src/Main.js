// src/Main.js

import { initScene, initRenderer, addLights } from './Scene.js';
import { loadAndDisplayModel } from './Loaders.js';
import { DataManager } from './DataManager.js';
import { Constants, DEFAULT_TRACK_ID } from './Constants.js';
import lscache from 'lscache';
import { setupInteractions, updateKnobsFromTrackData, applyColorsFromTrackData  } from './Interaction.js';
import { AudioPlayer } from './AudioPlayer.js'; // Import AudioPlayer
import { ButtonGroup } from './ButtonGroup.js';
import { ParameterManager } from './ParameterManager.js';

// Initialize the scene
const canvas3D = document.getElementById('canvas3D');
const { scene, camera, controls } = initScene(canvas3D);
const renderer = initRenderer(canvas3D);

addLights(scene);

const dataManager = new DataManager();
const audioPlayer = new AudioPlayer(); // Instantiate AudioPlayer

const user1Manager = new ParameterManager();
const rootParams = ['x', 'y', 'z', 'body-level', 'body-envelope'];


let animationRunning = false;
let midiDumpEnabled = false; // Variable to toggle MIDI dump on/off


// Initialize Application
// src/Main.js

async function initializeApp() {
    try {
        console.log('[APP] Starting application...');

        const urlParams = new URLSearchParams(window.location.search);
        let trackId = urlParams.get('trackId') || DEFAULT_TRACK_ID;

        console.log(`[APP] Using trackId: ${trackId}`);

        // Use DataManager to handle fetch and configuration
        await dataManager.fetchAndUpdateConfig(trackId);

        // Retrieve the updated TRACK_DATA
        const trackData = Constants.getTrackData(trackId);
        if (!trackData) {
            throw new Error('Failed to fetch track data.');
        }

        console.log('[APP] TRACK_DATA confirmed:', trackData);

        // Apply colors and update knobs
        applyColorsFromTrackData(trackData);
        updateKnobsFromTrackData(trackData);
        window.webAudioControlsWidgetManager.setTrackId(trackId);

        // Populate placeholders
        setupInteractions(dataManager, audioPlayer);
        dataManager.populatePlaceholders('monitorInfo');

        // Load the model and display it in the scene
        await loadAndDisplayModel(scene, trackData);
        console.log('[APP] Model loaded successfully.');
    } catch (error) {
        console.error('[APP] Error during application initialization:', error);
    }
}

window.addEventListener('resize', () => {
    const MIN_SIZE = 340; // Minimum frame size

    // Get the current viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Determine the width and height for the frame
    const frameWidth = Math.max(viewportWidth, MIN_SIZE);
    const frameHeight = Math.max(viewportHeight, MIN_SIZE);

    // Resize the renderer to fit the current window size, respecting minimums
    renderer.setSize(frameWidth, frameHeight);

    // Adjust the camera's aspect ratio to match the new dimensions
    camera.aspect = frameWidth / frameHeight;
    camera.updateProjectionMatrix();

    // Set the pixel ratio for high-DPI screens, capped at 2 for performance
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

function animate() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}



/**
 * Sets up the WebAudioControlsWidgetManager, including MIDI listeners
 * and event listeners for switches and knobs.
 */
function setupWebAudioControlsWidgetManager() {
    if (!window.webAudioControlsWidgetManager) {
        console.error("webAudioControlsWidgetManager is not defined.");
        return;
    }

    console.log("webAudioControlsWidgetManager is defined.");

    // Add external MIDI listeners if needed
    window.webAudioControlsWidgetManager.addMidiListener((event) => {
        if (midiDumpEnabled) {
            console.log("MIDI DUMP:", event.data);

            // Log registered widgets after a delay
            setTimeout(() => {
                console.log("Registered Widgets:", window.webAudioControlsWidgetManager.listOfWidgets);
            }, 100);
        }
    });

    setupSwitchListeners(['xBalance', 'yBalance', 'zBalance']);
    setupKnobListeners(['xKnob', 'yKnob', 'zKnob']);
}

/**
 * Sets up event listeners for switches by their IDs.
 * @param {Array<string>} switchIds - Array of switch element IDs.
 */
function setupSwitchListeners(switchIds) {
    switchIds.forEach(switchId => {
        const switchElement = document.getElementById(switchId);
        if (switchElement) {
            switchElement.addEventListener('change', () => {
                console.log(`${switchId} state changed to:`, switchElement.state);
            });
        } else {
            console.warn(`Element with id '${switchId}' not found.`);
        }
    });
}

/**
 * Sets up event listeners for knobs by their IDs.
 * @param {Array<string>} knobIds - Array of knob element IDs.
 */
function setupKnobListeners(knobIds) {
    knobIds.forEach(knobId => {
        const knob = document.getElementById(knobId);
        if (knob) {
            knob.addEventListener('change', () => {
           //     console.log(`${knobId} value changed to:`, knob.value);
            });
        } else {
            console.warn(`Element with id '${knobId}' not found.`);
        }
    });
}

/**
 * Sets up alignment for the collapse menu and attaches relevant event listeners.
 */
function setupCollapseMenuAlignment() {
    const infoButton = document.getElementById("informationMenuButton");
    const collapseMenu = document.getElementById("collapseInfoMenu");

    if (!infoButton || !collapseMenu) {
        console.error("Information button or collapse menu element not found.");
        return;
    }

    const verticalOffsetVH = 2; // Vertical offset in `vh`
    const horizontalOffsetVW = -1; // Horizontal offset in `vw`

    const alignCollapseMenu = () => {
        const buttonRect = infoButton.getBoundingClientRect();
        const headerRect = document.querySelector(".header-row").getBoundingClientRect();

        const calculatedTop = buttonRect.bottom - headerRect.top + (verticalOffsetVH * window.innerHeight) / 100;
        const calculatedLeft = buttonRect.left - headerRect.left + (horizontalOffsetVW * window.innerWidth) / 100;

        collapseMenu.style.top = `${calculatedTop}px`;
        collapseMenu.style.left = `${calculatedLeft}px`;
    };

    // Align initially
    alignCollapseMenu();

    // Adjust on window resize
    window.addEventListener("resize", alignCollapseMenu);

    // Optionally adjust when the menu is shown
    infoButton.addEventListener("click", alignCollapseMenu);
}


document.addEventListener('DOMContentLoaded', () => {
    console.log("Application initialized.");

    // Initialize application and animation loop
    initializeApp().then(animate);

    // Handle WebAudioControlsWidgetManager setup
    setupWebAudioControlsWidgetManager();

    // Setup collapse menu alignment
    setupCollapseMenuAlignment();

    // Add root parameters to the ParameterManager
    rootParams.forEach((paramName) => {
        user1Manager.addParameter(paramName, 0, true); // Initial value = 0, isBidirectional = false
    });
  

});

export { user1Manager };
