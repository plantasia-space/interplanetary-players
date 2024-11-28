/* *
 *
 *  WebAudio-Controls is based on:
 *    - webaudio-knob by Eiji Kitamura http://google.com/+agektmr
 *    - webaudio-slider by Ryoya Kawai https://plus.google.com/108242669191458983485/posts
 *    - webaudio-switch by Keisuke Ai http://d.hatena.ne.jp/aike/
 *  Integrated and enhanced by g200kg (Tatsuya Shinyagaito) http://www.g200kg.com/
 *
 *  Copyright 2013 Eiji Kitamura / Ryoya KAWAI / Keisuke Ai / g200kg (Tatsuya Shinyagaito)
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  You may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at:
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 *  Modifications made by Bruna Guarnieri:
 *	•	Knobs (webaudio-knob): Fully styled rotary controls with customizable colors, sizes, and behavior.
 *	•	Sliders (webaudio-slider): Linear sliders with horizontal and vertical orientation options.
 *  • Switches (webaudio-switch): Includes toggle, kick, radio, and sequential types with group handling for radio switches.
 *	•	Keyboard (webaudio-keyboard): Simulates a MIDI keyboard with configurable keys, colors, and MIDI integration.
 *	• Parameters (webaudio-param): Provides numeric input fields with customizable visual styles and MIDI compatibility.
 *  • Draws controls (like sliders and switches) using the <canvas> API for precise visual control.
 *  • Date of modification: 2024-11
 *
 *  NOTICE: This file includes modifications by Bruna Guarnieri and complies with the requirements
 *  of the Apache License 2.0. The original work and its attributions have been retained as required.
 *
 * */

 import { Constants, TRACK_ID } from './../Constants.js';

 
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
  font-family: orbit;
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
  let midimenu=document.createElement("ul");
  midimenu.id="webaudioctrl-context-menu";
  midimenu.innerHTML=
`<li class="webaudioctrl-context-menu__title">MIDI Learn</li>
<li class="webaudioctrl-context-menu__item" id="webaudioctrl-context-menu-learn" onclick="webAudioControlsWidgetManager.contextMenuLearn()">Learn</li>
<li class="webaudioctrl-context-menu__item" onclick="webAudioControlsWidgetManager.contextMenuClear()">Clear</li>
<li class="webaudioctrl-context-menu__item" onclick="webAudioControlsWidgetManager.contextMenuClose()">Close</li>
`;
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
      document.body.appendChild(midimenu);
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
      this.onblur=()=>{
        this.elem.style.outline="none";
      }
      this.onfocus=()=>{
        switch(+this.outline){
        case null:
        case 0:
          this.elem.style.outline="none";
          break;
        case 1:
          this.elem.style.outline="1px solid #444";
          break;
        default:
          this.elem.style.outline=this.outline;
        }
      }
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
    contextMenu(e){
      if(window.webAudioControlsWidgetManager && this.midilearn)
        webAudioControlsWidgetManager.contextMenuOpen(e,this);
      e.preventDefault();
      e.stopPropagation();
    }
    setMidiController(channel, cc) {
      if (this.listeningToThisMidiController(channel, cc)) return;
      this.midiController={ 'channel': channel, 'cc': cc};
     // console.log(`MIDI LOG: Added mapping for widget ${this.id || this.tagName} - channel=${channel}, cc=${cc}, tooltip=${this.tooltip}`);
    }
    listeningToThisMidiController(channel, cc) {
      const c = this.midiController;
      if((c.channel === channel || c.channel < 0) && c.cc === cc)
        return true;
      return false;
    }
    
    processMidiEvent(event) {
      const status = event.data[0];
      const channel = status & 0xf;
      const controlNumber = event.data[1];
      const controlValue = event.data[2];
    
      if (this.midiMode === "learn") {
        this.setMidiController(channel, controlNumber);
        window.webAudioControlsWidgetManager.contextMenuClose();
        this.midiMode = "normal";
        window.webAudioControlsWidgetManager.preserveMidiLearn();
        return;
      }
      if (this.listeningToThisMidiController(channel, controlNumber)) {

        if (this.tagName === "WEBAUDIO-SWITCH") {

          this.handleSwitchMidiMessage(event); // Call switch-specific handler
        } else {
          const val = this.min + (this.max - this.min) * (controlValue / 127);
          this.setValue(val, true);
        }
      }
    }

}

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
            width: var(--knob-size);
            height: var(--knob-size); /* Force height to match width for square aspect ratio */
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
      this.conv = this.getAttr("conv", null);
      if (this.conv) {
        const x = this._value;
        this.convValue = eval(this.conv);
        if (typeof this.convValue === "function")
          this.convValue = this.convValue(x);
      } else
        this.convValue = this._value;

      // Setup canvas dimensions and handle high DPI
      this.setupImage();

      // Bind the drawKnob method to ensure correct 'this' context
      this.drawKnob = this.drawKnob.bind(this);

      // Initial drawing
      this.redraw();

      // Setup label positioning
      this.setupLabel();

      // MIDI related setup
      this.midilearn = this.getAttr("midilearn", opt.midilearn);
      console.log("Initialized midilearn:", this.midilearn);

      this.midicc = this.getAttr("midicc", null);
      console.log("Initialized midicc:", this.midicc);

      this.midiController = {};
      this.midiMode = "normal";

      if (this.midicc) {
        console.log("Parsing midicc:", this.midicc);
        let ch = parseInt(this.midicc.substring(0, this.midicc.lastIndexOf("."))) - 1;
        let cc = parseInt(this.midicc.substring(this.midicc.lastIndexOf(".") + 1));
        console.log("Setting MIDI controller - channel:", ch, "CC:", cc);
        this.setMidiController(ch, cc);
      }

      let retries = 0;
      const maxRetries = 5; // Retry up to 5 times (5 * 100ms = 500ms total)
      const attemptToLoadMidiLearn = () => {
        if (window.webAudioControlsWidgetManager && window.webAudioControlsWidgetManager.midiLearnTable) {
          const ml = window.webAudioControlsWidgetManager.midiLearnTable;
          for (let i = 0; i < ml.length; ++i) {
            if (ml[i].id === this.id) {
              console.log(`Loaded MIDI mapping for widget ${this.id}`);
              this.setMidiController(ml[i].cc.channel, ml[i].cc.cc);
              return; // Stop retrying on success
            }
          }
          console.warn(`No MIDI mapping found for widget ID: ${this.id}`);
        } else if (retries < maxRetries) {
          console.warn(`Retrying MIDI load for widget ID: ${this.id}. Attempt: ${++retries}`);
          setTimeout(attemptToLoadMidiLearn, 100); // Retry after 100ms
        } else {
          console.error(`Failed to load MIDI mapping for widget ID: ${this.id} after ${maxRetries} attempts.`);
        }
      };
      attemptToLoadMidiLearn();

      // Additional properties
      this.digits = 0;
      if (this.step && this.step < 1) {
        for (let n = this.step; n < 1; n *= 10)
          ++this.digits;
      }

      // Add to widget manager
      if (window.webAudioControlsWidgetManager)
        window.webAudioControlsWidgetManager.addWidget(this);

      // Bind focus, blur, and pointerdown events after this.elem is assigned
      if (this.elem) {
        this.elem.addEventListener('focus', this.onFocus);
        this.elem.addEventListener('blur', this.onBlur);
        this.elem.addEventListener('pointerdown', this.onPointerDown);
      } else {
        console.error('webaudio-knob: this.elem is not assigned correctly.');
      }
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

      // Remove any global event listeners if necessary
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerup', this.onPointerUp);
    }

    setupImage() {
      // *** Resolve CSS Variables in 'colors' ***
      // Parse colors from the 'colors' attribute or use default
      this.coltab = this.colors ? this.colors.split(";").map(color => {
        color = color.trim();
        if (color.startsWith('var(') && color.endsWith(')')) {
          const varName = color.slice(4, -1).trim();
          // Resolve CSS variable from the root (:root)
          const resolvedColor = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
          return resolvedColor || '#000'; // Fallback to black if variable is not defined
        }
        return color;
      }) : ["#e00", "#000", "#000"];
      // *** End of Resolving CSS Variables ***

      // Determine actual size
      let width, height;
      if (this._width && this._height) {
        width = parseInt(this._width);
        height = parseInt(this._height);
      } else {
        // Get computed size from CSS
        const style = getComputedStyle(this.elem);
        width = parseInt(style.width) || 64;
        height = parseInt(style.height) || 64;
        // Enforce square aspect ratio
        const size = Math.min(width, height);
        width = height = size;
      }

      // Handle high DPI displays for better resolution
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      const ctx = this.canvas.getContext('2d');
      ctx.scale(dpr, dpr);

      // Apply outline if specified
      this.canvas.style.outline = this.outline;

      // Recalculate radius based on diameter if specified
      if (this._diameter) {
        this.radius = parseInt(this._diameter) / 2 - 5; // Padding of 5px
      } else {
        this.radius = Math.min(width, height) / 2 - 5; // Padding of 5px
      }

      this.centerX = width / 2;
      this.centerY = height / 2;

      this.redraw();

      // Setup ResizeObserver to handle parent size changes if width or height is not set
      if (!this._width || !this._height) {
        if (this.resizeObserver) {
          this.resizeObserver.disconnect();
        }
        this.resizeObserver = new ResizeObserver(entries => {
          for (let entry of entries) {
            const newWidth = entry.contentRect.width;
            const newHeight = entry.contentRect.height;
            const size = Math.min(newWidth, newHeight);
            const adjustedWidth = size;
            const adjustedHeight = size;

            // Update canvas dimensions
            this.canvas.width = adjustedWidth * dpr;
            this.canvas.height = adjustedHeight * dpr;
            this.canvas.style.width = `${adjustedWidth}px`;
            this.canvas.style.height = `${adjustedHeight}px`;
            const ctx = this.canvas.getContext('2d');
            ctx.scale(dpr, dpr);

            // Update radius and center
            this.radius = Math.min(adjustedWidth, adjustedHeight) / 2 - 5;
            this.centerX = adjustedWidth / 2;
            this.centerY = adjustedHeight / 2;

            // Redraw the knob with new dimensions
            this.redraw();
          }
        });
        this.resizeObserver.observe(this.elem);
      }
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
        if (this.conv) {
          const x = this._value;
          this.convValue = eval(this.conv);
          if (typeof this.convValue === "function")
            this.convValue = this.convValue(x);
        }
        else
          this.convValue = this._value;
        if (typeof this.convValue === "number") {
          this.convValue = this.convValue.toFixed(this.digits);
        }
        this.redraw();
        this.showtip(0);
        return 1;
      }
      return 0;
    }

    setValue(v, f) {
      if (this._setValue(v) && f)
        this.sendEvent("input"), this.sendEvent("change");
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
      direction = Math.sign(direction); // Normalize to -1 or 1
    
      if (this.log) {
        // Logarithmic mode
        let r = Math.log(this.value / this.min) / Math.log(this.max / this.min);
        let d = direction * 0.01; // Base delta for logarithmic scaling
        r += d;
        r = Math.max(0, Math.min(1, r)); // Clamp ratio between 0 and 1
        const newValue = this.min * Math.pow(this.max / this.min, r);
        this.setValue(newValue, true);
      } else {
        // Linear mode
        let delta = this.step || (this.max - this.min) * 0.05; // Default 5% range step
        delta *= direction; // Apply direction
        const newValue = +this.value + delta;
        this.setValue(newValue, true);
      }
    
      // Prevent default scrolling behavior
      e.preventDefault();
      e.stopPropagation();
    }

    pointerdown(ev) {
      if (!this.enable)
        return;
      let e = ev;

      // Only handle primary buttons (usually left mouse button) and touch
      if (e.pointerType === 'mouse' && e.button !== 0)
        return;

      // Prevent multiple pointers
      if (this.drag) return;

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

    setMidiController(channel, cc) {
      // Implement MIDI controller setup here
      // Placeholder implementation
      this.midiController.channel = channel;
      this.midiController.cc = cc;
      // Additional MIDI setup logic
    }
  });
} catch (error) {
  console.log("webaudio-knob already defined");
}
  try {
    customElements.define("webaudio-slider", class WebAudioSlider extends WebAudioControlsWidget {
      constructor() {
        super();
  
        // Bind methods
        this.pointerdown = this.pointerdown.bind(this);
        this.pointermove = this.pointermove.bind(this);
        this.pointerup = this.pointerup.bind(this);
        this.keydown = this.keydown.bind(this);
        this.wheel = this.wheel.bind(this);
        this.redraw = this.redraw.bind(this);
        this.handleParamChange = this.handleParamChange.bind(this);
        this.onMidiMessage = this.onMidiMessage.bind(this);
  
        // Initialize properties for ResizeObserver
        this.resizeObserver = null;
      }
  
      connectedCallback() {
        let root;
        if (this.attachShadow) {
          root = this.attachShadow({ mode: 'open' });
        } else {
          root = this;
        }
  
        // Define HTML structure
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
              transition: opacity 0.2s;
            }
            .webaudioctrl-label {
              position: absolute;
              width: 100%;
              text-align: center;
              top: 100%;
              left: 0;
              transform: translateY(4px);
            }
            :host(:focus) .webaudio-slider-body {
              outline: none;
            }
          </style>
          <div class='webaudio-slider-body' tabindex='1'>
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
        this.enable = this.getAttr("enable", 1);
        this.tracking = this.getAttr("tracking", "rel");
        this._value = parseFloat(this.getAttribute("value")) || 0;
        this.defvalue = parseFloat(this.getAttribute("defvalue")) || this._value;
        this._min = parseFloat(this.getAttribute("min")) || 0;
        this._max = parseFloat(this.getAttribute("max")) || 100;
        this._step = parseFloat(this.getAttribute("step")) || 1;
        this._direction = this.getAttribute("direction") || "horz";
        this.log = this.getAttr("log", 0);
        this._colors = this.getAttribute("colors") || "#e00;#333;#fff;#777;#555";
        this.outline = this.getAttribute("outline") || "none";        
        this.setupLabel();
        this.sensitivity = parseFloat(this.getAttribute("sensitivity")) || 1;
        this.valuetip = this.getAttr("valuetip", opt.valuetip);
        this.tooltip = this.getAttribute("tooltip") || null;
        this.conv = this.getAttribute("conv") || null;
        this.link = this.getAttribute("link") || "";
  
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
        while (this.coltab.length < 5) this.coltab.push("#000");
  
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
  
        // MIDI Initialization
        this.midilearn = this.getAttr("midilearn", opt.midilearn);
        this.midicc = this.getAttr("midicc", null);
        this.midiController = {};
        this.midiMode = "normal";
        if (this.midicc) {
          let ch = parseInt(this.midicc.substring(0, this.midicc.lastIndexOf("."))) - 1;
          let cc = parseInt(this.midicc.substring(this.midicc.lastIndexOf(".") + 1));
          this.setMidiController(ch, cc);
        }
        let retries = 0;
        const maxRetries = 5; // Retry up to 50 times (5 seconds total if 100ms delay)
        const attemptToLoadMidiLearn = () => {
            if (window.webAudioControlsWidgetManager && window.webAudioControlsWidgetManager.midiLearnTable) {
                const ml = window.webAudioControlsWidgetManager.midiLearnTable;
                for (let i = 0; i < ml.length; ++i) {
                    if (ml[i].id === this.id) {
                        console.log(`Loaded MIDI mapping for widget ${this.id}`);
                        this.setMidiController(ml[i].cc.channel, ml[i].cc.cc);
                        return; // Stop retrying on success
                    }
                }
                console.warn(`No MIDI mapping found for widget ID: ${this.id}`);
            } else if (retries < maxRetries) {
                console.warn(`Retrying MIDI load for widget ID: ${this.id}. Attempt: ${++retries}`);
                setTimeout(attemptToLoadMidiLearn, 100); // Retry after 100ms
            } else {
                console.error(`Failed to load MIDI mapping for widget ID: ${this.id} after ${maxRetries} attempts.`);
            }
        };
        attemptToLoadMidiLearn();
  

        
        // Global registration
        window.webaudioSliders = window.webaudioSliders || {};
        if (this.id) {
          window.webaudioSliders[this.id] = this;
        }
  
        // Initial setup
        this.setupCanvas();
        this.redraw();
  
        if (!this.hasOwnProperty("min")) Object.defineProperty(this, "min", {
          get: () => { return this._min },
          set: (v) => { this._min = +v; this.redraw() }
        });
        
        if (!this.hasOwnProperty("max")) Object.defineProperty(this, "max", {
          get: () => { return this._max },
          set: (v) => { this._max = +v; this.redraw() }
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
        // Add to widget manager
        if (window.webAudioControlsWidgetManager)
          window.webAudioControlsWidgetManager.addWidget(this);
  
      }
  
      disconnectedCallback() {
        // Remove event listeners
        this.elem.removeEventListener('keydown', this.keydown);
        this.elem.removeEventListener('mousedown', this.pointerdown);
        this.elem.removeEventListener('touchstart', this.pointerdown);
        this.elem.addEventListener('wheel', this.wheel, { passive: false });
  
        // Unobserve ResizeObserver
        if (this.resizeObserver) {
          this.resizeObserver.unobserve(this);
        }
  
        // Additional cleanup
        if (this.linkedParam) {
          this.linkedParam.removeEventListener("input", this.handleParamChange);
        }
  
        // Remove from widget manager
        if (window.webAudioControlsWidgetManager)
          window.webAudioControlsWidgetManager.removeWidget(this);
      }
  
      // ... (Rest of your existing methods remain unchanged)
  
      // Implement MIDI methods similar to webaudio-knob
      setMidiController(channel, cc) {
        this.midiController.channel = channel;
        this.midiController.cc = cc;
        if (window.webAudioControlsMidiManager) {
          window.webAudioControlsMidiManager.addWidget(this);
        }
      }
  
      onMidiMessage(event) {
        const data = event.data;
        const status = data[0];
        const channel = status & 0x0F;
        const type = status & 0xF0;
        const cc = data[1];
        const value = data[2];
  
        if (type === 0xB0 && channel === this.midiController.channel && cc === this.midiController.cc) {
          const midiValue = (value / 127) * (this._max - this._min) + this._min;
          this.setValue(midiValue, true);
        }
      }
  
      setupCanvas() {
        // Get actual size
        const rect = this.elem.getBoundingClientRect();
        const knobSizeMultiplier = 0.4; 
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
        while (this.coltab.length < 5) this.coltab.push("#000");
  
        // Recalculate dimensions proportionally
        if (this._direction.toLowerCase() === "horz") {
          this.isHorizontal = true;
          this.knobSize = this._height * knobSizeMultiplier; // 40% of height
          const padding = this.knobSize;
          this.trackLength = this._width - 2 * padding;
          this.trackHeight = this._height * 0.2; // 20% of height
          this.trackX = padding;
          this.trackY = (this._height - this.trackHeight) / 2;
        } else if (this._direction.toLowerCase() === "vert") {
          this.isHorizontal = false;
          this.knobSize = this._width * knobSizeMultiplier; // 40% of width
          const padding = this.knobSize;
          this.trackLength = this._height - 2 * padding;
          this.trackHeight = this._width * knobSizeMultiplier; // 20% of width
          this.trackX = (this._width - this.trackHeight) / 2;
          this.trackY = padding;
        } else {
          console.warn(`webaudio-slider: Invalid direction "${this._direction}". Defaulting to horizontal.`);
          this.isHorizontal = true;
          this.knobSize = this._height * knobSizeMultiplier;
          const padding = this.knobSize;
          this.trackLength = this._width - 2 * padding;
          this.trackHeight = this._height * knobSizeMultiplier;
          this.trackX = padding;
          this.trackY = (this._height - this.trackHeight) / 2;
        }
      }
  
      redraw() {
        // Clamp value within min and max
        this._value = Math.min(this._max, Math.max(this._min, this._value));
  
        // Calculate ratio
        let ratio;
        if (this.log) {
          if (this._value <= 0 || this._min <= 0) {
            ratio = 0;
          } else {
            ratio = Math.log(this._value / this._min) / Math.log(this._max / this._min);
          }
        } else {
          ratio = (this._value - this._min) / (this._max - this._min);
        }
        ratio = Math.max(0, Math.min(1, ratio));
  
        // Update convValue
        if (this.conv) {
          const x = this._value;
          try {
            this.convValue = eval(this.conv);
            if (typeof this.convValue === "function")
              this.convValue = this.convValue(x);
          } catch (error) {
            console.error(`webaudio-slider: Error evaluating conv expression "${this.conv}":`, error);
            this.convValue = this._value;
          }
        } else {
          this.convValue = this._value;
        }
  
        if (typeof this.convValue === "number") {
          this.convValue = this.convValue.toFixed(this.digits);
        }
  
        // Draw the slider
        this.drawSlider(ratio);
  
        // Update tooltip if necessary
        if (this.fireflag) {
          this.showtip(0);
          this.fireflag = false;
        }
  
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
          // Draw track

        // Draw background track
        ctx.fillStyle = "#00000000"; // Transparent background
        ctx.fillRect(0, 0, this._width, this._height);

        // Draw centered track line
        ctx.strokeStyle = "white" || '#333'; // Track color
        ctx.lineWidth = 1; // 1-pixel line
        ctx.beginPath();
        if (this.isHorizontal) {
          // Centered horizontal line
          const centerY = this.trackY + this.trackHeight / 2; // Vertical center of the track
          ctx.moveTo(this.trackX, centerY);
          ctx.lineTo(this.trackX + this.trackLength, centerY);
        } else {
          // Centered vertical line
          const centerX = this.trackX + this.trackHeight / 2; // Horizontal center of the track
          ctx.moveTo(centerX, this.trackY);
          ctx.lineTo(centerX, this.trackY + this.trackLength);
        }
        ctx.stroke();

        // Draw filled portion
        ctx.strokeStyle = this.coltab[3] || '#e00'; // Fill color
        ctx.lineWidth = 1; // Same thickness
        ctx.beginPath();
        if (this.isHorizontal) {
          const centerY = this.trackY + this.trackHeight / 2; // Vertical center of the track
          ctx.moveTo(this.trackX, centerY);
          ctx.lineTo(this.trackX + this.trackLength * ratio, centerY);
        } else {
          const centerX = this.trackX + this.trackHeight / 2; // Horizontal center of the track
          ctx.moveTo(centerX, this.trackY + this.trackLength * (1 - ratio));
          ctx.lineTo(centerX, this.trackY + this.trackLength);
        }
        ctx.stroke();
      
         // Draw triangle knob/pointer
        ctx.fillStyle = this.coltab[2] || '#fff'; // Knob color
        ctx.strokeStyle = this.coltab[3] || '#777'; // Outline color
        ctx.lineWidth = 1;
      
        ctx.beginPath();
        if (this.isHorizontal) {
          // Triangle pointing to the right
          const knobX = this.trackX + this.trackLength * ratio;
          const knobY = this.trackY + this.trackHeight / 2;
          const size = this.knobSize;
      
          ctx.moveTo(knobX + size, knobY); // Right point
          ctx.lineTo(knobX - size, knobY - size); // Top-left point
          ctx.lineTo(knobX - size, knobY + size); // Bottom-left point
          ctx.closePath();
        } else {
          // Triangle pointing upwards
          const knobX = this.trackX + this.trackHeight / 2;
          const knobY = this.trackY + this.trackLength * (1 - ratio);
          const size = this.knobSize;
      
          ctx.moveTo(knobX, knobY - size); // Top point
          ctx.lineTo(knobX - size, knobY + size); // Bottom-left point
          ctx.lineTo(knobX + size, knobY + size); // Bottom-right point
          ctx.closePath();
        }
      
        ctx.fill();
        ctx.stroke(); // Only for the knob/pointer
      }    
      _setValue(v) {
        if (this._step) {
          v = Math.round((v - this._min) / this._step) * this._step + this._min;
        }
        v = Math.min(this._max, Math.max(this._min, v));
        if (v !== this._value) {
          this._value = v;
          this.fireflag = true;
  
          this.redraw();
          return true;
        }
        return false;
      }
  
      setValue(v, fire = false) {
        if (this._setValue(v) && fire) {
          this.sendEvent("input");
          this.sendEvent("change");
          this.updateLinkedParam(); // Update linked param if exists
        }
      }
  
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
  
      pointerdown(ev) {
        if (!this.enable) return;
  
        // Prevent default to avoid unwanted behaviors
        ev.preventDefault();
        ev.stopPropagation();
  
        this.elem.focus();
        this.dragging = true;
  
        // Determine the initial ratio based on pointer position
        const rect = this.canvas.getBoundingClientRect();
        this.updateValueFromPointer(ev, rect);
  
        // Add event listeners for move and up
        window.addEventListener('mousemove', this.pointermove, { passive: false });
        window.addEventListener('mouseup', this.pointerup);
        window.addEventListener('touchmove', this.pointermove, { passive: false });
        window.addEventListener('touchend', this.pointerup);
        window.addEventListener('touchcancel', this.pointerup);
      }
  
      pointermove(ev) {
        if (!this.dragging) return;
  
        // Prevent default to avoid unwanted behaviors
        ev.preventDefault();
        ev.stopPropagation();
  
        const rect = this.canvas.getBoundingClientRect();
        this.updateValueFromPointer(ev, rect);
      }
  
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
  
      updateValueFromPointer(ev, rect) {
        let clientX, clientY;
        if (ev.touches && ev.touches.length > 0) {
          clientX = ev.touches[0].clientX;
          clientY = ev.touches[0].clientY;
        } else {
          clientX = ev.clientX;
          clientY = ev.clientY;
        }
  
        let ratio;
        if (this.isHorizontal) {
          let x = clientX - rect.left;
          x = Math.max(this.trackX, Math.min(this.trackX + this.trackLength, x));
          ratio = (x - this.trackX) / this.trackLength;
        } else {
          let y = clientY - rect.top;
          y = Math.max(this.trackY, Math.min(this.trackY + this.trackLength, y));
          ratio = 1 - (y - this.trackY) / this.trackLength;
        }
  
        let newValue;
        if (this.log) {
          if (this._min <= 0) {
            console.warn("webaudio-slider: Logarithmic scale requires min > 0.");
            newValue = this._min;
          } else {
            newValue = this._min * Math.pow(this._max / this._min, ratio);
          }
        } else {
          newValue = this._min + ratio * (this._max - this._min);
        }
  
        this.setValue(newValue, true);
      }
  
      // Handle changes from the linked param
      handleParamChange(e) {
        if (this.updatingFromSlider) return; // Prevent circular update
        const newValue = parseFloat(e.target.value);
        if (!isNaN(newValue) && newValue !== this._value) {
          this.setValue(newValue, false);
        }
      }
  
      // Update linked param when slider changes
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
    });
  } catch (error) {
    console.error("webaudio-slider already defined or error in definition:", error);
  }




  

  try {
    // Helper function to draw a hexagon
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
  
    customElements.define("webaudio-switch", class WebAudioSwitch extends WebAudioControlsWidget {
      constructor() {
        super();
  
        // Bind methods
        this.pointerdown = this.pointerdown.bind(this);
        this.keydown = this.keydown.bind(this);
        this.wheel = this.wheel.bind(this);
        this.redraw = this.redraw.bind(this);
        this.handleParamChange = this.handleParamChange.bind(this);
        this.onMidiMessage = this.onMidiMessage.bind(this);
  
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
  
        // Define HTML structure
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
              width: 100%;
              text-align: center;
              top: 100%;
              left: 0;
              transform: translateY(4px);
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
        this.outline = this.getAttribute("outline") || "1px solid #444";
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
  
        // MIDI Initialization
        this.midilearn = this.getAttr("midilearn", opt.midilearn);
        console.log("Initialized midilearn:", this.midilearn);
        
        this.midicc = this.getAttr("midicc", null);
        console.log("Initialized midicc:", this.midicc);
        
        this.midiController = {};
        this.midiMode = "normal";
        
        if (this.midicc) {
            console.log("Parsing midicc:", this.midicc);
            let ch = parseInt(this.midicc.substring(0, this.midicc.lastIndexOf("."))) - 1;
            let cc = parseInt(this.midicc.substring(this.midicc.lastIndexOf(".") + 1));
            console.log("Setting MIDI controller - channel:", ch, "CC:", cc);
            this.setMidiController(ch, cc);
        }
        
        let retries = 0;
        const maxRetries = 5; // Retry up to 50 times (5 seconds total if 100ms delay)
        const attemptToLoadMidiLearn = () => {
            if (window.webAudioControlsWidgetManager && window.webAudioControlsWidgetManager.midiLearnTable) {
                const ml = window.webAudioControlsWidgetManager.midiLearnTable;
                for (let i = 0; i < ml.length; ++i) {
                    if (ml[i].id === this.id) {
                        console.log(`Loaded MIDI mapping for widget ${this.id}`);
                        this.setMidiController(ml[i].cc.channel, ml[i].cc.cc);
                        return; // Stop retrying on success
                    }
                }
                console.warn(`No MIDI mapping found for widget ID: ${this.id}`);
            } else if (retries < maxRetries) {
                console.warn(`Retrying MIDI load for widget ID: ${this.id}. Attempt: ${++retries}`);
                setTimeout(attemptToLoadMidiLearn, 100); // Retry after 100ms
            } else {
                console.error(`Failed to load MIDI mapping for widget ID: ${this.id} after ${maxRetries} attempts.`);
            }
        };
        attemptToLoadMidiLearn();
  
        // Register in group if type is radio
        if (this.type === "radio" && this.group) {
          if (!window.webaudioSwitchGroups[this.group]) {
            window.webaudioSwitchGroups[this.group] = [];
          }
          window.webaudioSwitchGroups[this.group].push(this);
        }
  
        // Global registration
        window.webaudioSwitches = window.webaudioSwitches || {};
        if (this.id) {
          window.webaudioSwitches[this.id] = this;
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
        // Add to widget manager
        if (window.webAudioControlsWidgetManager)
          window.webAudioControlsWidgetManager.addWidget(this);
      }
  
      disconnectedCallback() {
        // Remove event listeners
        this.elem.removeEventListener('keydown', this.keydown);
        this.elem.removeEventListener('mousedown', this.pointerdown);
        this.elem.removeEventListener('touchstart', this.pointerdown);
        this.elem.removeEventListener('wheel', this.wheel, { passive: false });
  
        // Unobserve ResizeObserver
        if (this.resizeObserver) {
          this.resizeObserver.unobserve(this);
        }
  
        // Additional cleanup
        if (this.linkedParam) {
          this.linkedParam.removeEventListener("input", this.handleParamChange);
        }
  
        // Remove from widget manager
        if (window.webAudioControlsWidgetManager)
          window.webAudioControlsWidgetManager.removeWidget(this);
  
        // Remove from group if radio
        if (this.type === "radio" && this.group && window.webaudioSwitchGroups[this.group]) {
          window.webaudioSwitchGroups[this.group] = window.webaudioSwitchGroups[this.group].filter(sw => sw !== this);
        }
      }
  
  
      setValue(v,f){
      this.value=v;
      this.checked=(!!v);
      if(this.value!=this.oldvalue){
        this.redraw();
        this.showtip(0);
        if(f){
          this.sendEvent("input");
          this.sendEvent("change");
        }
        this.oldvalue=this.value;
      }
    }

    handleSwitchMidiMessage(event) {

      //console.log("handleSwitchMidiMessage:", event.data);
      const data = event.data;
      const status = data[0];
      const channel = status & 0x0F;
      const type = status & 0xF0;
      const cc = data[1];
      const value = data[2];
    
      if (type === 0xB0 && channel === this.midiController.channel && cc === this.midiController.cc) {
        if (this.type === "toggle" || this.type === "radio") {
          const newState = value > 0 ? 1 : 0;
          this.setState(newState, true);
        } else if (this.type === "kick") {
          if (value > 0) {
            this.triggerKick();
          }
        } else if (this.type === "sequential") {
          // For sequential type, map MIDI value to state within min and max
          const range = this._max - this._min + 1;
          const mappedState = this._min + Math.floor((value / 128) * range);
          this.setState(mappedState, true);
        }
      }
  
    }
  
      onMidiMessage(event) {

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
      }
  
      redraw() {
        // Draw the switch based on the current state and type
        this.drawSwitch();
  
        // Update tooltip if necessary
        if (this.fireflag) {
          this.showtip(0);
          this.fireflag = false;
        }
  
        // Update linked param if exists
        if (this.linkedParam) {
          if (parseInt(this.linkedParam.value) !== this._state) {
            this.updatingFromSwitch = true;
            this.linkedParam.value = this._state;
            this.updatingFromSwitch = false;
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
          // Draw a hexagon for 'kick' type
          drawHexagon(ctx, this.centerX, this.centerY, this.radius, this.coltab[0], this.coltab[1]);
        } else {
          // Draw a circle for other types
          ctx.beginPath();
          ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
          ctx.fillStyle = this.coltab[0]; // Background color
          ctx.fill();
          ctx.strokeStyle = this.coltab[1]; // Stroke color
          ctx.lineWidth = 1;
          ctx.stroke();
        }
  
        // If active, fill the inside
        if (this.isActive()) {
          if (this.type === 'kick') {
            // For hexagon, fill a smaller hexagon or change the color
            drawHexagon(ctx, this.centerX, this.centerY, this.radius * 0.7, this.coltab[1], this.coltab[1]);
          } else {
            // For circle, fill a smaller circle
            ctx.beginPath();
            ctx.arc(this.centerX, this.centerY, this.radius * 0.8, 0, Math.PI * 2);
            ctx.fillStyle = this.coltab[1]; // Fill color
            ctx.fill();
          }
        }
  
        // Draw mode-specific indicators
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
        ctx.font = `${fontSize}px Orbit`;
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
            return this._state > 0;
          case 'sequential':
            return this._state > this._min;
          default:
            return this._state === 1;
        }
      }
  
      _setState(v) {
        // Removed 'sequential' type handling to prevent conflicts
        v = parseInt(v);
        let changed = false;
  
        if (this.type === 'toggle') {
          v = v ? 1 : 0;
          if (v !== this._state) {
            this._state = v;
            changed = true;
          }
        } else if (this.type === 'radio') {
          // For radio, v should be 1 (active) or 0 (inactive)
          v = v ? 1 : 0;
          if (v !== this._state) {
            this._state = v;
            changed = true;
            if (v === 1 && this.group && window.webaudioSwitchGroups[this.group]) {
              // Deactivate other switches in the group
              window.webaudioSwitchGroups[this.group].forEach(sw => {
                if (sw !== this && sw._state !== 0) {
                  sw.setState(0, true);
                }
              });
            }
          }
        } else if (this.type === 'sequential') {
          // Removed handling here to prevent conflicts
          // Sequential type is now fully handled in setState
        } else if (this.type === 'kick') {
          if (v !== this._state) {
            this._state = v;
            changed = true;
          }
        }
  
        if (changed) {
          this.fireflag = true;
          this.redraw();
          return true;
        }
        return false;
      }
  
      setState(v, fire = false) {
        if (this.type === 'sequential') {
          // For sequential, ensure state wraps correctly based on step
          let newState = v;
          if (newState > this._max) {
            newState = this._min;
          } else if (newState < this._min) {
            newState = this._max;
          }
  
          if (newState !== this._state) {
            this._state = newState;
            this.fireflag = true;
            this.redraw();
            if (fire) {
              this.sendEvent("input");
              this.sendEvent("change");
              this.updateLinkedParam(); // Update linked param if exists
            }
          }
        } else {
          if (this._setState(v) && fire) {
            this.sendEvent("input");
            this.sendEvent("change");
            this.updateLinkedParam(); // Update linked param if exists
  
            // If in radio mode, ensure group behavior
            if (this.type === "radio" && this.group) {
              // Already handled in _setState
            }
  
            // If in kick mode, reset after activation
            if (this.type === "kick" && v === 1) {
              setTimeout(() => {
                this.setState(0, true);
              }, 100); // 100ms delay; adjust as needed
            }
          }
        }
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
        const newState = this._state ? 0 : 1;
        this.setState(newState, true);
      }
  
      /**
       * Triggers a kick (momentary press).
       */
      triggerKick() {
        this.setState(1, true);
        // The reset is handled in setState with a timeout
      }
  
      /**
       * Cycles through states (for sequential type).
       * Accepts an optional delta to increment/decrement.
       */
      cycleState(delta = 1) {
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
        if (this.type !== "radio") return;
        this.setState(1, true);
      }
  
      // Handle changes from the linked param
      handleParamChange(e) {
        if (this.updatingFromSwitch) return; // Prevent circular update
        const newValue = parseInt(e.target.value);
        if (!isNaN(newValue) && newValue !== this._state) {
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
          }
        }
      }
    });
  } catch (error) {
    console.error("webaudio-switch already defined or error in definition:", error);
  }
  
  
  
  
  























  


  
try{
  customElements.define("webaudio-param", class WebAudioParam extends WebAudioControlsWidget {
    constructor(){
      super();
      this.addEventListener("keydown",this.keydown);
      this.addEventListener("mousedown",this.pointerdown,{passive:false});
      this.addEventListener("touchstart",this.pointerdown,{passive:false});
      this.addEventListener("wheel",this.wheel, { passive: false });
      this.addEventListener("mouseover",this.pointerover);
      this.addEventListener("mouseout",this.pointerout);
      this.addEventListener("contextmenu",this.contextMenu);
    }
    connectedCallback(){
      let root;
      if(this.attachShadow)
        root=this.attachShadow({mode: 'open'});
      else
        root=this;
      root.innerHTML=
`<style>
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
  vertical-align:baseline;
}
.webaudio-param-body{
  display:inline-block;
  position:relative;
  text-align:center;
  background:none;
  margin:0;
  padding:0;
  font-family:sans-serif;
  font-size:11px;
  vertical-align:bottom;
  border:none;
}
</style>
<input class='webaudio-param-body' value='0' inputmode='none' tabindex='1' touch-action='none'/><div class='webaudioctrl-tooltip'></div>
`;
      this.elem=root.childNodes[2];
      this.ttframe=root.childNodes[3];
      this.enable=this.getAttr("enable",1);
      this._value=this.getAttr("value",0); if (!this.hasOwnProperty("value")) Object.defineProperty(this,"value",{get:()=>{return this._value},set:(v)=>{this._value=v;this.redraw()}});
      this.defvalue=this.getAttr("defvalue",0);
      this._fontsize=this.getAttr("fontsize",9); if (!this.hasOwnProperty("fontsize")) Object.defineProperty(this,"fontsize",{get:()=>{return this._fontsize},set:(v)=>{this._fontsize=v;this.setupImage()}});
      this._src=this.getAttr("src",opt.paramSrc); if (!this.hasOwnProperty("src")) Object.defineProperty(this,"src",{get:()=>{return this._src},set:(v)=>{this._src=v;this.setupImage()}});
      this.link=this.getAttr("link","");
      this._width=this.getAttr("width",opt.paramWidth); if (!this.hasOwnProperty("width")) Object.defineProperty(this,"width",{get:()=>{return this._width},set:(v)=>{this._width=v;this.setupImage()}});
      this._height=this.getAttr("height",opt.paramHeight); if (!this.hasOwnProperty("height")) Object.defineProperty(this,"height",{get:()=>{return this._height},set:(v)=>{this._height=v;this.setupImage()}});
      this._colors=this.getAttr("colors",opt.paramColors); if (!this.hasOwnProperty("colors")) Object.defineProperty(this,"colors",{get:()=>{return this._colors},set:(v)=>{this._colors=v;this.setupImage()}});
      this.outline=this.getAttr("outline",opt.outline);
      this.rconv=this.getAttr("rconv",null);
      this.midiController={};
      this.midiMode="normal";
      this.currentLink=null;
      if(this.midicc) {
        let ch = parseInt(this.midicc.substring(0, this.midicc.lastIndexOf("."))) - 1;
        let cc = parseInt(this.midicc.substring(this.midicc.lastIndexOf(".") + 1));
        this.setMidiController(ch, cc);
      }
      this.setupImage();

      // Setup event listener for triggering the numeric keyboard
      this.setupKeyboardInteraction();



      if(window.webAudioControlsWidgetManager)
        window.webAudioControlsWidgetManager.updateWidgets();
      //  window.webAudioControlsWidgetManager.addWidget(this);
      this.fromLink=((e)=>{
        this.setValue(e.target.convValue.toFixed(e.target.digits));
      }).bind(this);
      this.elem.onchange=()=>{
        if(!this.currentLink.target.conv || (this.currentLink.target.conv&&this.rconv)){
          let val = this.value=this.elem.value;
          if(this.rconv){
            let x=+this.elem.value;
            val=eval(this.rconv);
          }
          if(this.currentLink){
            this.currentLink.target.setValue(val, true);
          }
        }
      }
    }
    
    disconnectedCallback(){}
    setupImage(){
      this.imgloaded=()=>{
        if(this.src!=""&&this.src!=null){
          this.elem.style.backgroundImage = "url("+this.src+")";
          this.elem.style.backgroundSize = "100% 100%";
          if(this._width==null) this._width=this.img.width;
          if(this._height==null) this._height=this.img.height;
        }
        else{
          if(this._width==null) this._width=32;
          if(this._height==null) this._height=20;
        }
        this.elem.style.width=this._width+"px";
        this.elem.style.height=this._height+"px";
        this.elem.style.fontSize=this.fontsize+"px";
        let l=document.getElementById(this.link);
        if(l&&typeof(l.value)!="undefined"){
          if(typeof(l.convValue)=="number")
            this.setValue(l.convValue.toFixed(l.digits));
          else
            this.setValue(l.convValue);
          if(this.currentLink)
            this.currentLink.removeEventListener("input",this.currentLink.func);
          this.currentLink={target:l, func:(e)=>{
            if(typeof(l.convValue)=="number")
              this.setValue(l.convValue.toFixed(l.digits));
            else
              this.setValue(l.convValue);
          }};
          this.currentLink.target.addEventListener("input",this.currentLink.func);
  //        l.addEventListener("input",(e)=>{this.setValue(l.convValue.toFixed(l.digits))});
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
      this.elem.value=this.value;
    }

    setupKeyboardInteraction() {
      const keyboardModal = document.getElementById("numericKeyboardModal");
      const keyboard = keyboardModal.querySelector("webaudio-numeric-keyboard");

      this.elem.addEventListener("click", () => {
        if (!this.enable) return;

        // Pass current value to the numeric keyboard
        keyboard.value = this.value || "";
        keyboard.outputElement.textContent = keyboard.value;

        // Show the keyboard modal
        const bootstrapModal = new bootstrap.Modal(keyboardModal);
        bootstrapModal.show();

        // Handle the confirmation of a value
        keyboard.addEventListener(
          "submit",
          (e) => {
            const newValue = e.detail || keyboard.value;
            this.setValue(newValue, true); // Update the param value
            this.updateLinkedElements(newValue); // Update linked elements
            bootstrapModal.hide();
          },
          { once: true } // Ensure we only listen for one submit event per interaction
        );
      });
    }

    updateLinkedElements(value) {
      if (this.currentLink) {
        this.currentLink.target.setValue(value, true); // Update linked knob or slider
      }

      // Trigger change event for other listeners
      const event = new Event("change", { bubbles: true, cancelable: true });
      this.dispatchEvent(event);
    }


    setValue(v,f){
      this.value=v;
      if(this.value!=this.oldvalue){
        this.redraw();
        this.showtip(0);
        if(f){
          let event=document.createEvent("HTMLEvents");
          event.initEvent("change",false,true);
          this.dispatchEvent(event);
        }
        this.oldvalue=this.value;
      }
    }
    pointerdown(ev) {
      ev.preventDefault(); // Stop default behavior
      console.log("Debug: pointerdown triggered", ev);
    
      if (!this.enable) return;
    
      const e = ev.touches ? ev.touches[0] : ev;
      if (!ev.touches && (e.buttons !== 1 && e.button !== 0)) return;
    
      this.elem.focus();
      console.log("Debug: Focus set on element", this.elem);
      this.redraw();
    }
  });
} catch(error){
  console.log("webaudio-param already defined");
}









try{
customElements.define("webaudio-keyboard", class WebAudioKeyboard extends WebAudioControlsWidget {
  constructor(){
    super();
  }
  connectedCallback(){
    let root;
    if(this.attachShadow)
      root=this.attachShadow({mode: 'open'});
    else
      root=this;
    root.innerHTML=
`<style>
${this.basestyle}
:host{
  display:inline-block;
  position:relative;
  margin:0;
  padding:0;
  font-family: SpaceMono;
  font-size: 11px;
}
.webaudio-keyboard-body{
  display:inline-block;
  margin:0;
  padding:0;
  vertical-align:bottom;
}
</style>
<canvas class='webaudio-keyboard-body' tabindex='1' touch-action='none'></canvas><div class='webaudioctrl-tooltip'></div>
`;
    this.elem=this.cv=root.childNodes[2];
    this.ttframe=root.childNodes[3];
    this.ctx=this.cv.getContext("2d");
    this._values=[];
    this.enable=this.getAttr("enable",1);
    this._width=this.getAttr("width",480); if (!this.hasOwnProperty("width")) Object.defineProperty(this,"width",{get:()=>{return this._width},set:(v)=>{this._width=v;this.setupImage()}});
    this._height=this.getAttr("height",128); if (!this.hasOwnProperty("height")) Object.defineProperty(this,"height",{get:()=>{return this._height},set:(v)=>{this._height=v;this.setupImage()}});
    this._min=this.getAttr("min",0); if (!this.hasOwnProperty("min")) Object.defineProperty(this,"min",{get:()=>{return this._min},set:(v)=>{this._min=+v;this.redraw()}});
    this._keys=this.getAttr("keys",25); if (!this.hasOwnProperty("keys")) Object.defineProperty(this,"keys",{get:()=>{return this._keys},set:(v)=>{this._keys=+v;this.setupImage()}});
    this._colors=this.getAttr("colors","#222;#eee;#ccc;#333;#000;#e88;#c44;#c33;#800"); if (!this.hasOwnProperty("colors")) Object.defineProperty(this,"colors",{get:()=>{return this._colors},set:(v)=>{this._colors=v;this.setupImage()}});
    this.outline=this.getAttr("outline",opt.outline);
    this.midilearn=this.getAttr("midilearn",0);
    this.midicc=this.getAttr("midicc",null);
    this.press=0;
    this.keycodes1=[90,83,88,68,67,86,71,66,72,78,74,77,188,76,190,187,191,226];
    this.keycodes2=[81,50,87,51,69,82,53,84,54,89,55,85,73,57,79,48,80,192,222,219];
    this.addEventListener("keyup",this.keyup);
    this.midiController={};
    this.midiMode="normal";
    if(this.midicc) {
        let ch = parseInt(this.midicc.substring(0, this.midicc.lastIndexOf("."))) - 1;
        let cc = parseInt(this.midicc.substring(this.midicc.lastIndexOf(".") + 1));
        this.setMidiController(ch, cc);
    }
    this.setupImage();
    this.digits=0;
    if(this.step && this.step < 1) {
      for(let n = this.step ; n < 1; n *= 10)
        ++this.digits;
    }
    if(window.webAudioControlsWidgetManager)
      window.webAudioControlsWidgetManager.addWidget(this);
  }
  disconnectedCallback(){}
  setupImage(){
    this.cv.style.width=this.width+"px";
    this.cv.style.height=this.height+"px";
    this.bheight = this.height * 0.55;
    this.kp=[0,7/12,1,3*7/12,2,3,6*7/12,4,8*7/12,5,10*7/12,6];
    this.kf=[0,1,0,1,0,0,1,0,1,0,1,0];
    this.ko=[0,0,(7*2)/12-1,0,(7*4)/12-2,(7*5)/12-3,0,(7*7)/12-4,0,(7*9)/12-5,0,(7*11)/12-6];
    this.kn=[0,2,4,5,7,9,11];
    this.coltab=this.colors.split(";");
    this.cv.width = this.width;
    this.cv.height = this.height;
    this.cv.style.width = this.width+'px';
    this.cv.style.height = this.height+'px';
    this.style.height = this.height+'px';
    this.cv.style.outline=this.outline?"":"none";
    this.bheight = this.height * 0.55;
    this.max=this.min+this.keys-1;
    this.dispvalues=[];
    this.valuesold=[];
    if(this.kf[this.min%12])
      --this.min;
    if(this.kf[this.max%12])
      ++this.max;
    this.redraw();
  }
  redraw(){
    function rrect(ctx, x, y, w, h, r, c1, c2) {
      if(c2) {
        let g=ctx.createLinearGradient(x,y,x+w,y);
        g.addColorStop(0,c1);
        g.addColorStop(1,c2);
        ctx.fillStyle=g;
      }
      else
        ctx.fillStyle=c1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x+w, y);
      ctx.lineTo(x+w, y+h-r);
      ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
      ctx.lineTo(x+r, y+h);
      ctx.quadraticCurveTo(x, y+h, x, y+h-r);
      ctx.lineTo(x, y);
      ctx.fill();
    }
    this.ctx.fillStyle = this.coltab[0];
    this.ctx.fillRect(0,0,this.width,this.height);
    let x0=7*((this.min/12)|0)+this.kp[this.min%12];
    let x1=7*((this.max/12)|0)+this.kp[this.max%12];
    let n=x1-x0;
    this.wwidth=(this.width-1)/(n+1);
    this.bwidth=this.wwidth*7/12;
    let h2=this.bheight;
    let r=Math.min(8,this.wwidth*0.2);
    for(let i=this.min,j=0;i<=this.max;++i) {
      if(this.kf[i%12]==0) {
        let x=this.wwidth*(j++)+1;
        if(this.dispvalues.indexOf(i)>=0)
          rrect(this.ctx,x,1,this.wwidth-1,this.height-2,r,this.coltab[5],this.coltab[6]);
        else
          rrect(this.ctx,x,1,this.wwidth-1,this.height-2,r,this.coltab[1],this.coltab[2]);
      }
    }
    r=Math.min(8,this.bwidth*0.3);
    for(let i=this.min;i<this.max;++i) {
      if(this.kf[i%12]) {
        let x=this.wwidth*this.ko[this.min%12]+this.bwidth*(i-this.min)+1;
        if(this.dispvalues.indexOf(i)>=0)
          rrect(this.ctx,x,1,this.bwidth,h2,r,this.coltab[7],this.coltab[8]);
        else
          rrect(this.ctx,x,1,this.bwidth,h2,r,this.coltab[3],this.coltab[4]);
        this.ctx.strokeStyle=this.coltab[0];
        this.ctx.stroke();
      }
    }
  }
  _setValue(v){
    if(this.step)
      v=(Math.round((v-this.min)/this.step))*this.step+this.min;
    this._value=Math.min(this.max,Math.max(this.min,v));
    if(this._value!=this.oldvalue){
      this.oldvalue=this._value;
      this.fireflag=true;
      if(this.conv){
        const x=this._value;
        this.convValue=eval(this.conv);
        if(typeof(this.convValue)=="function")
          this.convValue=this.convValue(x);
      }
      else
        this.convValue=this._value;
      if(typeof(this.convValue)=="number"){
        this.convValue=this.convValue.toFixed(this.digits);
      }
      this.redraw();
      this.showtip(0);
      return 1;
    }
    return 0;
  }
  setValue(v,f){
    this.value=v;
    if(this.value!=this.oldvalue){
      this.redraw();
      this.showtip(0);
      if(f){
        let event=document.createEvent("HTMLEvents");
        event.initEvent("change",false,true);
        this.dispatchEvent(event);
      }
      this.oldvalue=this.value;
    }
  }
  pointerdown(ev){
    if(!this.enable)
      return;
    let e=ev;
    if(ev.touches){
      e = ev.touches[0];
      this.identifier=e.identifier;
    }
    else {
      if(e.buttons!=1 && e.button!=0)
        return;
    }
    this.elem.focus();
    this.drag=1;
    this.showtip(0);
    let pointermove=(ev)=>{
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    let pointerup=(e)=>{
      this.drag=0;
      this.showtip(0);
      window.removeEventListener('mousemove', pointermove);
      window.removeEventListener('touchmove', pointermove, {passive:false});
      window.removeEventListener('mouseup', pointerup);
      window.removeEventListener('touchend', pointerup);
      window.removeEventListener('touchcancel', pointerup);
      document.body.removeEventListener('touchstart', preventScroll,{passive:false});
      if(this.type=="kick"){
        this.setValue(0, true);
        this.sendEvent("change");
      }
      this.sendEvent("click");
      e.preventDefault();
      e.stopPropagation();
    }
    let preventScroll=(e)=>{
      e.preventDefault();
    }
    switch(this.type){
    case "kick":
      this.setValue(1, true);
      this.sendEvent("change");
      break;
    case "toggle":
      if(e.ctrlKey || e.metaKey)
        this.value=defvalue;
      else
        this.value=1-this.value;
      this.checked=!!this.value;
      this.sendEvent("change");
      break;
    case "radio":
      let els=document.querySelectorAll("webaudio-switch[type='radio'][group='"+this.group+"']");
      for(let i=0;i<els.length;++i){
        if(els[i]==this)
          els[i].setValue(1, true);
        else
          els[i].setValue(0, true);
      }
      this.sendEvent("change");
      break;
    }

    window.addEventListener('mouseup', pointerup);
    window.addEventListener('touchend', pointerup);
    window.addEventListener('touchcancel', pointerup);
    document.body.addEventListener('touchstart', preventScroll,{passive:false});
    this.redraw();
    ev.preventDefault();
    ev.stopPropagation();
    return false;
  }
});
} catch(error){
  console.log("webaudio-keyboard already defined");
}

try {
  customElements.define(
    "webaudio-numeric-keyboard",
    class WebAudioNumericKeyboard extends WebAudioControlsWidget {
      constructor() {
        super();
        this.value = "0"; // Initialize value to 0
        this.hasStartedTyping = false; // Tracks if user started typing
        this.isModalVisible = false; // Track modal visibility
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
            .numeric-keyboard {
                display: grid;
                grid-template-columns: repeat(4, 1fr); /* 4 columns */
                gap: 10px;
                justify-items: center;
            }
            .numeric-keyboard .button {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%; /* Fill grid cell */
                height: 50px;
                background-color: #333;
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
                grid-column: span 2; /* Span 2 columns for the double-width button */
            }
            .output {
                text-align: right;
                font-size: 16px;
                padding: 5px 10px;
                margin-bottom: 10px;
                background: #222;
                color: white;
                border-radius: 5px;
                grid-column: span 4; /* Stretch across all columns */
                font-family: 'SpaceMono', sans-serif;
            }
        </style>
        <div class="output">${this.value || "0"}</div>
        <div class="numeric-keyboard">
            ${this.createButtons()}
        </div>
        `;
    
        this.outputElement = root.querySelector(".output");
        this.buttons = root.querySelectorAll(".button");
    
        // Add click event listeners for buttons
        this.buttons.forEach((button) =>
            button.addEventListener("click", (e) => this.handleButtonPress(e))
        );
    
        // Modal handling
        this.keyboardModal = document.getElementById("numericKeyboardModal");
        if (this.keyboardModal) {
            this.initializeModal();
        } else {
            console.error("Modal element not found!");
        }
    }
    
    initializeModal() {
        const showModal = () => {
            this.isModalVisible = true;
            this.hasStartedTyping = false; // Reset typing state
            this.outputElement.textContent = this.value || "0"; // Show current value
            this.keyboardModal.classList.add("active");
            document.addEventListener("keydown", this.handleKeyboardInput.bind(this));
        };
    
        const hideModal = () => {
            this.isModalVisible = false;
            this.keyboardModal.classList.remove("active");
            document.removeEventListener("keydown", this.handleKeyboardInput.bind(this));
        };
    
        // Set up event listeners
        this.keyboardModal.addEventListener("shown.bs.modal", showModal);
        this.keyboardModal.addEventListener("hidden.bs.modal", hideModal);
    
        // Public methods for external toggling
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
        const key = event.key;
        if (!this.isModalVisible) return;

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
          this.dispatchEvent(new CustomEvent("submit", { detail: this.value }));
        } else if (value === "-") {
          this.value = this.value.startsWith("-") ? this.value.slice(1) : `-${this.value}`;
        } else if (value === "+") {
          this.value = this.value.replace("-", "");
        } else if (!isNaN(value) || value === ".") {
          if (!this.hasStartedTyping) {
            this.value = "";
            this.hasStartedTyping = true;
          }
          this.value += value;
        }
        this.outputElement.textContent = this.value;
        this.dispatchEvent(new Event("input"));
      }
    }
  );
} catch (error) {
  console.error("WebAudioNumericKeyboard already defined:", error);
}





class WebAudioControlsWidgetManager {
  constructor() {
    console.log("Initializing WebAudioControlsWidgetManager...");

    this.midiAccess = null;
    this.listOfWidgets = Array.from(
      document.querySelectorAll(
        "webaudio-knob, webaudio-slider, webaudio-switch, webaudio-param, webaudio-keyboard"
      )
    );
    this.listOfExternalMidiListeners = [];
    this._trackId = null; // Initialize trackId

    this.updateWidgets();
    console.log("After updateWidgets call, listOfWidgets:", this.listOfWidgets);
  }

  setTrackId(trackId) {
    console.log(`Setting track ID to: ${trackId}`);
    this._trackId = trackId;

    // Load MIDI Learn Table for the specific track
    this.loadMIDILearnTable();
  }

  loadMIDILearnTable() {
    if (!this._trackId) {
      console.error("Track ID is not set. Cannot load MIDI Learn Table.");
      return;
    }

    // Define the key using trackId
    const storageKey = `WebAudioControlsMidiLearn_${this._trackId}`;
    console.log(`Loading MIDI Learn Table using key: ${storageKey}`);

    // Initialize MIDI only if required
    if (window.UseWebAudioControlsMidi || opt.useMidi) {
      console.log("MIDI is enabled. Initializing MIDI settings...");
      if (opt.preserveMidiLearn) {
        const storedMidiLearn = localStorage.getItem(storageKey);
        console.log("Stored MIDI Learn Table in localStorage:", storedMidiLearn);

        try {
          this.midiLearnTable = JSON.parse(storedMidiLearn);
          console.log("Parsed MIDI Learn Table:", this.midiLearnTable);
        } catch (error) {
          console.error("Error parsing MIDI Learn Table from localStorage:", error);
          this.midiLearnTable = null;
        }
      } else {
        console.log("MIDI Learn Table is not preserved. Setting to null.");
        this.midiLearnTable = null;
      }

      this.initWebAudioControls();
    } else {
      console.log("MIDI is disabled.");
      this.midiLearnTable = null;
    }

    console.log("Initialization complete. Final state:", {
      midiAccess: this.midiAccess,
      listOfWidgets: this.listOfWidgets,
      listOfExternalMidiListeners: this.listOfExternalMidiListeners,
      midiLearnTable: this.midiLearnTable,
    });
  }

  updateWidgets() {
    // Convert NodeList to Array
    this.listOfWidgets = Array.from(
      document.querySelectorAll(
        "webaudio-knob, webaudio-slider, webaudio-switch, webaudio-param, webaudio-keyboard"
      )
    );
    console.log("Widgets updated:", this.listOfWidgets);
  }

  addWidget(w) {
    if (typeof w !== "object") {
      console.error("Invalid widget passed to addWidget:", w);
      return;
    }

    // Ensure listOfWidgets is an array
    if (!Array.isArray(this.listOfWidgets)) {
      console.warn("listOfWidgets is not an array. Converting...");
      this.listOfWidgets = Array.from(this.listOfWidgets);
    }

    // Add the widget to the array
    this.listOfWidgets.push(w);
    console.log(`Widget added: ${w.id || w.tagName}`);

    // Optionally, apply MIDI mappings if available
    if (this.midiLearnTable) {
      const mapping = this.midiLearnTable.find((entry) => entry.id === w.id);
      if (mapping) {
        w.midiController = mapping.cc;
        console.log(`Applied MIDI mapping to widget ${w.id}`, mapping.cc);
      }
    }
  }

  initWebAudioControls() {
    if (navigator.requestMIDIAccess) {
      navigator
        .requestMIDIAccess({ sysex: true }) // Enable sysex if required
        .then(
          (midiAccess) => {
            this.onMIDIStarted(midiAccess);
          },
          (err) => {
            console.error("MIDI not initialized - error encountered:", err.message);
          }
        );
    } else {
      console.error("Web MIDI API not supported in this browser.");
    }
  }

  enableInputs(midiAccess) {
    let inputs = midiAccess.inputs.values();
    for (
      let input = inputs.next();
      input && !input.done;
      input = inputs.next()
    ) {
      input.value.onmidimessage = this.handleMIDIMessage.bind(this);
      console.log(`Enabled MIDI input: ${input.value.name}`);
    }
  }

  midiConnectionStateChange(e) {
    console.log(`MIDI port ${e.port.name} is ${e.port.connection}`);
    // Re-enable inputs if necessary
    if (e.port.connection === "connected") {
      this.enableInputs(this.midiAccess);
    }
  }

  onMIDIStarted(midi) {
    console.log("MIDI access granted.");
    this.midiAccess = midi; // Correctly using the 'midi' parameter
    midi.onstatechange = this.midiConnectionStateChange.bind(this);
    this.enableInputs(midi); // Pass midiAccess to enableInputs
  }

  // Add hooks for external midi listeners support
  addMidiListener(callback) {
    if (typeof callback === "function") {
      this.listOfExternalMidiListeners.push(callback);
      console.log("Added external MIDI listener.");
    } else {
      console.error("Callback provided to addMidiListener is not a function.");
    }
  }

  getCurrentConfigAsJSON() {
    // Assuming currentConfig is defined elsewhere
    if (typeof currentConfig !== "undefined") {
      return JSON.stringify(currentConfig);
    } else {
      console.error("currentConfig is not defined.");
      return "{}";
    }
  }

  handleMIDIMessage(event) {
    // Retained: Log the incoming MIDI message data
   // console.log(`MIDI IN:`, event.data);

    // Handle external MIDI messages
    this.listOfExternalMidiListeners.forEach(function (externalListener) {
      externalListener(event);
    });

    if (
      (event.data[0] & 0xf0) === 0xf0 ||
      ((event.data[0] & 0xf0) === 0xb0 && event.data[1] >= 120)
    )
      return;

    for (let w of this.listOfWidgets) {
      if (w.processMidiEvent) w.processMidiEvent(event);
    }
  }

  contextMenuOpen(e, knob) {
    if (!this.midiAccess) return;
    let menu = document.getElementById("webaudioctrl-context-menu");
    menu.style.left = e.pageX + "px";
    menu.style.top = e.pageY + "px";
    menu.knob = knob;
    menu.classList.add("active");
    menu.knob.focus();
    menu.knob.addEventListener("keydown", this.contextMenuCloseByKey.bind(this));
    console.log("Context menu opened for knob:", knob.id || knob.tagName);
  }

  contextMenuCloseByKey(e) {
    if (e.keyCode == 27) this.contextMenuClose();
  }

  contextMenuClose() {
    let menu = document.getElementById("webaudioctrl-context-menu");
    if (menu.knob) {
      menu.knob.removeEventListener(
        "keydown",
        this.contextMenuCloseByKey
      );
    }
    menu.classList.remove("active");
    let menuItemLearn = document.getElementById(
      "webaudioctrl-context-menu-learn"
    );
    menuItemLearn.innerHTML = "Learn";
    if (menu.knob) {
      menu.knob.midiMode = "normal";
    }
    console.log("Context menu closed.");
  }

  contextMenuLearn() {
    let menu = document.getElementById("webaudioctrl-context-menu");
    let menuItemLearn = document.getElementById(
      "webaudioctrl-context-menu-learn"
    );
    menuItemLearn.innerHTML = "Listening...";
    menu.knob.midiMode = "learn";
    console.log("Context menu set to 'Learn' mode.");
  }

  contextMenuClear(e) {
    let menu = document.getElementById("webaudioctrl-context-menu");
    if (menu.knob) {
      menu.knob.midiController = {};
      console.log(
        `MIDI LOG: Cleared MIDI mapping for widget: ${menu.knob.id || menu.knob.tagName}`
      );
    }
    this.contextMenuClose();
  }

  preserveMidiLearn() {
    if (!opt.preserveMidiLearn) return;

    if (!this._trackId) {
      console.error("Track ID is not set. Cannot preserve MIDI Learn Table.");
      return;
    }

    const storageKey = `WebAudioControlsMidiLearn_${this._trackId}`;
    const v = [];
    for (let w of this.listOfWidgets) {
      if (w.id)
        v.push({ id: w.id, cc: w.midiController });
    }
    const s = JSON.stringify(v);
    localStorage.setItem(storageKey, s);
    console.log(
      `MIDI LOG: Preserved MIDI Learn mappings to localStorage with key: ${storageKey}`
    );
  }
}

// Instantiate and attach the manager if MIDI is enabled
if (window.UseWebAudioControlsMidi || opt.useMidi) {
  window.webAudioControlsWidgetManager =
    window.webAudioControlsMidiManager = new WebAudioControlsWidgetManager();
  console.log("WebAudioControlsWidgetManager instantiated.");
}

 }


