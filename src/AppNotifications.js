/**
 * @file AppNotifications.js
 * @description Manages application notifications, including toast messages and modals.
 * @version 2.0.0
 */

export class AppNotifications {
    /**
     * Creates an instance of AppNotifications.
     * Initializes the notification container in the DOM.
     */
    constructor() {
        // Retrieve the notification container element by its ID
        this.notificationContainer = document.getElementById('notification-container');
        
        // If the container doesn't exist, create and append it to the body
        if (!this.notificationContainer) {
            this.notificationContainer = document.createElement('div');
            this.notificationContainer.id = 'notification-container';
            document.body.appendChild(this.notificationContainer);
            console.log('AppNotifications: Notification container added to DOM.');
        } else {
            console.log('AppNotifications: Notification container already exists in DOM.');
        }
    }

    /**
     * Displays a toast notification.
     * @param {string} message - The message to display in the toast.
     * @param {string} [type='info'] - The type of notification ('info', 'success', 'warning', 'error').
     * @param {number} [duration=3000] - Duration in milliseconds before the toast disappears.
     */
    showToast(message, type = 'info', duration = 3000) {
        // Create the toast element
        const toast = document.createElement('div');
        toast.className = `notification-toast notification-toast-${type}`;
        toast.textContent = message;
    
        // Append the toast to the notification container
        this.notificationContainer.appendChild(toast);
    
        // Set a timeout to remove the toast after the specified duration
        setTimeout(() => {
            if (toast.parentNode === this.notificationContainer) {
                toast.classList.add('fade-out');
                setTimeout(() => {
                    if (toast.parentNode === this.notificationContainer) {
                        this.notificationContainer.removeChild(toast);
                        console.log(`AppNotifications: Toast of type '${type}' removed after duration.`);
                    }
                }, 300); // Match the fade-out animation duration
            }
        }, duration);
    }

    /**
     * Displays a universal modal using Bootstrap and returns a promise that resolves when the modal is closed.
     * @param {string} title - The title of the modal.
     * @param {string|HTMLElement} content - The content of the modal.
     * @param {string} [buttonText="Close"] - The text for the primary button.
     * @returns {Promise<void>} - Resolves when the modal is closed.
     */
    showUniversalModal(title, content, buttonText = "Close") {
        return new Promise((resolve) => {
            const modalElement = document.getElementById('universalModal');
            if (!modalElement) {
                console.error('AppNotifications: Universal Modal element not found.');
                resolve();
                return;
            }
    
            // Update modal title
            const modalTitle = modalElement.querySelector('.modal-title');
            modalTitle.textContent = title;
    
            // Update modal body
            const modalBody = modalElement.querySelector('.modal-body .modal-content-wrapper');
            modalBody.innerHTML = ''; // Clear any existing content
            if (typeof content === 'string') {
                modalBody.innerHTML = content; // Add string content as HTML
            } else if (content instanceof HTMLElement) {
                modalBody.appendChild(content); // Append HTMLElement content
            }
    
            // Update footer button text
            const modalFooterButton = modalElement.querySelector('.modal-footer button');
            modalFooterButton.textContent = buttonText;
    
            // Add button click event handler
            const buttonHandler = () => {
                modalFooterButton.removeEventListener('click', buttonHandler);
                const modalInstance = bootstrap.Modal.getInstance(modalElement);
                if (modalInstance) {
                    modalInstance.hide(); // Close the modal
                }
                resolve();
            };
            modalFooterButton.addEventListener('click', buttonHandler);
    
            // Initialize and show the modal
            const modalInstance = new bootstrap.Modal(modalElement, {
                backdrop: true, // Allow clicking outside to close
                keyboard: true  // Allow ESC key to close
            });
            modalInstance.show();
    
            // Cleanup after modal is hidden
            const hiddenHandler = () => {
                modalElement.removeEventListener('hidden.bs.modal', hiddenHandler);
                // Remove lingering backdrops if any
                document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
                    backdrop.remove();
                });
                document.body.classList.remove('modal-open');
                document.body.style.overflow = ''; // Restore body scroll behavior
                resolve();
            };
            modalElement.addEventListener('hidden.bs.modal', hiddenHandler, { once: true });
    
            console.log(`AppNotifications: Universal modal '${title}' displayed.`);
        });
    }
    closeModal() {
        const modalElement = document.getElementById('universalModal');
        if (modalElement) {
            // Retrieve the Bootstrap modal instance
            const modalInstance = bootstrap.Modal.getInstance(modalElement);
            if (modalInstance) {
                modalInstance.hide(); // Hide the modal
                modalElement.addEventListener('hidden.bs.modal', () => {
                    modalInstance.dispose(); // Dispose the modal only after it's fully hidden
                    console.log('Modal instance hidden and disposed.');
    
                    // Clear the modal content to avoid lingering references
                    const modalBody = modalElement.querySelector('.modal-body .modal-content-wrapper');
                    if (modalBody) {
                        modalBody.innerHTML = ''; // Clear the content
                    }
    
                    // Remove lingering backdrops
                    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
                        backdrop.remove();
                    });
    
                    // Reset body scroll behavior
                    document.body.classList.remove('modal-open');
                    document.body.style.overflow = '';
                }, { once: true }); // Attach event handler to fire only once
            } else {
                console.warn('No active modal instance found.');
            }
        } else {
            console.warn('Modal element not found or already closed.');
        }
    }

    /**
     * Displays a Parameter Selection Modal with a list of available parameters.
     * @param {string[]} availableParams - List of available parameters.
     * @returns {Promise<string|null>} - Resolves with the selected parameter or null if canceled.
     */
    showParameterSelectionModal(availableParams) {
        return new Promise((resolve) => {
            // Retrieve the parameter selection modal and its components by their IDs
            const modal = document.getElementById('parameterSelectionModal');
            const parameterList = document.getElementById('parameterList');
            const modalTitle = modal.querySelector('.modal-title');
        
            if (!modal || !parameterList || !modalTitle) {
                console.error('AppNotifications: Parameter Selection Modal structure is incorrect.');
                resolve(null);
                return;
            }
        
            // Clear any existing list items
            parameterList.innerHTML = '';
        
            // Populate the list with available parameters
            availableParams.forEach(param => {
                const listItem = document.createElement('li');
                listItem.classList.add('list-group-item', 'list-group-item-action');
                listItem.textContent = param;

                // Define the click handler for each list item
                listItem.addEventListener('click', () => {
                    modalTitle.textContent = `Mapping MIDI to '${param}'`;
                    const bsModal = bootstrap.Modal.getInstance(modal);
                    if (bsModal) {
                        bsModal.hide();
                    }
                    resolve(param);
                });

                // Append the list item to the parameter list
                parameterList.appendChild(listItem);
            });
        
            // Initialize and show the parameter selection modal using Bootstrap
            const bsModal = new bootstrap.Modal(modal, {
                backdrop: true,
                keyboard: true
            });
            bsModal.show();
        
            // Handle modal dismissal (e.g., clicking outside or pressing ESC)
            modal.addEventListener('hidden.bs.modal', () => {
                resolve(null);
            }, { once: true });
            
            console.log('AppNotifications: Parameter Selection Modal displayed.');
        });
    }
}

// Instantiate and export a single instance of AppNotifications
const notifications = new AppNotifications();
export default notifications;