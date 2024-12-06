// src/AppNotifications.js

export class AppNotifications {
    constructor() {
        console.log('AppNotifications: Initializing notifications system.');
        this.notificationContainer = document.getElementById('notification-container');
        if (!this.notificationContainer) {
            this.notificationContainer = document.createElement('div');
            this.notificationContainer.id = 'notification-container';
            document.body.appendChild(this.notificationContainer);
            console.log('AppNotifications: Notification container added to DOM.');
        } else {
            console.log('AppNotifications: Notification container already exists in DOM.');
        }
    }

    showToast(message, type = 'info', duration = 3000) {
        console.log(`AppNotifications: Showing toast with message "${message}", type "${type}", duration "${duration}"`);
    
        const toast = document.createElement('div');
        toast.className = `notification-toast notification-toast-${type}`;
        toast.textContent = message;
    
        this.notificationContainer.appendChild(toast);
    
        setTimeout(() => {
            console.log(`AppNotifications: Removing toast with message "${message}"`);
            if (toast.parentNode === this.notificationContainer) {
                toast.classList.add('fade-out');
                setTimeout(() => {
                    if (toast.parentNode === this.notificationContainer) {
                        this.notificationContainer.removeChild(toast);
                    }
                }, 300); // Match the fade-out animation duration
            }
        }, duration);
    }
}

const notifications = new AppNotifications();
export default notifications;