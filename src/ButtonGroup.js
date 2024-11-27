// src/ButtonGroup.js

export class ButtonGroup {
    /**
     * Constructor for ButtonGroup.
     * @param {string} containerSelector - Selector for the button group container.
     * @param {string} dropdownSelector - Selector for the dropdown menu.
     * @param {string} buttonSelector - Selector for the toggle button.
     * @param {string} menuItemsSelector - Selector for the menu items.
     * @param {string} iconSelector - Selector for the icon within the button.
     * @param {AudioPlayer} audioPlayer - The AudioPlayer instance.
     */
    constructor(containerSelector, dropdownSelector, buttonSelector, menuItemsSelector, iconSelector, audioPlayer) {
        console.log(`Initializing ButtonGroup for selector: "${containerSelector}"`);
        this.audioPlayer = audioPlayer; // Assign audioPlayer

        // Select the container element
        this.container = document.querySelector(containerSelector);
        if (!this.container) {
            console.error(`ButtonGroup Error: No element found for selector "${containerSelector}"`);
            return;
        }

        // Select the dropdown within the container
        this.dropdown = this.container.querySelector(dropdownSelector);
        if (!this.dropdown) {
            console.error(`ButtonGroup Error: No dropdown found within "${containerSelector}" using selector "${dropdownSelector}"`);
            return;
        }

        // Select the button within the container
        this.button = this.container.querySelector(buttonSelector);
        if (!this.button) {
            console.error(`ButtonGroup Error: No button found within "${containerSelector}" using selector "${buttonSelector}"`);
            return;
        }

        // Select all menu items within the dropdown
        this.menuItems = this.dropdown.querySelectorAll(menuItemsSelector);
        if (!this.menuItems || this.menuItems.length === 0) {
            console.error(`ButtonGroup Error: No menu items found within "${dropdownSelector}" using selector "${menuItemsSelector}"`);
            return;
        }

        // Select the icon within the button
        this.icon = this.button.querySelector(iconSelector);
        if (!this.icon) {
            console.error(`ButtonGroup Error: No icon found within button using selector "${iconSelector}"`);
            return;
        }

        this.init();
    }

    /**
     * Initialize the ButtonGroup by loading SVGs and binding events.
     */
    init() {
        console.log(`ButtonGroup Init: Loading dynamic SVGs for "${this.container.getAttribute('data-group')}"`);
        this.loadDynamicSVGs();
        this.bindEvents();
    }

    /**
     * Load dynamic SVGs for the button and menu items.
     */
    loadDynamicSVGs() {
        // Load SVG for the main button (inline SVG with currentColor)
        const src = this.icon.getAttribute('data-src');
        if (src) {
            console.log(`Loading main button SVG from: ${src}`);
            this.fetchAndSetSVG(src, this.icon, true);
        } else {
            console.warn(`No data-src found for main button in "${this.container.getAttribute('data-group')}" group.`);
        }

        // Load SVGs for menu items (retain img tags with fixed color)
        this.menuItems.forEach(item => {
            const iconImg = item.querySelector('img');
            const src = item.getAttribute('data-icon');
            if (src && iconImg) {
                console.log(`Setting dropdown menu item image src to: ${src}`);
                // Ensure the img tag's src is set correctly
                iconImg.src = src;
                iconImg.alt = item.getAttribute('data-value') || 'Menu Item';
                // Apply CSS filters to make the icon black
                iconImg.style.filter = 'brightness(0) saturate(100%)'; // Makes the image black
                iconImg.style.marginRight = '8px';
                iconImg.style.width = '16px';
                iconImg.style.height = '16px';
            } else {
                console.warn(`Missing data-icon or img tag for a dropdown menu item in "${this.container.getAttribute('data-group')}" group.`);
            }
        });
    }

    /**
     * Fetch and set SVG content.
     * @param {string} src - Path to the SVG file.
     * @param {HTMLElement} element - Element to insert the SVG into.
     * @param {boolean} isInline - Whether to inject as inline SVG.
     */
    fetchAndSetSVG(src, element, isInline = true) {
        if (!isInline) {
            // For dropdown menu items, we already set the img src, no need to fetch
            return;
        }

        fetch(src)
            .then(response => {
                if (!response.ok) throw new Error(`Failed to load SVG: ${src}`);
                return response.text();
            })
            .then(svgContent => {
                console.log(`Fetched SVG content from: ${src}`);
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
                const svgElement = svgDoc.documentElement;

                if (svgElement && svgElement.tagName.toLowerCase() === 'svg') {
                    // Set SVG attributes for coloring
                    svgElement.setAttribute('fill', 'currentColor');
                    svgElement.setAttribute('role', 'img');
                    svgElement.classList.add('icon-svg');

                    // Clear existing content and append the SVG
                    element.innerHTML = '';
                    element.appendChild(svgElement);
                    console.log(`Injected inline SVG into main button for "${this.container.getAttribute('data-group')}" group.`);
                } else {
                    console.error(`Invalid SVG content fetched from: ${src}`);
                }
            })
            .catch(error => console.error(`Error loading SVG from ${src}:`, error));
    }

    /**
     * Bind event listeners to menu items and the toggle button.
     */
    bindEvents() {
        // Handle menu item clicks
        this.menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const newIconPath = item.getAttribute('data-icon');
                const newValue = item.getAttribute('data-value');

                console.log(`Dropdown menu item clicked: ${newValue} with icon ${newIconPath}`);

                // Update the main button's icon and label
                if (newIconPath && newValue) {
                    console.log(`Updating main button to: ${newValue} with icon ${newIconPath}`);
                    this.icon.setAttribute('data-src', newIconPath);
                    this.icon.setAttribute('aria-label', newValue);
                    this.fetchAndSetSVG(newIconPath, this.icon, true);
                } else {
                    console.warn(`Missing data-icon or data-value in clicked dropdown item.`);
                }

                // Trigger any additional logic based on selection
                this.onSelectionChange(newValue);
            });
        });

        // Optionally handle dropdown show/hide events
        if (typeof bootstrap !== 'undefined') {
            const dropdownInstance = new bootstrap.Dropdown(this.button);
            this.button.addEventListener('show.bs.dropdown', () => {
                console.log(`Dropdown menu shown for "${this.container.getAttribute('data-group')}" group.`);
                // Actions before dropdown is shown
            });

            this.button.addEventListener('hidden.bs.dropdown', () => {
                console.log(`Dropdown menu hidden for "${this.container.getAttribute('data-group')}" group.`);
                // Actions after dropdown is hidden
            });
        } else {
            console.warn('Bootstrap is not loaded. Dropdown events will not be handled.');
        }
    }

    /**
     * Handle the selection change from the dropdown menu.
     * @param {string} selectedValue - The value of the selected menu item.
     */
    onSelectionChange(selectedValue) {
        console.log(`Button group selection changed to: ${selectedValue}`);
        // Implement additional logic based on selection

        // Example: Handle Transport group actions
        if (this.container.getAttribute('data-group') === 'transport') {
            switch (selectedValue.toLowerCase()) {
                case 'play':
                    this.handlePlay();
                    break;
                case 'pause':
                    this.handlePause();
                    break;
                case 'stop':
                    this.handleStop();
                    break;
                default:
                    console.warn('Unknown transport action.');
            }
        }

        // Example: Handle Interaction group actions
        if (this.container.getAttribute('data-group') === 'interaction') {
            switch (selectedValue.toLowerCase()) {
                case 'jam':
                    this.handleJam();
                    break;
                case 'midi':
                    this.handleMidi();
                    break;
                case 'sensors':
                    this.handleSensors();
                    break;
                case 'cosmic lfo':
                    this.handleCosmicLFO();
                    break;
                default:
                    console.warn('Unknown interaction action.');
            }
        }

        // Similarly, handle other groups if needed
    }

    /**
     * Handle the Play action.
     */
    handlePlay() {
        console.log('Play action triggered.');
        if (this.audioPlayer) {
            this.audioPlayer.play();
        } else {
            console.warn('AudioPlayer instance is not defined.');
        }
    }

    /**
     * Handle the Pause action.
     */
    handlePause() {
        console.log('Pause action triggered.');
        if (this.audioPlayer) {
            this.audioPlayer.pause();
        } else {
            console.warn('AudioPlayer instance is not defined.');
        }
    }

    /**
     * Handle the Stop action.
     */
    handleStop() {
        console.log('Stop action triggered.');
        if (this.audioPlayer) {
            this.audioPlayer.stop();
        } else {
            console.warn('AudioPlayer instance is not defined.');
        }
    }

    /**
     * Handle the Jam action.
     */
    handleJam() {
        console.log('Jam action triggered.');
        // Implement Jam functionality here
    }

    /**
     * Handle the MIDI action.
     */
    handleMidi() {
        console.log('MIDI action triggered.');
        // Implement MIDI functionality here
    }

    /**
     * Handle the Sensors action.
     */
    handleSensors() {
        console.log('Sensors action triggered.');
        // Implement Sensors functionality here
    }

    /**
     * Handle the Cosmic LFO action.
     */
    handleCosmicLFO() {
        console.log('Cosmic LFO action triggered.');
        // Implement Cosmic LFO functionality here
    }
}