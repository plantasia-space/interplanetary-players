import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { Constants } from './Constants.js';

const MAX_RETRIES = 3;

/**
 * Retry loading a texture from a URL.
 * @param {string} url - The URL of the texture.
 * @param {number} retries - Maximum number of retries.
 * @returns {Promise<THREE.Texture>}
 */
async function loadTextureWithRetry(url, retries = MAX_RETRIES) {
    const textureLoader = new THREE.TextureLoader();
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const texture = await new Promise((resolve, reject) => {
                textureLoader.load(url, resolve, undefined, reject);
            });
            return texture;
        } catch {
            console.warn(`Retrying texture load (${attempt + 1}/${retries})`);
        }
    }
    throw new Error('Failed to load texture after multiple attempts');
}

/**
 * Retry loading a 3D model from a URL.
 * @param {string} url - The URL of the model.
 * @param {number} retries - Maximum number of retries.
 * @returns {Promise<THREE.Group>}
 */
async function loadModelWithRetry(url, retries = MAX_RETRIES) {
    const loader = new OBJLoader();
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const model = await new Promise((resolve, reject) => {
                loader.load(url, resolve, undefined, reject);
            });
            return model;
        } catch {
            console.warn(`Retrying model load (${attempt + 1}/${retries})`);
        }
    }
    throw new Error('Failed to load model after multiple attempts');
}

/**
 * Loads and displays the model and texture using the interplanetaryPlayer data.
 * @param {THREE.Scene} scene - The THREE.js scene to add the model to.
 */
export async function loadAndDisplayModel(scene, trackData) {
    try {
        const { interplanetaryPlayer } = trackData;
        const { modelURL, textureURL } = interplanetaryPlayer;

        if (!modelURL || !textureURL) {
            throw new Error('Missing modelURL or textureURL in interplanetaryPlayer data.');
        }

        console.log('[ModelLoader] Loading model and texture...');
        const model = await loadModelWithRetry(modelURL);
        const texture = await loadTextureWithRetry(textureURL);

        model.traverse((child) => {
            if (child.isMesh) {
                child.material = new THREE.MeshStandardMaterial({
                    map: texture,
                    flatShading: true,
                });
            }
        });

        model.position.set(0, 0, 0);
        scene.add(model);

        console.log('[ModelLoader] Model and texture loaded successfully.');
    } catch (error) {
        console.error('[ModelLoader] Error loading model or texture:', error);
        throw error;
    }
}