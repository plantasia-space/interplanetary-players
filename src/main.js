import { initScene, initCamera, initRenderer, addLights } from './scene.js';
import { loadAndDisplayModel } from './loaders.js';
import { DataManager } from './DataManager.js';
import { Constants, DEFAULT_TRACK_ID } from './Constants.js';
import lscache from 'lscache';

// Inicialización de la escena
const canvas = document.querySelector('.webgl');
const { scene, controls } = initScene(canvas);
const camera = initCamera();
const renderer = initRenderer(canvas);

addLights(scene);

// Instancia de DataManager
const dataManager = new DataManager();

/**
 * Inicializa la aplicación.
 */
async function initializeApp() {
    try {
        console.log('Starting application...');

        // Obtiene el trackId de la URL, usa el track por defecto si no está presente
        const urlParams = new URLSearchParams(window.location.search);
        let trackId = urlParams.get('trackId') || DEFAULT_TRACK_ID;

        console.log(`Using trackId: ${trackId}`);

        // Verifica si los datos están en el caché
        let trackData = lscache.get(trackId);
        if (trackData) {
            console.log('Track data retrieved from cache:', trackData);
        } else {
            console.log('Track data not in cache, fetching from server...');
            // Si no está en el caché, obtén los datos del servidor
            trackData = await dataManager.fetchTrackData(trackId);
            lscache.set(trackId, trackData, Constants.CACHE_EXPIRY_MINUTES);
            console.log('Track data cached:', trackData);
        }

        // Usa los datos del track
        Constants.TRACK_ID = trackId;
        Constants.TRACK_DATA = trackData;

        // Carga y muestra el modelo
        await loadAndDisplayModel(scene);

        console.log('Model loaded successfully.');
    } catch (error) {
        console.error('Error during application initialization:', error);
    }
}

// Manejo del cambio de tamaño de la ventana
window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// Bucle de animación
function animate() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

animate();
initializeApp();