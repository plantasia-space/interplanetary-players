/**
 * @file ButtonGroup.js
 * @version 2.0.0
 * @autor 𝐵𝓇𝓊𝓃𝒶 𝒢𝓊𝒶𝓇𝓃𝒾𝑒𝓇𝒾
 * @license MIT
 * @date 2024-12-07
 * @description Manages button groups within the Interplanetary Players application, handling interactions, SVG loading, and event bindings.
 */

import { MIDIControllerInstance } from './MIDIController.js';
import { MIDI_SUPPORTED, SENSORS_SUPPORTED } from './constants.js';

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
     * @param {AudioPlayer} audioPlayer - Instance of AudioPlayer for managing audio controls.
     * @param {DataManager} [dataManager=null] - Instance of DataManager for managing data (optional).
     */
    constructor(
        containerSelector,
        dropdownSelector,
        buttonSelector,
        menuItemsSelector,
        iconSelector,
        audioPlayer,
        dataManager = null
    ) {
        this.audioPlayer = audioPlayer;
        this.dataManager = dataManager;

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

        this.sensorsActivated = false; // Tracks if sensors have been activated

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
                const newIconPath = item.getAttribute('data-icon');
                const newValue = item.getAttribute('data-value');
            
                if (newIconPath && newValue) {
                    // Update the main button's icon and aria-label
                    this.icon.setAttribute('data-src', newIconPath);
                    this.icon.setAttribute('aria-label', newValue);
                    this.fetchAndSetSVG(newIconPath, this.icon, true);
                }
            
                // Handle the selection change based on the new value
                this.onSelectionChange(newValue);
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
     * @param {string} selectedValue - The value of the selected menu item.
     * @private
     */
    onSelectionChange(selectedValue) {
        // Determine the type of button group based on a data attribute
        const groupType = this.container.getAttribute('data-group');

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
            default:
                console.warn(`Unknown group type: ${groupType}`);
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
                this.audioPlayer.play();
                break;
            case 'pause':
                this.audioPlayer.pause();
                break;
            case 'stop':
                this.audioPlayer.stop();
                break;
            default:
                console.warn(`[Transport Dropdown] Unknown action: ${selectedValue}`);
        }
    }

    /**
     * Handles selections from the interaction dropdown menu.
     * @param {string} selectedValue - The selected interaction mode.
     * @private
     * @async
     */
    async handleInteractionDropdown(selectedValue) {
        switch (selectedValue) {
            case 'Jam':
                console.log('Jam mode activated.');
                // Implement Jam mode activation logic here
                break;

            case 'MIDI':
                try {
                    await MIDIControllerInstance.activateMIDI();
                    MIDIControllerInstance.enableMidiLearn();
                    console.log('MIDI mode activated successfully.');
                } catch (error) {
                    console.error('MIDI Activation Error:', error);
                }
                break;

            case 'Sensors':
                if (!this.sensorsActivated) {
                    try {
                        await this.activateSensorsMode();
                    } catch (error) {
                        console.error('Error activating sensors:', error);
                    }
                } else {
                    console.log('[ButtonGroup] Sensors mode is already activated.');
                }
                break;

            case 'Cosmic LFO':
                console.log('Cosmic LFO mode activated.');
                this.activateCosmicLFO();
                break;

            default:
                console.warn(`Unknown interaction mode: ${selectedValue}`);
        }
    }

    /**
     * Activates the Cosmic LFO mode.
     * @private
     */
    activateCosmicLFO() {
        console.log("Cosmic LFO activated.");
        // Implement Cosmic LFO activation logic here
    }

    /**
     * Activates the Sensors mode.
     * @private
     */
    activateSensors() {
        console.log("Sensors mode activated.");
        // Implement Sensors activation logic here
    }

    /**
     * Adjusts the dropdown menu based on hardware support (MIDI and Sensors).
     * Hides or shows menu items accordingly.
     * @private
     */
    async adjustForHardwareSupport() {
        const sensorsAvailable = await SENSORS_SUPPORTED;

        this.menuItems.forEach(item => {
            const value = item.getAttribute('data-value');
            if (value === 'MIDI') {
                item.style.display = MIDI_SUPPORTED ? 'block' : 'none';
            } else if (value === 'Sensors') {
                item.style.display = 'block'; // Always visible for sensors
                console.log(`[ButtonGroup] Sensors button always visible.`);
            }
        });

        console.log(`[ButtonGroup] MIDI support: ${MIDI_SUPPORTED ? 'Enabled' : 'Disabled'}`);
        console.log(`[ButtonGroup] Sensors support: ${sensorsAvailable ? 'Available' : 'Unavailable'}`);
    }

    /**
     * Activates Sensors mode by requesting permission and initializing the SensorController.
     * @private
     * @async
     */
    async activateSensorsMode() {
        if (!SensorControllerInstance) {
            console.warn('[ButtonGroup] Sensors are not supported by this browser/device.');
            return;
        }

        try {
            const permissionGranted = await SensorControllerInstance.requestPermission();
            if (permissionGranted) {
                await SensorControllerInstance.activateSensors();
                this.sensorsActivated = true;
                console.log('[ButtonGroup] Sensors mode activated successfully.');
            } else {
                console.warn('[ButtonGroup] Permission denied for sensors.');
            }
        } catch (error) {
            console.error('[ButtonGroup] Error activating sensors mode:', error);
        }
    }


}