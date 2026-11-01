import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { deletePhoto } from '@/data/photoStorage';
import { STORAGE_KEYS } from '@/data/storage';
import { useCollection, type RemoteTable } from '@/data/useCollection';
import { useSession } from '@/features/session/SessionContext';

export type Feedback = {
  id: string;
  createdAt: string;
  rating: number; // 1 a 5
  comment: string;
  photoUri?: string;
  // null = avaliação anônima
  displayName: string | null;
  service?: string;
  // Só aparece no feed depois que a profissional aprova. Avaliações antigas (sem o campo) já estavam no ar.
  approved?: boolean;
  // Login de quem escreveu (para ela ver a própria avaliação enquanto espera a aprovação).
  authorId?: string;
};

export const isApproved = (f: Feedback) => f.approved !== false;

// A coluna "approved" é a que vale no banco: só a profissional consegue gravar true.
const REMOTE: RemoteTable<Feedback> = { table: 'feedbacks', toRow: (f) => ({ id: f.id, approved: isApproved(f), data: f }) };

type FeedbackApi = {
  ready: boolean;
  // Só as aprovadas (feed, nota e contagem).
  feedbacks: Feedback[];
  // Esperando aprovação: a profissional vê todas; a cliente, só as dela.
  pending: Feedback[];
  average: number;
  addFeedback: (feedback: Feedback) => void;
  approveFeedback: (id: string) => void;
  removeFeedback: (id: string) => void;
};

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [all, commit, ready] = useCollection<Feedback>(STORAGE_KEYS.feedbacks, REMOTE);
  const { canManage, userId } = useSession();

  const api = useMemo<FeedbackApi>(() => {
    const feedbacks = all.filter(isApproved);
    return {
      ready,
      feedbacks,
      pending: all.filter((f) => !isApproved(f) && (canManage || (!!userId && f.authorId === userId))),
      average: feedbacks.length ? feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length : 0,
      addFeedback: (feedback) => commit([feedback, ...all]),
      approveFeedback: (id) => commit(all.map((f) => (f.id === id ? { ...f, approved: true } : f))),
      removeFeedback: (id) => {
        const target = all.find((f) => f.id === id);
        if (target?.photoUri) deletePhoto(target.photoUri);
        commit(all.filter((f) => f.id !== id));
      },
    };
  }, [all, commit, ready, canManage, userId]);

  return <FeedbackContext.Provider value={api}>{children}</FeedbackContext.Provider>;
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback precisa estar dentro de FeedbackProvider');
  return ctx;
}
