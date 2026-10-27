// Lesson completion, stored on the device. There are no patient accounts yet;
// when there are, replace the storage calls with a backend table and keep this API.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'rheumnotes.progress.v1';

interface CompletionRecord {
  topicId: string;
  completedAt: string; // ISO time
}

interface ProgressValue {
  ready: boolean;
  isCompleted: (lessonId: string) => boolean;
  setCompleted: (lesson: { id: string; topicId: string }, done: boolean) => void;
  countCompleted: (lessonIds: string[]) => number;
  countCompletedInTopic: (topicId: string) => number;
  resetProgress: () => void;
}

const ProgressContext = createContext<ProgressValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [completed, setCompletedMap] = useState<Record<string, CompletionRecord>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => raw && setCompletedMap(JSON.parse(raw)))
      .catch(() => {}) // unreadable progress starts fresh rather than blocking the app
      .finally(() => setReady(true));
  }, []);

  const persist = useCallback((next: Record<string, CompletionRecord>) => {
    setCompletedMap(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const value = useMemo<ProgressValue>(
    () => ({
      ready,
      isCompleted: (id) => id in completed,
      setCompleted: (lesson, done) => {
        const next = { ...completed };
        if (done) next[lesson.id] = { topicId: lesson.topicId, completedAt: new Date().toISOString() };
        else delete next[lesson.id];
        persist(next);
      },
      countCompleted: (ids) => ids.filter((id) => id in completed).length,
      countCompletedInTopic: (topicId) => Object.values(completed).filter((r) => r.topicId === topicId).length,
      resetProgress: () => persist({}),
    }),
    [completed, ready, persist],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used inside <ProgressProvider>');
  return ctx;
}
