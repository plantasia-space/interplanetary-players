// src/Scene.js

/**
 * @file Scene.js
 * @version 2.0.0
 * @autor 𝐵𝓇𝓊𝓃𝒶 𝒢𝓊𝒶𝓇𝓃𝒾𝑒𝓇𝒾
 * @license MIT
 * @date 2024-12-08
 * @example
 * // Example of initializing the scene, renderer, and adding lights
 * import { initScene, initRenderer, addLights } from './Scene.js';
 * 
 * const canvas = document.getElementById('three-canvas');
 * 
 * const { scene, camera, controls } = initScene(canvas);
 * const renderer = initRenderer(canvas);
 * 
 * addLights(scene);
 * 
 * function animate() {
 *   requestAnimationFrame(animate);
 *   controls.update();
 *   renderer.render(scene, camera);
 * }
 * animate();
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Initializes the Three.js scene, camera, and orbit controls.
 * Sets up the basic 3D environment with a perspective camera and orbit controls for user interaction.
 * @memberof 3DGUI 
 * Provides functions to set up the 3D environment for rendering objects. 
 * @function initScene
 * @param {HTMLCanvasElement} canvas - The HTML canvas element where the scene will be rendered.
 * 
 * @returns {Object} An object containing the initialized `scene`, `camera`, and `controls`.
 * @property {THREE.Scene} scene - The Three.js scene object.
 * @property {THREE.PerspectiveCamera} camera - The perspective camera used to view the scene.
 * @property {OrbitControls} controls - The orbit controls for user interaction with the camera.
 * 
 * @example
 * const canvas = document.getElementById('three-canvas');
 * const { scene, camera, controls } = initScene(canvas);
 */
export function initScene(canvas) {
    const scene = new THREE.Scene();
    scene.background = null; // Transparent background

    const camera = new THREE.PerspectiveCamera(
        45, 
        window.innerWidth / window.innerHeight, // Aspect ratio based on initial window size
        0.1, 
        1000
    );
    camera.position.set(0, 0, 10); // Initial position

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = 0.1;
    controls.maxDistance = 50;

    return { scene, camera, controls };
}

/**
 * Initializes the Three.js WebGL renderer.
 * Configures the renderer with antialiasing and transparency, and sets its size and pixel ratio.
 * @memberof 3DGUI 
 * @function initRenderer
 * @param {HTMLCanvasElement} canvas - The HTML canvas element where the scene will be rendered.
 * 
 * @returns {THREE.WebGLRenderer} The initialized Three.js WebGL renderer.
 * 
 * @example
 * const canvas = document.getElementById('three-canvas');
 * const renderer = initRenderer(canvas);
 */
export function initRenderer(canvas) {
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true, // Transparent background
    });

    // Initialize size and pixel ratio
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 1); // Transparent black background

    return renderer;
}

/**
 * Adds ambient and directional lights to the Three.js scene.
 * Enhances the visibility and depth of objects within the scene.
 * @memberof 3DGUI 
 * @function addLights
 * @param {THREE.Scene} scene - The Three.js scene to which the lights will be added.
 * 
 * @returns {void}
 * 
 * @example
 * const { scene } = initScene(canvas);
 * addLights(scene);
 */
export function addLights(scene) {
    /**
     * Ambient light provides a base level of light uniformly across the scene.
     * @type {THREE.AmbientLight}
     */
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Ambient light
    scene.add(ambientLight);

    /**
     * Directional light simulates sunlight, casting shadows and providing directional illumination.
     * @type {THREE.DirectionalLight}
     */
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Directional light
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);
}

/**
 * Handles window resize events to adjust the camera aspect ratio and renderer size accordingly.
 * Ensures the 3D scene remains properly scaled and proportioned when the browser window size changes.
 * @memberof 3DGUI 
 * @function handleWindowResize
 * @param {THREE.PerspectiveCamera} camera - The perspective camera to be updated.
 * @param {THREE.WebGLRenderer} renderer - The renderer to be resized.
 * 
 * @returns {void}
 * 
 * @example
 * window.addEventListener('resize', () => {
 *   handleWindowResize(camera, renderer);
 * });
 */
export function handleWindowResize(camera, renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}