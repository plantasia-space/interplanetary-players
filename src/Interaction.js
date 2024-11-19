// src/Interaction.js

// Función para cargar SVGs dinámicamente
// src/Interaction.js

// Function to load SVGs dynamically
function loadDynamicSVGs() {
    if (!document.body.dataset.iconsLoaded) {
        console.log('Loading dynamic SVGs...');
        const dynamicIcons = document.querySelectorAll('[data-src]');
        dynamicIcons.forEach((icon) => {
            const src = icon.getAttribute('data-src');
            if (src) {
                fetch(src)
                    .then((response) => {
                        if (!response.ok) {
                            throw new Error(`Error loading SVG: ${src}`);
                        }
                        return response.text();
                    })
                    .then((svgContent) => {
                        // Parse the SVG content
                        const parser = new DOMParser();
                        const svgDocument = parser.parseFromString(svgContent, 'image/svg+xml');
                        const svgElement = svgDocument.documentElement;

                        if (svgElement && svgElement.tagName.toLowerCase() === 'svg') {
                            // Set desired attributes
                            svgElement.setAttribute('fill', 'currentColor');
                            svgElement.classList.add('icon-svg');

                            // Remove existing child nodes
                            while (icon.firstChild) {
                                icon.removeChild(icon.firstChild);
                            }

                            // Append the SVG element
                            icon.appendChild(svgElement);
                        } else {
                            console.error(`Invalid SVG content in ${src}`);
                        }
                    })
                    .catch((error) => console.error(error));
            }
        });

        // Mark that the icons have been loaded
        document.body.dataset.iconsLoaded = 'true';
    } else {
        console.log('SVGs have already been loaded.');
    }
}

// Execute the function immediately
loadDynamicSVGs();


// Función para configurar interacciones
export function setupInteractions() {
    // Verificar integración de Bootstrap
    if (typeof bootstrap === 'undefined') {
        console.error('Bootstrap no está cargado. Asegúrate de incluir bootstrap.bundle.min.js.');
        return;
    }

    // Seleccionar elementos
    const toggleButton = document.querySelector('.menu-info-toggle');
    const collapseContent = document.getElementById('collapseInfoMenu');

    if (!toggleButton || !collapseContent) {
        console.error('No se encontró el botón de toggle o el contenido colapsable.');
        return;
    }

    // Verificar si los event listeners ya están agregados
    if (!toggleButton.dataset.listenerAdded) {
        // No es necesario inicializar manualmente el colapso si usas data-bs-toggle
        // Pero si lo haces, asegúrate de no duplicar la instancia
        const collapseInstance = new bootstrap.Collapse(collapseContent, {
            toggle: false,
        });

        // Agregar evento al botón
        toggleButton.addEventListener('click', () => {
            collapseInstance.toggle();
            const isExpanded = toggleButton.getAttribute('aria-expanded') === 'true';
            toggleButton.setAttribute('aria-expanded', (!isExpanded).toString());
        });

        // Marcar que el listener ha sido agregado
        toggleButton.dataset.listenerAdded = 'true';
    }
}