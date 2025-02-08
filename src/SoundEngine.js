// SoundEngine.js

// Ensure RNBO is available from the global scope
console.log("RNBO from window:", window.RNBO);
const RNBO = window.RNBO;
if (!RNBO) {
  console.error("RNBO is not defined! Make sure the RNBO script is loaded before this module.");
}

import { Constants } from './Constants.js';

export class SoundEngine {
  /**
   * Creates a SoundEngine instance.
   *
   * @param {Object} soundEngineData - Contains sound engine info (e.g., soundEngineJSONURL, soundEngineParams, etc.).
   * @param {Object} trackData - Contains track info (e.g., audioFileMP3URL, audioFileWAVURL, etc.).
   * @param {ParameterManager} userManager - The user manager instance holding root parameters.
   * @param {number} ksteps - Number of discrete steps for parameter mapping.
   */
  constructor(soundEngineData, trackData, userManager, ksteps) {
    if (!soundEngineData || !trackData || !userManager || !ksteps) {
      console.error("SoundEngine Error: Missing required data.");
      return;
    }
    this.soundEngineData = soundEngineData;
    this.trackData = trackData;
    this.userManager = userManager; // Save user manager reference
    this.ksteps = ksteps;

    // RNBO-related properties
    this.context = null;
    this.device = null;
    this.inputX = null;
    this.inputY = null;
    this.inputZ = null;
    this.inputGain = null;

    // For storing amplitude values from the RNBO device
    this.amplitude = 0;

    // Flag to mark if initialization has been completed
    this.initialized = false;
  }

  /**
   * Asynchronously initializes the RNBO device and loads the audio buffer.
   * This method is intended to run only once.
   */
  async init() {
    if (this.initialized) return;

    try {
      const patchExportURL = this.soundEngineData.soundEngineJSONURL;
      console.log("Fetching RNBO patch from:", patchExportURL);

      const WAContext = window.AudioContext || window.webkitAudioContext;
      this.context = new WAContext();

      const rawPatcher = await fetch(patchExportURL);
      const patcher = await rawPatcher.json();

      this.device = await RNBO.createDevice({ context: this.context, patcher });
      this.device.node.connect(this.context.destination);

      await this.loadAudioBuffer();

      // Retrieve RNBO parameter objects AFTER loading the audio buffer
      this.inputX = this.device.parametersById.get("inputX");
      this.inputY = this.device.parametersById.get("inputY");
      this.inputZ = this.device.parametersById.get("inputZ");
      this.inputGain = this.device.parametersById.get("inputGain");

      // Initialize spatial parameters with some default (you can adjust as needed)
      const centerValue = (this.ksteps - 1) / 2;
      this.inputX.value = this.map(
        centerValue,
        0,
        this.ksteps - 1,
        this.soundEngineData.soundEngineParams.x.min,
        this.soundEngineData.soundEngineParams.x.max
      );
      this.inputY.value = this.map(
        centerValue,
        0,
        this.ksteps - 1,
        this.soundEngineData.soundEngineParams.y.min,
        this.soundEngineData.soundEngineParams.y.max
      );
      this.inputZ.value = this.map(
        centerValue,
        0,
        this.ksteps - 1,
        this.soundEngineData.soundEngineParams.z.min,
        this.soundEngineData.soundEngineParams.z.max
      );
      // For inputGain (body-level), we set a default normalized value (e.g., 0.5)
      this.inputGain.value = 0.5;

      // Subscribe to RNBO message events (for amplitude updates, etc.)
      this.device.messageEvent.subscribe((ev) => {
        if (ev.tag === "amp") {
          if (typeof ev.payload === "number") {
            this.amplitude = ev.payload;
          } else {
            console.error("Unexpected payload format:", ev.payload);
          }
        }
      });

      // IMPORTANT: Subscribe to key user parameters AFTER the RNBO parameter objects exist.
      // For body-level we want the normalized value; for x, y, z we want the raw values.
      this.userManager.subscribe(this, "body-level", 1);
      this.userManager.subscribe(this, "x", 1);
      this.userManager.subscribe(this, "y", 1);
      this.userManager.subscribe(this, "z", 1);

      this.initialized = true;
      console.log("SoundEngine initialized successfully.");
    } catch (error) {
      console.error("Error creating RNBO:", error);
    }
  }

  /**
   * Loads the audio file into the RNBO device.
   * Chooses between MP3 and WAV based on network conditions.
   * @private
   */
  async loadAudioBuffer() {
    try {
      let audioURL;
      if (navigator.connection) {
        const speed = navigator.connection.downlink;
        audioURL =
          speed > 1
            ? this.trackData.audioFileMP3URL
            : this.trackData.audioFileWAVURL;
      } else {
        audioURL = this.trackData.audioFileMP3URL;
      }
      const fileResponse = await fetch(audioURL, { cache: "reload" });
      if (!fileResponse.ok) {
        throw new Error("Network response was not OK");
      }
      const arrayBuf = await fileResponse.arrayBuffer();
      if (!(arrayBuf instanceof ArrayBuffer)) {
        throw new Error("Fetched data is not a valid ArrayBuffer");
      }
      const audioBuf = await this.context.decodeAudioData(arrayBuf);
      await this.device.setDataBuffer("world1", audioBuf);
    } catch (error) {
      console.error("Error loading audio buffer:", error);
    }
  }

  /**
   * Utility function for linear mapping.
   */
  map(value, in_min, in_max, out_min, out_max) {
    return ((value - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
  }

  /**
   * Sends a "play" command to the RNBO device.
   * If not initialized, calls init() first.
   */
  play() {
    if (!this.initialized) {
      this.init()
        .then(() => {
          this._resumeAndPlay();
        })
        .catch(err => {
          console.error("SoundEngine: Error during initialization on play:", err);
        });
    } else {
      this._resumeAndPlay();
    }
  }

  _resumeAndPlay() {
    if (this.context.state === "suspended") {
      this.context.resume()
        .then(() => {
          this._sendPlayEvent();
        })
        .catch(err => {
          console.error("SoundEngine: Error resuming AudioContext:", err);
        });
    } else {
      this._sendPlayEvent();
    }
  }

  _sendPlayEvent() {
    try {
      const messageEvent = new RNBO.MessageEvent(RNBO.TimeNow, "play", [1]);
      this.device.scheduleEvent(messageEvent);
      console.log("SoundEngine: Play command sent.");
    } catch (err) {
      console.error("SoundEngine: Failed to schedule play event:", err);
    }
  }

  pause() {
    try {
      const messageEvent = new RNBO.MessageEvent(RNBO.TimeNow, "play", [0]);
      this.device.scheduleEvent(messageEvent);
      console.log("SoundEngine: Pause command sent.");
    } catch (err) {
      console.error("SoundEngine: Failed to schedule pause event:", err);
    }
  }

  stop() {
    this.pause();
    console.log("SoundEngine: Stop command processed.");
  }

  setVolume(volume) {
    if (volume < 0 || volume > 1) {
      console.warn("SoundEngine Warning: Volume should be between 0.0 and 1.0");
      return;
    }
    if (this.inputGain) {
      this.inputGain.value = volume;
      console.log("SoundEngine: Volume set to", volume);
    }
  }

  mute() {
    this.setVolume(0);
    console.log("SoundEngine: Muted.");
  }

  unmute() {
    this.setVolume(1);
    console.log("SoundEngine: Unmuted.");
  }

  /**
   * Callback invoked by the ParameterManager when a subscribed parameter changes.
   * For "body-level", we use the normalized value from the user manager.
   * For "x", "y", and "z", we use the raw value.
   *
   * @param {string} parameterName - The name of the parameter that changed.
   * @param {number} value - The value provided by the ParameterManager (may be ignored).
   */
  onParameterChanged(parameterName, value) {
    console.log("SoundEngine received parameter change:", parameterName, value);
    switch (parameterName) {
      case "body-level": {
        // Get the normalized value from the user manager.
        const normValue = this.userManager.getNormalizedValue("body-level");
        if (this.inputGain !== null) {
          this.inputGain.value = normValue;
          console.log("SoundEngine: Updated inputGain (body-level) to", normValue);
        } else {
          console.warn("SoundEngine: inputGain is not defined.");
        }
        break;
      }
      case "x": {
        // Get the raw value from the user manager.
        const rawValue = this.userManager.getRawValue("x");
        if (this.inputX !== null) {
          this.inputX.value = rawValue;
          console.log("SoundEngine: Updated inputX to", rawValue);
        } else {
          console.warn("SoundEngine: inputX is not defined.");
        }
        break;
      }
      case "y": {
        const rawValue = this.userManager.getRawValue("y");
        if (this.inputY !== null) {
          this.inputY.value = rawValue;
          console.log("SoundEngine: Updated inputY to", rawValue);
        } else {
          console.warn("SoundEngine: inputY is not defined.");
        }
        break;
      }
      case "z": {
        const rawValue = this.userManager.getRawValue("z");
        if (this.inputZ !== null) {
          this.inputZ.value = rawValue;
          console.log("SoundEngine: Updated inputZ to", rawValue);
        } else {
          console.warn("SoundEngine: inputZ is not defined.");
        }
        break;
      }
      default:
        console.warn("SoundEngine: Unknown parameter", parameterName);
    }
  }
}