import { useReminderBanner } from './bannerStore';

// Web: sunucu olmadan sekme kapalıyken bildirim gönderilemez. Sekme açıkken
// zamanlayıcı kurulur; zamanı gelince sekme görünürse uygulama içi şerit,
// arka plandaysa (izin varsa) tarayıcı bildirimi gösterilir.

// setTimeout en fazla ~24,8 gün bekleyebilir; daha uzak olanlar sonraki
// eşitlemelerde (saatlik) kurulur.
const MAX_DELAY = 2 ** 31 - 1;
const timers = new Map(); // key → timeout
let openTask = () => {};

const supported = () => typeof window !== 'undefined' && 'Notification' in window;

export function init({ onOpenTask }) {
  openTask = onOpenTask;
  return () => {
    openTask = () => {};
  };
}

function fire(item) {
  timers.delete(item.key);
  const hidden = document.visibilityState !== 'visible';
  if (hidden && supported() && Notification.permission === 'granted') {
    const notification = new Notification(item.title, { body: item.body, tag: item.key });
    notification.onclick = () => {
      window.focus();
      openTask(item.taskId);
      notification.close();
    };
  } else {
    useReminderBanner.getState().push(item);
  }
}

const toStatus = permission => (permission === 'default' ? 'undetermined' : permission);

export async function getPermission() {
  return supported() ? toStatus(Notification.permission) : 'unsupported';
}

export async function requestPermission() {
  if (!supported()) return 'unsupported';
  return toStatus(await Notification.requestPermission());
}

// İzin olmasa da zamanlayıcı kurulur: uyarı uygulama içi şerit olarak görünür.
export async function canSchedule() {
  return true;
}

export async function listScheduled() {
  return [...timers.keys()].map(key => ({ id: key, key }));
}

export async function schedule(item) {
  const delay = item.at.getTime() - Date.now();
  if (delay > MAX_DELAY) return null;
  timers.set(item.key, setTimeout(() => fire(item), Math.max(0, delay)));
  return item.key;
}

export async function cancel(id) {
  clearTimeout(timers.get(id));
  timers.delete(id);
}
