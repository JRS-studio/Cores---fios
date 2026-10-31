import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { deletePhoto } from '@/data/photoStorage';
import { STORAGE_KEYS } from '@/data/storage';
import { useCollection, type RemoteTable } from '@/data/useCollection';


export type Feedback = {
  id: string;
  createdAt: string;
  rating: number; // 1 a 5
  comment: string;
  photoUri?: string;
  // null = avaliação anônima
  displayName: string | null;
  service?: string;
};

const REMOTE: RemoteTable<Feedback> = { table: 'feedbacks', toRow: (f) => ({ id: f.id, data: f }) };

type FeedbackApi = {
  ready: boolean;
  feedbacks: Feedback[];
  average: number;
  addFeedback: (feedback: Feedback) => void;
  removeFeedback: (id: string) => void;
};

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [feedbacks, commit, ready] = useCollection<Feedback>(STORAGE_KEYS.feedbacks, REMOTE);

  const api = useMemo<FeedbackApi>(() => {
    return {
      ready,
      feedbacks,
      average: feedbacks.length ? feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length : 0,
      addFeedback: (feedback) => commit([feedback, ...feedbacks]),
      removeFeedback: (id) => {
        const target = feedbacks.find((f) => f.id === id);
        if (target?.photoUri) deletePhoto(target.photoUri);
        commit(feedbacks.filter((f) => f.id !== id));
      },
    };
  }, [feedbacks, commit, ready]);

  return <FeedbackContext.Provider value={api}>{children}</FeedbackContext.Provider>;
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback precisa estar dentro de FeedbackProvider');
  return ctx;
}
