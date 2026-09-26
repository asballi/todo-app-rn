import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { syncConfig } from './config';
import { createSupabaseRemote } from './remote.supabase';
import { createSyncService } from './service';

// Uygulama genelinde tek senkron servisi. Yapılandırma yoksa null.
let service = null;

export function getSyncService() {
  if (!syncConfig.enabled) return null;
  if (!service) {
    service = createSyncService({
      remote: createSupabaseRemote({ url: syncConfig.supabaseUrl, key: syncConfig.supabaseKey }),
    });
  }
  return service;
}

const NOT_CONFIGURED = { configured: false, ready: true };
const noopSubscribe = () => () => {};

// Arayüz için servis durumu (bkz. service.js); yapılandırma yoksa { configured: false }.
export function useSyncState() {
  const svc = getSyncService();
  const state = useSyncExternalStore(
    svc ? svc.subscribe : noopSubscribe,
    svc ? svc.getState : () => NOT_CONFIGURED,
  );
  return svc ? { configured: true, ...state } : NOT_CONFIGURED;
}

// Kök düzende, veriler yüklendikten sonra bir kez: servisi başlatır ve uygulamanın
// öne / arka plana geçişini bildirir.
export function useSyncManager() {
  useEffect(() => {
    const svc = getSyncService();
    if (!svc) return undefined;
    svc.init().catch(e => console.warn('Senkron başlatılamadı', e));
    const subscription = AppState.addEventListener('change', s => svc.setForeground(s === 'active'));
    return () => subscription.remove();
  }, []);
}
