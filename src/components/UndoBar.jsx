import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTodoStore } from '../store/useTodoStore';
import { showError } from './confirm';
import { strings } from '../strings';
import { colors } from '../theme';

const VISIBLE_MS = 5000;
// Sekme çubuğunun üstünde kalsın.
const TAB_BAR_OFFSET = 64;

// Son işlemi geri alma şeridi: 5 saniye görünür, yeni işlem öncekinin yerini alır.
export default function UndoBar() {
  const lastUndo = useTodoStore(s => s.lastUndo);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!lastUndo) return undefined;
    const timer = setTimeout(() => useTodoStore.getState().dismissUndo(lastUndo.id), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [lastUndo]);

  if (!lastUndo) return null;

  return (
    <View style={[styles.container, { bottom: insets.bottom + TAB_BAR_OFFSET }]} pointerEvents="box-none">
      <View style={styles.bar} accessibilityRole="alert">
        <Text style={styles.label} numberOfLines={1}>{lastUndo.label}</Text>
        <TouchableOpacity
          onPress={() => useTodoStore.getState().undo().catch(showError)}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={styles.action}>{strings.undo.action}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => useTodoStore.getState().dismissUndo(lastUndo.id)}
          accessibilityLabel={strings.undo.dismiss}
          hitSlop={8}
        >
          <Feather name="x" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    alignItems: 'center',
    zIndex: 10,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    maxWidth: 480,
    width: '100%',
    backgroundColor: colors.text,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  label: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  action: {
    color: '#b8b3ff',
    fontSize: 14,
    fontWeight: '700',
  },
});
