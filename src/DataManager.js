import { Constants } from './Constants.js';

export class DataManager {
    constructor() {
        this.cacheExpiryMinutes = Constants.CACHE_EXPIRY_MINUTES || 10; // Tiempo de expiración de caché
        this.placeholderConfig = {}; // Inicializar configuración de placeholders como vacío
    }

    /**
     * Encapsula el fetch y la actualización de los placeholders.
     * @param {string} trackId - El ID del track.
     */
    async fetchAndUpdateConfig(trackId) {
        console.log(`[DataManager] Starting fetch and update for trackId: ${trackId}`);

        // Obtener los datos del track
        await this.fetchTrackData(trackId);

        // Configurar placeholderConfig después de obtener los datos
        this.updatePlaceholderConfig();
        console.log('[DataManager] PlaceholderConfig updated successfully:', this.placeholderConfig);
    }

    /**
     * Actualiza la configuración de los placeholders usando la data recuperada.
     */
    updatePlaceholderConfig() {
        if (!Constants.TRACK_DATA) {
            console.error("[DataManager] TRACK_DATA is not available for placeholder configuration.");
            return;
        }

        const { track, soundEngine, interplanetaryPlayer } = Constants.TRACK_DATA;

        this.placeholderConfig = {
            monitorInfo: {
                placeholder_1: "Distance:",
                placeholder_2: "-",
                placeholder_3: soundEngine?.soundEngineParams?.xParam?.label || "Unknown",
                placeholder_4: "-",
                placeholder_5: soundEngine?.soundEngineParams?.yParam?.label || "Unknown",
                placeholder_6: "-",
                placeholder_7: soundEngine?.soundEngineParams?.zParam?.label || "Unknown",
                placeholder_8: "-",
                placeholder_9: "Orbit A",
                placeholder_10: "-",
                placeholder_11: "Orbit B",
                placeholder_12: "-",
                placeholder_13: "Orbit C",
                placeholder_14: "-",
            },
            trackInfo: {
                placeholder_1: "Artist:",
                placeholder_2: track?.artists || "Unknown Artist",
                placeholder_3: "Track name:",
                placeholder_4: track?.trackName || "Unknown Track",
                placeholder_5: "Release:",
                placeholder_6: track?.releaseDate ? new Date(track.releaseDate).toLocaleDateString("en-GB") : "Unknown Date",
                placeholder_7: "Tags:",
                placeholder_8: track?.tags || "No Tags",
                placeholder_9: "Plays count:",
                placeholder_10: "",
                placeholder_11: "Shares:",
                placeholder_12: "",
                placeholder_13: "",
                placeholder_14: "",
            },
            interplanetaryPlayerInfo: {
                placeholder_1: "Scientific Name:",
                placeholder_2: interplanetaryPlayer?.sciName || "Unknown Name",
                placeholder_3: "Artistic Name:",
                placeholder_4: interplanetaryPlayer?.artName || "Unknown Name",
                placeholder_5: "Creator:",
                placeholder_6: interplanetaryPlayer?.owner || "Unknown Owner",
                placeholder_7: "3D Artist:",
                placeholder_8: interplanetaryPlayer?.dddArtist || "Unknown Artist",
                placeholder_9: "Orbital Period:",
                placeholder_10: interplanetaryPlayer?.orbitalPeriod || "Unknown Period",
                placeholder_11: "",
                placeholder_12: "",
                placeholder_13: "",
                placeholder_14: "",
            },
            soundEngineInfo: {
                placeholder_1: "Name:",
                placeholder_2: soundEngine?.soundEngineName || "Unknown Engine",
                placeholder_3: "Developer:",
                placeholder_4: soundEngine?.developerUsername || "Unknown Developer",
                placeholder_5: "Availability:",
                placeholder_6: soundEngine?.availability || "Private",
                placeholder_7: "Credits:",
                placeholder_8: soundEngine?.credits || "No Credits",
                placeholder_9: "",
                placeholder_10: "",
                placeholder_11: "",
                placeholder_12: "",
                placeholder_13: "",
                placeholder_14: "",
            },
        };

        console.log("[DataManager] PlaceholderConfig updated:", this.placeholderConfig);
    }

    /**
     * Poblar los placeholders en la UI.
     * @param {string} activeInfoType - El tipo de información activa.
     */
    populatePlaceholders(target) {
        if (!target || !this.placeholderConfig[target]) {
            console.error(`[DataManager] Invalid or no active information type provided: ${target}`);
            this.clearPlaceholders(); // Limpiar si no se encuentra configuración
            return;
        }
        
        const config = this.placeholderConfig[target];
        Object.entries(config).forEach(([placeholderId, value]) => {
            const element = document.getElementById(placeholderId);
            if (element) {
                const content = typeof value === 'function' ? value() : value;
                element.textContent = content;
            } else {
                console.warn(`[DataManager] Element with ID ${placeholderId} not found.`);
            }
        });
        
       // console.log(`[DataManager] Placeholders updated for target: ${target}`);
    }
    /**
     * Limpia todos los placeholders.
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
     * Obtiene datos de track del servidor.
     * @param {string} trackId - El ID del track.
     */
    async fetchTrackData(trackId) {
        const cachedData = Constants.getTrackData(trackId);
        if (cachedData) {
            console.log('[DataManager] Track data found in cache:', cachedData);
            return cachedData;
        }

        const BASE_URL = 'https://media.maar.world:443/api';
        const response = await fetch(`${BASE_URL}/tracks/player/${trackId}`);
        if (!response.ok) {
            throw new Error(`[DataManager] Server error: ${response.statusText} (${response.status})`);
        }

        const result = await response.json();
        if (!result.success || !result.data) {
            throw new Error('[DataManager] Invalid track data from server.');
        }

        Constants.setTrackData(trackId, result.data);
        return result.data;
    }
}

