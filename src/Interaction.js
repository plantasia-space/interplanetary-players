export function setupInteractions() {
    // Verify Bootstrap integration
    if (typeof bootstrap === 'undefined') {
        console.error('Bootstrap is not loaded. Please ensure bootstrap.bundle.min.js is included.');
        return;
    }

    // Collapse toggle button and content
    const toggleButton = document.querySelector('.menu-info-toggle');
    const collapseContent = document.getElementById('collapseInfoMenu');
    const toggleIcon = document.getElementById('toggleIcon'); // Icon inside the button

    if (!toggleButton || !collapseContent) {
        console.error('Toggle button or collapsible content not found.');
        return;
    }

    // Initialize Bootstrap Collapse instance
    const collapseInstance = new bootstrap.Collapse(collapseContent, {
        toggle: false,
    });

    // Update aria-expanded attribute on button click
    toggleButton.addEventListener('click', () => {
        collapseInstance.toggle();
        const isExpanded = toggleButton.getAttribute('aria-expanded') === 'true';
        toggleButton.setAttribute('aria-expanded', (!isExpanded).toString());
    });

    // Update the toggle icon based on collapse events
    collapseContent.addEventListener('show.bs.collapse', () => {
        console.log('Collapse is expanding.');
        if (toggleIcon) {
            toggleIcon.src = '/assets/icons/arrow_up.svg'; // Change to "up" icon
        }
    });

    collapseContent.addEventListener('hide.bs.collapse', () => {
        console.log('Collapse is collapsing.');
        if (toggleIcon) {
            toggleIcon.src = '/assets/icons/arrow_down.svg'; // Change to "down" icon
        }
    });

    // Load dynamic SVG icons
    const dynamicIcons = document.querySelectorAll('[data-src]');
    dynamicIcons.forEach((icon) => {
        const src = icon.getAttribute('data-src');
        if (src) {
            fetch(src)
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`Failed to load SVG: ${src}`);
                    }
                    return response.text();
                })
                .then((svgContent) => {
                    icon.innerHTML = svgContent; // Inline SVG content
                    const svgElement = icon.querySelector('svg');
                    if (svgElement) {
                        svgElement.setAttribute('fill', 'currentColor'); // Dynamic coloring
                        svgElement.classList.add('icon-svg'); // Optional for styling
                    }
                })
                .catch((error) => console.error(error));
        }
    });
}