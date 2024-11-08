// src/script.js

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'

// Scene
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xdddddd)

// Camera
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
)
camera.position.set(0, 1.5, 3)

// Renderer
const canvas = document.querySelector('.webgl')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
directionalLight.position.set(5, 10, 7.5)
scene.add(directionalLight)

// Controls
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.05
controls.enablePan = true
controls.enableZoom = true

// Load OBJ Model with Texture
const loader = new OBJLoader()

// Define paths to model and texture
const modelPath = '/models/d6fbd28b1af1_a_spherical_exoplan.obj'
const texturePath = '/public/textures/d6fbd28b1af1_a_spherical_exoplan_texture_kd.jpg'

// Load the texture first
const textureLoader = new THREE.TextureLoader()
const texture = textureLoader.load(
    texturePath,
    () => {
        console.log('Texture loaded successfully.')
    },
    undefined,
    (err) => {
        console.error('An error occurred loading the texture:', err)
    }
)

// Load the OBJ model
loader.load(
    modelPath,
    (object) => {
        object.traverse((child) => {
            if (child.isMesh) {
                child.material = new THREE.MeshStandardMaterial({
                    map: texture,
                    flatShading: true,
                })
            }
        })
        scene.add(object)
    },
    (xhr) => {
        console.log(`${(xhr.loaded / xhr.total) * 100}% loaded`)
    },
    (error) => {
        console.error('An error happened while loading the OBJ model:', error)
    }
)

// Handle Window Resize
window.addEventListener('resize', () => {
    // Update sizes
    const width = window.innerWidth
    const height = window.innerHeight

    // Update camera
    camera.aspect = width / height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

// Animation Loop
const clock = new THREE.Clock()

function animate() {
    const delta = clock.getDelta()

    // Update controls
    controls.update()

    // Render
    renderer.render(scene, camera)

    requestAnimationFrame(animate)
}

animate()
