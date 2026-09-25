import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, priorityColors } from '../theme';
import { formatDueLabel, isOverdue } from '../domain/dates';
import { strings } from '../strings';
import { recurrenceLabel } from '../domain/recurrence';

export default function TaskItem({ task, tags = [], onToggle, onPress }) {
  const done = !!task.completedAt;
  const dueLabel = formatDueLabel(task);
  const overdue = isOverdue(task);
  const ringColor = priorityColors[task.priority];
  const checklist = task.checklist ?? [];
  const checkedCount = checklist.filter(i => i.done).length;
  // Web'de devre dışı bir dış dokunma alanı içteki checkbox'ı da kilitler;
  // bu yüzden onPress yoksa satır düz View olur.
  const Row = onPress ? TouchableOpacity : View;

  return (
    <Row style={[styles.row, done && styles.rowDone]} onPress={onPress} activeOpacity={0.7}>
      <TouchableOpacity
        onPress={onToggle}
        accessibilityRole="checkbox"
        aria-checked={done}
        accessibilityLabel={task.title}
        hitSlop={8}
      >
        <View style={[styles.checkbox, { borderColor: ringColor }, done && { backgroundColor: ringColor }]}>
          {done && <Feather name="check" size={13} color="#fff" />}
        </View>
      </TouchableOpacity>

      <View style={styles.body}>
        <Text style={[styles.title, done && styles.titleDone]} numberOfLines={2}>
          {task.title}
        </Text>
        {(dueLabel || tags.length > 0 || checklist.length > 0 || task.recurrence) && (
          <View style={styles.meta}>
            {dueLabel && (
              <>
                <Feather name="calendar" size={12} color={overdue ? colors.danger : colors.muted} />
                <Text style={[styles.metaText, overdue && styles.overdue]}>{dueLabel}</Text>
              </>
            )}
            {task.recurrence && (
              <View accessibilityLabel={strings.recurrence.repeats(recurrenceLabel(task.recurrence))}>
                <Feather name="repeat" size={12} color={colors.muted} />
              </View>
            )}
            {checklist.length > 0 && (
              <View
                style={styles.progress}
                accessibilityLabel={strings.checklist.progressLabel(checkedCount, checklist.length)}
              >
                <Feather name="check-square" size={12} color={colors.muted} />
                <Text style={styles.metaText}>{strings.checklist.progress(checkedCount, checklist.length)}</Text>
              </View>
            )}
            {tags.map(tag => (
              <Text key={tag.id} style={[styles.metaText, { color: tag.color ?? colors.tagDefault }]}>
                #{tag.name}
              </Text>
            ))}
          </View>
        )}
      </View>
    </Row>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  rowDone: {
    opacity: 0.55,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 15,
    color: colors.text,
  },
  titleDone: {
    textDecorationLine: 'line-through',
    color: colors.muted,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 12,
    color: colors.muted,
  },
  overdue: {
    color: colors.danger,
    fontWeight: '600',
  },
});
