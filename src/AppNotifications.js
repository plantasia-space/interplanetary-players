// src/AppNotifications.js

/**
 * @file AppNotifications.js
 * @description Manages application notifications, including toast messages and modals.
 * @version 1.0.1
 * @author 
 * @license MIT
 * @date 2024-12-07
 */

export class AppNotifications {
    /**
     * Creates an instance of AppNotifications.
     * Initializes the notification container in the DOM.
     */
    constructor() {
        // Retrieve the notification container element
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
        const toast = document.createElement('div');
        toast.className = `notification-toast notification-toast-${type}`;
        toast.textContent = message;
    
        this.notificationContainer.appendChild(toast);
    
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
     * @param {string} [buttonText="Okay"] - The text for the primary button.
     * @returns {Promise<void>} - Resolves when the modal is closed.
     */
    showUniversalModal(title, content, buttonText = "Okay") {
        return new Promise((resolve) => {
            const modal = document.getElementById('universalModal');
            if (!modal) {
                console.error('AppNotifications: Universal Modal element not found.');
                resolve();
                return;
            }
        
            // Update modal content
            const modalTitle = modal.querySelector('.modal-title');
            const modalBody = modal.querySelector('.modal-body');
            const modalFooterButton = modal.querySelector('.modal-footer button');
        
            if (!modalTitle || !modalBody || !modalFooterButton) {
                console.error('AppNotifications: Universal Modal structure is incorrect.');
                resolve();
                return;
            }
        
            modalTitle.textContent = title;
            modalBody.innerHTML = ''; // Clear previous content
            if (typeof content === 'string') {
                modalBody.textContent = content;
            } else if (content instanceof HTMLElement) {
                modalBody.appendChild(content);
            }
        
            modalFooterButton.textContent = buttonText;
        
            // Handle button click
            const buttonHandler = () => {
                modalFooterButton.removeEventListener('click', buttonHandler);
                const bsModal = bootstrap.Modal.getInstance(modal);
                bsModal.hide();
                resolve();
            };
        
            modalFooterButton.addEventListener('click', buttonHandler);
        
            // Show the modal using Bootstrap
            const bootstrapModal = new bootstrap.Modal(modal);
            bootstrapModal.show();
            
            console.log(`AppNotifications: Universal modal '${title}' displayed.`);
        });
    }

    /**
     * Displays a Parameter Selection Modal with a list of available parameters.
     * @param {string[]} availableParams - List of available parameters.
     * @returns {Promise<string|null>} - Resolves with the selected parameter or null if canceled.
     */
    showParameterSelectionModal(availableParams) {
        return new Promise((resolve) => {
            const modal = document.getElementById('parameterSelectionModal');
            const parameterList = document.getElementById('parameterList');
            const modalTitle = modal.querySelector('.modal-title');
        
            if (!modal || !parameterList || !modalTitle) {
                console.error('AppNotifications: Parameter Selection Modal structure is incorrect.');
                resolve(null);
                return;
            }
        
            // Clear previous list
            parameterList.innerHTML = '';
        
            // Populate the list with available parameters
            availableParams.forEach(param => {
                const listItem = document.createElement('li');
                listItem.classList.add('list-group-item', 'list-group-item-action');
                listItem.textContent = param;
                listItem.addEventListener('click', () => {
                    modalTitle.textContent = `Mapping MIDI to '${param}'`;
                    const bsModal = bootstrap.Modal.getInstance(modal);
                    bsModal.hide();
                    resolve(param);
                });
                parameterList.appendChild(listItem);
            });
        
            // Handle modal dismissal
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
        
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