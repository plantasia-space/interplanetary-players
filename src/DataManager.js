/**
 * @file DataManager.js
 * @description Manages data fetching, caching, and placeholder configuration for track information.
 * @version 1.0.0
 * @author 
 * @license MIT
 * @date 2024-12-07
 */

import { Constants } from './Constants.js';
 
/**
 * Class representing a data manager for handling track data and UI placeholders.
 * @class
 * @memberof CoreModule 
 */
export class DataManager {
    /**
     * Creates an instance of DataManager.
     */
    constructor() {
        /**
         * @type {number}
         * @description Cache expiry time in minutes, derived from Constants or defaulting to 10 minutes.
         */
        this.cacheExpiryMinutes = Constants.CACHE_EXPIRY_MINUTES || 10;
        this.parameterManager = null;
                    /**
         * @type {object}
         * @description Configuration object for UI placeholders, initialized as empty.
         */
        this.placeholderConfig = {};
    }

    /**
     * Fetches track data and updates the placeholder configuration.
     * @async
     * @public
     * @param {string} trackId - The ID of the track to fetch data for.
     * @returns {Promise<void>}
     * @throws Will log an error if fetching or updating fails.
     */
    async fetchAndUpdateConfig(trackId) {
        const startTime = new Date();
        //console.log(`[DataManager] [Timing] fetchAndUpdateConfig started at: ${startTime.toISOString()} for trackId: ${trackId}`);
    
        try {
            await this.fetchTrackData(trackId);
            const afterFetchTime = new Date();
            //console.log(`[DataManager] [Timing] fetchTrackData completed at: ${afterFetchTime.toISOString()}`);
    
            this.updatePlaceholderConfig(trackId);
            const afterUpdateTime = new Date();
            //console.log(`[DataManager] [Timing] updatePlaceholderConfig completed at: ${afterUpdateTime.toISOString()}`);
            //console.log('[DataManager] PlaceholderConfig updated successfully:', this.placeholderConfig);
    
            // Update loading state using Constants
            Constants.setLoadingState("trackLoaded", true);
            const endTime = new Date();
            //console.log(`[DataManager] [Timing] fetchAndUpdateConfig finished at: ${endTime.toISOString()}`);
        } catch (error) {
            console.error(`[DataManager] Error fetching and updating config: ${error.message}`);
        }
    }

    
    /**
     * Updates the configuration for UI placeholders using the retrieved track data.
     * @private
     */
    updatePlaceholderConfig(trackId) {
        const updateStartTime = new Date();
       // console.log(`[DataManager] [Timing] updatePlaceholderConfig started at: ${updateStartTime.toISOString()}`);
    
        if (!Constants.TRACK_DATA) {
            console.error("[DataManager] TRACK_DATA is not available for placeholder configuration.");
            return;
        }
    
        const { track, orbiter, interplanetaryPlayer } = Constants.TRACK_DATA;
    
        // We'll safely dig into exoplanetData:
        const exoData = interplanetaryPlayer?.exoplanetData;
        console.log("debug exoData", exoData);

        const currentExo = exoData?.currentExoplanet;
        const neighbor1 = exoData?.closestNeighbor1;
        const neighbor2 = exoData?.closestNeighbor2;
        console.log("debug", Constants.TRACK_DATA);
        // Configure placeholders for different sections
        this.placeholderConfig = {
            monitorInfo: {
                // X param
                placeholder_1: orbiter?.orbiterParams?.x?.label+":" || "Unknown",
                placeholder_2: "-",
              
                // Y param
                placeholder_3: orbiter?.orbiterParams?.y?.label+":" || "Unknown",
                placeholder_4: "-",
              
                // Z param
                placeholder_5: orbiter?.orbiterParams?.z?.label+":" || "Unknown",
                placeholder_6: "-",
              
                // Orbit A (current exoplanet)
                placeholder_7: currentExo?.sciName+":" || "-",
                placeholder_8: currentExo?.period_earthdays+" earth days" || "-",
              
                // Orbit B (closestNeighbor1)
                placeholder_9: neighbor1?.sciName+":" || "-",
                placeholder_10: neighbor1?.period_earthdays+" earth days" || "-",
              
                // Orbit C (closestNeighbor2)
                placeholder_11: neighbor2?.sciName+":" || "-",
                placeholder_12: neighbor2?.period_earthdays+" earth days" || "-",
            },
            trackInfo: {
                placeholder_1: "Artist:",
                placeholder_2: Array.isArray(track?.artists) && track.artists.length > 0
                    ? track.artists.map((artist) =>
                        typeof artist === 'object'
                            ? (artist.displayName || artist.username || "Unknown Artist")
                            : "Unknown Artist"
                      ).join(", ")
                    : "Unknown Artist",
                placeholder_3: "Track name:",
                placeholder_4: track?.trackName || "Unknown Track",
                placeholder_5: "Release:",
                placeholder_6: track?.releaseDate
                    ? new Date(track.releaseDate).toLocaleDateString("en-GB")
                    : "Unknown Date",
                placeholder_7: "Tags:",
                placeholder_8: track?.tags || "No Tags",
                placeholder_9: "Plays count:",
                placeholder_10: track?.playsCount || "0",
                placeholder_11: "Shares:",
                placeholder_12: track?.shares || "0",
                placeholder_13: "Likes:",
                placeholder_14: track?.likes || "0",
            },
            interplanetaryPlayerInfo: {
                placeholder_1: "Scientific Name:",
                placeholder_2: interplanetaryPlayer?.sciName || "Unknown Name",
                placeholder_3: "Artistic Name:",
                placeholder_4: interplanetaryPlayer?.artName || "Unknown Name",
                placeholder_5: "Creator username:",
                placeholder_6: typeof interplanetaryPlayer?.owner === 'object'
                    ? (interplanetaryPlayer.owner.displayName || interplanetaryPlayer.owner.username || "Unknown Owner")
                    : (interplanetaryPlayer?.owner || "Unknown Owner"),
                placeholder_7: "3D Artist username:",
                placeholder_8: typeof interplanetaryPlayer?.dddArtist === 'object'
                    ? (interplanetaryPlayer.dddArtist.displayName || interplanetaryPlayer.dddArtist.username || "Unknown Artist")
                    : (interplanetaryPlayer?.dddArtist || "Unknown Artist"),
                placeholder_9: "Orbital Period:",
                placeholder_10: interplanetaryPlayer?.orbitalPeriod || "Unknown Period",
                placeholder_11: "",
                placeholder_12: "",
                placeholder_13: "",
                placeholder_14: "",
            },
            orbiterInfo: {
                placeholder_1: "Name:",
                placeholder_2: orbiter?.orbiterName || "Unknown Engine",
                placeholder_3: "Developer:",
                placeholder_4: typeof orbiter?.developer === 'object'
                    ? (orbiter.developer.displayName || orbiter.developer.username || "Unknown Developer")
                    : (orbiter?.developer || "Unknown Developer"),
                placeholder_5: "Availability:",
                placeholder_6: typeof orbiter?.availability === 'boolean'
                    ? (orbiter.availability ? "Public" : "Private")
                    : "Private",
                placeholder_7: "Credits:",
                placeholder_8: orbiter?.credits || "No Credits",
                placeholder_9: "",
                placeholder_10: "",
                placeholder_11: "",
                placeholder_12: "",
                placeholder_13: "",
                placeholder_14: "",
            },
        };

        // Subscribe to root parameters X, Y, Z and update monitor placeholders
        const parameterManager = this.parameterManager || null;
        if (parameterManager) {
          const placeholderMap = {
            x: "placeholder_4",
            y: "placeholder_6",
            z: "placeholder_8"
          };

          ["x", "y", "z"].forEach((paramKey) => {
            parameterManager.subscribe({
              onParameterChanged: (name, value) => {
                const id = placeholderMap[name];
                const el = document.getElementById(id);
                if (el) el.textContent = typeof value === "number" ? value.toFixed(2) : value;
              },
              onRangeChanged: () => {},
              onScaleChanged: () => {}
            }, paramKey);
          });
        } else {
          console.warn("[DataManager] parameterManager not available in window context.");
        }

        // If running inside an iframe, post the placeholder config to the parent window
/*         if (window.parent && window.parent !== window) {
            // Extract track id if available from TRACK_DATA
            console.log("[DataManager-TRACK-ID]",trackId);

            window.parent.postMessage({
                type: "playerData",
                data: {
                    trackId: trackId,
                    monitorInfo: this.placeholderConfig.monitorInfo,
                    trackInfo: this.placeholderConfig.trackInfo,
                    interplanetaryPlayerInfo: this.placeholderConfig.interplanetaryPlayerInfo,
                    orbiterInfo: this.placeholderConfig.orbiterInfo
                }
            }, '*');
            const postMessageTime = new Date();
            console.log(`[DataManager] [Timing] PostMessage sent at: ${postMessageTime.toISOString()} with playerData.`);
        } */
    }

    /**
 * Sets the ParameterManager instance for subscribing to parameter updates.
 * @public
 * @param {ParameterManager} manager - The ParameterManager instance to assign.
 */
setParameterManager(manager) {
    this.parameterManager = manager;

    // Subscribe to root parameters X, Y, Z and update monitor placeholders
    const placeholderMap = {
        x: "placeholder_2",
        y: "placeholder_4",
        z: "placeholder_6"
    };

    ["x", "y", "z"].forEach((paramKey) => {
        this.parameterManager.subscribe({
            onParameterChanged: (name, value) => {
                const id = placeholderMap[name];
                const el = document.getElementById(id);
                if (el) el.textContent = typeof value === "number" ? value.toFixed(2) : value;
            },
            onRangeChanged: () => {},
            onScaleChanged: () => {}
        }, paramKey);
    });
}

    /**
     * Populates the UI placeholders with the configured data.
     * @public
     * @param {string} target - The type of information to populate (e.g., 'trackInfo').
     * @returns {void}
     * @throws Will log an error if the target is invalid or missing.
     */
    populatePlaceholders(target) {
        if (!target || !this.placeholderConfig[target]) {
            console.error(`[DataManager] Invalid or no active information type provided: ${target}`);
            this.clearPlaceholders(); // Clear placeholders if configuration is missing
            return;
        }
        
        const config = this.placeholderConfig[target];
        Object.entries(config).forEach(([placeholderId, value]) => {
            const element = document.getElementById(placeholderId);
            if (element) {
                // If the value is a function, execute it to get the content
                const content = typeof value === 'function' ? value() : value;
                element.textContent = content;
            } else {
                console.warn(`[DataManager] Element with ID ${placeholderId} not found.`);
            }
        });
        
        // Optionally log the update (commented out to reduce console noise)
        // console.log(`[DataManager] Placeholders updated for target: ${target}`);
    }

    /**
     * Clears all UI placeholders by setting their text content to empty strings.
     * @private
     * @returns {void}
     */
    clearPlaceholders() {
        for (let i = 1; i <= 14; i++) {
            const element = document.getElementById(`placeholder_${i}`);
            if (element) {
                element.textContent = "";
            }
        }
    }

    /**
     * Fetches track data from the server or retrieves it from the cache if available.
     * @async
     * @public
     * @param {string} trackId - The ID of the track to fetch data for.
     * @returns {Promise<Object>} The track data.
     * @throws Will throw an error if the fetch fails or the data is invalid.
     */
    async fetchTrackData(trackId) {
        const fetchStartTime = new Date();
        //console.log(`[DataManager] [Timing] fetchTrackData started at: ${fetchStartTime.toISOString()} for trackId: ${trackId}`);
       
        // Attempt to retrieve cached data
        const cachedData = Constants.getTrackData(trackId);
        if (cachedData) {
            //console.log('[DataManager] Track data found in cache:', cachedData);
            return cachedData;
        }

        const BASE_URL = 'https://api.plantasia.space:443/api';
        try {
            // Fetch data from the server
            const response = await fetch(`${BASE_URL}/tracks/player/${trackId}`);
            if (!response.ok) {
                throw new Error(`[DataManager] Server error: ${response.statusText} (${response.status})`);
            }

            const result = await response.json();
            if (!result.success || !result.data) {
                throw new Error('[DataManager] Invalid track data from server.');
            }

            // Cache the retrieved data for future use
            Constants.setTrackData(trackId, result.data);
            const fetchEndTime = new Date();
            //console.log(`[DataManager] [Timing] fetchTrackData finished at: ${fetchEndTime.toISOString()}`);
            return result.data;
        } catch (error) {
            console.error(`[DataManager] Failed to fetch track data: ${error.message}`);
            throw error;
        }
    }
}
