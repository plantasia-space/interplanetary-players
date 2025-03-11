/**
 * @file SoundEngine.js
 * @description Manages audio playback, synthesis, and processing using the RNBO library and the Web Audio API.
 * Provides functionality to initialize, play, pause, stop, loop, and update audio playback parameters.
 * @version 1.0.1
 * @license MIT
 */

import { Constants } from "./Constants.js";
import { ModeManagerInstance } from "./ModeManager.js"; // Import ModeManager

export class SoundEngine {
  constructor(soundEngineData, trackData, userManager, ksteps, rnbo) {
    if (!soundEngineData || !trackData || !userManager || !ksteps || !rnbo) {
      console.error("SoundEngine Error: Missing required data.");
      return;
    }
    
    this.playbackController = null; // Add a reference to PlaybackController
    this._isUpdatingFromUI = false;
    this.currentCursorMs = 0; 

    this.soundEngineData = soundEngineData;
    this.trackData = trackData;
    this.userManager = userManager;
    this.ksteps = ksteps;
    this.rnbo = rnbo;

    this.context = null;
    this.device = null;
    this.inputX = null;
    this.inputY = null;
    this.inputZ = null;
    this.inputGain = null;
    this.amplitude = 0;
    this.initialized = false;

    ModeManagerInstance.subscribe((newMode) => {
      this.currentMode = newMode;
      console.log(`[SoundEngine] Mode updated to: ${this.currentMode}`);
    });
    
  }

  /**
   * Allows PlaybackController to pass itself to SoundEngine.
   */
  setPlaybackController(playbackController) {
    this.playbackController = playbackController;
    console.log("[SoundEngine] Connected to PlaybackController.");
  }

  async init() {
    if (this.initialized) return;
    try {
      const patchExportURL = this.soundEngineData.soundEngineJSONURL;
      console.log("[SoundEngine] Fetching RNBO patch from:", patchExportURL);

      const WAContext = window.AudioContext || window.webkitAudioContext;
      this.context = new WAContext();

      const rawPatcher = await fetch(patchExportURL);
      const patcher = await rawPatcher.json();

      this.device = await this.rnbo.createDevice({
        context: this.context,
        patcher,
      });
      this.device.node.connect(this.context.destination);

      await this.loadAudioBuffer();

      // Retrieve RNBO parameter objects.
      this.inputX = this.device.parametersById.get("inputX");
      this.inputY = this.device.parametersById.get("inputY");
      this.inputZ = this.device.parametersById.get("inputZ");
      this.inputGain = this.device.parametersById.get("inputGain");
      this.playMin = this.device.parametersById.get("sampler/playMin");
      this.playMax = this.device.parametersById.get("sampler/playMax");

      if (this.playMin && this.playMax && this.totalDuration) {
        this.playMin.value = 0;
        this.playMax.value = this.totalDuration * 1000;
        console.log(`[SoundEngine] Set playMin to ${this.playMin.value}, playMax to ${this.playMax.value} ms`);
      }

      // Subscribe to RNBO message events.
      this.device.messageEvent.subscribe((ev) => {
        if (ev.tag === "amp") {
          if (typeof ev.payload === "number") {
            this.amplitude = ev.payload;
          } else {
            console.error("Unexpected payload format from 'amp' message:", ev.payload);
          }
        }

        // Capture cursor position from RNBO (playhead position)
        // Capture cursor position from RNBO (playhead position)
        if (this.currentMode === "PLAYBACK") {  // Check if we're in playback mode

        if (ev.tag === "playHead") {
          if (typeof ev.payload === "number") {
            this.currentCursorMs = ev.payload; 
      
            if (this.playbackController) {
              this.playbackController.setPlayHead(this.currentCursorMs);
            } else {
              console.warn("[SoundEngine] PlaybackController is not available.");
            }
          } else {
            console.error(`Unexpected payload format from '${ev.tag}' message:`, ev.payload);
          }
        }
      }
      });

      // Subscribe to user parameters.
      this.userManager.subscribe(this, "body-level", 1);
      this.userManager.subscribe(this, "x", 1);
      this.userManager.subscribe(this, "y", 1);
      this.userManager.subscribe(this, "z", 1);

      this.initialized = true;
      console.log("[SoundEngine] Initialized successfully.");
    } catch (error) {
      console.error("[SoundEngine] Error in init():", error);
    }
  }

  async loadAudioBuffer() {
    try {
      const audioURL = this.trackData.audioFileMP3URL || this.trackData.audioFileWAVURL;
      if (!audioURL) {
        throw new Error("[SoundEngine] No audio file URL provided.");
      }
      console.log("[SoundEngine] Fetching audio file:", audioURL);
      const response = await fetch(audioURL, { cache: "reload" });
      if (!response.ok) {
        throw new Error(`[SoundEngine] Network response was not OK. Status: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
      // Set the total duration (in seconds) for later calculations.
      this.totalDuration = audioBuffer.duration;
      await this.device.setDataBuffer("world1", audioBuffer);
      console.log(`[SoundEngine] Audio buffer fully loaded. Duration: ${this.totalDuration ? this.totalDuration.toFixed(2) : "unknown"}s`);
    } catch (error) {
      console.error("[SoundEngine] Error loading audio buffer:", error);
    }
  }

  async preloadAndSuspend() {
    try {
      if (!this.context) {
        const WAContext = window.AudioContext || window.webkitAudioContext;
        this.context = new WAContext();
      }
      if (!this.initialized) {
        await this.init();
      }
      if (this.context.state !== "suspended") {
        await this.context.suspend();
        console.log("[SoundEngine] Audio context suspended.");
      } else {
        console.log("[SoundEngine] Audio context was already suspended.");
      }
    } catch (error) {
      console.error("[SoundEngine] Error during preload and suspend:", error);
    }
  }




/**
 * Sets the engine's cursor position (seek mode) by updating playMin.
 * Assigns the provided millisecond value to playMin.
 */
setCursorPosition(newTimeMs) {
  if (this._isUpdatingFromUI) return;
  if (this.totalDuration) {
    if (this.playMin) {
      this.playMin.value = newTimeMs;
      console.log(`[SoundEngine] Updated playMin (cursor) to ${newTimeMs} ms`);
      
      // Force RNBO to process the parameter change
      this.device.scheduleEvent(new this.rnbo.MessageEvent(this.rnbo.TimeNow, "sampler/playMin", [newTimeMs]));
    }
    this.currentCursorMs = newTimeMs;
  }
}


  async play() {
    try {
      if (!this.initialized) {
        await this.init();
      }
      if (this.context.state === "suspended") {
        await this.context.resume();
        console.log("[SoundEngine] Audio context resumed.");
      }
      this._sendPlayEvent();
    } catch (error) {
      console.error("[SoundEngine] Error during play:", error);
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

  getAmplitude() {
    return this.amplitude;
  }



/**
 * Sets the play range in the engine.
 * If only min is provided, it updates playMin (seek mode).
 * If both min and max are provided, it updates the loop range.
 */
setPlayRange(min = null, max = null) {
  if (this.playMin && this.playMax) {
    console.log(`[SoundEngine] setPlayRange called with min=${min} ms, max=${max} ms`);

    if (min !== null) {
      this.playMin.value = Math.round(min);
      console.log(`[SoundEngine] Updated playMin to ${this.playMin.value} ms`);

      // ✅ Force RNBO to process the change
      this.device.scheduleEvent(new this.rnbo.MessageEvent(this.rnbo.TimeNow, "sampler/playMin", [this.playMin.value]));
    }

    if (max !== null) {
      this.playMax.value = Math.round(max);
      console.log(`[SoundEngine] Updated playMax to ${this.playMax.value} ms`);

      // ✅ Force RNBO to process the change
      this.device.scheduleEvent(new this.rnbo.MessageEvent(this.rnbo.TimeNow, "sampler/playMax", [this.playMax.value]));
    }
  } else {
    console.error("[SoundEngine] Cannot set play range. playMin or playMax is not defined.");
  }
}
  _sendLoopEvent(loopState) {
    try {
      const messageEvent = new RNBO.MessageEvent(RNBO.TimeNow, "loop", [loopState]);
      this.device.scheduleEvent(messageEvent);
      console.log(`[SoundEngine] Loop set to ${loopState}`);
    } catch (err) {
      console.error("[SoundEngine] Failed to schedule loop event:", err);
    }
  }

  loop() {
    this._sendLoopEvent(1);
    console.log("[SoundEngine] Looping enabled.");
  }

  unloop() {
    if (!this.playMin || !this.playMax || !this.totalDuration) {
      console.warn("[SoundEngine] Cannot unloop: playMin, playMax, or totalDuration not available.");
      return;
    }
  
    // Reset play range to the full track duration
    this.playMin.value = 0;
    this.playMax.value = this.totalDuration * 1000; // Convert seconds to milliseconds
  
    console.log(`[SoundEngine] Unlooping: Resetting play range to full track.`);
    console.log(`[SoundEngine] Updated playMin to ${this.playMin.value} ms`);
    console.log(`[SoundEngine] Updated playMax to ${this.playMax.value} ms`);
  
    // Ensure RNBO updates immediately
    this.device.scheduleEvent(new this.rnbo.MessageEvent(this.rnbo.TimeNow, "sampler/playMin", [this.playMin.value]));
    this.device.scheduleEvent(new this.rnbo.MessageEvent(this.rnbo.TimeNow, "sampler/playMax", [this.playMax.value]));
  
    // Send loop off command
    this._sendLoopEvent(0);
    console.log("[SoundEngine] Looping disabled.");
  }

  onParameterChanged(parameterName, value) {
    console.log("SoundEngine received parameter change:", parameterName, value);
    switch (parameterName) {
      case "body-level": {
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
      const bufferDescriptions = this.device.dataBufferDescriptions;
      bufferDescriptions.forEach(async (desc) => {
        await this.device.releaseDataBuffer(desc.id);
        console.log(`[SoundEngine] Released buffer with id ${desc.id}`);
      });
      this.device.messageEvent.unsubscribe();
      console.log("[SoundEngine] Unsubscribed from RNBO events.");
      if (this.context && this.context.state !== "closed") {
        this.context.close();
        console.log("[SoundEngine] Audio context closed.");
      }
    } catch (error) {
      console.error("[SoundEngine] Error during clean-up:", error);
    }
  }
}