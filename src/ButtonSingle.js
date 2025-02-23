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

        // Pan-zoom variables
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;

        // Register in the static group map
        if (groupName) {
            ButtonSingle.registerButtonInGroup(groupName, this, forceOneActive);
            // Inject a group-specific class for styling
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

        // On click, toggle active state and call optional clickHandler
        this.button.addEventListener("click", () => {
            this.toggleActive();
            if (this.clickHandler) this.clickHandler();
        });

        if (this.mode === "pan-zoom" && this.wavesurfer) {
            this.setupPanZoom();
        }
    }

    // Revised loadSVG method: fetches the SVG, inlines it,
    // and applies classes/styles so it looks like the reference.
    async loadSVG() {
        try {
            const response = await fetch(this.svgPath);
            if (!response.ok) throw new Error(`Failed to load SVG: ${this.svgPath}`);

            const svgContent = await response.text();
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgContent, "image/svg+xml");
            const svgElement = svgDoc.documentElement;

            if (svgElement && svgElement.tagName.toLowerCase() === "svg") {
                // Ensure the SVG uses currentColor for fill so it can be styled via CSS.
                svgElement.setAttribute("fill", "currentColor");
                svgElement.setAttribute("role", "img");
                svgElement.classList.add("icon-svg");

                // Clear any existing content and inject the inline SVG.
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

    // ---------------- PAN-ZOOM LOGIC ----------------
    setupPanZoom() {
        const waveformEl = document.querySelector("#waveform");
        if (!waveformEl) {
            console.error("Pan-Zoom Mode: #waveform container not found.");
            return;
        }
        waveformEl.addEventListener("mousedown", this.startPanZoom.bind(this));
        waveformEl.addEventListener("mousemove", this.panZoom.bind(this));
        waveformEl.addEventListener("mouseup", this.endPanZoom.bind(this));
        waveformEl.addEventListener("touchstart", this.startPanZoom.bind(this));
        waveformEl.addEventListener("touchmove", this.panZoom.bind(this));
        waveformEl.addEventListener("touchend", this.endPanZoom.bind(this));
    }

    startPanZoom(ev) {
        if (!this.isActive) return;
        ev.preventDefault();
        this.isDragging = true;
        const { clientX, clientY } = ev.touches ? ev.touches[0] : ev;
        this.startX = clientX;
        this.startY = clientY;
    }

    panZoom(ev) {
        if (!this.isDragging || !this.isActive || !this.wavesurfer) return;
        const { clientX, clientY } = ev.touches ? ev.touches[0] : ev;
        const deltaX = clientX - this.startX;
        const deltaY = clientY - this.startY;
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            const newScroll = this.wavesurfer.getScroll() - deltaX * 0.5;
            this.wavesurfer.scroll(newScroll);
        } else {
            const newZoom = Math.max(10, this.wavesurfer.getZoom() - deltaY * 0.1);
            this.wavesurfer.zoom(newZoom);
        }
        this.startX = clientX;
        this.startY = clientY;
    }

    endPanZoom(ev) {
        ev.preventDefault();
        this.isDragging = false;
    }
}