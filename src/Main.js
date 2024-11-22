// src/Main.js
import { initScene, initRenderer, addLights } from './Scene.js';
import { loadAndDisplayModel } from './Loaders.js';
import { DataManager } from './DataManager.js';
import { Constants, DEFAULT_TRACK_ID } from './Constants.js';
import lscache from 'lscache';
import { setupInteractions } from './Interaction.js'; // Import Interaction.js

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

// Preserve Existing Canvas Interaction
canvas3D.addEventListener('mousedown', () => console.log('Canvas clicked!'));

// Initialize Application
async function initializeApp() {
    try {
        console.log('[APP] Starting application...');

        const urlParams = new URLSearchParams(window.location.search);
        let trackId = urlParams.get('trackId') || DEFAULT_TRACK_ID;

        console.log(`[APP] Using trackId: ${trackId}`);

        // Usar el DataManager para manejar fetch y configuración
        await dataManager.fetchAndUpdateConfig(trackId);

        // Verificar si los datos necesarios están completos
        if (!Constants.TRACK_DATA?.track || 
            !Constants.TRACK_DATA?.soundEngine || 
            !Constants.TRACK_DATA?.interplanetaryPlayer) {
            throw new Error('Missing required data fields in TRACK_DATA.');
        }

        console.log('[APP] TRACK_DATA confirmed:', Constants.TRACK_DATA);

        // Aplicar colores basados en TRACK_DATA
        Constants.applyColorsFromTrackData();

        // Llenar placeholders usando el tipo 'monitorInfo' por defecto (o el que necesites)
        setupInteractions(dataManager);
        dataManager.populatePlaceholders('monitorInfo');

        // Cargar el modelo y mostrarlo en la escena
        await loadAndDisplayModel(scene, Constants.TRACK_DATA);
        console.log('[APP] Model loaded successfully.');
    } catch (error) {
        console.error('[APP] Error during application initialization:', error);
    }
}

window.addEventListener('resize', () => {
    // Define the minimum size
    const MIN_SIZE = 320;

    // Get the smaller dimension of the viewport
    const size = Math.min(window.innerWidth, window.innerHeight);

    // Clamp the size to ensure it doesn't go below the minimum size
    const clampedSize = Math.max(size, MIN_SIZE);

    // Set the camera's aspect ratio to 1 for a square view
    camera.aspect = 1;
    camera.updateProjectionMatrix();

    // Resize the renderer to be square, but with a minimum size
    renderer.setSize(clampedSize, clampedSize);

    // Set the pixel ratio for high-DPI screens, but limit to 2 for performance
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});


function animate() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

initializeApp().then(animate);
