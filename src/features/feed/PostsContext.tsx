import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { deletePhoto } from '@/data/photoStorage';
import { STORAGE_KEYS } from '@/data/storage';
import { useCollection, type RemoteTable } from '@/data/useCollection';

export type PostKind = 'trabalho' | 'promocao' | 'novidade' | 'aviso';

export const POST_KINDS: { id: PostKind; label: string }[] = [
  { id: 'trabalho', label: 'Trabalho feito' },
  { id: 'promocao', label: 'Promoção' },
  { id: 'novidade', label: 'Novidade' },
  { id: 'aviso', label: 'Aviso' },
];

export const postKindLabel = (kind: PostKind) => POST_KINDS.find((k) => k.id === kind)?.label ?? '';

// Publicação feita pela profissional no feed da página inicial.
export type Post = {
  id: string;
  createdAt: string;
  kind: PostKind;
  caption: string;
  photos: string[];
};

export const MAX_POST_PHOTOS = 4;

const REMOTE: RemoteTable<Post> = { table: 'posts', toRow: (p) => ({ id: p.id, data: p }) };

type PostsApi = {
  ready: boolean;
  posts: Post[];
  addPost: (post: Post) => Promise<boolean>;
  removePost: (id: string) => void;
};

const PostsContext = createContext<PostsApi | null>(null);

export function PostsProvider({ children }: { children: ReactNode }) {
  const [posts, commit, ready] = useCollection<Post>(STORAGE_KEYS.posts, REMOTE);

  const api = useMemo<PostsApi>(
    () => ({
      ready,
      posts,
      addPost: (post) => commit([post, ...posts]),
      removePost: (id) => {
        posts.find((p) => p.id === id)?.photos.forEach(deletePhoto);
        commit(posts.filter((p) => p.id !== id));
      },
    }),
    [posts, commit, ready],
  );

  return <PostsContext.Provider value={api}>{children}</PostsContext.Provider>;
}

export function usePosts() {
  const ctx = useContext(PostsContext);
  if (!ctx) throw new Error('usePosts precisa estar dentro de PostsProvider');
  return ctx;
}
