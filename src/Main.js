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

// Import scene setup and space elements
import { initScene, initRenderer, addLights } from './Scene.js';
import { initSpaceScene } from './SceneSpace.js'; // ✅ This handles the cubemap loading!

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
import { SoundEngine } from './SoundEngine.js';

// Button group module
import { ButtonGroup } from './ButtonGroup.js';

// Button single module
import { ButtonSingle } from "./ButtonSingle.js";


// Parameter manager for managing adjustable parameters
import { ParameterManager } from './ParameterManager.js';

// Mathematical transformations
import { logarithmic } from './Transformations.js';

// Notifications handler
import notifications from './AppNotifications.js';


import { CosmicLFO } from './CosmicLFO.js';

// -----------------------------
// Initialization of Core Components
// -----------------------------

// Retrieve the canvas element for 3D rendering
const canvas3D = document.getElementById('canvas3D');

// Initialize the 3D scene, camera, and controls
const { scene, camera, controls, startAnimation } = initScene(canvas3D);

// Initialize the renderer for the scene
const renderer = initRenderer(canvas3D);

// ✅ Set the cubemap skybox
initSpaceScene(scene);



// Add lighting to the scene
addLights(scene);

// Instantiate the DataManager for handling track data
const dataManager = new DataManager();

// Instantiate the SoundEngine for managing audio playback
let user1SoundEngine;

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
      //console.log('[APP] Starting application...');
      const urlParams = new URLSearchParams(window.location.search);
      const trackId = urlParams.get('trackId') || DEFAULT_TRACK_ID;
      Constants.TRACK_ID = trackId;
  
      // Fetch configuration data and update cache, then fetch RNBO library
      await dataManager.fetchAndUpdateConfig(trackId);
      const cachedData = Constants.getTrackData(trackId);
  
      if (!cachedData) {
        throw new Error('Failed to fetch track data from cache.');
      }
  
      // Load RNBO library based on patcher version
      const rnbo = await loadRNBOLibrary(cachedData.soundEngine.soundEngineJSONURL);
  
      // Destructure the cached data
      const { track: trackData, soundEngine: soundEngineData, interplanetaryPlayer } = cachedData;
      if (interplanetaryPlayer && interplanetaryPlayer.exoplanetData) {
        const exoData = interplanetaryPlayer.exoplanetData;
        // Assign minimum cosmic LFO values to the CosmicLFO instances:
        // Assuming exoData is extracted from interplanetaryPlayer.exoplanetData:

        if (interplanetaryPlayer && interplanetaryPlayer.exoplanetData) {
            console.debug('[DEBUG] Exoplanet data loaded:', interplanetaryPlayer.exoplanetData);
          } else {
            console.error('[ERROR] Exoplanet data is missing or undefined.');
          }
          
        cosmicLFOManager.x.setExoFrequencies(exoData);
        cosmicLFOManager.y.setExoFrequencies(exoData);
        cosmicLFOManager.z.setExoFrequencies(exoData);
        
        cosmicLFOManager.x.attachTriggerSwitch('xCosmic1');
        cosmicLFOManager.x.attachTriggerSwitch('xCosmic2');
        cosmicLFOManager.y.attachTriggerSwitch('yCosmic1');
        cosmicLFOManager.y.attachTriggerSwitch('yCosmic2');
        cosmicLFOManager.z.attachTriggerSwitch('zCosmic1');
        cosmicLFOManager.z.attachTriggerSwitch('zCosmic2');

        ////console.log(`[APP] Set Cosmic LFO minimum values: X = ${exoData.currentExoplanet.minimum_cosmic_lfo}, Y = ${exoData.closestNeighbor1.minimum_cosmic_lfo}, Z = ${exoData.closestNeighbor2.minimum_cosmic_lfo}`);
      }
  
      // Initialize root parameters, apply colors, update knobs, etc.
      initializeRootParams(user1Manager, cachedData);
      applyColorsFromTrackData(cachedData);
      updateKnobsFromTrackData(cachedData);
  
      // Create the SoundEngine instance with the loaded RNBO library
      const ksteps = 255;
      user1SoundEngine = new SoundEngine(soundEngineData, trackData, user1Manager, ksteps, rnbo);
  
      
    // Attach the clean-up listener once the SoundEngine is created
    window.addEventListener('beforeunload', () => {
        if (user1SoundEngine) {
            user1SoundEngine.cleanUp();
        }
        });
        
      // Start preloading the audio buffer (but don’t play yet)
      await user1SoundEngine.preloadAndSuspend();
  
      // Now pass the SoundEngine instance into your UI setup.
      setupInteractions(dataManager, user1SoundEngine, user1Manager);
      dataManager.populatePlaceholders('monitorInfo');
  
      // Load and display the 3D model (your other initialization logic)
      await loadAndDisplayModel(scene, cachedData);
      //console.log('[APP] Model loaded successfully.');

        // ✅ Mark UI as ready
        Constants.setLoadingState("uiReady", true);
     
     
        const closeBtn = document.querySelector('.close-grid-btn');
        if (closeBtn) {
          setTimeout(() => {
            closeBtn.click();
            //console.log('[DataManager] Grid closed programmatically after data loaded.');
          }, 100);
        }
  
    } catch (error) {
      console.error('[APP] Error during application initialization:', error);
    }
  }
  
/**
 * Dynamically loads the RNBO library based on the patcher version.
 * @param {string} patchExportURL - URL to fetch the RNBO patcher.
 * @returns {Promise<object>} Resolves with the RNBO object after loading the script.
 */
async function loadRNBOLibrary(patchExportURL) {
    //console.log(`[RNBO] Fetching patch metadata from: ${patchExportURL}`);
    const response = await fetch(patchExportURL);
    if (!response.ok) {
        throw new Error(`[RNBO] Failed to fetch patcher: ${response.statusText}`);
    }
    const patcher = await response.json();
    const rnboversion = patcher.desc?.meta?.rnboversion;

    if (!rnboversion) {
        throw new Error("[RNBO] Version not found in patch metadata.");
    }

    const scriptUrl = `https://cdn.cycling74.com/rnbo/${rnboversion}/rnbo.min.js`;
    //console.log(`[RNBO] Loading script from: ${scriptUrl}`);

    await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = scriptUrl;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`[RNBO] Failed to load: ${scriptUrl}`));
        document.head.appendChild(script);
    });

    //console.log("[RNBO] RNBO script loaded successfully.");
    return window.RNBO;
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
    const rootParams = ['x', 'y', 'z', 'body-level', 'body-envelope', 'cosmic-radio-xyz'];

    // Destructure x, y, z parameters from trackData
    const { x, y, z } = trackData.soundEngine.soundEngineParams;

    // Configuration object for parameters
    const paramConfigs = {
        x: { ...x }, // Example: { initValue: 1, min: -100, max: 100 }
        y: { ...y },
        z: { ...z },
        'body-level': { 
            initValue: 0.5, 
            min: -60, 
            max: 6, 
            scale: "logarithmic", // Scale type for transformations
            inputTransform: logarithmic.inverwse, // Transformation for input
            outputTransform: logarithmic.forward  // Transformation for output
        }, 
        'body-envelope': { 
            initValue: 0, 
            min: -1, 
            max: 1,
        },
        'cosmic-radio-xyz': { 
            initValue: 0, // Default starting value
            min: 0, 
            max: 2,
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

    ////console.log('[APP] Renderer and camera updated on resize.');
});

// -----------------------------
// Animation Loop Function
// -----------------------------

/**
 * Animation loop for the application.
 * Updates controls and renders the scene.
 * @function animate
 */
function animate() {
    requestAnimationFrame(animate);

    // Apply rotation based on parameter values
    scene.rotation.x += rotationSpeedX;
    scene.rotation.y += rotationSpeedY;

    // Apply distance mapping
    camera.position.z = THREE.MathUtils.lerp(controls.minDistance, controls.maxDistance, distanceZ);

    controls.update();
    renderer.render(scene, camera);
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

    const verticalOffsetVH = 3; // Vertical offset in viewport height units
    const horizontalOffsetVW = 0; // Horizontal offset in viewport width units

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

        ////console.debug('[APP] Collapse menu aligned:', { top: calculatedTop, left: calculatedLeft });
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
    //console.log("[APP] DOMContentLoaded: Application initialized.");
    // CosmicLFO manager is already initialized and exported globally.
    
    // Initialize the app
    initializeApp().then(() => {
        //console.log("[APP] Starting animation loop.");
        startAnimation(renderer); // ✅ Start animation here!
    });

    // Setup collapse menu alignment
    setupCollapseMenuAlignment();
    

});

/**
 * Initializes the CosmicLFO instances for x, y, and z axes,
 * attaches their corresponding switch elements, and returns a manager object.
 * @returns {object} An object with properties x, y, z, startAll, and stopAll.
 */
function initializeCosmicLFOs() {
    // Instantiate the LFOs for each axis
    const cosmicLFO_X = new CosmicLFO('x');
    const cosmicLFO_Y = new CosmicLFO('y');
    const cosmicLFO_Z = new CosmicLFO('z');
  
    // Attach the switch controls to each LFO instance
    cosmicLFO_X.attachSwitch('xCosmicLFO');
    cosmicLFO_Y.attachSwitch('yCosmicLFO');
    cosmicLFO_Z.attachSwitch('zCosmicLFO');
  
    return {
      x: cosmicLFO_X,
      y: cosmicLFO_Y,
      z: cosmicLFO_Z,
      startAll() {
        cosmicLFO_X.start();
        cosmicLFO_Y.start();
        cosmicLFO_Z.start();
      },
      stopAll() {
        cosmicLFO_X.stop();
        cosmicLFO_Y.stop();
        cosmicLFO_Z.stop();
      }
    };
  }
  
  export const cosmicLFOManager = initializeCosmicLFOs();


/**
 * Toggles button state and logs action.
 * @param {HTMLElement} button - The button element to toggle.
 * @param {string} actionName - The name of the action for logging.
 */
function toggleButtonState(button, actionName) {
    button.classList.toggle("active");
    //console.log(`[APP] ${actionName} toggled:`, button.classList.contains("active"));
}

function updateLoadingScreen() {
    const loadingScreen = document.getElementById("loading-screen");
    if (!loadingScreen) return;

    // Get current loading state
    const loadingStates = Constants.getLoadingState();
    const totalSteps = Object.keys(loadingStates).length;
    const completedSteps = Object.values(loadingStates).filter(Boolean).length;

    // Determine current step message
    let message = "Initializing...";
    if (!loadingStates.trackLoaded) message = "Loading Track Data...";
    else if (!loadingStates.soundEngineLoaded) message = "Loading Sound Engine...";
    else if (!loadingStates.modelLoaded) message = "Loading 3D Model...";
    else if (!loadingStates.uiReady) message = "Finalizing User Interface...";

    // Check if the loading container already exists
    let loadingContainer = loadingScreen.querySelector(".loading-container");
    if (!loadingContainer) {
        // Create static structure only once
        loadingScreen.innerHTML = `
            <div class="loading-container">
                <div class="orbit-container">
                    <div class="orbit-dot"></div>
                </div>
                <div class="loading-text"></div>
            </div>
        `;
        loadingContainer = loadingScreen.querySelector(".loading-container");
    }
    
    // Update only the text element, leaving the spinner untouched
    const loadingText = loadingContainer.querySelector(".loading-text");
    loadingText.textContent = `${message} (${completedSteps}/${totalSteps})`;

    // Hide loading screen when done
    if (completedSteps === totalSteps) {
        loadingScreen.classList.add("hidden");
        setTimeout(() => {
            loadingScreen.style.display = "none";
        }, 500);
    }
}

// Expose updateLoadingScreen globally for Constants.js to use
window.updateLoadingScreen = updateLoadingScreen;

// -----------------------------
// Module Exports
// -----------------------------

export { notifications, user1Manager };