-- Banco de dados do Cores & Fios no Supabase (um projeto por studio).
-- Rode este arquivo inteiro no SQL Editor do Supabase. Depois, veja supabase/README.md.
--
-- Quem acessa o quê (garantido pelo banco, com Row Level Security):
--   profissional (usuária cadastrada em `professionals`): tudo.
--   cliente (entrou pelo código do WhatsApp): o próprio cadastro e os próprios horários;
--     marca horários só nos espaços livres; publica avaliações.
--   qualquer pessoa: avaliações publicadas, ajustes do studio e quais horários estão ocupados
--     (só início e duração, sem dados de quem marcou).

-- Profissionais: quem administra o studio.
create table if not exists professionals (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from professionals where user_id = auth.uid());
$$;

-- Telefone da cliente logada pelo código do WhatsApp (ex.: 5511987654321).
create or replace function current_phone() returns text
language sql stable as $$
  select nullif(auth.jwt() ->> 'phone', '');
$$;

-- Cada tabela guarda o registro do app em `data` e repete em colunas os campos usados nas regras.

create table if not exists clients (
  id text primary key,
  phone text not null unique,         -- 55 + DDD + número
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists appointments (
  id text primary key,
  client_phone text not null,
  status text not null check (status in ('agendado', 'confirmado', 'concluido', 'cancelado', 'faltou')),
  starts_at timestamp not null,
  ends_at timestamp not null check (ends_at > starts_at),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  -- Dois horários ativos nunca se sobrepõem, mesmo se duas clientes marcarem ao mesmo tempo.
  constraint no_overlap exclude using gist (tsrange(starts_at, ends_at) with &&)
    where (status in ('agendado', 'confirmado', 'concluido'))
);

create table if not exists transactions (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists feedbacks (
  id text primary key,
  author_id uuid default auth.uid(),
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null
);

alter table professionals enable row level security;
alter table clients enable row level security;
alter table appointments enable row level security;
alter table transactions enable row level security;
alter table feedbacks enable row level security;
alter table settings enable row level security;

create policy "profissional vê a si mesma" on professionals for select using (user_id = auth.uid());

create policy "profissional: clientes" on clients for all using (is_owner()) with check (is_owner());
create policy "cliente vê o próprio cadastro" on clients for select using (phone = current_phone());
create policy "cliente cria o próprio cadastro" on clients for insert with check (phone = current_phone());
create policy "cliente edita o próprio cadastro" on clients for update
  using (phone = current_phone()) with check (phone = current_phone());
create policy "cliente apaga o próprio cadastro" on clients for delete using (phone = current_phone());

create policy "profissional: agenda" on appointments for all using (is_owner()) with check (is_owner());
create policy "cliente vê os próprios horários" on appointments for select using (client_phone = current_phone());
create policy "cliente marca horário" on appointments for insert
  with check (client_phone = current_phone() and status = 'agendado');
create policy "cliente remarca ou cancela" on appointments for update
  using (client_phone = current_phone() and status in ('agendado', 'confirmado'))
  with check (client_phone = current_phone() and status in ('agendado', 'cancelado'));

create policy "profissional: financeiro" on transactions for all using (is_owner()) with check (is_owner());

create policy "todos veem avaliações" on feedbacks for select using (true);
create policy "cliente publica avaliação" on feedbacks for insert
  with check (auth.uid() is not null and author_id = auth.uid());
create policy "profissional remove avaliação" on feedbacks for delete using (is_owner());

create policy "todos veem os ajustes" on settings for select using (true);
create policy "profissional: ajustes" on settings for all using (is_owner()) with check (is_owner());

-- Horários ocupados de um dia, sem expor quem marcou (usado pela cliente ao escolher horário).
create or replace function busy_slots(day date)
returns table (starts_at timestamp, ends_at timestamp)
language sql stable security definer set search_path = public as $$
  select a.starts_at, a.ends_at from appointments a
  where a.starts_at::date = day and a.status in ('agendado', 'confirmado', 'concluido');
$$;

grant execute on function busy_slots(date) to anon, authenticated;
grant execute on function is_owner() to authenticated;

-- Fotos das avaliações: leitura pública, envio por quem está logada.
insert into storage.buckets (id, name, public) values ('avaliacoes', 'avaliacoes', true)
  on conflict (id) do nothing;
create policy "fotos de avaliação: leitura" on storage.objects for select using (bucket_id = 'avaliacoes');
create policy "fotos de avaliação: envio" on storage.objects for insert
  with check (bucket_id = 'avaliacoes' and auth.uid() is not null);
create policy "fotos de avaliação: profissional remove" on storage.objects for delete
  using (bucket_id = 'avaliacoes' and is_owner());

-- Atualizações em tempo real nas telas abertas.
alter publication supabase_realtime add table clients, appointments, transactions, feedbacks, settings;
