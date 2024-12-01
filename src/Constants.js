import lscache from 'lscache';

export const Constants = {
    DEFAULT_TRACK_ID: '6738c0f53af6425d6ef6ba9b', // Default track ID
    TRACK_ID: null, // Current track ID
    CACHE_EXPIRY_MINUTES: 10, // Cache expiry time in minutes
    TRACK_DATA: null, // Current track data
    /**
     * Sets and caches track data for the specified trackId.
     * @param {string} trackId - The track ID.
     * @param {object} trackData - The track data to cache.
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
     * @param {string} trackId - The track ID.
     * @returns {object|null} - Cached track data or null if not found.
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
     * @param {string} trackId - The track ID.
     */
    clearTrackData(trackId) {
        if (!trackId || typeof trackId !== 'string') {
            throw new Error('Invalid trackId. Must be a string.');
        }
        lscache.remove(trackId);
        console.log(`[CACHE] Cleared track data for trackId: ${trackId}`);
    },
};

// Export individual constants for convenience
export const DEFAULT_TRACK_ID = Constants.DEFAULT_TRACK_ID;
export const TRACK_ID = Constants.TRACK_ID;

// Define a priority map for controller types
export const PRIORITY_MAP = {
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
    "MIDI": 1,

    // MIDI controllers will have dynamic priorities
};

export const DEFAULT_PRIORITY = 100; // Fallback priority for undefined types

/**
 * Retrieves the priority for a given controller type.
 * Defaults to DEFAULT_PRIORITY if the type is not in the PRIORITY_MAP.
 * @param {string} controllerType - The type of the controller (e.g., 'webaudio-knob').
 * @returns {number} - The priority value.
 */
export function getPriority(controllerType) {
    return PRIORITY_MAP[controllerType] || DEFAULT_PRIORITY;
}