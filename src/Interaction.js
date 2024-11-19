// Interaction.js

import { Constants } from './Constants.js';

// Elimina o comenta esta línea
// const dataManager = new DataManager();
/**
 * Function to load SVGs dynamically.
 */
function loadDynamicSVGs() {
    if (!document.body.dataset.iconsLoaded) {
        const dynamicIcons = document.querySelectorAll('[data-src]');
        dynamicIcons.forEach((icon) => {
            const src = icon.getAttribute('data-src');
            if (src) {
                fetch(src)
                    .then((response) => response.text())
                    .then((svgContent) => {
                        const parser = new DOMParser();
                        const svgDocument = parser.parseFromString(svgContent, 'image/svg+xml');
                        const svgElement = svgDocument.documentElement;

                        if (svgElement && svgElement.tagName.toLowerCase() === 'svg') {
                            svgElement.setAttribute('fill', 'currentColor');
                            svgElement.classList.add('icon-svg');
                            icon.innerHTML = ''; // Clear existing content
                            icon.appendChild(svgElement);
                        }
                    })
                    .catch(console.error);
            }
        });
        document.body.dataset.iconsLoaded = 'true';
    }
}

/**
 * Setup interactions for dynamic placeholder updates.
 */
/**
 * Setup interactions for dynamic placeholder updates.
 */
export function setupInteractions(dataManager) {
    if (typeof bootstrap === 'undefined') {
        console.error('Bootstrap is not loaded. Ensure bootstrap.bundle.min.js is included.');
        return;
    }

    const toggleButton = document.querySelector('.menu-info-toggle');
    const collapseContent = document.getElementById('collapseInfoMenu');

    if (!toggleButton || !collapseContent) {
        console.error('Required elements not found.');
        return;
    }

    const collapseInstance = new bootstrap.Collapse(collapseContent, { toggle: false });

    // Handle toggle button click
    toggleButton.addEventListener('click', () => {
        const isExpanded = toggleButton.getAttribute('aria-expanded') === 'true';

        if (isExpanded) {
            collapseInstance.hide(); // Collapse the menu
            dataManager.clearPlaceholders(); // Clear placeholders when collapsed
        } else {
            collapseInstance.show(); // Expand the menu
        }

        toggleButton.setAttribute('aria-expanded', (!isExpanded).toString());
    });

    // Handle icon clicks
    document.querySelectorAll('.menu-info-icon').forEach((icon) => {
        icon.addEventListener('click', () => {
            const target = icon.dataset.target;
            console.log("target", target);

            if (target) {
                // Ensure the menu is expanded when an icon is clicked
                if (!collapseContent.classList.contains('show')) {
                    collapseInstance.show();
                    toggleButton.setAttribute('aria-expanded', 'true');
                }

                // Validate and populate placeholders dynamically
                if (!Constants.TRACK_DATA) {
                    console.error('[Interactions] TRACK_DATA is not loaded. Ensure fetchAndUpdateConfig is called.');
                    return;
                }

                console.log(`[Interactions] Populating placeholders for target: ${target}`);
                dataManager.populatePlaceholders(target);
            } else {
                console.warn('No data-target attribute found on the clicked icon.');
            }
        });
    });
    if (!Constants.TRACK_DATA) {
        console.error('[Interactions] TRACK_DATA is not loaded. Ensure fetchAndUpdateConfig is called.');
        return;
    }
    // Clear placeholders when menu is hidden
    collapseContent.addEventListener('hidden.bs.collapse', () => {
        dataManager.clearPlaceholders();
        toggleButton.setAttribute('aria-expanded', 'false');
    });

    // Ensure aria-expanded is updated when menu is shown
    collapseContent.addEventListener('shown.bs.collapse', () => {
        toggleButton.setAttribute('aria-expanded', 'true');
    });
}
// Initialize SVG loading and interactions
loadDynamicSVGs();
