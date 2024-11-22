import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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

export function addLights(scene) {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Ambient light
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Directional light
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);
}