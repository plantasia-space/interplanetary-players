import lscache from 'lscache';

export const Constants = {
    DEFAULT_TRACK_ID: '6738c0f53af6425d6ef6ba9b', // Track ID por defecto
    TRACK_ID: null, // Track ID actual
    CACHE_EXPIRY_MINUTES: 10, // Tiempo de expiración del caché
    TRACK_DATA: null, // Datos del track actual

    setTrackData(trackId, trackData) {
        if (!trackId || typeof trackId !== 'string') {
            throw new Error('Invalid trackId. Must be a string.');
        }
        this.TRACK_DATA = trackData;
        lscache.set(trackId, trackData, this.CACHE_EXPIRY_MINUTES);
        console.log(`Track data set and cached for trackId ${trackId}:`, trackData);
    },

    getTrackData(trackId) {
        if (!trackId || typeof trackId !== 'string') {
            throw new Error('Invalid trackId. Must be a string.');
        }
        const cachedData = lscache.get(trackId);
        if (cachedData) {
            console.log('Track data retrieved from cache:', cachedData);
            this.TRACK_DATA = cachedData;
            return cachedData;
        }
        console.warn(`No track data in cache for trackId ${trackId}.`);
        return null;
    },

    clearTrackData(trackId) {
        if (!trackId || typeof trackId !== 'string') {
            throw new Error('Invalid trackId. Must be a string.');
        }
        lscache.remove(trackId);
        console.log(`Track data cleared for trackId: ${trackId}`);
    },
};

// Export individual constants for convenience
export const DEFAULT_TRACK_ID = Constants.DEFAULT_TRACK_ID;