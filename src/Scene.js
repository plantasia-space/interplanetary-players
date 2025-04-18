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

// ---------- Configurable Parameters ----------
// Initial camera placement
const INITIAL_CAMERA_POSITION = new THREE.Vector3(0, 0, 2);
// Min/max camera radius for zoom control
const CAMERA_RADIUS_MIN       = 1;
const CAMERA_RADIUS_MAX       = 4;



// History layering settings
const MAX_HISTORY             = 4096;   // how many frames to keep in memory
// Orbit head speed: how many history writes (frames) constitute one full revolution
const ORBITAL_SPEED_FRAMES    = 2048;  // at 30fps, 240 frames ≈ 8s per orbit
// Spiral groove rotation per layer
const ROTATION_STEP           = (4 * Math.PI) / ORBITAL_SPEED_FRAMES;
// Oscilloscope ring settings
const ORBIT_RADIUS            = 1.5;  // base radius of the ring
const ORBIT_SEGMENTS          = 512;  // number of segments (higher = smoother) 
const AMPLITUDE_SCALE         = 0.30;  // height of waveform deviation
// — global reference for layering history —
let globalScene = null;
// — store past ring meshes for histogram effect —
const ringHistory = [];

// inward step per history layer; positive value shrinks inward each cycle
const LAYER_OFFSET = 0.0001;  // adjust smaller for slower inward movement

// Read CSS variable --color1 for orbit color
const _rootStyles = getComputedStyle(document.documentElement);
const cssColor1 = _rootStyles.getPropertyValue('--color1').trim();
const orbitColor = new THREE.Color(cssColor1);
// Apply fixed alpha to orbit material
let orbitAlpha = 0.1;

console.log("ROTATION STEP", ROTATION_STEP);
/**
 * Refresh the orbitColor and orbitAlpha from the CSS variable --color1.
 */
export function updateOrbitColor() {
  const css = getComputedStyle(document.documentElement)
    .getPropertyValue('--color2').trim();
  
  const rgbaMatch = css.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1], 10) / 255;
    const g = parseInt(rgbaMatch[2], 10) / 255;
    const b = parseInt(rgbaMatch[3], 10) / 255;
    const a = orbitAlpha;

    orbitColor.setRGB(r, g, b);

    console.log('[Scene] updateOrbitColor parsed:', css, '→ RGB:', orbitColor, 'Alpha:', orbitAlpha);
  } else {
    console.warn('[Scene] updateOrbitColor could not parse:', css);
  }
}

/* ---------- Oscilloscope ring globals ---------- */
let   orbitGeometry = null; // will hold BufferGeometry instance
// — amplitude history for oscilloscope ring —
const ampHistory = [];


export function initScene(canvas) {
  const scene = new THREE.Scene();
  globalScene = scene;

  /* ---------- create initial oscilloscope line ---------- */
  orbitGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(ORBIT_SEGMENTS * 3);
  for (let i = 0; i < ORBIT_SEGMENTS; i++) {
      const theta = (i / ORBIT_SEGMENTS) * Math.PI * 2;
      positions[i * 3]     = ORBIT_RADIUS * Math.cos(theta);
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = ORBIT_RADIUS * Math.sin(theta);
  }
  orbitGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  orbitGeometry.computeBoundingSphere();
      // add per-vertex color buffer
      const colors = new Float32Array(ORBIT_SEGMENTS * 3);
      orbitGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const orbitMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: orbitAlpha });
  const orbitLine     = new THREE.LineLoop(orbitGeometry, orbitMaterial);



  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    10000
  );
  camera.position.copy(INITIAL_CAMERA_POSITION);

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
        azimuthSpeed = (normalizedX - 0.3) * 0.01;
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
        userRadius = THREE.MathUtils.lerp(CAMERA_RADIUS_MAX, CAMERA_RADIUS_MIN, normZ); // Adjust camera zoom dynamically
      }
    },
    'z'
  );

  let isAnimating = false;



  
  function startAnimation(renderer, onFrame) {
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
      if (typeof onFrame === 'function') {
        onFrame();
      }
    }
    animate();
  }

  return { scene, camera, startAnimation };
}
function drawRing(amplitude) {
  // record the latest amplitude
  ampHistory.push(amplitude);
  if (ampHistory.length > ORBIT_SEGMENTS) ampHistory.shift();

  if (!orbitGeometry) {
    console.warn("[Scene] drawRing() – no geometry");
    return;
  }

  const positions = orbitGeometry.attributes.position.array;
  const colors    = orbitGeometry.attributes.color.array;
  const angleInc  = (2 * Math.PI) / ORBIT_SEGMENTS;
  // amplitude deviation height
  const scale     = AMPLITUDE_SCALE;
  // — how much to step each old ring inward (world units)
  // (layerOffset now declared globally)

    for (let i = 0; i < ORBIT_SEGMENTS; i++) {
      const amp   = ampHistory[i] ?? 0;
      const theta = i * angleInc;
      const yDev  = amp * scale; // vertical deviation

      // update vertex position: fixed-radius circle + vertical wiggle
      positions[i * 3]     = ORBIT_RADIUS * Math.cos(theta);
      positions[i * 3 + 1] = yDev;
      positions[i * 3 + 2] = ORBIT_RADIUS * Math.sin(theta);

      // use single CSS color for orbit
      colors[i * 3]     = orbitColor.r;
      colors[i * 3 + 1] = orbitColor.g;
      colors[i * 3 + 2] = orbitColor.b;
    }

  // upload updates
  orbitGeometry.attributes.position.needsUpdate = true;
  orbitGeometry.attributes.color.needsUpdate    = true;
  // — clone for histogram layering —
    // — clone for histogram layering —
    const histPositions = orbitGeometry.attributes.position.array.slice();
    const histColors    = orbitGeometry.attributes.color.array.slice();
    // — radial decrement + rotation per layer (spiral groove) —
    const historyIndex = ringHistory.length;  // 0 = newest
    // clamp to max history so rings never expand again
    const layerIndex = Math.min(historyIndex, MAX_HISTORY - 1);
    for (let i = 0; i < histPositions.length; i += 3) {
      const x         = histPositions[i];
      const y         = histPositions[i + 1];
      const z         = histPositions[i + 2];
      const baseAngle = Math.atan2(z, x);
      const r0        = Math.hypot(x, z);
      // newest at full ORBIT_RADIUS, then shrink inward per layerIndex
      const r1        = ORBIT_RADIUS - LAYER_OFFSET * layerIndex;
      const spAngle   = baseAngle + ROTATION_STEP * layerIndex;
      histPositions[i]     = r1 * Math.cos(spAngle);
      histPositions[i + 1] = y;
      histPositions[i + 2] = r1 * Math.sin(spAngle);
    }
    // — create history mesh —
    const histGeo = new THREE.BufferGeometry();
    histGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(histPositions), 3));
    histGeo.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(histColors),    3));
  const histMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent:  true,
    opacity:      orbitAlpha
  });
  const histLine = new THREE.LineLoop(histGeo, histMat);
  globalScene.add(histLine);
  ringHistory.push(histLine);
  // if (ringHistory.length > MAX_HISTORY) {
  //   const old = ringHistory.shift();
  //   globalScene.remove(old);
  //   old.geometry.dispose();
  //   old.material.dispose();
  // }
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

export { drawRing };