-- Atualização do banco: comentários nas publicações (com aprovação da profissional).
-- Cole no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez; não apaga nada.
-- (Tudo isto também está no schema.sql completo.)

-- Comentários nas publicações do feed. Só aparecem para todas depois que a profissional aprova;
-- até lá, só quem escreveu e a profissional veem. Quem visita comenta com o login anônimo do app.
create table if not exists comments (
  id text primary key,
  post_id text not null references posts (id) on delete cascade,
  author_id uuid default auth.uid(),
  approved boolean not null default false,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists comments_post_id on comments (post_id);
alter table comments enable row level security;
drop policy if exists "comentários aprovados para todas" on comments;
create policy "comentários aprovados para todas" on comments for select
  using (approved or is_owner() or author_id = auth.uid());
drop policy if exists "quem entrou comenta" on comments;
create policy "quem entrou comenta" on comments for insert
  with check (auth.uid() is not null and author_id = auth.uid() and approved = false and data ->> 'approved' = 'false');
drop policy if exists "profissional comenta" on comments;
create policy "profissional comenta" on comments for insert with check (is_owner());
drop policy if exists "profissional aprova comentário" on comments;
create policy "profissional aprova comentário" on comments for update using (is_owner()) with check (is_owner());
drop policy if exists "profissional ou autora apaga comentário" on comments;
create policy "profissional ou autora apaga comentário" on comments for delete using (is_owner() or author_id = auth.uid());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'comments') then
    alter publication supabase_realtime add table comments;
  end if;
end $$;
