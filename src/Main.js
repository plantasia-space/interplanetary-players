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
import { logarithmic, exponential } from './Transformations.js';

// Initialize the scene
const canvas3D = document.getElementById('canvas3D');
const { scene, camera, controls } = initScene(canvas3D);
const renderer = initRenderer(canvas3D);

addLights(scene);

const dataManager = new DataManager();
const audioPlayer = new AudioPlayer(); // Instantiate AudioPlayer

const user1Manager = new ParameterManager();

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

        initializeRootParams(user1Manager, trackData);

        // Apply colors and update knobs
        applyColorsFromTrackData(trackData);
        updateKnobsFromTrackData(trackData);
        //window.webAudioControlsWidgetManager.setTrackId(trackId);

        // Populate placeholders
        setupInteractions(dataManager, audioPlayer);
        dataManager.populatePlaceholders('monitorInfo');
        console.log("setted parameters", user1Manager.listParameters());
        // Load the model and display it in the scene
        await loadAndDisplayModel(scene, trackData);
        console.log('[APP] Model loaded successfully.');
    } catch (error) {
        console.error('[APP] Error during application initialization:', error);
    }
}


function initializeRootParams(parameterManager, trackData) {
    const rootParams = ['x', 'y', 'z', 'body-level', 'body-envelope'];
  
    // Extract x, y, z from trackData dynamically
    const { x, y, z } = trackData.soundEngine.soundEngineParams;
  
    // Map for parameter initialization
    const paramConfigs = {
      x: { ...x }, // Example: { initValue: 1, min: -100, max: 100 }
      y: { ...y },
      z: { ...z },
      'body-level': { 
        initValue: 0.0, 
        min: -60, 
        max: 6, 
        inputTransform: logarithmic.inverse, // Correctly named key
        outputTransform: logarithmic.forward  // Correctly named key
      }, 
      'body-envelope': { 
        initValue: 0, 
        min: -1, 
        max: 1,
      },
    };
    
    console.log("1", logarithmic.inverse);
    console.log("[paramConfigs:", paramConfigs);
  
    // Iterate through rootParams and add them to ParameterManager
    rootParams.forEach((paramName) => {
      const config = paramConfigs[paramName];
      if (config) {
        const { initValue, min, max, inputTransform, outputTransform } = config;
  
        // Validate the configuration
        if (typeof initValue === 'number' && typeof min === 'number' && typeof max === 'number') {
          // Conditionally pass transformation functions if they exist
          if (inputTransform && outputTransform) {
            parameterManager.addParameter(
              paramName,
              initValue,
              min,
              max,
              true, // Bidirectional = true
              inputTransform, // Pass inputTransform
              outputTransform // Pass outputTransform
            );
            console.debug(`[initializeRootParams] Added/Updated parameter '${paramName}' with transformations.`, config);
          } else {
            // If no transformation functions are provided, use defaults
            parameterManager.addParameter(
              paramName,
              initValue,
              min,
              max,
              true // Bidirectional = true
              // inputTransform and outputTransform default to linear
            );
            console.debug(`[initializeRootParams] Added/Updated parameter '${paramName}' without transformations.`, config);
          }
        } else {
          console.error(`[initializeRootParams] Invalid config for parameter: ${paramName}`, config);
        }
      } else {
        console.warn(`[initializeRootParams] Parameter '${paramName}' not found in configs.`);
      }
    });
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


    // Setup collapse menu alignment
    setupCollapseMenuAlignment();

  

});

export { user1Manager };
