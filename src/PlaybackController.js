/**
 * @file PlaybackController.js
 * @description Manages playback functionality, including button states, WaveSurfer visualization, region selection, 
 * and controlling the SoundEngine. Supports both loop mode (min and max) and seek mode (cursor).
 * @version 1.1.0
 * @license MIT
 */

import { ButtonSingle } from "./ButtonSingle.js";
import WaveSurfer from "https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/wavesurfer.esm.js";
import RegionsPlugin from "https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/plugins/regions.esm.js";

export class PlaybackController {
  constructor(soundEngine) {
    this.soundEngine = soundEngine;
    this.wavesurfer = null;
    this._isUpdatingFromEngine = false;

    console.debug("[PlaybackController] Constructor - SoundEngine:", soundEngine);

    // Pass PlaybackController reference to SoundEngine
    if (this.soundEngine) {
      this.soundEngine.setPlaybackController(this);
    }

    // Initialize WaveSurfer + events
    this.initWaveSurferPeaks();

    // Keep track of current scroll offset
    this.currentScroll = 0;
  }




  /**
   * Updates the region visual state based on whether loop mode is active.
   */
  setRegionLoopVisualState() {
    if (!this.activeRegion) {
      console.warn("[PlaybackController] No active region to update");
      return;
    }
    const isLooping = this.loopButton.isActive;
    const newColor = isLooping
      ? "rgba(215, 215, 215, 0.8)" // Loop active (visible)
      : "rgba(0, 0, 0, 0.0)";       // Loop inactive (hidden)
    this.activeRegion.element.style.backgroundColor = newColor;
    this.activeRegion.element.style.transition = "background-color 0.3s";
    console.log(`[PlaybackController] Set region element color directly to: ${newColor}`);
  }

  /**
   * Fetch waveform JSON, create WaveSurfer, and attach events.
   */
  async initWaveSurferPeaks() {
    console.debug("[PlaybackController] initWaveSurferPeaks() called.");
    try {
      const waveformJSONURL = this.soundEngine?.trackData?.waveformJSONURL;
      if (!waveformJSONURL) {
        console.warn("[PlaybackController] No waveformJSONURL provided.");
        return;
      }
      console.log("[PlaybackController] Fetching waveform JSON from:", waveformJSONURL);
      const resp = await fetch(waveformJSONURL);
      if (!resp.ok) {
        throw new Error(`Waveform JSON fetch failed: ${resp.status}`);
      }
      const waveData = await resp.json();
      if (!waveData || !waveData.data || !Array.isArray(waveData.data)) {
        throw new Error("[PlaybackController] Invalid waveform JSON: 'data' array missing.");
      }
      const approximateDuration = (waveData.length * waveData.samples_per_pixel) / waveData.sample_rate;      
      const peaks = waveData.data;
      const waveformContainer = document.querySelector("#waveform");
      if (!waveformContainer) {
        throw new Error("[PlaybackController] Cannot find #waveform container.");
      }

      // Retrieve styling from CSS
      const rootStyles = getComputedStyle(document.documentElement);
      const waveColor = rootStyles.getPropertyValue("--color1").trim() || "#888";
      const progressColor = rootStyles.getPropertyValue("--color2").trim() || "#555";
      const cursorColor = rootStyles.getPropertyValue("--color2").trim() || "#333";
      const waveformHeight = parseInt(rootStyles.getPropertyValue("--waveform-height")) || 120;

      console.debug("[PlaybackController] Creating WaveSurfer instance:", waveColor, progressColor, cursorColor);

      // Regions plugin for loop selection
      this.regions = RegionsPlugin.create();

      // Build WaveSurfer with fixed minPxPerSec (1) so that the full waveform fits by default.
      this.wavesurfer = WaveSurfer.create({
        container: waveformContainer,
        waveColor: waveColor,
        progressColor: progressColor,
        cursorColor: cursorColor,
        height: waveformHeight,
        scrollParent: true,
        minPxPerSec: 1,
        normalize: true,
        hideScrollbar: false,
        fillParent: true,
        barWidth: 2,
        barGap: 0.6,
        barRadius: 1,
        interact: true,
        plugins: [this.regions],
      });

      console.debug("[PlaybackController] Loading peaks with approximateDuration:", approximateDuration);
      // Load the waveform data.
      this.wavesurfer.load(null, peaks, approximateDuration);

      // After decoding, ensure default zoom and reset scroll.
      const timeEl = document.getElementById("waveform-time");
      this.wavesurfer.on("decode", (duration) => {

        this.wavesurfer.zoom(1);
        this.wavesurfer.setScroll(0);
        console.log(`[PlaybackController] Initial zoom set to 1 for duration ${duration}s`);
      });

      // Update current time display.
      this.wavesurfer.on("timeupdate", (currentTime) => {
        if (timeEl) {
          timeEl.textContent = this.formatTime(currentTime);
        }
      });

      // Maintain default zoom on container resize.
      const resizeObserver = new ResizeObserver(() => {
        if (!this.wavesurfer) return;
        this.wavesurfer.zoom(1);
        console.log("[PlaybackController] Resize observed, maintaining zoom at 1");
      });
      resizeObserver.observe(waveformContainer);

      this.wavesurfer.on("interaction", (newTime) => {
        if (!this.soundEngine) {
          console.warn("[PlaybackController] SoundEngine is not available.");
          return;
        }
      
        const newTimeMs = Math.round(newTime * 1000);
        console.log(`[PlaybackController] User clicked at ${newTimeMs} ms`);
      
        // Prevent SoundEngine from overriding our manual seek
        this.soundEngine._isUpdatingFromUI = true;
      
        if (this.soundEngine.isPlaying()) {
          // ─────────────────────────────────────────────────
          // CASE A: Playing => "jump-to-end" workaround
          // ─────────────────────────────────────────────────
          this.doPlayingSeek(newTimeMs);
      
        } else if (this.soundEngine.playState === "paused") {
          // ─────────────────────────────────────────────────
          // CASE B: Paused => short "play→pause" trick
          // ─────────────────────────────────────────────────
          this.doPausedSeek(newTimeMs);
      
        } else {
          // ─────────────────────────────────────────────────
          // CASE C: Stopped => direct set is usually enough
          // ─────────────────────────────────────────────────
          this.doStoppedSeek(newTimeMs);
        }
      });


      this.wavesurfer.on("click", (rx, ry) => {
        console.log(`[WaveSurfer Event] click => x=${rx}, y=${ry}`);
      });

      // Initialize region selection and zoom handler.
      this.initPlaybackSelector();
      this.initZoomHandler();

      console.log("[PlaybackController] WaveSurfer and regions initialized successfully.");
    } catch (err) {
      console.error("[PlaybackController] Error in initWaveSurferPeaks():", err);
    }
  }

  /**
   * Helper: disable drag selection if active.
   */
  disableDragSelectionAll() {
    if (this.disableDragSelectionFn) {
      this.disableDragSelectionFn();
      this.disableDragSelectionFn = null;
      console.log("[PlaybackController] Drag selection disabled.");
    }
  }


  doPlayingSeek(newTimeMs) {
    this.soundEngine.setPlayRange(
      this.soundEngine.totalDuration * 1000,
      this.soundEngine.totalDuration * 1000
    );
  
    setTimeout(() => {
      this.soundEngine.setPlayRange(
        newTimeMs,
        this.soundEngine.totalDuration * 1000
      );
      this.soundEngine.loop();
  
      setTimeout(() => {
        this.soundEngine.unloop();
        this.soundEngine.loop();
        this.soundEngine.setPlayRange(0, this.soundEngine.totalDuration * 1000);
  
        // Force WaveSurfer UI cursor to newTime
        this.setPlayHead(newTimeMs);
  
        this.soundEngine._isUpdatingFromUI = false;
      }, 100);
    }, 50);
  }
  doPausedSeek(newTimeMs) {
    // 1) Stop just to clear any leftover constraints or loops
    this.soundEngine.stop();
  
    // 2) Set new range so RNBO knows "start reading from newTimeMs"
    this.soundEngine.setPlayRange(
      newTimeMs,
      this.soundEngine.totalDuration * 1000
    );
  
    // 3) Kick RNBO into "play" for 100ms so it actually *moves* pointer
    this.soundEngine.play();
    setTimeout(() => {
      // 4) Return to "pause" immediately
      this.soundEngine.pause();
  
      // 5) WaveSurfer cursor to newTimeMs 
      this.setPlayHead(newTimeMs);
  
      this.soundEngine._isUpdatingFromUI = false;
    }, 1);
  }


  doStoppedSeek(newTimeMs) {
    // Just set newTime → end
    this.soundEngine.setPlayRange(
      newTimeMs,
      this.soundEngine.totalDuration * 1000
    );
  
    // Visually place the WaveSurfer cursor
    this.setPlayHead(newTimeMs);
  
    setTimeout(() => {
      this.soundEngine._isUpdatingFromUI = false;
    }, 50);
  }
  
  /**
   * Region selection using drag.
   */
/**
 * Region selection using drag.
 */
initPlaybackSelector() {
  console.debug("[PlaybackController] Initializing default playback selector behavior.");

  const waveformContainer = document.querySelector("#waveform");
  if (!waveformContainer) {
    console.error("[PlaybackController] No #waveform container found for region selection.");
    return;
  }

  this.activeRegion = null;
  this.isLooping = false; // New flag for loop state

  // Enable drag selection **without** requiring a button click
  this.disableDragSelectionFn = this.regions.enableDragSelection({ color: "rgba(215, 215, 215, 0.8)" });

  // Ensure cursor updates
  waveformContainer.style.cursor = "crosshair";

  // ✅ Ensure only one region exists at a time
  this.regions.on("region-created", (region) => {
    if (this.activeRegion) {
      this.activeRegion.remove(); // Remove previous selection
    }
  
    this.activeRegion = region;
    this.isLooping = true; // ✅ Enable loop immediately
  
    console.log(`[PlaybackController] Default loop region created: start=${region.start}, end=${region.end}`);
  
    // ✅ Ensure region is visually active and looping
    this.setRegionLoopState(region, this.isLooping);
    this.updateSoundEngineLoop(this.isLooping, region.start, region.end);
  });

  // ✅ Update loop when the user adjusts the region
  this.regions.on("region-updated", (region) => {
    if (!this.activeRegion || this.activeRegion.id !== region.id) {
      return;
    }

    console.log(`[PlaybackController] Loop region updated: start=${region.start}s, end=${region.end}s`);
    this.updateSoundEngineLoopRange(region.start, region.end);
  });

  // ✅ Toggle loop mode when clicking on a region
  this.regions.on("region-clicked", (region, e) => {
    e.stopPropagation();
    this.activeRegion = region;
    this.isLooping = !this.isLooping; // Toggle loop state

    console.log(`[PlaybackController] Loop mode ${this.isLooping ? "activated" : "deactivated"} for region.`);
    
    // Update region color and SoundEngine loop state
    this.setRegionLoopState(region, this.isLooping);
    this.updateSoundEngineLoop(this.isLooping, region.start, region.end);
  });

  
  // ✅ Remove loop when clicking outside the region
  waveformContainer.addEventListener("click", (event) => {
    if (!event.target.closest(".wavesurfer-region")) {
      if (this.activeRegion) {
        console.log("[PlaybackController] Loop region removed.");
        this.soundEngine.unloop();
        this.activeRegion.remove();
        this.activeRegion = null;
      }
    }
  });

  console.log("[PlaybackController] Default region selection enabled.");
}
/**
 * Updates the region visual state based on loop activation.
 * @param {object} region - The WaveSurfer region object.
 * @param {boolean} isLooping - Whether looping is active.
 */
setRegionLoopState(region, isLooping) {
  const newColor = isLooping
    ? "rgba(215, 215, 215, 0.8)" // Loop active (visible)
    : "rgba(0, 0, 0, 0.0)";      // Loop inactive (hidden)

  region.element.style.backgroundColor = newColor;
  region.element.style.transition = "background-color 0.3s";

  console.log(`[PlaybackController] Region color updated: ${newColor}`);
}

/**
 * Sends loop state to the SoundEngine.
 * @param {boolean} isLooping - Whether looping is active.
 * @param {number} startSec - Start time in seconds.
 * @param {number} endSec - End time in seconds.
 */
updateSoundEngineLoop(isLooping, startSec, endSec) {
  if (!this.soundEngine) {
    console.warn("[PlaybackController] SoundEngine not available.");
    return;
  }

  if (isLooping) {
    console.log(`[PlaybackController] Activating loop: ${startSec}s - ${endSec}s`);
    this.soundEngine.setPlayRange(startSec * 1000, endSec * 1000);
    this.soundEngine.loop();

  } else {
    console.log("[PlaybackController] Deactivating loop.");
    this.soundEngine.unloop();
  }
}

/**
   * Zoom-only logic with pointer-based dragging.
   */
  initZoomHandler() {
    console.debug("[PlaybackController] Initializing zoom slider control.");
  
    if (!this.wavesurfer) {
      console.error("[PlaybackController] Wavesurfer is not initialized.");
      return;
    }
  
    const zoomSlider = document.querySelector("#zoomSliderHorz");
    if (!zoomSlider) {
      console.error("[PlaybackController] No #zoomSliderHorz found.");
      return;
    }
  
    // Define min/max zoom levels
    const minZoom = 1;
    const maxZoom = 600;
  
    // Helper function to map 0-100 range to 1-3000
    const mapSliderToZoom = (sliderValue) => {
      return minZoom + (sliderValue / 100) * (maxZoom - minZoom);
    };
  
    // When the user interacts with the slider, update zoom
    zoomSlider.addEventListener("input", (event) => {
      const sliderValue = parseFloat(event.target.value);
      const zoomValue = mapSliderToZoom(sliderValue);
  
      console.log(`[PlaybackController] Zoom Slider changed: ${sliderValue} → Zoom: ${zoomValue}`);
      this.wavesurfer.zoom(zoomValue);
    });
  
    // Set initial slider value based on WaveSurfer's default zoom
    zoomSlider.value = 0; // Start at 0 (which maps to minZoom = 1)
  }
  /**
   * Formats time (in seconds) => mm:ss
   */
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60) || 0;
    const secs = Math.floor(seconds % 60) || 0;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  // ----------------------------------------------------------------
  // Cursor and Play Range Communication with SoundEngine
  // ----------------------------------------------------------------

  /**
   * Returns the current cursor position as a ms value (0 to 1)
   */
  getCursorPosition() {
    if (this.wavesurfer) {
      const currentTime = this.wavesurfer.getCurrentTime();
      const duration = this.wavesurfer.getDuration();
      const normValue = duration > 0 ? currentTime / duration : 0;
      console.log(`[PlaybackController] getCursorPosition: ${normValue}`);
      return normValue;
    }
    return 0;
  }



  /**
   * When the user selects a loop region (providing both a min and max),
   * update the SoundEngine with both values (in ms) and set the cursor to the loop start.
   * This is used in "loop" mode.
   */
  updateSoundEngineLoopRange(startSec, endSec) {
    if (!this.wavesurfer || !this.soundEngine) return;
  
    // 🔹 Ensure values are in milliseconds
    const startMs = Math.round(startSec * 1000);
    const endMs = Math.round(endSec * 1000);
  
    console.log(`[PlaybackController] Updating SoundEngine loop range:`);
    console.log(`    Start Time (seconds): ${startSec}s`);
    console.log(`    End Time (seconds): ${endSec}s`);
    console.log(`    Converted Start (ms): ${startMs} ms`);
    console.log(`    Converted End (ms): ${endMs} ms`);
  
    // 🔹 Update active region first
    if (this.activeRegion) {
      this.activeRegion.start = startSec;
      this.activeRegion.end = endSec;
    }
  
    // 🔹 Send to SoundEngine
    this.soundEngine.setPlayRange(startMs, endMs);
  }


/**
 * Sets WaveSurfer's cursor position based on the ms value.
 */
setPlayHead(msValue) {
  if (typeof msValue === "number" && this.wavesurfer) {
      const duration = this.wavesurfer.getDuration(); // Get duration in seconds
      if (duration > 0) {
          const normalizedValue = msValue / (duration * 1000); // Convert ms to a normalized value (0–1)
          this.wavesurfer.seekTo(normalizedValue);
      } else {
          console.warn("[PlaybackController] Cannot set playhead, duration is not available.");
      }
  }
}

  // ----------------------------------------------------------------
  // Basic Playback Controls
  // ----------------------------------------------------------------

  play() {
    if (this.soundEngine && typeof this.soundEngine.play === "function") {
      console.debug("[PlaybackController] play() => calling soundEngine.play()");
      this.soundEngine.play();
    } else {
      console.warn("[PlaybackController] soundEngine.play() not available.");
    }
  }

  pause() {
    if (this.soundEngine && typeof this.soundEngine.pause === "function") {
      console.debug("[PlaybackController] pause() => calling soundEngine.pause()");
      this.soundEngine.pause();
    } else {
      console.warn("[PlaybackController] soundEngine.pause() not available.");
    }
  }


}