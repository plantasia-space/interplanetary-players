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
        /**
         * @type {string|null}
         * @description Currently active view for conditional parameter updates.
         */
        this.activeView = null;
        /**
         * Stores latest root parameter values.
         * @private
         */
        this.lastParamValues = {};
    }

    /**
     * Retrieves and formats the current value of a root parameter.
     * @private
     * @param {string} name - The name of the parameter ('x','y','z').
     * @returns {string} Formatted parameter value or hyphen.
     */
    _getParamValueFormatted(name) {
        // Use cached value if available
        if (name in this.lastParamValues) {
            const cached = this.lastParamValues[name];
            const formatted = typeof cached === 'number' ? cached.toFixed(2) : String(cached);
            return formatted;
        }
        if (!this.parameterManager) return "-";
        let val;
        if (typeof this.parameterManager.getParameterValue === 'function') {
            val = this.parameterManager.getParameterValue(name);
        } else if (typeof this.parameterManager.getParameter === 'function') {
            val = this.parameterManager.getParameter(name)?.value;
        }
        if (val != null) {
            const formatted = typeof val === 'number' ? val.toFixed(2) : String(val);
            return formatted;
        }
        return "-";
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

        const currentExo = exoData?.currentExoplanet;
        const neighbor1 = exoData?.closestNeighbor1;
        const neighbor2 = exoData?.closestNeighbor2;
        // Configure placeholders for different sections
        this.placeholderConfig = {
            monitorInfo: {
                // X param
                placeholder_1: orbiter?.orbiterParams?.x?.label+":" || "Unknown",
                placeholder_2: () => this._getParamValueFormatted('x'),
              
                // Y param
                placeholder_3: orbiter?.orbiterParams?.y?.label+":" || "Unknown",
                placeholder_4: () => this._getParamValueFormatted('y'),
              
                // Z param
                placeholder_5: orbiter?.orbiterParams?.z?.label+":" || "Unknown",
                placeholder_6: () => this._getParamValueFormatted('z'),
              
                // Orbit A (current exoplanet)
                placeholder_7: () => currentExo?.sciName ? `${currentExo.sciName}:` : "",
                placeholder_8: () => currentExo?.period_earthdays != null ? `${currentExo.period_earthdays} earth days` : "",

                // Orbit B (closestNeighbor1)
                placeholder_9: () => neighbor1?.sciName ? `${neighbor1.sciName}:` : "",
                placeholder_10: () => neighbor1?.period_earthdays != null ? `${neighbor1.period_earthdays} earth days` : "",

                // Orbit C (closestNeighbor2)
                placeholder_11: () => neighbor2?.sciName ? `${neighbor2.sciName}:` : "",
                placeholder_12: () => neighbor2?.period_earthdays != null ? `${neighbor2.period_earthdays} earth days` : "",
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
                placeholder_7: () => (track?.tags || track?.additionalTags) ? "Tags:" : "",
                placeholder_8: () => (track?.tags || track?.additionalTags) ? (track.tags || track.additionalTags) : "",
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
                placeholder_7: () => orbiter?.credits ? "Credits:" : "",
                placeholder_8: () => orbiter?.credits ? orbiter.credits : "",
                placeholder_9: "",
                placeholder_10: "",
                placeholder_11: "",
                placeholder_12: "",
                placeholder_13: "",
                placeholder_14: "",
            },
        };

        // Debug: Log all placeholderConfig sections and values
        Object.entries(this.placeholderConfig).forEach(([section, cfg]) => {
            //console.log(`[DataManager] ${section} placeholders debug:`);
            Object.entries(cfg).forEach(([key, val]) => {
                const content = typeof val === 'function' ? val() : val;
                //console.log(`  ${key}:`, content);
            });
        });

        // If running inside an iframe, post the placeholder config to the parent window

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
                    // Cache the latest value
                    this.lastParamValues[name] = value;
                    // Only update placeholders in Control Monitor view
                    if (this.activeView !== "monitorInfo") {
                        return;
                    }
                    const id = placeholderMap[name];
                    const el = document.getElementById(id);
                    if (el) el.textContent = typeof value === "number" ? value.toFixed(2) : value;
                },
                onRangeChanged: () => {},
                onScaleChanged: () => {}
            }, paramKey);
        });
        // Force initial placeholder refresh if Control Monitor is active
        if (this.activeView === 'monitorInfo') {
            this.populatePlaceholders('monitorInfo');
        }
    }

    /**
     * Populates the UI placeholders with the configured data.
     * @public
     * @param {string} target - The type of information to populate (e.g., 'trackInfo').
     * @returns {void}
     * @throws Will log an error if the target is invalid or missing.
     */
    populatePlaceholders(target) {
        // Track the currently active view for parameter updates
        this.activeView = target;

        if (!target || !this.placeholderConfig[target]) {
            console.error(`[DataManager] Invalid or no active information type provided: ${target}`);
            this.clearPlaceholders(); // Clear placeholders if configuration is missing
            return;
        }
        
        const config = this.placeholderConfig[target];

        Object.entries(config).forEach(([placeholderId, value]) => {
            const element = document.getElementById(placeholderId);
            if (!element) return;
            // Determine placeholder content
            const content = typeof value === 'function' ? value() : value;
            // Hide if undefined, null, empty string, hyphen, or 'Unknown'
            if (content == null || content === '' || content === '-' || content === 'Unknown') {
                element.style.display = 'none';
            } else {
                element.style.display = '';
                element.textContent = content;
            }
        });

        // Immediately refresh root parameter values when entering Control Monitor view
        if (target === 'monitorInfo' && this.parameterManager) {
            const rootMap = { x: 'placeholder_2', y: 'placeholder_4', z: 'placeholder_6' };
            Object.entries(rootMap).forEach(([name, id]) => {
                let value;
                if (typeof this.parameterManager.getParameter === 'function') {
                    const paramObj = this.parameterManager.getParameter(name);
                    value = paramObj?.value;
                } else if (typeof this.parameterManager.getParameterValue === 'function') {
                    value = this.parameterManager.getParameterValue(name);
                }
                if (value != null) {
                    const el = document.getElementById(id);
                    if (el) el.textContent = typeof value === 'number' ? value.toFixed(2) : value;
                }
            });
        }
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

        // Determine API base: prefer global window.API_BASE injected by host; fallback to same‑origin /api or prod URL
        const BASE_URL =
          (typeof window !== 'undefined' && window.API_BASE) ||
          (window.location && window.location.origin ? `${window.location.origin}/api` : 'https://api.plantasia.space/api');
        try {
            // Fetch data from the server
            const response = await fetch(`${BASE_URL}/tracks/player/${trackId}`, {
                credentials: 'include',               // send cookies if present
                headers: { 'Accept': 'application/json' }
            });
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
