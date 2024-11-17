import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function initScene(canvas) {
    const scene = new THREE.Scene();
    scene.background = null; // Transparent background

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 10); // Initial position

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false; // Disable panning
    controls.enableZoom = true; // Ensure zoom is enabled
    controls.minDistance = 0.1; // Minimum zoom distance
    controls.maxDistance = 50; // Maximum zoom distance


    return { scene, camera, controls };
}

export function initCamera() {
    const camera = new THREE.PerspectiveCamera(
        45, // Ángulo de visión
        window.innerWidth / window.innerHeight, // Relación de aspecto
        0.1, // Distancia mínima visible
        1000 // Distancia máxima visible
    );
    camera.position.set(0, 0, 10); // Posición inicial de la cámara
    return camera;
}

export function initRenderer(canvas) {
    const renderer = new THREE.WebGLRenderer({
        canvas, // Canvas al que se asigna
        antialias: true, // Suavizado de bordes
        alpha: true, // Fondo transparente
    });
    renderer.setSize(window.innerWidth, window.innerHeight); // Tamaño del renderizado
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Relación de píxeles
    renderer.setClearColor(0x000000, 0); // Fondo transparente (color negro, 0 opacidad)
    return renderer;
}

export function addLights(scene) {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Luz ambiental
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Luz direccional
    directionalLight.position.set(5, 10, 7.5); // Posición de la luz direccional
    scene.add(directionalLight);
}