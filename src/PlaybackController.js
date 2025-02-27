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
      
      // Initialize zoom
      this.initZoomHandler();

      console.log("[PlaybackController] WaveSurfer and regions initialized.");
    } catch (err) {
      console.error("[PlaybackController] Error in initWaveSurferPeaks:", err);
    }
  }
  
  /**
   * Sets up region selection using a playback selector button.
   */
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
  let currentRegion = null;

  // Create the playback selector button.
  const playbackSelectorButton = new ButtonSingle(
      "#playback-selector",
      "assets/icons/playback-selector.svg",
      () => {
          if (playbackSelectorButton.isActive) {
              console.log("[PlaybackController] Region selection mode enabled.");
              waveformContainer.style.cursor = "crosshair";
          } else {
              console.log("[PlaybackController] Region selection mode disabled.");
              waveformContainer.style.cursor = "default";
              isSelectingRegion = false;
              regionStart = null;
          }
      },
      "region-selection"
  );

  // Helper function to get time from event
  const getEventTime = (event) => {
      const x = event.touches ? event.touches[0].clientX : event.clientX;
      const rect = waveformContainer.getBoundingClientRect();
      const relativeX = x - rect.left;
      const duration = this.wavesurfer.getDuration();
      return (relativeX / rect.width) * duration;
  };

  // Handle click/tap
  const handleClick = (event) => {
      if (!playbackSelectorButton.isActive) return;

      const clickTime = getEventTime(event);

      if (!isSelectingRegion) {
          // First tap: set marker in
          regionStart = clickTime;
          isSelectingRegion = true;
          console.log(`[PlaybackController] Region start set at ${regionStart}`);

          // Remove existing region if present
          if (currentRegion) {
              currentRegion.remove();
              currentRegion = null;
          }
      } else {
          // Second tap: set marker out
          const regionEnd = clickTime;
          if (regionEnd > regionStart) {
              const regionColor = "rgba(255, 255, 255, 0.5)"; // White with 80% opacity
              console.log(`[PlaybackController] Creating region with color: ${regionColor}`);

              // Remove previous region before adding a new one
              if (currentRegion) {
                  currentRegion.remove();
                  currentRegion = null;
              }

              currentRegion = this.regions.addRegion({
                  start: regionStart,
                  end: regionEnd,
                  color: regionColor,
                  drag: true,
                  resize: true,
              });
              console.log(`[PlaybackController] Region created from ${regionStart} to ${regionEnd}`);
          } else {
              console.warn("[PlaybackController] Invalid region: End time must be after start time.");
          }

          // Reset selection state
          isSelectingRegion = false;
          regionStart = null;
      }
  };

  // Attach event listeners for desktop and mobile
  waveformContainer.addEventListener("click", handleClick);
  waveformContainer.addEventListener("touchend", handleClick, { passive: false });
}  

  /**
   * Enables zoom when dragging up/down while the playback move button is active.
   */
  initZoomHandler() {
    if (!this.wavesurfer) {
      console.error("[PlaybackController] Wavesurfer is not initialized.");
      return;
    }

    console.log("[PlaybackController] Native zoom initialized.");

    let isZooming = false;
    let startY = null;
    const zoomSensitivity = 0.5;
    const maxZoom = 500;
    const minZoom = 10;

    const playbackMoveButton = document.querySelector("#playback-move");

    // Get current zoom level
    const getCurrentZoom = () => this.wavesurfer.params.minPxPerSec || 100;

    // Apply zoom
    const applyZoom = (delta) => {
      let currentZoom = getCurrentZoom();
      let newZoom = Math.max(minZoom, Math.min(maxZoom, currentZoom + delta));
      console.log(`[PlaybackController] Zoom updated: ${newZoom}`);
      this.wavesurfer.zoom(newZoom);
    };

    // Start zoom detection
    const startZoom = (event) => {
      if (!playbackMoveButton.classList.contains("active")) return;
      isZooming = true;
      startY = event.touches ? event.touches[0].clientY : event.clientY;
      event.preventDefault();
    };

    // Handle zoom movement
    const handleZoom = (event) => {
      if (!isZooming || startY === null) return;

      let currentY = event.touches ? event.touches[0].clientY : event.clientY;
      let deltaY = (startY - currentY) * zoomSensitivity;

      if (Math.abs(deltaY) > 5) {
        applyZoom(deltaY);
        startY = currentY;
      }
    };

    // Stop zooming
    const stopZoom = () => {
      isZooming = false;
      startY = null;
    };

    // Attach event listeners
    const waveformContainer = document.querySelector('#waveform');
    waveformContainer.addEventListener("mousedown", startZoom);
    waveformContainer.addEventListener("mousemove", handleZoom);
    waveformContainer.addEventListener("mouseup", stopZoom);
    waveformContainer.addEventListener("mouseleave", stopZoom);

    waveformContainer.addEventListener("touchstart", startZoom, { passive: false });
    waveformContainer.addEventListener("touchmove", handleZoom, { passive: false });
    waveformContainer.addEventListener("touchend", stopZoom);
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