// CosmicLFO.js

import { MathUtils } from 'three'; // If needed
import { ModeManagerInstance } from './ModeManager.js'; // If you want to reference the mode manager
import { notifications } from './AppNotifications.js'; // If you want to show messages
// import { EXOPLANET_DATA_SOMEHOW } from './somewhere'; // Example if you need exoplanet info

/**
 * @class CosmicLFO
 * @description A low-frequency oscillator (LFO) that derives its frequency settings from exoplanet data.
 * Allows waveforms like sine, saw, triangle, square, random, etc.
 */
export class CosmicLFO {
    // Optional: private static instance for a singleton approach
    static #instance = null;

    /**
     * Returns the singleton instance of CosmicLFO.
     * @returns {CosmicLFO} The singleton instance.
     */
    static getInstance() {
        if (!CosmicLFO.#instance) {
            CosmicLFO.#instance = new CosmicLFO();
        }
        return CosmicLFO.#instance;
    }

    /**
     * Private constructor to prevent direct instantiation.
     */
    constructor() {
        if (CosmicLFO.#instance) {
            throw new Error('Use CosmicLFO.getInstance() to get the singleton instance.');
        }

        // ====== Basic LFO State ======
        /**
         * @type {boolean}
         * @description Indicates if the LFO is currently running.
         */
        this.isActive = false;

        /**
         * @type {string}
         * @description The chosen waveform for the LFO, e.g. "sine", "triangle", "square", "sawup", "sawdown", "random".
         */
        this.waveform = 'sine';

        /**
         * @type {number}
         * @description Base frequency in Hz or some abstract measure. 
         * Will later be computed from exoplanet data (period_earthdays, etc.).
         */
        this.baseFrequency = 0.1;

        /**
         * @type {number}
         * @description Accumulated phase or time offset for the oscillator.
         */
        this.phase = 0;

        // If referencing exoplanet data:
        this.currentExoplanet = null;
        this.closestNeighbor1 = null;
        this.closestNeighbor2 = null;

        // ====== Timers or intervals for updates ======
        this.updateIntervalId = null;

        // Additional placeholders for amplitude, offset, advanced configs:
        this.amplitude = 1.0;
        this.offset = 0.0;

        // Possibly placeholders for "fetched from exoplanet data"
        // this.periodForA = ...;
        // this.periodForB = ...;
        // this.periodForC = ...;

        console.log('CosmicLFO: Initialized structure.');
    }

    /**
     * Initializes or re-initializes the LFO with given exoplanet data or config.
     * @param {Object} exoData - Data about exoplanets (currentExoplanet, neighbor1, neighbor2).
     */
    initialize(exoData) {
        if (exoData) {
            this.currentExoplanet = exoData.currentExoplanet || null;
            this.closestNeighbor1 = exoData.closestNeighbor1 || null;
            this.closestNeighbor2 = exoData.closestNeighbor2 || null;
        }

        // Example: compute new base frequencies from period_earthdays
        // this.computeFrequenciesFromExoData();

        console.log('CosmicLFO: initialize() called with exoData:', exoData);
    }

    /**
     * Updates any LFO frequencies using exoplanet data (period_earthdays, etc.).
     * This is just a placeholder.
     */
    computeFrequenciesFromExoData() {
        if (!this.currentExoplanet) {
            console.warn('CosmicLFO: No currentExoplanet data available. Cannot compute frequency.');
            return;
        }
        // e.g., baseFrequency = 1 / currentExoplanet.period_earthdays * someScalingFactor
        // this.baseFrequency = ...
        console.log('CosmicLFO: Frequencies recomputed from exoplanet data.');
    }

    /**
     * Sets the waveform type (sine, square, triangle, etc.).
     * @param {string} newWaveform - The desired waveform type.
     */
    setWaveform(newWaveform) {
        this.waveform = newWaveform;
        console.log(`CosmicLFO: Waveform set to ${newWaveform}.`);
    }

    /**
     * Starts the LFO oscillation loop.
     * Could use requestAnimationFrame or setInterval, whichever you prefer.
     */
    start() {
        if (this.isActive) {
            console.warn('CosmicLFO: Already active.');
            return;
        }
        this.isActive = true;
        this.phase = 0; // reset phase if desired

        // For example, update ~60 times per second
        this.updateIntervalId = setInterval(() => {
            this.update();
        }, 1000 / 60);

        console.log('CosmicLFO: Started the LFO updates.');
    }

    /**
     * Stops the LFO oscillation loop.
     */
    stop() {
        if (!this.isActive) {
            console.warn('CosmicLFO: Not active, cannot stop.');
            return;
        }
        this.isActive = false;
        if (this.updateIntervalId) {
            clearInterval(this.updateIntervalId);
            this.updateIntervalId = null;
        }
        console.log('CosmicLFO: Stopped the LFO updates.');
    }

    /**
     * Called on each frame/tick to compute the LFO output and push it somewhere (e.g. a user param).
     * Just a skeleton.
     */
    update() {
        // 1) Advance time/phase
        // e.g. phase += 2 * Math.PI * baseFrequency * (deltaTime? .016?)
        // For skeleton, assume ~1/60 second each tick => 0.016
        const deltaTime = 1 / 60;
        const twoPiFreq = 2.0 * Math.PI * this.baseFrequency;
        this.phase += twoPiFreq * deltaTime;

        // 2) Keep phase from floating too large
        if (this.phase > 10000) this.phase = 0;

        // 3) Compute LFO value based on waveform
        const lfoValue = this.calculateLfoValue(this.phase);

        // 4) Possibly set it in some user manager param or console log
        // e.g. user1Manager.setNormalizedValue('cosmic', lfoValue);

        // console.debug('CosmicLFO: LFO Value =', lfoValue.toFixed(3));
    }

    /**
     * Computes the LFO output for a given phase, depending on the chosen waveform.
     * Range typically [-1..1].
     * @param {number} phase - The current LFO phase in radians.
     * @returns {number} The LFO output in [-1..1].
     */
    calculateLfoValue(phase) {
        switch (this.waveform) {
            case 'sine':
                return Math.sin(phase);
            case 'triangle': {
                // Normal triangle wave from phase in [0..2pi]
                // This is just a placeholder approach
                const modded = phase % (2 * Math.PI);
                return modded < Math.PI
                    ? (modded / Math.PI) * 2 - 1
                    : 1 - ((modded - Math.PI) / Math.PI) * 2;
            }
            case 'square':
                return Math.sin(phase) >= 0 ? 1 : -1;
            case 'sawup': {
                // 0 -> 2pi => -1..1
                const modded = (phase / (2.0 * Math.PI)) % 1.0;
                return modded * 2.0 - 1.0;
            }
            case 'sawdown': {
                const modded = (phase / (2.0 * Math.PI)) % 1.0;
                return 1.0 - modded * 2.0; 
            }
            case 'random':
                // This is naive: random changes each frame
                // Typically you'd want step changes each cycle or sample-hold
                return Math.random() * 2 - 1;
            default:
                return Math.sin(phase); // fallback to sine
        }
    }

    /**
     * Example setter for base frequency or amplitude.
     * @param {number} freq - The new frequency in Hz (or an arbitrary measure).
     */
    setBaseFrequency(freq) {
        this.baseFrequency = freq;
        console.log(`CosmicLFO: Base frequency set to ${freq} Hz.`);
    }
}