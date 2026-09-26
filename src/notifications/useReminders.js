import { useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import * as adapter from './adapter';
import { createSyncer } from './scheduler';
import { plannedNotifications } from '../domain/reminders';
import { useTodoStore } from '../store/useTodoStore';

const RESYNC_INTERVAL = 60 * 60 * 1000;
let resync = () => {};

// Kök düzende bir kez çalışır: görevler/ayarlar değiştikçe, uygulama öne
// geldikçe ve saatte bir bildirimleri planla eşitler.
export function useReminders() {
  useEffect(() => {
    const cleanupAdapter = adapter.init({ onOpenTask: id => router.push(`/task/${id}`) });
    const sync = createSyncer(adapter);
    const run = () => {
      const { tasks, settings } = useTodoStore.getState();
      return sync(plannedNotifications(tasks, settings, new Date()));
    };
    resync = run;
    run();

    let debounce;
    const unsubscribe = useTodoStore.subscribe((state, prev) => {
      if (state.tasks === prev.tasks && state.settings === prev.settings) return;
      clearTimeout(debounce);
      debounce = setTimeout(run, 300);
    });
    const interval = setInterval(run, RESYNC_INTERVAL);
    const appState = AppState.addEventListener('change', s => s === 'active' && run());

    return () => {
      cleanupAdapter();
      unsubscribe();
      clearTimeout(debounce);
      clearInterval(interval);
      appState.remove();
      resync = () => {};
    };
  }, []);
}

// Bildirim izni durumu: 'granted' | 'denied' | 'undetermined' | 'unsupported'
export function useNotificationPermission() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let active = true;
    adapter.getPermission().then(s => active && setStatus(s));
    return () => {
      active = false;
    };
  }, []);

  const request = useCallback(async () => {
    const next = await adapter.requestPermission();
    setStatus(next);
    resync();
    return next;
  }, []);

  return [status, request];
}
