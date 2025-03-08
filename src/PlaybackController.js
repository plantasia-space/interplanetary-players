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

    // Initialize the buttons
    this.initPlaybackButtons();

    // Initialize WaveSurfer + events
    this.initWaveSurferPeaks();

    // Keep track of current scroll offset
    this.currentScroll = 0;
  }

  /**
   * Create and set up your buttons.
   */
  initPlaybackButtons() {
    this.zoomButton = new ButtonSingle(
      "#playback-zoom",
      "/assets/icons/playback-zoom.svg",
      null,
      "pan-zoom",
      null,
      "moveGroup",
      false,
    );

    this.selectorButton = new ButtonSingle(
      "#playback-selector",
      "/assets/icons/playback-selector.svg",
      null,
      "default",
      null,
      "moveGroup",
      false,
    );

    // Loop group button: toggles loop mode and sets the visual state.
    this.loopButton = new ButtonSingle(
      "#playback-loop",
      "/assets/icons/playback-loop.svg",
      () => {
        console.log("[PlaybackController] Loop button clicked");
        this.setRegionLoopVisualState();

        if (this.soundEngine) {
          if (this.loopButton.isActive) {
            this.soundEngine.loop();
          } else {
            this.soundEngine.unloop();
          }
        } else {
          console.warn("[PlaybackController] SoundEngine not available.");
        }
      },
      "default",
      null,
      "loopGroup",
      false,
    );
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
      const approximateDuration = waveData.durationSec || 120;
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

      // Debug logging for interactions.
      this.wavesurfer.on("zoom", (val) => {
        console.log(`[WaveSurfer Event] zoom => ${val}`);
      });
      this.wavesurfer.on("scroll", (start, end, scrollLeft, scrollRight) => {
        console.log(`[WaveSurfer Event] scroll => startTime=${start}, endTime=${end}, scrollLeft=${scrollLeft}, scrollRight=${scrollRight}`);
      });
      this.wavesurfer.on("interaction", (newTime) => {
        console.log(`[WaveSurfer Event] interaction => newTime=${newTime}`);
/*         this.soundEngine.setCursorPosition(newTime);
 */    });
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

  /**
   * Region selection using drag.
   */
/**
 * Region selection using drag.
 */
initPlaybackSelector() {
  console.debug("[PlaybackController] initPlaybackSelector() called.");
  const waveformContainer = document.querySelector("#waveform");
  if (!waveformContainer) {
    console.error("[PlaybackController] No #waveform container found for region selection.");
    return;
  }

  this.activeRegion = null;
  this.disableDragSelectionFn = null;

  const updateCursor = () => {
    waveformContainer.style.cursor = this.selectorButton.isActive ? "crosshair" : "default";
  };

  this.selectorButton.clickHandler = () => {
    if (this.selectorButton.isActive) {
      console.log("[PlaybackController] Selector active: enabling drag selection.");
      if (!this.disableDragSelectionFn) {
        this.disableDragSelectionFn = this.regions.enableDragSelection({ color: "rgba(215, 215, 215, 0.8)" });
      }
    } else {
      console.log("[PlaybackController] Selector inactive: disabling drag selection.");
      this.disableDragSelectionAll();
    }
    updateCursor();
  };

  waveformContainer.addEventListener("mousemove", (e) => {
    waveformContainer.style.cursor = this.selectorButton.isActive
      ? (e.target.closest(".wavesurfer-region") ? "move" : "crosshair")
      : "default";
  });

  // ✅ Ensure only one region exists at a time
  this.regions.on("region-created", (region) => {
    if (!this.selectorButton.isActive) {
      region.remove();
      return;
    }

    if (this.activeRegion) {
      this.activeRegion.remove();
    }

    this.activeRegion = region;
    const color = this.loopButton.isActive ? "rgba(215, 215, 215, 0.8)" : "rgba(0, 0, 0, 0.0)";
    this.activeRegion.element.style.backgroundColor = color;
    this.activeRegion.element.style.transition = "background-color 0.3s";
    console.log(`[PlaybackController] New loop region created: start=${region.start}, end=${region.end}`);
    this.updateSoundEngineLoopRange(region.start, region.end);

  });

// ✅ Send loop start and end times in SECONDS after the user finishes adjusting
this.regions.on("region-updated", (region) => {
  if (!this.activeRegion || this.activeRegion.id !== region.id) {
    return;
  }

  console.log(`[PlaybackController] Loop region updated: start=${region.start}s, end=${region.end}s`);

  // Pass region start and end in seconds (converted to milliseconds inside the function)
  this.updateSoundEngineLoopRange(region.start, region.end);
});

  // ✅ Allow the user to select the region and change loop settings
  this.regions.on("region-clicked", (region, e) => {
    e.stopPropagation();
    if (this.selectorButton.isActive) {
      this.activeRegion = region;
      console.log("[PlaybackController] Loop region selected:", region);
    }
  });

  // ✅ Remove loop when clicking outside the region
  this.regions.on("region-updated", (region) => {
    if (!this.activeRegion || this.activeRegion.id !== region.id) {
      return;
    }
  
    console.log(`[PlaybackController] Loop region updated:`);
    console.log(`    Start (seconds): ${region.start}s`);
    console.log(`    End (seconds): ${region.end}s`);
  
    // 🔹 Pass values in seconds to be converted in `updateSoundEngineLoopRange`
    this.updateSoundEngineLoopRange(region.start, region.end);
  });
}
  /**
   * Zoom-only logic with pointer-based dragging.
   */
  initZoomHandler() {
    console.debug("[PlaybackController] initZoomHandler() called.");
    if (!this.wavesurfer) {
      console.error("[PlaybackController] Wavesurfer is not initialized;");
      return;
    }
    const waveformContainer = document.querySelector("#waveform");
    if (!waveformContainer) {
      console.error("[PlaybackController] No #waveform container found.");
      return;
    }
    const minZoom = 1;
    const maxZoom = 3000;
    const sensitivity = (maxZoom - minZoom) / 1300;
    const maxDeltaY = 60;
    let isDragging = false;
    let startX = 0, startY = 0, startZoom = 0;
    const updateCursor = () => {
      waveformContainer.style.cursor = this.zoomButton.isActive
        ? (isDragging ? "grabbing" : "grab")
        : "default";
    };
    this.zoomButton.clickHandler = () => {
      this.disableDragSelectionAll();
      if (this.zoomButton.isActive) {
        console.log("[PlaybackController] Zoom active: disabling waveform interaction.");
        this.wavesurfer.setOptions({ interact: false });
      } else {
        console.log("[PlaybackController] Zoom inactive: enabling waveform interaction.");
        this.wavesurfer.setOptions({ interact: true });
      }
      updateCursor();
    };
    const pointerDown = (evt) => {
      if (!this.zoomButton.isActive) return;
      isDragging = true;
      startX = evt.touches ? evt.touches[0].clientX : evt.clientX;
      startY = evt.touches ? evt.touches[0].clientY : evt.clientY;
      startZoom = this.wavesurfer.params.minPxPerSec || minZoom;
      waveformContainer.style.cursor = "grabbing";
      evt.preventDefault();
    };
    const pointerMove = (evt) => {
      if (!isDragging) return;
      const currentY = evt.touches ? evt.touches[0].clientY : evt.clientY;
      const deltaY = startY - currentY;
      let clampedDeltaY = Math.max(-maxDeltaY, Math.min(maxDeltaY, deltaY));
      let newZoom = startZoom + sensitivity * clampedDeltaY;
      this.wavesurfer.zoom(Math.max(minZoom, Math.min(maxZoom, newZoom)));
    };
    const pointerUp = () => {
      if (!isDragging) return;
      isDragging = false;
      updateCursor();
    };
    waveformContainer.addEventListener("mousedown", pointerDown);
    document.addEventListener("mousemove", pointerMove);
    document.addEventListener("mouseup", pointerUp);
    waveformContainer.addEventListener("touchstart", pointerDown, { passive: false });
    waveformContainer.addEventListener("touchmove", pointerMove, { passive: false });
    waveformContainer.addEventListener("touchend", pointerUp);
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