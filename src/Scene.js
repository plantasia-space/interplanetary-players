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
import { ParameterManager } from './ParameterManager.js';
import { getPlaybackState } from "./Constants.js";

export function initScene(canvas) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    10000
  );
  camera.position.set(0, 0, 6);

  const paramManager = ParameterManager.getInstance();
  const spherical = new THREE.Spherical();
  spherical.setFromVector3(camera.position);

  let azimuthSpeed = 0;
  let polarSpeed = 0;
  let userRadius  = spherical.radius;

  // X => horizontal rotation speed
  paramManager.subscribe(
    {
      onParameterChanged: (paramName, rawValue) => {
        const normalizedX = paramManager.getNormalizedValue('x');
        azimuthSpeed = (normalizedX - 0.5) * 0.01;
      }
    },
    'x'
  );

  // Y => vertical rotation speed
  paramManager.subscribe(
    {
      onParameterChanged: (paramName, rawValue) => {
        const normalizedY = paramManager.getNormalizedValue('y');
        polarSpeed = (normalizedY - 0.5) * 0.003;
      }
    },
    'y'
  );

  // Z => distance
  paramManager.subscribe(
    {
      onParameterChanged: (paramName, rawValue) => {
        const normZ = paramManager.getNormalizedValue('z');
        userRadius = THREE.MathUtils.lerp(10, 2, normZ); // Adjust camera zoom dynamically
      }
    },
    'z'
  );

  let isAnimating = false;



  
  function startAnimation(renderer) {
    function animate() {
      requestAnimationFrame(animate);

      const playbackState = getPlaybackState();

      if (playbackState === "playing") {
        if (!isAnimating) {
          console.log("[Scene] Resuming animation...");
          isAnimating = true;
        }


        
        // Apply updates only if playing
        spherical.theta += azimuthSpeed;
        spherical.phi   += polarSpeed;
        spherical.radius += (userRadius - spherical.radius) * 0.1;

        camera.position.setFromSpherical(spherical);
        camera.lookAt(new THREE.Vector3(0, 0, 0));
      } else {
        if (isAnimating) {
          console.log(`[Scene] Animation paused at ${playbackState}.`);
          isAnimating = false;
        }
      }

      renderer.render(scene, camera);
    }
    animate();
  }

  return { scene, camera, startAnimation };
}
function drawRing(amplitude) {
  // Verificamos que orbitGeometry esté definida
  if (!orbitGeometry) {
    console.warn("orbitGeometry no está definido.");
    return;
  }
  const positions = orbitGeometry.attributes.position.array;
  for (let i = 0; i < orbitSegments; i++) {
    const theta = (i / orbitSegments) * 2 * Math.PI;
    // Modulación: se incrementa el radio base en función de la amplitud recibida.
    // El factor (0.5 en este caso) se puede ajustar según lo deseado.
    const modulatedRadius = orbitRadius * (1 + amplitude * 0.5);
    positions[i * 3] = modulatedRadius * Math.cos(theta);
    // La componente Y se mantiene en 0 para que el anillo siga siendo plano
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = modulatedRadius * Math.sin(theta);
  }
  // Avisamos a Three.js que se actualizó el atributo de posición
  orbitGeometry.attributes.position.needsUpdate = true;
}

/**
 * Initializes the Three.js WebGL renderer.
 * @param {HTMLCanvasElement} canvas - The HTML canvas element where the scene will be rendered.
 * @returns {THREE.WebGLRenderer} The initialized renderer.
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