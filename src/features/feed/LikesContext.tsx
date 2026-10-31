import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import { STORAGE_KEYS } from '@/data/storage';
import { useCollection, type RemoteTable } from '@/data/useCollection';
import { useSession } from '@/features/session/SessionContext';

// Curtida em uma publicação do studio ou em uma avaliação (itemId é o id de um ou de outro).
export type Like = { id: string; itemId: string; userId: string };

// user_id é preenchido pelo banco com quem está logada; as regras só deixam criar e apagar as próprias.
const REMOTE: RemoteTable<Like> = { table: 'likes', toRow: (l) => ({ id: l.id, item_id: l.itemId, data: l }) };

type LikesApi = {
  count: (itemId: string) => number;
  likedByMe: (itemId: string) => boolean;
  // Devolve false se não deu para curtir (sem conexão ou login recusado).
  toggle: (itemId: string) => Promise<boolean>;
};

const LikesContext = createContext<LikesApi | null>(null);

export function LikesProvider({ children }: { children: ReactNode }) {
  const [likes, commit] = useCollection<Like>(STORAGE_KEYS.likes, REMOTE);
  const { userId, ensureUser } = useSession();

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of likes) map.set(l.itemId, (map.get(l.itemId) ?? 0) + 1);
    return map;
  }, [likes]);

  const mine = useMemo(() => new Set(likes.filter((l) => l.userId === userId).map((l) => l.itemId)), [likes, userId]);

  const toggle = useCallback(
    async (itemId: string) => {
      const me = userId ?? (await ensureUser());
      if (!me) return false;
      const id = `${itemId}:${me}`;
      const liked = likes.some((l) => l.id === id);
      return commit(liked ? likes.filter((l) => l.id !== id) : [...likes, { id, itemId, userId: me }]);
    },
    [likes, commit, userId, ensureUser],
  );

  const api = useMemo<LikesApi>(
    () => ({ count: (itemId) => counts.get(itemId) ?? 0, likedByMe: (itemId) => mine.has(itemId), toggle }),
    [counts, mine, toggle],
  );

  return <LikesContext.Provider value={api}>{children}</LikesContext.Provider>;
}

export function useLikes() {
  const ctx = useContext(LikesContext);
  if (!ctx) throw new Error('useLikes precisa estar dentro de LikesProvider');
  return ctx;
}
