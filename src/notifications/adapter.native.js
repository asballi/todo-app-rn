import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Mobil: işletim sisteminin yerel bildirimleri. Uygulama kapalıyken de çalışır.
// Her bildirimin data.key alanı plandaki anahtardır; eşitleme bununla yapılır.

const CHANNEL_ID = 'reminders';

export function init({ onOpenTask }) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Hatırlatıcılar',
      importance: Notifications.AndroidImportance.HIGH,
    }).catch(e => console.warn('Bildirim kanalı oluşturulamadı', e));
  }

  const open = response => {
    const taskId = response?.notification.request.content.data?.taskId;
    if (taskId) onOpenTask(taskId);
  };
  // Uygulama bildirime dokunularak açıldıysa (soğuk başlangıç).
  Notifications.getLastNotificationResponseAsync()
    .then(response => {
      if (!response) return;
      open(response);
      return Notifications.clearLastNotificationResponseAsync();
    })
    .catch(() => {});
  const subscription = Notifications.addNotificationResponseReceivedListener(open);
  return () => subscription.remove();
}

const toStatus = ({ granted, canAskAgain }) => (granted ? 'granted' : canAskAgain ? 'undetermined' : 'denied');

export async function getPermission() {
  return toStatus(await Notifications.getPermissionsAsync());
}

export async function requestPermission() {
  return toStatus(await Notifications.requestPermissionsAsync());
}

export async function canSchedule() {
  return (await getPermission()) === 'granted';
}

export async function listScheduled() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.map(n => ({ id: n.identifier, key: n.content.data?.key }));
}

export function schedule({ key, taskId, at, title, body }) {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, data: { key, taskId } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL_ID },
  });
}

export function cancel(id) {
  return Notifications.cancelScheduledNotificationAsync(id);
}
