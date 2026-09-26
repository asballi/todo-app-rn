import { Alert, Platform } from 'react-native';
import { strings } from '../strings';

// Alert.alert web'de hiçbir şey göstermez; web'de window.confirm kullanılır.
export function confirm({ title, message, confirmText = strings.common.ok, destructive = false }) {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
  }
  return new Promise(resolve => {
    Alert.alert(title, message, [
      { text: strings.common.cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

export function showError(e) {
  const message = e?.message ?? String(e);
  if (Platform.OS === 'web') window.alert(message);
  else Alert.alert(strings.common.error, message);
}
