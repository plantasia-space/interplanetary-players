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

    // Initialize buttons
    this.initPlaybackButtons();

    // Initialize WaveSurfer and attach event listeners
    this.initWaveSurferPeaks();
    // Después de inicializar wavesurfer en initWaveSurferPeaks()
    this.currentScroll = 0;
  }

  /**
   * Create and set up playback buttons.
   */
  initPlaybackButtons() {
    console.debug('[PlaybackController] initPlaybackButtons() called.');

    // Move button (pan/zoom)
    this.moveButton = new ButtonSingle(
      "#playback-move",
      "/assets/icons/playback-move.svg",
      null, // clickHandler se define en initZoomHandler()
      "pan-zoom",
      null,
      "moveGroup",
      false
    );

    // Selector button (for region selection)
    this.selectorButton = new ButtonSingle(
      "#playback-selector",
      "/assets/icons/playback-selector.svg",
      null, // se define en initPlaybackSelector()
      "default",
      null,
      "moveGroup",
      false
    );

    // Loop group buttons
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
   * Fetch waveform JSON, create WaveSurfer instance, and attach events.
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

      // Obtener valores de CSS y definir vista inicial:
      const rootStyles = getComputedStyle(document.documentElement);
      const waveColor = rootStyles.getPropertyValue('--color1').trim() || "#888";
      const progressColor = rootStyles.getPropertyValue('--color2').trim() || "#555";
      const cursorColor = rootStyles.getPropertyValue('--color2').trim() || "#333";
      const waveformHeight = parseInt(rootStyles.getPropertyValue('--waveform-height')) || 120;

      console.debug('[PlaybackController] Creating WaveSurfer instance with colors:', waveColor, progressColor, cursorColor);

      // Preparar plugin Regions
      this.regions = RegionsPlugin.create();

      // Crear WaveSurfer con scrollParent activado y minPxPerSec configurado en 5 (vista completa)
      this.wavesurfer = WaveSurfer.create({
        container: waveformContainer,
        waveColor: waveColor,
        progressColor: progressColor,
        cursorColor: cursorColor,
        height: waveformHeight,
        scrollParent: true,
        minPxPerSec: 5, // Vista completa inicial (mínimo zoom)
        normalize: true,
        hideScrollbar: true, // Ocultamos la barra, pero se controla mediante API
        fillParent: true,
        barWidth: 2,
        barGap: 1,
        barRadius: 1,
        interact: true, // Comportamiento normal al cargar
        plugins: [this.regions]
      });

      console.debug('[PlaybackController] Loading peaks with approximateDuration:', approximateDuration);
      this.wavesurfer.load(null, peaks, approximateDuration);

      // Eventos para mostrar tiempo
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

      // Escuchamos eventos para depuración
      this.wavesurfer.on('zoom', (minPxPerSec) => {
        console.log(`[WaveSurfer Event] zoom: minPxPerSec = ${minPxPerSec}`);
      });
      this.wavesurfer.on('scroll', (visibleStartTime, visibleEndTime, scrollLeft, scrollRight) => {
        console.log(`[WaveSurfer Event] scroll: visibleStartTime=${visibleStartTime}, visibleEndTime=${visibleEndTime}, scrollLeft=${scrollLeft}, scrollRight=${scrollRight}`);
      });
      this.wavesurfer.on('interaction', (newTime) => {
        console.log(`[WaveSurfer Event] interaction: newTime=${newTime}`);
      });
      this.wavesurfer.on('click', (relativeX, relativeY) => {
        console.log(`[WaveSurfer Event] click: relativeX=${relativeX}, relativeY=${relativeY}`);
      });

      // Inicializar selección de regiones y zoom/pan
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

    // Click handler for the actual button
    this.selectorButton.clickHandler = () => {
      if (this.selectorButton.isActive) {
        console.log("[PlaybackController] Selector button activated. Crosshair cursor ON.");
        document.body.style.cursor = "crosshair";
      } else {
        console.log("[PlaybackController] Selector button deactivated. Cursor back to default.");
        document.body.style.cursor = "default";
        isSelecting = false;
        regionStart = null;
      }
    };

    // Helper: convert a click position to time in the waveform
    const getEventTime = (evt) => {
      const x = evt.touches ? evt.touches[0].clientX : evt.clientX;
      const rect = waveformContainer.getBoundingClientRect();
      const relativeX = x - rect.left;
      const duration = this.wavesurfer.getDuration();
      const time = (relativeX / rect.width) * duration;
      console.debug('[PlaybackController] getEventTime() =>', time.toFixed(2));
      return time;
    };

    const handleClick = (evt) => {
      // Only do region selection if the selector button is active
      if (!this.selectorButton.isActive) {
        console.debug('[PlaybackController] Selector is not active; ignoring click.');
        return;
      }

      const clickTime = getEventTime(evt);
      console.debug('[PlaybackController] handleClick => clickTime:', clickTime.toFixed(2));

      if (!isSelecting) {
        // 1st click
        regionStart = clickTime;
        isSelecting = true;
        console.log('[PlaybackController] (Region) First click -> start:', regionStart.toFixed(2));

        // Remove old region if present
        if (currentRegion) {
          currentRegion.remove();
          currentRegion = null;
        }
      } else {
        // 2nd click
        const regionEnd = clickTime;
        console.log('[PlaybackController] (Region) Second click -> end:', regionEnd.toFixed(2));

        if (regionEnd > regionStart) {
          currentRegion = this.regions.addRegion({
            start: regionStart,
            end: regionEnd,
            color: 'rgba(255, 255, 255, 0.4)',
            drag: true,
            resize: true
          });
          console.log(`[PlaybackController] Region created from ${regionStart.toFixed(2)} to ${regionEnd.toFixed(2)}`);
        } else {
          console.warn("[PlaybackController] Region end must be > start. Ignoring.");
        }

        // Reset
        isSelecting = false;
        regionStart = null;
      }
    };

    // Add listeners
    waveformContainer.addEventListener("click", handleClick);
    waveformContainer.addEventListener("touchend", handleClick, { passive: false });
  }

  initZoomHandler() {
    console.debug('[PlaybackController] initZoomHandler() called.');
    if (!this.wavesurfer) {
      console.error("[PlaybackController] Wavesurfer is not initialized; cannot init zoom handler.");
      return;
    }
  
    // Valores de zoom y sensibilidad (los que ya te funcionan bien)
    const minZoom = 30;    // Valor mínimo de minPxPerSec
    const maxZoom = 3000;  // Valor máximo de minPxPerSec
    const sensitivity = (maxZoom - minZoom) / 1300;  // Tuning: 1300 px de drag para recorrer todo el rango
  
    let isDragging = false;
    let startX = 0, startY = 0;
    let startZoom = 0;
    // Usamos la variable global para el scroll; la actualizamos en pointerUp
    let initialScroll = 0;
    let updatedScroll = 0;
  
    // Al pulsar el botón Move, se deshabilita el interact normal y se muestra el cursor "grab"
    this.moveButton.clickHandler = () => {
      if (this.moveButton.isActive) {
        console.log('[PlaybackController] Move button activated: disabling interact, setting "grab" cursor.');
        this.wavesurfer.setOptions({ interact: false });
        document.body.style.cursor = "grab";
      } else {
        console.log('[PlaybackController] Move button deactivated: enabling interact, resetting cursor.');
        this.wavesurfer.setOptions({ interact: true });
        document.body.style.cursor = "default";
      }
    };
  
    const pointerDown = (evt) => {
      if (!this.moveButton.isActive) return;
      isDragging = true;
      startX = evt.touches ? evt.touches[0].clientX : evt.clientX;
      startY = evt.touches ? evt.touches[0].clientY : evt.clientY;
      startZoom = this.wavesurfer.params.minPxPerSec || minZoom;
      // Aquí usamos el valor almacenado en this.currentScroll (actualizado tras cada arrastre)
      initialScroll = this.currentScroll || 0;
      console.log('[pointerDown] startX:', startX, 'startY:', startY, 'startZoom:', startZoom, 'initialScroll:', initialScroll);
      document.body.style.cursor = "grabbing";
      evt.preventDefault();
    };
  
    const pointerMove = (evt) => {
      if (!isDragging) return;
      const currentX = evt.touches ? evt.touches[0].clientX : evt.clientX;
      const currentY = evt.touches ? evt.touches[0].clientY : evt.clientY;
      const deltaX = startX - currentX; // positivo: arrastre a la izquierda
      const deltaY = startY - currentY; // positivo: arrastre hacia arriba
  
      // Calcula el nuevo zoom basado en deltaY
      let newZoom = startZoom + sensitivity * deltaY;
      newZoom = Math.max(minZoom, Math.min(newZoom, maxZoom));
      console.log('[pointerMove] deltaY:', deltaY, '=> newZoom:', newZoom);
      this.wavesurfer.zoom(newZoom);
  
      // Calcula el nuevo scroll (horizontal) de forma relativa a initialScroll
      updatedScroll = initialScroll + deltaX;
      this.wavesurfer.setScroll(updatedScroll);
      console.log('[pointerMove] deltaX:', deltaX, '=> updatedScroll:', updatedScroll);
    };
  
    const pointerUp = (evt) => {
      if (!isDragging) return;
      isDragging = false;
      // Actualizamos la variable global con el último scroll obtenido
      this.currentScroll = updatedScroll;
      document.body.style.cursor = this.moveButton.isActive ? "grab" : "default";
      console.log('[pointerUp] Drag ended. currentScroll updated to:', this.currentScroll);
    };
  
    // Adjuntar eventos de pointer globalmente
    document.addEventListener('mousedown', pointerDown);
    document.addEventListener('mousemove', pointerMove);
    document.addEventListener('mouseup', pointerUp);
    document.addEventListener('touchstart', pointerDown, { passive: false });
    document.addEventListener('touchmove', pointerMove, { passive: false });
    document.addEventListener('touchend', pointerUp);
  
    console.debug('[PlaybackController] initZoomHandler() - pointer listeners attached.');
  }
  /**
   * Formats a time value (in seconds) as mm:ss.
   */
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60) || 0;
    const secs = Math.floor(seconds % 60) || 0;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  //----- Ejemplo de controles de SoundEngine:
  play() {
    if (this.soundEngine && typeof this.soundEngine.play === 'function') {
      console.debug('[PlaybackController] play() - calling soundEngine.play()');
      this.soundEngine.play();
    } else {
      console.warn('[PlaybackController] soundEngine.play() not available.');
    }
  }
  
  pause() {
    if (this.soundEngine && typeof this.soundEngine.pause === 'function') {
      console.debug('[PlaybackController] pause() - calling soundEngine.pause()');
      this.soundEngine.pause();
    } else {
      console.warn('[PlaybackController] soundEngine.pause() not available.');
    }
  }

  setPlayRange(min = null, max = null) {
    console.debug('[PlaybackController] setPlayRange() called with', min, max);
    if (this.soundEngine && typeof this.soundEngine.sendEvent === 'function') {
      if (min !== null) {
        this.soundEngine.sendEvent("setPlayMin", [min]);
      }
      if (max !== null) {
        this.soundEngine.sendEvent("setPlayMax", [max]);
      }
    }
  }

  loop() {
    console.debug('[PlaybackController] loop() - sending loop event [1]');
    if (this.soundEngine && typeof this.soundEngine.sendEvent === 'function') {
      this.soundEngine.sendEvent("loop", [1]);
    }
  }

  unloop() {
    console.debug('[PlaybackController] unloop() - sending loop event [0]');
    if (this.soundEngine && typeof this.soundEngine.sendEvent === 'function') {
      this.soundEngine.sendEvent("loop", [0]);
    }
  }
}