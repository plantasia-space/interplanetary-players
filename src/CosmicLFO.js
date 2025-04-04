// CosmicLFO.js

import { MathUtils } from 'three';
import { ModeManagerInstance } from './ModeManager.js';
import notifications from './AppNotifications.js';
import { ParameterManager } from './ParameterManager.js';

/**
 * @class CosmicLFO
 * @description A low-frequency oscillator (LFO) that derives its frequency settings from exoplanet data.
 * Allows waveforms like sine, saw, triangle, square, random, etc.
 */
export class CosmicLFO {

  /**
   * Constructor for a new CosmicLFO instance.
   * @param {string} axis - The axis this LFO controls ('x', 'y', or 'z').
   */
  constructor(axis) {
    this.axis = axis;
    this.isActive = false;
    this.waveform = 'sine';
    this.baseFrequency = 0.01;
    this.phase = 0;
    this.amplitude = 1.0;
    this.offset = 0.0;
    this.updateIntervalId = null;
    this.debug = false; // Set to true to enable debug logging
    this.currentExoplanet = null; // Initialize current exoplanet
    this.currentMultiplier = 1;   // New: cumulative multiplier for base frequency
    //console.log(`CosmicLFO (${this.axis}): Initialized.`);
  }
/**
 * Attaches a trigger switch to this Cosmic LFO.
 * @param {string} switchId - The DOM id of the webaudio-switch of type "kick".
 */
attachTriggerSwitch(switchId) {
  const triggerSwitch = document.getElementById(switchId);
  if (!triggerSwitch) {
    console.error(`CosmicLFO (${this.axis}): Trigger switch with id "${switchId}" not found.`);
    return;
  }
  triggerSwitch.addEventListener('click', () => {
    //console.log(`CosmicLFO (${this.axis}): Trigger switch "${switchId}" clicked.`);
    this.triggerKick(switchId);
  });
}
  /**
   * Attaches a switch control to this LFO instance.
   * The switch is identified by its DOM id (e.g., 'xCosmicLFO').
   * When the switch changes state, the LFO will start or stop.
   * @param {string} switchId - The id of the switch element.
   */
  attachSwitch(switchId) {
    const switchEl = document.getElementById(switchId);
    if (!switchEl) {
      console.error(`CosmicLFO (${this.axis}): Switch with id "${switchId}" not found.`);
      return;
    }
  
    let lastWantsActive = null; // Store the last toggle state to prevent duplicates
  
    switchEl.addEventListener('change', () => {
      const wantsActive = switchEl.state; // or switchEl.value, whichever is your ON/OFF property
  
  
      // 1) If the new wantsActive == lastWantsActive, skip repeated toggles
      if (wantsActive === lastWantsActive) {
        //console.log(`CosmicLFO (${this.axis}): Skipping repeated toggle => ${wantsActive}`);
        return;
      }
      // 2) Otherwise, store this as the new last state
      lastWantsActive = wantsActive;
  
      // 3) If there's an actual change in active vs wantsActive, do the normal logic
      if (this.isActive !== wantsActive) {
        if (wantsActive) {
          this.start();
        } else {
          this.stop();
        }
      }
    });
  }

  /**
   * Starts the LFO oscillation loop.
   */
  start() {
    if (this.isActive) {
      return;
    }
    this.isActive = true;
    this.phase = 0; // reset phase if desired

    // Update approximately 30 times per second
    this.updateIntervalId = setInterval(() => {
      this.update();
    }, 1000 / 30);
  }

  /**
   * Stops the LFO oscillation loop.
   */
  stop() {
    if (!this.isActive) {
      return;
    }
    this.isActive = false;

    if (this.updateIntervalId) {
      clearInterval(this.updateIntervalId);
      this.updateIntervalId = null;
    }
  }

  /**
   * Called on each frame/tick to compute the LFO output.
   */
  update() {
    const deltaTime = 1 / 30; // Update at 30 Hz
    const twoPiFreq = 2.0 * Math.PI * this.baseFrequency;
    this.phase += twoPiFreq * deltaTime;
    if (this.phase > 10000) this.phase = 0;

    const lfoValue = this.calculateLfoValue(this.phase);
    const modulatedValue = this.offset + this.amplitude * lfoValue;
    
    // Remove DOM updates and instead update the ParameterManager:
    const normalizedModulatedValue = (modulatedValue + 1) / 2;
    const parameterManager = ParameterManager.getInstance();
    parameterManager.setNormalizedValue(this.axis, normalizedModulatedValue);
    
    // Existing debug code (if enabled) remains unchanged:
// In the update() method, update the debug block as follows:

if (this.debug) {
  if (!this.debugFrameCount) { this.debugFrameCount = 0; }
  this.debugFrameCount++;
  if (this.debugFrameCount % 30 === 0) {
    console.debug(`CosmicLFO (${this.axis}): Debug Info -> Base Frequency: ${this.baseFrequency}, TwoPiFreq: ${twoPiFreq.toFixed(3)}, Phase: ${this.phase.toFixed(2)}, LFO Value: ${lfoValue.toFixed(3)}, Modulated Value: ${modulatedValue.toFixed(3)}`);
  }
}
    // console.debug(`CosmicLFO (${this.axis}): LFO Value = ${lfoValue.toFixed(3)}`);
  }

  /**
   * Computes the LFO output for a given phase, depending on the chosen waveform.
   * @param {number} phase - The current LFO phase in radians.
   * @returns {number} The LFO output in [-1..1].
   */
  calculateLfoValue(phase) {
    console.debug(`CosmicLFO (${this.axis}): Calculating LFO with waveform: ${this.waveform}`);
    switch (this.waveform) {
      case 'sine':
        return Math.sin(phase);
      case 'triangle': {
        const modded = phase % (2 * Math.PI);
        return modded < Math.PI
          ? (modded / Math.PI) * 2 - 1
          : 1 - ((modded - Math.PI) / Math.PI) * 2;
      }
      case 'square':
        return Math.sin(phase) >= 0 ? 1 : -1;
      case 'up': {
        const modded = phase % (2 * Math.PI);
        return (modded / (2 * Math.PI)) * 2.0 - 1.0; // ramps from -1 to 1
      }
      case 'down': {
        const modded = phase % (2 * Math.PI);
        return 1.0 - (modded / (2 * Math.PI)) * 2.0; // ramps from 1 to -1
      }
      case 'random':
        // Generate a new random value only every full cycle to simulate seeded behavior
        if (!this.lastRandomPhase || Math.floor(this.phase / (2 * Math.PI)) !== Math.floor(this.lastRandomPhase / (2 * Math.PI))) {
          this.lastRandomValue = Math.random() * 2 - 1;
          this.lastRandomPhase = this.phase;
        }
        return this.lastRandomValue;
      default:
        // fallback to sine
        return Math.sin(phase);
    }
  }

  /**
   * Sets the waveform type (sine, square, triangle, etc.).
   * @param {string} newWaveform - The desired waveform type.
   */
  setWaveform(newWaveform) {
    this.waveform = newWaveform.replace(`${this.axis}-waveform-`, '');
    //console.log(`CosmicLFO (${this.axis}): Waveform set to ${newWaveform}.`);
  }

  /**
   * Sets the base frequency.
   * @param {number} freq - The new frequency.
   */
  setBaseFrequency(freq) {
    this.baseFrequency = freq;
    this.updateFrequencyMonitor();
    this.update(); // Force an immediate update so the oscillator output uses the new frequency.
    //console.log(`CosmicLFO (${this.axis}): Base frequency set to ${freq} Hz.`);
  }

  /**
   * Called when the Cosmic LFO mode is activated.
   * Shows Cosmic LFO UI elements and starts the LFO.
   */
  enterMode() {
    //console.log(`CosmicLFO (${this.axis}): Entering Cosmic LFO mode.`);
    const cosmicElements = document.querySelectorAll(
      '[data-group$="-waveform-dropdown"], ' +
      '[data-group$="-exo-lfo-dropdown"], ' +
      '[id^="xCosmic"], [id^="yCosmic"], [id^="zCosmic"], ' +
      'webaudio-monitor[id^="cosmic-lfo-"]'
    );
    cosmicElements.forEach(el => {
      el.style.display = '';
    });
    
    // Check the state of the corresponding toggle before starting
    const switchEl = document.getElementById(`${this.axis}CosmicLFO`);
    if (switchEl && switchEl.state) {
      this.start();
    } else {
      this.stop();
    }
  }

  /**
   * Called when the Cosmic LFO mode is deactivated.
   * Hides Cosmic LFO UI elements and stops the LFO.
   */
  exitMode() {
    //console.log(`CosmicLFO (${this.axis}): Exiting Cosmic LFO mode.`);
    const cosmicElements = document.querySelectorAll(
      '[data-group$="-waveform-dropdown"], ' +
      '[data-group$="-exo-lfo-dropdown"], ' +
      '[id^="xCosmic"], [id^="yCosmic"], [id^="zCosmic"], ' +
      'webaudio-monitor[id^="cosmic-lfo-"]'
    );
    cosmicElements.forEach(el => {
      el.style.display = 'none';
    });
    const switchEl = document.getElementById(`${this.axis}CosmicLFO`);
    if (!switchEl || !switchEl.state) {
      this.stop();
    }
  }

  /** Optional: If you need exoplanet-based logic **/
  handleSelectionChange(type, value) {
    //console.log(`CosmicLFO (${this.axis}): handleSelectionChange triggered with type=${type}, value=${value}`);
    if (type === 'waveform') {
      this.setWaveform(value);
    } else if (type === 'exo') {
      this.setCurrentExoplanet(value);
    }
  }
  
// In setCurrentExoplanet(), update the base frequency using the stored currentMultiplier.
setCurrentExoplanet(exoplanetValue) {
  this.currentExoplanet = exoplanetValue;
  this.baseFrequency = this.exoFrequencies[this.currentExoplanet] * this.currentMultiplier;
  this.updateFrequencyMonitor();
  //console.log(`CosmicLFO (${this.axis}): Current exoplanet set to ${exoplanetValue}. Base frequency set to ${this.baseFrequency} Hz.`);
}
  
  /**
   * Sets the exoplanet frequencies based on the provided exoplanet data.
   * Expects an object with keys: currentExoplanet, closestNeighbor1, and closestNeighbor2.
   */
// In setExoFrequencies(), after setting the exoFrequencies and defaulting currentExoplanet,
// update the baseFrequency using the currentMultiplier.
setExoFrequencies(exoData) {
  this.exoFrequencies = {
    'exo-a': (exoData.currentExoplanet && exoData.currentExoplanet.minimum_cosmic_lfo !== undefined && !isNaN(parseFloat(exoData.currentExoplanet.minimum_cosmic_lfo)))
      ? parseFloat(exoData.currentExoplanet.minimum_cosmic_lfo)
      : 0.01,
    'exo-b': (exoData.closestNeighbor1 && exoData.closestNeighbor1.minimum_cosmic_lfo !== undefined && !isNaN(parseFloat(exoData.closestNeighbor1.minimum_cosmic_lfo)))
      ? parseFloat(exoData.closestNeighbor1.minimum_cosmic_lfo)
      : 0.2,
    'exo-c': (exoData.closestNeighbor2 && exoData.closestNeighbor2.minimum_cosmic_lfo !== undefined && !isNaN(parseFloat(exoData.closestNeighbor2.minimum_cosmic_lfo)))
      ? parseFloat(exoData.closestNeighbor2.minimum_cosmic_lfo)
      : 0.3
  };
  //console.log(`CosmicLFO (${this.axis}): Exo frequencies set:`, this.exoFrequencies);

  // If no current exoplanet is selected, default to 'exo-a'
  if (!this.currentExoplanet) {
    this.currentExoplanet = 'exo-a';
    //console.log(`CosmicLFO (${this.axis}): Default current exoplanet set to ${this.currentExoplanet}.`);
  }
  
  // Update the base frequency using the currentMultiplier.
  this.baseFrequency = this.exoFrequencies[this.currentExoplanet] * this.currentMultiplier;
  this.updateFrequencyMonitor();
  
  // Store the initial base frequency if not already set.
  if (!this.initialBaseFrequency) {
    this.initialBaseFrequency = this.exoFrequencies[this.currentExoplanet];
    //console.log(`CosmicLFO (${this.axis}): initialBaseFrequency set to ${this.initialBaseFrequency} Hz.`);
  }
}

  getExoBaseFrequency() {
    if (this.exoFrequencies && this.exoFrequencies[this.currentExoplanet] !== undefined) {
      return this.exoFrequencies[this.currentExoplanet];
    }
    //return 0.01;
  }
// In applyTriggerMultiplier(), update the cumulative multiplier and compute the new base frequency accordingly.
applyTriggerMultiplier(multiplier) {
  // Calculate the prospective new multiplier and new base frequency.
  const newMultiplier = this.currentMultiplier * multiplier;
  const newBaseFrequency = this.exoFrequencies[this.currentExoplanet] * newMultiplier;
  
  // If the new frequency is above 100 Hz, do not update.
  if (newBaseFrequency > 100) {
    //console.log(`CosmicLFO (${this.axis}): New frequency ${newBaseFrequency} Hz exceeds maximum 100 Hz. Keeping current frequency ${this.baseFrequency} Hz.`);
    return;
  }
  
  // If the new frequency is below 0.01 Hz, do not update.
  if (newBaseFrequency < 0.01) {
    //console.log(`CosmicLFO (${this.axis}): New frequency ${newBaseFrequency} Hz is below minimum 0.01 Hz. Keeping current frequency ${this.baseFrequency} Hz.`);
    return;
  }
  
  // Otherwise, update the multiplier and base frequency.
  this.currentMultiplier = newMultiplier;
  this.baseFrequency = newBaseFrequency;
  this.updateFrequencyMonitor();
  this.update(); // Force an immediate update using the new frequency.
  //console.log(`CosmicLFO (${this.axis}): Base frequency updated to ${this.baseFrequency} Hz using multiplier ${multiplier}.`);
}

  triggerKick(triggerLabel) {
    let multiplier;
    if (triggerLabel.endsWith('1')) {
      multiplier = 0.5;
    } else if (triggerLabel.endsWith('2')) {
      multiplier = 2;
    } else {
      console.warn(`CosmicLFO (${this.axis}): Unknown trigger label '${triggerLabel}'.`);
      return;
    }
    this.applyTriggerMultiplier(multiplier);
  }

  initialize(exoData) {
    //console.log(`CosmicLFO (${this.axis}): initialize() with exoData=`, exoData);
  }

  computeFrequenciesFromExoData() {
    console.warn(`CosmicLFO (${this.axis}): computeFrequenciesFromExoData() not implemented.`);
  }

  updateFrequencyMonitor() {
    const monitorEl = document.getElementById(`cosmic-lfo-${this.axis}-freq`);
    if (monitorEl) {
      monitorEl.value = this.baseFrequency;
    }
  }
}