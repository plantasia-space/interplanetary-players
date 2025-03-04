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

    // For debug/future usage
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
      const waveformJSONURL = this.soundEngine.trackData.waveformJSONURL;
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

      const rootStyles = getComputedStyle(document.documentElement);
      const waveColor = rootStyles.getPropertyValue('--color1').trim() || "#888";
      const progressColor = rootStyles.getPropertyValue('--color2').trim() || "#555";
      const cursorColor = rootStyles.getPropertyValue('--color2').trim() || "#333";
      const waveformHeight = parseInt(rootStyles.getPropertyValue('--waveform-height')) || 120;

      console.debug('[PlaybackController] Creating WaveSurfer instance:', waveColor, progressColor, cursorColor);

      // Regions plugin
      this.regions = RegionsPlugin.create();

      // Build WaveSurfer
      this.wavesurfer = WaveSurfer.create({
        container: waveformContainer,
        waveColor: waveColor,
        progressColor: progressColor,
        cursorColor: cursorColor,
        height: waveformHeight,
        scrollParent: true,
        // The key: minPxPerSec=5 => user can see entire wave if wave is big
        minPxPerSec: 5,
        normalize: true,
        hideScrollbar: true,
        fillParent: true,
        barWidth: 2,
        barGap: 1,
        barRadius: 1,
        interact: true,
        plugins: [this.regions]
      });

      console.debug('[PlaybackController] Loading peaks with approximateDuration:', approximateDuration);
      this.wavesurfer.load(null, peaks, approximateDuration);

      // Hook up time display
      const timeEl = document.getElementById('waveform-time');
      const durationEl = document.getElementById('waveform-duration');
      this.wavesurfer.on('decode', (duration) => {
        console.debug('[WaveSurfer Event] decode - duration:', duration);
        if (durationEl) {
          durationEl.textContent = this.formatTime(duration);
        }
      });
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

      // Initialize region selection & zoom
      this.initPlaybackSelector();
      this.initZoomHandler();

      console.log("[PlaybackController] WaveSurfer and regions initialized successfully.");
    } catch (err) {
      console.error("[PlaybackController] Error in initWaveSurferPeaks():", err);
    }
  }

  /**
   * Region selection (2-click) logic
   */
  initPlaybackSelector() {
    console.debug('[PlaybackController] initPlaybackSelector() called.');
    const waveformContainer = document.querySelector('#waveform');
    if (!waveformContainer) {
      console.error("[PlaybackController] No #waveform container found for region selection.");
      return;
    }

    let isSelecting = false;
    let regionStart = null;
    let currentRegion = null;

    // Crosshair toggle
    this.selectorButton.clickHandler = () => {
      if (this.selectorButton.isActive) {
        console.log("[PlaybackController] Selector => crosshair");
        document.body.style.cursor = "crosshair";
      } else {
        console.log("[PlaybackController] Selector => default cursor");
        document.body.style.cursor = "default";
        isSelecting = false;
        regionStart = null;
      }
    };

    const getEventTime = (evt) => {
      const x = evt.touches ? evt.touches[0].clientX : evt.clientX;
      const rect = waveformContainer.getBoundingClientRect();
      const relativeX = x - rect.left;
      const duration = this.wavesurfer.getDuration();

      const time = (relativeX / rect.width) * duration;
      console.debug('[PlaybackController] getEventTime =>', time.toFixed(2));
      return time;
    };

    const handleClick = (evt) => {
      if (!this.selectorButton.isActive) {
        console.debug('[PlaybackController] Selector not active => ignoring click.');
        return;
      }

      const clickTime = getEventTime(evt);
      console.debug('[PlaybackController] handleClick => clickTime:', clickTime.toFixed(2));

      if (!isSelecting) {
        // 1st click => region start
        regionStart = clickTime;
        isSelecting = true;
        console.log('[PlaybackController] First click => regionStart:', regionStart.toFixed(2));

        if (currentRegion) {
          currentRegion.remove();
          currentRegion = null;
        }
      } else {
        // 2nd click => region end
        const regionEnd = clickTime;
        console.log('[PlaybackController] Second click => regionEnd:', regionEnd.toFixed(2));

        if (regionEnd > regionStart) {
          currentRegion = this.regions.addRegion({
            start: regionStart,
            end: regionEnd,
            color: 'rgba(255, 255, 255, 0.4)',
            drag: true,
            resize: true
          });
          console.log(`[PlaybackController] Region => ${regionStart.toFixed(2)} to ${regionEnd.toFixed(2)}`);
        } else {
          console.warn("[PlaybackController] Region end must be > start => ignoring.");
        }
        isSelecting = false;
        regionStart = null;
      }
    };

    waveformContainer.addEventListener("click", handleClick);
    waveformContainer.addEventListener("touchend", handleClick, { passive: false });
  }

  /**
   * Zoom/pan logic with pixel-based scroll
   */
  initZoomHandler() {
    console.debug('[PlaybackController] initZoomHandler() called.');
    if (!this.wavesurfer) {
      console.error("[PlaybackController] Wavesurfer is not initialized;");
      return;
    }

    // Let user zoom from 5 px/s up to 3000 px/s
    const minZoom = 5;    
    const maxZoom = 3000; 
    // We define a vertical-drag sensitivity
    const sensitivity = (maxZoom - minZoom) / 1300; 

    let isDragging = false;
    let startX = 0, startY = 0;
    let startZoom = 0;

    let initialScroll = 0;
    let updatedScroll = 0;

    // Move toggles
    this.moveButton.clickHandler = () => {
      if (this.moveButton.isActive) {
        console.log('[PlaybackController] Move => disabling interact, "grab" cursor.');
        this.wavesurfer.setOptions({ interact: false });
        document.body.style.cursor = "grab";
      } else {
        console.log('[PlaybackController] Move => enabling interact, default cursor.');
        this.wavesurfer.setOptions({ interact: true });
        document.body.style.cursor = "default";
      }
    };

    const pointerDown = (evt) => {
      if (!this.moveButton.isActive) return;
      isDragging = true;

      startX = evt.touches ? evt.touches[0].clientX : evt.clientX;
      startY = evt.touches ? evt.touches[0].clientY : evt.clientY;
      // store the wave's current minPxPerSec as baseline
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
      const deltaX = startX - currentX; // pos => left
      const deltaY = startY - currentY; // pos => up

      // 1) Zoom from vertical drag
      let newZoom = startZoom + sensitivity * deltaY;
      newZoom = Math.max(minZoom, Math.min(newZoom, maxZoom));
      this.wavesurfer.zoom(newZoom);
      console.log('[pointerMove]', { deltaY, newZoom });

      // 2) Pan from horizontal drag
      updatedScroll = initialScroll + deltaX;
      this.wavesurfer.setScroll(updatedScroll);
      console.log('[pointerMove]', { deltaX, updatedScroll });
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

  // Example SoundEngine controls:

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