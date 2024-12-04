// MIDIController.js

import { ParameterManager } from './ParameterManager.js';
import { Constants, TRACK_ID, getPriority } from './Constants.js';
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
    this.listeners = new Set();
    this.parameterManager = ParameterManager.getInstance();
    this.midiMappings = new Map(); // parameterName -> { channel, cc }
    this.isMIDIActivated = false;

    this.isMidiLearnActive = false;
    this.currentLearnParam = null;
    this.currentlyLearningWidget = null;

    // Bind methods to maintain 'this' context
    this.handleExitButtonClick = this.handleExitButtonClick.bind(this);
    this.handleEscKey = this.handleEscKey.bind(this);
    this.createOverlays = this.createOverlays.bind(this);
    this.removeOverlays = this.removeOverlays.bind(this);

    this.init();

    MIDIController.instance = this;
  }

  /**
   * Initializes the MIDIController by restoring mappings and setting up MIDI access.
   */
  async init() {
    if (!MIDIController.isMidiSupported()) {
      console.warn("MIDIController: Web MIDI API not supported. Skipping initialization.");
      return;
    }

    console.log("MIDIController: Web MIDI API supported.");
    await this.restoreMidiLearn(); // Restore persisted mappings

    // Set up the exit button
    const exitButton = document.getElementById('cancel-midi-learn');
    if (exitButton) {
      exitButton.addEventListener('click', this.handleExitButtonClick);
    }

    // Set up event listeners for the Bootstrap dropdown
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

/*       showUniversalModal(
        'MIDI Activated',
        'MIDI has been successfully activated! You can now use your MIDI devices.',
        'Okay'
      ); */
    } catch (error) {
      console.error('MIDIController: Failed to activate MIDI:', error);

/*       showUniversalModal(
        'MIDI Activation Failed',
        'There was an error while trying to activate MIDI. Please check your settings and try again.',
        'Close'
      ); */
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
        this.midiAccess.onstatechange = this.handleStateChange.bind(this);
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
      input.onmidimessage = this.handleMidiMessage.bind(this);
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
        port.onmidimessage = this.handleMidiMessage.bind(this);
        console.log(`MIDIController: Connected to MIDI input: ${port.name}`);
      } else if (port.state === 'disconnected') {
        port.onmidimessage = null;
        console.log(`MIDIController: Disconnected from MIDI input: ${port.name}`);
      }
    }
  }

  /**
   * Handles incoming MIDI messages and dispatches them to listeners.
   * If in MIDI Learn mode, maps the incoming CC to the selected parameter.
   * @param {MIDIMessageEvent} event 
   */
  handleMidiMessage(event) {
    const [status, data1, data2] = event.data;
    const channel = status & 0x0F;
    const messageType = status & 0xF0;

    // Ignore system messages and certain control messages
    if ((status & 0xF0) === 0xF0 || ((status & 0xF0) === 0xB0 && data1 >= 120)) {
      return;
    }

    if (this.isMidiLearnActive && this.currentLearnParam) {
      if (messageType === 0xB0) { // Control Change (CC)
        console.log(`MIDIController: Mapping ${this.currentLearnParam} to MIDI Channel ${channel + 1}, CC ${data1}`);
        this.setMidiMapping(this.currentLearnParam, channel, data1);
        this.isMidiLearnActive = false;

        // Provide feedback to the user
        showUniversalModal(
          'MIDI Mapping Successful',
          `Mapped '${this.currentLearnParam}' to MIDI Channel ${channel + 1}, CC ${data1}.`,
          'Great!'
        );

        // Remove highlight from the parameter
        this.unhighlightParameter(this.currentLearnParam);

        this.currentLearnParam = null;

        return;
      }
    }

    // Process MIDI messages if already mapped
    this.midiMappings.forEach((mapping, param) => {
      if (mapping.channel === channel && mapping.cc === data1) {
        console.log(`MIDIController: Controlling '${param}' with value ${data2}`);
        this.updateParameter(param, data2);
      }
    });

    // Dispatch to listeners
    this.listeners.forEach(listener => {
      if (typeof listener.processMidiEvent === 'function') {
        listener.processMidiEvent(event);
      }
    });
  }

  /**
   * Updates a parameter based on incoming MIDI data.
   * @param {string} param - The parameter to update.
   * @param {number} midiValue - The MIDI CC value (0-127).
   */
  updateParameter(param, midiValue) {
    const normalizedValue = midiValue / 127; // Normalize to [0, 1]

    // Use the ParameterManager to set the normalized value
    const priority = getPriority("MIDI"); // Assuming you have a priority system
    this.parameterManager.setNormalizedValue(param, normalizedValue, this, priority);

    console.log(`MIDIController: Updated parameter '${param}' to normalized value ${normalizedValue}`);
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

    this.isMidiLearnActive = true;
    this.currentLearnParam = null;

    // Add class to body for CSS control
    document.body.classList.add('midi-learn-mode');

    // Create overlays for automatable elements
    this.createOverlays();

    // Show the exit button
    const exitButton = document.getElementById('cancel-midi-learn');
    if (exitButton) {
      exitButton.style.display = 'block';
    }

    // Listen for Esc key to exit
    document.addEventListener('keydown', this.handleEscKey);
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
    if (e.key === 'Escape' && this.isMidiLearnActive) {
      this.exitMidiLearnMode();
    }
  }

  /**
   * Exits MIDI Learn mode by removing overlays and hiding the exit button.
   */
  exitMidiLearnMode() {
    this.isMidiLearnActive = false;
    this.currentLearnParam = null;
    this.currentlyLearningWidget = null;

    // Remove MIDI Learn mode class from body
    document.body.classList.remove('midi-learn-mode');

    // Remove overlays
    this.removeOverlays();

    // Hide the exit button
    const exitButton = document.getElementById('cancel-midi-learn');
    if (exitButton) {
      exitButton.style.display = 'none';
    }

    // Remove Esc key listener
    document.removeEventListener('keydown', this.handleEscKey);

    console.log('MIDIController: Exited MIDI Learn mode.');
  }

  /**
   * Creates overlays over automatable elements during MIDI Learn mode.
   */
  createOverlays() {
    // Select only widgets, excluding dropdown menu items
    const automatableElements = document.querySelectorAll('[data-automatable="true"]:not(.dropdown-menu .dropdown-item)');
    // Alternatively, if you've added a specific class like 'midi-widget', use that:
    // const automatableElements = document.querySelectorAll('.midi-widget');

    automatableElements.forEach(element => {
      // Set pointer-events: none on the automatable element to disable it
      element.style.pointerEvents = 'none';

      // Create overlay div
      const overlay = document.createElement('div');
      overlay.classList.add('widget-overlay');
      overlay.dataset.group = element.getAttribute('data-group');

      // Position overlay over the automatable element
      const rect = element.getBoundingClientRect();
      overlay.style.position = 'fixed'; // Changed to fixed
      overlay.style.top = `${rect.top}px`;
      overlay.style.left = `${rect.left}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      overlay.style.pointerEvents = 'auto';
      overlay.style.backgroundColor = 'rgba(0,0,0,0)'; // Transparent
      overlay.style.zIndex = '1000'; // Ensure it's above other elements

      // Add highlighting effect
      overlay.classList.add('midi-learn-highlight');

      // Attach event listener to overlay
      overlay.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation(); // Prevent any other listeners from firing
        this.openContextMenu(e, element);
      });

      // Append overlay to the body
      document.body.appendChild(overlay);
    });
    console.log('MIDIController: Created overlays for automatable elements.');
  }

  /**
   * Removes overlays created during MIDI Learn mode.
   */
  removeOverlays() {
    const automatableElements = document.querySelectorAll('[data-automatable="true"]:not(.dropdown-menu .dropdown-item)');
    // Alternatively, if you've used a specific class:
    // const automatableElements = document.querySelectorAll('.midi-widget');

    automatableElements.forEach(element => {
      // Reset pointer-events to auto
      element.style.pointerEvents = 'auto';
    });

    const overlays = document.querySelectorAll('.widget-overlay');
    overlays.forEach(overlay => {
      overlay.parentNode.removeChild(overlay);
    });
    console.log('MIDIController: Removed overlays from automatable elements.');
  }

  /**
   * Opens the MIDI Context Menu (Bootstrap Dropdown) for the specified widget at the event's location.
   * @param {MouseEvent|TouchEvent} e - The event triggering the context menu.
   * @param {HTMLElement} widget - The widget requesting MIDI Learn.
   */
  openContextMenu(e, widget) {
    const contextMenu = document.getElementById("midi-context-menu");
    if (!contextMenu) {
        console.error("MIDIController: Context menu not found.");
        return;
    }

    // Stop event propagation
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation(); // Prevents any additional listeners on the same element

    // Determine position
    let pageX, pageY;
    if (e.type.startsWith('touch')) {
        const touch = e.touches[0] || e.changedTouches[0];
        pageX = touch.pageX;
        pageY = touch.pageY;
    } else {
        pageX = e.pageX;
        pageY = e.pageY;
    }

    // Position the context menu
    contextMenu.style.left = `${pageX}px`;
    contextMenu.style.top = `${pageY}px`;
    contextMenu.style.display = 'block';
    contextMenu.classList.add('show');

    // Ensure current widget is set
    this.currentlyLearningWidget = widget;

    console.log(`MIDIController: Context menu opened for widget '${widget.id || widget.getAttribute('data-group')}'.`);
}

  /**
   * Closes the MIDI Context Menu (Bootstrap Dropdown).
   */
  closeContextMenu() {
    const contextMenu = document.getElementById("midi-context-menu");
    if (contextMenu) {
      contextMenu.classList.remove("show"); // Remove Bootstrap's show class
      contextMenu.style.display = 'none'; // Hide the dropdown

      // Re-enable pointer events on the overlay
      const widget = this.currentlyLearningWidget;
      if (widget) {
        const overlay = Array.from(document.querySelectorAll('.widget-overlay')).find(
          ov => ov.dataset.group === widget.getAttribute('data-group')
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
   * Handles the "Learn" action from the Bootstrap dropdown.
   */
  handleContextMenuLearn() {
    if (this.currentlyLearningWidget) {
      this.startMidiLearn();
      this.closeContextMenu();
    } else {
      console.warn("MIDIController: No widget selected for MIDI Learn.");
    }
  }

  /**
   * Handles the "Delete" action from the Bootstrap dropdown.
   */
  handleContextMenuDelete() {
    if (this.currentlyLearningWidget) {
      const paramName = this.currentlyLearningWidget.getAttribute('data-group');
      if (paramName) {
        this.clearMidiMapping(paramName);
      } else {
        console.warn("MIDIController: Selected widget does not have a valid 'data-group' attribute.");
        showUniversalModal(
          'Invalid Parameter',
          'The selected widget does not have a valid parameter to delete.',
          'Okay'
        );
      }
      this.closeContextMenu();
    } else {
      console.warn("MIDIController: No widget selected to delete MIDI mapping.");
    }
  }

  /**
   * Handles the "Close" action from the Bootstrap dropdown.
   */
  handleContextMenuClose() {
    this.closeContextMenu();
    console.log("MIDIController: Context menu closed without exiting MIDI Learn mode.");
  }

  /**
   * Initiates MIDI learning mode for the currently selected widget.
   */
  startMidiLearn() {
    if (this.currentlyLearningWidget) {
      const paramName = this.currentlyLearningWidget.getAttribute('data-group');
      if (!paramName) {
        console.warn("MIDIController: Selected widget does not have a valid 'data-group' attribute.");
        showUniversalModal(
          'Invalid Parameter',
          'The selected widget does not have a valid parameter to map.',
          'Okay'
        );
        return;
      }

      this.currentLearnParam = paramName;
      this.isMidiLearnActive = true;
      console.log(`MIDIController: MIDI Learn mode activated for parameter '${paramName}'.`);

      // Highlight the specific parameter further if needed
      this.highlightParameter(paramName);

      // Provide visual feedback to the user
      showUniversalModal(
        'MIDI Learn',
        `Perform a MIDI action (e.g., move a knob) to map it to '${paramName}'.`,
        'Cancel'
      ).then(() => {
        if (this.isMidiLearnActive) {
          // User canceled MIDI Learn mode
          this.isMidiLearnActive = false;
          this.currentLearnParam = null;
          this.unhighlightParameter(paramName);
          console.log('MIDIController: MIDI Learn mode canceled by user.');
        }
      });
    } else {
      console.warn("MIDIController: No widget is currently selected for MIDI Learn.");
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
   * Sets a MIDI mapping for a specific parameter.
   * @param {string} param - The parameter to map.
   * @param {number} channel - MIDI channel (0-15).
   * @param {number} cc - MIDI Control Change number (0-127).
   */
  setMidiMapping(param, channel, cc) {
    if (!param) {
      console.warn("MIDIController: Parameter name is required for mapping.");
      return;
    }

    this.midiMappings.set(param, { channel, cc });
    console.log(`MIDIController: Mapped '${param}' to MIDI Channel ${channel + 1}, CC ${cc}.`);

    // Add 'midi-mapped' class to the element
    const element = document.querySelector(`[data-group="${param}"]`);
    if (element) {
      element.classList.add('midi-mapped');
    }

    // Persist the mappings
    this.preserveMidiLearn();
  }

  /**
   * Clears the MIDI mapping for a specific parameter.
   * @param {string} param 
   */
  clearMidiMapping(param) {
    if (this.midiMappings.delete(param)) {
      console.log(`MIDIController: Cleared MIDI mapping for parameter '${param}'.`);
      // Remove 'midi-mapped' class from the element
      const element = document.querySelector(`[data-group="${param}"]`);
      if (element) {
        element.classList.remove('midi-mapped');
      }

      // Notify the user
      showUniversalModal(
        'MIDI Mapping Cleared',
        `Cleared MIDI mapping for parameter '${param}'.`,
        'Okay'
      );

      // Persist the cleared mappings
      this.preserveMidiLearn();
    } else {
      console.warn(`MIDIController: No MIDI mapping found for parameter '${param}'.`);
      showUniversalModal(
        'MIDI Mapping Not Found',
        `No MIDI mapping exists for parameter '${param}'.`,
        'Okay'
      );
    }
  }

  /**
   * Sends a MIDI Control Change message.
   * @param {number} channel - MIDI channel (0-15).
   * @param {number} cc - Control Change number (0-127).
   * @param {number} value - Control Change value (0-127).
   */
  sendMidiCC(channel, cc, value) {
    if (!this.midiAccess) {
      console.warn("MIDIController: MIDI access not initialized.");
      return;
    }

    for (let output of this.midiAccess.outputs.values()) {
      output.send([0xB0 | (channel & 0x0F), cc & 0x7F, value & 0x7F]);
      console.log(`MIDIController: Sent CC ${cc} with value ${value} on Channel ${channel + 1} to output '${output.name}'.`);
    }
  }

  /**
   * Subscribes to parameter changes and sends MIDI CC messages if bidirectional.
   * @param {string} parameterName 
   */
  subscribeToParameter(parameterName) {
    if (!this.parameterManager.parameters.has(parameterName)) {
      console.warn(`MIDIController: Parameter '${parameterName}' does not exist.`);
      return;
    }

    const param = this.parameterManager.parameters.get(parameterName);
    if (!param.isBidirectional) {
      console.warn(`MIDIController: Parameter '${parameterName}' is not bidirectional.`);
      return;
    }

    // Subscribe to parameter changes with priority from Constants.js
    const priority = getPriority("MIDI"); // Priority 1 as per Constants.js
    this.parameterManager.subscribe(this, parameterName, priority);

    console.log(`MIDIController: Subscribed to bidirectional updates for parameter '${parameterName}'.`);
  }

  /**
   * Persists MIDI Learn mappings using lscache.
   */
  preserveMidiLearn() {
    if (Constants.preserveMidiLearn) {
      const mappingsArray = Array.from(this.midiMappings.entries());
      lscache.set('midiMappings', mappingsArray, Constants.CACHE_EXPIRY_MINUTES);
      console.log("MIDIController: Preserved MIDI Learn mappings.");
    }
  }

  /**
   * Restores MIDI Learn mappings from storage (e.g., localStorage).
   */
  async restoreMidiLearn() {
    if (Constants.preserveMidiLearn) {
      const mappingsArray = lscache.get('midiMappings');
      if (mappingsArray && Array.isArray(mappingsArray)) {
        this.midiMappings = new Map(mappingsArray);
        console.log("MIDIController: Restored MIDI Learn mappings from cache.");

        // Apply 'midi-mapped' class to mapped elements
        this.midiMappings.forEach((mapping, param) => {
          const element = document.querySelector(`[data-group="${param}"]`);
          if (element) {
            element.classList.add('midi-mapped');
          }
        });
      } else {
        console.warn("MIDIController: No MIDI Learn mappings found in cache.");
      }
    }
  }

  /**
   * Sets up event listeners for the Bootstrap dropdown menu items.
   */
  setupDropdownEventListeners() {
    const contextMenuLearn = document.getElementById("midi-context-learn");
    const contextMenuDelete = document.getElementById("midi-context-delete");
    const contextMenuClose = document.getElementById("midi-context-close");

    if (contextMenuLearn) {
      contextMenuLearn.addEventListener("click", (e) => {
        e.preventDefault();
        this.handleContextMenuLearn(); // Starts MIDI Learn mode
      });
      contextMenuLearn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        this.handleContextMenuLearn();
      });
    }

    if (contextMenuDelete) {
      contextMenuDelete.addEventListener("click", (e) => {
        e.preventDefault();
        this.handleContextMenuDelete(); // Deletes the MIDI mapping
      });
      contextMenuDelete.addEventListener("touchstart", (e) => {
        e.preventDefault();
        this.handleContextMenuDelete();
      });
    }

    if (contextMenuClose) {
      contextMenuClose.addEventListener("click", (e) => {
        e.preventDefault();
        this.handleContextMenuClose(); // Closes the context menu
      });
      contextMenuClose.addEventListener("touchstart", (e) => {
        e.preventDefault();
        this.handleContextMenuClose();
      });
    }

    // Handle closing the dropdown when clicking outside
    document.addEventListener('click', (e) => {
      const contextMenu = document.getElementById("midi-context-menu");
      if (contextMenu && !contextMenu.contains(e.target)) {
        this.closeContextMenu();
      }
    });

    // Handle escape key to close the dropdown
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeContextMenu();
      }
    });
  }
}

export const MIDIControllerInstance = new MIDIController();