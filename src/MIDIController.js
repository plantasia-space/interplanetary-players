// src/MIDIController.js

/**
 * @file MIDIController.js
 * @description Handles all MIDI controller-related logic, including MIDI interactions, mappings, and MIDI Learn functionality.
 * @version 2.0.0
 * @autor 𝐵𝓇𝓊𝓃𝒶 𝒢𝓊𝒶𝓇𝓃𝒾𝑒𝓇𝒾
 * @license MIT
 * @date 2024-12-07
 */

import { Constants, getPriority, MIDI_SUPPORTED } from './Constants.js';
import lscache from 'lscache';
import { ButtonGroup } from './ButtonGroup.js';
import { notifications } from './Main.js';
import { ModeManagerInstance } from './ModeManager.js';

/**
 * MIDIController Singleton Class
 * Handles MIDI interactions, including listening to MIDI inputs,
 * managing MIDI mappings, and facilitating MIDI Learn functionality.
 * @class
 * @memberof InputInterface 
 */
class MIDIController {
  /**
   * Creates an instance of MIDIController.
   * Implements the Singleton pattern to ensure only one instance exists.
   */
  constructor() {
    if (MIDIController.instance) {
      return MIDIController.instance;
    }

    /**
     * @type {MIDIInput|null}
     * @description Represents the MIDI access object.
     */
    this.midiAccess = null;

    /**
     * @type {Map<string, { channel: number, cc: number }>}
     * @description Maps parameter names to their MIDI channel and Control Change (CC) numbers.
     */
    this.midiParamMappings = new Map();

    /**
     * @type {Map<string, { channel: number, cc: number }>}
     * @description Maps widget IDs to their MIDI channel and Control Change (CC) numbers.
     */
    this.midiWidgetMappings = new Map();

    /**
     * @type {Map<string, HTMLElement>}
     * @description Registers widget instances by their unique IDs.
     */
    this.widgetRegistry = new Map();

    /**
     * @type {boolean}
     * @description Indicates whether MIDI is currently activated.
     */
    this.isMIDIActivated = false;

    /**
     * @type {boolean}
     * @description Indicates whether MIDI Learn mode is active.
     */
    this.isMidiLearnModeActive = false;

    /**
     * @type {HTMLElement|null}
     * @description The currently selected parameter for MIDI Learn mode.
     */
    this.currentLearnParam = null;

    /**
     * @type {HTMLElement|null}
     * @description The currently selected widget for MIDI Learn mode.
     */
    this.currentLearnWidget = null;

    // Bind methods to maintain 'this' context
    this.handleMidiMessage = this.handleMidiMessage.bind(this);
    this.handleStateChange = this.handleStateChange.bind(this);
    this.handleExitButtonClick = this.handleExitButtonClick.bind(this);
    this.handleEscKey = this.handleEscKey.bind(this);
    this.handleContextMenuLearn = this.handleContextMenuLearn.bind(this);
    this.handleContextMenuDelete = this.handleContextMenuDelete.bind(this);
    this.handleContextMenuClose = this.handleContextMenuClose.bind(this);
    this.highlightParameter = this.highlightParameter.bind(this);
    this.unhighlightParameter = this.unhighlightParameter.bind(this);
    this.highlightWidget = this.highlightWidget.bind(this);
    this.unhighlightWidget = this.unhighlightWidget.bind(this);
    this.startMidiLearnForWidget = this.startMidiLearnForWidget.bind(this);
    this.closeContextMenu = this.closeContextMenu.bind(this); // Existing method

    this.init();

    ModeManagerInstance.subscribe((newMode) => {
      // Only react if we care about MIDI-related modes.
      if (newMode === 'MIDI_LEARN') {
          // If mode manager says we're in MIDI learn mode
          if (this.isMIDIActivated) {
              this.enableMidiLearn();
          }
      } else {
          // If we leave MIDI_LEARN mode, ensure we exit
          if (this.isMidiLearnModeActive) {
              this.exitMidiLearnMode();
          }
      }
  });


    MIDIController.instance = this;
  }

  /**
   * Initializes the MIDIController by checking MIDI support,
   * restoring mappings, and setting up event listeners.
   * @async
   * @private
   * @returns {Promise<void>}
   */
  async init() {
    if (!MIDI_SUPPORTED) {
      console.warn("MIDIController: Web MIDI API not supported. Skipping initialization.");
      return;
    }

    //notifications.showToast("MIDIController: Web MIDI API supported.");
    // Restore persisted mappings if you have this method
    // await this.restoreMidiLearn();

    // Set up the exit button for MIDI Learn mode
    const exitButton = document.getElementById('exit-midi-learn');
    if (exitButton) {
      exitButton.addEventListener('click', this.handleExitButtonClick);
    }

    // Set up event listeners for the context menu options
    this.setupDropdownEventListeners();
  }

  /**
   * Activates MIDI mode by requesting MIDI access.
   * Shows a toast notification upon successful activation.
   * @async
   * @public
   * @returns {Promise<void>}
   * @throws Will log an error if MIDI activation fails.
   *
   * @example
   * const midiController = new MIDIController();
   * midiController.activateMIDI();
   */
  async activateMIDI() {
    if (this.isMIDIActivated) {
     // notifications.showToast('MIDI is already activated.', 'info');
      return;
    }

    try {
      await this.requestMidiAccess();
      this.isMIDIActivated = true;
      //notifications.showToast('MIDI activated successfully!', 'success');
    } catch (error) {
      notifications.showToast(`MIDI activation failed: ${error.message}`, 'error');
    }
  }

  /**
   * Requests MIDI access and initializes MIDI inputs.
   * Sets up event listeners for MIDI state changes.
   * @async
   * @private
   * @returns {Promise<void>}
   * @throws Will throw an error if MIDI access is not granted.
   *
   * @example
   * await midiController.requestMidiAccess();
   */
  async requestMidiAccess() {
    if (!('requestMIDIAccess' in navigator)) {
      notifications.showToast('Web MIDI API not supported in this environment.', 'error');
      throw new Error('Web MIDI API not supported');
    }

    try {
      // Request MIDI access
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      //notifications.showToast('MIDI access granted. Checking inputs...', 'success');

      // Log available inputs for debugging
      console.log('Initial MIDI Inputs:', Array.from(this.midiAccess.inputs.values()));

      // Listen for state changes (e.g., devices being connected or disconnected)
      this.midiAccess.onstatechange = this.handleStateChange.bind(this);

      // Enable inputs dynamically
      this.enableInputs();
    } catch (error) {
      notifications.showToast(`Failed to access MIDI: ${error.message}`, 'error');
      console.error('MIDI Access Error:', error);
      throw error;
    }
  }

  /**
   * Enables MIDI inputs by attaching message handlers to each input.
   * @private
   * @returns {void}
   *
   * @example
   * midiController.enableInputs();
   */
  enableInputs() {
    if (!this.midiAccess) {
      notifications.showToast('MIDI access is not initialized. Cannot enable inputs.', 'error');
      return;
    }

    // Use the iterator to process MIDI inputs dynamically
    const inputs = this.midiAccess.inputs.values();
    let hasInputs = false;

    for (let input = inputs.next(); input && !input.done; input = inputs.next()) {
      hasInputs = true;
      input.value.onmidimessage = this.handleMidiMessage.bind(this);
      //notifications.showToast(`Enabled MIDI input: ${input.value.name}`, 'info');
      console.log(`Connected MIDI input: ${input.value.name}`);
    }

    if (!hasInputs) {
      notifications.showToast('No MIDI inputs found. Please connect a MIDI device.', 'warning');
      console.log('No MIDI inputs available.');
    }
  }

  /**
   * Handles state changes for MIDI devices, such as connections and disconnections.
   * @private
   * @param {MIDIConnectionEvent} event - The MIDI connection event.
   * @returns {void}
   *
   * @example
   * midiController.handleStateChange(event);
   */
  handleStateChange(event) {
    const port = event.port;

   // notifications.showToast(`MIDI device ${port.name} is now ${port.state}.`, 'info');

    if (port.type === 'input') {
      if (port.state === 'connected') {
        port.onmidimessage = this.handleMidiMessage.bind(this);
       // notifications.showToast(`Connected to MIDI input: ${port.name}`, 'success');
        console.log(`Connected to MIDI input: ${port.name}`);
      } else if (port.state === 'disconnected') {
        port.onmidimessage = null;
       // notifications.showToast(`Disconnected from MIDI input: ${port.name}`, 'warning');
        console.log(`Disconnected from MIDI input: ${port.name}`);
      }
    }
  }

  /**
   * Handles incoming MIDI messages, dispatching them to mapped widgets or parameters.
   * Also manages MIDI Learn functionality by mapping new controls.
   * @private
   * @param {MIDIMessageEvent} event - The MIDI message event.
   * @returns {void}
   *
   * @example
   * midiController.handleMidiMessage(event);
   */
  handleMidiMessage(event) {
    const [status, data1, data2] = event.data;
    const channel = status & 0x0F;
    const messageType = status & 0xF0;

    // Process only Control Change (CC) messages
    if (messageType !== 0xB0) return;

    // MIDI Learn Mode: Map MIDI input to a widget
    if (this.isMidiLearnModeActive && this.currentLearnWidget) {
      const widgetId = this.currentLearnWidget.id || this.currentLearnWidget.getAttribute('data-value');
      console.log(`Mapping widget '${widgetId}' to MIDI Channel ${channel + 1}, CC ${data1}`);
      this.setMidiWidgetMapping(widgetId, channel, data1);

      // Update feedback and reset learning
      this.unhighlightWidget(widgetId);
      this.markAsMapped(widgetId, data1, channel);
      //notifications.showToast(`Assigned CC ${data1} to '${widgetId}'.`, 'success');
      this.currentLearnWidget = null;
      return; // Exit after mapping
    }

    // Process mapped widgets
    this.midiWidgetMappings.forEach((mapping, widgetId) => {
      if (mapping.channel === channel && mapping.cc === data1) {
        const widget = this.widgetRegistry.get(widgetId);

        if (!widget) {
          console.warn(`Widget '${widgetId}' not found.`);
          return;
        }

        // Dropdown Item Handling
        if (widget.classList.contains('dropdown-item')) {
          widget.click();
        }
        // WebAudioSwitch Handling
        else if (widget instanceof HTMLElement && widget.tagName === 'WEBAUDIO-SWITCH') {
          this.triggerWebAudioSwitch(widget, data2);
        }
        // Standard Widget Handling (e.g., sliders)
        else {
          this.updateWebAudioWidget(widget, data2);
        }
      }
    });

    // Update Parameters
    this.midiParamMappings.forEach((mapping, param) => {
      if (mapping.channel === channel && mapping.cc === data1) {
        this.updateParameter(param, data2);
      }
    });
  }

  /**
   * Updates standard widgets like sliders based on MIDI values.
   * @private
   * @param {HTMLElement} widget - The widget element to update.
   * @param {number} value - The MIDI CC value (0-127).
   * @returns {void}
   *
   * @example
   * midiController.updateWebAudioWidget(sliderElement, 64);
   */
  updateWebAudioWidget(widget, value) {
    const normalizedValue = value / 127;

    // Use _min and _max if available, otherwise fall back to min and max
    const min = widget._min !== undefined ? widget._min : widget.min;
    const max = widget._max !== undefined ? widget._max : widget.max;

    if (min === undefined || max === undefined) {
      console.warn(`Widget '${widget.id}' is missing min/max values.`);
      return;
    }

    // Calculate the new value based on normalization
    widget.value = min + normalizedValue * (max - min);
  }

  /**
   * Triggers actions for WebAudioSwitch widgets or invokes dropdown item actions.
   * @private
   * @param {HTMLElement} widget - The widget element to trigger.
   * @param {number} value - The MIDI CC value (0-127).
   * @returns {void}
   *
   * @example
   * midiController.triggerWebAudioSwitch(switchElement, 127);
   */
  triggerWebAudioSwitch(widget, value) {
    if (widget.tagName.toLowerCase() === 'a' && widget.classList.contains('dropdown-item')) {
      console.log(`MIDIController: Triggering dropdown item '${widget.id}'`);
      if (typeof widget.onclick === 'function') {
        widget.onclick(); // Invoke dropdown action
      } else {
        console.warn(`Dropdown item '${widget.id}' has no onclick handler.`);
      }
    } else if (widget.type === 'toggle') {
      widget.setState(value > 0 ? 1 : 0, true); // Fire events
    } else if (widget.type === 'kick') {
      widget.triggerKick(); // Simulate kick
    } else if (widget.type === 'sequential') {
      const delta = value > 64 ? 1 : -1;
      widget.cycleState(delta); // Cycle state
    } else if (widget.type === 'radio') {
      widget.activateRadio(); // Activate radio
    } else {
      widget.setValue(value / 127, true); // Update knobs or sliders
    }

    // Redraw the widget if a redraw method is available
    widget.redraw();
  }

  /**
   * Marks a widget or parameter as mapped and adds visual indicators.
   * @private
   * @param {string} elementId - The ID of the widget or parameter.
   * @param {number} midiCC - The MIDI Control Change number.
   * @param {number} midiChannel - The MIDI channel number (0-15).
   * @returns {void}
   *
   * @example
   * midiController.markAsMapped('volumeSlider', 7, 0);
   */
  markAsMapped(elementId, midiCC, midiChannel) {
    const element = document.getElementById(elementId) || document.querySelector(`[data-value="${elementId}"]`);
    if (element) {
      // Change highlight class
      element.classList.remove('midi-learn-highlight');
      element.classList.add('midi-mapped');

      // Remove existing indicator if any
      let indicator = document.querySelector(`.midi-indicator[data-element-id="${elementId}"]`);
      if (indicator) {
        indicator.remove();
      }

      // Add MIDI controller indicator
      indicator = document.createElement('div');
      indicator.className = 'midi-indicator';
      indicator.dataset.elementId = elementId;
      indicator.textContent = `CH ${midiChannel + 1} / CC ${midiCC}`;
      document.body.appendChild(indicator);

      // Position the indicator over the element
      const rect = element.getBoundingClientRect();
      indicator.style.position = 'fixed';
      indicator.style.left = `${rect.right - 30}px`; // Adjust as needed
      indicator.style.top = `${rect.bottom - 20}px`; // Adjust as needed
      indicator.style.zIndex = '1002';
    }
  }

  /**
   * Updates a parameter based on incoming MIDI data.
   * @private
   * @param {string} identifier - The parameter name or widget ID.
   * @param {number} midiValue - The MIDI CC value (0-127).
   * @returns {void}
   *
   * @example
   * midiController.updateParameter('volume', 100);
   */
  updateParameter(identifier, midiValue) {
    const element = this.widgetRegistry.get(identifier);
    if (element) {
      if (element.tagName.toLowerCase() === 'a' && element.classList.contains('dropdown-item')) {
        // Directly invoke the associated action without simulating a click
        console.log(`MIDIController: Invoking action for dropdown item '${identifier}'`);
        if (typeof element.onclick === 'function') {
          element.onclick(); // Invoke the existing click handler directly
        } else {
          console.warn(`MIDIController: No onclick handler defined for dropdown item '${identifier}'.`);
        }
      } else {
        // Handle widgets
        const widget = element;
        const normalizedValue = midiValue / 127; // Normalize to [0, 1]
        widget.value = widget.min + normalizedValue * (widget.max - widget.min);
        if (typeof widget.redraw === 'function') {
          widget.redraw(); // Ensure the widget updates its display
        }
        console.log(`MIDIController: Updated widget '${identifier}' to value ${widget.value}`);
      }
    } else {
      console.warn(`MIDIController: Element '${identifier}' not found.`);
    }
  }

  /**
   * Registers a widget for MIDI control.
   * @public
   * @param {string} id - The widget's unique ID.
   * @param {HTMLElement} widget - The widget instance.
   * @returns {void}
   *
   * @example
   * midiController.registerWidget('volumeSlider', sliderElement);
   */
  registerWidget(id, widget) {
    if (!id || !widget) {
      console.warn("MIDIController: Cannot register widget without ID or instance.");
      return;
    }
    this.widgetRegistry.set(id, widget);
  }

  /**
   * Sets a MIDI mapping for a widget.
   * @public
   * @param {string} widgetId - The widget's unique ID.
   * @param {number} channel - MIDI channel (0-15).
   * @param {number} cc - MIDI Control Change number (0-127).
   * @returns {void}
   *
   * @example
   * midiController.setMidiWidgetMapping('volumeSlider', 0, 7);
   */
  setMidiWidgetMapping(widgetId, channel, cc) {
    if (!widgetId) {
      console.warn("MIDIController: Widget ID is required for mapping.");
      return;
    }

    this.midiWidgetMappings.set(widgetId, { channel, cc });
    console.log(`MIDIController: Mapped widget '${widgetId}' to MIDI Channel ${channel + 1}, CC ${cc}.`);

    // Add 'midi-mapped' class to the widget element for visual indication
    const widgetElement = document.getElementById(widgetId);
    if (widgetElement) {
      widgetElement.classList.add('midi-mapped');
    }
  }

  /**
   * Clears the MIDI mapping for a specific parameter or widget.
   * Removes visual indicators and updates internal mappings.
   * @public
   * @param {string} identifier - The parameter name or widget ID.
   * @returns {void}
   *
   * @example
   * midiController.clearMidiMapping('volumeSlider');
   */
  clearMidiMapping(identifier) {
    let cleared = false;

    // Check if identifier is a parameter
    if (this.midiParamMappings.has(identifier)) {
      this.midiParamMappings.delete(identifier);
      cleared = true;

      // Remove 'midi-mapped' class from the parameter element
      const paramElement = document.querySelector(`[data-group="${identifier}"]`);
      if (paramElement) {
        paramElement.classList.remove('midi-mapped');
      }

      // Remove MIDI indicator
      const indicator = document.querySelector(`.midi-indicator[data-element-id="${identifier}"]`);
      if (indicator) {
        indicator.remove();
      }

      console.log(`MIDIController: Cleared MIDI mapping for parameter '${identifier}'.`);
    }

    // Check if identifier is a widget
    if (this.midiWidgetMappings.has(identifier)) {
      this.midiWidgetMappings.delete(identifier);
      cleared = true;

      // Remove 'midi-mapped' class from the widget element
      const widgetElement = document.getElementById(identifier) || document.querySelector(`[data-value="${identifier}"]`);
      if (widgetElement) {
        widgetElement.classList.remove('midi-mapped');
      }

      // Remove MIDI indicator
      const indicator = document.querySelector(`.midi-indicator[data-element-id="${identifier}"]`);
      if (indicator) {
        indicator.remove();
      }

      console.log(`MIDIController: Cleared MIDI mapping for widget '${identifier}'.`);
    }

    if (cleared) {
      // Notify the user
      notifications.showToast(`Cleared MIDI mapping for '${identifier}'.`, 'success');
    } else {
      console.warn(`MIDIController: No MIDI mapping found for '${identifier}'.`);
      notifications.showToast(`No MIDI mapping exists for '${identifier}'.`, 'error');
    }
  }

  /**
   * Enables MIDI Learn mode by creating overlays over automatable elements.
   * @public
   * @returns {void}
   *
   * @example
   * midiController.enableMidiLearn();
   */
  enableMidiLearn() {
    if (!this.isMIDIActivated) {
      notifications.showToast('MIDIController: MIDI is not activated. Cannot enter MIDI Learn mode.');
      return;
    }
    //notifications.showToast('MIDIController: Entering MIDI Learn mode...');

    this.isMidiLearnModeActive = true;
    this.currentLearnParam = null;
    this.currentLearnWidget = null;

    // Create overlays for automatable widgets and dropdown items
    this.createOverlays();
    this.toggleMoreMenuButton(true); // Update button

    // Add class to body for CSS control
    document.body.classList.add('midi-learn-mode');

    // Listen for Esc key to exit
    document.addEventListener('keydown', this.handleEscKey);

    // Display a toast message indicating MIDI Learn mode is active
    notifications.showToast('MIDI Learn mode activated. Click on a control to assign MIDI.', 'info');
  }

  /**
   * Creates overlays over automatable elements during MIDI Learn mode.
   * These overlays capture user interactions for mapping MIDI controls.
   * @private
   * @returns {void}
   *
   * @example
   * midiController.createOverlays();
   */
  createOverlays() {
    // Handle widgets (sliders, knobs, buttons)
    const widgets = document.querySelectorAll('[data-automatable="true"]');
    widgets.forEach(widget => {
      const id = widget.id;
      if (!id) {
        console.warn("MIDIController: Widget missing 'id' attribute:", widget);
        return;
      }

      const overlay = document.createElement('div');
      overlay.classList.add('widget-overlay');
      overlay.dataset.widgetId = id;

      const rect = widget.getBoundingClientRect();
      overlay.style.position = 'fixed';
      overlay.style.top = `${rect.top}px`;
      overlay.style.left = `${rect.left}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      overlay.style.pointerEvents = 'auto';
      overlay.style.zIndex = '1000';
      overlay.style.background = 'rgba(255, 255, 255, 0.1)'; // Optional: Semi-transparent overlay

      overlay.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent event bubbling

        const isMapped = this.isElementMapped(widget);
        if (isMapped) {
          this.openContextMenu(e, widget);
        } else {
          this.startMidiLearnForElement(widget);
        }
      });
      document.body.appendChild(overlay);
    });

    // Handle drop-down items (menu items)
    const dropdownItems = document.querySelectorAll('[data-midi-controllable="true"]');
    dropdownItems.forEach(item => {
      item.classList.add('midi-learn-dropdown');

      // Store original click handler
      if (!item.originalClickHandler) {
        item.originalClickHandler = item.onclick;
        item.onclick = null;
      }

      // Bind the event handler
      item.dropdownItemClickHandler = (e) => {
        if (!this.isMidiLearnModeActive) {
          console.warn('MIDIController: Ignored click outside MIDI Learn mode.');
          return; // Ignore if not in MIDI Learn mode
        }

        e.preventDefault();
        e.stopPropagation();

        const isMapped = this.isElementMapped(item);
        if (isMapped) {
          this.openContextMenu(e, item);
        } else {
          this.startMidiLearnForElement(item);
        }
      };

      item.addEventListener('click', item.dropdownItemClickHandler);
    });

    console.log('MIDIController: Created overlays for automatable widgets and dropdown items.');
  }

  /**
   * Removes overlays created during MIDI Learn mode.
   * Cleans up UI elements and restores original event handlers.
   * @private
   * @returns {void}
   *
   * @example
   * midiController.removeOverlays();
   */
  removeOverlays() {
    console.log('MIDIController: Executing removeOverlays');

    // Remove widget overlays
    const overlays = document.querySelectorAll('.widget-overlay');
    overlays.forEach(overlay => {
      overlay.parentNode.removeChild(overlay);
    });

    // Restore dropdown items
    const dropdownItems = document.querySelectorAll('[data-midi-controllable="true"]');
    dropdownItems.forEach(item => {
      item.classList.remove('midi-learn-dropdown');

      // Remove custom event listener
      if (item.dropdownItemClickHandler) {
        item.removeEventListener('click', item.dropdownItemClickHandler);
        delete item.dropdownItemClickHandler;
      }

      // Restore original click handler
      if (item.originalClickHandler) {
        item.onclick = item.originalClickHandler;
        delete item.originalClickHandler;
      }
    });
  }

  /**
   * Initiates MIDI learning mode for a specific widget.
   * Highlights the widget and waits for MIDI input to map controls.
   * @private
   * @param {HTMLElement} widget - The widget element to map.
   * @returns {void}
   *
   * @example
   * midiController.startMidiLearnForWidget(sliderElement);
   */
  startMidiLearnForWidget(widget) {
    if (!widget.id) {
      console.warn("MIDIController: Widget missing 'id' attribute.");
      return;
    }

    this.currentLearnWidget = widget;
    this.isMidiLearnModeActive = true;

    console.log(`MIDIController: MIDI Learn mode activated for widget '${widget.id}'.`);

    // Highlight the widget for user feedback
    this.highlightWidget(widget.id);

    // Display a toast message instead of a modal
    notifications.showToast(`Perform a MIDI action to assign it to '${widget.id}'.`, 'info');
  }

  /**
   * Highlights a specific widget in the UI to indicate it's being mapped.
   * @private
   * @param {string} widgetId - The widget's unique ID.
   * @returns {void}
   *
   * @example
   * midiController.highlightWidget('volumeSlider');
   */
  highlightWidget(widgetId) {
    const element = document.getElementById(widgetId);
    if (element) {
      element.classList.add('midi-learn-highlight');
      console.log(`MIDIController: Highlighted widget '${widgetId}' for MIDI Learn.`);
    }
  }

  /**
   * Removes the highlight from a specific widget in the UI.
   * @private
   * @param {string} widgetId - The widget's unique ID.
   * @returns {void}
   *
   * @example
   * midiController.unhighlightWidget('volumeSlider');
   */
  unhighlightWidget(widgetId) {
    const element = document.getElementById(widgetId);
    if (element) {
      element.classList.remove('midi-learn-highlight');
      console.log(`MIDIController: Removed highlight from widget '${widgetId}'.`);
    }
  }

  /**
   * Highlights a specific parameter in the UI to indicate it's being mapped.
   * @private
   * @param {string} param - The parameter name.
   * @returns {void}
   *
   * @example
   * midiController.highlightParameter('balance');
   */
  highlightParameter(param) {
    const element = document.querySelector(`[data-group="${param}"]`);
    if (element) {
      element.classList.add('midi-learn-highlight');
      console.log(`MIDIController: Highlighted parameter '${param}' for MIDI Learn.`);
    }
  }

  /**
   * Removes the highlight from a specific parameter in the UI.
   * @private
   * @param {string} param - The parameter name.
   * @returns {void}
   *
   * @example
   * midiController.unhighlightParameter('balance');
   */
  unhighlightParameter(param) {
    const element = document.querySelector(`[data-group="${param}"]`);
    if (element) {
      element.classList.remove('midi-learn-highlight');
      console.log(`MIDIController: Removed highlight from parameter '${param}'.`);
    }
  }

  /**
   * Handles the "Cancel MIDI Learn" button click.
   * Exits MIDI Learn mode and cleans up UI elements.
   * @private
   * @param {Event} event - The click event.
   * @returns {void}
   *
   * @example
   * exitButton.addEventListener('click', midiController.handleExitButtonClick);
   */
  handleExitButtonClick(event) {
    this.exitMidiLearnMode();
  }

  /**
   * Toggles the state of the "More Menu" button based on MIDI Learn mode.
   * Updates the button icon and functionality.
   * @private
   * @param {boolean} isMidiLearnModeActive - Indicates whether MIDI Learn mode is active.
   * @returns {void}
   *
   * @example
   * midiController.toggleMoreMenuButton(true);
   */
  toggleMoreMenuButton(isMidiLearnModeActive) {
    const moreButton = document.getElementById('moreMenuButton');

    if (!moreButton) {
      console.error('MIDIController: More Menu Button not found.');
      return;
    }

    const buttonIcon = moreButton.querySelector('.button-icon');
    if (!buttonIcon) {
      console.error('MIDIController: Button icon not found inside More Menu Button.');
      return;
    }

    const newIconSrc = isMidiLearnModeActive
      ? '/assets/icons/close-dinamic.svg'
      : '/assets/icons/more.svg';
    const newLabel = isMidiLearnModeActive
      ? 'Exit MIDI Learn Mode'
      : 'More options';

    // Update the button attributes
    moreButton.setAttribute('aria-label', newLabel);

    // Add or remove the 'close-mode' class dynamically
    if (isMidiLearnModeActive) {
      moreButton.classList.add('close-mode'); // Apply close styling
      moreButton.removeAttribute('data-bs-toggle'); // Disable dropdown
      moreButton.onclick = () => this.exitMidiLearnMode(); // Add exit functionality
    } else {
      moreButton.classList.remove('close-mode'); // Revert to default styling
      moreButton.setAttribute('data-bs-toggle', 'dropdown'); // Enable dropdown
      moreButton.onclick = null; // Clear custom click handler
    }

    // Dynamically update the button icon
    this.fetchAndSetSVG(newIconSrc, buttonIcon, true);
  }

  /**
   * Fetches and sets SVG content for a given element.
   * @private
   * @param {string} src - The source URL of the SVG.
   * @param {HTMLElement} element - The DOM element to set the SVG content.
   * @param {boolean} isInline - Indicates whether to set SVG inline.
   * @returns {void}
   *
   * @example
   * midiController.fetchAndSetSVG('/path/to/icon.svg', iconElement, true);
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
   * Handles the Esc key press to exit MIDI Learn mode.
   * @private
   * @param {KeyboardEvent} e - The keyboard event.
   * @returns {void}
   *
   * @example
   * document.addEventListener('keydown', midiController.handleEscKey);
   */
  handleEscKey(e) {
    if (e.key === 'Escape' && this.isMidiLearnModeActive) {
      this.exitMidiLearnMode();
    }
  }

  /**
   * Exits MIDI Learn mode by removing overlays, cleaning up mappings,
   * and restoring UI elements to their default state.
   * @private
   * @returns {void}
   *
   * @example
   * midiController.exitMidiLearnMode();
   */
  exitMidiLearnMode() {
    console.log('MIDIController: Exiting MIDI Learn mode.');

    // Reset mode state
    this.isMidiLearnModeActive = false;
    this.currentLearnParam = null;
    this.currentLearnWidget = null;

    // Clean up UI
    document.body.classList.remove('midi-learn-mode');
    this.closeContextMenu();
    this.removeOverlays();
    this.toggleMoreMenuButton(false); // Reset the More Menu button
    document.removeEventListener('keydown', this.handleEscKey);

    // Remove highlights
    document.querySelectorAll('.midi-learn-highlight').forEach(element =>
        element.classList.remove('midi-learn-highlight')
    );

    // Clear lingering messages
    const toastContainer = document.getElementById('toast-container');
    if (toastContainer) toastContainer.innerHTML = '';

    // Reset interaction dropdown to Jam mode
    const interactionButton = document.getElementById('interactionMenuButton');
    const interactionIcon = interactionButton?.querySelector('.button-icon');
    const jamItem = document.getElementById('jam-item');

    if (interactionButton && interactionIcon && jamItem) {
        const jamIconSrc = jamItem.getAttribute('data-icon');
        const jamLabel = jamItem.getAttribute('data-value');

        // Update button attributes
        interactionButton.setAttribute('aria-label', jamLabel);

        // Fetch and set the SVG dynamically using fetchAndSetSVG
        this.fetchAndSetSVG(jamIconSrc, interactionIcon, true);

        console.log(`Interaction dropdown reset to "${jamLabel}" mode.`);
    } else {
        console.warn('Interaction dropdown elements are missing or undefined.');
    }

    console.log('MIDIController: Fully exited MIDI Learn mode.');
}

  /**
   * Handles the "Learn" action from the context menu.
   * Initiates MIDI Learn mode for the selected parameter or widget.
   * @private
   * @param {Event} event - The click or touch event.
   * @returns {void}
   *
   * @example
   * contextMenuLearnButton.addEventListener('click', midiController.handleContextMenuLearn);
   */
  handleContextMenuLearn(event) {
    console.log('handleContextMenuLearn called');
    // Prevent default behavior and stop propagation
    event.preventDefault();
    event.stopPropagation();

    if (this.currentlyLearningWidget) {
      const widgetId = this.currentlyLearningWidget.id;
      if (!widgetId) {
        console.warn("MIDIController: Selected widget does not have a valid 'id' attribute.");
        return;
      }

      // Initiate MIDI Learn for the widget
      this.startMidiLearnForWidget(this.currentlyLearningWidget);
    } else if (this.currentLearnParam) {
      // Initiate MIDI Learn for the parameter
      this.isMidiLearnModeActive = true;
      console.log(`MIDIController: MIDI Learn mode activated for parameter '${this.currentLearnParam}'.`);

      // Highlight the parameter for user feedback
      this.highlightParameter(this.currentLearnParam);

      // Provide visual feedback to the user
      notifications.showUniversalModal(
        'MIDI Learn',
        `Perform a MIDI action (e.g., move a knob) to map it to '${this.currentLearnParam}'.`,
        'Cancel'
      ).then(() => {
        if (this.isMidiLearnModeActive) {
          // User canceled MIDI Learn mode
          this.isMidiLearnModeActive = false;
          this.unhighlightParameter(this.currentLearnParam);
          this.currentLearnParam = null;
          console.log('MIDIController: MIDI Learn mode canceled by user.');
        }
      });
    }

    // Close the context menu
    this.closeContextMenu();
  }

  /**
   * Handles the "Delete" action from the context menu.
   * Removes the MIDI mapping for the selected widget or parameter.
   * @private
   * @param {Event} event - The click or touch event.
   * @returns {void}
   *
   * @example
   * contextMenuDeleteButton.addEventListener('click', midiController.handleContextMenuDelete);
   */
  handleContextMenuDelete(event) {
    console.log('handleContextMenuDelete called');
    // Prevent default behavior and stop propagation
    event.preventDefault();
    event.stopPropagation();

    if (this.currentlyLearningWidget) {
      const widgetId = this.currentlyLearningWidget.id;
      if (widgetId) {
        this.clearMidiMapping(widgetId);
      } else {
        console.warn("MIDIController: Selected widget does not have a valid 'id' attribute.");
        notifications.showUniversalModal(
          'Invalid Widget',
          'The selected widget does not have a valid identifier to delete.',
          'Okay'
        );
      }
      this.closeContextMenu();
    } else if (this.currentLearnParam) {
      this.clearMidiMapping(this.currentLearnParam);
      this.closeContextMenu();
    } else {
      console.warn("MIDIController: No widget or parameter selected to delete MIDI mapping.");
    }
  }

  /**
   * Handles the "Close" action from the context menu.
   * Closes the context menu without making any changes.
   * @private
   * @param {Event} event - The click or touch event.
   * @returns {void}
   *
   * @example
   * contextMenuCloseButton.addEventListener('click', midiController.handleContextMenuClose);
   */
  handleContextMenuClose(event) {
    console.log('handleContextMenuClose called');
    // Prevent default behavior and stop propagation
    event.preventDefault();
    event.stopPropagation();

    this.closeContextMenu();
    console.log("MIDIController: Context menu closed without exiting MIDI Learn mode.");
  }

  /**
   * Checks if a given element is already mapped to a MIDI control.
   * @private
   * @param {HTMLElement} element - The DOM element to check.
   * @returns {boolean} - Returns true if the element is mapped, false otherwise.
   *
   * @example
   * const isMapped = midiController.isElementMapped(widgetElement);
   */
  isElementMapped(element) {
    const id = element.id || element.getAttribute('data-value');
    return this.midiWidgetMappings.has(id) || this.midiParamMappings.has(id);
  }

  /**
   * Initiates MIDI Learn mode for a specific element (widget or parameter).
   * Highlights the element and waits for MIDI input to map controls.
   * @private
   * @param {HTMLElement} element - The DOM element to map.
   * @returns {void}
   *
   * @example
   * midiController.startMidiLearnForElement(widgetElement);
   */
  startMidiLearnForElement(element) {
    const id = element.id || element.getAttribute('data-value');

    if (!id) {
      console.warn("MIDIController: Element missing 'id' or 'data-value' attribute.");
      return;
    }

    if (element.hasAttribute('data-automatable') || element.hasAttribute('data-midi-controllable')) {
      this.currentLearnWidget = element;
      this.highlightWidget(id);
    } else {
      console.warn('MIDIController: Unknown element type:', element);
      return;
    }

    this.isMidiLearnModeActive = true;

    // Display toast message
    notifications.showToast(`Perform a MIDI action to assign it to '${id}'.`, 'info');
  }

  /**
   * Opens the MIDI Context Menu for the specified widget or parameter at the event's location.
   * @private
   * @param {MouseEvent|TouchEvent} event - The event triggering the context menu.
   * @param {HTMLElement} element - The widget or dropdown item requesting MIDI Learn.
   * @returns {void}
   *
   * @example
   * midiController.openContextMenu(event, widgetElement);
   */
  openContextMenu(event, element) {
    event.preventDefault();
    event.stopPropagation();

    const contextMenu = document.getElementById('midi-context-menu');
    if (!contextMenu) {
      console.error('MIDIController: Context menu not found.');
      return;
    }

    let paramName = null;

    if (element.hasAttribute('data-automatable') || element.hasAttribute('data-midi-controllable')) {
      const elementId = element.id || element.getAttribute('data-value');
      if (!elementId) {
        console.warn("MIDIController: Element missing 'id' or 'data-value' attribute.");
        return;
      }
      paramName = elementId;
      this.currentlyLearningWidget = element;
    } else {
      console.warn('MIDIController: Unknown element type:', element);
      return;
    }

    // Position and show the context menu
    const rect = element.getBoundingClientRect();
    contextMenu.style.left = `${rect.left}px`;
    contextMenu.style.top = `${rect.bottom}px`;
    contextMenu.style.display = 'block';
    contextMenu.classList.add('show');
    contextMenu.style.zIndex = '1050'; // Ensure context menu is above overlays and Bootstrap dropdowns

    // Disable pointer events on the overlay
    const overlay = Array.from(document.querySelectorAll('.widget-overlay')).find(
      ov => ov.dataset.widgetId === element.id
    );
    if (overlay) {
      overlay.style.pointerEvents = 'none';
    }

    this.currentLearnParam = paramName;
    console.log(`MIDIController: Opened context menu for parameter '${paramName}'.`);
  }

  /**
   * Closes the MIDI Context Menu if it is open.
   * @private
   * @returns {void}
   *
   * @example
   * midiController.closeContextMenu();
   */
  closeContextMenu() {
    const contextMenu = document.getElementById("midi-context-menu");
    if (contextMenu) {
      contextMenu.classList.remove("show");
      contextMenu.style.display = 'none';

      // Re-enable pointer events on the overlay
      if (this.currentlyLearningWidget) {
        const overlay = Array.from(document.querySelectorAll('.widget-overlay')).find(
          ov => ov.dataset.widgetId === this.currentlyLearningWidget.id
        );
        if (overlay) {
          overlay.style.pointerEvents = 'auto';
        }
      }

      console.log("MIDIController: Context menu closed.");
      this.currentlyLearningWidget = null;
    }
  }

  /**
   * Sets up event listeners for the context menu options ("Learn", "Delete", "Close").
   * @private
   * @returns {void}
   *
   * @example
   * midiController.setupDropdownEventListeners();
   */
  setupDropdownEventListeners() {
    const contextMenuLearn = document.getElementById("midi-context-learn");
    const contextMenuDelete = document.getElementById("midi-context-delete");
    const contextMenuClose = document.getElementById("midi-context-close");

    // Options for passive event listeners
    const passiveOptions = { passive: true };

    if (contextMenuLearn) {
      contextMenuLearn.addEventListener("click", this.handleContextMenuLearn);
      contextMenuLearn.addEventListener("touchstart", this.handleContextMenuLearn, passiveOptions);
    }

    if (contextMenuDelete) {
      contextMenuDelete.addEventListener("click", this.handleContextMenuDelete);
      contextMenuDelete.addEventListener("touchstart", this.handleContextMenuDelete, passiveOptions);
    }

    if (contextMenuClose) {
      contextMenuClose.addEventListener("click", this.handleContextMenuClose);
      contextMenuClose.addEventListener("touchstart", this.handleContextMenuClose, passiveOptions);
    }

    // Handle closing the context menu when clicking outside
    document.addEventListener('click', (e) => {
      const contextMenu = document.getElementById("midi-context-menu");
      if (contextMenu && contextMenu.style.display === 'block' && !contextMenu.contains(e.target)) {
        this.closeContextMenu();
      }
    });

    // Handle escape key to close the context menu
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeContextMenu();
      }
    });

    console.log("MIDIController: Set up context menu event listeners.");
  }

  /**
   * Updates a parameter based on incoming MIDI data.
   * Specifically tailored for widgets that are dropdown items.
   * @private
   * @param {string} widgetId - The widget's unique ID.
   * @param {number} midiValue - The MIDI CC value (0-127).
   * @returns {void}
   *
   * @example
   * midiController.updateParameter('dropdownItem1', 100);
   */
  updateParameter(identifier, midiValue) {
    const element = this.widgetRegistry.get(identifier);
    if (element) {
      if (element.tagName.toLowerCase() === 'a' && element.classList.contains('dropdown-item')) {
        // Directly invoke the associated action without simulating a click
        console.log(`MIDIController: Invoking action for dropdown item '${identifier}'`);
        if (typeof element.onclick === 'function') {
          element.onclick(); // Invoke the existing click handler directly
        } else {
          console.warn(`MIDIController: No onclick handler defined for dropdown item '${identifier}'.`);
        }
      } else {
        // Handle widgets
        const widget = element;
        const normalizedValue = midiValue / 127; // Normalize to [0, 1]
        widget.value = widget.min + normalizedValue * (widget.max - widget.min);
        if (typeof widget.redraw === 'function') {
          widget.redraw(); // Ensure the widget updates its display
        }
        console.log(`MIDIController: Updated widget '${identifier}' to value ${widget.value}`);
      }
    } else {
      console.warn(`MIDIController: Element '${identifier}' not found.`);
    }
  }
}

export const MIDIControllerInstance = MIDI_SUPPORTED ? new MIDIController() : null;