// App preferences stored on the device: whether the welcome screen has been
// seen, and whether optional quizzes are shown. No account or PHI is involved.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'rheumnotes.preferences.v1';

interface Stored {
  onboarded: boolean;
  quizzesEnabled: boolean;
}

interface PreferencesValue extends Stored {
  ready: boolean;
  /** Called from the welcome screen with the patient's quiz choice. */
  completeOnboarding: (quizzesEnabled: boolean) => void;
  setQuizzesEnabled: (enabled: boolean) => void;
}

const DEFAULTS: Stored = { onboarded: false, quizzesEnabled: true };

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<Stored>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => raw && setStored({ ...DEFAULTS, ...JSON.parse(raw) }))
      .catch(() => {}) // unreadable preferences start fresh rather than blocking the app
      .finally(() => setReady(true));
  }, []);

  const update = useCallback((patch: Partial<Stored>) => {
    setStored((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<PreferencesValue>(
    () => ({
      ...stored,
      ready,
      completeOnboarding: (quizzesEnabled) => update({ onboarded: true, quizzesEnabled }),
      setQuizzesEnabled: (quizzesEnabled) => update({ quizzesEnabled }),
    }),
    [stored, ready, update],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside <PreferencesProvider>');
  return ctx;
}
