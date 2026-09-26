import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSyncState } from '../sync';
import { strings } from '../strings';
import { useThemedStyles, useTheme } from '../theme';

const t = strings.account;

// Sürüm kilidi (X8) şeridi: senkron durunca bir kez görünür; kapatılınca bu
// oturumda yeniden çıkmaz. Dokununca Hesap ekranı açılır.
export default function SyncBanner() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const state = useSyncState();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || state.sync?.phase !== 'outdated') return null;

  return (
    <View style={[styles.container, { top: insets.top + 12 }]} pointerEvents="box-none">
      <View style={styles.banner} accessibilityRole="alert">
        <TouchableOpacity style={styles.body} onPress={() => router.push('/account')} accessibilityLabel={t.bannerOpen}>
          <Feather name="alert-triangle" size={18} color={colors.inverseText} />
          <Text style={styles.text}>{t.outdatedBanner}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setDismissed(true)} accessibilityLabel={t.bannerDismiss} hitSlop={8}>
          <Feather name="x" size={18} color={colors.inverseText} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = colors => StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 10,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.inverseSurface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: colors.shadow,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  text: {
    flex: 1,
    color: colors.inverseText,
    fontWeight: '600',
  },
});
