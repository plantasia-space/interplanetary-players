/**
 * @file PlaybackController.js
 * @description Manages the playback functionality, including button states, WaveSurfer visualization, region selection, and controlling the SoundEngine.
 * @version 1.1.0
 * @license MIT
 */

import { ButtonSingle } from './ButtonSingle.js';
import WaveSurfer from 'https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/wavesurfer.esm.js';
import RegionsPlugin from 'https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/plugins/regions.esm.js';

export class PlaybackController {
  /**
   * @param {SoundEngine} soundEngine - An instance of SoundEngine; used to access audio controls.
   */
  constructor(soundEngine) {
    this.soundEngine = soundEngine;
    
    // We'll create a new WaveSurfer instance here.
    this.wavesurfer = null;
    
    console.debug('[PlaybackController] Initialized with SoundEngine:', this.soundEngine);
    
    // Initialize playback buttons.
    this.initPlaybackButtons();
    
    // Initialize WaveSurfer visualization and region selection.
    this.initWaveSurferPeaks();
  }

  /**
   * Create and set up the four playback buttons.
   */
  initPlaybackButtons() {
    // Group #1 (moveGroup)
    this.moveButton = new ButtonSingle(
      "#playback-move",
      "/assets/icons/playback-move.svg",
      null,
      "pan-zoom",
      this.wavesurfer,
      "moveGroup",
      false
    );

    this.selectorButton = new ButtonSingle(
      "#playback-selector",
      "/assets/icons/playback-selector.svg",
      null,
      "default",
      null,
      "moveGroup",
      false
    );

    // Group #2 (loopGroup)
    this.loopButton = new ButtonSingle(
      "#playback-loop",
      "/assets/icons/playback-loop.svg",
      null,
      "default",
      null,
      "loopGroup",
      false
    );

    this.infiniteLoopButton = new ButtonSingle(
      "#playback-infinite-loop",
      "/assets/icons/playback-infinite.svg",
      null,
      "default",
      null,
      "loopGroup",
      false
    );

    console.debug('[PlaybackController] Playback buttons initialized.');
  }


  
  /**
   * Initializes WaveSurfer with the Regions Plugin and sets up region selection.
   */
  async initWaveSurferPeaks() {
    try {
      const waveformJSONURL = this.soundEngine.trackData.waveformJSONURL;
      if (!waveformJSONURL) {
        console.warn("[PlaybackController] No waveformJSONURL provided.");
        return;
      }
      
      console.log("[PlaybackController] Fetching waveform JSON from:", waveformJSONURL);
      const resp = await fetch(waveformJSONURL);
      if (!resp.ok) throw new Error(`Waveform JSON fetch failed: ${resp.status}`);
      
      const waveData = await resp.json();
      if (!waveData || !waveData.data || !Array.isArray(waveData.data)) {
        throw new Error("[PlaybackController] Invalid waveform JSON: 'data' array missing.");
      }
      
      const approximateDuration = waveData.durationSec || 120;
      const peaks = waveData.data;
      const waveformContainer = document.querySelector('#waveform');
      if (!waveformContainer) {
        throw new Error("[PlaybackController] Cannot find #waveform container.");
      }
      
      const rootStyles = getComputedStyle(document.documentElement);
      const waveColor = rootStyles.getPropertyValue('--color1').trim();
      const progressColor = rootStyles.getPropertyValue('--color2').trim();
      const cursorColor = rootStyles.getPropertyValue('--color2').trim();
      const waveformHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--waveform-height')) || 120;
      
      // Initialize Regions Plugin.
      this.regions = RegionsPlugin.create();
      
      // Create a new WaveSurfer instance.
      this.wavesurfer = WaveSurfer.create({
        container: waveformContainer,
        interact: true,
        normalize: true,
        fillParent: true,
        height: waveformHeight,
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
      
      // Set up time display.
      const timeEl = document.getElementById('waveform-time');
      const durationEl = document.getElementById('waveform-duration');
      this.wavesurfer.on('decode', (duration) => {
        durationEl.textContent = this.formatTime(duration);
      });
      this.wavesurfer.on('timeupdate', (currentTime) => {
        timeEl.textContent = this.formatTime(currentTime);
      });
      
      // Initialize dynamic region selection.
      this.initPlaybackSelector();
      
      console.log("[PlaybackController] WaveSurfer and regions initialized.");
    } catch (err) {
      console.error("[PlaybackController] Error in initWaveSurferPeaks:", err);
    }
  }
  
  /**
   * Sets up region selection using a playback selector button.
   */
  initPlaybackSelector() {
    const waveformContainer = document.querySelector('#waveform');
    if (!waveformContainer) {
      console.error("[PlaybackController] Cannot find #waveform container for region selection.");
      return;
    }
    
    let isSelectingRegion = false;
    let regionStart = null;
    
    // Create the playback selector button (ensure this element exists in your HTML).
    const playbackSelectorButton = new ButtonSingle(
      "#playback-selector-btn",
      "/icons/selector_pointer.svg",
      () => {
        if (playbackSelectorButton.isActive) {
          console.log("[PlaybackController] Region selection mode enabled.");
          waveformContainer.style.cursor = "crosshair";
        } else {
          console.log("[PlaybackController] Region selection mode disabled.");
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
        console.log(`[PlaybackController] Region start set at ${regionStart}`);
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
          console.log(`[PlaybackController] Region created: ${regionStart} - ${regionEnd}`);
        } else {
          console.warn("[PlaybackController] Invalid region: End time must be after start time.");
        }
        isSelectingRegion = false;
      }
    });
  }
  
  /**
   * Formats time (in seconds) to mm:ss.
   * @param {number} seconds
   * @returns {string}
   */
  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secondsRemainder = Math.round(seconds) % 60;
    return `${minutes}:${secondsRemainder.toString().padStart(2, '0')}`;
  }
  
  /**
   * Example method to trigger play on the SoundEngine.
   */
  play() {
    if (this.soundEngine && typeof this.soundEngine.play === 'function') {
      this.soundEngine.play();
      console.debug('[PlaybackController] Play triggered.');
    } else {
      console.warn('[PlaybackController] SoundEngine play() not available.');
    }
  }
  
  /**
   * Example method to trigger pause on the SoundEngine.
   */
  pause() {
    if (this.soundEngine && typeof this.soundEngine.pause === 'function') {
      this.soundEngine.pause();
      console.debug('[PlaybackController] Pause triggered.');
    } else {
      console.warn('[PlaybackController] SoundEngine pause() not available.');
    }
  }
    /**
   * Sets the playback range by sending updated min and max values.
   * @param {number|null} min 
   * @param {number|null} max 
   */
    setPlayRange(min = null, max = null) {
      if (this.soundEngine && typeof this.soundEngine.sendEvent === 'function') {
        if (min !== null) {
          this.soundEngine.sendEvent("setPlayMin", [min]);
          console.debug(`[PlaybackController] PlayMin set to ${min}`);
        }
        if (max !== null) {
          this.soundEngine.sendEvent("setPlayMax", [max]);
          console.debug(`[PlaybackController] PlayMax set to ${max}`);
        }
      }
    }
    
    /**
     * Enables looping by sending a "loop" event with payload 1.
     */
    loop() {
      if (this.soundEngine && typeof this.soundEngine.sendEvent === 'function') {
        this.soundEngine.sendEvent("loop", [1]);
        console.debug('[PlaybackController] Loop enabled.');
      }
    }
    
    /**
     * Disables looping by sending a "loop" event with payload 0.
     */
    unloop() {
      if (this.soundEngine && typeof this.soundEngine.sendEvent === 'function') {
        this.soundEngine.sendEvent("loop", [0]);
        console.debug('[PlaybackController] Loop disabled.');
      }
    }
  // Additional control methods (stop, loop, etc.) can be added here.
}