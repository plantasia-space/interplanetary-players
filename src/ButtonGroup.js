// ButtonGroup.js
import { ModeManagerInstance } from './ModeManager.js'; // Import ModeManager
import { MIDIControllerInstance } from './MIDIController.js';
import { MIDI_SUPPORTED, SENSORS_SUPPORTED, INTERNAL_SENSORS_USABLE, EXTERNAL_SENSORS_USABLE, setExternalSensorsUsable } from './Constants.js';
import notifications from './AppNotifications.js';
import { SensorController } from './SensorsController.js';

/**
 * Class representing a group of buttons with dropdown menus for various functionalities.
 * @class
 * @memberof 2DGUI 
 */
export class ButtonGroup {
    /**
     * Creates an instance of ButtonGroup.
     * @param {string} containerSelector - CSS selector for the button group container.
     * @param {string} dropdownSelector - CSS selector for the dropdown element within the container.
     * @param {string} buttonSelector - CSS selector for the main button within the container.
     * @param {string} menuItemsSelector - CSS selector for the menu items within the dropdown.
     * @param {string} iconSelector - CSS selector for the icon within the main button.
     * @param {SoundEngine} soundEngine - Instance of SoundEngine for managing audio controls.
     * @param {DataManager} [dataManager=null] - Instance of DataManager for managing data (optional).
     * @param {User1Manager} [user1Manager=null] - Instance of User1Manager for managing user parameters (optional).
     */
    constructor(
        containerSelector,
        dropdownSelector,
        buttonSelector,
        menuItemsSelector,
        iconSelector,
        soundEngine,
        dataManager = null,
        user1Manager = null // Added parameter
    ) {
        this.soundEngine = soundEngine;
        this.dataManager = dataManager;
        this.user1Manager = user1Manager; // Store user1Manager

        // Store the selector for use in logging
        this.containerSelector = containerSelector;

        // Select key elements within the container
        this.container = document.querySelector(containerSelector);
        if (!this.container) {
            console.error(`ButtonGroup Error: No element found for selector "${containerSelector}"`);
            return;
        }
        this.dropdown = this.container.querySelector(dropdownSelector);
        this.button = this.container.querySelector(buttonSelector);
        this.menuItems = this.dropdown.querySelectorAll(menuItemsSelector);
        this.icon = this.button.querySelector(iconSelector);
        this.gridWrapper = document.querySelector('.grid-wrapper'); // Grid wrapper element
        this.gridContent = document.querySelector('.grid-content'); // Grid content element
        this.closeGridBtn = document.querySelector('.close-grid-btn'); // Close button for the grid
        this.collapseElement = document.getElementById('collapseInfoMenu'); // Collapsible menu element

        // Validate the presence of essential elements
        if (!this.dropdown || !this.button || !this.menuItems.length || !this.icon) {
            console.error('ButtonGroup initialization failed: Missing essential elements.');
            return;
        }

        // Initialize Bootstrap Collapse instance if the collapsible menu exists
        this.collapseInstance = null;
        if (this.collapseElement) {
            this.collapseInstance = bootstrap.Collapse.getOrCreateInstance(this.collapseElement);
        }

        // Reference to the MIDIController instance
        this.midiController = MIDIControllerInstance;

        // Initialize the ButtonGroup
        this.init();
    }

    /**
     * Initializes the ButtonGroup by setting up SVGs and event bindings.
     * @private
     * @async
     */
    async init() {
        console.log(`Initializing dropdowns for "${this.containerSelector}"`);

        if (this.collapseInstance) {
            this.collapseInstance = bootstrap.Collapse.getOrCreateInstance(this.collapseElement);
        }

        // Adjust the dropdown based on MIDI and sensor support
        await this.adjustForHardwareSupport();

        // Load dynamic SVGs for the main button and dropdown menu items
        this.loadDynamicSVGs();

        // Bind event listeners to menu items and buttons
        this.bindEvents();

        // Initialize Bootstrap Dropdowns to prevent global interference
        this.container.querySelectorAll('.dropdown-toggle').forEach(dropdown => {
            new bootstrap.Dropdown(dropdown); // Initialize with default behavior
        });
    }

    /**
     * Loads dynamic SVGs for the main button and dropdown menu items.
     * @private
     */
    loadDynamicSVGs() {
        // Load SVG for the main button if a data-src attribute is present
        const src = this.icon.getAttribute('data-src');
        if (src) {
            this.fetchAndSetSVG(src, this.icon, true);
        }

        // Iterate through each menu item to set up their icons
        this.menuItems.forEach(item => {
            const iconImg = item.querySelector('img');
            const src = item.getAttribute('data-icon');
            if (src && iconImg) {
                iconImg.src = src;
                iconImg.alt = item.getAttribute('data-value') || 'Menu Item';
                iconImg.style.filter = 'brightness(0) saturate(100%)';
                iconImg.style.marginRight = '8px';
                iconImg.style.width = '16px';
                iconImg.style.height = '16px';
            }
        });
    }

    /**
     * Fetches and sets SVG content into a specified element.
     * @param {string} src - URL of the SVG file to fetch.
     * @param {HTMLElement} element - DOM element to insert the fetched SVG into.
     * @param {boolean} [isInline=true] - Whether to insert the SVG inline.
     * @private
     */
    fetchAndSetSVG(src, element, isInline = true) {
        if (!isInline) return;

        fetch(src)
            .then(response => {
                if (!response.ok) throw new Error(`Failed to load SVG: ${src}`);
                return response.text();
            })
            .then(svgContent => {
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
                const svgElement = svgDoc.documentElement;

                if (svgElement && svgElement.tagName.toLowerCase() === 'svg') {
                    svgElement.setAttribute('fill', 'currentColor');
                    svgElement.setAttribute('role', 'img');
                    svgElement.classList.add('icon-svg');
                    element.innerHTML = ''; // Clear existing content
                    element.appendChild(svgElement); // Insert the SVG
                } else {
                    console.error(`Invalid SVG content fetched from: ${src}`);
                }
            })
            .catch(error => console.error(`Error loading SVG from ${src}:`, error));
    }

    /**
     * Binds event listeners to menu items and the close grid button.
     * @private
     */
    bindEvents() {
        // Bind click events to each menu item
        this.menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const selectedValue = item.getAttribute('data-value');
                console.log(`[Dropdown] Item clicked: ${selectedValue}`);
                this.onSelectionChange(selectedValue);
            });
        });

        // Bind click event to the close grid button if it exists
        if (this.closeGridBtn) {
            this.closeGridBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.hideGrid();
            });
        }
    }

    /**
     * Handles selection changes from the dropdown menu.
     * Updates the button's icon and label to reflect the selected menu item.
     * @param {string} selectedValue - The value of the selected menu item.
     * @private
     */
    onSelectionChange(selectedValue) {
        console.log(`[Dropdown] Item clicked: ${selectedValue}`);

        // Precheck MIDI support and controller initialization
        const isMidiLearnAvailable = MIDI_SUPPORTED && this.midiController;

        const groupType = this.container.getAttribute('data-group');
        if (!groupType) {
            console.warn(`[ButtonGroup] Unknown or missing group type.`);
            return;
        }

        // Handle MIDI Learn mode if available
        if (isMidiLearnAvailable && this.midiController.isMidiLearnModeActive) {
            const selectedItem = [...this.menuItems].find(item => item.getAttribute('data-value') === selectedValue);

            if (selectedItem) {
                console.log(`[Dropdown] MIDI Learn active: Mapping dropdown item "${selectedValue}"`);
                this.midiController.startMidiLearnForWidget(selectedItem);
            } else {
                console.warn(`[Dropdown] Selected item "${selectedValue}" not found.`);
            }
            return; // Exit early
        }

        // Update the main button's icon and label
        const selectedItem = [...this.menuItems].find(item => item.getAttribute('data-value') === selectedValue);
        if (selectedItem) {
            const newIconPath = selectedItem.getAttribute('data-icon');
            const newLabel = selectedItem.textContent.trim();

            if (newIconPath) this.fetchAndSetSVG(newIconPath, this.icon, true);
            if (newLabel) this.button.setAttribute('aria-label', newLabel);
        }

        // Handle group-specific actions
        switch (groupType) {
            case 'information-dropdown':
                this.handleInformationDropdown(selectedValue);
                break;
            case 'transport-dropdown':
                this.handleTransportDropdown(selectedValue);
                break;
            case 'interaction-dropdown':
                this.handleInteractionDropdown(selectedValue);
                break;
            case 'more-dropdown': // Case for the More menu
                this.handleMoreDropdown(selectedValue);
                break;
            case 'z-waveform-dropdown':
            case 'y-waveform-dropdown':
            case 'x-waveform-dropdown':
                this.handleWaveformDropdown(groupType, selectedValue);
                break;
            case 'z-exo-lfo-dropdown':
            case 'y-exo-lfo-dropdown':
            case 'x-exo-lfo-dropdown':
                this.handleExoplanetDropdown(groupType, selectedValue);
                break;
            default:
                console.warn(`[ButtonGroup] Unknown group type: ${groupType}`);
        }
    }

    /**
     * Handles waveform dropdown menu selections.
     * @param {string} groupType - The type of waveform group (e.g., z-waveform-dropdown).
     * @param {string} selectedValue - The selected waveform value.
     * @private
     */
    handleWaveformDropdown(groupType, selectedValue) {
        console.log(`[Waveform Dropdown] Group: ${groupType}, Selected: ${selectedValue}`);
        // Placeholder for waveform handling logic
        // TODO: Integrate CosmicLFO or relevant functionality here
    }

    /**
     * Handles exoplanet dropdown menu selections.
     * @param {string} groupType - The type of exoplanet group (e.g., z-exo-lfo-dropdown).
     * @param {string} selectedValue - The selected exoplanet value.
     * @private
     */
    handleExoplanetDropdown(groupType, selectedValue) {
        console.log(`[Exoplanet Dropdown] Group: ${groupType}, Selected: ${selectedValue}`);
        // Placeholder for exoplanet handling logic
        // TODO: Integrate CosmicLFO or relevant functionality here
    }

    /**
     * Handles selections from the More dropdown menu.
     * @param {string} selectedValue - The selected action.
     * @private
     */
    handleMoreDropdown(selectedValue) {
        console.log(`[More Dropdown] Selected: ${selectedValue}`);

        switch (selectedValue) {
            case 'Share':
                console.log('[More Dropdown] Share option clicked.');
                notifications.showToast('Sharing functionality is under development!', 'info');
                break;

            case 'Fullscreen':
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                    console.log('[More Dropdown] Exited fullscreen mode.');
                    notifications.showToast('Exited fullscreen mode.');
                } else {
                    document.documentElement.requestFullscreen();
                    console.log('[More Dropdown] Entered fullscreen mode.');
                    notifications.showToast('Entered fullscreen mode.');
                }
                break;

            default:
                console.warn(`[More Dropdown] Unknown action: ${selectedValue}`);
        }
    }

    /**
     * Handles selections from the information dropdown menu.
     * @param {string} selectedValue - The selected information type.
     * @private
     */
    handleInformationDropdown(selectedValue) {
        console.log(`[Information Dropdown] Selected: ${selectedValue}`);
        const typeMap = {
            'Control Monitor': 'monitorInfo',
            'Track': 'trackInfo',
            'Interplanetary Player': 'interplanetaryPlayerInfo',
            'Sound Engine': 'soundEngineInfo',
        };

        const target = typeMap[selectedValue];

        if (target) {
            if (this.dataManager) {
                // Populate placeholders based on the selected target
                this.dataManager.populatePlaceholders(target);
                this.showGrid();
            } else {
                console.error('[Information Dropdown] DataManager instance is not defined.');
            }
        } else {
            console.warn(`[Information Dropdown] Unknown selection: ${selectedValue}`);
        }
    }

    /**
     * Displays the grid wrapper and expands the collapsible menu.
     * @private
     */
    showGrid() {
        if (this.gridWrapper) {
            this.gridWrapper.style.display = 'grid';
            console.log('[Grid] Grid is now visible.');
        }

        if (this.collapseInstance) {
            this.collapseInstance.show();
            console.log('[Collapse] Collapsible menu is now expanded.');
        }
    }

    /**
     * Hides the grid wrapper and collapses the menu.
     * @private
     */
    hideGrid() {
        if (this.gridWrapper) {
            this.gridWrapper.style.display = 'none';
            console.log('[Grid] Grid has been hidden.');
        }

        if (this.collapseInstance) {
            this.collapseInstance.hide();
            console.log('[Collapse] Collapsible menu is now collapsed.');
        }
    }

    /**
     * Handles selections from the transport dropdown menu.
     * @param {string} selectedValue - The selected transport action.
     * @private
     */
    handleTransportDropdown(selectedValue) {
        console.log(`[Transport Dropdown] Selected: ${selectedValue}`);
        switch (selectedValue.toLowerCase()) {
            case 'play':
                this.soundEngine.play();
                break;
            case 'pause':
                this.soundEngine.pause();
                break;
            case 'stop':
                this.soundEngine.stop();
                break;
            default:
                console.warn(`[Transport Dropdown] Unknown action: ${selectedValue}`);
        }
    }

    /**
     * Handles selections from the interaction dropdown menu.
     * Delegates mode activations to ModeManager.
     * @param {string} selectedValue - The selected interaction mode.
     * @private
     */
    handleInteractionDropdown(selectedValue) {
        console.log(`[Interaction Dropdown] Selected: ${selectedValue}`);
        switch (selectedValue) {
            case 'Jam':
                ModeManagerInstance.activateMode('JAM');
                break;

            case 'MIDI':
                ModeManagerInstance.activateMode('MIDI_LEARN');
                break;

            case 'Sensors':
                ModeManagerInstance.activateMode('SENSORS');
                break;

            case 'Cosmic LFO':
                ModeManagerInstance.activateMode('COSMIC_LFO');
                break;
            case 'Playback':
                ModeManagerInstance.activateMode('PLAYBACK');
                break;

            default:
                console.warn(`[ButtonGroup] Unknown interaction mode selected: ${selectedValue}`);
        }
    }

    /**
     * Adjusts the dropdown menu based on hardware support (MIDI and Sensors).
     * Hides or shows menu items accordingly.
     * @private
     */
    async adjustForHardwareSupport() {
        const sensorsAvailable = await SENSORS_SUPPORTED;
        console.log(`[ButtonGroup] Sensors support: ${sensorsAvailable ? 'Available' : 'Unavailable'}`);
        
        this.menuItems.forEach(item => {
            const value = item.getAttribute('data-value');
            if (value === 'MIDI') {
                item.style.display = MIDI_SUPPORTED ? 'block' : 'none';
                console.log(`[ButtonGroup] MIDI menu item display set to: ${MIDI_SUPPORTED ? 'block' : 'none'}`);
            } else if (value === 'Sensors') {
                item.style.display = sensorsAvailable ? 'block' : 'none';
                console.log(`[ButtonGroup] Sensors menu item display set to: ${sensorsAvailable ? 'block' : 'none'}`);
            }
        });

        console.log(`[ButtonGroup] MIDI support: ${MIDI_SUPPORTED ? 'Enabled' : 'Disabled'}`);
        console.log(`[ButtonGroup] Sensors support: ${sensorsAvailable ? 'Available' : 'Unavailable'}`);
    }
}