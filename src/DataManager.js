import { Constants } from './Constants.js';

export class DataManager {
    constructor() {
        this.cacheExpiryMinutes = Constants.CACHE_EXPIRY_MINUTES || 10; // Cache expiry in minutes
    }

    /**
     * Fetches and caches track data for a given track ID.
     * @param {string} trackId - The track ID.
     * @returns {Promise<object>} - The fetched or cached track data.
     */
    async fetchTrackData(trackId) {
        if (!trackId || typeof trackId !== 'string') {
            throw new Error('Invalid trackId. Must be a non-empty string.');
        }

        console.log(`Fetching data for trackId: ${trackId}`);

        // Check cache first
        const cachedData = Constants.getTrackData(trackId);
        if (cachedData) {
            console.log('Track data found in cache:', cachedData);
            return cachedData;
        }

        // Fetch from the server
        const BASE_URL = 'http://media.maar.world:3001/api';
        try {
            const response = await fetch(`${BASE_URL}/tracks/player/${trackId}`);
            if (!response.ok) {
                throw new Error(`Server returned error: ${response.statusText} (${response.status})`);
            }

            const result = await response.json();
            if (!result.success || !result.track) {
                throw new Error(result.message || 'Failed to fetch track data.');
            }

            console.log('Track data fetched successfully:', result.track);

            // Cache data and update Constants
            Constants.setTrackData(trackId, result.track);
            return result.track;
        } catch (error) {
            console.error('Error fetching track data:', error);
            throw error;
        }
    }

    /**
     * Clears the cached data for a given trackId.
     * @param {string} trackId - The track ID.
     */
    clearCache(trackId) {
        if (!trackId || typeof trackId !== 'string') {
            throw new Error('Invalid trackId. Must be a non-empty string.');
        }

        Constants.clearTrackData(trackId);
        console.log(`Cache cleared for trackId: ${trackId}`);
    }
}