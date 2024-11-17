import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

const MAX_RETRIES = 3;

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

export async function loadAndDisplayModel(scene) {
    const modelPath = getUrlParameter('object') || `${import.meta.env.BASE_URL}models/d6fbd28b1af1_a_spherical_exoplan.obj`;
    const texturePath = getUrlParameter('texture') || `${import.meta.env.BASE_URL}textures/d6fbd28b1af1_a_spherical_exoplan_texture_kd.jpg`;
    
    console.log('Model Path:', modelPath);
    console.log('Texture Path:', texturePath);
    
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

    model.position.set(0, 0, 0);
    scene.add(model);
    console.log('Model and texture loaded successfully.');
}

function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}