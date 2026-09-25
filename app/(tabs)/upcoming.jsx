import React, { useMemo } from 'react';
import { Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTodoStore } from '../../src/store/useTodoStore';
import { useNow } from '../../src/store/hooks';
import { upcomingView } from '../../src/domain/filters';
import { formatDayHeader } from '../../src/domain/dates';
import TaskRows from '../../src/components/TaskRows';
import SectionTitle from '../../src/components/SectionTitle';
import CompletedSection from '../../src/components/CompletedSection';
import { useThemedStyles } from '../../src/theme';
import { strings } from '../../src/strings';

// Yarından başlayarak 7 gün; her günün "+" butonu o güne görev ekler.
export default function UpcomingScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const now = useNow();
  const tasks = useTodoStore(s => s.tasks);
  const view = useMemo(() => upcomingView(tasks, now), [tasks, now]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {view.days.map(day => {
        const header = formatDayHeader(day.date, now);
        return (
          <React.Fragment key={day.date}>
            <SectionTitle
              title={header.title}
              subtitle={header.subtitle}
              onAdd={() => router.push({ pathname: '/task/new', params: { dueDate: day.date } })}
              addLabel={strings.upcoming.addFor(header.title)}
            />
            {day.tasks.length > 0 ? (
              <TaskRows tasks={day.tasks} />
            ) : (
              <Text style={styles.none}>{strings.common.none}</Text>
            )}
          </React.Fragment>
        );
      })}
      <CompletedSection tasks={view.completed} />
    </ScrollView>
  );
}

const makeStyles = colors => StyleSheet.create({
  content: {
    padding: 16,
    paddingTop: 4,
  },
  none: {
    fontSize: 13,
    color: colors.placeholder,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
});
