import { initScene, initRenderer, addLights } from './Scene.js';
import { loadAndDisplayModel } from './Loaders.js';
import { DataManager } from './DataManager.js';
import { Constants, DEFAULT_TRACK_ID } from './Constants.js';
import lscache from 'lscache';

// Initialize the scene
const canvas = document.querySelector('.webgl');
const { scene, camera, controls } = initScene(canvas);
const renderer = initRenderer(canvas);

addLights(scene);

const dataManager = new DataManager();

async function initializeApp() {
    try {
        console.log('[APP] Starting application...');

        const urlParams = new URLSearchParams(window.location.search);
        let trackId = urlParams.get('trackId') || DEFAULT_TRACK_ID;

        console.log(`[APP] Using trackId: ${trackId}`);

        let trackData = lscache.get(trackId);
        if (!trackData) {
            console.log('[APP] Track data not in cache. Fetching from server...');
            trackData = await dataManager.fetchTrackData(trackId);
            lscache.set(trackId, trackData, Constants.CACHE_EXPIRY_MINUTES);
        } else {
            console.log('[APP] Track data retrieved from cache:', trackData);
        }

        if (!trackData.track || !trackData.soundEngine || !trackData.interplanetaryPlayer) {
            throw new Error('Missing required data fields in trackData.');
        }

        Constants.TRACK_ID = trackId;
        Constants.TRACK_DATA = trackData;

        await loadAndDisplayModel(scene, trackData);
        console.log('[APP] Model loaded successfully.');
    } catch (error) {
        console.error('[APP] Error during application initialization:', error);
    }
}

window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

function animate() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

animate();
initializeApp();