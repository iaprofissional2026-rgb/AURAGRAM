import { sounds } from './audioSynth';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  icon?: string;
  avatar?: string;
  type?: 'message' | 'call' | 'like' | 'comment' | 'follow' | 'system';
  data?: any;
  onClick?: () => void;
}

type NotificationListener = (notification: AppNotification) => void;

class NotificationManager {
  private listeners: Set<NotificationListener> = new Set();
  private hasRequestedPermission = false;

  // Request native browser notification permission
  async requestPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }

    try {
      this.hasRequestedPermission = true;
      const perm = await Notification.requestPermission();
      return perm;
    } catch {
      return 'default';
    }
  }

  // Get current permission state
  getPermission(): NotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }

  // Subscribe to in-app notification toasts
  subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Trigger both native system notification + in-app audio chime + in-app toast
  trigger(notification: AppNotification) {
    // 1. Play sound effect
    try {
      sounds.playNotificationChime();
    } catch {}

    // 2. Mobile haptic vibration if supported
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([120, 80, 150]);
      } catch {}
    }

    // 3. Dispatch native browser notification if granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const nativeNotif = new Notification(notification.title, {
          body: notification.body,
          icon: notification.icon || notification.avatar || '/favicon.ico',
          badge: '/favicon.ico',
          silent: true, // We already play our custom synthesized crystal chime
          tag: notification.id,
        });

        nativeNotif.onclick = () => {
          window.focus();
          notification.onClick?.();
          nativeNotif.close();
        };
      } catch (err) {
        console.warn('Native notification dispatch error', err);
      }
    }

    // 4. Notify all in-app subscriber UI components
    this.listeners.forEach((listener) => {
      try {
        listener(notification);
      } catch (err) {
        console.warn('In-app notification listener error', err);
      }
    });
  }
}

export const notificationManager = new NotificationManager();
