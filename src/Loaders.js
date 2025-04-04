/**
 * @file Loaders.js
 * @version 1.0.0
 * @autor 𝐵𝓇𝓊𝓃𝒶 𝒢𝓊𝒶𝓇𝓃𝒾𝑒𝓇𝒾
 * @license MIT
 * @date 2024-12-07
 * @description Handles the loading and displaying of 3D models using Three.js and GLTFLoader with retry logic.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Constants } from './Constants.js';  

/**
 * Maximum number of retry attempts for loading a GLB model.
 * @constant
 * @type {number}
 */
const MAX_RETRIES = 3;

/**
 * Attempts to load a GLB model from a specified URL with retry logic.
 * Retries loading up to a maximum number of attempts if failures occur.
 * @memberof 3DGUI 
 * @async
 * @private
 * @param {string} url - The URL of the GLB model to load.
 * @param {number} [retries=MAX_RETRIES] - The maximum number of retry attempts.
 * @returns {Promise<THREE.Group>} - A promise that resolves to the loaded THREE.js Group containing the model.
 * @throws {Error} - Throws an error if the model fails to load after all retry attempts.
 *
 * @example
 * loadGLBModelWithRetry('path/to/model.glb')
 *   .then(model => {
 *     scene.add(model);
 *   })
 *   .catch(error => {
 *     console.error('Model failed to load:', error);
 *   });
 */
async function loadGLBModelWithRetry(url, retries = MAX_RETRIES) {
    const loader = new GLTFLoader();

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const gltf = await new Promise((resolve, reject) => {
                loader.load(url, resolve, undefined, reject);
            });
            //console.log(`[ModelLoader] Model loaded successfully on attempt ${attempt}`);
            return gltf.scene;
        } catch (error) {
            console.warn(`[ModelLoader] Attempt ${attempt} failed to load model from ${url}: ${error.message}`);
            if (attempt === retries) {
                throw new Error(`Failed to load model from ${url} after ${retries} attempts.`);
            }
        }
    }
}

/**
 * Loads and displays a GLB model within a Three.js scene using provided track data.
 * @memberof 3DGUI 
 * @async
 * @public
 * @param {THREE.Scene} scene - The Three.js scene to which the model will be added.
 * @param {object} trackData - The track data containing information about the interplanetary player.
 * @param {object} trackData.interplanetaryPlayer - The interplanetary player data.
 * @param {string} trackData.interplanetaryPlayer.modelURL - The URL of the GLB model to load.
 * @returns {Promise<void>} - A promise that resolves once the model is loaded and added to the scene.
 * @throws {Error} - Throws an error if the modelURL is missing or if loading fails.
 *
 * @example
 * const scene = new THREE.Scene();
 * const trackData = {
 *   interplanetaryPlayer: {
 *     modelURL: 'https://example.com/models/player.glb'
 *   }
 * };
 * 
 * loadAndDisplayModel(scene, trackData)
 *   .then(() => {
 *     //console.log('Model loaded and added to the scene.');
 *   })
 *   .catch(error => {
 *     console.error('Error loading model:', error);
 *   });
 */
export async function loadAndDisplayModel(scene, trackData) {
    try {
        const { interplanetaryPlayer } = trackData;
        const { modelURL } = interplanetaryPlayer;
        Constants.setLoadingState("modelLoaded", false); // ⏳ Start loading

        if (!modelURL) {
            throw new Error('Missing modelURL in interplanetaryPlayer data.');
        }

        //console.log('[ModelLoader] Initiating GLB model loading...');
        const model = await loadGLBModelWithRetry(modelURL);

        // Set the model's position or any other transformations if needed
        model.position.set(0, 0, 0);

        // Add the loaded model to the scene
        scene.add(model);
        Constants.setLoadingState("modelLoaded", true);

        //console.log('[ModelLoader] GLB model loaded and added to the scene successfully.');
    } catch (error) {
        console.error('[ModelLoader] Error loading GLB model:', error);
        throw error;
    }
}