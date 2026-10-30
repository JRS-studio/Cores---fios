import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { deletePhoto } from '@/data/photoStorage';
import { loadJson, saveJson } from '@/data/storage';

const KEY = 'cores:feedbacks:v1';

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

type FeedbackApi = {
  ready: boolean;
  feedbacks: Feedback[];
  average: number;
  addFeedback: (feedback: Feedback) => void;
  removeFeedback: (id: string) => void;
};

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadJson<Feedback[]>(KEY, []).then((data) => {
      setFeedbacks(data);
      setReady(true);
    });
  }, []);

  const api = useMemo<FeedbackApi>(() => {
    const commit = (next: Feedback[]) => {
      setFeedbacks(next);
      saveJson(KEY, next);
    };
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
  }, [feedbacks, ready]);

  return <FeedbackContext.Provider value={api}>{children}</FeedbackContext.Provider>;
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback precisa estar dentro de FeedbackProvider');
  return ctx;
}
