// MIDIController.js

import { Constants, getPriority } from './Constants.js';
import lscache from 'lscache';
import { showUniversalModal } from './Interaction.js';

/**
 * MIDIController Singleton Class
 * Handles MIDI interactions, including listening to MIDI inputs,
 * managing MIDI mappings, and facilitating MIDI Learn functionality.
 */
class MIDIController {
  constructor() {
    if (MIDIController.instance) {
      return MIDIController.instance;
    }

    this.midiAccess = null;

    // Separate mappings for parameters and widgets
    this.midiParamMappings = new Map(); // parameterName -> { channel, cc }
    this.midiWidgetMappings = new Map(); // widgetId -> { channel, cc }

    this.widgetRegistry = new Map(); // widgetId -> widgetInstance

    this.isMIDIActivated = false;

    this.isMidiLearnModeActive = false;
    this.currentLearnParam = null;
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

    MIDIController.instance = this;
  }


  async init() {
    if (!MIDIController.isMidiSupported()) {
      console.warn("MIDIController: Web MIDI API not supported. Skipping initialization.");
      return;
    }

    console.log("MIDIController: Web MIDI API supported.");
    // Restore persisted mappings if you have this method
    // await this.restoreMidiLearn();

    // Set up the exit button for MIDI Learn mode
    const exitButton = document.getElementById('cancel-midi-learn');
    if (exitButton) {
      exitButton.addEventListener('click', this.handleExitButtonClick);
    }

    // Set up event listeners for the context menu options
    this.setupDropdownEventListeners();
  }

  /**
   * Checks if MIDI is supported by the browser.
   * @returns {boolean} True if supported, false otherwise.
   */
  static isMidiSupported() {
    return 'requestMIDIAccess' in navigator;
  }

  /**
   * Activates MIDI mode with custom modal messaging.
   * Shows the modal only on the first successful activation.
   */
  async activateMIDI() {
    if (this.isMIDIActivated) {
      console.log('MIDIController: MIDI is already activated.');
      return; // Skip activation if already activated
    }

    console.log('MIDIController: Activating MIDI...');
    try {
      await this.requestMidiAccess();
      this.isMIDIActivated = true;
      console.log('MIDIController: MIDI activated successfully.');
    } catch (error) {
      console.error('MIDIController: Failed to activate MIDI:', error);
    }
  }

  /**
   * Handles user interaction with the MIDI icon or menu.
   * If MIDI is not activated, activates it. Otherwise, enters MIDI Learn mode.
   */
  async onMidiIconClick() {
    if (!this.isMIDIActivated) {
      console.log("MIDIController: Requesting MIDI access...");
      await this.activateMIDI();
    } else {
      console.log("MIDIController: Entering MIDI Learn mode.");
      this.enableMidiLearn();
    }
  }

  /**
   * Requests MIDI access from the browser.
   */
  async requestMidiAccess() {
    if (navigator.requestMIDIAccess) {
      try {
        this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
        console.log("MIDIController: MIDI access granted.");

        // Set up MIDI message handling for existing inputs
        this.enableInputs();

        // Listen for MIDI device connections/disconnections
        this.midiAccess.onstatechange = this.handleStateChange;
      } catch (error) {
        console.error("MIDIController: Failed to access MIDI devices:", error);
        throw error; // Propagate error to activateMIDI
      }
    } else {
      console.error("MIDIController: Web MIDI API not supported in this browser.");
      throw new Error('Web MIDI API not supported');
    }
  }

  /**
   * Enables MIDI message handling for all available inputs.
   */
  enableInputs() {
    const inputs = this.midiAccess.inputs.values();
    for (let input of inputs) {
      input.onmidimessage = this.handleMidiMessage;
      console.log(`MIDIController: Enabled MIDI input: ${input.name}`);
    }
  }

  /**
   * Handles MIDI device connection and disconnection.
   * @param {MIDIConnectionEvent} event 
   */
  handleStateChange(event) {
    const port = event.port;
    console.log(`MIDIController: Port ${port.name} ${port.state}.`);
    if (port.type === 'input') {
      if (port.state === 'connected') {
        port.onmidimessage = this.handleMidiMessage;
        console.log(`MIDIController: Connected to MIDI input: ${port.name}`);
      } else if (port.state === 'disconnected') {
        port.onmidimessage = null;
        console.log(`MIDIController: Disconnected from MIDI input: ${port.name}`);
      }
    }
  }

  /**
   * Handles incoming MIDI messages and dispatches them to widgets or parameters.
   * If in MIDI Learn mode, maps the incoming CC to the selected parameter or widget.
   * @param {MIDIMessageEvent} event 
   */
  handleMidiMessage(event) {
    const [status, data1, data2] = event.data;
    const channel = status & 0x0F;
    const messageType = status & 0xF0;
  
    // Process only Control Change (CC) messages
    if (messageType !== 0xB0) return;
  
    if (this.isMidiLearnModeActive && this.currentLearnWidget) {
      // Mapping a widget or menu item
      const widgetId = this.currentLearnWidget.id || this.currentLearnWidget.getAttribute('data-value');
      console.log(`MIDIController: Mapping widget '${widgetId}' to MIDI Channel ${channel + 1}, CC ${data1}`);
      this.setMidiWidgetMapping(widgetId, channel, data1);
  
      // Update visual feedback
      this.unhighlightWidget(widgetId);
      this.markAsMapped(widgetId, data1, channel);  
      // Display confirmation toast
      this.showToast(`Assigned CC ${data1} to '${widgetId}'.`, 'success');
  
      // Reset currentLearnWidget for next mapping
      this.currentLearnWidget = null;
  
      // Keep MIDI Learn mode active for further mappings
      // Remove the call to exitMidiLearnMode()
      // this.exitMidiLearnMode();
  
      return; // Stop processing further
    }

    // Process mapped widgets
    this.midiWidgetMappings.forEach((mapping, widgetId) => {
      if (mapping.channel === channel && mapping.cc === data1) {
        const widget = this.widgetRegistry.get(widgetId);
        if (widget) {
          if (widget.tagName.toLowerCase() === 'a' && widget.classList.contains('dropdown-item')) {
            // Handle dropdown menu item
            console.log(`MIDIController: Triggering action for dropdown item '${widgetId}'`);

            // Directly invoke the action without simulating a click
            if (typeof widget.onclick === 'function') {
              widget.onclick(); // Invoke the existing click handler directly
            } else {
              console.warn(`MIDIController: No onclick handler defined for dropdown item '${widgetId}'.`);
            }
          } else {
            // Handle widgets (including sliders)
            const normalizedValue = data2 / 127; // Normalize to [0, 1]
            const min = widget._min !== undefined ? widget._min : widget.min;
            const max = widget._max !== undefined ? widget._max : widget.max;
            widget.value = min + normalizedValue * (max - min);

            if (typeof widget.redraw === 'function') {
              widget.redraw(); // Ensure the widget updates its display
            }
            console.log(`MIDIController: Updated widget '${widgetId}' to value ${widget.value}`);
          }
        } else {
          console.warn(`MIDIController: Element '${widgetId}' not found.`);
        }
      }
    });

    // Next, check if the MIDI message is mapped to a parameter
    this.midiParamMappings.forEach((mapping, param) => {
      if (mapping.channel === channel && mapping.cc === data1) {
        this.updateParameter(param, data2);
      }
    });
  }

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
   * @param {string} widgetId - The widget's unique ID.
   * @param {number} midiValue - The MIDI CC value (0-127).
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
   * @param {string} id - The widget's unique ID.
   * @param {Object} widget - The widget instance.
   */
  registerWidget(id, widget) {
    if (!id || !widget) {
      console.warn("MIDIController: Cannot register widget without ID or instance.");
      return;
    }
    this.widgetRegistry.set(id, widget);
    console.log(`MIDIController: Registered widget '${id}'.`);
  }

  /**
   * Sets a MIDI mapping for a parameter.
   * @param {string} param - The parameter name.
   * @param {number} channel - MIDI channel (0-15).
   * @param {number} cc - MIDI Control Change number (0-127).
   */
  setMidiParamMapping(param, channel, cc) {
    if (!param) {
      console.warn("MIDIController: Parameter name is required for mapping.");
      return;
    }

    this.midiParamMappings.set(param, { channel, cc });
    console.log(`MIDIController: Mapped parameter '${param}' to MIDI Channel ${channel + 1}, CC ${cc}.`);

    // Add 'midi-mapped' class to the parameter element for visual indication
    const paramElement = document.querySelector(`[data-group="${param}"]`);
    if (paramElement) {
      paramElement.classList.add('midi-mapped');
    }
  }

  /**
   * Sets a MIDI mapping for a widget.
   * @param {string} widgetId - The widget's unique ID.
   * @param {number} channel - MIDI channel (0-15).
   * @param {number} cc - MIDI Control Change number (0-127).
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
   * @param {string} identifier - The parameter name or widget ID.
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
      this.showToast(`Cleared MIDI mapping for '${identifier}'.`, 'success');
    } else {
      console.warn(`MIDIController: No MIDI mapping found for '${identifier}'.`);
      this.showToast(`No MIDI mapping exists for '${identifier}'.`, 'error');
    }
  }

  /**
   * Enables MIDI Learn mode by creating overlays over automatable elements.
   */
  enableMidiLearn() {
    if (!this.isMIDIActivated) {
      console.warn('MIDIController: MIDI is not activated. Cannot enter MIDI Learn mode.');
      return;
    }
    console.log('MIDIController: Entering MIDI Learn mode...');
  
    this.isMidiLearnModeActive = true;
    this.currentLearnParam = null;
    this.currentLearnWidget = null;
  
    // Create overlays for automatable widgets and dropdown items
    this.createOverlays();
  
    // Add class to body for CSS control
    document.body.classList.add('midi-learn-mode');
  
    // Show the exit button
    const exitButton = document.getElementById('cancel-midi-learn');
    if (exitButton) {
      exitButton.style.display = 'block';
    }
  
    // Listen for Esc key to exit
    document.addEventListener('keydown', this.handleEscKey);
  
    // Display a toast message indicating MIDI Learn mode is active
    this.showToast('MIDI Learn mode activated. Click on a control to assign MIDI.', 'info');
  }

  /**
   * Creates overlays over automatable elements during MIDI Learn mode.
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
        e.stopPropagation(); // prevent event bubbling
  
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
   */
  removeOverlays() {
    // Remove widget overlays
    const overlays = document.querySelectorAll('.widget-overlay');
    overlays.forEach(overlay => {
      overlay.parentNode.removeChild(overlay);
    });
  
    // Restore dropdown items
    const dropdownItems = document.querySelectorAll('[data-midi-controllable="true"]');
    dropdownItems.forEach(item => {
      item.classList.remove('midi-learn-dropdown');
      item.removeEventListener('click', item.dropdownItemClickHandler);
  
      // Restore original click handler
      if (item.originalClickHandler) {
        item.onclick = item.originalClickHandler;
        delete item.originalClickHandler;
      }
    });
  
    console.log('MIDIController: Removed overlays from automatable widgets and dropdown items.');
  }

  /**
   * Initiates MIDI learning mode for a specific widget.
   * @param {HTMLElement} widget 
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
    this.showToast(`Perform a MIDI action to assign it to '${widget.id}'.`, 'info');
  }

  /**
   * Highlights a specific widget in the UI to indicate it's being mapped.
   * @param {string} widgetId - The widget's unique ID.
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
   * @param {string} widgetId - The widget's unique ID.
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
   * @param {string} param - The parameter name.
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
   * @param {string} param - The parameter name.
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
   */
  handleExitButtonClick() {
    this.exitMidiLearnMode();
  }

  /**
   * Handles the Esc key press to exit MIDI Learn mode.
   * @param {KeyboardEvent} e 
   */
  handleEscKey(e) {
    if (e.key === 'Escape' && this.isMidiLearnModeActive) {
      this.exitMidiLearnMode();
    }
  }

  /**
   * Exits MIDI Learn mode by removing overlays and hiding the exit button.
   */
  exitMidiLearnMode() {
    this.isMidiLearnModeActive = false;
    this.currentLearnParam = null;
    this.currentLearnWidget = null;
  
    // Remove MIDI Learn mode class from body
    document.body.classList.remove('midi-learn-mode');
  
    // Remove overlays
    this.removeOverlays();
  
    // Remove 'midi-learn-highlight' class from all elements
    const highlightedElements = document.querySelectorAll('.midi-learn-highlight');
    highlightedElements.forEach(element => {
      element.classList.remove('midi-learn-highlight');
    });
  
    // Hide the exit button
    const exitButton = document.getElementById('cancel-midi-learn');
    if (exitButton) {
      exitButton.style.display = 'none';
    }
  
    // Remove on-screen messages
    const toastContainer = document.getElementById('toast-container');
    if (toastContainer) {
      toastContainer.innerHTML = '';
    }
  
    // Close any open context menus
    this.closeContextMenu();
  
    // Remove Esc key listener
    document.removeEventListener('keydown', this.handleEscKey);
  
    // Reset MIDI Learn Icon to Default State
    const midiIcon = document.getElementById('midi-learn-icon'); // Ensure the icon has this ID
    if (midiIcon) {
      midiIcon.classList.remove('active'); // Remove any active classes
      midiIcon.classList.add('default'); // Add default class if necessary
      midiIcon.setAttribute('aria-label', 'Jam Mode'); // Update ARIA labels or tooltips
    }
  
    console.log('MIDIController: Exited MIDI Learn mode.');
  }
  
  /**
   * Handles the "Learn" action from the context menu.
   * Initiates MIDI Learn mode for the selected parameter or widget.
   * @param {Event} event 
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
      showUniversalModal(
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
   * @param {Event} event 
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
        showUniversalModal(
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
   * @param {Event} event 
   */
  handleContextMenuClose(event) {
    console.log('handleContextMenuClose called');
    // Prevent default behavior and stop propagation
    event.preventDefault();
    event.stopPropagation();

    this.closeContextMenu();
    console.log("MIDIController: Context menu closed without exiting MIDI Learn mode.");
  }

  isElementMapped(element) {
    const id = element.id || element.getAttribute('data-value');
    return this.midiWidgetMappings.has(id) || this.midiParamMappings.has(id);
  }

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
    this.showToast(`Perform a MIDI action to assign it to '${id}'.`, 'info');
  }


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
   * Opens the MIDI Context Menu for the specified widget or parameter at the event's location.
   * @param {MouseEvent|TouchEvent} e - The event triggering the context menu.
   * @param {HTMLElement} element - The widget or dropdown item requesting MIDI Learn.
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
    contextMenu.style.zIndex = '1001'; // Ensure context menu is above overlays
  
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
   * Sets up event listeners for the context menu options.
   */
  setupDropdownEventListeners() {
    const contextMenuLearn = document.getElementById("midi-context-learn");
    const contextMenuDelete = document.getElementById("midi-context-delete");
    const contextMenuClose = document.getElementById("midi-context-close");
  
    if (contextMenuLearn) {
      contextMenuLearn.addEventListener("click", this.handleContextMenuLearn);
      contextMenuLearn.addEventListener("touchstart", this.handleContextMenuLearn);
    }
  
    if (contextMenuDelete) {
      contextMenuDelete.addEventListener("click", this.handleContextMenuDelete);
      contextMenuDelete.addEventListener("touchstart", this.handleContextMenuDelete);
    }
  
    if (contextMenuClose) {
      contextMenuClose.addEventListener("click", this.handleContextMenuClose);
      contextMenuClose.addEventListener("touchstart", this.handleContextMenuClose);
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

  showToast(message, type = 'info', duration = 3000) {
    // Create or select the toast container
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.style.position = 'fixed';
      toastContainer.style.bottom = '20px';
      toastContainer.style.right = '20px';
      toastContainer.style.zIndex = '1003';
      toastContainer.style.display = 'flex';
      toastContainer.style.flexDirection = 'column';
      toastContainer.style.alignItems = 'flex-end';
      document.body.appendChild(toastContainer);
    }
  
    // Create the toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // Apply basic styles for toast (can be enhanced with CSS)
    toast.style.minWidth = '200px';
    toast.style.marginTop = '10px';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '5px';
    toast.style.color = '#fff';
    toast.style.backgroundColor = this.getToastColor(type);
    toast.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.5s ease';

    toastContainer.appendChild(toast);

    // Trigger reflow to enable transition
    void toast.offsetWidth;
    toast.style.opacity = '1';
  
    // Remove the toast after the specified duration
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.addEventListener('transitionend', () => {
        if (toast.parentNode === toastContainer) { // Check if still present
          toastContainer.removeChild(toast);
        }
      });
    }, duration);
  }

  /**
   * Returns the background color based on the toast type.
   * @param {string} type - The type of the toast ('info', 'success', 'error').
   * @returns {string} The corresponding color.
   */
  getToastColor(type) {
    switch(type) {
      case 'success':
        return '#28a745'; // Green
      case 'error':
        return '#dc3545'; // Red
      case 'info':
      default:
        return '#17a2b8'; // Blue
    }
  }

}

export const MIDIControllerInstance = new MIDIController();