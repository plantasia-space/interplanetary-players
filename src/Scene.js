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

// ----- History settings -----
const MAX_HISTORY_RINGS = 64;   // keep last 64 orbits (~64 × 6 KiB ≈ 384 KiB GPU)
const HISTORY_INTERVAL = 4;   // copy current ring to pool every 2 updates

// Spiral groove rotation per layer
// Oscilloscope ring settings
const ORBIT_RADIUS            = 1.0;  // base radius of the ring
const ORBIT_SEGMENTS          = 256;  // number of segments (higher = smoother)
const AMPLITUDE_SCALE         = 7;  // height of waveform deviation
// — global reference for layering history —
let globalScene = null;
// tilt & visibility control
let ringGroup = null;
const ORBIT_TILT_DEG = 15; // tilt angle in degrees
let firstDrawDone = false;
let orbitLineRef = null;
// — store past ring meshes for histogram effect —
let drawRingFrameCounter = 0;

// inward step per history layer; positive value shrinks inward each cycle
const LAYER_OFFSET = 0.000001;  // adjust smaller for slower inward movement
// how much the ring radius shrinks per frame (spiral effect)
let spiralOffset = 0;
const ringPool = [];
let ringPoolIndex = 0;

// Read CSS variable --color1 for orbit color
const _rootStyles = getComputedStyle(document.documentElement);
const cssColor1 = _rootStyles.getPropertyValue('--color1').trim();
const orbitColor = new THREE.Color(cssColor1);
// Apply fixed alpha to orbit material
let orbitAlpha = 1.0;  // fully opaque for testing

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
  // setup tilted group for ring + history
  ringGroup = new THREE.Group();
  ringGroup.rotation.x = THREE.MathUtils.degToRad(ORBIT_TILT_DEG);

  /* ---------- create initial oscilloscope line ---------- */
  orbitGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(ORBIT_SEGMENTS * 3);
  positions.fill(0);
  const colors = new Float32Array(ORBIT_SEGMENTS * 3);
 // colors.fill(1); // initialize white
  for (let i = 0; i < ORBIT_SEGMENTS; i++) {
      const theta = (i / ORBIT_SEGMENTS) * Math.PI * 2;
      positions[i * 3]     = ORBIT_RADIUS * Math.cos(theta);
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = ORBIT_RADIUS * Math.sin(theta);
  }
  orbitGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  orbitGeometry.computeBoundingSphere();
      // add per-vertex color buffer
      orbitGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const orbitMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: orbitAlpha,
    linewidth: 2  // thicker line for visibility
  });
  const orbitLine     = new THREE.LineLoop(orbitGeometry, orbitMaterial);
  orbitLine.visible = false; // hide until first play
  orbitLineRef = orbitLine;
  ringGroup.add(orbitLine);
  
  // pre‑allocate history rings (reused in a circular pool)
  for (let i = 0; i < MAX_HISTORY_RINGS; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ORBIT_SEGMENTS * 3), 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(ORBIT_SEGMENTS * 3), 3));
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.25 });
    const mesh = new THREE.LineLoop(geo, mat);
    mesh.visible = false;        // invisible until used
    ringPool.push(mesh);
    ringGroup.add(mesh);
  }
  // add the tilted group once
  scene.add(ringGroup);



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
  if (getPlaybackState() !== "playing") return;
  // reveal the live ring on first frame of playback
  if (!firstDrawDone) {
    orbitLineRef.visible = true;
    firstDrawDone = true;
  }
  drawRingFrameCounter++;
  if (drawRingFrameCounter % 2 !== 0) return; // Skip every other frame

  // record the latest amplitude
  ampHistory.push(amplitude);
  if (ampHistory.length > ORBIT_SEGMENTS) ampHistory.shift();

  if (!orbitGeometry) {
    console.warn("[Scene] drawRing() – no geometry");
    return;
  }

  // update spiral offset for inward spiral effect
  spiralOffset += LAYER_OFFSET;
  // reset when reaching inner radius
  if (spiralOffset > ORBIT_RADIUS - 0.1) spiralOffset = 0;
  const currentRadius = ORBIT_RADIUS - spiralOffset;

  const positions = orbitGeometry.attributes.position.array;
  const colors    = orbitGeometry.attributes.color.array;
  const angleInc  = (2 * Math.PI) / ORBIT_SEGMENTS;
  // amplitude deviation height
  const scale     = AMPLITUDE_SCALE;

    for (let i = 0; i < ORBIT_SEGMENTS; i++) {
      const amp   = ampHistory[i] ?? 0;
      const theta = i * angleInc;
      // vary radius (horizontal axis) instead of vertical displacement
      const radial = currentRadius + amp * scale;  // push inward/outward

      // update vertex position: fixed-radius circle + vertical wiggle
      positions[i * 3]     = radial * Math.cos(theta);
      positions[i * 3 + 1] = 0; // keep on the X‑Z plane
      positions[i * 3 + 2] = radial * Math.sin(theta);

      // use single CSS color for orbit
      colors[i * 3]     = orbitColor.r;
      colors[i * 3 + 1] = orbitColor.g;
      colors[i * 3 + 2] = orbitColor.b;
    }

  // --------- commit to history pool on interval ---------
  if (drawRingFrameCounter % HISTORY_INTERVAL === 0) {
    const histMesh = ringPool[ringPoolIndex];
    histMesh.visible = true;
    // copy current ring into pooled geometry
    histMesh.geometry.attributes.position.array.set(positions);
    histMesh.geometry.attributes.color.array.set(colors);
    histMesh.geometry.attributes.position.needsUpdate = true;
    histMesh.geometry.attributes.color.needsUpdate = true;
    ringPoolIndex = (ringPoolIndex + 1) % MAX_HISTORY_RINGS;
  }
  // --------------------------------------------------
  // upload updates
  orbitGeometry.attributes.position.needsUpdate = true;
  orbitGeometry.attributes.color.needsUpdate    = true;
 // drawIndex = (drawIndex + 1) % ORBIT_SEGMENTS;
  orbitGeometry.setDrawRange(0, ORBIT_SEGMENTS);
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
        alpha: true
    });
    renderer.autoClear = true;        // clear framebuffer each frame
    renderer.setClearColor(0x000000, .7); // transparent black
    
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
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

/**
 * Initializes moon objects based on the given number and adds them to the scene.
 * @param {THREE.Scene} scene - The scene to which moons will be added.
 * @param {number} numMoons - The number of moons to create.
 */
// TEMP DEV OVERRIDE — set to null to disable override
const DEV_OVERRIDE_NUM_MOONS = null;

export function harvestMoons(scene, numMoons) {
  const finalNumMoons = DEV_OVERRIDE_NUM_MOONS ?? numMoons;

  // Shared geometry and material with per-instance colors enabled
  const moonGeometry = new THREE.SphereGeometry(0.1, 16, 16);
  const moonMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.5,
    metalness: 0.2,
    emissive: new THREE.Color(0xE1E1E1),
    emissiveIntensity: 0.2,
    flatShading: true
  });

  // Create an InstancedMesh for performance with many moons
  const instancedMesh = new THREE.InstancedMesh(moonGeometry, moonMaterial, finalNumMoons);

  // Helper objects for setting transforms and colors
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const orbitRadius = 1.5;

  // Define a fixed color palette for moons
  const palette = [
    new THREE.Color('#f8f8f8'),
    new THREE.Color('#f0f0f0'),
    new THREE.Color('#e8e8e8'),
    new THREE.Color('#e0e0e0'),
    new THREE.Color('#d8d8d8'),
    new THREE.Color('#d0d0d0'),
    new THREE.Color('#c8c8c8'),
    new THREE.Color('#c0c0c0'),
    new THREE.Color('#b8b8b8'),
    new THREE.Color('#b0b0b0'),
    new THREE.Color('#a8a8a8'),
    new THREE.Color('#a0a0a0'),
    new THREE.Color('#989898'),
    new THREE.Color('#909090'),
    new THREE.Color('#888888'),
    new THREE.Color('#808080'),
    new THREE.Color('#787878'),
    new THREE.Color('#707070'),
    new THREE.Color('#686868'),
    new THREE.Color('#606060'),
    new THREE.Color('#585858'),
    new THREE.Color('#505050'),
    new THREE.Color('#484848'),
    new THREE.Color('#404040')
  ];

  for (let i = 0; i < finalNumMoons; i++) {
    // Base angular placement around a circle
    const angle = (i / finalNumMoons) * Math.PI * 2;
    // Add slight random variation to orbital radius and vertical offset
    const radiusVar = orbitRadius + (Math.random() - 0.5) * 0.3;
    const yOffset = (Math.random() - 0.5) * 0.2;
    const x = radiusVar * Math.cos(angle);
    const z = radiusVar * Math.sin(angle);

    // Position and random scale for size variation
    dummy.position.set(x, yOffset, z);
    const scaleValue = 0.05 + Math.random() * 0.15;
    dummy.scale.set(scaleValue, scaleValue, scaleValue);
    dummy.updateMatrix();

    // Apply transform to instance
    instancedMesh.setMatrixAt(i, dummy.matrix);

    // Assign a color from the fixed palette, cycling through in order, with random alpha multiplier
    const baseColor = palette[i % palette.length];
    const alpha = 0.5 + Math.random() * 0.5; // random alpha between 0.5 and 1
    const paletteColor = baseColor.clone();
    paletteColor.multiplyScalar(alpha);
    instancedMesh.setColorAt(i, paletteColor);
  }

  // Flag the buffers for update
  instancedMesh.instanceMatrix.needsUpdate = true;
  if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;

  // Wrap instancedMesh in a group and apply global tilt
  const moonGroup = new THREE.Group();
  moonGroup.rotation.x = THREE.MathUtils.degToRad(ORBIT_TILT_DEG);
  moonGroup.add(instancedMesh);
  scene.add(moonGroup);
}