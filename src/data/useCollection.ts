import { useCallback, useEffect, useRef, useState } from 'react';

import { loadJson, saveJson } from './storage';
import { supabase } from './supabase';
import { reportSyncError } from './syncStatus';

export type RemoteTable<T> = {
  table: string;
  // Colunas que o banco usa nas regras de acesso, além do registro completo em `data`.
  toRow: (item: T) => Record<string, unknown>;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Lista de registros salva no aparelho e, com o servidor configurado, sincronizada com o Supabase.
// O banco só devolve o que a pessoa logada pode ver (Row Level Security).
export function useCollection<T extends { id: string }>(localKey: string, remote: RemoteTable<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [ready, setReady] = useState(false);
  const itemsRef = useRef<T[]>([]);

  const apply = useCallback((next: T[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  const fetchRemote = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from(remote.table).select('data');
    if (error) return reportSyncError(error);
    const next = (data ?? []).map((row) => row.data as T);
    apply(next);
    saveJson(localKey, next);
  }, [apply, localKey, remote.table]);

  useEffect(() => {
    let alive = true;
    loadJson<T[]>(localKey, []).then((cached) => {
      if (!alive) return;
      apply(cached);
      setReady(true);
      fetchRemote();
    });
    if (!supabase) {
      return () => {
        alive = false;
      };
    }
    // Atualiza ao trocar de login (cada pessoa vê dados diferentes) e quando outro aparelho altera algo.
    const { data: auth } = supabase.auth.onAuthStateChange(() => {
      fetchRemote();
    });
    const channel = supabase
      .channel(`sync-${remote.table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: remote.table }, () => fetchRemote())
      .subscribe();
    return () => {
      alive = false;
      auth.subscription.unsubscribe();
      supabase?.removeChannel(channel);
    };
  }, [apply, fetchRemote, localKey, remote.table]);

  const commit = useCallback(
    async (next: T[]) => {
      const previous = itemsRef.current;
      apply(next);
      saveJson(localKey, next);
      if (!supabase) return true;

      const before = new Map(previous.map((i) => [i.id, i]));
      const upserts = next.filter((i) => !same(before.get(i.id), i)).map(remote.toRow);
      const nextIds = new Set(next.map((i) => i.id));
      const removed = previous.filter((i) => !nextIds.has(i.id)).map((i) => i.id);

      const results = await Promise.all([
        upserts.length ? supabase.from(remote.table).upsert(upserts) : null,
        removed.length ? supabase.from(remote.table).delete().in('id', removed) : null,
      ]);
      const error = results.find((r) => r?.error)?.error;
      if (error) {
        // O servidor recusou (ex.: horário ocupado por outra cliente): volta ao que estava salvo lá.
        reportSyncError(error);
        await fetchRemote();
        return false;
      }
      return true;
    },
    [apply, fetchRemote, localKey, remote],
  );

  return [items, commit, ready] as const;
}
