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
 * @param {HTMLCanvasElement} canvas - The HTML canvas element where the scene will be rendered.
 * @returns {Object} An object containing { scene, camera, controls }.
 */
export function initScene(canvas) {
    const scene = new THREE.Scene(); // Background is now managed in SceneSpace.js

    const camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        0.1,
        10000
    );
    camera.position.set(0, 0, 100);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = 5;
    controls.maxDistance = 60;

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
        alpha: true,
        preserveDrawingBuffer: true, // Prevent downscaling
    });

    renderer.setPixelRatio(window.devicePixelRatio > 1 ? 2 : 1);
    renderer.setSize(window.innerWidth, window.innerHeight);
    return renderer;
}

/**
 * Adds ambient and directional lights to the scene.
 * @param {THREE.Scene} scene - The scene to which the lights will be added.
 */
export function addLights(scene) {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);
}

/**
 * Adjusts the camera and renderer settings when the window is resized.
 * @param {THREE.PerspectiveCamera} camera - The scene's camera.
 * @param {THREE.WebGLRenderer} renderer - The renderer.
 */
export function handleWindowResize(camera, renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}