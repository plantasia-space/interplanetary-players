// src/script.js

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

const MAX_RETRIES = 3; // Maximum number of retry attempts

// Helper function to get URL parameters
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Set default paths or retrieve from URL parameters
const modelPath = getUrlParameter('object') || `${import.meta.env.BASE_URL}models/d6fbd28b1af1_a_spherical_exoplan.obj`;
const texturePath = getUrlParameter('texture') || `${import.meta.env.BASE_URL}textures/d6fbd28b1af1_a_spherical_exoplan_texture_kd.jpg`;

// Scene
const scene = new THREE.Scene();
scene.background = null; // Transparent background

// Camera
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 2.5); // Closer initial position

// Renderer
const canvas = document.querySelector('.webgl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0); // Fully transparent background

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = false; // Disable panning
controls.minDistance = 1.5; // Minimum zoom distance
controls.maxDistance = 5; // Maximum zoom distance

// Load Texture with Error Handling
function loadTextureWithRetry(url, retries = MAX_RETRIES) {
    return new Promise((resolve, reject) => {
        const textureLoader = new THREE.TextureLoader();
        function attemptLoad(retryCount) {
            const texture = textureLoader.load(
                url,
                () => resolve(texture),
                undefined,
                (error) => {
                    console.warn(`Texture load failed, attempt ${retryCount + 1}/${retries}`);
                    if (retryCount < retries - 1) {
                        attemptLoad(retryCount + 1);
                    } else {
                        reject(new Error('Failed to load texture after multiple attempts'));
                    }
                }
            );
        }
        attemptLoad(0);
    });
}

// Load OBJ Model with Retry Logic
function loadModelWithRetry(url, retries = MAX_RETRIES) {
    return new Promise((resolve, reject) => {
        const loader = new OBJLoader();
        function attemptLoad(retryCount) {
            loader.load(
                url,
                (object) => resolve(object),
                undefined,
                (error) => {
                    console.warn(`Model load failed, attempt ${retryCount + 1}/${retries}`);
                    if (retryCount < retries - 1) {
                        attemptLoad(retryCount + 1);
                    } else {
                        reject(new Error('Failed to load model after multiple attempts'));
                    }
                }
            );
        }
        attemptLoad(0);
    });
}

// Load and Display Model with Texture
async function loadAndDisplayModel() {
    try {
        const texture = await loadTextureWithRetry(texturePath);
        const model = await loadModelWithRetry(modelPath);

        model.traverse((child) => {
            if (child.isMesh) {
                child.material = new THREE.MeshStandardMaterial({
                    map: texture,
                    flatShading: true,
                });
            }
        });
        model.position.set(0, 0, 0); // Center the object
        scene.add(model);
        console.log('Model and texture loaded successfully.');
    } catch (error) {
        console.error('Failed to load model or texture:', error);
    }
}

// Call function to load and display model
loadAndDisplayModel();

// Handle Window Resize
window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// Animation Loop
function animate() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

animate();
