/**
 * @file SoundEngine.js
 * @description Manages audio playback, synthesis, and processing using the RNBO library and the Web Audio API.
 * Provides functionality to initialize, play, pause, stop, loop, and update audio playback parameters.
 * @version 1.0.0
 * @author …
 * @license MIT
 * @memberof AudioEngine
 */

import { Constants } from './Constants.js';
import WaveSurfer from 'https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/wavesurfer.esm.js';
import RegionsPlugin from 'https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/plugins/regions.esm.js';



/* -------------------------------------------
   SoundEngine Class
   ------------------------------------------- */
export class SoundEngine {
  constructor(soundEngineData, trackData, userManager, ksteps, rnbo) {
    if (!soundEngineData || !trackData || !userManager || !ksteps || !rnbo) {
      console.error("SoundEngine Error: Missing required data.");
      return;
    }

    this.soundEngineData = soundEngineData;
    this.trackData = trackData;
    this.userManager = userManager;
    this.ksteps = ksteps;
    this.rnbo = rnbo; // Store RNBO object locally

    this.context = null;
    this.device = null;
    this.inputX = null;
    this.inputY = null;
    this.inputZ = null;
    this.inputGain = null;
    this.amplitude = 0;
    this.initialized = false;

    // Store the Regions Plugin instance and WaveSurfer instance
    this.regions = null;
    this.wavesurfer = null;
  }

  async init() {
    if (this.initialized) return;
    try {
      // 1. Fetch the patch JSON.
      const patchExportURL = this.soundEngineData.soundEngineJSONURL;
      console.log("[SoundEngine] Fetching RNBO patch from:", patchExportURL);

      // 2. Create an AudioContext.
      const WAContext = window.AudioContext || window.webkitAudioContext;
      this.context = new WAContext();

      // 3. Download and parse the patcher JSON.
      const rawPatcher = await fetch(patchExportURL);
      const patcher = await rawPatcher.json();

      // 4. Create the RNBO device and connect it.
      this.device = await this.rnbo.createDevice({ context: this.context, patcher });
      this.device.node.connect(this.context.destination);

      // 5. Load the entire audio file.
      await this.loadAudioBuffer();

      // 6. Retrieve RNBO parameter objects.
      this.inputX = this.device.parametersById.get("inputX");
      this.inputY = this.device.parametersById.get("inputY");
      this.inputZ = this.device.parametersById.get("inputZ");
      this.inputGain = this.device.parametersById.get("inputGain");
      this.playMin = this.device.parametersById.get("sampler/playMin");
      this.playMax = this.device.parametersById.get("sampler/playMax");

      // 7. Set loop boundaries if applicable.
      if (this.playMin && this.playMax && this.totalDuration) {
        this.playMin.value = 0;
        this.playMax.value = this.totalDuration * 1000;
        console.log(`[SoundEngine] Set playMin to ${this.playMin.value}, playMax to ${this.playMax.value} ms`);
      }

      // 8. Subscribe to RNBO message events.
      this.device.messageEvent.subscribe((ev) => {
        if (ev.tag === "amp") {
          if (typeof ev.payload === "number") {
            this.amplitude = ev.payload;
          } else {
            console.error("Unexpected payload format from 'amp' message:", ev.payload);
          }
        }
      });

      // 9. Subscribe to user parameters.
      this.userManager.subscribe(this, "body-level", 1);
      this.userManager.subscribe(this, "x", 1);
      this.userManager.subscribe(this, "y", 1);
      this.userManager.subscribe(this, "z", 1);

      // 10. Mark initialization as complete.
      this.initialized = true;
      console.log("[SoundEngine] Initialized successfully.");

      // Initialize WaveSurfer with precomputed peaks.
      await this.initWaveSurferPeaks();

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
      await this.device.setDataBuffer("world1", audioBuffer);
      console.log(`[SoundEngine] Audio buffer fully loaded. Duration: ${this.totalDuration ? this.totalDuration.toFixed(2) : "unknown"}s`);
    } catch (error) {
      console.error("[SoundEngine] Error loading audio buffer:", error);
    }
  }

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
      const approximateDuration = waveData.durationSec || 120;
      const peaks = waveData.data;
      const waveformContainer = document.querySelector('#waveform');
      if (!waveformContainer) {
        throw new Error("[WaveSurfer] Cannot find #waveform container in the DOM.");
      }
      const rootStyles = getComputedStyle(document.documentElement);
      const waveColor = rootStyles.getPropertyValue('--color1').trim();
      const progressColor = rootStyles.getPropertyValue('--color2').trim();
      const cursorColor = rootStyles.getPropertyValue('--color2').trim();
      const waveformHeight = getComputedStyle(document.documentElement).getPropertyValue('--waveform-height');
      
      // Initialize the Regions Plugin and assign it to this.regions.
      this.regions = RegionsPlugin.create();
      
      // Create the WaveSurfer instance with the Regions Plugin.
      this.wavesurfer = WaveSurfer.create({
        container: waveformContainer,
        interact: true,
        normalize: true,
        fillParent: true,
        height: parseInt(waveformHeight) || 120,
        barWidth: 2,
        barGap: 1,
        barRadius: 1,
        waveColor: waveColor,
        progressColor: progressColor,
        cursorColor: cursorColor,
        plugins: [this.regions]
      });
      
      // Load the precomputed waveform peaks.
      this.wavesurfer.load(null, peaks, approximateDuration);
      
      // Time display logic.
      const timeEl = document.getElementById('waveform-time');
      const durationEl = document.getElementById('waveform-duration');
      this.wavesurfer.on('decode', (duration) => {
        durationEl.textContent = this.formatTime(duration);
      });
      this.wavesurfer.on('timeupdate', (currentTime) => {
        timeEl.textContent = this.formatTime(currentTime);
      });
      
      // Hover effect.
      const hoverEl = document.getElementById('waveform-hover');
      waveformContainer.addEventListener('pointermove', (e) => {
        hoverEl.style.width = `${e.offsetX}px`;
      });
      
      // Initialize dynamic region selection via the playback selector button.
      this.initPlaybackSelector();
      
      console.log("[WaveSurfer] initWaveSurferPeaks completed.");
    } catch (err) {
      console.error("[WaveSurfer] Error in initWaveSurferPeaks:", err);
    }
  }

  initPlaybackSelector() {
    const waveformContainer = document.querySelector('#waveform');
    if (!waveformContainer) {
      console.error("[WaveSurfer] Cannot find #waveform container.");
      return;
    }
    let isSelectingRegion = false;
    let regionStart = null;
    
    // Create the playback selector button.
    const playbackSelectorButton = new PlaybackController(
      "#playback-selector-btn",            // Ensure your HTML includes a button with this ID.
      "/icons/selector_pointer.svg",        // Replace with your actual SVG path.
      () => {
        const isActive = playbackSelectorButton.isActive;
        if (isActive) {
          console.log("[WaveSurfer] Region selection mode enabled.");
          waveformContainer.style.cursor = "crosshair";
        } else {
          console.log("[WaveSurfer] Region selection mode disabled.");
          waveformContainer.style.cursor = "default";
        }
      },
      "region-selection"
    );
    
    // Listen for clicks on the waveform when region selection is active.
    waveformContainer.addEventListener("click", (event) => {
      if (!playbackSelectorButton.isActive) return;
      const clickTime = this.wavesurfer.getCurrentTime();
      if (!isSelectingRegion) {
        regionStart = clickTime;
        console.log(`[WaveSurfer] Region start set at ${regionStart}`);
        isSelectingRegion = true;
      } else {
        const regionEnd = clickTime;
        if (regionEnd > regionStart) {
          this.regions.addRegion({
            start: regionStart,
            end: regionEnd,
            color: "rgba(255, 0, 0, 0.3)",
            drag: true,
            resize: true,
          });
          console.log(`[WaveSurfer] Region created: ${regionStart} - ${regionEnd}`);
        } else {
          console.warn("[WaveSurfer] Invalid region: End time must be after start time.");
        }
        isSelectingRegion = false;
      }
    });
  }

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secondsRemainder = Math.round(seconds) % 60;
    return `${minutes}:${secondsRemainder.toString().padStart(2, '0')}`;
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