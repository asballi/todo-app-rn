import { useMemo } from 'react';
import { useTodoStore } from './useTodoStore';
import { tagsByTask } from '../domain/filters';

// { [taskId]: [tag, ...] } — görev listelerinde satırlara etiket göstermek için.
export function useTagsByTask() {
  const tags = useTodoStore(s => s.tags);
  const taskTags = useTodoStore(s => s.taskTags);
  return useMemo(() => tagsByTask(tags, taskTags), [tags, taskTags]);
}
