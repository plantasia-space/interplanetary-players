/**
 * @file PlaybackController.js
 * @description Manages playback functionality, including button states, WaveSurfer visualization, region selection, and controlling the SoundEngine.
 * @version 1.1.0
 * @license MIT
 */

import { ButtonSingle } from './ButtonSingle.js';
import WaveSurfer from 'https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/wavesurfer.esm.js';
import RegionsPlugin from 'https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/plugins/regions.esm.js';

export class PlaybackController {
  constructor(soundEngine) {
    this.soundEngine = soundEngine;
    this.wavesurfer = null;

    console.debug('[PlaybackController] Constructor - SoundEngine:', soundEngine);

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
    console.debug('[PlaybackController] initPlaybackButtons() called.');

    this.moveButton = new ButtonSingle(
      "#playback-move",
      "/assets/icons/playback-move.svg",
      null,
      "pan-zoom",
      null,
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

    // Loop group
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
   * Fetch waveform JSON, create WaveSurfer, attach events.
   */
  async initWaveSurferPeaks() {
    console.debug('[PlaybackController] initWaveSurferPeaks() called.');
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
      const waveformContainer = document.querySelector('#waveform');
      if (!waveformContainer) {
        throw new Error("[PlaybackController] Cannot find #waveform container.");
      }

      // Retrieve styling from CSS
      const rootStyles = getComputedStyle(document.documentElement);
      const waveColor = rootStyles.getPropertyValue('--color1').trim() || "#888";
      const progressColor = rootStyles.getPropertyValue('--color2').trim() || "#555";
      const cursorColor = rootStyles.getPropertyValue('--color2').trim() || "#333";
      const waveformHeight = parseInt(rootStyles.getPropertyValue('--waveform-height')) || 120;

      console.debug('[PlaybackController] Creating WaveSurfer instance:', waveColor, progressColor, cursorColor);

      // Regions plugin
      this.regions = RegionsPlugin.create();

      // Build WaveSurfer with minPxPerSec=5 to ensure we never zoom out more than full view
      this.wavesurfer = WaveSurfer.create({
        container: waveformContainer,
        waveColor: waveColor,
        progressColor: progressColor,
        cursorColor: cursorColor,
        height: waveformHeight,
        scrollParent: true,
        minPxPerSec: 5, // NEW: ensures starting zoom won't exceed full waveform
        normalize: true,
        hideScrollbar: true,
        fillParent: true,
        barWidth: 2,
        barGap: .6,
        barRadius: 1,
        interact: true,
        plugins: [this.regions]
      });

      console.debug('[PlaybackController] Loading peaks with approximateDuration:', approximateDuration);
      // Load the waveform data
      this.wavesurfer.load(null, peaks, approximateDuration);

      // Display total duration after decoding
      const timeEl = document.getElementById('waveform-time');
      const durationEl = document.getElementById('waveform-duration');
      this.wavesurfer.on('decode', (duration) => {
        console.debug('[WaveSurfer Event] decode - duration:', duration);
        if (durationEl) {
          durationEl.textContent = this.formatTime(duration);
        }

        // NEW: Make sure we start scrolled to zero so "0:00" is on the left
        this.wavesurfer.setScroll(0);
      });

      // Update current time
      this.wavesurfer.on('timeupdate', (currentTime) => {
        if (timeEl) {
          timeEl.textContent = this.formatTime(currentTime);
        }
      });

      // Debug logs
      this.wavesurfer.on('zoom', (val) => {
        console.log(`[WaveSurfer Event] zoom => ${val}`);
      });
      this.wavesurfer.on('scroll', (visibleStartTime, visibleEndTime, scrollLeft, scrollRight) => {
        console.log(`[WaveSurfer Event] scroll => startTime=${visibleStartTime}, endTime=${visibleEndTime}, scrollLeft=${scrollLeft}, scrollRight=${scrollRight}`);
      });
      this.wavesurfer.on('interaction', (t) => {
        console.log(`[WaveSurfer Event] interaction => newTime=${t}`);
      });
      this.wavesurfer.on('click', (rx, ry) => {
        console.log(`[WaveSurfer Event] click => x=${rx}, y=${ry}`);
      });

      // Keep existing region selection & pointer-based zoom
      this.initPlaybackSelector();
      this.initZoomHandler();

      // NEW: Add region-based looping logic
      this.initLooping();

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
    console.log('[PlaybackController] Drag selection disabled.');
  }
}

/**
 * Region selection using drag.
 * Loop regions are only created when the selector tool is active.
 * Once created, a loop region persists even after disabling the selector.
 */
initPlaybackSelector() {
  console.debug('[PlaybackController] initPlaybackSelector() called.');
  const waveformContainer = document.querySelector('#waveform');
  if (!waveformContainer) {
    console.error("[PlaybackController] No #waveform container found for region selection.");
    return;
  }

  // Track the current loop region and the disable function returned by enableDragSelection.
  this.activeRegion = this.activeRegion || null;
  this.disableDragSelectionFn = null;

  // Toggle selector mode.
  this.selectorButton.clickHandler = () => {
    if (this.selectorButton.isActive) {
      console.log("[PlaybackController] Selector active: enabling drag selection and setting crosshair cursor.");
      document.body.style.cursor = "crosshair";
      // Enable drag selection if not already enabled.
      if (!this.disableDragSelectionFn) {
        this.disableDragSelectionFn = this.regions.enableDragSelection({
          color: 'rgba(215, 215, 215, 0.8)',
        });
      }
    } else {
      console.log("[PlaybackController] Selector inactive: disabling drag selection and resetting cursor.");
      document.body.style.cursor = "default";
      // Disable drag selection but do NOT remove an already created loop region.
      this.disableDragSelectionAll();
    }
  };

  // When a region is created via dragging…
  this.regions.on('region-created', (region) => {
    // Only allow region creation if the selector tool is active.
    if (!this.selectorButton.isActive) {
      region.remove();
      return;
    }
    // Enforce a single loop region: remove any previous one.
    if (this.activeRegion && this.activeRegion.id !== region.id) {
      this.activeRegion.remove();
    }
    this.activeRegion = region;
    console.log('[PlaybackController] New loop region created:', region);
  });

  // When a region is clicked, mark it as active (only if selector is active).
  this.regions.on('region-clicked', (region, e) => {
    e.stopPropagation();
    if (this.selectorButton.isActive) {
      this.activeRegion = region;
      console.log('[PlaybackController] Loop region selected:', region);
    }
  });

  // (Optional) When the user interacts on the waveform outside any region,
  // we do nothing so that the created loop remains.
}

/**
 * Zoom/pan logic with pointer-based dragging:
 * - Vertical drag => zoom in/out.
 * - Horizontal drag => scroll.
 * Also, when the move tool is activated, disable drag selection.
 */
/**
 * Zoom/pan logic with pointer-based dragging:
 * - Vertical drag => zoom in/out.
 * - Horizontal drag => scroll.
 * Also, when the move tool is activated, disable drag selection.
 */
initZoomHandler() {
  console.debug('[PlaybackController] initZoomHandler() called.');
  if (!this.wavesurfer) {
    console.error("[PlaybackController] Wavesurfer is not initialized;");
    return;
  }

  const minZoom = 5;
  const maxZoom = 3000;
  // Sensitivity: how many px/s change per vertical pixel of drag.
  const sensitivity = (maxZoom - minZoom) / 1300;
  // Maximum allowed vertical movement (in pixels) to avoid huge jumps.
  const maxDeltaY = 60; 

  let isDragging = false;
  let startX = 0, startY = 0;
  let startZoom = 0;
  let initialScroll = 0;
  let updatedScroll = 0;

  // Toggle move mode: when active, disable drag selection.
  this.moveButton.clickHandler = () => {
    // Always disable drag selection when switching to move tool.
    this.disableDragSelectionAll();

    if (this.moveButton.isActive) {
      console.log('[PlaybackController] Move active: disabling interact and setting "grab" cursor.');
      this.wavesurfer.setOptions({ interact: false });
      document.body.style.cursor = "grab";
    } else {
      console.log('[PlaybackController] Move inactive: enabling interact, resetting cursor.');
      this.wavesurfer.setOptions({ interact: true });
      document.body.style.cursor = "default";
    }
  };

  const pointerDown = (evt) => {
    if (!this.moveButton.isActive) return;
    isDragging = true;
    startX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    startY = evt.touches ? evt.touches[0].clientY : evt.clientY;
    // Use the current zoom state from WaveSurfer (or default to minZoom)
    startZoom = this.wavesurfer.params.minPxPerSec || minZoom;
    initialScroll = this.wavesurfer.getScroll() || 0;
    console.log('[pointerDown]', { startX, startY, startZoom, initialScroll });
    document.body.style.cursor = "grabbing";
    evt.preventDefault();
  };

  const pointerMove = (evt) => {
    if (!isDragging) return;
    const currentX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    const currentY = evt.touches ? evt.touches[0].clientY : evt.clientY;
    const deltaX = startX - currentX;
    let deltaY = startY - currentY;
    // Clamp the vertical drag to avoid huge zoom jumps.
    if (Math.abs(deltaY) > maxDeltaY) {
      deltaY = maxDeltaY * Math.sign(deltaY);
    }
    let newZoom = startZoom + sensitivity * deltaY;
    newZoom = Math.max(minZoom, Math.min(newZoom, maxZoom));
    this.wavesurfer.zoom(newZoom);
    updatedScroll = initialScroll + deltaX;
    this.wavesurfer.setScroll(updatedScroll);
    console.log('[pointerMove]', { deltaY, newZoom, deltaX, updatedScroll });
  };

  const pointerUp = () => {
    if (!isDragging) return;
    isDragging = false;
    this.currentScroll = updatedScroll;
    document.body.style.cursor = this.moveButton.isActive ? "grab" : "default";
    console.log('[pointerUp] Drag ended => currentScroll:', this.currentScroll);
  };

  document.addEventListener('mousedown', pointerDown);
  document.addEventListener('mousemove', pointerMove);
  document.addEventListener('mouseup', pointerUp);
  document.addEventListener('touchstart', pointerDown, { passive: false });
  document.addEventListener('touchmove', pointerMove, { passive: false });
  document.addEventListener('touchend', pointerUp);
}

  /**
   * Formats time (in seconds) => mm:ss
   */
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60) || 0;
    const secs = Math.floor(seconds % 60) || 0;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // ----------------------------------------------------------------
  // Example SoundEngine controls
  // ----------------------------------------------------------------

  play() {
    if (this.soundEngine && typeof this.soundEngine.play === 'function') {
      console.debug('[PlaybackController] play() => calling soundEngine.play()');
      this.soundEngine.play();
    } else {
      console.warn('[PlaybackController] soundEngine.play() not available.');
    }
  }
  
  pause() {
    if (this.soundEngine && typeof this.soundEngine.pause === 'function') {
      console.debug('[PlaybackController] pause() => calling soundEngine.pause()');
      this.soundEngine.pause();
    } else {
      console.warn('[PlaybackController] soundEngine.pause() not available.');
    }
  }

  setPlayRange(min = null, max = null) {
    console.debug('[PlaybackController] setPlayRange()', { min, max });
    if (this.soundEngine && typeof this.soundEngine.sendEvent === 'function') {
      if (min !== null) this.soundEngine.sendEvent("setPlayMin", [min]);
      if (max !== null) this.soundEngine.sendEvent("setPlayMax", [max]);
    }
  }

  loop() {
    console.debug('[PlaybackController] loop() => sending loop event [1]');
    if (this.soundEngine && typeof this.soundEngine.sendEvent === 'function') {
      this.soundEngine.sendEvent("loop", [1]);
    }
  }

  unloop() {
    console.debug('[PlaybackController] unloop() => sending loop event [0]');
    if (this.soundEngine && typeof this.soundEngine.sendEvent === 'function') {
      this.soundEngine.sendEvent("loop", [0]);
    }
  }
}