import * as THREE from 'three';

/**
 * Loads a high-quality cubemap texture from the provided Tycho skybox images.
 * @returns {THREE.CubeTexture} The loaded cubemap texture.
 */
function loadCubemap() {
    const loader = new THREE.CubeTextureLoader();
    
    // Load the 6 cubemap faces from the given URLs
    const cubemap = loader.load([
        'https://mw-storage.fra1.cdn.digitaloceanspaces.com/default/skybox/15-mar-2025-tycho-sky-cubemap/lo-size/px.jpg', // Right (+X)
        'https://mw-storage.fra1.cdn.digitaloceanspaces.com/default/skybox/15-mar-2025-tycho-sky-cubemap/lo-size/nx.jpg', // Left (-X)
        'https://mw-storage.fra1.cdn.digitaloceanspaces.com/default/skybox/15-mar-2025-tycho-sky-cubemap/lo-size/py.jpg', // Top (+Y)
        'https://mw-storage.fra1.cdn.digitaloceanspaces.com/default/skybox/15-mar-2025-tycho-sky-cubemap/lo-size/ny.jpg', // Bottom (-Y)
        'https://mw-storage.fra1.cdn.digitaloceanspaces.com/default/skybox/15-mar-2025-tycho-sky-cubemap/lo-size/pz.jpg', // Front (+Z)
        'https://mw-storage.fra1.cdn.digitaloceanspaces.com/default/skybox/15-mar-2025-tycho-sky-cubemap/lo-size/nz.jpg'  // Back (-Z)
    ]);

    // ✅ Force high-quality texture filtering
    cubemap.magFilter = THREE.LinearFilter;
    cubemap.minFilter = THREE.LinearMipMapLinearFilter;
    cubemap.generateMipmaps = true;
    cubemap.anisotropy = 16; // Max anisotropic filtering

    return cubemap;
}

/**
 * Initializes the space scene by setting the high-quality cubemap skybox.
 * @param {THREE.Scene} scene - The Three.js scene.
 */
export function initSpaceScene(scene) {
    scene.background = loadCubemap();
}