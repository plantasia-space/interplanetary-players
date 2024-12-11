import lscache from 'lscache';

/**
 * @file constants.js
 * @description Defines and manages application-wide constants and utility functions.
 * Handles caching mechanisms and prioritization for various controller types.
 * @version 2.0.0
 * @author 𝐵𝓇𝓊𝒶 𝒢𝓊𝒶𝓇𝓃𝒾𝑒𝓇𝒾 
 * @license MIT
 * @date 2024-12-07
 */

/**
 * Indicates whether the browser supports the Web MIDI API.
 * @constant
 * @memberof CoreModule
 * @type {boolean}
 * @description True if the Web MIDI API is supported in the current environment, false otherwise.
 */
export const MIDI_SUPPORTED = 'requestMIDIAccess' in navigator;

/**
 * Indicates whether device sensors (e.g., gyroscope, accelerometer) are supported.
 * Additionally checks if the device permissions are granted.
 * @constant
 * @type {Promise<boolean>}
 * @description Resolves to true if sensors are supported and permission is granted.
 */
export const SENSORS_SUPPORTED = (async () => {
    if (typeof DeviceMotionEvent !== 'undefined' || typeof DeviceOrientationEvent !== 'undefined') {
        if (
            typeof DeviceMotionEvent !== 'undefined' &&
            typeof DeviceMotionEvent.requestPermission === 'function'
        ) {
            try {
                const response = await DeviceMotionEvent.requestPermission();
                return response === 'granted';
            } catch (err) {
                console.warn('SENSORS_SUPPORTED: Permission request error:', err);
                return false;
            }
        }
        // Non-iOS browsers assume permissions are granted if events are available
        return true;
    }
    return false;
})();

/**
 * @namespace Constants
 * @description A collection of application-wide constants and utility functions for track data caching.
 */
export const Constants = {
    /** 
     * @type {string}
     * @description Default track ID used when none is specified.
     */
    DEFAULT_TRACK_ID: '6738c0f53af6425d6ef6ba9b',

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
        console.log(`[CACHE] Cached track data for trackId: ${trackId}`, trackData);
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
            console.log(`[CACHE] Found track data for trackId: ${trackId}`, cachedData);
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
        console.log(`[CACHE] Cleared track data for trackId: ${trackId}`);
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
    "sensor-x": 8,
    "sensor-y": 9,
    "sensor-z": 10,
    "cosmic-lfo-A": 11,
    "cosmic-lfo-B": 12,
    "cosmic-lfo-C": 13,
    // Additional controller types can be added here with their respective priorities
};

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