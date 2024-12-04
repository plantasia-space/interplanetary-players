// MIDIController.js

import { ParameterManager } from './ParameterManager.js'; // Ensure correct capitalization and path
import { Constants, TRACK_ID, getPriority } from './Constants.js';
import lscache from 'lscache'; // Ensure lscache is installed via npm or included in your project
import { showUniversalModal } from './interaction.js';
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
    this.listeners = new Set(); // Set of objects with processMidiEvent(event) method
    this.parameterManager = ParameterManager.getInstance(); // Access Singleton instance
    this.midiMappings = new Map(); // Map of widget IDs to MIDI CC data
    this.currentlyLearningWidget = null; // Widget currently in MIDI Learn mode

    this.init();

    MIDIController.instance = this;
  }

async init() {
  if (!MIDIController.isMidiSupported()) {
      console.warn("MIDIController: Web MIDI API not supported. Skipping initialization.");
      return;
  }

  console.log("MIDIController: Web MIDI API supported.");
  // Do not request access until the user interacts with the MIDI icon
}


/**
 * Checks if MIDI is supported by the browser.
 * @returns {boolean} True if supported, false otherwise.
 */
static isMidiSupported() {
  return 'requestMIDIAccess' in navigator;
}

/**
* Handles user interaction with the MIDI icon or menu.
*/
async onMidiIconClick() {
  if (!this.midiAccess) {
    console.log("MIDIController: Requesting MIDI access...");

    try {
      await this.requestMidiAccess();

      // Show success message in the Universal Modal
      showUniversalModal(
        'MIDI Status',
        'MIDI has been activated! You can now use MIDI devices.',
        'Okay'
      );

      console.log('MIDIController: MIDI access granted.');
    } catch (error) {
      console.error("MIDIController: Failed to access MIDI devices:", error);

      // Show error message in the Universal Modal
      showUniversalModal(
        'MIDI Error',
        'Failed to activate MIDI. Please check your browser settings.',
        'Dismiss'
      );
    }
  } else {
    console.log("MIDIController: MIDI already initialized.");

    // Notify the user MIDI is already active
    showUniversalModal(
      'MIDI Status',
      'MIDI is already activated!',
      'Got it'
    );
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
      }
    } else {
      console.error("MIDIController: Web MIDI API not supported in this browser.");
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
   * @param {MIDIMessageEvent} event 
   */
  handleMidiMessage(event) {
    const [status, data1, data2] = event.data;
    // Filter out system messages and certain control messages if necessary
    if ((status & 0xF0) === 0xF0 || ((status & 0xF0) === 0xB0 && data1 >= 120)) {
      return;
    }

    // Dispatch to listeners
    this.listeners.forEach(listener => {
      if (typeof listener.processMidiEvent === 'function') {
        listener.processMidiEvent(event);
      }
    });

    // If rootParameter is set, update it based on MIDI data
    if (this.rootParameter) {
      this.updateRootParameterFromMIDI(status, data1, data2);
    }
  }

  /**
   * Registers a listener for MIDI events.
   * @param {object} listener - Object with processMidiEvent(event) method.
   */
  addListener(listener) {
    if (listener && typeof listener.processMidiEvent === 'function') {
      this.listeners.add(listener);
      console.log(`MIDIController: Listener added. Total listeners: ${this.listeners.size}`);
    } else {
      console.warn("MIDIController: Invalid listener. Must have a processMidiEvent method.");
    }
  }

  /**
   * Removes a listener from MIDI events.
   * @param {object} listener 
   */
  removeListener(listener) {
    if (this.listeners.delete(listener)) {
      console.log(`MIDIController: Listener removed. Total listeners: ${this.listeners.size}`);
    } else {
      console.warn("MIDIController: Listener not found.");
    }
  }

  /**
   * Sets the root parameter to be controlled via MIDI.
   * @param {string} parameterName - The name of the parameter in ParameterManager.
   */
  setRootParameter(parameterName) {
    if (!this.parameterManager.parameters.has(parameterName)) {
      console.warn(`MIDIController: Parameter '${parameterName}' does not exist in ParameterManager.`);
      return;
    }
    this.rootParameter = parameterName;
    console.log(`MIDIController: Root parameter set to '${parameterName}'.`);

    // Subscribe to parameter changes to send MIDI CC messages if bidirectional
    this.subscribeToParameter(parameterName);
  }

  /**
   * Updates the root parameter based on incoming MIDI data.
   * Normalizes MIDI data (0-127) to parameter range (min-max).
   * @param {number} status 
   * @param {number} data1 
   * @param {number} data2 
   */
  updateRootParameterFromMIDI(status, data1, data2) {
    // Assuming data1 is the Control Change number and data2 is the value
    const controlNumber = data1;
    const value = data2; // 0-127

    const param = this.parameterManager.parameters.get(this.rootParameter);
    if (!param) {
      console.warn(`MIDIController: Root parameter '${this.rootParameter}' not found.`);
      return;
    }

    // Normalize MIDI value to [0,1]
    const normalizedValue = this.parameterManager.normalize(value, param.min, param.max);

    // Update ParameterManager with priority from Constants.js
    const priority = getPriority("MIDI"); // Priority 1 as per Constants.js
    this.parameterManager.setNormalizedValue(this.rootParameter, normalizedValue, this, priority);
    console.log(`MIDIController: Updated parameter '${this.rootParameter}' to ${normalizedValue} based on MIDI CC ${controlNumber}`);
  }

  /**
   * Sets a MIDI mapping for a specific widget.
   * @param {string} widgetId - The ID of the widget.
   * @param {number} channel - MIDI channel (0-15).
   * @param {number} cc - MIDI Control Change number (0-127).
   */
  setMidiMapping(widgetId, channel, cc) {
    if (!widgetId) {
      console.warn("MIDIController: widgetId is required to set MIDI mapping.");
      return;
    }
    this.midiMappings.set(widgetId, { channel, cc });
    console.log(`MIDIController: Set MIDI mapping for widget '${widgetId}' to Channel ${channel + 1}, CC ${cc}.`);
  }

  /**
   * Clears the MIDI mapping for a specific widget.
   * @param {string} widgetId 
   */
  clearMidiMapping(widgetId) {
    if (this.midiMappings.delete(widgetId)) {
      console.log(`MIDIController: Cleared MIDI mapping for widget '${widgetId}'.`);
    } else {
      console.warn(`MIDIController: No MIDI mapping found for widget '${widgetId}'.`);
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
   * Handles parameter changes from ParameterManager and sends MIDI CC messages.
   * @param {string} parameterName 
   * @param {number} newValue 
   */
  onParameterChanged(parameterName, newValue) {
    if (!this.rootParameter) return;
    if (parameterName !== this.rootParameter) return;

    const param = this.parameterManager.parameters.get(parameterName);
    if (!param) return;

    // Denormalize value to MIDI range
    const midiValue = this.parameterManager.denormalize(newValue, param.min, param.max);
    const midiValueClamped = Math.min(127, Math.max(0, Math.round(midiValue)));

    // Find the corresponding MIDI mapping for the root parameter
    // Assuming one root parameter mapping. Adjust if multiple.
    for (let [widgetId, mapping] of this.midiMappings.entries()) {
      const { channel, cc } = mapping;
      this.sendMidiCC(channel, cc, midiValueClamped);
      console.log(`MIDIController: Sent MIDI CC ${cc} with value ${midiValueClamped} on Channel ${channel + 1} for parameter '${parameterName}'.`);
    }
  }

  /**
   * Creates and appends the MIDI Context Menu to the document body.
   * This ensures only one instance of the context menu exists.
   */
  createContextMenu() {
    // Check if context menu already exists
    if (document.getElementById("webaudioctrl-context-menu")) {
      console.warn("MIDIController: Context menu already exists.");
      return;
    }

    // **1. Define and Inject Styles for Context Menu**
    let styles = document.createElement("style");
    styles.innerHTML = `
      #webaudioctrl-context-menu {
        display: none;
        position: absolute;
        z-index: 1000;
        padding: 0;
        width: 150px;
        color: #fff;
        background-color: #333;
        border: solid 1px #000;
        box-shadow: 2px 2px 5px rgba(0,0,0,0.5);
        font-family: Arial, sans-serif;
        font-size: 14px;
        list-style: none;
        border-radius: 5px;
      }
      #webaudioctrl-context-menu.active {
        display: block;
      }
      .webaudioctrl-context-menu__item {
        padding: 10px;
        cursor: pointer;
        border-bottom: 1px solid #444;
      }
      .webaudioctrl-context-menu__item:last-child {
        border-bottom: none;
      }
      .webaudioctrl-context-menu__item:hover {
        background-color: #555;
      }
      .webaudioctrl-context-menu__title {
        padding: 10px;
        background-color: #444;
        font-weight: bold;
        cursor: default;
        border-bottom: 1px solid #555;
      }
    `;
    document.head.appendChild(styles);

    // **2. Create Context Menu HTML Structure**
    let midimenu = document.createElement("ul");
    midimenu.id = "webaudioctrl-context-menu";
    midimenu.innerHTML = `
      <li class="webaudioctrl-context-menu__title">MIDI Learn</li>
      <li class="webaudioctrl-context-menu__item" id="webaudioctrl-context-menu-learn">Learn</li>
      <li class="webaudioctrl-context-menu__item" id="webaudioctrl-context-menu-clear">Clear Mappings</li>
      <li class="webaudioctrl-context-menu__item" id="webaudioctrl-context-menu-close">Close</li>
    `;
    document.body.appendChild(midimenu);

    // **3. Add Event Listeners to Context Menu Items**
    const contextMenuLearn = document.getElementById("webaudioctrl-context-menu-learn");
    const contextMenuClear = document.getElementById("webaudioctrl-context-menu-clear");
    const contextMenuClose = document.getElementById("webaudioctrl-context-menu-close");

    if (contextMenuLearn) {
      contextMenuLearn.addEventListener("click", (e) => {
        e.preventDefault();
        this.startMidiLearn(); // Starts MIDI Learn mode
      });
    }

    if (contextMenuClear) {
      contextMenuClear.addEventListener("click", (e) => {
        e.preventDefault();
        this.clearMidiMappings(); // Clears all MIDI mappings
      });
    }

    if (contextMenuClose) {
      contextMenuClose.addEventListener("click", (e) => {
        e.preventDefault();
        this.closeContextMenu(); // Closes the context menu
      });
    }

    // **4. Handle Clicks Outside the Context Menu to Close It**
    document.addEventListener("click", (e) => {
      const contextMenu = document.getElementById("webaudioctrl-context-menu");
      if (contextMenu && !contextMenu.contains(e.target)) {
        this.closeContextMenu();
      }
    });
  }

  /**
   * Opens the MIDI Context Menu for the specified widget at the event's location.
   * @param {MouseEvent} e - The mouse event triggering the context menu.
   * @param {HTMLElement} widget - The widget requesting MIDI Learn.
   */
  openContextMenu(e, widget) {
    const contextMenu = document.getElementById("webaudioctrl-context-menu");
    if (!contextMenu) {
      console.error("MIDIController: Context menu not found.");
      return;
    }

    // Prevent multiple widgets from triggering MIDI Learn simultaneously
    if (this.currentlyLearningWidget && this.currentlyLearningWidget !== widget) {
      console.warn(`MIDIController: MIDI Learn is already active for widget '${this.currentlyLearningWidget.id}'.`);
      return;
    }

    // Position the context menu based on the event's coordinates
    contextMenu.style.left = `${e.pageX}px`;
    contextMenu.style.top = `${e.pageY}px`;
    contextMenu.classList.add("active");

    // Set the currently learning widget
    this.currentlyLearningWidget = widget;
    console.log(`MIDIController: Context menu opened for widget '${widget.id}'.`);
  }

  /**
   * Closes the MIDI Context Menu.
   */
  closeContextMenu() {
    const contextMenu = document.getElementById("webaudioctrl-context-menu");
    if (contextMenu) {
      contextMenu.classList.remove("active");
      console.log("MIDIController: Context menu closed.");
      this.currentlyLearningWidget = null;
    }
  }

  /**
   * Initiates MIDI learning mode for the currently selected widget.
   */
  startMidiLearn() {
    if (this.currentlyLearningWidget) {
      this.currentlyLearningWidget.midiMode = "learn";
      console.log(`MIDIController: MIDI Learn mode activated for widget '${this.currentlyLearningWidget.id}'.`);
      // Optionally provide visual feedback to the user, e.g., highlighting the widget
    } else {
      console.warn("MIDIController: No widget is currently selected for MIDI Learn.");
    }
  }

  /**
   * Clears all MIDI mappings.
   */
  clearMidiMappings() {
    this.midiMappings.clear();
    console.log("MIDIController: All MIDI mappings have been cleared.");
    // Optionally, notify all subscribed widgets to update their state
  }

  /**
   * Preserves MIDI Learn mappings based on Constants settings.
   */
  preserveMidiLearn() {
    if (Constants.preserveMidiLearn) {
      // Implement preservation logic, e.g., saving to localStorage using lscache
      const mappingsArray = Array.from(this.midiMappings.entries());
      lscache.set('midiMappings', mappingsArray, Constants.CACHE_EXPIRY_MINUTES);
      console.log("MIDIController: Preserved MIDI Learn mappings.");
    }
  }

  /**
   * Restores MIDI Learn mappings from storage (e.g., localStorage).
   */
  restoreMidiLearn() {
    if (Constants.preserveMidiLearn) {
      const mappingsArray = lscache.get('midiMappings');
      if (mappingsArray && Array.isArray(mappingsArray)) {
        this.midiMappings = new Map(mappingsArray);
        console.log("MIDIController: Restored MIDI Learn mappings from cache.");
      } else {
        console.warn("MIDIController: No MIDI Learn mappings found in cache.");
      }
    }
  }
}

// **Export the Singleton instance**
export const MIDIControllerInstance = new MIDIController();