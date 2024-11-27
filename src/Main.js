// src/Main.js

import { initScene, initRenderer, addLights } from './Scene.js';
import { loadAndDisplayModel } from './Loaders.js';
import { DataManager } from './DataManager.js';
import { Constants, DEFAULT_TRACK_ID } from './Constants.js';
import lscache from 'lscache';
import { setupInteractions } from './Interaction.js';
import { AudioPlayer } from './AudioPlayer.js'; // Import AudioPlayer
import { ButtonGroup } from './ButtonGroup.js';

// Initialize the scene
const canvas3D = document.getElementById('canvas3D');
const { scene, camera, controls } = initScene(canvas3D);
const renderer = initRenderer(canvas3D);

addLights(scene);

const dataManager = new DataManager();
const audioPlayer = new AudioPlayer(); // Instantiate AudioPlayer

let animationRunning = false;


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

        // Verify required data fields
        if (!Constants.TRACK_DATA?.track || 
            !Constants.TRACK_DATA?.soundEngine || 
            !Constants.TRACK_DATA?.interplanetaryPlayer) {
            throw new Error('Missing required data fields in TRACK_DATA.');
        }

        console.log('[APP] TRACK_DATA confirmed:', Constants.TRACK_DATA);

        // Apply colors based on TRACK_DATA
        Constants.applyColorsFromTrackData();
        window.webAudioControlsWidgetManager.setTrackId(trackId);

        // Populate placeholders using the default type 'monitorInfo'
        setupInteractions(dataManager, audioPlayer); // Pass audioPlayer here
        dataManager.populatePlaceholders('monitorInfo');

        // Load the model and display it in the scene
        await loadAndDisplayModel(scene, Constants.TRACK_DATA);
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

let midiDumpEnabled = false; // Variable to toggle MIDI dump on/off



document.addEventListener('DOMContentLoaded', () => {
    console.log("Application initialized.");




    // Initialize the application and start the animation loop
    initializeApp().then(animate);




    // Check if the WebAudioControlsWidgetManager is available
    if (window.webAudioControlsWidgetManager) {
        console.log("webAudioControlsWidgetManager is defined.");

        // Add external MIDI listeners if needed
        window.webAudioControlsWidgetManager.addMidiListener((event) => {
            if (midiDumpEnabled) {
                console.log("MIDI DUMP:", event.data);

                // Log registered widgets after ensuring widgets have connected
                setTimeout(() => {
                    console.log("Registered Widgets:", window.webAudioControlsWidgetManager.listOfWidgets);
                }, 100); // 100ms delay
            }
        });

        // Function to handle switch state changes
        const handleSwitchChange = (switchId) => {
            const switchElement = document.getElementById(switchId);
            if (switchElement) {
                switchElement.addEventListener('change', (e) => {
                    console.log(`${switchId} state changed to:`, switchElement.state);
                });
            } else {
                console.warn(`Element with id '${switchId}' not found.`);
            }
        };

        // Attach event listeners to all switches
        const switchIds = ['xBalance', 'yBalance', 'sequentialSwitch', 'radioSwitch1', 'radioSwitch2', 'radioSwitch3'];
        switchIds.forEach(id => handleSwitchChange(id));

        // Add event listeners to knobs
        const knobIds = ['xKnob', 'yKnob', 'zKnob'];
        knobIds.forEach(id => {
            const knob = document.getElementById(id);
            if (knob) {
                knob.addEventListener('change', (e) => {
                    // Example: Log knob value changes
                    console.log(`${id} value changed to:`, knob.value);
                });
            } else {
                console.warn(`Element with id '${id}' not found.`);
            }
        });
    } else {
        console.error("webAudioControlsWidgetManager is not defined.");
    }
});