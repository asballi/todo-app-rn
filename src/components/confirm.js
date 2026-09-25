import { Alert, Platform } from 'react-native';

// Alert.alert web'de hiçbir şey göstermez; web'de window.confirm kullanılır.
export function confirm({ title, message, confirmText = 'Tamam', destructive = false }) {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
  }
  return new Promise(resolve => {
    Alert.alert(title, message, [
      { text: 'Vazgeç', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

export function showError(e) {
  const message = e?.message ?? String(e);
  if (Platform.OS === 'web') window.alert(message);
  else Alert.alert('Hata', message);
}
