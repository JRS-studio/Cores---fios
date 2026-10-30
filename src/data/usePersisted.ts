import { useCallback, useEffect, useState } from 'react';

import { loadJson, saveJson } from './storage';

// Estado que começa com o que está salvo no aparelho e é salvo a cada mudança.
export function usePersisted<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadJson<T>(key, fallback).then((data) => {
      if (!alive) return;
      setValue(data);
      setReady(true);
    });
    return () => {
      alive = false;
    };
    // O valor inicial só importa na primeira leitura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const commit = useCallback(
    (next: T) => {
      setValue(next);
      saveJson(key, next);
    },
    [key],
  );

  return [value, commit, ready] as const;
}
