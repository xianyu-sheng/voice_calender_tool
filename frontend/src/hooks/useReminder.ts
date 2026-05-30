import { useState, useEffect, useCallback, useRef } from 'react';

interface ReminderEvent {
  id: number;
  title: string;
  start_time: string;
  reminder_minutes?: number;
}

interface ReminderHook {
  requestPermission: () => Promise<boolean>;
  hasPermission: boolean;
  scheduleReminder: (event: ReminderEvent) => void;
  cancelReminder: (eventId: number) => void;
  activeReminders: number[];
}

export function useReminder(): ReminderHook {
  const [hasPermission, setHasPermission] = useState(false);
  const [activeReminders, setActiveReminders] = useState<number[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if ('Notification' in window) {
      setHasPermission(Notification.permission === 'granted');
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn('Browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      setHasPermission(true);
      return true;
    }

    if (Notification.permission === 'denied') {
      console.warn('Notification permission denied');
      return false;
    }

    const permission = await Notification.requestPermission();
    const granted = permission === 'granted';
    setHasPermission(granted);
    return granted;
  }, []);

  const showNotification = useCallback((title: string, body: string) => {
    if (!hasPermission) return;

    const notification = new Notification(title, {
      body,
      icon: '/calendar-icon.png',
      badge: '/calendar-icon.png',
      tag: 'voice-calendar-reminder',
      requireInteraction: true
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    setTimeout(() => notification.close(), 30000);
  }, [hasPermission]);

  const scheduleReminder = useCallback((event: ReminderEvent) => {
    const reminderMinutes = event.reminder_minutes || 15;
    const eventTime = new Date(event.start_time).getTime();
    const reminderTime = eventTime - reminderMinutes * 60 * 1000;
    const now = Date.now();

    if (reminderTime <= now) {
      return;
    }

    if (timersRef.current.has(event.id)) {
      clearTimeout(timersRef.current.get(event.id)!);
    }

    const delay = reminderTime - now;
    const timer = setTimeout(() => {
      showNotification(
        '事件提醒',
        `${event.title} 将在 ${reminderMinutes} 分钟后开始`
      );
      timersRef.current.delete(event.id);
      setActiveReminders(prev => prev.filter(id => id !== event.id));
    }, delay);

    timersRef.current.set(event.id, timer);
    setActiveReminders(prev => [...prev, event.id]);
  }, [showNotification]);

  const cancelReminder = useCallback((eventId: number) => {
    if (timersRef.current.has(eventId)) {
      clearTimeout(timersRef.current.get(eventId)!);
      timersRef.current.delete(eventId);
      setActiveReminders(prev => prev.filter(id => id !== eventId));
    }
  }, []);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  return {
    requestPermission,
    hasPermission,
    scheduleReminder,
    cancelReminder,
    activeReminders
  };
}
