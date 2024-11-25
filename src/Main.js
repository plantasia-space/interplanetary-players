// src/Main.js

import { initScene, initRenderer, addLights } from './Scene.js';
import { loadAndDisplayModel } from './Loaders.js';
import { DataManager } from './DataManager.js';
import { Constants, DEFAULT_TRACK_ID } from './Constants.js';
import lscache from 'lscache';
import { setupInteractions } from './Interaction.js';

// Initialize the scene
const canvas3D = document.getElementById('canvas3D');
const { scene, camera, controls } = initScene(canvas3D);
const renderer = initRenderer(canvas3D);

addLights(scene);

const dataManager = new DataManager();

let animationRunning = false;

// Define Play and Pause Handlers
function handlePlay() {
    if (!animationRunning) {
        animationRunning = true;
        console.log('Play button clicked: Animations/Sound started.');
        // Implement actual play functionality here (e.g., start sound, animations)
    }
}

function handlePause() {
    if (animationRunning) {
        animationRunning = false;
        console.log('Pause button clicked: Animations/Sound paused.');
        // Implement actual pause functionality here (e.g., stop sound, animations)
    }
}


// Initialize Application
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
        setupInteractions(dataManager);
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

initializeApp().then(animate);

let midiDumpEnabled = false; // Variable to toggle MIDI dump on/off


// Handle Event Listeners after DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("Application initialized.");

    
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
        
        // Add event listeners to controls
        const xKnob = document.getElementById('xKnob');
        if (xKnob) {
            xKnob.addEventListener('change', (e) => {
                //console.log("xKnob value changed to:", xKnob.value);
            });
        } else {
            console.warn("Element with id 'xKnob' not found.");
        }

        const yKnob = document.getElementById('yKnob');
        if (yKnob) {
            yKnob.addEventListener('change', (e) => {
                //console.log("yKnob value changed to:", yKnob.value);
            });
        } else {
            console.warn("Element with id 'yKnob' not found.");
        }

        const zKnob = document.getElementById('zKnob');
        if (zKnob) {
            zKnob.addEventListener('change', (e) => {
                //console.log("zKnob value changed to:", zKnob.value);
            });
        } else {
            console.warn("Element with id 'zKnob' not found.");
        }

        


    } else {
        console.error("webAudioControlsWidgetManager is not defined.");
    }
});