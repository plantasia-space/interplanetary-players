/**
 * @file main.js
 * @description Entry point for initializing the Interplanetary Players application.
 * Handles scene setup, parameter management, interactions, and rendering.
 * @version 2.0.0
 * @author 𝐵𝓇𝓊𝓃𝒶 𝒢𝓊𝒶𝓇𝓃𝒾𝑒𝓇𝒾 
 * @license MIT
 * @date 2024-12-07
 * @memberof CoreModule 
 */
/**
 * @namespace CoreModule
 * @description The **CoreModule** serves as the backbone of the application, organizing and executing foundational logic. 
 * It provides a centralized system for managing interactions, parameter transformations, and application state, 
 * ensuring seamless operation and integration of various components.
 */

/**
 * @namespace InputInterface
 * @description Provides documentation for sensors, MIDI controllers, touch, and other user input mechanisms. 
 * This namespace focuses on capturing, processing, and responding to user interactions efficiently and intuitively.
 */

/**
 * @namespace 2DGUI
 * @description Handles all 2D graphical user interface elements, including sliders, buttons, knobs, and parameter displays. 
 * This namespace integrates WebAudioControls for creating custom, reusable components to control audio parameters seamlessly. 
 * Its focus is on interactive and visually appealing controls optimized for 2D environments.
 */

/**
 * @namespace 3DGUI
 * @description Manages 3D graphical user interface components, including interactive elements within 3D scenes. 
 * It integrates seamlessly with Three.js to provide immersive user interactions.
 */

/**
 * @namespace AudioEngine
 * @description Encapsulates the core logic for audio processing, synthesis, and playback. 
 * This namespace manages the Web Audio API and RNBO, sound engines, and audio parameters to create a dynamic sound environment.
 */
// -----------------------------
// Import Statements
// -----------------------------

// Scene and rendering utilities
import { initScene, initRenderer, addLights } from './Scene.js';

// Model loader
import { loadAndDisplayModel } from './Loaders.js';

// Data manager for handling application data
import { DataManager } from './DataManager.js';

// Constants for configuration and defaults
import { Constants, DEFAULT_TRACK_ID } from './Constants.js';

// Caching library
import lscache from 'lscache';

// Interaction and UI setup
import { setupInteractions, updateKnobsFromTrackData, applyColorsFromTrackData } from './Interaction.js';

// Audio player module
import { AudioPlayer } from './AudioPlayer.js';

// Button group module
import { ButtonGroup } from './ButtonGroup.js';

// Parameter manager for managing adjustable parameters
import { ParameterManager } from './ParameterManager.js';

// Mathematical transformations
import { logarithmic } from './Transformations.js';

// Notifications handler
import notifications from './AppNotifications.js';

// -----------------------------
// Initialization of Core Components
// -----------------------------

// Retrieve the canvas element for 3D rendering
const canvas3D = document.getElementById('canvas3D');

// Initialize the 3D scene, camera, and controls
const { scene, camera, controls } = initScene(canvas3D);

// Initialize the renderer for the scene
const renderer = initRenderer(canvas3D);

// Add lighting to the scene
addLights(scene);

// Instantiate the DataManager for handling track data
const dataManager = new DataManager();

// Instantiate the AudioPlayer for managing audio playback
const audioPlayer = new AudioPlayer();

// Instantiate the ParameterManager for managing adjustable parameters for user 1
const user1Manager = new ParameterManager();

// Flag to control the animation loop
let animationRunning = false;

// -----------------------------
// Application Initialization Function
// -----------------------------

/**
 * Initializes the application.
 * Fetches track data, sets up the scene, and configures interactions.
 * @async
 * @function initializeApp
 * @throws Will log an error if initialization fails.
 * @memberof CoreModule 
 */
async function initializeApp() {
    try {
        console.log('[APP] Starting application...');

        // Parse URL parameters to get the trackId, defaulting if not present
        const urlParams = new URLSearchParams(window.location.search);
        let trackId = urlParams.get('trackId') || DEFAULT_TRACK_ID;

        // Use DataManager to fetch and configure data for the given trackId
        await dataManager.fetchAndUpdateConfig(trackId);

        // Retrieve the updated track data from Constants
        const trackData = Constants.getTrackData(trackId);
        if (!trackData) {
            throw new Error('Failed to fetch track data.');
        }

        // Initialize root parameters based on the fetched track data
        initializeRootParams(user1Manager, trackData);

        // Apply visual and interactive settings based on track data
        applyColorsFromTrackData(trackData);
        updateKnobsFromTrackData(trackData);

        // Setup UI interactions and populate initial placeholders
        setupInteractions(dataManager, audioPlayer, user1Manager);
        dataManager.populatePlaceholders('monitorInfo');

        // Load and display the 3D model in the scene
        await loadAndDisplayModel(scene, trackData);
        console.log('[APP] Model loaded successfully.');
    } catch (error) {
        console.error('[APP] Error during application initialization:', error);
    }
}

// -----------------------------
// Parameter Initialization Function
// -----------------------------

/**
 * Initializes root parameters for the ParameterManager.
 * Dynamically maps parameters to the manager based on track data.
 * @memberof CoreModule 
 * @function initializeRootParams
 * @param {ParameterManager} parameterManager - Instance of the ParameterManager to configure.
 * @param {Object} trackData - Data for the current track.
 * @param {Object} trackData.soundEngine - Sound engine data for the track.
 * @param {Object} trackData.soundEngine.soundEngineParams - Parameters for the sound engine.
 */
function initializeRootParams(parameterManager, trackData) {
    const rootParams = ['x', 'y', 'z', 'body-level', 'body-envelope'];

    // Destructure x, y, z parameters from trackData
    const { x, y, z } = trackData.soundEngine.soundEngineParams;

    // Configuration object for parameters
    const paramConfigs = {
        x: { ...x }, // Example: { initValue: 1, min: -100, max: 100 }
        y: { ...y },
        z: { ...z },
        'body-level': { 
            initValue: 0.0, 
            min: -60, 
            max: 6, 
            scale: "logarithmic", // Scale type for transformations
            inputTransform: logarithmic.inverse, // Transformation for input
            outputTransform: logarithmic.forward  // Transformation for output
        }, 
        'body-envelope': { 
            initValue: 0, 
            min: -1, 
            max: 1,
        },
    };

    // Iterate through each root parameter and configure it
    rootParams.forEach((paramName) => {
        const config = paramConfigs[paramName];
        if (config) {
            const { initValue, min, max, scale, inputTransform, outputTransform } = config;

            // Validate the configuration parameters
            if (typeof initValue === 'number' && typeof min === 'number' && typeof max === 'number') {
                // Conditionally include transformation functions if they exist
                if (inputTransform && outputTransform) {
                    parameterManager.addParameter(
                        paramName,
                        initValue,
                        min,
                        max,
                        true, // Bidirectional parameter
                        scale,
                        inputTransform, // Input transformation function
                        outputTransform // Output transformation function
                    );
                    //console.debug(`[initializeRootParams] Added parameter '${paramName}' with transformations.`, config);
                } else {
                    // Add parameter without transformation functions, defaulting to linear scale
                    parameterManager.addParameter(
                        paramName,
                        initValue,
                        min,
                        max,
                        true // Bidirectional parameter
                        // inputTransform and outputTransform default to linear if not provided
                    );
                    //console.debug(`[initializeRootParams] Added parameter '${paramName}' without transformations.`, config);
                }
            } else {
                console.error(`[initializeRootParams] Invalid config for parameter: ${paramName}`, config);
            }
        } else {
            console.warn(`[initializeRootParams] Parameter '${paramName}' not found in configs.`);
        }
    });
}

// -----------------------------
// Window Resize Event Listener
// -----------------------------

/**
 * Adjusts renderer and camera settings on window resize.
 * Ensures the 3D scene adapts to viewport changes.
 * @memberof 3DGUI 
 */
window.addEventListener('resize', () => {
    const MIN_SIZE = 340; // Minimum frame size in pixels

    // Get the current viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Determine the width and height for the frame, enforcing minimum size
    const frameWidth = Math.max(viewportWidth, MIN_SIZE);
    const frameHeight = Math.max(viewportHeight, MIN_SIZE);

    // Resize the renderer to fit the current window size, respecting minimums
    renderer.setSize(frameWidth, frameHeight);

    // Adjust the camera's aspect ratio to match the new dimensions
    camera.aspect = frameWidth / frameHeight;
    camera.updateProjectionMatrix();

    // Set the pixel ratio for high-DPI screens, capped at 2 for performance
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    //console.log('[APP] Renderer and camera updated on resize.');
});

// -----------------------------
// Animation Loop Function
// -----------------------------

/**
 * Animation loop for the application.
 * Updates controls and renders the scene.
 * @function animate
 * @memberof 3DGUI 
 */
function animate() {
    controls.update(); // Update camera controls
    renderer.render(scene, camera); // Render the scene from the perspective of the camera
    requestAnimationFrame(animate); // Request the next frame
}

// -----------------------------
// Collapse Menu Alignment Function
// -----------------------------

/**
 * Sets up alignment for the information collapse menu.
 * Adjusts the menu's position based on window size and button position.
 * Attaches relevant event listeners for alignment updates.
 * @function setupCollapseMenuAlignment
 * @memberof 2DGUI 
 */
function setupCollapseMenuAlignment() {
    const infoButton = document.getElementById("informationMenuButton");
    const collapseMenu = document.getElementById("collapseInfoMenu");
    const headerRow = document.querySelector(".header-row");

    if (!infoButton || !collapseMenu || !headerRow) {
        console.error("Information button, collapse menu, or header row element not found.");
        return;
    }

    const verticalOffsetVH = 2; // Vertical offset in viewport height units
    const horizontalOffsetVW = -1; // Horizontal offset in viewport width units

    /**
     * Aligns the collapse menu relative to the information button.
     * @function alignCollapseMenu
     */
    const alignCollapseMenu = () => {
        const buttonRect = infoButton.getBoundingClientRect();
        const headerRect = headerRow.getBoundingClientRect();

        // Calculate top and left positions with offsets
        const calculatedTop = buttonRect.bottom - headerRect.top + (verticalOffsetVH * window.innerHeight) / 100;
        const calculatedLeft = buttonRect.left - headerRect.left + (horizontalOffsetVW * window.innerWidth) / 100;

        // Apply the calculated positions to the collapse menu
        collapseMenu.style.top = `${calculatedTop}px`;
        collapseMenu.style.left = `${calculatedLeft}px`;

        //console.debug('[APP] Collapse menu aligned:', { top: calculatedTop, left: calculatedLeft });
    };

    // Align initially
    alignCollapseMenu();

    // Adjust alignment on window resize
    window.addEventListener("resize", alignCollapseMenu);

    // Align collapse menu on information button click to handle dynamic changes
    infoButton.addEventListener("click", alignCollapseMenu);
}

// -----------------------------
// DOMContentLoaded Event Listener
// -----------------------------

/**
 * Executes when the DOM is fully loaded.
 * Initializes the application and starts the animation loop.
 * @memberof CoreModule 
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log("[APP] DOMContentLoaded: Application initialized.");

    // Initialize the application and start the animation loop upon successful initialization
    initializeApp().then(() => {
        console.log("[APP] Starting animation loop.");
        animate();
    });

    // Setup collapse menu alignment
    setupCollapseMenuAlignment();
});

// -----------------------------
// Module Exports
// -----------------------------

export { notifications, user1Manager };