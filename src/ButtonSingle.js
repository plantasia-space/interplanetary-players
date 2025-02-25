/* -------------------------------------------
   ButtonSingle Class
   ------------------------------------------- */
   export class ButtonSingle {
    static groups = {};
  
    constructor(
      buttonSelector,
      svgPath,
      clickHandler = null,
      mode = "default",
      wavesurfer = null,
      groupName = null,
      forceOneActive = false
    ) {
      this.button = document.querySelector(buttonSelector);
      if (!this.button) {
        console.error(`ButtonSingle Error: No element found for "${buttonSelector}"`);
        return;
      }
      this.svgPath = svgPath;
      this.clickHandler = clickHandler;
      this.mode = mode;
      this.wavesurfer = wavesurfer;
      this.groupName = groupName;
      this.forceOneActive = forceOneActive;
      this.isActive = false; // Track active state
  
      // Pan-zoom variables (if needed)
      this.isDragging = false;
      this.startX = 0;
      this.startY = 0;
  
      if (groupName) {
        ButtonSingle.registerButtonInGroup(groupName, this, forceOneActive);
        // Add group-specific classes if desired
        if (groupName === "moveGroup") {
          this.button.classList.add("move-group-button");
        } else if (groupName === "loopGroup") {
          this.button.classList.add("loop-group-button");
        }
      }
  
      this.init();
    }
  
    static registerButtonInGroup(groupName, buttonInstance, forceOneActive) {
      if (!ButtonSingle.groups[groupName]) {
        ButtonSingle.groups[groupName] = {
          buttons: [],
          forceOneActive
        };
      }
      ButtonSingle.groups[groupName].buttons.push(buttonInstance);
    }
  
    async init() {
      await this.loadSVG();
  
      // On click, toggle active state and call the optional clickHandler
      this.button.addEventListener("click", () => {
        this.toggleActive();
        if (this.clickHandler) this.clickHandler();
      });
  
      if (this.mode === "pan-zoom" && this.wavesurfer) {
        this.setupPanZoom();
      }
    }
  
    async loadSVG() {
      try {
        const response = await fetch(this.svgPath);
        if (!response.ok) throw new Error(`Failed to load SVG: ${this.svgPath}`);
        const svgContent = await response.text();
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgContent, "image/svg+xml");
        const svgElement = svgDoc.documentElement;
        if (svgElement && svgElement.tagName.toLowerCase() === "svg") {
          // Use currentColor for fill so it can be styled via CSS.
          svgElement.setAttribute("fill", "currentColor");
          svgElement.setAttribute("role", "img");
          svgElement.classList.add("icon-svg");
          this.button.innerHTML = "";
          this.button.appendChild(svgElement);
        } else {
          console.error(`Invalid SVG content from: ${this.svgPath}`);
        }
      } catch (err) {
        console.error(`Error loading SVG from ${this.svgPath}:`, err);
      }
    }
  
    toggleActive() {
      const groupInfo = ButtonSingle.groups[this.groupName];
      if (!groupInfo) {
        this.setActiveState(!this.isActive);
        return;
      }
      const { buttons, forceOneActive } = groupInfo;
      const newState = !this.isActive;
      if (newState) {
        buttons.forEach(btn => {
          if (btn !== this) btn.setActiveState(false);
        });
        this.setActiveState(true);
      } else {
        if (forceOneActive) {
          const activeButtons = buttons.filter(b => b.isActive);
          if (activeButtons.length === 1 && activeButtons[0] === this) {
            return;
          }
        }
        this.setActiveState(false);
      }
    }
  
    setActiveState(isActive) {
      this.isActive = isActive;
      if (this.isActive) {
        this.button.classList.add("active");
      } else {
        this.button.classList.remove("active");
      }
    }
  
  }