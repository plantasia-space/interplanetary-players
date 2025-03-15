import * as THREE from 'three';

/**
 * Loads a high-quality cubemap texture from the provided new skybox images.
 * @returns {THREE.CubeTexture} The loaded cubemap texture.
 */
function loadCubemap() {
    const loader = new THREE.CubeTextureLoader();

    // Load the 6 cubemap faces using the correct order:
    const cubemap = loader.load([
        'https://mw-storage.fra1.cdn.digitaloceanspaces.com/default/skybox/01_skycube/right.png',  // Right (+X)
        'https://mw-storage.fra1.cdn.digitaloceanspaces.com/default/skybox/01_skycube/left.png',   // Left (-X)
        'https://mw-storage.fra1.cdn.digitaloceanspaces.com/default/skybox/01_skycube/top.png',    // Top (+Y)
        'https://mw-storage.fra1.cdn.digitaloceanspaces.com/default/skybox/01_skycube/bottom.png', // Bottom (-Y)
        'https://mw-storage.fra1.cdn.digitaloceanspaces.com/default/skybox/01_skycube/front.png',  // Front (+Z)
        'https://mw-storage.fra1.cdn.digitaloceanspaces.com/default/skybox/01_skycube/back.png'    // Back (-Z)
    ]);

    // ✅ Enhance Texture Quality
    cubemap.magFilter = THREE.LinearFilter;
    cubemap.minFilter = THREE.LinearMipMapLinearFilter;
    cubemap.generateMipmaps = true;
    cubemap.anisotropy = 16; // Improve texture sharpness

    return cubemap;
}

/**
 * Initializes the space scene by setting the high-quality cubemap skybox.
 * @param {THREE.Scene} scene - The Three.js scene.
 */
export function initSpaceScene(scene) {
    scene.background = loadCubemap();
}