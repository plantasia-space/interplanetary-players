/**
 * @file Orbiter.js
 * @description Manages audio playback, synthesis, and processing using the RNBO library and the Web Audio API.
 * Provides functionality to initialize, play, pause, stop, loop, and update audio playback parameters.
 * @version 1.0.1
 * @license MIT
 */

import { Constants, setPlaybackState } from "./Constants.js";
import { ModeManagerInstance } from "./ModeManager.js"; // Import ModeManager

export class Orbiter {
  constructor(orbiterData, trackData, userManager, ksteps, rnbo) {
    if (!orbiterData || !trackData || !userManager || !ksteps || !rnbo) {
      console.error("Orbiter Error: Missing required data.");
      return;
    }
    
    this.playbackController = null; // Add a reference to PlaybackController
    this._isUpdatingFromUI = false;
    this.currentCursorMs = 0; 

    this.orbiterData = orbiterData;
    this.trackData = trackData;
    this.userManager = userManager;
    this.ksteps = ksteps;
    this.rnbo = rnbo;
    this.playState = "stopped"; // could be "playing", "paused", or "stopped"
    setPlaybackState("stopped"); // Initialize global state

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
      //console.log(`[Orbiter] Mode updated to: ${this.currentMode}`);
    });
    Constants.setLoadingState("orbiterLoaded", false);

  }

  /**
   * Allows PlaybackController to pass itself to Orbiter.
   */
  setPlaybackController(playbackController) {
    this.playbackController = playbackController;
    //console.log("[Orbiter] Connected to PlaybackController.");
  }

  async init() {
    if (this.initialized) return;
    try {
      const patchExportURL = this.orbiterData.orbiterJSONURL;
      //console.log("[Orbiter] Fetching RNBO patch from:", patchExportURL);

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
        //console.log(`[Orbiter] Set playMin to ${this.playMin.value}, playMax to ${this.playMax.value} ms`);
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
        
                // **Check if we are currently in a manual seek operation**
                if (!this._isUpdatingFromUI) {
                    if (this.playbackController) {
                        this.playbackController.setPlayHead(this.currentCursorMs);
                    } else {
                        console.warn("[Orbiter] PlaybackController is not available.");
                    }
                } else {
                    //console.log("[Orbiter] Ignoring playHead update due to manual user seek.");
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
      //console.log("[Orbiter] Initialized successfully.");
          // Track initialization completion
    Constants.setLoadingState("orbiterLoaded", true);


    } catch (error) {
      console.error("[Orbiter] Error in init():", error);
    }
  }

  async loadAudioBuffer() {
    try {
      const audioURL = this.trackData.audioFileMP3URL || this.trackData.audioFileWAVURL;
      if (!audioURL) {
        throw new Error("[Orbiter] No audio file URL provided.");
      }
      //console.log("[Orbiter] Fetching audio file:", audioURL);
      const response = await fetch(audioURL, { cache: "reload" });
      if (!response.ok) {
        throw new Error(`[Orbiter] Network response was not OK. Status: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
      // Set the total duration (in seconds) for later calculations.
      this.totalDuration = audioBuffer.duration;
      await this.device.setDataBuffer("world1", audioBuffer);
    } catch (error) {
      console.error("[Orbiter] Error loading audio buffer:", error);
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
        //console.log("[Orbiter] Audio context suspended.");
      } else {
        //console.log("[Orbiter] Audio context was already suspended.");
      }
    } catch (error) {
      console.error("[Orbiter] Error during preload and suspend:", error);
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
      //console.log(`[Orbiter] Updated playMin (cursor) to ${newTimeMs} ms`);
      
      // Force RNBO to process the parameter change
      this.device.scheduleEvent(new this.rnbo.MessageEvent(this.rnbo.TimeNow, "sampler/playMin", [newTimeMs]));
    }
    this.currentCursorMs = newTimeMs;
  }
}




  _sendPlayEvent() {
    try {
      const messageEvent = new RNBO.MessageEvent(RNBO.TimeNow, "play", [1]);
      this.device.scheduleEvent(messageEvent);
      //console.log("Orbiter: Play command sent.");
    } catch (err) {
      console.error("Orbiter: Failed to schedule play event:", err);
    }
  }

  /**
   * Returns true if the engine is currently playing.
   */
  isPlaying() {
    return this.playState === "playing";
  }

  async play() {
    try {
      if (!this.initialized) {
        await this.init();
      }
      if (this.context.state === "suspended") {
        await this.context.resume();
        //console.log("[Orbiter] Audio context resumed.");
      }
      this._sendPlayEvent();
      this.playState = "playing"; // <--- Update state
      setPlaybackState("playing"); // Update global state

    } catch (error) {
      console.error("[Orbiter] Error during play:", error);
    }
  }

  pause() {
    try {
      const messageEvent = new RNBO.MessageEvent(RNBO.TimeNow, "play", [0]);
      this.device.scheduleEvent(messageEvent);
      this.playState = "paused"; // <--- Update state
      setPlaybackState("paused"); // Update global state

      //console.log("[Orbiter] Pause command sent.");
    } catch (err) {
      console.error("[Orbiter] Failed to schedule pause event:", err);
    }
  }

  stop() {
    // 1) Send RNBO "stop" event
    const messageEvent = new RNBO.MessageEvent(RNBO.TimeNow, "stop", [1]);
    this.device.scheduleEvent(messageEvent);
  
    // 2) Force our local sampler range to 0 → end
    if (this.playMin && this.playMax && this.totalDuration) {
      this.playMin.value = 0;
      this.playMax.value = Math.round(this.totalDuration * 1000);
      // Force RNBO to accept it right now
      this.device.scheduleEvent(new RNBO.MessageEvent(RNBO.TimeNow, "sampler/playMin", [0]));
      this.device.scheduleEvent(new RNBO.MessageEvent(RNBO.TimeNow, "sampler/playMax", [this.playMax.value]));
  
      // Also keep track of local cursor
      this.currentCursorMs = 0;
    }
  
    // 3) Mark engine state
    this.playState = "stopped";
    setPlaybackState("stopped"); // Update global state

    //console.log("[Orbiter] Stop command processed, sampler reset to 0.");
  }

  setVolume(volume) {
    if (volume < 0 || volume > 1) {
      console.warn("Orbiter Warning: Volume should be between 0.0 and 1.0");
      return;
    }
    if (this.inputGain) {
      this.inputGain.value = volume;
      //console.log("Orbiter: Volume set to", volume);
    }
  }

  getAmplitude() {
    return this.amplitude;
  }

  _forcePlayState(value) {
    // value=1 or 0
    try {
      const msg = new RNBO.MessageEvent(RNBO.TimeNow, "play", [value]);
      this.device.scheduleEvent(msg);
      //console.log(`[Orbiter] Nudging RNBO with play=${value} (no local state change)`);
    } catch (err) {
      console.error("[Orbiter] _forcePlayState error:", err);
    }
  }


/**
 * Sets the play range in the engine.
 */
setPlayRange(min = null, max = null, isFromUI = false) {
  if (this.playMin && this.playMax) {
      //console.log(`[Orbiter] setPlayRange called with min=${min} ms, max=${max} ms`);

      if (isFromUI) {
          //console.log("[Orbiter] Preventing loop: User-set play range.");
          this._isUpdatingFromUI = true;
      } else {
          //console.log("[Orbiter] Preventing loop: Engine-set play range.");
          this._isUpdatingFromEngine = true;
      }

      if (min !== null) {
          this.playMin.value = Math.round(min);
          this.device.scheduleEvent(new this.rnbo.MessageEvent(this.rnbo.TimeNow, "sampler/playMin", [this.playMin.value]));
      }

      if (max !== null) {
          this.playMax.value = Math.round(max);
          this.device.scheduleEvent(new this.rnbo.MessageEvent(this.rnbo.TimeNow, "sampler/playMax", [this.playMax.value]));
      }

      // **Reset flags after a delay**
      setTimeout(() => {
          this._isUpdatingFromUI = false;
          this._isUpdatingFromEngine = false;
      }, 100);
  } else {
      console.error("[Orbiter] Cannot set play range. playMin or playMax is not defined.");
  }
}
  _sendLoopEvent(loopState) {
    try {
      const messageEvent = new RNBO.MessageEvent(RNBO.TimeNow, "loop", [loopState]);
      this.device.scheduleEvent(messageEvent);
      //console.log(`[Orbiter] Loop set to ${loopState}`);
    } catch (err) {
      console.error("[Orbiter] Failed to schedule loop event:", err);
    }
  }

  loop() {
    this._sendLoopEvent(1);
    //console.log("[Orbiter] Looping enabled.");
  }

  unloop() {
    if (!this.playMin || !this.playMax || !this.totalDuration) {
      console.warn("[Orbiter] Cannot unloop: playMin, playMax, or totalDuration not available.");
      return;
    }
  
    // Reset play range to the full track duration
    this.playMin.value = 0;
    this.playMax.value = this.totalDuration * 1000; // Convert seconds to milliseconds
  
    //console.log(`[Orbiter] Unlooping: Resetting play range to full track.`);
    //console.log(`[Orbiter] Updated playMin to ${this.playMin.value} ms`);
    //console.log(`[Orbiter] Updated playMax to ${this.playMax.value} ms`);
  
    // Ensure RNBO updates immediately
    this.device.scheduleEvent(new this.rnbo.MessageEvent(this.rnbo.TimeNow, "sampler/playMin", [this.playMin.value]));
    this.device.scheduleEvent(new this.rnbo.MessageEvent(this.rnbo.TimeNow, "sampler/playMax", [this.playMax.value]));
  
    // Send loop off command
    this._sendLoopEvent(0);
    //console.log("[Orbiter] Looping disabled.");
  }

  onParameterChanged(parameterName, value) {
    switch (parameterName) {
      case "body-level": {
        const normValue = this.userManager.getNormalizedValue("body-level");
        if (this.inputGain !== null) {
          this.inputGain.value = normValue;
        } else {
          console.warn("Orbiter: inputGain is not defined.");
        }
        break;
      }
      case "x": {
        const rawValue = this.userManager.getRawValue("x");
        if (this.inputX !== null) {
          this.inputX.value = rawValue;
        } else {
          console.warn("Orbiter: inputX is not defined.");
        }
        break;
      }
      case "y": {
        const rawValue = this.userManager.getRawValue("y");
        if (this.inputY !== null) {
          this.inputY.value = rawValue;
        } else {
          console.warn("Orbiter: inputY is not defined.");
        }
        break;
      }
      case "z": {
        const rawValue = this.userManager.getRawValue("z");
        if (this.inputZ !== null) {
          this.inputZ.value = rawValue;
        } else {
          console.warn("Orbiter: inputZ is not defined.");
        }
        break;
      }
      default:
        console.warn("Orbiter: Unknown parameter", parameterName);
    }
  }

  cleanUp() {
    try {
      //console.log("[Orbiter] Cleaning up resources...");
      const bufferDescriptions = this.device.dataBufferDescriptions;
      bufferDescriptions.forEach(async (desc) => {
        await this.device.releaseDataBuffer(desc.id);
        //console.log(`[Orbiter] Released buffer with id ${desc.id}`);
      });
      this.device.messageEvent.unsubscribe();
      //console.log("[Orbiter] Unsubscribed from RNBO events.");
      if (this.context && this.context.state !== "closed") {
        this.context.close();
        //console.log("[Orbiter] Audio context closed.");
      }
    } catch (error) {
      console.error("[Orbiter] Error during clean-up:", error);
    }
  }
}