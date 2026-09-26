import React from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Mobil: kaydırma hareketleri için gerekli kök. Web'de hareket yok
// (GestureRoot.web.jsx), böylece kütüphane web paketine girmez.
export default function GestureRoot({ children }) {
  return <GestureHandlerRootView style={styles.root}>{children}</GestureHandlerRootView>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
