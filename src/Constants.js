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