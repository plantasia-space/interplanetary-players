// constants.js

import lscache from 'lscache';

/**
 * @file constants.js
 * @description Defines and manages application-wide constants and utility functions.
 * Handles caching mechanisms and prioritization for various controller types.
 * @version 2.0.0
 * @date 2024-12-18
 */

/**
 * Checks if the current environment supports sensors.
 * @returns {boolean} - True if DeviceMotion or DeviceOrientation APIs are available.
 */
export const SENSORS_SUPPORTED = () => {
    return typeof DeviceMotionEvent !== 'undefined' || typeof DeviceOrientationEvent !== 'undefined';
};

/**
 * Detects if the current device is a mobile device.
 * @returns {boolean} - True if the device is mobile, false otherwise.
 */
export const isMobileDevice = () => {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Determines if internal sensors are usable based on device type and sensor support.
 * @constant
 * @type {boolean}
 */
export const INTERNAL_SENSORS_USABLE = SENSORS_SUPPORTED() && isMobileDevice();

/**
 * Determines if external sensors can be connected. Defaults to desktop devices.
 * @constant
 * @type {boolean}
 */
export let EXTERNAL_SENSORS_USABLE = !isMobileDevice(); // Default to true for desktop
/**
 * Dynamically updates the usability of external sensors (e.g., WebSocket connected).
 * @param {boolean} status - True if external sensors are connected, false otherwise.
 */
export function setExternalSensorsUsable(status) {
    EXTERNAL_SENSORS_USABLE = status;
    //console.log(`[SENSORS] External Sensors Usable: ${EXTERNAL_SENSORS_USABLE}`);
}

/**
 * Checks if any sensors (internal or external) are usable.
 * @constant
 * @type {boolean}
 */
export const SENSORS_USABLE = INTERNAL_SENSORS_USABLE || EXTERNAL_SENSORS_USABLE;

/**
 * Indicates whether the browser supports the Web MIDI API.
 * @constant
 * @type {boolean}
 */
export const MIDI_SUPPORTED = 'requestMIDIAccess' in navigator;

/**
 * @namespace Constants
 * @description A collection of application-wide constants and utility functions for track data caching.
 */
export const Constants = {
    /** 
     * @type {string}
     * @description Default track ID used when none is specified.
     */
    DEFAULT_TRACK_ID: '67e52302345213a0fdcd5081',

    /** 
     * @type {string|null}
     * @description Currently active track ID. Initially set to null.
     */
    TRACK_ID: null,

    /** 
     * @type {number}
     * @description Duration in minutes after which cached data expires.
     */
    CACHE_EXPIRY_MINUTES: 10,

    /** 
     * @type {object|null}
     * @description Data associated with the current track. Initially set to null.
     */
    TRACK_DATA: null,


        /** 
     * Centralized loading state for tracking application initialization.
     */
        LOADING_STATE: {
            trackLoaded: false,
            orbiterLoaded: false,
            modelLoaded: false,
            uiReady: false,
        },
    
        /**
         * Updates the loading state and calls updateLoadingScreen().
         * Ensures that only valid keys are updated.
         * @param {string} key - The loading step (e.g., "trackLoaded").
         * @param {boolean} value - True if the step is completed.
         */
        setLoadingState(key, value) {
            if (this.LOADING_STATE.hasOwnProperty(key)) {
                this.LOADING_STATE[key] = value;
                updateLoadingScreen(); // Automatically update the loading screen
            } else {
                console.warn(`[Constants] Attempted to set unknown loading state: ${key}`);
            }
        },
    
        /**
         * Retrieves the current loading state.
         * @returns {object} The current state of all loading steps.
         */
        getLoadingState() {
            return this.LOADING_STATE;
        },

        
    /**
     * Sets and caches track data for the specified trackId.
     * @param {string} trackId - The unique identifier for the track.
     * @param {object} trackData - The data object containing track information.
     * @throws Will throw an error if `trackId` is not a valid string.
     */
    setTrackData(trackId, trackData) {
        if (!trackId || typeof trackId !== 'string') {
            throw new Error('Invalid trackId. Must be a string.');
        }
        this.TRACK_DATA = trackData;
        lscache.set(trackId, trackData, this.CACHE_EXPIRY_MINUTES);
        //console.log(`[CACHE] Cached track data for trackId: ${trackId}`, trackData);
    },

    /**
     * Retrieves cached track data for the specified trackId.
     * @param {string} trackId - The unique identifier for the track.
     * @returns {object|null} - Returns the cached track data or null if not found.
     * @throws Will throw an error if `trackId` is not a valid string.
     */
    getTrackData(trackId) {
        if (!trackId || typeof trackId !== 'string') {
            throw new Error('Invalid trackId. Must be a string.');
        }
        const cachedData = lscache.get(trackId);
        if (cachedData) {
            //console.log(`[CACHE] Found track data for trackId: ${trackId}`, cachedData);
            this.TRACK_DATA = cachedData;
            return cachedData;
        }
        console.warn(`[CACHE] No track data found for trackId: ${trackId}`);
        return null;
    },

    /**
     * Clears cached data for the specified trackId.
     * @param {string} trackId - The unique identifier for the track.
     * @throws Will throw an error if `trackId` is not a valid string.
     */
    clearTrackData(trackId) {
        if (!trackId || typeof trackId !== 'string') {
            throw new Error('Invalid trackId. Must be a string.');
        }
        lscache.remove(trackId);
        //console.log(`[CACHE] Cleared track data for trackId: ${trackId}`);
    }
};


/**
 * @constant
 * @memberof CoreModule
 * @type {string}
 * @description Default track ID used across the application.
 */
export const DEFAULT_TRACK_ID = Constants.DEFAULT_TRACK_ID;

/**
 * @constant
 * @memberof CoreModule
 * @type {string|null}
 * @description Currently active track ID. Initially set to null.
 */
export const TRACK_ID = Constants.TRACK_ID;

/**
 * @constant
 * @memberof CoreModule
 * @type {object}
 * @description Defines priority levels for various controller types.
 */
export const PRIORITY_MAP = {
    "MIDI": 1,
    "webaudio-knob": 2,
    "webaudio-slider": 3,
    "webaudio-switch": 4,
    "webaudio-numeric-keyboard": 5,
    "webaudio-param": 6,
    "webaudio-keyboard": 7,

    // NEW: Visual controllers inserted in priority
    "visual-x": 7.5,
    "visual-y": 8.5,
    "visual-z": 9.5,

    // Existing sensors
    "sensor-x": 8,
    "sensor-y": 9,
    "sensor-z": 10,

    // Cosmic LFOs (background modulations)
    "cosmic-lfo-A": 11,
    "cosmic-lfo-B": 12,
    "cosmic-lfo-C": 13,
};
/**
 * @constant
 * @description Tracks the current playback state of the orbiter.
 */
export let PLAYBACK_STATE = "stopped"; // Can be "playing", "paused", "stopped"

/**
 * Updates the `PLAYBACK_STATE` global variable.
 * @param {string} state - The new playback state ("playing", "paused", "stopped").
 */
export function setPlaybackState(state) {
    if (["playing", "paused", "stopped"].includes(state)) {
        PLAYBACK_STATE = state;
        //console.log(`[Constants] Playback state updated: ${PLAYBACK_STATE}`);
    } else {
        console.warn(`[Constants] Invalid playback state: ${state}`);
    }
}

/**
 * Retrieves the current playback state.
 * @returns {string} The current playback state.
 */
export function getPlaybackState() {
    return PLAYBACK_STATE;
}

/**
 * @constant
 * @memberof CoreModule
 * @type {number}
 * @description Fallback priority value for undefined controller types.
 */
export const DEFAULT_PRIORITY = 100;

/**
 * Retrieves the priority for a given controller type.
 * Defaults to `DEFAULT_PRIORITY` if the type is not defined in `PRIORITY_MAP`.
 * @param {string} controllerType - The type of the controller (e.g., 'webaudio-knob').
 * @returns {number} - The priority value associated with the controller type.
 */
export function getPriority(controllerType) {
    return PRIORITY_MAP[controllerType] || DEFAULT_PRIORITY;
}

/**
 * Generates and retrieves a persistent `uniqueId` for the desktop client.
 * Utilizes `lscache` to store the `uniqueId` with a 60-minute expiration.
 * If a `uniqueId` exists and is valid, it retrieves it; otherwise, generates a new one.
 * @returns {string} - The persistent `uniqueId`.
 */
export function getUniqueId() {
    const UNIQUE_ID_KEY = 'uniqueId';
    let uniqueId = lscache.get(UNIQUE_ID_KEY);

    if (!uniqueId) {
        uniqueId = 'unique-' + Math.random().toString(36).substr(2, 16);
        lscache.set(UNIQUE_ID_KEY, uniqueId, 60); // Expires in 60 minutes
        //console.log(`[SENSORS] Generated new uniqueId: ${uniqueId}`);
    } else {
        //console.log(`[SENSORS] Retrieved existing uniqueId from cache: ${uniqueId}`);
    }

    return uniqueId;
}

/**
 * @constant
 * @type {string}
 * @description Persistent unique identifier for the desktop client.
 */
export const UNIQUE_ID = getUniqueId();

/**
 * Logs sensor detection states for debugging.
 */
//console.log(`[SENSORS] Supported: ${SENSORS_SUPPORTED()}`);
//console.log(`[SENSORS] Internal Sensors Usable: ${INTERNAL_SENSORS_USABLE}`);
//console.log(`[SENSORS] External Sensors Usable: ${EXTERNAL_SENSORS_USABLE}`);
//console.log(`[SENSORS] Sensors Usable: ${SENSORS_USABLE}`);