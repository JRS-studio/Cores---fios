-- Atualização do banco para o feed (publicações e curtidas).
-- Cole no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez; não apaga nada.
-- (Tudo isto também está no schema.sql completo.)

create table if not exists posts (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists likes (
  id text primary key,
  item_id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (item_id, user_id)
);

alter table posts enable row level security;
alter table likes enable row level security;

drop policy if exists "todos veem publicações" on posts;
create policy "todos veem publicações" on posts for select using (true);
drop policy if exists "profissional: publicações" on posts;
create policy "profissional: publicações" on posts for all using (is_owner()) with check (is_owner());

drop policy if exists "todos veem curtidas" on likes;
create policy "todos veem curtidas" on likes for select using (true);
drop policy if exists "curte em nome próprio" on likes;
create policy "curte em nome próprio" on likes for insert with check (auth.uid() is not null and user_id = auth.uid());
drop policy if exists "atualiza a própria curtida" on likes;
create policy "atualiza a própria curtida" on likes for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "descurte a própria curtida" on likes;
create policy "descurte a própria curtida" on likes for delete using (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['posts', 'likes'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
