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
  async init() {
    if (this.initialized) return;
  
    try {
      const patchExportURL = this.soundEngineData.soundEngineJSONURL;
      console.log("Fetching RNBO patch from:", patchExportURL);
  
      const WAContext = window.AudioContext || window.webkitAudioContext;
      this.context = new WAContext();
  
      const rawPatcher = await fetch(patchExportURL);
      const patcher = await rawPatcher.json();
  
      this.device = await this.rnbo.createDevice({ context: this.context, patcher });
      this.device.node.connect(this.context.destination);
  
      // Load and stream the audio buffer, while accumulating the total duration.
      await this.loadAudioBuffer();
  
      // Retrieve RNBO parameter objects AFTER loading the audio buffer
      this.inputX = this.device.parametersById.get("inputX");
      this.inputY = this.device.parametersById.get("inputY");
      this.inputZ = this.device.parametersById.get("inputZ");
      this.inputGain = this.device.parametersById.get("inputGain");
      this.playMin = this.device.parametersById.get("sampler/playMin");
      this.playMax = this.device.parametersById.get("sampler/playMax");
  
      // Set the play loop parameters based on the loaded buffer
      this.playMin.value = 0;
      // Convert totalDuration (in seconds) to milliseconds:
      this.playMax.value = this.totalDuration * 1000;
      console.log(`[SoundEngine] Set playMin to ${this.playMin.value} and playMax to ${this.playMax.value} ms`);
  
      // (Optional) You might want to also update these as more chunks are appended if you expect the buffer to grow over time.
  
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
  
      // Subscribe to key user parameters AFTER the RNBO parameter objects exist.
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
      const audioURL = this.trackData.audioFileMP3URL || this.trackData.audioFileWAVURL;
      const response = await fetch(audioURL);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
  
      await this.device.setDataBuffer("world1", audioBuffer);
      this.totalDuration = audioBuffer.duration;
      console.log("[SoundEngine] Full audio buffer loaded.");
  
      this._sendPlayEvent();
    } catch (error) {
      console.error("[SoundEngine] Error loading full buffer:", error);
    }
  }
  async appendToRNBOBuffer(newBuffer) {
    try {
        const sampleRate = newBuffer.sampleRate;
        const numChannels = newBuffer.numberOfChannels; // Dynamically detect the number of channels

        // Initialize the merged buffer if it's the first chunk
        if (!this.mergedBuffers) {
            this.mergedBuffers = Array.from({ length: numChannels }, () => []);
            this.mergedSampleRate = sampleRate;
        }

        // Append the new data to the appropriate channel buffers
        for (let channel = 0; channel < numChannels; channel++) {
            const newChannelData = newBuffer.getChannelData(channel);
            this.mergedBuffers[channel].push(newChannelData);
        }

        // Merge and concatenate buffers for each channel
        const mergedChannels = this.mergedBuffers.map((channelData) => {
          return channelData.reduce((merged, chunk) => {
            const newBuffer = new Float32Array(merged.length + chunk.length);
            newBuffer.set(merged);
            newBuffer.set(chunk, merged.length);
            return newBuffer;
          }, new Float32Array());
        });

        // Create a new AudioBuffer with the correct number of channels and sample rate
        const mergedAudioBuffer = this.context.createBuffer(
            numChannels,
            mergedChannels[0].length, // Assuming all channels have the same length
            this.mergedSampleRate
        );

        // Copy the merged data into the respective channels of the AudioBuffer
        for (let channel = 0; channel < numChannels; channel++) {
            mergedAudioBuffer.copyToChannel(mergedChannels[channel], channel);
        }

        // Set the updated AudioBuffer to RNBO
        await this.device.setDataBuffer("world1", mergedAudioBuffer);
        console.log("[SoundEngine] RNBO buffer extended with new chunk.");

    } catch (error) {
        console.error("[SoundEngine] Error appending to RNBO buffer:", error);
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