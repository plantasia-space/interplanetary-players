// ButtonGroup.js

import { ModeManagerInstance } from './ModeManager.js';
import { MIDIControllerInstance } from './MIDIController.js';
import {
  MIDI_SUPPORTED,
  SENSORS_SUPPORTED,
  INTERNAL_SENSORS_USABLE,
  EXTERNAL_SENSORS_USABLE,
  setExternalSensorsUsable
} from './Constants.js';
import notifications from './AppNotifications.js';
import { SensorController } from './SensorsController.js';
import { cosmicLFOManager } from './Main.js'; // <--- Import LFO manager

export class ButtonGroup {
  /**
   * Creates an instance of ButtonGroup.
   * @param {string} containerSelector - CSS selector for the button group container.
   * @param {string} dropdownSelector - CSS selector for the dropdown element within the container.
   * @param {string} buttonSelector - CSS selector for the main button within the container.
   * @param {string} menuItemsSelector - CSS selector for the menu items within the dropdown.
   * @param {string} iconSelector - CSS selector for the icon within the main button.
   * @param {Orbiter} orbiter - Instance of Orbiter for managing audio controls.
   * @param {DataManager} [dataManager=null] - DataManager for managing data (optional).
   * @param {User1Manager} [user1Manager=null] - User1Manager for managing user parameters (optional).
   */
  constructor(
    containerSelector,
    dropdownSelector,
    buttonSelector,
    menuItemsSelector,
    iconSelector,
    orbiter,
    dataManager = null,
    user1Manager = null
  ) {
    this.orbiter = orbiter;
    this.dataManager = dataManager;
    this.user1Manager = user1Manager;

    this.containerSelector = containerSelector;
    this.container = document.querySelector(containerSelector);
    if (!this.container) {
      console.error(`ButtonGroup Error: No element found for selector "${containerSelector}"`);
      return;
    }
    this.dropdown = this.container.querySelector(dropdownSelector);
    this.button = this.container.querySelector(buttonSelector);
    this.menuItems = this.dropdown.querySelectorAll(menuItemsSelector);
    this.icon = this.button.querySelector(iconSelector);
    this.gridWrapper = document.querySelector('.grid-wrapper');
    this.gridContent = document.querySelector('.grid-content');
    this.closeGridBtn = document.querySelector('.close-grid-btn');
    this.collapseElement = document.getElementById('collapseInfoMenu');

    if (!this.dropdown || !this.button || !this.menuItems.length || !this.icon) {
      console.error('ButtonGroup initialization failed: Missing essential elements.');
      return;
    }

    // For collapsible info
    this.collapseInstance = null;
    if (this.collapseElement) {
      this.collapseInstance = bootstrap.Collapse.getOrCreateInstance(this.collapseElement);
    }

    this.midiController = MIDIControllerInstance;

    // Initialize
    this.init();
  }

  /**
   * Initializes the ButtonGroup by setting up SVGs and event bindings.
   * @private
   * @async
   */
  async init() {
   // //console.log(`Initializing dropdowns for "${this.containerSelector}"`);

    if (this.collapseInstance) {
      this.collapseInstance = bootstrap.Collapse.getOrCreateInstance(this.collapseElement);
    }

    // Adjust for hardware (MIDI, sensors)
    await this.adjustForHardwareSupport();

    // Load dynamic SVGs for icons
    this.loadDynamicSVGs();

    // Bind events
    this.bindEvents();

    // Initialize Bootstrap Dropdown
    this.container.querySelectorAll('.dropdown-toggle').forEach(dropdown => {
      new bootstrap.Dropdown(dropdown);
    });
  }

  /**
   * Loads dynamic SVGs for the main button and dropdown menu items.
   * @private
   */
  loadDynamicSVGs() {
    const src = this.icon.getAttribute('data-src');
    if (src) {
      this.fetchAndSetSVG(src, this.icon, true);
    }

    this.menuItems.forEach(item => {
      const src = item.getAttribute('data-icon');
      if (!src) return;
      const iconImg = item.querySelector('img');
      fetch(src)
        .then(response => {
          if (!response.ok) throw new Error(`Failed to load SVG: ${src}`);
          return response.text();
        })
        .then(svgContent => {
          const parser = new DOMParser();
          const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
          const svgElement = svgDoc.documentElement;
          svgElement.setAttribute('fill', 'currentColor');
          svgElement.setAttribute('role', 'img');
          svgElement.classList.add('menu-icon-svg');
          // preserve sizing
          svgElement.style.marginRight = '8px';
          svgElement.style.width = '16px';
          svgElement.style.height = '16px';
          // replace the <img> with inline SVG
          if (iconImg && iconImg.parentNode) {
            iconImg.parentNode.replaceChild(svgElement, iconImg);
          }
        })
        .catch(error => console.error(`Error loading menu SVG from ${src}:`, error));
    });
  }

  /**
   * Fetches and sets SVG content into a specified element.
   * @param {string} src - URL of the SVG file to fetch.
   * @param {HTMLElement} element - Element to insert the fetched SVG into.
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
          element.innerHTML = '';
          element.appendChild(svgElement);
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
    this.menuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const selectedValue = item.getAttribute('data-value');
        //console.log(`[Dropdown] Item clicked: ${selectedValue}`);
        this.onSelectionChange(selectedValue);
      });
    });

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
    //console.log(`[Dropdown] Item clicked: ${selectedValue}`);

    // Precheck MIDI support and controller initialization
    const isMidiLearnAvailable = MIDI_SUPPORTED && this.midiController;
    const groupType = this.container.getAttribute('data-group');
    if (!groupType) {
      console.warn(`[ButtonGroup] Unknown or missing group type.`);
      return;
    }

    // MIDI Learn logic
    if (isMidiLearnAvailable && this.midiController.isMidiLearnModeActive) {
      const selectedItem = [...this.menuItems].find(item => item.getAttribute('data-value') === selectedValue);
      if (selectedItem) {
        //console.log(`[Dropdown] MIDI Learn active: Mapping dropdown item "${selectedValue}"`);
        this.midiController.startMidiLearnForWidget(selectedItem);
      } else {
        console.warn(`[Dropdown] Selected item "${selectedValue}" not found.`);
      }
      return;
    }

    // Update main button icon/label
    const selectedItem = [...this.menuItems].find(item => item.getAttribute('data-value') === selectedValue);
    if (selectedItem) {
      const newIconPath = selectedItem.getAttribute('data-icon');
      const newLabel = selectedItem.textContent.trim();
      if (newIconPath) this.fetchAndSetSVG(newIconPath, this.icon, true);
      if (newLabel) this.button.setAttribute('aria-label', newLabel);
    }

    // Route the action based on groupType
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
      case 'more-dropdown':
        this.handleMoreDropdown(selectedValue);
        break;
      case 'x-waveform-dropdown':
      case 'y-waveform-dropdown':
      case 'z-waveform-dropdown':
        this.handleWaveformDropdown(groupType, selectedValue);
        break;
      case 'x-exo-lfo-dropdown':
      case 'y-exo-lfo-dropdown':
      case 'z-exo-lfo-dropdown':
        this.handleExoplanetDropdown(groupType, selectedValue);
        break;
      default:
        console.warn(`[ButtonGroup] Unknown group type: ${groupType}`);
    }
  }

  //----------------------------------------
  // 1) Handles LFO Waveforms
  //----------------------------------------
  handleWaveformDropdown(groupType, selectedValue) {
    //console.log(`[Waveform Dropdown] Group: ${groupType}, Selected: ${selectedValue}`);

    // Check which axis we are controlling
    let lfo = null;
    if (groupType.startsWith('x-')) lfo = cosmicLFOManager.x;
    if (groupType.startsWith('y-')) lfo = cosmicLFOManager.y;
    if (groupType.startsWith('z-')) lfo = cosmicLFOManager.z;

    if (!lfo) {
      console.warn(`[Waveform Dropdown] No cosmic LFO found for group "${groupType}"`);
      return;
    }

    // Update the waveform
    lfo.setWaveform(selectedValue);

    // Print wave + freq
    //console.log(`Axis=${lfo.axis}, Waveform="${selectedValue}", freq=${lfo.baseFrequency}`);
  }

  //----------------------------------------
  // 2) Handles LFO Exoplanet / freq changes
  //----------------------------------------
  handleExoplanetDropdown(groupType, selectedValue) {
    //console.log(`[Exoplanet Dropdown] Group: ${groupType}, Selected: ${selectedValue}`);

    let lfo = null;
    if (groupType.startsWith('x-')) lfo = cosmicLFOManager.x;
    if (groupType.startsWith('y-')) lfo = cosmicLFOManager.y;
    if (groupType.startsWith('z-')) lfo = cosmicLFOManager.z;

    if (!lfo) {
      console.warn(`[Exoplanet Dropdown] No cosmic LFO found for group "${groupType}"`);
      return;
    }

    // If user picks an exoplanet name or freq operation:
    switch (selectedValue) {
      case 'doubleFreq':
        const doubled = lfo.baseFrequency * 2;
        lfo.setBaseFrequency(doubled);
        //console.log(`Axis=${lfo.axis}, freq doubled => ${doubled}`);
        break;
      case 'halfFreq':
        const halved = lfo.baseFrequency / 2;
        lfo.setBaseFrequency(halved);
        //console.log(`Axis=${lfo.axis}, freq halved => ${halved}`);
        break;
      default:
        // It's presumably an exoplanet name
        lfo.setCurrentExoplanet(selectedValue);
        // Optionally call lfo.initialize(...) or lfo.computeFrequenciesFromExoData(...)
        //console.log(`Axis=${lfo.axis}, exoplanet="${selectedValue}", freq=${lfo.baseFrequency}`);
        break;
    }
  }

  handleMoreDropdown(selectedValue) {
    //console.log(`[More Dropdown] Selected: ${selectedValue}`);
    switch (selectedValue) {
      case 'Share':
        notifications.showToast('Sharing functionality is under development!', 'info');
        break;
      case 'Fullscreen':
        if (document.fullscreenElement) {
          document.exitFullscreen();
          notifications.showToast('Exited fullscreen mode.');
        } else {
          document.documentElement.requestFullscreen();
          notifications.showToast('Entered fullscreen mode.');
        }
        break;
      default:
        console.warn(`[More Dropdown] Unknown action: ${selectedValue}`);
    }
  }

  handleInformationDropdown(selectedValue) {
    //console.log(`[Information Dropdown] Selected: ${selectedValue}`);
    const typeMap = {
      'Control Monitor': 'monitorInfo',
      'Track': 'trackInfo',
      'Interplanetary Player': 'interplanetaryPlayerInfo',
      'Orbiter': 'orbiterInfo',
    };

    const target = typeMap[selectedValue];
    if (target) {
      if (this.dataManager) {
        this.dataManager.populatePlaceholders(target);
        this.showGrid();
      } else {
        console.error('[Information Dropdown] DataManager is not defined.');
      }
    } else {
      console.warn(`[Information Dropdown] Unknown selection: ${selectedValue}`);
    }
  }

  showGrid() {
    if (this.gridWrapper) {
      this.gridWrapper.style.display = 'grid';
      //console.log('[Grid] Grid is now visible.');
    }
    if (this.collapseInstance) {
      this.collapseInstance.show();
      //console.log('[Collapse] Collapsible menu expanded.');
    }
  }

  hideGrid() {
    if (this.gridWrapper) {
      this.gridWrapper.style.display = 'none';
      //console.log('[Grid] Grid hidden.');
    }
    if (this.collapseInstance) {
      this.collapseInstance.hide();
      //console.log('[Collapse] Collapsible menu collapsed.');
    }
  }

  handleTransportDropdown(selectedValue) {
    //console.log(`[Transport Dropdown] Selected: ${selectedValue}`);
    switch (selectedValue.toLowerCase()) {
      case 'play':
        this.orbiter.play();
        break;
      case 'pause':
        this.orbiter.pause();
        break;
      case 'stop':
        this.orbiter.stop();
        break;
      default:
        console.warn(`[Transport Dropdown] Unknown action: ${selectedValue}`);
    }
  }

  handleInteractionDropdown(selectedValue) {
    //console.log(`[Interaction Dropdown] Selected: ${selectedValue}`);
    switch (selectedValue) {
      case 'JAMMING':
        ModeManagerInstance.activateMode('JAMMING');
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
        console.warn(`[ButtonGroup] Unknown interaction mode: ${selectedValue}`);
    }
  }

  async adjustForHardwareSupport() {
    const sensorsAvailable = await SENSORS_SUPPORTED;
    //console.log(`[ButtonGroup] Sensors: ${sensorsAvailable ? 'Available' : 'Unavailable'}`);

    this.menuItems.forEach(item => {
      const value = item.getAttribute('data-value');
      if (value === 'MIDI') {
        item.style.display = MIDI_SUPPORTED ? 'block' : 'none';
      } else if (value === 'Sensors') {
        item.style.display = sensorsAvailable ? 'block' : 'none';
      }
    });
  }
}