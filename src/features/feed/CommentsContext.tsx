import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { STORAGE_KEYS } from '@/data/storage';
import { useCollection, type RemoteTable } from '@/data/useCollection';
import { useSession } from '@/features/session/SessionContext';
import { newId } from '@/utils/id';

// Comentário numa publicação do studio. Como as avaliações, só aparece para todas depois que a
// profissional aprova; até lá, só quem escreveu e a profissional veem (a regra fica no banco).
export type Comment = {
  id: string;
  postId: string;
  createdAt: string;
  text: string;
  name: string;
  authorId?: string;
  fromStudio?: boolean;
  approved: boolean;
};

export const MAX_COMMENT = 300;

const REMOTE: RemoteTable<Comment> = {
  table: 'comments',
  toRow: (c) => ({ id: c.id, post_id: c.postId, approved: c.approved, data: c }),
};

const byDate = (a: Comment, b: Comment) => a.createdAt.localeCompare(b.createdAt);

type CommentsApi = {
  // Aprovados de uma publicação, do mais antigo para o mais novo.
  approvedFor: (postId: string) => Comment[];
  // O que a pessoa vê na publicação: aprovados + os que esperam aprovação e ela pode ver.
  visibleFor: (postId: string) => Comment[];
  // Todos os que esperam aprovação (a profissional vê todos; a cliente, só os dela).
  pending: Comment[];
  addComment: (postId: string, text: string, name: string) => Promise<boolean>;
  approveComment: (id: string) => void;
  removeComment: (id: string) => void;
  // Quem pode apagar: a profissional ou quem escreveu.
  canRemove: (c: Comment) => boolean;
};

const CommentsContext = createContext<CommentsApi | null>(null);

export function CommentsProvider({ children }: { children: ReactNode }) {
  const [all, commit] = useCollection<Comment>(STORAGE_KEYS.comments, REMOTE);
  const { canManage, userId, ensureUser } = useSession();

  const api = useMemo<CommentsApi>(() => {
    const mine = (c: Comment) => !!userId && c.authorId === userId;
    const canSee = (c: Comment) => c.approved || canManage || mine(c);
    return {
      approvedFor: (postId) => all.filter((c) => c.postId === postId && c.approved).sort(byDate),
      visibleFor: (postId) => all.filter((c) => c.postId === postId && canSee(c)).sort(byDate),
      pending: all.filter((c) => !c.approved && (canManage || mine(c))).sort(byDate),
      addComment: async (postId, text, name) => {
        const me = userId ?? (await ensureUser());
        if (!me) return false;
        return commit([
          ...all,
          {
            id: newId(),
            postId,
            createdAt: new Date().toISOString(),
            text: text.trim().slice(0, MAX_COMMENT),
            name: name.trim(),
            authorId: me,
            fromStudio: canManage || undefined,
            // O que a profissional escreve já sai aprovado; o resto espera a aprovação dela.
            approved: canManage,
          },
        ]);
      },
      approveComment: (id) => commit(all.map((c) => (c.id === id ? { ...c, approved: true } : c))),
      removeComment: (id) => commit(all.filter((c) => c.id !== id)),
      canRemove: (c) => canManage || mine(c),
    };
  }, [all, commit, canManage, userId, ensureUser]);

  return <CommentsContext.Provider value={api}>{children}</CommentsContext.Provider>;
}

export function useComments() {
  const ctx = useContext(CommentsContext);
  if (!ctx) throw new Error('useComments precisa estar dentro de CommentsProvider');
  return ctx;
}
