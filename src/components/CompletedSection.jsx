import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import TaskRows from './TaskRows';
import { confirm, showError } from './confirm';
import { useTodoStore } from '../store/useTodoStore';
import { colors } from '../theme';

// Listelerin altındaki "Tamamlananlar (n)" bölümü; varsayılan olarak kapalı.
export default function CompletedSection({ tasks }) {
  const [open, setOpen] = useState(false);
  if (tasks.length === 0) return null;

  async function clear() {
    const ok = await confirm({
      title: `${tasks.length} tamamlanmış görev silinsin mi?`,
      confirmText: 'Sil',
      destructive: true,
    });
    if (!ok) return;
    useTodoStore.getState().deleteTasks(tasks.map(t => t.id)).catch(showError);
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        aria-expanded={open}
      >
        <Feather name={open ? 'chevron-down' : 'chevron-right'} size={16} color={colors.muted} />
        <Text style={styles.title}>Tamamlananlar ({tasks.length})</Text>
      </TouchableOpacity>
      {open && (
        <>
          <TaskRows tasks={tasks} />
          <TouchableOpacity style={styles.clear} onPress={clear}>
            <Feather name="trash-2" size={14} color={colors.danger} />
            <Text style={styles.clearText}>Tamamlananları sil</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
  },
  clear: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  clearText: {
    fontSize: 13,
    color: colors.danger,
    fontWeight: '600',
  },
});
