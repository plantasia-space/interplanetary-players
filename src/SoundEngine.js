/**
 * @file SoundEngine.js
 * @description Manages audio playback, synthesis, and processing using the RNBO library and the Web Audio API.
 * Provides functionality to initialize, play, pause, stop, loop, and update audio playback parameters.
 * @version 1.0.0
 * @author 𝐵𝓇𝓊𝓃𝒶 𝒢𝓊𝒶𝓇𝓃𝒾𝑒𝓇𝒾 
 * @license MIT
 * @memberof AudioEngine
 */

import { Constants } from './Constants.js';
import WaveSurfer from 'https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/wavesurfer.esm.js';

/**
 * @class SoundEngine
 * @memberof AudioEngine
 * @classdesc Encapsulates the logic for initializing and controlling audio playback using RNBO.
 */
export class SoundEngine {
  /**
   * Creates a SoundEngine instance.
   *
   * @param {Object} soundEngineData - Contains sound engine info (e.g., soundEngineJSONURL, soundEngineParams, etc.).
   * @param {Object} trackData - Contains track info (e.g., audioFileMP3URL, audioFileWAVURL, etc.).
   * @param {ParameterManager} userManager - The user manager instance holding root parameters.
   * @param {number} ksteps - Number of discrete steps for parameter mapping.
   * @param {Object} rnbo - The RNBO library object used to create and manage the audio device.
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
   *
   * @async
   * @function init
   * @memberof SoundEngine
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

      // 7. If the RNBO patch is a sampler, set the loop boundaries (in ms).
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

      await this.initWaveSurferPeaks();


    } catch (error) {
      console.error("[SoundEngine] Error in init():", error);
    }
  }

  /**
   * Loads the audio file into the RNBO device.
   * Chooses between MP3 and WAV based on network conditions.
   *
   * @async
   * @function loadAudioBuffer
   * @private
   * @memberof SoundEngine
   */
  async loadAudioBuffer() {
    try {
      // Choose the best URL; fallback to WAV if MP3 not available.
      const audioURL = this.trackData.audioFileMP3URL || this.trackData.audioFileWAVURL;
      if (!audioURL) {
        throw new Error("[SoundEngine] No audio file URL provided.");
      }

      console.log("[SoundEngine] Fetching audio file:", audioURL);

      // 1. Fetch the entire file.
      const response = await fetch(audioURL, { cache: "reload" });
      if (!response.ok) {
        throw new Error(`[SoundEngine] Network response was not OK. Status: ${response.status}`);
      }

      // 2. Convert response to ArrayBuffer.
      const arrayBuffer = await response.arrayBuffer();
      // 3. Decode the audio data into an AudioBuffer.
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);

      // 4. Set the entire buffer in RNBO.
      await this.device.setDataBuffer("world1", audioBuffer);

      console.log(`[SoundEngine] Audio buffer fully loaded. Duration: ${this.totalDuration.toFixed(2)}s`);
    } catch (error) {
      console.error("[SoundEngine] Error loading audio buffer:", error);
    }
  }

    /**
   * The "Simplest Approach" for WaveSurfer: use precomputed JSON peaks.
   * 1) We fetch trackData.waveformJSONURL
   * 2) Create wavesurfer with no actual audio loading
   * 3) Use wavesurfer.load(null, precomputedPeaks, duration)
   * 4) Manually sync playback position from RNBO in a requestAnimationFrame loop
   */
    async initWaveSurferPeaks() {
      try {
          if (!this.trackData.waveformJSONURL) {
              console.warn("[WaveSurfer] No waveformJSONURL found in trackData. Skipping peaks approach.");
              return;
          }
  
          console.log("[WaveSurfer] Fetching waveform JSON:", this.trackData.waveformJSONURL);
          const resp = await fetch(this.trackData.waveformJSONURL);
          if (!resp.ok) throw new Error(`Waveform JSON fetch failed: ${resp.status}`);
  
          const waveData = await resp.json();
  
          if (!waveData || !waveData.data || !Array.isArray(waveData.data)) {
              throw new Error("[WaveSurfer] Invalid waveform JSON format: 'data' array is missing.");
          }
  
          const approximateDuration = waveData.durationSec || 120; // Fallback to 120s if missing
          const peaks = waveData.data; // Use 'data' from JSON
  
          // Ensure we have a valid waveform container in the DOM
          const waveformContainer = document.querySelector('#waveform');
          if (!waveformContainer) {
              throw new Error("[WaveSurfer] Cannot find #waveform container in the DOM.");
          }
  
          // Get CSS variables from the root element
          const rootStyles = getComputedStyle(document.documentElement);
          const waveColor = rootStyles.getPropertyValue('--color1').trim();
          const progressColor = rootStyles.getPropertyValue('--color2').trim();
          const cursorColor = rootStyles.getPropertyValue('--color2').trim();
          const waveformHeight = getComputedStyle(document.documentElement).getPropertyValue('--waveform-height');
  
          // 2) Create WaveSurfer instance (SoundCloud-style)
          this.wavesurfer = WaveSurfer.create({
              container: waveformContainer,
              interact: true,
              normalize: true,
              fillParent: true,
              height: parseInt(waveformHeight) || 120,
              barWidth: 2, // SoundCloud-style bars
              barGap: 1,
              barRadius: 1,
              waveColor: waveColor,
              progressColor: progressColor,
              cursorColor: cursorColor
          });
  
          // 3) Load the waveform peaks data (no audio file)
          this.wavesurfer.load(null, peaks, approximateDuration);
  
          // 4) Time display logic
          const timeEl = document.getElementById('waveform-time');
          const durationEl = document.getElementById('waveform-duration');
  
          this.wavesurfer.on('decode', (duration) => {
              durationEl.textContent = this.formatTime(duration);
          });
  
          this.wavesurfer.on('timeupdate', (currentTime) => {
              timeEl.textContent = this.formatTime(currentTime);
          });
  
          // 5) Hover effect
          const hoverEl = document.getElementById('waveform-hover');
          waveformContainer.addEventListener('pointermove', (e) => {
              hoverEl.style.width = `${e.offsetX}px`;
          });
  
          console.log("[WaveSurfer] initWaveSurferPeaks completed.");
      } catch (err) {
          console.error("[WaveSurfer] Error in initWaveSurferPeaks:", err);
      }
  }
  
  /**
   * Formats time from seconds to MM:SS.
   */
  formatTime(seconds) {
      const minutes = Math.floor(seconds / 60);
      const secondsRemainder = Math.round(seconds) % 60;
      return `${minutes}:${secondsRemainder.toString().padStart(2, '0')}`;
  }    
/**
   * Preloads the audio by initializing the device and then suspends the AudioContext.
   *
   * @async
   * @function preloadAndSuspend
   * @memberof SoundEngine
   */
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
   * Sends a "play" command to the RNBO device.
   * If not initialized, calls init() first.
   *
   * @async
   * @function play
   * @memberof SoundEngine
   */
  async play() {
    try {
      if (!this.initialized) {
        await this.init();  // Ensure RNBO device and context are ready.
      }

      if (this.context.state === "suspended") {
        await this.context.resume();  // Resume audio context on user action.
        console.log("[SoundEngine] Audio context resumed.");
      }

      this._sendPlayEvent();  // Start playback.
    } catch (error) {
      console.error("[SoundEngine] Error during play:", error);
    }
  }

  /**
   * Sends the play event command to the RNBO device.
   *
   * @function _sendPlayEvent
   * @private
   * @memberof SoundEngine
   */
  _sendPlayEvent() {
    try {
      const messageEvent = new RNBO.MessageEvent(RNBO.TimeNow, "play", [1]);
      this.device.scheduleEvent(messageEvent);
      console.log("SoundEngine: Play command sent.");
    } catch (err) {
      console.error("SoundEngine: Failed to schedule play event:", err);
    }
  }

  /**
   * Sends a "pause" command to the RNBO device.
   *
   * @function pause
   * @memberof SoundEngine
   */
  pause() {
    try {
      const messageEvent = new RNBO.MessageEvent(RNBO.TimeNow, "play", [0]);
      this.device.scheduleEvent(messageEvent);
      console.log("SoundEngine: Pause command sent.");
    } catch (err) {
      console.error("SoundEngine: Failed to schedule pause event:", err);
    }
  }

  /**
   * Sends a "stop" command to the RNBO device.
   *
   * @function stop
   * @memberof SoundEngine
   */
  stop() {
    const messageEvent = new RNBO.MessageEvent(RNBO.TimeNow, "stop", [1]);
    this.device.scheduleEvent(messageEvent);
    console.log("SoundEngine: Stop command processed.");
  }

  /**
   * Sets the volume of the audio playback.
   *
   * @function setVolume
   * @memberof SoundEngine
   * @param {number} volume - The desired volume level (between 0.0 and 1.0).
   */
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

  /**
   * Getter for the amplitude parameter.
   * Allows access to real-time amplitude data for visualization.
   *
   * @function getAmplitude
   * @memberof SoundEngine
   * @returns {number} The latest amplitude value.
   */
  getAmplitude() {
    return this.amplitude;
  }

  /**
   * Retrieves the current playMin and playMax values.
   *
   * @function getPlayRange
   * @memberof SoundEngine
   * @returns {Object|null} An object with playMin and playMax values or null if not defined.
   */
  getPlayRange() {
    if (this.playMin && this.playMax) {
      return {
        playMin: this.playMin.value,
        playMax: this.playMax.value
      };
    } else {
      console.warn("[SoundEngine] PlayMin or PlayMax is not defined.");
      return null;
    }
  }

  /**
   * Sets the playMin and/or playMax values dynamically.
   * If only one parameter is provided, the other remains unchanged.
   *
   * @function setPlayRange
   * @memberof SoundEngine
   * @param {number} [min=null] - The minimum play position (in milliseconds), optional.
   * @param {number} [max=null] - The maximum play position (in milliseconds), optional.
   */
  setPlayRange(min = null, max = null) {
    if (this.playMin && this.playMax) {
      if (min !== null) {
        this.playMin.value = min;
        console.log(`[SoundEngine] Updated playMin: ${min}`);
      }
      if (max !== null) {
        this.playMax.value = max;
        console.log(`[SoundEngine] Updated playMax: ${max}`);
      }
    } else {
      console.error("[SoundEngine] Cannot set play range. PlayMin or PlayMax is not defined.");
    }
  }

  /**
   * Sends a "loop" command to the RNBO device.
   *
   * @function _sendLoopEvent
   * @private
   * @memberof SoundEngine
   * @param {number} loopState - 1 to enable looping, 0 to disable looping.
   */
  _sendLoopEvent(loopState) {
    try {
      const messageEvent = new RNBO.MessageEvent(RNBO.TimeNow, "loop", [loopState]);
      this.device.scheduleEvent(messageEvent);
      console.log(`[SoundEngine] Loop set to ${loopState}`);
    } catch (err) {
      console.error("[SoundEngine] Failed to schedule loop event:", err);
    }
  }

  /**
   * Enables looping of the audio file.
   *
   * @function loop
   * @memberof SoundEngine
   */
  loop() {
    this._sendLoopEvent(1);
    console.log("[SoundEngine] Looping enabled.");
  }

  /**
   * Disables looping of the audio file.
   *
   * @function unloop
   * @memberof SoundEngine
   */
  unloop() {
    this._sendLoopEvent(0);
    console.log("[SoundEngine] Looping disabled.");
  }

  /**
   * Callback invoked by the ParameterManager when a subscribed parameter changes.
   * For "body-level", uses the normalized value; for "x", "y", and "z", uses the raw value.
   *
   * @function onParameterChanged
   * @memberof SoundEngine
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

  /**
   * Cleans up resources by releasing buffers, unsubscribing from events, and closing the AudioContext.
   *
   * @function cleanUp
   * @memberof SoundEngine
   */
  cleanUp() {
    try {
      console.log("[SoundEngine] Cleaning up resources...");

      // Release buffers.
      const bufferDescriptions = this.device.dataBufferDescriptions;
      bufferDescriptions.forEach(async (desc) => {
        await this.device.releaseDataBuffer(desc.id);
        console.log(`[SoundEngine] Released buffer with id ${desc.id}`);
      });

      // Unsubscribe from RNBO events (if applicable).
      this.device.messageEvent.unsubscribe();
      console.log("[SoundEngine] Unsubscribed from RNBO events.");

      // Close the audio context.
      if (this.context && this.context.state !== "closed") {
        this.context.close();
        console.log("[SoundEngine] Audio context closed.");
      }
    } catch (error) {
      console.error("[SoundEngine] Error during clean-up:", error);
    }
  }
}



// NEW SYMBOLS -> pan_tool.svg // text_select_start // infinite.svg // normal loop