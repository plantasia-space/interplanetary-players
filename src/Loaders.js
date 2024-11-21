import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const MAX_RETRIES = 3;

/**
 * Retry loading a 3D model from a URL.
 * @param {string} url - The URL of the GLB model.
 * @param {number} retries - Maximum number of retries.
 * @returns {Promise<THREE.Group>}
 */
async function loadGLBModelWithRetry(url, retries = MAX_RETRIES) {
    const loader = new GLTFLoader();
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const gltf = await new Promise((resolve, reject) => {
                loader.load(url, resolve, undefined, reject);
            });
            return gltf.scene;
        } catch {
            console.warn(`Retrying model load (${attempt + 1}/${retries})`);
        }
    }
    throw new Error('Failed to load model after multiple attempts');
}

/**
 * Loads and displays the GLB model using the interplanetaryPlayer data.
 * @param {THREE.Scene} scene - The THREE.js scene to add the model to.
 */
export async function loadAndDisplayModel(scene, trackData) {
    try {
        const { interplanetaryPlayer } = trackData;
        const { modelURL } = interplanetaryPlayer;

        if (!modelURL) {
            throw new Error('Missing modelURL in interplanetaryPlayer data.');
        }

        console.log('[ModelLoader] Loading GLB model...');
        const model = await loadGLBModelWithRetry(modelURL);

        model.position.set(0, 0, 0);
        scene.add(model);

        console.log('[ModelLoader] GLB model loaded successfully.');
    } catch (error) {
        console.error('[ModelLoader] Error loading GLB model:', error);
        throw error;
    }
}