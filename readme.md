# Interplanetary Players

Modernizing Interplanetary Players for the Web.

This project features a complete refactor and rewrite of the Interplanetary Players code, incorporating a new architecture for better performance and maintainability.

## Getting Started

1. **Install [Node.js](https://nodejs.org/en/download/).**
2. Clone this repository and navigate to the project folder.
3. Run the following commands:

```bash
# Install dependencies (run once)
npm install

# Start the development server (localhost:8080)
npm run dev

# Build the project for production (outputs to dist/)
npm run build
```


# Module Descriptions

# CoreModule

**Description**:  
The **CoreModule** serves as the backbone of the application, organizing and executing foundational logic. It provides a centralized system for managing interactions, parameter transformations, and application state, ensuring seamless operation and integration of various components.

---

## @namespace InputInterface
**Description**:  
Provides documentation for sensors, MIDI controllers, touch, and other user input mechanisms. This module focuses on capturing, processing, and responding to user interactions efficiently and intuitively.

---

## @namespace 2DGUI
**Description**:  
Handles all 2D graphical user interface elements, including sliders, buttons, knobs, and parameter displays. This module integrates WebAudioControls for creating custom, reusable components to control audio parameters seamlessly. Its focus is on interactive and visually appealing controls optimized for 2D environments.

---

## @namespace 3DGUI
**Description**:  
Manages 3D graphical user interface components, including interactive elements within 3D scenes. It integrates seamlessly with Three.js to provide immersive user interactions.

---

## @namespace AudioEngine
**Description**:  
Encapsulates the core logic for audio processing, synthesis, and playback. This module manages the Web Audio API and RNBO, sound engines, and audio parameters to create a dynamic sound environment.

---
