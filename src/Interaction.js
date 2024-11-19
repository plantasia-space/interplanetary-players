/**
 * Sets up click handlers for UI buttons.
 * @param {Object} options - Configuration options.
 * @param {Function} options.onPlay - Callback for Play button.
 * @param {Function} options.onPause - Callback for Pause button.
 */
export function setupInteractions({ onPlay, onPause }) {
    // Select UI buttons


    // Menu interactions
    const toggleButton = document.querySelector('.btn-toggle');
    const toggleIcon = document.getElementById('toggleIcon');
    const menuIcons = document.querySelectorAll('.menu-info-icon');
    const infoContainer = document.querySelector('.info-container');
    const menuContent = document.getElementById('menuContent');

    // Toggle the arrow icon on menu collapse/expand
    menuContent.addEventListener('show.bs.collapse', () => {
        toggleIcon.src = '/assets/icons/arrow_up.svg';
        infoContainer.style.display = 'grid'; // Show info container when menu expands
    });

    menuContent.addEventListener('hide.bs.collapse', () => {
        toggleIcon.src = '/assets/icons/arrow_down.svg';
        infoContainer.style.display = 'none'; // Hide info container when menu collapses
    });

    // Toggle active state for menu icons
    menuIcons.forEach((icon) => {
        icon.addEventListener('click', () => {
            // Remove active state from all icons
            menuIcons.forEach((icon) => icon.classList.remove('active'));

            // Add active state to clicked icon
            icon.classList.add('active');

            // Display placeholder info in the grid
            const targetId = icon.dataset.target;
            const targetParagraph = document.getElementById(targetId);
            if (targetParagraph) {
                targetParagraph.style.display = 'block';
            }
        });
    });
}
document.addEventListener('DOMContentLoaded', () => {
    // Interacción del Ícono de Toggle
    const toggleButton = document.querySelector('.btn-toggle');
    const toggleIcon = document.getElementById('toggleIcon');
    const menuContent = document.getElementById('menuContent');
    const infoContainer = document.querySelector('.info-container');

    // Escuchar los eventos de Bootstrap Collapse
    menuContent.addEventListener('shown.bs.collapse', () => {
        toggleIcon.classList.add('expanded');
        infoContainer.style.display = 'block'; // Mostrar el contenedor de información al expandir el menú
    });

    menuContent.addEventListener('hidden.bs.collapse', () => {
        toggleIcon.classList.remove('expanded');
        infoContainer.style.display = 'none'; // Ocultar el contenedor de información al colapsar el menú
    });

    // Interacciones de los Íconos del Menú
    const menuIcons = document.querySelectorAll('.menu-info-icon');
    const infoDivs = document.querySelectorAll('.grid-placeholder > div');

    menuIcons.forEach((icon) => {
        icon.addEventListener('click', () => {
            // Remover la clase 'active' de todos los íconos
            menuIcons.forEach((icon) => icon.classList.remove('active'));
            // Añadir la clase 'active' al ícono clicado
            icon.classList.add('active');
            // Ocultar todos los divs de información
            infoDivs.forEach((div) => div.style.display = 'none');
            // Mostrar el div de información correspondiente
            const targetId = icon.dataset.target;
            const targetInfo = document.getElementById(targetId);
            if (targetInfo) {
                targetInfo.style.display = 'block';
            }
        });
    });
});

document.addEventListener("DOMContentLoaded", () => {
    // Select all elements with a data-src attribute (icons and toggle button)
    const dynamicIcons = document.querySelectorAll('[data-src]');

    dynamicIcons.forEach(icon => {
        const src = icon.getAttribute('data-src'); // Get the SVG file path
        if (src) {
            fetch(src)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to load SVG: ${src}`);
                    }
                    return response.text();
                })
                .then(svgContent => {
                    icon.innerHTML = svgContent; // Insert the SVG content inline
                    // Ensure the SVG inherits currentColor for styling
                    const svgElement = icon.querySelector('svg');
                    if (svgElement) {
                        svgElement.setAttribute('fill', 'currentColor');
                        svgElement.classList.add('icon-svg'); // Optional for additional styling
                    }
                })
                .catch(error => console.error(error));
        }
    });
});