import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTodoStore } from '../src/store/useTodoStore';
import { sortTags, openTaskCountsByTag } from '../src/domain/filters';
import { ListRow, SectionHeader, listStyles } from '../src/components/ListRow';
import { colors } from '../src/theme';
import { strings } from '../src/strings';

// Etiketleri yeniden adlandırma, renklendirme ve silme için.
export default function ManageTagsScreen() {
  const router = useRouter();
  const allTags = useTodoStore(s => s.tags);
  const tasks = useTodoStore(s => s.tasks);
  const taskTags = useTodoStore(s => s.taskTags);
  const tags = useMemo(() => sortTags(allTags), [allTags]);
  const counts = useMemo(() => openTaskCountsByTag(tasks, taskTags), [tasks, taskTags]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: strings.tag.manageTitle }} />
      <SectionHeader
        title={strings.tag.count(tags.length)}
        actionLabel={strings.tag.new}
        onAction={() => router.push('/tag-form')}
      />
      <View style={listStyles.card}>
        {tags.length === 0 ? (
          <Text style={listStyles.empty}>{strings.tag.none}</Text>
        ) : (
          tags.map((tag, index) => (
            <ListRow
              key={tag.id}
              first={index === 0}
              icon="hash"
              color={tag.color ?? colors.tagDefault}
              name={tag.name}
              count={counts[tag.id]}
              onPress={() => router.push({ pathname: '/tag-form', params: { id: tag.id } })}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
  },
});
