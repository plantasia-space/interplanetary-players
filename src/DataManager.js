// src/DataManager.js

import { Constants } from './Constants.js';

export class DataManager {
    constructor() {
        this.cacheExpiryMinutes = Constants.CACHE_EXPIRY_MINUTES || 10; // Cache expiry in minutes
        console.log ("TRACK_DATA IN DATA MANAGER", Constants.TRACK_DATA);

        // Define the placeholder configuration based on the updated table
        this.placeholderConfig = {
            monitorInfo: {
                placeholder_1: "Distance:",
                placeholder_2: "-", // No value for this placeholder
                placeholder_3: () => Constants.TRACK_DATA?.soundEngineParams?.xParam?.label || "Unknown",
                placeholder_4: "-", // No value for this placeholder
                placeholder_5: () => Constants.TRACK_DATA?.soundEngineParams?.yParam?.label || "Unknown",
                placeholder_6: "-", // No value for this placeholder
                placeholder_7: () => Constants.TRACK_DATA?.soundEngineParams?.zParam?.label || "Unknown",
                placeholder_8: "-", // No value for this placeholder
                placeholder_9: "Orbit A",
                placeholder_10: "-", // No value for this placeholder
                placeholder_11: "Orbit B",
                placeholder_12: "-", // No value for this placeholder
                placeholder_13: "Orbit C",
                placeholder_14: "-", // No value for this placeholder
            },
            trackInfo: {
                placeholder_1: "Artist:",
                placeholder_2: () => Constants.TRACK_DATA?.track?.artists || "Unknown Artist",
                placeholder_3: "Track name:",
                placeholder_4: () => Constants.TRACK_DATA?.track?.trackName || "Unknown Track",
                placeholder_5: "Release:",
                placeholder_6: () => Constants.TRACK_DATA?.track?.releaseDate || "Unknown Date",
                placeholder_7: "Tags:",
                placeholder_8: () => Constants.TRACK_DATA?.track?.tags || "No Tags",
                placeholder_9: "-", // No value for this placeholder
                placeholder_10: "-", // No value for this placeholder
                placeholder_11: "-", // No value for this placeholder
                placeholder_12: "-", // No value for this placeholder
                placeholder_13: "-", // No value for this placeholder
                placeholder_14: "-", // No value for this placeholder
            },
            interplanetaryPlayerInfo: {
                placeholder_1: "Scientific Name:",
                placeholder_2: () => Constants.TRACK_DATA?.interplanetaryPlayer?.sciName || "Unknown Name",
                placeholder_3: "Artistic Name:",
                placeholder_4: () => Constants.TRACK_DATA?.interplanetaryPlayer?.artName || "Unknown Name",
                placeholder_5: "Creator:",
                placeholder_6: () => Constants.TRACK_DATA?.interplanetaryPlayer?.owner || "Unknown Owner",
                placeholder_7: "3D Artist:",
                placeholder_8: () => Constants.TRACK_DATA?.interplanetaryPlayer?.dddArtist || "Unknown Artist",
                placeholder_9: "Orbital Period:",
                placeholder_10: () => Constants.TRACK_DATA?.interplanetaryPlayer?.orbitalPeriod || "Unknown Period",
                placeholder_11: "-", // No value for this placeholder
                placeholder_12: "-", // No value for this placeholder
                placeholder_13: "-", // No value for this placeholder
                placeholder_14: "-", // No value for this placeholder
            },
            soundEngineInfo: {
                placeholder_1: "Name:",
                placeholder_2: () => Constants.TRACK_DATA?.soundEngine?.soundEngineName || "Unknown Engine",
                placeholder_3: "Developer:",
                placeholder_4: () => Constants.TRACK_DATA?.soundEngine?.developerUsername || "Unknown Developer",
                placeholder_5: "Availability:",
                placeholder_6: () => Constants.TRACK_DATA?.soundEngine?.availability || "Private",
                placeholder_7: "Credits:",
                placeholder_8: () => Constants.TRACK_DATA?.soundEngine?.credits || "No Credits",
                placeholder_9: "-", // No value for this placeholder
                placeholder_10: "-", // No value for this placeholder
                placeholder_11: "-", // No value for this placeholder
                placeholder_12: "-", // No value for this placeholder
                placeholder_13: "-", // No value for this placeholder
                placeholder_14: "-", // No value for this placeholder
            },
        };
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

        console.log(`[DataManager] Fetching data for trackId: ${trackId}`);

        // Check cache first
        const cachedData = Constants.getTrackData(trackId);
        if (cachedData) {
            console.log('[DataManager] Track data found in cache:', cachedData);
            return cachedData;
        }

        // Fetch from the server
        const BASE_URL = 'https://media.maar.world:443/api';
        try {
            const response = await fetch(`${BASE_URL}/tracks/player/${trackId}`);
            if (!response.ok) {
                throw new Error(`[DataManager] Server returned error: ${response.statusText} (${response.status})`);
            }

            const result = await response.json();
            if (!result.success || !result.data) {
                throw new Error(result.message || 'Failed to fetch track data.');
            }

            console.log('[DataManager] Track data fetched successfully:', result.data);

            // Cache data and update Constants
            Constants.setTrackData(trackId, result.data);

            // Optionally, apply colors or other settings based on fetched data
            Constants.applyColorsFromTrackData();

            return result.data;
        } catch (error) {
            console.error('[DataManager] Error fetching track data:', error);
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
        console.log(`[DataManager] Cache cleared for trackId: ${trackId}`);
    }

    /**
     * Populates the UI placeholders based on the active information type.
     * @param {string} activeInfoType - The active information type (e.g., 'monitorInfo').
     */
    populatePlaceholders(activeInfoType) {
        if (!activeInfoType || !this.placeholderConfig[activeInfoType]) {
            console.warn('[DataManager] Invalid or no active information type provided.');
            this.clearPlaceholders();
            return;
        }

        const config = this.placeholderConfig[activeInfoType];

        Object.entries(config).forEach(([placeholderId, value]) => {
            const element = document.getElementById(placeholderId);
            if (element) {
                // If the value is a function, execute it to get the dynamic value
                const content = typeof value === 'function' ? value() : value;
                element.textContent = content;
                //console.log(`[DataManager] Populated ${placeholderId} with value: ${content}`);
            } else {
                console.warn(`[DataManager] Element with ID ${placeholderId} not found.`);
            }
        });
    }

    /**
     * Clears all placeholders by setting their text content to an empty string.
     */
    clearPlaceholders() {
        for (let i = 1; i <= 14; i++) {
            const element = document.getElementById(`placeholder_${i}`);
            if (element) {
                element.textContent = "";
              //  console.log(`[DataManager] Cleared placeholder_${i}`);
            }
        }
    }
}