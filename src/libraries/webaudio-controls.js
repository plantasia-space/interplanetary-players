/**
 * @external WebAudioControls
 * @description
 * WebAudio-Controls is a library that provides customizable audio control elements such as knobs, sliders, switches, keyboards, and parameters.
 * It integrates and enhances the following external libraries:
 *   - **webaudio-knob** by Eiji Kitamura [Website](http://google.com/+agektmr)
 *   - **webaudio-slider** by Ryoya Kawai [Google+ Post](https://plus.google.com/108242669191458983485/posts)
 *   - **webaudio-switch** by Keisuke Ai [Hatena Blog](http://d.hatena.ne.jp/aike/)
 * 
 * Integrated and enhanced by g200kg (Tatsuya Shinyagaito) [Website](http://www.g200kg.com/)
 * 
 * **Modifications by Bruna Guarnieri:**
 * - **Knobs (`webaudio-knob`):** Fully styled rotary controls with customizable colors, sizes, and behavior.
 * - **Sliders (`webaudio-slider`):** Linear sliders with horizontal and vertical orientation options.
 * - **Switches (`webaudio-switch`):** Includes toggle, kick, radio, and sequential types with group handling for radio switches.
 * - **Keyboard (`webaudio-keyboard`):** Simulates a MIDI keyboard with configurable keys, colors, and MIDI integration.
 * - **Parameters (`webaudio-param`):** Provides numeric input fields with customizable visual styles and MIDI compatibility.
 * - **Rendering:** Draws controls (like sliders and switches) using the `<canvas>` API for precise visual control.
 * 
 * **License:**
 * Licensed under the Apache License, Version 2.0. See the [LICENSE](http://www.apache.org/licenses/LICENSE-2.0) file for details.
 * 
 * **Date of Modification:** November 2024
 * 
 * **Notice:** This file includes modifications by Bruna Guarnieri and complies with the requirements of the Apache License 2.0. The original work and its attributions have been retained as required.
 * 
 */

 import { MIDIControllerInstance } from './../MIDIController.js';
 import { getPriority, MIDI_SUPPORTED } from './../Constants.js';
 import { user1Manager } from './../Main.js';

 
 if(window.customElements){
  let styles=document.createElement("style");
  styles.innerHTML=
`#webaudioctrl-context-menu {
  display: none;
  position: absolute;
  z-index: 10;
  padding: 0;
  width: 100px;
  color:#fffff;
  background-color: #000000;
  border: solid 1px #000000;
  box-shadow: 1px 1px 2px ##a5a5a5;
  font-family: 'Orbit', sans-serif;
  font-size: 11px;
  line-height:1.7em;
  text-align:center;
  cursor:pointer;
  color:#fff;
  list-style: none;
}
#webaudioctrl-context-menu.active {
  display: block;
}
.webaudioctrl-context-menu__item {
  display: block;
  margin: 0;
  padding: 0;
  color: #000;
  background-color:#fff;
  text-decoration: none;
}
.webaudioctrl-context-menu__title{
  font-weight:bold;
}
.webaudioctrl-context-menu__item:last-child {
  margin-bottom: 0;
}
.webaudioctrl-context-menu__item:hover {
  background-color: #b8b8b8;
}
`;
  document.head.appendChild(styles);

  let opt={
    useMidi:0,
    preserveMidiLearn:0,
    preserveValue:0,
    midilearn:0,
    mididump:0,
    outline:null,
    knobSrc:null,
    knobSprites:null,
    knobWidth:null,
    knobHeight:null,
    knobDiameter:null,
    knobColors:"#e00;#000;#fff",
    sliderSrc:null,
    sliderWidth:null,
    sliderHeight:null,
    sliderKnobSrc:null,
    sliderKnobWidth:null,
    sliderKnobHeight:null,
    sliderDitchlength:null,
    sliderColors:"#e00;#333;#fcc",
    switchWidth:null,
    switchHeight:null,
    switchDiameter:null,
    switchColors:"#e00;#000;#fcc",
    paramWidth:null,
    paramHeight:null,
    paramFontSize:9,
    paramColors:"#fff;#000",
    valuetip:0,
    xypadColors:"#e00;#000;#fcc",
  };
  if(window.WebAudioControlsOptions)
    Object.assign(opt,window.WebAudioControlsOptions);
    /**
   * @class WebAudioControlsWidget
   * @memberof 2DGUI
   * @extends HTMLElement
   * @description
   * Custom HTML element that serves as a container for WebAudio control widgets such as knobs, sliders, switches, keyboards, and parameters.
   * Handles user interactions, rendering, and event dispatching for audio controls.
   */
  class WebAudioControlsWidget extends HTMLElement{
    constructor(){
      super();
      this.addEventListener("keydown",this.keydown);
      this.addEventListener("mousedown",this.pointerdown,{passive:false});
      this.addEventListener("touchstart",this.pointerdown,{passive:false});
      this.addEventListener("wheel",this.wheel,{passive:false});
      this.addEventListener("mouseover",this.pointerover);
      this.addEventListener("mouseout",this.pointerout);
      this.addEventListener("contextmenu",this.contextMenu);
      this.hover=this.drag=0;
      this.basestyle=`
.webaudioctrl-tooltip{
  display:inline-block;
  position:absolute;
  margin:0 -1000px;
  z-index: 999;
  background:#eee;
  color:#000;
  border:1px solid #666;
  border-radius:4px;
  padding:5px 10px;
  text-align:center;
  left:0; top:0;
  font-size:11px;
  opacity:0;
  visibility:hidden;
}
.webaudioctrl-tooltip:before{
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  margin-left: -8px;
  border: 8px solid transparent;
  border-top: 8px solid #666;
}
.webaudioctrl-tooltip:after{
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  margin-left: -6px;
  border: 6px solid transparent;
  border-top: 6px solid #eee;
}
`;
this.onBlur = () => {
  if (this.elem) {
    this.elem.style.outline = "none";
  }
};
this.onFocus = () => {
  if (this.elem) {
    switch (+this.outline) {
      case null:
      case 0:
        this.elem.style.outline = "none";
        break;
      case 1:
        this.elem.style.outline = "1px solid #444";
        break;
      default:
        this.elem.style.outline = this.outline;
    }
  }
};
    }
    sendEvent(ev){
      let event;
      event=document.createEvent("HTMLEvents");
      event.initEvent(ev,false,true);
      this.dispatchEvent(event);
    }
    getAttr(n,def){
      let v=this.getAttribute(n);
      if(v==null) return def;
      switch(typeof(def)){
      case "number":
        if(v=="true") return 1;
        v=+v;
        if(isNaN(v)) return 0;
        return v;
      }
      return v;
    }
    showtip(d) {
      function valstr(x, c, type) {
        switch (type) {
          case "x":
            return (x | 0).toString(16);
          case "X":
            return (x | 0).toString(16).toUpperCase();
          case "d":
            return (x | 0).toString();
          case "f":
            return parseFloat(x).toFixed(c);
          case "s":
            return x.toString();
          default:
            return "";
        }
      }
    
      function numformat(s, x) {
        let i = s.indexOf("%");
        let j = i + 1;
        if (i < 0) j = s.length;
        let c = [0, 0],
          type = 0,
          m = 0,
          r = "";
        if (s.indexOf("%s") >= 0) {
          return s.replace("%s", x);
        }
        for (; j < s.length; ++j) {
          if ("dfxXs".indexOf(s[j]) >= 0) {
            type = s[j];
            break;
          }
          if (s[j] == ".") m = 1;
          else c[m] = c[m] * 10 + parseInt(s[j]);
        }
        r = valstr(x, c[1], type);
        if (c[0] > 0) r = ("               " + r).slice(-c[0]);
        r = s.replace(/%.*[xXdfs]/, r);
        return r;
      }
    
      // Ensure tooltip and tooltip container exist
      if (!this.tooltip && !this.ttframe) return;
    
      let s = this.tooltip;
      if (this.drag || this.hover) {
        if (this.valuetip) {
          if (s == null) s = `%s`;
          else if (s.indexOf("%") < 0) s += ` : %s`;
        }
        if (s && this.ttframe) {
          this.ttframe.innerHTML = numformat(s, this.convValue);
          this.ttframe.style.display = "inline-block";
          this.ttframe.style.width = "auto";
          this.ttframe.style.height = "auto";
          this.ttframe.style.transition =
            "opacity 0.5s " + d + "s,visibility 0.5s " + d + "s";
          this.ttframe.style.opacity = 0.9;
          this.ttframe.style.visibility = "visible";
    
          let rc = this.getBoundingClientRect() || { width: 0 };
          let rc2 =
            (this.ttframe.getBoundingClientRect &&
              this.ttframe.getBoundingClientRect()) ||
            { width: 0, height: 0 };
          let rc3 =
            document.documentElement.getBoundingClientRect() || { width: 0 };
    
          this.ttframe.style.left =
            (rc.width - rc2.width) * 0.5 + 1000 + "px";
          this.ttframe.style.top = -rc2.height - 8 + "px";
          return;
        }
      }
    
      // Fallback if tooltip cannot be displayed
      if (this.ttframe) {
        this.ttframe.style.transition =
          "opacity 0.1s " + d + "s,visibility 0.1s " + d + "s";
        this.ttframe.style.opacity = 0;
        this.ttframe.style.visibility = "hidden";
      }
    }    
    setupLabel(){
      this.labelpos=this.getAttr("labelpos", "bottom 0px");
      const lpos=this.labelpos.split(" ");
      let offs="";
      if(lpos.length==3)
        offs=`translate(${lpos[1]},${lpos[2]})`;
      this.label.style.position="absolute";
      switch(lpos[0]){
      case "center":
        this.label.style.top="50%";
        this.label.style.left="50%";
        this.label.style.transform=`translate(-50%,-50%) ${offs}`;
        break;
      case "right":
        this.label.style.top="50%";
        this.label.style.left="100%";
        this.label.style.transform=`translateY(-50%) ${offs}`;
        break;
      case "left":
        this.label.style.top="50%";
        this.label.style.left="0%";
        this.label.style.transform=`translate(-100%,-50%) ${offs}`;
        break;
      case "bottom":
        this.label.style.top="100%";
        this.label.style.left="50%";
        this.label.style.transform=`translateX(-50%) ${offs}`;
        break;
      case "top":
        this.label.style.top="0%";
        this.label.style.left="50%";
        this.label.style.transform=`translate(-50%,-100%) ${offs}`;
        break;
      }
    }
    pointerover(e) {
      this.hover=1;
      this.showtip(0.6);
    }
    pointerout(e) {
      this.hover=0;
      this.showtip(0);
    }

    

}
/**
 * @class WebAudioKnob
 * @memberof 2DGUI
 * @extends WebAudioControlsWidget
 * @description
 * Custom element representing a rotary knob control for WebAudio applications. The knob supports 
 * configurable appearance, interaction, and value mapping. It integrates with the ParameterManager 
 * for dynamic parameter updates and supports both linear and logarithmic scaling.
 * 
 * Features:
 * - Fully customizable via attributes (e.g., `min`, `max`, `step`, `colors`).
 * - High-DPI support with dynamic resizing and responsive behavior.
 * - Integrates with external systems via bidirectional updates.
 * - Emits standard DOM events (`input`, `change`) for value changes.
 */
try {
  customElements.define("webaudio-knob", class WebAudioKnob extends WebAudioControlsWidget {
    constructor() {
      super();
      this.resizeObserver = null; // Reference to ResizeObserver
      // Bind event handlers to ensure correct 'this' context
      this.onFocus = this.onFocus.bind(this);
      this.onBlur = this.onBlur.bind(this);
      this.onPointerDown = this.pointerdown.bind(this);
      this.onPointerMove = this.pointermove.bind(this);
      this.onPointerUp = this.pointerup.bind(this);
    }

    connectedCallback() {
      let root;
      if (this.attachShadow)
        root = this.attachShadow({ mode: 'open' });
      else
        root = this;

      // Define the HTML structure with canvas and tooltip
      root.innerHTML = `
        <style>
          ${this.basestyle}
          :host {
            display: inline-block;
            margin: 0;
            padding: 0;
            cursor: pointer;
            font-family: sans-serif;
            font-size: 11px;
            /* Utilize CSS variables for styling */
            --knob-col1: var(--col1, #e00); /* Fill color */
            --knob-col2: var(--col2, rgba(0, 0, 0, 0.3)); /* Background color with alpha */
            --knob-outline: var(--knob-outline, none); /* Outline color */
            /* Set width and height to either specified values or maintain square */
            --knob-size: ${this.hasAttribute("width") && this.hasAttribute("height") ? 
              `var(--knob-width, ${this.getAttr("width", 64)}px)` : 
              '100%'};
            box-sizing: border-box; /* Ensure padding and border are included in width and height */
            width: 100%;
            height: 100%; /* Allow the height to adjust dynamically */
            aspect-ratio: 1 / 1; /* Maintain square ratio */
            position: relative; /* Ensure positioned elements are relative to the host */
          }
          .webaudio-knob-body {
            display: flex; /* Use flexbox to center the canvas */
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
            touch-action: none;
          }
          canvas.webaudio-knob-canvas {
            display: block;
            width: 100%;
            height: 100%;
            transform: rotate(90deg); /* Rotate knob 90 degrees */
          }
          .webaudioctrl-tooltip {
            /* Tooltip styling can be customized via CSS variables if needed */
          }
          .webaudioctrl-label {
            /* Label styling can be customized via CSS variables if needed */
          }
        </style>
        <div class='webaudio-knob-body' tabindex='1'>
          <canvas class='webaudio-knob-canvas'></canvas>
          <div class='webaudioctrl-tooltip'></div>
          <div part="label" class="webaudioctrl-label"><slot></slot></div>
        </div>
      `;

      // Reference to elements
      this.elem = root.querySelector('.webaudio-knob-body');
      this.canvas = root.querySelector('canvas.webaudio-knob-canvas');
      this.ttframe = root.querySelector('.webaudioctrl-tooltip');
      this.label = root.querySelector('.webaudioctrl-label');

      if (!this.elem || !this.canvas) {
        console.error('webaudio-knob: Essential elements are missing.');
        return;
      }

      // Initialize properties from attributes or defaults
      this.enable = this.getAttr("enable", 1);
      this._value = this.getAttr("value", 0);
      this.defvalue = this.getAttr("defvalue", this._value);
      this._min = this.getAttr("min", 0);
      this._max = this.getAttr("max", 100);
      this._step = this.getAttr("step", 1);
      this._width = this.hasAttribute("width") ? this.getAttr("width", 64) : null;
      this._height = this.hasAttribute("height") ? this.getAttr("height", 64) : null;
      this._diameter = this.getAttr("diameter", null); // For future use if needed
      this._colors = this.getAttr("colors", opt.knobColors); // Expected format: "col1;col2;col3"

      // Define getters and setters for properties
      if (!this.hasOwnProperty("value")) Object.defineProperty(this, "value", {
        get: () => { return this._value },
        set: (v) => { this._value = v; this.redraw() }
      });

      if (!this.hasOwnProperty("min")) Object.defineProperty(this, "min", {
        get: () => { return this._min },
        set: (v) => { this._min = +v; this.redraw() }
      });

      if (!this.hasOwnProperty("max")) Object.defineProperty(this, "max", {
        get: () => { return this._max },
        set: (v) => { this._max = +v; this.redraw() }
      });

      if (!this.hasOwnProperty("step")) Object.defineProperty(this, "step", {
        get: () => { return this._step },
        set: (v) => { this._step = +v; this.redraw() }
      });

      if (!this.hasOwnProperty("width")) Object.defineProperty(this, "width", {
        get: () => { return this._width },
        set: (v) => { this._width = v; this.setupImage() }
      });

      if (!this.hasOwnProperty("height")) Object.defineProperty(this, "height", {
        get: () => { return this._height },
        set: (v) => { this._height = v; this.setupImage() }
      });

      if (!this.hasOwnProperty("colors")) Object.defineProperty(this, "colors", {
        get: () => { return this._colors },
        set: (v) => { this._colors = v; this.setupImage() }
      });

      // Other properties
      this.outline = this.getAttr("outline", opt.outline);
      this.log = this.getAttr("log", 0);
      this.sensitivity = this.getAttr("sensitivity", 1);
      this.valuetip = this.getAttr("valuetip", opt.valuetip);
      this.tooltip = this.getAttr("tooltip", null);
/*       this.conv = this.getAttr("conv", null);
      if (this.conv) {
        const x = this._value;
        this.convValue = eval(this.conv);
        if (typeof this.convValue === "function")
          this.convValue = this.convValue(x);
      } else
        this.convValue = this._value; */

      // Setup canvas dimensions and handle high DPI
      this.setupImage();

      // Bind the drawKnob method to ensure correct 'this' context
      this.drawKnob = this.drawKnob.bind(this);

      // Initial drawing
      this.redraw();

      // Setup label positioning
      this.setupLabel();

      // Parameter Manager Integration
      this.rootParam = this.getAttr("root-param", null); // New attribute
      this.isBidirectional = this.getAttr("is-bidirectional", false); // New attribute

            // Register with ParameterManager if rootParam is specified
            if (this.rootParam) {      

              const priority = getPriority("webaudio-knob");

              // Subscribe to ParameterManager updates for this parameter with the retrieved priority
              user1Manager.subscribe(this, this.rootParam, priority);
            }

      // Controller name based on the knob's ID or a unique identifier
      this.controllerName = this.id || `knob-${Math.random().toString(36).substr(2, 9)}`;


      

      // Additional properties
      this.digits = 0;
      if (this.step && this.step < 1) {
        for (let n = this.step; n < 1; n *= 10)
          ++this.digits;
      }


      // Bind focus, blur, and pointerdown events after this.elem is assigned
      if (this.elem) {
        this.elem.addEventListener('focus', this.onFocus);
        this.elem.addEventListener('blur', this.onBlur);
        this.elem.addEventListener('pointerdown', this.onPointerDown);
        this.elem.addEventListener('dblclick', () => {
          this.setValue(this.defvalue, true);
        });
      } else {
        console.error('webaudio-knob: this.elem is not assigned correctly.');
      }

      // Add to widget manager
      if (window.webAudioControlsWidgetManager)
        window.webAudioControlsWidgetManager.addWidget(this);

    }

    disconnectedCallback() {
      // Remove event listeners to prevent memory leaks
      if (this.elem) {
        this.elem.removeEventListener('focus', this.onFocus);
        this.elem.removeEventListener('blur', this.onBlur);
        this.elem.removeEventListener('pointerdown', this.onPointerDown);
      }

      // Disconnect ResizeObserver if it exists
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      }

            // Remove from widget manager
            if (window.webAudioControlsWidgetManager)
            window.webAudioControlsWidgetManager.removeWidget(this);
    

      // Unsubscribe from ParameterManager
      if (this.rootParam) {
        user1Manager.unsubscribe(this, this.rootParam);
      }
      // Remove any global event listeners if necessary
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerup', this.onPointerUp);
    }

    setupImage() {
      // *** Resolve CSS Variables in 'colors' ***
      this.coltab = this.colors
        ? this.colors.split(";").map(color => {
            color = color.trim();
            if (color.startsWith('var(') && color.endsWith(')')) {
              const varName = color.slice(4, -1).trim();
              const resolvedColor = getComputedStyle(document.documentElement)
                .getPropertyValue(varName)
                .trim();
              return resolvedColor || '#000'; // Fallback to black if variable is not defined
            }
            return color;
          })
        : ["#e00", "#000", "#000"];
    
      // Determine actual size
      let width, height;
      const style = getComputedStyle(this.elem);
    
      if (this._width && this._height) {
        width = parseInt(this._width);
        height = parseInt(this._height);
      } else {
        // Fallback to computed size from the element's parent
        width = parseInt(style.width) || 64;
        height = parseInt(style.height) || 64;
      }
    
      // Handle high DPI displays
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
    
      const ctx = this.canvas.getContext('2d');
      ctx.scale(dpr, dpr);
    
      // Apply outline if specified
      this.canvas.style.outline = this.outline;
    
      // Calculate radius based on width and height
      if (this._diameter) {
        this.radius = parseInt(this._diameter) / 2 - 5; // Padding of 5px
      } else {
        this.radius = Math.min(width, height) / 2 - 5; // Dynamic padding adjustment
      }
    
      this.centerX = width / 2;
      this.centerY = height / 2;
    
      // Redraw the knob with updated dimensions
      this.redraw();
    
      // Setup ResizeObserver for dynamic responsiveness
      if (!this.resizeObserver) {
        this.resizeObserver = new ResizeObserver(entries => {
          for (let entry of entries) {
            const newWidth = entry.contentRect.width || parseInt(style.width) || 64;
            const newHeight = entry.contentRect.height || parseInt(style.height) || 64;
    
            const dpr = window.devicePixelRatio || 1;
            this.canvas.width = newWidth * dpr;
            this.canvas.height = newHeight * dpr;
            this.canvas.style.width = `${newWidth}px`;
            this.canvas.style.height = `${newHeight}px`;
    
            const ctx = this.canvas.getContext('2d');
            ctx.scale(dpr, dpr);
    
            // Recalculate radius and center dynamically
            this.radius = Math.min(newWidth, newHeight) / 2 - 5; // Adjust radius for padding
            this.centerX = newWidth / 2;
            this.centerY = newHeight / 2;
    
            // Redraw the knob with updated dimensions
            this.redraw();
          }
        });
      }
    
      // Observe the parent element for size changes
      this.resizeObserver.observe(this.elem.parentElement || this.elem);
    }
    redraw() {
      let ratio;
      this.digits = 0;
      if (this.step && this.step < 1) {
        for (let n = this.step; n < 1; n *= 10)
          ++this.digits;
      }
      if (this.value < this.min) {
        this.value = this.min;
      }
      if (this.value > this.max) {
        this.value = this.max;
      }
      if (this.log)
        ratio = Math.log(this.value / this.min) / Math.log(this.max / this.min);
      else
        ratio = (this.value - this.min) / (this.max - this.min);

      // Draw the knob based on the current ratio
      this.drawKnob(ratio);
    }

    /**
     * Draws the knob on the canvas based on the provided ratio.
     * @param {number} ratio - A value between 0 and 1 representing the current knob position.
     */
    drawKnob(ratio) {
      const ctx = this.canvas.getContext('2d');
      const width = this.canvas.width / (window.devicePixelRatio || 1);
      const height = this.canvas.height / (window.devicePixelRatio || 1);
      const radius = this.radius;
      const centerX = this.centerX;
      const centerY = this.centerY;

      // Clear the canvas
      ctx.clearRect(0, 0, width, height);

      // Draw background (col2)
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
      ctx.fillStyle = this.coltab[1]; // Background color
      ctx.fill();

      // Draw filled portion (col1) based on the ratio
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      const startAngle = 0; // Start at the bottom after 90-degree rotation
      const endAngle = startAngle + (2 * Math.PI * ratio);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle, false);
      ctx.closePath();
      ctx.fillStyle = this.coltab[0]; // Fill color
      ctx.fill();

      // Optional: Draw an outline around the knob
      /*
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
      ctx.strokeStyle = this.coltab[2]; // Outline color
      ctx.lineWidth = 1;
      ctx.stroke();
      */
    }

    _setValue(v) {
      if (this.step)
        v = (Math.round((v - this.min) / this.step)) * this.step + this.min;
      this._value = Math.min(this.max, Math.max(this.min, v));
      if (this._value !== this.oldvalue) {
        this.fireflag = true;
        this.oldvalue = this._value;
        this.redraw();
        this.showtip(0);
        return 1;
      }
      return 0;
    }

    /**
     * Sets the value and optionally notifies the ParameterManager and dispatches events.
     * @param {number} v - The value to set.
     * @param {boolean} fire - Whether to notify the manager and dispatch events.
     */
    setValue(v, fire = false) {
      if (this._setValue(v)) {
        if (fire) {
          // Determine priority using the centralized getPriority function
          const priority = getPriority("webaudio-knob");
          if (this.rootParam) {
            // Update ParameterManager with the new value
            user1Manager.setRawValue(
              this.rootParam,
              this._value,
              this, // Source controller
              priority
            );
          }

          // Dispatch events
          this.sendEvent("input");
          this.sendEvent("change");
        }
      }
    }
    /**
     * Handles parameter updates from ParameterManager.
     * @param {string} parameterName - The name of the parameter that changed.
     * @param {number} newValue - The new value of the parameter.
     */
    onParameterChanged(parameterName, newValue) {
      if (this.rootParam === parameterName) {
        if (this.isBidirectional) {
          this._setValue(newValue); // Avoid triggering another update to ParameterManager
          this.redraw();

        }
      }
    }
    keydown(e) {
      let delta = this.step;
      if (delta === 0)
        delta = 1;
      switch (e.key) {
        case "ArrowUp":
          this.setValue(this.value + delta, true);
          break;
        case "ArrowDown":
          this.setValue(this.value - delta, true);
          break;
        default:
          return;
      }
      e.preventDefault();
      e.stopPropagation();
    }

    wheel(e) {
      if (!this.enable) return;
    
      // Determine scroll direction
      let direction = e.deltaY || (e.wheelDelta ? -e.wheelDelta : 0); // Use wheelDelta for fallback
      direction = Math.sign(-direction); // Normalize to -1 or 1
    
      if (this.log) {
        // Logarithmic mode
        let r = Math.log(this.value / this.min) / Math.log(this.max / this.min);
        let d = direction * 0.2; // Base delta for logarithmic scaling
        r += d;
        r = Math.max(0, Math.min(1, r)); // Clamp ratio between 0 and 1
        const newValue = this.min * Math.pow(this.max / this.min, r);
        this.setValue(newValue, true);
      } else {
        // Linear mode
        let delta = this.step*30 || (this.max - this.min) * 0.2; // Default 5% range step
        delta *= direction; // Apply direction
        const newValue = +this.value + delta;
        this.setValue(newValue, true);
      }
    
      // Prevent default scrolling behavior
      e.preventDefault();
      e.stopPropagation();
    }

    pointerdown(ev) {
      if (!this.enable) return;
      let e = ev;
    
      // Only handle primary buttons (usually left mouse button) and touch
      if (e.pointerType === 'mouse' && e.button !== 0) return;
    
      // Prevent multiple pointers
      if (this.drag) return;
      this.isBidirectional = false; // Pause bidirectional updates during interaction

      if (typeof e.pointerId === 'undefined') {
        console.warn('pointerId is undefined.');
        return;
      }
    
      this.elem.setPointerCapture(e.pointerId);
      this.drag = true;
      this.startVal = this.value;
      this.startPosX = e.clientX;
      this.startPosY = e.clientY;

      // Listen for pointermove and pointerup events
      this.elem.addEventListener('pointermove', this.onPointerMove);
      this.elem.addEventListener('pointerup', this.onPointerUp);
      this.elem.addEventListener('pointercancel', this.onPointerUp);

      // Prevent default to avoid unwanted behaviors (e.g., text selection)
      e.preventDefault();
      e.stopPropagation();
    }

    pointermove(ev) {
      if (!this.drag)
        return;

      const deltaY = this.startPosY - ev.clientY;
      const deltaX = ev.clientX - this.startPosX;
      const delta = (deltaY + deltaX) * this.sensitivity;

      let newValue;
      if (this.log) {
        let r = Math.log(this.startVal / this.min) / Math.log(this.max / this.min);
        r += delta / ((ev.shiftKey ? 4 : 1) * 128);
        r = Math.max(0, Math.min(1, r));
        newValue = this.min * Math.pow(this.max / this.min, r);
      }
      else {
        newValue = this.startVal + (delta / 128) * (this.max - this.min);
      }

      this.setValue(newValue, true);
    }

    pointerup(ev) {
      if (!this.drag)
        return;

      this.drag = false;
      this.isBidirectional = true; // Resume bidirectional updates

      this.elem.releasePointerCapture(ev.pointerId);
      this.elem.removeEventListener('pointermove', this.onPointerMove);
      this.elem.removeEventListener('pointerup', this.onPointerUp);
      this.elem.removeEventListener('pointercancel', this.onPointerUp);

      // Emit change event if value changed
      this.sendEvent("change");
    }

    // Optional: Implement focus and blur handlers if needed
    onFocus() {
      // Handle focus event (e.g., visual feedback)
    }

    onBlur() {
      // Handle blur event
    }

    // Implement other necessary methods like setupLabel, sendEvent, showtip, setMidiController, etc.
    // These implementations depend on your existing codebase and are assumed to be present.

    setupLabel() {
      // Example implementation, adjust as necessary
      if (this.label) {
        this.label.style.position = 'absolute';
        this.label.style.bottom = '0';
        this.label.style.width = '100%';
        this.label.style.textAlign = 'center';
        // Additional styling can be added here
      }
    }

    sendEvent(eventName) {
      const event = new Event(eventName, { bubbles: true, composed: true });
      this.dispatchEvent(event);
    }

    showtip(delay) {
      // Implement tooltip display logic here
      // This is a placeholder implementation
      if (this.ttframe && this.valuetip) {
        this.ttframe.textContent = this.convValue;
        this.ttframe.style.opacity = '1';
        setTimeout(() => {
          if (this.ttframe) this.ttframe.style.opacity = '0';
        }, delay * 1000 || 1000);
      }
    }

  });
} catch (error) {
  console.log("webaudio-knob already defined");
}


/**
 * @class WebAudioSlider
 * @memberof 2DGUI
 * @extends WebAudioControlsWidget
 * @description
 * Custom HTML element representing a slider control for WebAudio applications. 
 * The slider supports both horizontal and vertical orientations, customizable 
 * appearance, and bidirectional integration with the ParameterManager.
 * 
 * Features:
 * - Configurable attributes: `min`, `max`, `step`, `direction`, `colors`.
 * - High-DPI support with dynamic resizing for responsive layouts.
 * - Supports logarithmic and linear scaling.
 * - ARIA attributes for accessibility, including keyboard interaction.
 * - Emits standard DOM events (`input`, `change`) for value changes.
 */
try {
  customElements.define("webaudio-slider", class WebAudioSlider extends WebAudioControlsWidget {
    constructor() {
      super();

      // Bind methods to ensure correct 'this' context
      this.pointerdown = this.pointerdown.bind(this);
      this.pointermove = this.pointermove.bind(this);
      this.pointerup = this.pointerup.bind(this);
      this.keydown = this.keydown.bind(this);
      this.wheel = this.wheel.bind(this);
      this.redraw = this.redraw.bind(this);
      this.onParameterChanged = this.onParameterChanged.bind(this); // Ensure correct binding

      // Initialize properties for ResizeObserver
      this.resizeObserver = null;

      // Flag to prevent circular updates
      this.updatingFromSlider = false;
    }

    connectedCallback() {
      let root;
      if (this.attachShadow) {
        root = this.attachShadow({ mode: 'open' });
      } else {
        root = this;
      }

      // Define HTML structure with ARIA attributes for accessibility
      root.innerHTML = `
        <style>
          ${this.basestyle}
          :host {
      display: flex;
            position: relative;
            justify-content: center; /* Centers horizontally */
            align-items: center; /* Centers vertically */
            margin: 0;
            padding: 0;
            font-family: sans-serif;
            font-size: 11px;
            cursor: pointer;
            user-select: none;
            width: 100%;
            height: 100%;
          }
          .webaudio-slider-body {
            position: relative;
            width: 100%;
            height: 100%;
            touch-action: none;
          }
          canvas.webaudio-slider-canvas {
            display: block;
            width: 100%;
            height: 100%;
          }
          .webaudioctrl-tooltip {
            position: absolute;
            top: -25px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            color: #fff;
            padding: 2px 5px;
            border-radius: 3px;
            font-size: 10px;
            white-space: nowrap;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s;
          }
          .webaudioctrl-label {
            position: absolute;
            width: 100%;
            text-align: center;
            top: 100%;
            left: 0;
            transform: translateY(4px);
            font-size: 10px;
            color: #fff;
          }
          :host(:focus) .webaudio-slider-body {
            outline: none;
          }
        </style>
        <div class='webaudio-slider-body' tabindex='1' role='slider' aria-valuemin='${this._min}' aria-valuemax='${this._max}' aria-valuenow='${this._value}' aria-orientation='${this.isHorizontal ? "horizontal" : "vertical"}' aria-label='${this.tooltip || "Audio Slider"}'>
          <canvas class='webaudio-slider-canvas'></canvas>
          <div class='webaudioctrl-tooltip'></div>
          <div part="label" class="webaudioctrl-label"><slot></slot></div>
        </div>
      `;

      // Reference elements
      this.elem = root.querySelector('.webaudio-slider-body');
      this.canvas = root.querySelector('canvas.webaudio-slider-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.ttframe = root.querySelector('.webaudioctrl-tooltip');
      this.label = root.querySelector('.webaudioctrl-label');

      // Initialize properties
      this.initializeAttributes();

      // Process colors
      this.processColors();

      // Define 'value' property
      Object.defineProperty(this, 'value', {
        get: () => this._value,
        set: (v) => { this.setValue(v, true); }
      });

      // Additional properties
      this.convValue = this._value;
      this.digits = 0;
      if (this._step && this._step < 1) {
        let n = this._step;
        while (n < 1) {
          n *= 10;
          ++this.digits;
        }
      }
      this.fireflag = true;

      // Parameter Manager Integration
      this.rootParam = this.getAttr("root-param", null); // New attribute
      this.isBidirectional = this.getAttr("is-bidirectional", false); // New attribute

      // Register with ParameterManager if rootParam is specified
      if (this.rootParam) {      
        // Subscribe to ParameterManager updates for this parameter with the retrieved priority
        const priority = getPriority("webaudio-slider");

        user1Manager.subscribe(this, this.rootParam, priority);

        // **Initialization Step**
        const initialRaw = user1Manager.getRawValue(this.rootParam);
        if (initialRaw !== null) {
          this._setValue(initialRaw, false);
        } else {
          user1Manager.setRawValue(this.rootParam, this._value, this, priority);
        }
      }

      // Controller name based on the knob's ID or a unique identifier
      this.controllerName = this.id || `knob-${Math.random().toString(36).substr(2, 9)}`;
      
      // Register the slider globally
      window.webaudioSliders = window.webaudioSliders || {};
      if (this.id) window.webaudioSliders[this.id] = this;

      // Initial setup
      this.setupCanvas();
      this.redraw();

      // Event listeners
      this.addEventListeners();

      // ResizeObserver for responsive behavior
      this.setupResizeObserver();

      // Add to widget manager
      if (window.webAudioControlsWidgetManager)
        window.webAudioControlsWidgetManager.addWidget(this);
    }

    disconnectedCallback() {
      // Remove event listeners
      this.removeEventListeners();

      // Unobserve ResizeObserver
      if (this.resizeObserver) this.resizeObserver.unobserve(this);

      // Additional cleanup
      if (this.linkedParam) {
        this.linkedParam.removeEventListener("input", this.handleParamChange);
      }
      // Unsubscribe from ParameterManager
      if (this.rootParam) {
        user1Manager.unsubscribe(this, this.rootParam);
      }
      // Remove from widget manager
      if (window.webAudioControlsWidgetManager)
        window.webAudioControlsWidgetManager.removeWidget(this);
    }

    /**
     * Initializes attributes with proper parsing and defaults.
     */
    initializeAttributes() {
      this.enable = this.getAttr("enable", 1);
      this.tracking = (this.getAttr("tracking", "rel") || "rel").toLowerCase();
      this._value = parseFloat(this.getAttribute("value")) || 0;
      this.defvalue = parseFloat(this.getAttribute("defvalue")) || this._value;
      this._min = parseFloat(this.getAttribute("min"));
      if (isNaN(this._min)) this._min = 0.;
      this._max = parseFloat(this.getAttribute("max"));
      if (isNaN(this._max)) this._max = 1.;  
      this._step = parseFloat(this.getAttribute("step")) || 0.1; // Default to 0.1 dB step for precision
      this._direction = this.getAttribute("direction") || "horz";
      this.log = parseInt(this.getAttr("log", 0), 10) === 1; // Parse as boolean
      this._colors = this.getAttribute("colors") || "#e00;#333;#fff;#777;#555";
      this.outline = this.getAttribute("outline") || "none";     
      this.showLabel = this.hasAttribute("show-label"); // Check for show-label attribute   
      this.setupLabel();
      
      this.sensitivity = this.getAttr("sensitivity", .5);
        // Parse pointer-size as a float, defaulting to 0.2 if not specified or invalid
      const parsedPointerSize = parseFloat(this.getAttribute("pointer-size"));
      this.pointerSize = isNaN(parsedPointerSize) ? 0.2 : parsedPointerSize;

      this.valuetip = this.getAttr("valuetip", opt.valuetip);
      this.tooltip = this.getAttribute("tooltip") || null;
      this.conv = this.getAttribute("conv") || null;
      this.link = this.getAttribute("link") || "";

      // Ensure 'min' is valid for logarithmic scaling
      if (this.log && this._min <= 0) {
        this._min = 1;
        this.setAttribute("min", this._min);
      }
    }

    /**
     * Processes color attributes, allowing external customization.
     */
    processColors() {
      this.coltab = this._colors.split(";").map(color => {
        color = color.trim();
        if (color.startsWith("var(") && color.endsWith(")")) {
          const varName = color.slice(4, -1).trim();
          const resolvedColor = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
          return resolvedColor || "#000";
        }
        return color;
      });
      while (this.coltab.length < 5) this.coltab.push("#000");
    }


    /**
     * Adds necessary event listeners to the slider element.
     */
    addEventListeners() {
      this.elem.addEventListener('keydown', this.keydown);
      this.elem.addEventListener('mousedown', this.pointerdown, { passive: false });
      this.elem.addEventListener('touchstart', this.pointerdown, { passive: false });
      this.elem.addEventListener('wheel', this.wheel, { passive: false });
      this.elem.addEventListener('dblclick', this.handleDoubleClick.bind(this)); // Double-click listener

    }

    /**
     * Removes event listeners from the slider element.
     */
    removeEventListeners() {
      this.elem.removeEventListener('keydown', this.keydown);
      this.elem.removeEventListener('mousedown', this.pointerdown);
      this.elem.removeEventListener('touchstart', this.pointerdown);
      this.elem.removeEventListener('wheel', this.wheel);
    }

    /**
     * Sets up ResizeObserver to handle responsiveness.
     */
    setupResizeObserver() {
      this.resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
          this.setupCanvas();
          this.redraw();
        }
      });
      this.resizeObserver.observe(this);
    }



    /**
     * Sets up the canvas dimensions and scaling.
     */
    setupCanvas() {
      // Get actual size
      let rect = this.elem.getBoundingClientRect();
      const knobSizeMultiplier = this.pointerSize; 
      
      // Check and set default width and height if they are 0
      if (rect.width === 0) {
        this.elem.style.width = this._direction.toLowerCase() === "vert" ? "50px" : "300px"; // Set default width based on direction
        rect = this.elem.getBoundingClientRect(); // Update rect after setting width
      }

      if (rect.height === 0) {
        this.elem.style.height = this._direction.toLowerCase() === "vert" ? "200px" : "50px"; // Set default height based on direction
        rect = this.elem.getBoundingClientRect(); // Update rect after setting height
      }

      this._width = rect.width;
      this._height = rect.height;

      // High DPI handling
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = this._width * dpr;
      this.canvas.height = this._height * dpr;
      this.ctx.scale(dpr, dpr);

      // Recalculate colors
      this.processColors();

      // Recalculate dimensions proportionally based on direction
      if (this._direction.toLowerCase() === "horz") {
        this.isHorizontal = true;
        this.knobSize = this._height * knobSizeMultiplier; // 30% of height for horizontal
        const padding = this.knobSize;
        this.trackLength = this._width - 2 * padding;
        this.trackHeight = this._height * 0.2; // 20% of height
        this.trackX = padding;
        this.trackY = (this._height - this.trackHeight) / 2;
      } else if (this._direction.toLowerCase() === "vert") {
        this.isHorizontal = false;
        this.knobSize = this._width * knobSizeMultiplier; // 30% of width for vertical
        const padding = this.knobSize;
        this.trackLength = this._height - 2 * padding;
        this.trackHeight = this._width * knobSizeMultiplier; // 30% of width
        this.trackX = (this._width - this.trackHeight) / 2;
        this.trackY = padding;
      } else {
        this.isHorizontal = true;
        this.knobSize = this._height * knobSizeMultiplier;
        const padding = this.knobSize;
        this.trackLength = this._width - 2 * padding;
        this.trackHeight = this._height * knobSizeMultiplier;
        this.trackX = padding;
        this.trackY = (this._height - this.trackHeight) / 2;
      }
    }

    /**
     * Redraws the slider based on the current value and settings.
     */
    redraw() {
      // Clamp value within min and max
      this._value = Math.min(this._max, Math.max(this._min, this._value));

      // Calculate ratio
      let ratio;
      if (this.log) {
        // Use the normalized value computed as (raw - min) / (max - min)
        // Note: For a dB parameter, _min is -60 and _max is 6.
        ratio = (this._value - this._min) / (this._max - this._min);
      } else {
        ratio = (this._value - this._min) / (this._max - this._min);
      }
      ratio = Math.max(0, Math.min(1, ratio));

      // Update convValue
      if (this.conv) {
        const x = this._value;
        try {
          // Safer alternative to eval: using Function constructor
          this.convValue = Function('x', `return ${this.conv};`)(x);
        } catch (error) {
          this.convValue = this._value;
        }
      } else {
        this.convValue = this._value;
      }

      if (typeof this.convValue === "number") {
        this.convValue = this.convValue.toFixed(this.digits);
      }

      // Update ARIA attributes for accessibility
      this.elem.setAttribute('aria-valuenow', this._value);
      this.elem.setAttribute('aria-orientation', this.isHorizontal ? "horizontal" : "vertical");

      // Draw the slider
      this.drawSlider(ratio);

      // Update tooltip if necessary
      if (this.fireflag) {
        this.showtip(0);
        this.fireflag = false;
      }

      // Update label
      this.setupLabel();

      // Update linked param if exists
      if (this.linkedParam) {
        if (parseFloat(this.linkedParam.value) !== this._value) {
          this.updatingFromSlider = true;
          this.linkedParam.value = this._value;
          this.updatingFromSlider = false;
        }
      }
    }

    /**
     * Draws the slider on the canvas based on the provided ratio.
     * @param {number} ratio - A value between 0 and 1 representing the current slider position.
     */
    drawSlider(ratio) {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this._width, this._height);

      try {
        // Draw centered track line
        ctx.strokeStyle = "#ffffff"; // Track color
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (this.isHorizontal) {
          const centerY = this.trackY + this.trackHeight / 2;
          ctx.moveTo(this.trackX, centerY);
          ctx.lineTo(this.trackX + this.trackLength, centerY);
        } else {
          const centerX = this.trackX + this.trackHeight / 2;
          ctx.moveTo(centerX, this.trackY);
          ctx.lineTo(centerX, this.trackY + this.trackLength);
        }
        ctx.stroke();

        // Draw filled portion
        ctx.strokeStyle = this.coltab[3] || '#e00'; // Fill color
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (this.isHorizontal) {
          const centerY = this.trackY + this.trackHeight / 2;
          ctx.moveTo(this.trackX, centerY);
          ctx.lineTo(this.trackX + this.trackLength * ratio, centerY);
        } else {
          const centerX = this.trackX + this.trackHeight / 2;
          ctx.moveTo(centerX, this.trackY + this.trackLength * (1 - ratio));
          ctx.lineTo(centerX, this.trackY + this.trackLength);
        }
        ctx.stroke();

        // Draw equilateral triangular knob/pointer
        ctx.fillStyle = this.coltab[2] || '#fff'; // Knob color
        ctx.strokeStyle = this.coltab[3] || '#777'; // Knob border color
        ctx.lineWidth = 2;

        ctx.beginPath();
        const side = this.knobSize; // Length of each side of the triangle
        const height = (Math.sqrt(3) / 2) * side; // Height of equilateral triangle

        if (this.isHorizontal) {
          const knobX = this.trackX + this.trackLength * ratio; // Knob position on the X-axis
          const knobY = this.trackY + this.trackHeight / 2; // Center Y position

          // Define triangle points for horizontal slider (pointing right)
          // Tip at (knobX, knobY)
          // Base shifted left by height
          const tipX = knobX;
          const tipY = knobY;

          const baseLeftX = knobX - height;
          const baseTopY = knobY - (side / 2);
          const baseBottomY = knobY + (side / 2);

          ctx.moveTo(tipX, tipY); // Tip of the triangle
          ctx.lineTo(baseLeftX, baseTopY); // Top-left point
          ctx.lineTo(baseLeftX, baseBottomY); // Bottom-left point
          ctx.closePath();
        } else {
          const knobX = this.trackX + this.trackHeight / 2; // Center X position
          const knobY = this.trackY + this.trackLength * (1 - ratio); // Knob position on the Y-axis

          // Define triangle points for vertical slider (pointing up)
          // Tip at (knobX, knobY)
          // Base shifted down by height
          const tipX = knobX;
          const tipY = knobY;

          const baseLeftX = knobX - (side / 2);
          const baseRightX = knobX + (side / 2);
          const baseBottomY = knobY + height;

          ctx.moveTo(tipX, tipY); // Tip of the triangle
          ctx.lineTo(baseLeftX, baseBottomY); // Bottom-left point
          ctx.lineTo(baseRightX, baseBottomY); // Bottom-right point
          ctx.closePath();
        }

        ctx.fill();
        ctx.stroke();
      } catch (error) {
        // Handle any drawing errors silently
      }
    }

    /**
     * Sets the internal value without triggering events.
     * @param {number} v - The value to set.
     * @returns {boolean} - Returns true if the value changed, else false.
     */
    _setValue(v, fire = true) { // Added fire parameter for flexibility
      if (this._step && this._step > 0) {
        // Align v to the nearest step
        v = Math.round((v - this._min) / this._step) * this._step + this._min;
      }

      // Clamp value within min and max
      v = Math.min(this._max, Math.max(this._min, v));

      // Round to avoid floating-point precision issues
      const decimalPlaces = this.digits > 0 ? this.digits : 0;
      v = parseFloat(v.toFixed(decimalPlaces));

      // Determine if the value has changed
      const valueChanged = v !== this._value;

      if (valueChanged) {
        this._value = v;
        this.fireflag = true;
        this.redraw();
        return true;
      }
      return false;
    }

    /**
     * Sets the value and optionally fires events.
     * @param {number} v - The value to set.
     * @param {boolean} fire - Whether to fire 'input' and 'change' events.
     */
    setValue(v, fire = false) {
      if (this._setValue(v, fire)) {
        if (fire) {
          const priority = getPriority("webaudio-slider");
          if (this.rootParam) {
            // Send the slider's value directly; the ParameterManager will handle transformations
            user1Manager.setRawValue(
              this.rootParam,
              this._value,
              this, // Source controller
              priority
            );
          }
          this.sendEvent("input");
          this.sendEvent("change");
        }
      }
    }

    /**
     * Handles keydown events for accessibility.
     * @param {KeyboardEvent} e - The keyboard event.
     */
    keydown(e) {
      if (!this.enable) return;
      let delta = this._step || 1;
      switch (e.key) {
        case "ArrowUp":
        case "ArrowRight":
          this.setValue(this._value + delta, true);
          break;
        case "ArrowDown":
        case "ArrowLeft":
          this.setValue(this._value - delta, true);
          break;
        default:
          return;
      }
      e.preventDefault();
      e.stopPropagation();
    }

    /**
     * Handles parameter updates from ParameterManager.
     * @param {string} parameterName - The name of the parameter that changed.
     * @param {number} newValue - The new value of the parameter.
     */
    onParameterChanged(parameterName, newValue) {
      if (this.rootParam === parameterName) {
        if (this.isBidirectional) {
          this.updatingFromParameter = true;
          // Update the slider's value with the transformed value from the ParameterManager
          this.setValue(newValue, false);
          this.updatingFromParameter = false;
        }
      }
    }
    handleDoubleClick(e) {
      if (!this.enable) return;
    
      // Reset value to default
      this.setValue(this.defvalue, true);
    
      // Optional: You can add a visual indication or sound effect here if needed
     // console.log(`Slider reset to default value: ${this.defvalue}`);
    }
    /**
     * Handles wheel events for adjusting the slider value.
     * @param {WheelEvent} e - The wheel event.
     */
    wheel(e) {
      if (!this.enable) return;
    
      // Determine scroll direction
      let delta = e.deltaY < 0 ? this._step || 1 : -(this._step || 1);
    
      // Update the value
      this.setValue(this._value + delta, true);
    
      // Prevent default scrolling behavior
      e.preventDefault();
      e.stopPropagation();
    }

    /**
     * Handles pointer down events to initiate dragging.
     * @param {PointerEvent | TouchEvent | MouseEvent} ev - The pointer event.
     */
    pointerdown(ev) {
      if (!this.enable) return;

      // Prevent default to avoid unwanted behaviors
      ev.preventDefault();
      ev.stopPropagation();

      this.elem.focus();
      this.dragging = true;

      if (this.tracking === "rel") {
        // Store initial pointer position and value for REL mode
        const touch = ev.touches && ev.touches.length > 0 ? ev.touches[0] : ev;
        this.startPos = { x: touch.clientX, y: touch.clientY };
        this.startValue = this._value;
        if (this.log && this._min > 0) {
          this.startLog = Math.log(this.startValue / this._min) / Math.log(this._max / this._min);
        }
      } else {
        // ABS mode: update value based on pointer position
        this.updateValueFromPointer(ev);
      }

      // Add event listeners for move and up
      window.addEventListener('mousemove', this.pointermove, { passive: false });
      window.addEventListener('mouseup', this.pointerup);
      window.addEventListener('touchmove', this.pointermove, { passive: false });
      window.addEventListener('touchend', this.pointerup);
      window.addEventListener('touchcancel', this.pointerup);
    }

    /**
     * Handles pointer move events to update the slider value.
     * @param {PointerEvent | TouchEvent | MouseEvent} ev - The pointer event.
     */
    pointermove(ev) {
      if (!this.dragging) return;

      // Prevent default to avoid unwanted behaviors
      ev.preventDefault();
      ev.stopPropagation();

      if (this.tracking === "abs") {
        this.updateValueFromPointer(ev);
      } else if (this.tracking === "rel") {
        this.updateValueFromPointerRel(ev);
      }
    }

    /**
     * Handles pointer up events to end dragging.
     * @param {PointerEvent | TouchEvent | MouseEvent} ev - The pointer event.
     */
    pointerup(ev) {
      if (!this.dragging) return;
      this.dragging = false;

      // Remove event listeners
      window.removeEventListener('mousemove', this.pointermove);
      window.removeEventListener('mouseup', this.pointerup);
      window.removeEventListener('touchmove', this.pointermove, { passive: false });
      window.removeEventListener('touchend', this.pointerup);
      window.removeEventListener('touchcancel', this.pointerup);
    }

    /**
     * Updates the slider value based on absolute pointer position.
     * @param {PointerEvent | TouchEvent | MouseEvent} ev - The pointer event.
     */
    updateValueFromPointer(ev) {
      const touch = ev.touches && ev.touches.length > 0 ? ev.touches[0] : ev;
      const rect = this.canvas.getBoundingClientRect();
      const clientX = touch.clientX;
      const clientY = touch.clientY;
    
      let ratio;
// Compute the pointer ratio as you already do:
if (this.isHorizontal) {
  let x = clientX - rect.left;
  x = Math.max(this.trackX, Math.min(this.trackX + this.trackLength, x));
  ratio = (x - this.trackX) / this.trackLength;
} else {
  let y = clientY - rect.top;
  y = Math.max(this.trackY, Math.min(this.trackY + this.trackLength, y));
  ratio = 1 - (y - this.trackY) / this.trackLength;
}
// (Optional) Add snapping if the ratio is very near 0 or 1:
const snapThreshold = 0.01; // adjust as needed
if (ratio <= snapThreshold) {
  ratio = 0;
} else if (ratio >= 1 - snapThreshold) {
  ratio = 1;
}

// Now compute the new raw value using the parameter manager’s mapping:
let newValue = ratio * (this._max - this._min) + this._min;
this.setValue(newValue, true);
    }
    /**
     * Updates the slider value based on relative pointer movement.
     * @param {PointerEvent | TouchEvent | MouseEvent} ev - The pointer event.
     */
    updateValueFromPointerRel(ev) {
      const touch = ev.touches && ev.touches.length > 0 ? ev.touches[0] : ev;
      const currentPos = { x: touch.clientX, y: touch.clientY };

      // Calculate movement delta
      const deltaX = currentPos.x - this.startPos.x;
      const deltaY = currentPos.y - this.startPos.y;

      // Determine value change based on orientation
      let deltaRatio;
      if (this.isHorizontal) {
        // Sensitivity: 1 to 127, higher means less change per pixel
        deltaRatio = deltaX  * this.sensitivity ;
      } else {
        // Vertical slider: moving up increases, moving down decreases
        deltaRatio = -deltaY  * this.sensitivity ;
      }

      if (this.log && this._min > 0) {
        // Update log ratio
        let newLog = this.startLog + deltaRatio;
        newLog = Math.max(0, Math.min(1, newLog));
        let newValue = this._min * Math.pow(this._max / this._min, newLog);

        // Snap to max or min if near the boundaries to ensure precision
        if (newLog === 1) {
          newValue = this._max;
        } else if (newLog === 0) {
          newValue = this._min;
        }

        this.setValue(newValue, true);
      } else {
        // Linear mode
        let deltaValue;
        if (this.isHorizontal) {
          deltaValue = deltaX  * this.sensitivity;
        } else {
          deltaValue = -deltaY  * this.sensitivity;
        }
        let newValue = this.startValue + deltaValue;

        // Snap to max or min if near the boundaries to ensure precision
        if (newValue >= this._max) {
          newValue = this._max;
        } else if (newValue <= this._min) {
          newValue = this._min;
        }

        this.setValue(newValue, true);
      }
    }

    /**
     * Handles changes from the linked parameter.
     * @param {Event} e - The input event.
     */
    handleParamChange(e) {
      if (this.updatingFromSlider) return; // Prevent circular update
      const newValue = parseFloat(e.target.value);
      if (!isNaN(newValue) && newValue !== this._value) {
        this.setValue(newValue, false);
      }
    }

    /**
     * Updates the linked parameter when the slider value changes.
     */
    updateLinkedParam() {
      if (this.linkedParam) {
        if (parseFloat(this.linkedParam.value) !== this._value) {
          // Prevent param's event listener from triggering slider's update again
          this.updatingFromSlider = true;
          this.linkedParam.value = this._value;
          this.updatingFromSlider = false;
        }
      }
    }

    /**
     * Shows the tooltip after a specified delay.
     * @param {number} delay - Delay in milliseconds before showing the tooltip.
     */
    showtip(delay) {
      setTimeout(() => {
        if (this.tooltip) {
          this.ttframe.style.opacity = 1;
          // Display '-∞' if value is at min
          this.ttframe.textContent = this._value === this._min ? '-∞' : this.convValue;
        }
      }, delay);
    }

    /**
     * Hides the tooltip after a specified delay.
     * @param {number} delay - Delay in milliseconds before hiding the tooltip.
     */
    hidetip(delay) {
      setTimeout(() => {
        this.ttframe.style.opacity = 0;
      }, delay);
    }

    /**
     * Updates the tooltip with the current value.
     * @param {number} ratio - Not used in this implementation but kept for consistency.
     */
    updateTooltip(ratio) {
      let valueToShow = this.convValue;
      if (this.valuetip) {
        valueToShow = this.valuetip.replace("{value}", valueToShow);
      }
      // Display '-∞' if value is at min
      this.ttframe.textContent = this._value === this._min ? '-∞' : valueToShow;
      this.ttframe.style.opacity = 1;
      setTimeout(() => {
        this.ttframe.style.opacity = 0;
      }, 1000);
    }

    /**
     * Sets up the label. Customize this method based on your labeling needs.
     */
    setupLabel() {
      if (this.showLabel) {
        this.label.style.display = "block"; // Show label if show-label is set
        this.label.textContent = this._value === this._min ? '-∞' : this.convValue;
      } else {
        this.label.style.display = "none"; // Hide label if show-label is not set
      }
    }
  });
} catch (error) {
  // Silently handle if the component is already defined or any other errors
}
/**
 * @class WebAudioMonitor
 * @memberof 2DGUI
 * @extends WebAudioControlsWidget
 * @description
 * Custom HTML element representing a lightweight, non-interactive monitor for WebAudio applications. 
 * The monitor displays a numeric value with a customizable label, supporting flexible styling and formatting.
 * 
 * Features:
 * - Configurable attributes:
 *   - `value`: Displays a numeric value, formatted to two decimal places.
 *   - `label`: Optional text label displayed next to the value.
 *   - `fontsize`: Adjusts the font size for both the label and the value.
 *   - `colors`: Semicolon-separated string defining the background and text colors (`background;color`).
 * - High-DPI support for crisp rendering on modern displays.
 * - Responsive layout with customizable dimensions using CSS variables (`--monitor-width`, `--monitor-height`).
 * - Fully accessible:
 *   - Can display tooltips for additional context.
 * - Lightweight and ideal for real-time value monitoring in audio applications.
 * 
 * Example Usage:
 * ```html
 * <webaudio-monitor
 *   value="42.67"
 *   label="Frequency"
 *   fontsize="2vmin"
 *   colors="#202020;#ffffff">
 * </webaudio-monitor>
 * ```
 * 
 * Additional Notes:
 * - This component does not support direct user interaction or input; it is designed purely for display purposes.
 * - It integrates seamlessly with the WebAudioControls library, providing a consistent visual style.
 * 
 * @see WebAudioControlsWidget
 */
try {
  customElements.define(
    "webaudio-monitor",
    class WebAudioMonitor extends WebAudioControlsWidget {
      static get observedAttributes() {
        return ["value", "label", "fontsize", "colors"];
      }

      constructor() {
        super();

        // Shadow DOM setup
        const root = this.attachShadow({ mode: "open" });
        root.innerHTML = `
          <style>
            :host {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: var(--monitor-width, 10vmin);
              height: var(--monitor-height, 3vmin);
              font-size: var(--monitor-fontsize, 2.4vmin);
              background-color: var(--monitor-bg-color, #0000007d);
              color: var(--monitor-text-color, #fff);
              border: 1px solid var(--monitor-border-color, #000);
              border-radius: 0.5vmin;
              padding: 0.3vmin;
              box-sizing: border-box;
              text-align: center;
              font-family: Arial, sans-serif;
            }

            .label {
              margin-right: 0.5vmin;
              font-weight: bold;
            }

            .value {
              font-variant-numeric: tabular-nums;
            }
          </style>
          <div class="label"></div>
          <div class="value">0.00</div>
        `;

        // Element references
        this.labelEl = root.querySelector(".label");
        this.valueEl = root.querySelector(".value");

        // Default settings
        this._value = 0;
        this._label = "Monitor";
        this._colors = "#0000007d;#ffffff";
      }

      // Attribute changes
      attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
          switch (name) {
            case "value":
              this._value = parseFloat(newValue || "0").toFixed(2);
              break;
            case "label":
              this._label = newValue || "Monitor";
              break;
            case "fontsize":
              this.style.setProperty("--monitor-fontsize", newValue || "2.4vmin");
              break;
            case "colors":
              const [bgColor, textColor] = (newValue || "").split(";");
              this.style.setProperty("--monitor-bg-color", bgColor || "#0000007d");
              this.style.setProperty("--monitor-text-color", textColor || "#fff");
              break;
          }
          this.updateContent();
        }
      }

      // Update content
      updateContent() {
        this.labelEl.textContent = this._label;
        this.valueEl.textContent = this._value;
      }

      connectedCallback() {
        this.updateContent();
      }

      // Getter and setter for value
      get value() {
        return this._value;
      }

      set value(val) {
        this._value = parseFloat(val || "0").toFixed(2);
        this.setAttribute("value", this._value);
      }

      // Getter and setter for label
      get label() {
        return this._label;
      }

      set label(val) {
        this._label = val || "Monitor";
        this.setAttribute("label", this._label);
      }
    }
  );
} catch (error) {
  console.log("webaudio-monitor already defined");
}


/**
 * @class WebAudioSwitch
 * @memberof 2DGUI
 * @extends WebAudioControlsWidget
 * @description
 * Custom HTML element representing a switch control for WebAudio applications. 
 * The switch supports multiple types (`toggle`, `kick`, `radio`, `sequential`) 
 * and integrates with the ParameterManager for dynamic state management.
 * 
 * Features:
 * - Configurable attributes: `type`, `min`, `max`, `step`, `colors`, `group`.
 * - Supports group behavior for radio switches and sequential cycling.
 * - High-DPI support with dynamic resizing for responsive layouts.
 * - Emits standard DOM events (`input`, `change`) for state changes.
 * - ARIA attributes for accessibility and keyboard interaction.
 * - Customizable visuals with hexagon or circle shapes depending on type.
 */
try {
  // Helper functions
  function drawHexagon(ctx, x, y, radius, fillStyle, strokeStyle) {
    const sides = 6;
    const angleStep = (2 * Math.PI) / sides;
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const angle = i * angleStep - Math.PI / 2; // Start from the top
      const px = x + radius * Math.cos(angle);
      const py = y + radius * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawSquare(ctx, x, y, size, fillStyle, strokeStyle) {
    const half = size / 2;
    ctx.beginPath();
    ctx.rect(x - half, y - half, size, size);
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  function drawTriangle(
    ctx,
    x, 
    y, 
    size, 
    fillStyle, 
    strokeStyle, 
    rotation = 0, 
    direction = 'up'
  ) {
    // Save the canvas state
    ctx.save();
    
    // Decide how much to shift the arrow in each direction.
    // The exact offset depends on how far you want it to move.
    // For an equilateral triangle of side `size`, its “radius” is ~ `size/2`.
    // If you want a more pronounced offset, increase these values.
    let xOffset = 0;
    let yOffset = 0;
    
    switch (direction.toLowerCase()) {
      case 'left':
        // Move arrow to the right side
        xOffset = size * 0.2;   // Tweak this factor as needed
        break;
      case 'right':
        // Move arrow to the left side
        xOffset = -size * 0.2;  // Tweak this factor as needed
        break;
      case 'up':
        // Move arrow downward
        yOffset = size * 0.2;
        break;
      case 'down':
        // Move arrow upward
        yOffset = -size * 0.2;
        break;
    }
  
    // First move to the overall center (x, y) ...
    ctx.translate(x, y);
    // ... and then apply your offset to push it to the “opposite” side
    ctx.translate(xOffset, yOffset);
    
    // Now rotate it by the specified angle
    ctx.rotate(rotation);
  
    // We’re drawing the triangle around (0,0), so that translations above
    // easily move the whole shape around.
    
    // Compute the height of the equilateral triangle
    const h = size * Math.sqrt(3) / 2;
  
    // The tip is “up” at y = -(2*h/3) if rotation = 0
    const x1 = 0;
    const y1 = -(2 * h) / 3;
    const x2 = -size / 2;
    const y2 = h / 3;
    const x3 = size / 2;
    const y3 = h / 3;
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.closePath();
    
    ctx.fillStyle = fillStyle;
    ctx.fill();
    
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Restore the canvas state
    ctx.restore();
  }

  customElements.define("webaudio-switch", class WebAudioSwitch extends WebAudioControlsWidget {
    constructor() {
      super();

      // Bind methods
      this.pointerdown = this.pointerdown.bind(this);
      this.keydown = this.keydown.bind(this);
      this.wheel = this.wheel.bind(this);
      this.redraw = this.redraw.bind(this);
      this.handleParamChange = this.handleParamChange.bind(this);
      this.kickVisualActive = false; // New visual-only flag

      // Initialize properties for ResizeObserver
      this.resizeObserver = null;

      // Initialize group management
      if (!window.webaudioSwitchGroups) {
        window.webaudioSwitchGroups = {};
      }
    }

    connectedCallback() {
      let root;
      if (this.attachShadow) {
        root = this.attachShadow({ mode: 'open' });
      } else {
        root = this;
      }

      // Define HTML structure with updated CSS
      root.innerHTML = `
      <style>
        ${this.basestyle}
        :host {
          display: inline-block;
          position: relative;
          margin: 0;
          padding: 0;
          font-family: sans-serif;
          font-size: 11px;
          cursor: pointer;
          user-select: none;
          width: 100%;
          height: 100%;
        }
        .webaudio-switch-body {
          position: relative;
          width: 100%;
          height: 100%;
          touch-action: none;
        }
        canvas.webaudio-switch-canvas {
          display: block;
          width: 100%;
          height: 100%;
          z-index: 1; /* Ensure canvas is below label */
        }
        .webaudioctrl-tooltip {
          position: absolute;
          top: -25px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.7);
          color: #fff;
          padding: 2px 5px;
          border-radius: 3px;
          font-size: 10px;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .webaudioctrl-label {
          position: absolute;
          pointer-events: none; /* Don't block interaction */
          font-size: 14px; /* Adjust font size if necessary */
          color: var(--label-color, #333); /* Dynamic color */
          font-family: 'Orbit', sans-serif;
          z-index: 2; /* Ensure it appears above the canvas */
        }
        :host(:focus) .webaudio-switch-body {
          outline: none;
        }
      </style>
      <div class='webaudio-switch-body' tabindex='1'>
        <canvas class='webaudio-switch-canvas'></canvas>
        <div class='webaudioctrl-tooltip'></div>
        <div part="label" class="webaudioctrl-label"><slot></slot></div>
      </div>
    `;
      // Reference elements
      this.elem = root.querySelector('.webaudio-switch-body');
      this.canvas = root.querySelector('canvas.webaudio-switch-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.ttframe = root.querySelector('.webaudioctrl-tooltip');
      this.label = root.querySelector('.webaudioctrl-label');

      // Initialize properties
      this.enable = this.getAttr("enable", 1);
      this.tracking = this.getAttr("tracking", "rel");
      this.type = this.getAttribute("type") || "toggle"; // Types: toggle, kick, radio, sequential
      this.group = this.getAttribute("group") || null; // Group name for radio switches
      this._colors = this.getAttribute("colors") || "#e00;#333"; // background; stroke/fill
      this.outline = this.getAttribute("outline") || "2px solid #444";
      // NEW: initialize the direction attribute (valid options: "up", "down", "left", "right")
      this.direction = this.getAttribute("direction") || "right";


      this.setupLabel();

      // Process colors
      this.coltab = this._colors.split(";").map(color => {
        color = color.trim();
        if (color.startsWith("var(") && color.endsWith(")")) {
          const varName = color.slice(4, -1).trim();
          const resolvedColor = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
          return resolvedColor || "#000";
        }
        return color;
      });
      while (this.coltab.length < 2) this.coltab.push("#000"); // Ensure at least two colors

      // Define 'state' property
      Object.defineProperty(this, 'state', {
        get: () => this._state,
        set: (v) => { this.setState(v, true); }
      });

      // Register in group if type is radio
      if (this.type === "radio" && this.group) {
        if (!window.webaudioSwitchGroups[this.group]) {
          window.webaudioSwitchGroups[this.group] = [];
        }
        window.webaudioSwitchGroups[this.group].push(this);
        //console.log(`Switch ID: ${this.id} registered to group '${this.group}'`);
      }

      // Global registration
      window.webaudioSwitches = window.webaudioSwitches || {};
      if (this.id) {
        window.webaudioSwitches[this.id] = this;
        //console.log(`Switch ID: ${this.id} registered globally`);
      }

      // Initialize min, max, step
      this._min = parseInt(this.getAttribute("min"));
      this._max = parseInt(this.getAttribute("max"));
      this._step = parseInt(this.getAttribute("step")) || 1;

      // Validate min and max for sequential type
      if (this.type === "sequential") {
        if (isNaN(this._min) || isNaN(this._max)) {
          console.warn(`webaudio-switch: 'sequential' type requires valid 'min' and 'max' attributes.`);
          this._min = 1;
          this._max = 5;
        }
        if (this._min >= this._max) {
          console.warn(`webaudio-switch: 'min' should be less than 'max' for 'sequential' type.`);
          this._min = 1;
          this._max = 5;
        }
      }

      // Initialize state
      let initialState = parseInt(this.getAttribute("state"));
      if (isNaN(initialState)) {
        initialState = this.type === "sequential" ? this._min : 0;
      }
      if (this.type === "sequential") {
        if (initialState < this._min || initialState > this._max) {
          initialState = this._min;
        }
      }
      this._state = initialState;

      // Ensure initial state is within range
      this.setState(this._state, false);

      // Initial setup
      this.setupCanvas();
      this.redraw();

      // Parameter Manager Integration
      this.rootParam = this.getAttr("root-param", null); // New attribute
      this.isBidirectional = this.getAttr("is-bidirectional", false); // New attribute

      // Register with ParameterManager if rootParam is specified
      if (this.rootParam) {
        // Subscribe to ParameterManager updates for this parameter with the retrieved priority
        const priority = getPriority("webaudio-switch");

        user1Manager.subscribe(this, this.rootParam, priority);
        //console.log(`Switch ID: ${this.id} subscribed to root parameter '${this.rootParam}'`);
      }

      // Add a click event listener for debugging
      this.elem.addEventListener('click', (e) => {
        //console.log(`Switch clicked: ID=${this.id}, Type=${this.type}, Group=${this.group}`);
      });

      // Event listeners
      this.elem.addEventListener('keydown', this.keydown);
      this.elem.addEventListener('mousedown', this.pointerdown, { passive: false });
      this.elem.addEventListener('touchstart', this.pointerdown, { passive: false });
      this.elem.addEventListener('wheel', this.wheel, { passive: false });

      // ResizeObserver for responsive behavior
      this.resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
          this.setupCanvas();
          this.redraw();
        }
      });
      this.resizeObserver.observe(this);
      //console.log(`Switch ID: ${this.id} - ResizeObserver attached`);

      // Add to widget manager
      if (window.webAudioControlsWidgetManager) {
        window.webAudioControlsWidgetManager.addWidget(this);
        //console.log(`Switch ID: ${this.id} added to widget manager`);
      }
    }

    disconnectedCallback() {
      // Remove event listeners
      this.elem.removeEventListener('keydown', this.keydown);
      this.elem.removeEventListener('mousedown', this.pointerdown);
      this.elem.removeEventListener('touchstart', this.pointerdown);
      this.elem.removeEventListener('wheel', this.wheel, { passive: false });

      // Remove additional event listeners
      this.elem.removeEventListener('click', () => {});

      // Unobserve ResizeObserver
      if (this.resizeObserver) {
        this.resizeObserver.unobserve(this);
        //console.log(`Switch ID: ${this.id} - ResizeObserver detached`);
      }

      // Additional cleanup
      if (this.linkedParam) {
        this.linkedParam.removeEventListener("input", this.handleParamChange);
      }

      // Unsubscribe from ParameterManager
      if (this.rootParam) {
        user1Manager.unsubscribe(this, this.rootParam);
        //console.log(`Switch ID: ${this.id} unsubscribed from root parameter '${this.rootParam}'`);
      }

      // Remove from widget manager
      if (window.webAudioControlsWidgetManager) {
        window.webAudioControlsWidgetManager.removeWidget(this);
        //console.log(`Switch ID: ${this.id} removed from widget manager`);
      }

      // Remove from group if radio
      if (this.type === "radio" && this.group && window.webaudioSwitchGroups[this.group]) {
        window.webaudioSwitchGroups[this.group] = window.webaudioSwitchGroups[this.group].filter(sw => sw !== this);
        //console.log(`Switch ID: ${this.id} removed from group '${this.group}'`);
      }
    }

    setupCanvas() {
      // Get actual size
      const rect = this.elem.getBoundingClientRect();
      this._width = rect.width;
      this._height = rect.height;

      // High DPI handling
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = this._width * dpr;
      this.canvas.height = this._height * dpr;
      this.ctx.scale(dpr, dpr);

      // Recalculate colors
      this.coltab = this._colors.split(";").map(color => {
        color = color.trim();
        if (color.startsWith("var(") && color.endsWith(")")) {
          const varName = color.slice(4, -1).trim();
          const resolvedColor = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
          return resolvedColor || "#000";
        }
        return color;
      });
      while (this.coltab.length < 2) this.coltab.push("#000");

      // Recalculate dimensions
      this.radius = Math.min(this._width, this._height) / 2 * 0.8; // 80% of half the smallest dimension
      this.centerX = this._width / 2;
      this.centerY = this._height / 2;

      //console.log(`Switch ID: ${this.id} - Canvas setup: width=${this._width}, height=${this._height}, radius=${this.radius}`);
    }

    redraw() {
      // Draw the switch based on the current state and type
      this.drawSwitch();

      // Update tooltip if necessary
      if (this.fireflag) {
        this.showtip(0);
        this.fireflag = false;
      }
      this.style.setProperty('--label-color', this.coltab[1]);

      // Now apply to all types (toggle, kick, radio, sequential, etc.)
/*       if (this.isActive()) {
        // Use coltab[0] for an "active" label color
        this.style.setProperty('--label-color', this.coltab[1]);
      } else {
        // Use coltab[1] for an "inactive" label color
        this.style.setProperty('--label-color', this.coltab[0]);
      } */

      // Update linked param if exists
      if (this.linkedParam) {
        if (parseInt(this.linkedParam.value) !== this._state) {
          this.updatingFromSwitch = true;
          this.linkedParam.value = this._state;
          this.updatingFromSwitch = false;
          //console.log(`Switch ID: ${this.id} - Linked parameter updated to ${this._state}`);
        }
      }
    }

    /**
     * Draws the switch on the canvas based on its type and state.
     */
    drawSwitch() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this._width, this._height);

      if (this.type === 'kick') {
        const direction = this.getAttribute("direction") || "up";
        let rotation = 0;
        switch (direction.toLowerCase()) {
          case "up":
            rotation = 0;
            break;
          case "right":
            rotation = Math.PI / 2;
            break;
          case "down":
            rotation = Math.PI;
            break;
          case "left":
            rotation = -Math.PI / 2;
            break;
        }
      
        // Draw main triangle
        const fullSize = this.radius * 2;
        drawTriangle(
          ctx, 
          this.centerX, 
          this.centerY, 
          fullSize, 
          this.coltab[0], 
          this.coltab[1], 
          rotation, 
          direction
        );
      
        // Inner triangle
        if (this.kickVisualActive) {
          drawTriangle(
            ctx, 
            this.centerX, 
            this.centerY, 
            fullSize, 
            this.coltab[1], 
            this.coltab[0], 
            rotation,
            direction
          );
        }
        
       // console.log(`Drawing Toggle Switch ID: ${this.id} - isActive: ${this.isActive()}`);
      } else if (this.type === 'toggle') {


        // Draw outer hexagon
        drawHexagon(ctx, this.centerX, this.centerY, this.radius, this.coltab[0], this.coltab[1]);

        // Draw inner inverted hexagon only if kickVisualActive is true
        if (this.isActive()) {
          drawHexagon(ctx, this.centerX, this.centerY, this.radius * 0.77, this.coltab[1], this.coltab[0]);
        }
                
      } else if (this.type === 'radio') {
        // Draw the main circle
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.isActive() ? this.coltab[1] : this.coltab[0]; // Fill with stroke color if active
        ctx.fill();
        ctx.strokeStyle = this.coltab[1];
        ctx.lineWidth = 2;
        ctx.stroke();

        // Log active state
        //console.log(`Drawing Radio Switch ID: ${this.id} - isActive: ${this.isActive()}`);

        // Note: Labels are handled by the `.webaudioctrl-label` div and do not need to be drawn on the canvas
      } else {
        // Default circle drawing for other types
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.isActive() ? this.coltab[1] : this.coltab[0]; // Background or fill with stroke color
        ctx.fill();
        ctx.strokeStyle = this.coltab[1]; // Stroke color
        ctx.lineWidth = 2;
        ctx.stroke();

        // Log active state
        //console.log(`Drawing Switch ID: ${this.id} - isActive: ${this.isActive()}`);

        // For active state, fill a smaller circle
        if (this.isActive()) {
          ctx.beginPath();
          ctx.arc(this.centerX, this.centerY, this.radius * 0.8, 0, Math.PI * 2);
          ctx.fillStyle = this.coltab[1]; // Fill color (stroke color)
          ctx.fill();
        }
      }

      // Add any additional indicators if needed
      this.drawModeIndicator();
    }

    /**
     * Draws additional indicators based on the current type and state.
     */
    drawModeIndicator() {
      const ctx = this.ctx;

      // Set text styling
      ctx.fillStyle = '#fff';
      const fontSize = this.radius * 0.5;
      ctx.font = `${fontSize}px Arial`; // Changed from 'Orbit' to 'Arial' for compatibility
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Display text only for the 'sequential' type
      let text = '';
      if (this.type === 'sequential') {
        text = `${this._state}`; // Display state as text for sequential
      }

      // Draw the text if it's not empty
      if (text) {
        ctx.fillText(text, this.centerX, this.centerY);
        //console.log(`Switch ID: ${this.id} - Mode Indicator: ${text}`);
      }
    }

    /**
     * Determines if the switch is active based on the type and state.
     * @returns {boolean}
     */
    isActive() {
      switch (this.type) {
        case 'toggle':
          return this._state === 1;
        case 'kick':
          return this._state === 1;
        case 'radio':
          return this._state === 1; // Radio should be active only if _state is 1
        case 'sequential':
          return this._state > this._min;
        default:
          return this._state === 1;
      }
    }

    setValue(v, f) {
      this.value = v;
      this.checked = (!!v);
      if (this.value != this.oldvalue) {
        this.redraw();
        this.showtip(0);
        if (f) {
          this.sendEvent("input");
          this.sendEvent("change");
        }
        this.oldvalue = this.value;
      }
    }

    _setState(v) {
      v = parseInt(v);
      let changed = false;

     // console.log(`_setState called for Switch ID: ${this.id}, Current State: ${this._state}, New State: ${v}`);

      if (this.type === 'toggle') {
        v = v ? 1 : 0;
        if (v !== this._state) {
         // console.log(`Toggle: State changed from ${this._state} to ${v}`);
          this._state = v;
          changed = true;
        }
      } else if (this.type === 'radio') {
        // Log for debugging radio behavior
        //console.log(`Radio: Processing Switch ID: ${this.id}, Group: ${this.group}, New State: ${v}`);
        v = v ? 1 : 0;
        if (v !== this._state) {
         // console.log(`Radio: State changed for ${this.id} from ${this._state} to ${v}`);
          this._state = v;
          changed = true;

          if (v === 1 && this.group && window.webaudioSwitchGroups[this.group]) {
          //  console.log(`Radio: Deactivating other switches in group: ${this.group}`);
            window.webaudioSwitchGroups[this.group].forEach(sw => {
              if (sw !== this) {
                console.log(`Radio: Turning off Switch ID: ${sw.id}`);
                sw._setState(0); // Turn off other switches without firing events to prevent infinite loops
                sw.redraw(); // Ensure other switches are visually updated
              }
            });
          }
        }
      } else if (this.type === 'sequential') {
        // Sequential type logic
        if (v !== this._state) {
          //console.log(`Sequential: State changed from ${this._state} to ${v}`);
          this._state = v;
          changed = true;
        }
      } else if (this.type === 'kick') {
        if (v !== this._state) {
          //console.log(`Kick: State changed from ${this._state} to ${v}`);
          this._state = v;
          changed = true;
        }
      }

      if (changed) {
        //console.log(`Switch ID: ${this.id} - State changed to: ${this._state}`);
        this.fireflag = true;
        this.redraw(); // Trigger visual update
        return true;
      }

      return false;
    }

    setState(v, fire = false) {
      //console.log(`setState called for Switch ID: ${this.id}, Type: ${this.type}, New Value: ${v}, Fire: ${fire}`);

      this._setState(v);

      if (fire) {
        this.sendEvent('input');
        this.sendEvent('change');
       // console.log(`Dispatching events for Switch ID: ${this.id}`);
      }

      // Redraw to update the visual state and label color
      this.redraw();
    }

    /**
     * Handles parameter updates from ParameterManager.
     * @param {string} parameterName - The name of the parameter that changed.
     * @param {number} newValue - The new value of the parameter.
     */
    onParameterChanged(parameterName, newValue) {
      if (this.rootParam === parameterName) {
       // console.log(`Parameter '${parameterName}' changed to ${newValue} for Switch ID: ${this.id}`);
        if (this.isBidirectional && this._state !== newValue) {
         // console.log(`Updating Switch ID: ${this.id} state to ${newValue} based on parameter change`);
          this.setState(newValue, false); // Avoid triggering another update to ParameterManager
        }
      }
    }

    updateParameter(normalizedValue, mode) {
      const priority = getPriority(`webaudio-${mode}`);
      user1Manager.setNormalizedValue(
        this.rootParam,
        normalizedValue,
        this, // Source controller
        priority
      );

      console.debug(`[setState] ${mode} mode: Updated parameter '${this.rootParam}' with normalized value: ${normalizedValue}`);
    }

    normalizeValue(value, min, max) {
      return (value - min) / (max - min);
    }

    keydown(e) {
      if (!this.enable) return;
      switch (this.type) {
        case 'toggle':
          if (e.key === "Enter" || e.key === " ") {
            this.toggleState();
            e.preventDefault();
            e.stopPropagation();
          }
          break;
        case 'kick':
          if (e.key === "Enter" || e.key === " ") {
            this.triggerKick();
            e.preventDefault();
            e.stopPropagation();
          }
          break;
        case 'radio':
          if (["Enter", " "].includes(e.key)) {
            this.activateRadio();
            e.preventDefault();
            e.stopPropagation();
          }
          break;
        case 'sequential':
          if (["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "Enter", " "].includes(e.key)) {
            this.cycleState();
            e.preventDefault();
            e.stopPropagation();
          }
          break;
        default:
          if (e.key === "Enter" || e.key === " ") {
            this.toggleState();
            e.preventDefault();
            e.stopPropagation();
          }
      }
    }

    wheel(e) {
      if (!this.enable) return;
      let delta = e.deltaY < 0 ? 1 : -1;
      if (e.shiftKey) delta *= 5; // Increase sensitivity with shift

      if (this.type === 'sequential') {
        this.cycleState(delta);
      } else if (this.type === 'radio') {
        // Typically, wheel interactions aren't common for radio buttons,
        // but you can define behavior if needed.
        // For example, activate the next switch in the group.
        if (this.group && window.webaudioSwitchGroups[this.group]) {
          const group = window.webaudioSwitchGroups[this.group];
          const currentIndex = group.indexOf(this);
          let nextIndex = currentIndex + (delta > 0 ? 1 : -1);
          if (nextIndex >= group.length) nextIndex = 0;
          if (nextIndex < 0) nextIndex = group.length - 1;
          group[nextIndex].activateRadio();
        }
      }
      e.preventDefault();
      e.stopPropagation();
    }

    pointerdown(ev) {
      if (!this.enable) return;

      // Prevent default to avoid unwanted behaviors
      ev.preventDefault();
      ev.stopPropagation();

      this.elem.focus();

      // Toggle or trigger based on type
      switch (this.type) {
        case 'toggle':
          this.toggleState();
          break;
        case 'kick':
          this.triggerKick();
          break;
        case 'radio':
          this.activateRadio();
          break;
        case 'sequential':
          this.cycleState();
          break;
        default:
          this.toggleState();
      }
    }

    /**
     * Toggles the switch state (for toggle type).
     */
    toggleState() {
      //console.log(`toggleState called for Switch ID: ${this.id}`);
      const newState = this._state ? 0 : 1;
      this.setState(newState, true);
    }

    /**
     * Triggers a kick (momentary press).
     */
    triggerKick() {
      console.log(`triggerKick called for Switch ID: ${this.id}`);
      // Existing behavior - do not change parameter logic
      //user1Manager.setToMiddle(this.rootParam); // sets param to 0.5 or whatever is needed

      // Now add the visual effect
      this.kickVisualActive = true;
      this.redraw(); // Redraw to show the inner hexagon

      // Reset after 100ms (adjust time as needed)
      setTimeout(() => {
        this.kickVisualActive = false;
        this.redraw(); // Redraw to remove the inner hexagon
      }, 100);
    }

    /**
     * Cycles through states (for sequential type).
     * Accepts an optional delta to increment/decrement.
     */
    cycleState(delta = 1) {
      //console.log(`cycleState called for Switch ID: ${this.id}, Delta: ${delta}`);
      let newState = this._state + delta * this._step;
      if (newState > this._max) {
        newState = this._min;
      } else if (newState < this._min) {
        newState = this._max;
      }
      this.setState(newState, true);
    }

    /**
     * Activates the radio switch, ensuring only this switch is active in its group.
     */
    activateRadio() {
      //console.log(`activateRadio called for Switch ID: ${this.id}`);
      if (this.type !== "radio") return;
      this.setState(1, true); // Activate this radio button
    }

    // Handle changes from the linked param
    handleParamChange(e) {
   //   console.log(`handleParamChange called for Switch ID: ${this.id}`);
      if (this.updatingFromSwitch) return; // Prevent circular update
      const newValue = parseInt(e.target.value);
      if (!isNaN(newValue) && newValue !== this._state) {
        //console.log(`Switch ID: ${this.id} - Updating state to ${newValue} from parameter change`);
        this.setState(newValue, false);
      }
    }

    // Update linked param when switch changes
    updateLinkedParam() {
      if (this.linkedParam) {
        if (parseInt(this.linkedParam.value) !== this._state) {
          // Prevent param's event listener from triggering switch's update again
          this.updatingFromSwitch = true;
          this.linkedParam.value = this._state;
          this.updatingFromSwitch = false;
          //console.log(`Switch ID: ${this.id} - Linked parameter updated to ${this._state}`);
        }
      }
    }
  });
} catch (error) {
  console.error("webaudio-switch already defined or error in definition:", error);
}
/**
 * @class WebAudioParam
 * @memberof 2DGUI
 * @extends WebAudioControlsWidget
 * @description
 * Custom HTML element for handling parameter values in WebAudio contexts.
 * Designed for seamless integration with the `WebAudioNumericKeyboard` and `ParameterManager`.
 *
 * Features:
 * - **Integration**: Connects to `ParameterManager` for real-time updates and management.
 * - **User Interaction**: Supports mouse, keyboard, touch, and scroll wheel inputs.
 * - **Keyboard Interaction**: Triggers `WebAudioNumericKeyboard` for precise numeric input.
 * - **Dynamic Value Handling**: Supports logarithmic and linear scales.
 * - **Accessibility**: Includes ARIA attributes for usability.
 * - **Customizable**: Attributes like `colors`, `fontsize`, `src` for appearance adjustments.
 * 
 * Attributes:
 * - `root-param` - Links to a parameter in the `ParameterManager`.
 * - `is-bidirectional` - Enables two-way communication with `ParameterManager`.
 * - `value` - The current value of the parameter.
 * - `min` & `max` - Parameter range.
 * - `colors` - Specifies colors for display and background.
 */
  try {
    customElements.define("webaudio-param", class WebAudioParam extends WebAudioControlsWidget {
      constructor() {
        super();
        this.addEventListener("keydown", this.keydown);
        this.addEventListener("mousedown", this.pointerdown, {passive: false});
        this.addEventListener("touchstart", this.pointerdown, {passive: false});
        this.addEventListener("wheel", this.wheel, { passive: false });
        this.addEventListener("mouseover", this.pointerover);
        this.addEventListener("mouseout", this.pointerout);
        this.addEventListener("contextmenu", this.contextMenu);
  
        this.updating = false; // Initialize the updating flag
      }
  
      connectedCallback() {
        let root;
        if(this.attachShadow)
          root = this.attachShadow({mode: 'open'});
        else
          root = this;
        root.innerHTML = `
  <style>
  ${this.basestyle}
  :host{
    display:inline-block;
    user-select:none;
    margin:0;
    padding:0;
    font-family: sans-serif;
    font-size: 8px;
    cursor:pointer;
    position:relative;
    border-radius: 10px;
    vertical-align:baseline;
  }
  .webaudio-param-body{
    display:inline-block;
    position:relative;
    text-align:center;
    background:none;
    border-radius: 7.7px;
    margin:0;
    padding:0;
    font-family:sans-serif;
    font-size:11px;
    vertical-align:bottom;
    border:none;
  }
  </style>
  <input class='webaudio-param-body'  type='button'  value='0' inputmode='none' tabindex='1' touch-action='none'/>
  <div class='webaudioctrl-tooltip'></div>
  `;
        // Use querySelector to reliably select elements
        this.elem = root.querySelector('.webaudio-param-body');
        this.ttframe = root.querySelector('.webaudioctrl-tooltip');
  
        this.enable = this.getAttr("enable",1);
        this._value = this.getAttr("value",0);
        if (!this.hasOwnProperty("value")) {
          Object.defineProperty(this,"value",{
            get: ()=>{ return this._value },
            set: (v)=>{ this._value = v; this.redraw(); }
          });
        }
        this.defvalue = this.getAttr("defvalue",0);
        this._fontsize = this.getAttr("fontsize", "9px"); // Default with unit
        if (!this.hasOwnProperty("fontsize")) {
          Object.defineProperty(this,"fontsize",{
            get: ()=>{ return this._fontsize },
            set: (v)=>{ this._fontsize = v; this.setupImage(); }
          });
        }
        this._src = this.getAttr("src", opt.paramSrc);
        if (!this.hasOwnProperty("src")) {
          Object.defineProperty(this,"src",{
            get: ()=>{ return this._src },
            set: (v)=>{ this._src = v; this.setupImage(); }
          });
        }
        this.link = this.getAttr("link","");
        this._width = this.getAttr("width", "32px"); // Default with unit
        if (!this.hasOwnProperty("width")) {
          Object.defineProperty(this,"width",{
            get: ()=>{ return this._width },
            set: (v)=>{ this._width = v; this.setupImage(); }
          });
        }
        this._height = this.getAttr("height", "20px"); // Default with unit
        if (!this.hasOwnProperty("height")) {
          Object.defineProperty(this,"height",{
            get: ()=>{ return this._height },
            set: (v)=>{ this._height = v; this.setupImage(); }
          });
        }
        this._colors = this.getAttr("colors", opt.paramColors);
        if (!this.hasOwnProperty("colors")) {
          Object.defineProperty(this,"colors",{
            get: ()=>{ return this._colors },
            set: (v)=>{ this._colors = v; this.setupImage(); }
          });
        }
        this.outline = this.getAttr("outline", opt.outline);
        this.rconv = this.getAttr("rconv", null);
        this.currentLink = null;

        this.setupImage();
  
        // Setup event listener for triggering the numeric keyboard
        this.setupKeyboardInteraction();
  
        if(window.webAudioControlsWidgetManager)
          window.webAudioControlsWidgetManager.updateWidgets();
  
        this.fromLink = ((e)=>{
          if (this.updating) return;
          this.updating = true;
          this.setValue(e.target.convValue.toFixed(e.target.digits));
          this.updating = false;
        }).bind(this);
  
/*         this.elem.onchange = () => {
          if(!this.currentLink.target.conv || (this.currentLink.target.conv && this.rconv)){
            let val = this.value = this.elem.value;
            if(this.rconv){
              let x = +this.elem.value;
              val = eval(this.rconv);
            }
            if(this.currentLink){
              if (!this.currentLink.updating) {
                this.currentLink.updating = true;
                this.currentLink.target.setValue(val, true);
                this.currentLink.updating = false;
              }
            }
          }
        } */


            // Parameter Manager Integration
            this.rootParam = this.getAttr("root-param", null); // New attribute
            this.isBidirectional = this.getAttr("is-bidirectional", "false") === "true"; // Parse as boolean
          
            // Controller name based on the param's ID or a unique identifier
            this.controllerName = this.id || `param-${Math.random().toString(36).substr(2, 9)}`;
          
            // Register with ParameterManager if rootParam is specified
            if (this.rootParam) {
              // Determine controller type for priority mapping
              const controllerType = "webaudio-param"; // Since this is WebAudioParam
          
              // Get priority from Constants
              const priority = getPriority(controllerType);
          
              // Subscribe to ParameterManager updates for this parameter with the retrieved priority
              user1Manager.subscribe(this, this.rootParam, priority);
          
              // Retrieve parameter details
              const paramDetails = user1Manager.getParameter(this.rootParam);
              if (paramDetails) {
                // Set min and max
                this.min = paramDetails.min;
                this.max = paramDetails.max;
          
                // Determine if the parameter is logarithmic
                this.isLogarithmic = paramDetails.scale === 'logarithmic';
              } else {
                console.warn(`Parameter '${this.rootParam}' not found in ParameterManager.`);
              }
            }
          
            this.redraw();
          }      
        disconnectedCallback(){

       // Unsubscribe from ParameterManager
       if (this.rootParam) {
        user1Manager.unsubscribe(this, this.rootParam);
    }

      }
  
      setupImage(){
        this.imgloaded=()=>{
          if(this.src!=""&&this.src!=null){
            this.elem.style.backgroundImage = "url("+this.src+")";
            this.elem.style.backgroundSize = "100% 100%";
            if(!this._width || this._width === "auto") this._width = this.img.width + "px";
            if(!this._height || this._height === "auto") this._height = this.img.height + "px";
          }
          else{
            if(!this._width) this._width = "32px";
            if(!this._height) this._height = "20px";
          }
          this.elem.style.width = this._width;
          this.elem.style.height = this._height;
          this.elem.style.fontSize = this.fontsize;
          
          let l=document.getElementById(this.link);
          if(l&&typeof(l.value)!="undefined"){
            if(typeof(l.convValue)=="number")
              this.setValue(l.convValue.toFixed(l.digits));
            else
              this.setValue(l.convValue);
            if(this.currentLink)
              this.currentLink.target.removeEventListener("input",this.currentLink.func);
            this.currentLink={target:l, func:(e)=>{
              if (this.updating) return;
              this.updating = true;
              if(typeof(l.convValue)=="number")
                this.setValue(l.convValue.toFixed(l.digits));
              else
                this.setValue(l.convValue);
              this.updating = false;
            }};
            this.currentLink.target.addEventListener("input",this.currentLink.func);
          }
          this.redraw();
        };
        this.coltab = this.colors.split(";");
        this.elem.style.color=this.coltab[0];
        this.img=new Image();
        this.img.onload=this.imgloaded.bind();
        if(this.src==null){
          this.elem.style.backgroundColor=this.coltab[1];
          this.imgloaded();
        }
        else if(this.src==""){
          this.elem.style.background="none";
          this.imgloaded();
        }
        else{
          this.img.src=this.src;
        }
      }
  
      redraw() {
        let displayValue;
      
        if (this.isLogarithmic) {
          // Use the normalized value (if available) to decide whether to show -∞.
          const norm = user1Manager.getNormalizedValue(this.rootParam);
          if (norm <= 0.0001) {
            displayValue = '-∞';
          } else {
            displayValue = parseFloat(this.value).toFixed(2);
          }
        } else {
          displayValue = parseFloat(this.value).toFixed(2);
        }
      
        this.elem.value = displayValue;
      }      
      setupKeyboardInteraction() {
        const keyboardModal = document.getElementById("numericKeyboardModal");
        const keyboard = keyboardModal.querySelector("webaudio-numeric-keyboard");
      
        const showModalHandler = (event) => {
          if (!this.enable) return;
      
          // Fetch the latest min and max values from ParameterManager
          if (this.rootParam) {
            const paramDetails = user1Manager.getParameter(this.rootParam);
            if (paramDetails) {
              this.min = paramDetails.min;
              this.max = paramDetails.max;
            } else {
              this.min = null;
              this.max = null;
            }
          }
      
          // Update the keyboard's min and max values
          if (keyboard) {
            keyboard.updateLimits(this.min, this.max);
          }
      
          // Show the keyboard modal
          const bootstrapModal = new bootstrap.Modal(keyboardModal);
          bootstrapModal.show();
      
          // Move focus to the first interactive element in the modal
          keyboard.outputElement.focus();
      
          // Handle the confirmation of a value
          keyboard.addEventListener(
            "submit",
            (e) => {
              const detail = e.detail;
              const userValue = detail.targetValue;
      
              // Validate and set value within the min-max range when updating the parameter
              const validatedValue = this.validateValue(userValue);
              this.startInterpolation(validatedValue, detail.interpolationDuration);
      
              bootstrapModal.hide();
      
              // Return focus to the original element
              this.elem.focus();
            },
            { once: true } // Ensure we only listen for one submit event per interaction
          );
      
          // Prevent the default behavior for touch events
          if (event.type === 'touchend') {
            event.preventDefault();
            event.stopPropagation();
          }
        };
      
        // Add both click and touchend event listeners
        this.elem.addEventListener("click", showModalHandler);
        this.elem.addEventListener("touchend", showModalHandler, { passive: false });
      }/**
 * Validates the user-provided value against min and max constraints.
 * If the value exceeds the limits, it will be clamped.
 * @param {number} value - The user-provided value.
 * @returns {number} - The validated value within the constraints.
 */
validateValue(value) {
  let validatedValue = value;

  if (this.min !== null && validatedValue < this.min) {
    console.warn(`Value ${validatedValue} is below the minimum ${this.min}. Clamping.`);
    validatedValue = this.min;
  }

  if (this.max !== null && validatedValue > this.max) {
    console.warn(`Value ${validatedValue} exceeds the maximum ${this.max}. Clamping.`);
    validatedValue = this.max;
  }

  return validatedValue;
}
onParameterChanged(parameterName, newValue) {
  if (this.rootParam === parameterName) {
    if (this.isBidirectional) {
      this.updatingFromParameter = true;

      // 1) Retrieve the real dB from paramManager:
      const rawDb = user1Manager.getRawValue(parameterName); 
      // e.g. -20 or -7.2, etc.

      // 2) Store that dB in this.value, without re-firing paramManager:
      this.setValue(rawDb, /*fire=*/false);

      this.updatingFromParameter = false;
    }
  }
}
      onScaleChanged(parameterName, scale) {

        if (this.rootParam === parameterName) {
          this.isLogarithmic = scale === "logarithmic";
         // console.debug(`[WebAudioParam] Scale of '${parameterName}' updated to: ${scale}`);
          this.redraw();
        }
      }

      onRangeChanged(parameterName, min, max) {
        if (this.rootParam === parameterName) {
          this.min = min;
          this.max = max;
         // console.debug(`[WebAudioParam] Range of '${parameterName}' updated to min=${min}, max=${max}`);
          this.redraw();
        }
      }


      updateLinkedElements(value) {
        if (this.currentLink && !this.currentLink.updating) {
          this.currentLink.updating = true;
          this.currentLink.target.setValue(value, true);
          this.currentLink.updating = false;
        }
  
        // Trigger change event for other listeners
        const event = new Event("change", { bubbles: true, cancelable: true });
        this.dispatchEvent(event);
      }
  
      startInterpolation(targetValue, duration) {
        const validatedTarget = this.validateValue(targetValue); // Validate target value
        const startValue = parseFloat(this.value);
        const startTime = performance.now();
      
        const step = (currentTime) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const newValue = startValue + (validatedTarget - startValue) * progress;
      
          this.setValue(newValue, true); // Update the param value
      
          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            // Interpolation complete
            this.setValue(validatedTarget, true);
          }
        };
      
        requestAnimationFrame(step);
      }
  
        /**
         * Sets the value and optionally notifies the ParameterManager and dispatches events.
         * @param {number|string} v - The value to set.
         * @param {boolean} fire - Whether to notify the manager and dispatch events.
         */
        setValue(v, fire = false) {
          if (this.updating) return;
          this.updating = true;
        
          const numericValue = typeof v === "string" ? parseFloat(v) : v;
          this.value = isNaN(numericValue) ? 0 : numericValue;
        
          if (this.value !== this.oldvalue) {
            this.redraw();
            if (fire && this.rootParam) {
              // Update ParameterManager
              user1Manager.setRawValue(this.rootParam, this.value, this, getPriority("webaudio-param"));
            }
            this.oldvalue = this.value;
          }
        
          this.updating = false;
        }

      pointerdown(ev) {
        ev.preventDefault(); // Stop default behavior
  
        if (!this.enable) return;
  
        const e = ev.touches ? ev.touches[0] : ev;
        if (!ev.touches && (e.buttons !== 1 && e.button !== 0)) return;
  
        this.elem.focus();
        this.redraw();
      }
    });
  } catch(error){
    console.log("webaudio-param already defined");
  }

/**
 * @class WebAudioNumericKeyboard
 * @memberof 2DGUI
 * @extends WebAudioControlsWidget
 * @description
 * A custom numeric keyboard interface for precise parameter adjustment in WebAudio applications.
 * Integrates with `WebAudioParam` for seamless user input and supports interpolated value changes.
 *
 * Features:
 * - **Dynamic Input**: Buttons for numeric and symbol input, including backspace, negative, and enter.
 * - **Interpolation**: Smooth value transitions based on slider-defined durations.
 * - **Keyboard and Touch Support**: Responds to physical keyboards and touch events.
 * - **Real-Time Display**: Updates the output display and triggers events during input.
 * - **Min/Max Constraints**: Validates inputs against defined limits.
 * - **Accessibility**: Fully accessible with keyboard navigation and ARIA attributes.
 *
 * Attributes:
 * - `value` - The current numeric value.
 * - `min` & `max` - Define constraints for input values.
 * - `interpolationDuration` - Time (ms) for interpolating changes.
 * - `outputElement` - Displays the current value.
 * - `sliderValueElement` - Displays slider-controlled interpolation duration.
 *
 * Events:
 * - `input` - Fired on any input value change.
 * - `submit` - Fired on confirmation of input via the "Enter" button.
 * - `complete` - Fired when interpolation is complete.
 */
try {
  customElements.define(
    "webaudio-numeric-keyboard",
    class WebAudioNumericKeyboard extends WebAudioControlsWidget {
      constructor() {
        super();
        this.value = "0"; // Initialize keyboard value to 0
        this.hasStartedTyping = false; // Tracks if user started typing
        this.isModalVisible = false; // Track modal visibility

        // Interpolation properties
        this.currentValue = 0; // The current value of the parameter
        this.targetValue = 0; // The target value after interpolation
        this.startValue = 0; // The value at the start of interpolation
        this.interpolationStartTime = null; // Start time of interpolation
        this.interpolationDuration = 0; // Duration in milliseconds
        this.animationFrameId = null; // ID of the animation frame
      }

      connectedCallback() {
        let root;
        if (this.attachShadow) {
          root = this.attachShadow({ mode: "open" });
        } else {
          root = this;
        }

        root.innerHTML = `
        <style>
            ${this.basestyle}
            :host {
                display: block;
                width: 100%;
                font-family: 'SpaceMono', sans-serif;
                font-size: 14px;
            }
            .output {
                text-align: right;
                font-size: 16px;
                padding: 5px 10px;
                margin-bottom: 10px;
                background: #000000;
                color: white;
                border-radius: 5px;
                font-family: 'SpaceMono', sans-serif;
            }
            .keyboard-and-slider-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 20px;
                width: 100%;
            }
            .numeric-keyboard {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 10px;
                justify-items: center;
                width: 100%;
            }
            .numeric-keyboard .button {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                height: 50px;
                background-color: #000000;
                color: white;
                border-radius: 5px;
                font-family: 'SpaceMono', sans-serif;
                font-size: 18px;
                cursor: pointer;
                user-select: none;
            }
            .numeric-keyboard .button:active {
                background-color: #555;
            }
            .numeric-keyboard .button.double {
                grid-column: span 2;
            }
            .slider-container-horz {
                display: flex;
                flex-direction: row;
                justify-content: center;
                align-items: center;
                gap: 0px;
                width: 100%; /* Ensure container spans the available space */
                height: 40px; /* Explicit height */
                margin-bottom: 0px;
            }
            .slider-container-horz webaudio-slider {
                flex: 1;
                height: 100%; /* Ensure it fills the parent container */
                max-height: 40px; /* Prevent it from exceeding the parent height */
            }
            .slider-value-container {
                display: flex;
                flex-direction: row;
                align-items: center;
                justify-content: center;
                gap: 0px;
                font-size: 16px;
                margin-top: 0px;
            }
            .menu-item-icon {
                width: 16px;
                height: 16px;
            }
            .slider-value-display {
                font-size: 16px;
                background: white;
                color: black;
                border-radius: 5px;
                padding: 2px 6px;
            }
            .divider-line {
                width: 100%;
                height: 1px;
                background-color: #ccc;
                margin: 10px 0;
                margin-bottom: 20px;
            }
        </style>
        <div class="slider-container-horz">
            <webaudio-slider 
                id="numericKeyboardSliderHorz" 
                min="0" 
                max="30" 
                step="0.01" 
                value="0" 
                sensitivity=".05"
                colors="#00000000;#00000000;#000000;#000000;#000000" 
                direction="horz">
            </webaudio-slider>
        </div>
        <div class="slider-value-container">
            <img src="/assets/icons/time.svg" alt="Time Icon" class="menu-item-icon">
            <div class="slider-value-display">0.00</div>
            <div>s</div>
        </div>
        <div class="divider-line"></div>
        <div class="output">${this.value || "0.00"}</div>
        <div class="keyboard-and-slider-container">
            <div class="limits">
            <span>Min: <span id="minValue">${this.min || "N/A"}</span></span>
            <span>Max: <span id="maxValue">${this.max || "N/A"}</span></span>
           </div>
            <div class="numeric-keyboard">
            
                ${this.createButtons()}
            </div>
        </div>
        `;

        // Element references
        this.outputElement = root.querySelector(".output");
        this.sliderValueElement = root.querySelector(".slider-value-display"); // Slider value display
        this.buttons = root.querySelectorAll(".button");
        this.sliderHorz = root.querySelector("#numericKeyboardSliderHorz"); // Reference to horizontal slider

        // Add click event listeners for buttons
        this.buttons.forEach((button) =>
          button.addEventListener("click", (e) => this.handleButtonPress(e))
        );

        // Event listeners for horizontal slider
        if (this.sliderHorz) {
          // Set initial interpolation duration
          this.interpolationDuration = parseFloat(this.sliderHorz.value) * 1000; // Convert to milliseconds

          this.sliderHorz.addEventListener("input", (e) => {
            
            const sliderValue = parseFloat(e.target.value);
            this.sliderValueElement.textContent = sliderValue.toFixed(2); // Format to 2 decimals
            this.interpolationDuration = sliderValue * 1000; // Convert to milliseconds
            this.dispatchEvent(new CustomEvent("slider-input-horz", { detail: sliderValue }));
          });

          this.sliderHorz.addEventListener("change", (e) => {
            const sliderValue = parseFloat(e.target.value);
            this.sliderValueElement.textContent = sliderValue.toFixed(2); // Format to 2 decimals
            this.interpolationDuration = sliderValue * 1000; // Convert to milliseconds
            this.dispatchEvent(new CustomEvent("slider-change-horz", { detail: sliderValue }));
          });
        }

        this.initializeModal();
      }

      initializeModal() {
        this.keyboardModal = document.getElementById("numericKeyboardModal");
        if (!this.keyboardModal) {
          console.error("Modal element not found!");
          return;
        }

        const showModal = () => {
          if (this.isModalVisible) return; // Avoid reattaching listeners
          this.isModalVisible = true;
          this.hasStartedTyping = false;
        
          // Update min and max limits
          this.updateLimits(this.min, this.max);
        
          this.outputElement.textContent = this.value || "0";
          this.keyboardModal.classList.add("active");
        
          // Add `keydown` listener only if it hasn't been added
          document.addEventListener("keydown", this.handleKeyboardInputBound);
        };

        const hideModal = () => {
          if (!this.isModalVisible) return; // Ensure cleanup only when necessary
          this.isModalVisible = false;
          this.keyboardModal.classList.remove("active");

          // Remove the `keydown` listener
          document.removeEventListener("keydown", this.handleKeyboardInputBound);
        };

        // Bind the `handleKeyboardInput` method to maintain `this` context
        this.handleKeyboardInputBound = this.handleKeyboardInput.bind(this);

        this.keyboardModal.addEventListener("shown.bs.modal", showModal);
        this.keyboardModal.addEventListener("hidden.bs.modal", hideModal);

        this.keyboardModal.show = showModal;
        this.keyboardModal.hide = hideModal;
      }

      createButtons() {
        const labels = [
          "7", "8", "9", "⌦",
          "4", "5", "6", "-",
          "1", "2", "3", "+",
          "0", ".", "↵"
        ];
        return labels
          .map((label, index) => {
            const isDouble = label === "0" && index === labels.lastIndexOf("0");
            return `
              <div 
                class="button ${isDouble ? "double" : ""}" 
                data-value="${label}"
              >
                ${label}
              </div>`;
          })
          .join("");
      }

      handleButtonPress(event) {
        const button = event.target;
        const value = button.getAttribute("data-value");
        this.processInput(value);
      }

      handleKeyboardInput(event) {
        if (!this.isModalVisible) return;

        const key = event.key;
        if (!isNaN(key) || key === "." || key === "-" || key === "+") {
          this.processInput(key);
        } else if (key === "Backspace") {
          this.processInput("⌦");
        } else if (key === "Enter") {
          this.processInput("↵");
        }
      }

      processInput(value) {
        if (value === "⌦") {
          this.value = this.value.length > 1 ? this.value.slice(0, -1) : "0";
        } else if (value === "↵") {
          // Dispatch an event with target value and interpolation duration
          const eventData = {
            targetValue: parseFloat(this.value),
            interpolationDuration: this.interpolationDuration,
          };
          this.dispatchEvent(new CustomEvent("submit", { detail: eventData }));
        } else if (value === "-") {
          this.value = this.value.startsWith("-") ? this.value.slice(1) : `-${this.value}`;
        } else if (value === "+") {
          this.value = this.value.replace("-", "");
        } else if (!isNaN(value) || value === ".") {
          if (!this.hasStartedTyping) {
            this.value = ""; // Clear initial "0" when typing starts
            this.hasStartedTyping = true;
          }
          this.value += value; // Append the new input
        }
      
        // Update the displayed value
        this.outputElement.textContent = this.value;
      
        // Emit a single 'input' event
        this.dispatchEvent(new Event("input"));
      }
      updateLimits(min, max) {
        this.min = min;
        this.max = max;
      
        const minValueElement = this.shadowRoot.querySelector("#minValue");
        const maxValueElement = this.shadowRoot.querySelector("#maxValue");
      
        if (minValueElement) {
          minValueElement.textContent = min !== null ? min : "N/A";
        }
      
        if (maxValueElement) {
          maxValueElement.textContent = max !== null ? max : "N/A";
        }
      }

      animateInterpolation(timestamp) {
        if (this.interpolationStartTime == null) {
          this.interpolationStartTime = timestamp;
        }

        // Calculate elapsed time
        const elapsed = timestamp - this.interpolationStartTime;

        // Calculate progress (clamp between 0 and 1)
        const progress = Math.min(elapsed / this.interpolationDuration, 1);

        // Calculate interpolated value
        this.currentValue = this.startValue + (this.targetValue - this.startValue) * progress;

        // Update the display
        this.outputElement.textContent = this.currentValue.toFixed(2);

        // Dispatch an 'input' event to notify listeners of the updated value
        this.dispatchEvent(new CustomEvent('input', { detail: this.currentValue }));

        // Check if animation should continue
        if (progress < 1) {
          // Continue animation
          this.animationFrameId = requestAnimationFrame(this.animateInterpolation.bind(this));
        } else {
          // Animation complete
          this.animationFrameId = null;

          // Dispatch a 'complete' event
          this.dispatchEvent(new CustomEvent('complete', { detail: this.currentValue }));
        }
      }
    }
  );
} catch (error) {
  console.error("WebAudioNumericKeyboard already defined:", error);
}

/**
 * @deprecated WebAudioControlsWidgetManager is now deprecated.
 * This class was originally used for managing WebAudio widgets and integrating them with MIDI.
 * However, widget management and parameter handling are now handled externally.
 * 
 * This class will be phased out gradually to ensure nothing breaks during the transition.
 * Direct dependencies or indirect reliance on its functionality should be replaced.
 * 
 * Current known dependencies:
 * - Potential global initialization logic for widgets
 * - Possible implicit reliance in older parts of the codebase
 * 
 * TODO:
 * - Trace all references to `WebAudioControlsWidgetManager` and `webAudioControlsWidgetManager`.
 * - Replace direct and indirect dependencies with a more modern approach.
 * - Fully remove this class once confirmed safe.
 */
class WebAudioControlsWidgetManager {
  constructor() {
    this.listOfWidgets = Array.from(
      document.querySelectorAll("webaudio-knob, webaudio-slider, webaudio-switch, webaudio-param, webaudio-keyboard")
    );
    this._trackId = null; // Initialize trackId

    // Conditionally link with MIDIControllerInstance if MIDI is supported
    this.midiController = MIDI_SUPPORTED ? MIDIControllerInstance : null;

    this.updateWidgets();
  }

  updateWidgets() {
    // Conditionally register widgets with MIDIController if it's initialized
    if (this.midiController) {
      this.listOfWidgets.forEach(widget => {
        if (widget.id) {
          this.midiController.registerWidget(widget.id, widget);
        }
      });
    }
  }

  addWidget(widget) {
    if (typeof widget !== "object" || !widget.id) {
      console.error("Invalid or unidentified widget passed to addWidget:", widget);
      return;
    }

    this.listOfWidgets.push(widget);
    if (this.midiController) {
      this.midiController.registerWidget(widget.id, widget);
    }
  }
}

// Instantiate and attach the manager if MIDI is supported
if (MIDI_SUPPORTED) {
  window.webAudioControlsWidgetManager = new WebAudioControlsWidgetManager();
}

 }


