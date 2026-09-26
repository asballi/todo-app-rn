import { useEffect, useMemo, useState } from 'react';
import { useTodoStore } from './useTodoStore';
import { tagsByTask } from '../domain/filters';

// { [taskId]: [tag, ...] } — görev listelerinde satırlara etiket göstermek için.
export function useTagsByTask() {
  const tags = useTodoStore(s => s.tags);
  const taskTags = useTodoStore(s => s.taskTags);
  return useMemo(() => tagsByTask(tags, taskTags), [tags, taskTags]);
}

// Dakikada bir güncellenen "şimdi": saatli görevler ekran açıkken gecikmiş
// duruma geçer, gece yarısı "bugün" değişir.
export function useNow(intervalMs = 60 * 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
