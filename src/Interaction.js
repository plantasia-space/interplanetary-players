// src/Interaction.js

function loadDynamicSVGs() {
    if (!document.body.dataset.iconsLoaded) {
        console.log('Loading dynamic SVGs...');
        const baseUrl = import.meta.env.BASE_URL; // Obtener la URL base
        const dynamicIcons = document.querySelectorAll('[data-src]');
        dynamicIcons.forEach((icon) => {
            let src = icon.getAttribute('data-src');
            if (src) {
                // Asegurar que la ruta sea relativa a la base
                if (!src.startsWith('http')) {
                    src = baseUrl + src.replace(/^\//, ''); // Elimina la barra inicial si existe
                }
                fetch(src)
                    .then((response) => {
                        if (!response.ok) {
                            throw new Error(`Error loading SVG: ${src}`);
                        }
                        return response.text();
                    })
                    .then((svgContent) => {
                        // Procesar el SVG como antes
                        const parser = new DOMParser();
                        const svgDocument = parser.parseFromString(svgContent, 'image/svg+xml');
                        const svgElement = svgDocument.documentElement;

                        if (svgElement && svgElement.tagName.toLowerCase() === 'svg') {
                            svgElement.setAttribute('fill', 'currentColor');
                            svgElement.classList.add('icon-svg');

                            // Eliminar nodos hijos existentes
                            while (icon.firstChild) {
                                icon.removeChild(icon.firstChild);
                            }

                            icon.appendChild(svgElement);
                        } else {
                            console.error(`Invalid SVG content in ${src}`);
                        }
                    })
                    .catch((error) => console.error(error));
            }
        });

        // Marcar que los iconos han sido cargados
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