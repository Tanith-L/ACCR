import { useCallback, useEffect, useState } from 'react';

export interface AsyncState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => void;
}

interface Result<T> {
  request: string;
  data?: T;
  error?: unknown;
}

/** Runs `load` whenever `key` changes (e.g. the topic id). Each result is
 *  tagged with the request that produced it, so a stale response never shows
 *  up as current data. */
export function useAsync<T>(load: () => Promise<T>, key: string): AsyncState<T> {
  const [attempt, setAttempt] = useState(0);
  const request = `${key}#${attempt}`;
  const [result, setResult] = useState<Result<T>>();

  useEffect(() => {
    let current = true;
    load().then(
      (data) => current && setResult({ request, data }),
      (error) => current && setResult({ request, error: error ?? new Error('Unknown error') }),
    );
    return () => {
      current = false;
    };
    // `load` is a fresh closure every render; `request` captures what it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const fresh = result?.request === request;
  return {
    data: fresh ? result.data : undefined,
    error: fresh ? result.error : undefined,
    loading: !fresh,
    reload,
  };
}
