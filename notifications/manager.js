// notifications/manager.js - Push Notification Manager for Aurora Agent

export class NotificationManager {
    constructor() {
        this.permissionGranted = false;
        this.pendingNotifications = [];
        // DO NOT request permission in constructor - wait for user gesture
    }

    async requestPermission() {
        // This MUST be called from a user gesture (button click)
        if (!('Notification' in window)) {
            console.warn('Notifications not supported');
            return false;
        }
        
        const permission = await Notification.requestPermission();
        this.permissionGranted = permission === 'granted';
        
        if (this.permissionGranted) {
            this.processPending();
        }
        
        return this.permissionGranted;
    }

    sendNotification(title, body, options = {}) {
        if (!this.permissionGranted) {
            this.pendingNotifications.push({ title, body, options, timestamp: Date.now() });
            return false;
        }

        try {
            // Use relative paths for PWA compatibility
            const notification = new Notification(title, {
                body: body,
                icon: './icons/icon-192x192.png',
                badge: './icons/icon-96x96.png',
                vibrate: [200, 100, 200],
                silent: false,
                requireInteraction: options.requireInteraction || false,
                ...options
            });

            notification.onclick = (event) => {
                event.preventDefault();
                window.focus();
                notification.close();
                if (options.onClick) options.onClick();
            };

            return true;
        } catch (e) {
            console.error('Failed to send notification:', e);
            return false;
        }
    }

    processPending() {
        while (this.pendingNotifications.length > 0) {
            const notif = this.pendingNotifications.shift();
            this.sendNotification(notif.title, notif.body, notif.options);
        }
    }

    sendAuroraAlert(agentResult, location, onNotificationSent = null) {
        if (!agentResult.shouldNotify) return false;

        let title = '';
        let body = agentResult.summary;

        switch (agentResult.alertLevel) {
            case 'extreme':
                title = '🚨 EXTREME AURORA ALERT!';
                body = `Kp=${agentResult.kp.toFixed(1)}! ${agentResult.summary.substring(0, 80)}`;
                break;
            case 'storm':
                title = '🌌 AURORA STORM ACTIVE!';
                break;
            case 'active':
                title = '✨ Aurora Activity Rising';
                break;
            default:
                title = '📊 Aurora Update';
        }

        if (location && location !== 'default') {
            body = `${location.toUpperCase()}: ${body}`;
        }

        const result = this.sendNotification(title, body, {
            requireInteraction: agentResult.alertLevel === 'extreme',
            onClick: () => {
                const dashboard = document.querySelector('.dashboard');
                if (dashboard) dashboard.scrollIntoView({ behavior: 'smooth' });
            }
        });
        
        if (result && onNotificationSent) {
            onNotificationSent();
        }
        
        return result;
    }
    
    getPermissionStatus() {
        if (!('Notification' in window)) return 'unsupported';
        return Notification.permission;
    }
}