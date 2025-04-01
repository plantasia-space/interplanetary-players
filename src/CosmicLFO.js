// CosmicLFO.js

import { MathUtils } from 'three';
import { ModeManagerInstance } from './ModeManager.js';
import notifications from './AppNotifications.js';

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
    this.baseFrequency = 0.1;
    this.phase = 0;
    this.amplitude = 1.0;
    this.offset = 0.0;
    this.updateIntervalId = null;

    console.log(`CosmicLFO (${this.axis}): Initialized.`);
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
  
      console.log(
        `CosmicLFO (${this.axis}): Switch "${switchId}" changed => wantsActive=${wantsActive}, current isActive=${this.isActive}`
      );
  
      // 1) If the new wantsActive == lastWantsActive, skip repeated toggles
      if (wantsActive === lastWantsActive) {
        console.log(`CosmicLFO (${this.axis}): Skipping repeated toggle => ${wantsActive}`);
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

    // Update approximately 60 times per second
    this.updateIntervalId = setInterval(() => {
      this.update();
    }, 1000 / 60);

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
    const deltaTime = 1 / 60;
    const twoPiFreq = 2.0 * Math.PI * this.baseFrequency;
    this.phase += twoPiFreq * deltaTime;
    if (this.phase > 10000) this.phase = 0;

    const lfoValue = this.calculateLfoValue(this.phase);
    // console.debug(`CosmicLFO (${this.axis}): LFO Value = ${lfoValue.toFixed(3)}`);
  }

  /**
   * Computes the LFO output for a given phase, depending on the chosen waveform.
   * @param {number} phase - The current LFO phase in radians.
   * @returns {number} The LFO output in [-1..1].
   */
  calculateLfoValue(phase) {
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
      case 'sawup': {
        const modded = (phase / (2 * Math.PI)) % 1.0;
        return modded * 2.0 - 1.0;
      }
      case 'sawdown': {
        const modded = (phase / (2 * Math.PI)) % 1.0;
        return 1.0 - modded * 2.0;
      }
      case 'random':
        return Math.random() * 2 - 1;
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
    this.waveform = newWaveform;
    console.log(`CosmicLFO (${this.axis}): Waveform set to ${newWaveform}.`);
  }

  /**
   * Sets the base frequency.
   * @param {number} freq - The new frequency.
   */
  setBaseFrequency(freq) {
    this.baseFrequency = freq;
    console.log(`CosmicLFO (${this.axis}): Base frequency set to ${freq} Hz.`);
  }

  /**
   * Called when the Cosmic LFO mode is activated.
   * Shows Cosmic LFO UI elements and starts the LFO.
   */
  enterMode() {
    console.log(`CosmicLFO (${this.axis}): Entering Cosmic LFO mode.`);
    const cosmicElements = document.querySelectorAll(
      '[data-group$="-waveform-dropdown"], ' +
      '[data-group$="-exo-lfo-dropdown"], ' +
      '[id^="xCosmic"], [id^="yCosmic"], [id^="zCosmic"], ' +
      'webaudio-monitor[id^="cosmic-lfo-"]'
    );
    cosmicElements.forEach(el => {
      el.style.display = '';
    });
    this.start();
  }

  /**
   * Called when the Cosmic LFO mode is deactivated.
   * Hides Cosmic LFO UI elements and stops the LFO.
   */
  exitMode() {
    console.log(`CosmicLFO (${this.axis}): Exiting Cosmic LFO mode.`);
    const cosmicElements = document.querySelectorAll(
      '[data-group$="-waveform-dropdown"], ' +
      '[data-group$="-exo-lfo-dropdown"], ' +
      '[id^="xCosmic"], [id^="yCosmic"], [id^="zCosmic"], ' +
      'webaudio-monitor[id^="cosmic-lfo-"]'
    );
    cosmicElements.forEach(el => {
      el.style.display = 'none';
    });
    this.stop();
  }

  /** Optional: If you need exoplanet-based logic **/
  handleSelectionChange(type, value) {
    if (type === 'waveform') {
      this.setWaveform(value);
    } else if (type === 'exo') {
      this.setCurrentExoplanet(value);
    }
  }

  setCurrentExoplanet(exoplanetValue) {
    console.log(`CosmicLFO (${this.axis}): Current exoplanet set to ${exoplanetValue}.`);
  }

  initialize(exoData) {
    console.log(`CosmicLFO (${this.axis}): initialize() with exoData=`, exoData);
  }

  computeFrequenciesFromExoData() {
    console.warn(`CosmicLFO (${this.axis}): computeFrequenciesFromExoData() not implemented.`);
  }
}