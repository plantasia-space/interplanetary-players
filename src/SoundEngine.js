// SoundEngine.js

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
  constructor(soundEngineData, trackData, userManager, ksteps, rnbo) {
    if (!soundEngineData || !trackData || !userManager || !ksteps || !rnbo) {
        console.error("SoundEngine Error: Missing required data.");
        return;
    }

    this.soundEngineData = soundEngineData;
    this.trackData = trackData;
    this.userManager = userManager;
    this.ksteps = ksteps;
    this.rnbo = rnbo;  // Store RNBO object locally

    this.context = null;
    this.device = null;
    this.inputX = null;
    this.inputY = null;
    this.inputZ = null;
    this.inputGain = null;
    this.amplitude = 0;
    this.initialized = false;
}

  /**
   * Asynchronously initializes the RNBO device and loads the audio buffer.
   * This method is intended to run only once.
   */
/**
 * Asynchronously initializes the RNBO device and loads the audio buffer.
 * This method is intended to run only once.
 */
async init() {
  if (this.initialized) return;

  try {
    // 1. Fetch the patch JSON.
    const patchExportURL = this.soundEngineData.soundEngineJSONURL;
    console.log("[SoundEngine] Fetching RNBO patch from:", patchExportURL);

    // 2. Create an AudioContext (if it does not already exist).
    const WAContext = window.AudioContext || window.webkitAudioContext;
    this.context = new WAContext();

    // 3. Download and parse the patcher JSON.
    const rawPatcher = await fetch(patchExportURL);
    const patcher = await rawPatcher.json();

    // 4. Create the RNBO device and connect it to the AudioContext destination.
    this.device = await this.rnbo.createDevice({ context: this.context, patcher });
    this.device.node.connect(this.context.destination);

    // 5. Load the entire audio file (MP3/WAV) and set it on RNBO in one go.
    await this.loadAudioBuffer(); 
    // After this call, `this.totalDuration` should be set (if available).

    // 6. Retrieve RNBO parameter objects AFTER loading the audio buffer.
    this.inputX    = this.device.parametersById.get("inputX");
    this.inputY    = this.device.parametersById.get("inputY");
    this.inputZ    = this.device.parametersById.get("inputZ");
    this.inputGain = this.device.parametersById.get("inputGain");
    this.playMin   = this.device.parametersById.get("sampler/playMin");
    this.playMax   = this.device.parametersById.get("sampler/playMax");

    // 7. If your RNBO patch is a sampler, set the loop boundaries (in ms).
    //    Convert totalDuration (seconds) -> milliseconds, if totalDuration is set.
    if (this.playMin && this.playMax && this.totalDuration) {
      this.playMin.value = 0;
      this.playMax.value = this.totalDuration * 1000;
      console.log(
        `[SoundEngine] Set playMin to ${this.playMin.value}, playMax to ${this.playMax.value} ms`
      );
    }

    // 8. Subscribe to RNBO message events (e.g., amplitude updates).
    this.device.messageEvent.subscribe((ev) => {
      if (ev.tag === "amp") {
        if (typeof ev.payload === "number") {
          this.amplitude = ev.payload;
          // Optionally do something with amplitude here...
        } else {
          console.error("Unexpected payload format from 'amp' message:", ev.payload);
        }
      }
    });

    // 9. Subscribe this SoundEngine to user parameters. 
    //    We do this AFTER the RNBO parameter references exist.
    this.userManager.subscribe(this, "body-level", 1);
    this.userManager.subscribe(this, "x", 1);
    this.userManager.subscribe(this, "y", 1);
    this.userManager.subscribe(this, "z", 1);

    // 10. Mark initialization as complete.
    this.initialized = true;
    console.log("[SoundEngine] Initialized successfully.");
  } catch (error) {
    console.error("[SoundEngine] Error in init():", error);
  }
}

  
  /**
   * Loads the audio file into the RNBO device.
   * Chooses between MP3 and WAV based on network conditions.
   * @private
   */
  async loadAudioBuffer() {
    try {
      // Choose the best URL; fallback to WAV if MP3 not available
      const audioURL = this.trackData.audioFileMP3URL || this.trackData.audioFileWAVURL;
      if (!audioURL) {
        throw new Error("[SoundEngine] No audio file URL provided.");
      }
  
      console.log("[SoundEngine] Fetching audio file:", audioURL);
  
      // 1. Fetch the entire file
      const response = await fetch(audioURL, { cache: "reload" });
      if (!response.ok) {
        throw new Error(`[SoundEngine] Network response was not OK. Status: ${response.status}`);
      }
  
      // 2. Convert response to ArrayBuffer
      const arrayBuffer = await response.arrayBuffer();
      // 3. Decode the audio data into an AudioBuffer
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
  
      // 4. Set the entire buffer in RNBO
      await this.device.setDataBuffer("world1", audioBuffer);
  
      // (Optional) Store total duration for your UI or transport logic
      this.totalDuration = audioBuffer.duration;
      console.log(`[SoundEngine] Audio buffer fully loaded. Duration: ${this.totalDuration.toFixed(2)}s`);
  
    } catch (error) {
      console.error("[SoundEngine] Error loading audio buffer:", error);
    }
  }

  /**
   * Utility function for linear mapping.
   */
  map(value, in_min, in_max, out_min, out_max) {
    return ((value - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
  }

  async preloadAndSuspend() {
    try {
      // Create the audio context if it doesn’t exist
      if (!this.context) {
        const WAContext = window.AudioContext || window.webkitAudioContext;
        this.context = new WAContext();
      }
  
      await this.init();  // Ensure the RNBO device is created before loading the buffer
      await this.context.suspend();
      console.log("[SoundEngine] Audio preloaded and context suspended.");
  
    } catch (error) {
      console.error("[SoundEngine] Error during preload and suspend:", error);
    }
  }
  
  /**
   * Sends a "play" command to the RNBO device.
   * If not initialized, calls init() first.
   */
  async play() {
    try {
      if (!this.initialized) {
        await this.init();  // Ensure RNBO device and context are ready
      }
  
      if (this.context.state === "suspended") {
        await this.context.resume();  // Resume audio context on user action
        console.log("[SoundEngine] Audio context resumed.");
      }
  
      this._sendPlayEvent();  // Start playback
    } catch (error) {
      console.error("[SoundEngine] Error during play:", error);
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
    const messageEvent = new RNBO.MessageEvent(RNBO.TimeNow, "stop", [1]);
    this.device.scheduleEvent(messageEvent);    
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


  cleanUp() {
    try {
      console.log("[SoundEngine] Cleaning up resources...");
  
      // Release buffers
      const bufferDescriptions = this.device.dataBufferDescriptions;
      bufferDescriptions.forEach(async (desc) => {
        await this.device.releaseDataBuffer(desc.id);
        console.log(`[SoundEngine] Released buffer with id ${desc.id}`);
      });
  
      // Unsubscribe from RNBO events (if applicable)
      this.device.messageEvent.unsubscribe();
      console.log("[SoundEngine] Unsubscribed from RNBO events.");
  
      // Close the audio context 
      if (this.context && this.context.state !== "closed") {
        this.context.close();
        console.log("[SoundEngine] Audio context closed.");
      }
  
    } catch (error) {
      console.error("[SoundEngine] Error during clean-up:", error);
    }
  }

  
}