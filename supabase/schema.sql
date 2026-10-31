-- Banco de dados do Cores & Fios no Supabase (um projeto por studio).
-- Rode este arquivo inteiro no SQL Editor do Supabase. Depois, veja supabase/README.md.
-- Pode rodar de novo sem problema: ele só cria o que falta e refaz as regras de acesso.
--
-- Quem acessa o quê (garantido pelo banco, com Row Level Security):
--   profissional (usuária cadastrada em `professionals`): tudo.
--   cliente (entrou pelo código do WhatsApp): o próprio cadastro e os próprios horários;
--     marca horários só nos espaços livres; publica avaliações.
--   qualquer pessoa: publicações do studio, avaliações, curtidas, ajustes do studio e quais horários
--     estão ocupados (só início e duração, sem dados de quem marcou).
--   quem está logada (mesmo sem número, com login anônimo): curte e descurte, só em nome próprio.

-- Profissionais: quem administra o studio.
create table if not exists professionals (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from professionals where user_id = auth.uid());
$$;

-- Entrada da cliente só com o WhatsApp, sem código (enquanto não há envio por Twilio):
-- o número fica preso ao aparelho (login anônimo do Supabase) que o usou primeiro.
-- Outro aparelho só entra com esse número se a cliente sair ou se a profissional liberar.
create table if not exists phone_claims (
  user_id uuid primary key references auth.users (id) on delete cascade,
  phone text not null unique,
  claimed_at timestamptz not null default now()
);

-- Telefone da cliente logada: confirmado por código (no token) ou preso a este aparelho.
create or replace function current_phone() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(auth.jwt() ->> 'phone', ''),
    (select phone from phone_claims where user_id = auth.uid())
  );
$$;

create or replace function claim_phone(p_phone text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'login_required';
  end if;
  if p_phone !~ '^55[1-9]{2}9[0-9]{8}$' then
    raise exception 'invalid_phone';
  end if;
  if exists (select 1 from phone_claims where phone = p_phone and user_id <> auth.uid()) then
    raise exception 'phone_taken';
  end if;
  delete from phone_claims where user_id = auth.uid();
  insert into phone_claims (user_id, phone) values (auth.uid(), p_phone);
end;
$$;

-- A cliente solta o próprio número ao sair do app.
create or replace function release_my_phone() returns void
language sql security definer set search_path = public as $$
  delete from phone_claims where user_id = auth.uid();
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

-- Publicações da profissional no feed da página inicial.
create table if not exists posts (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

-- Curtidas em publicações e avaliações (item_id é o id de uma ou de outra). Uma por pessoa e item.
create table if not exists likes (
  id text primary key,
  item_id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (item_id, user_id)
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
alter table posts enable row level security;
alter table likes enable row level security;

drop policy if exists "profissional vê a si mesma" on professionals;
create policy "profissional vê a si mesma" on professionals for select using (user_id = auth.uid());

alter table phone_claims enable row level security;
drop policy if exists "cliente vê o próprio número" on phone_claims;
create policy "cliente vê o próprio número" on phone_claims for select using (user_id = auth.uid());
drop policy if exists "profissional: números" on phone_claims;
create policy "profissional: números" on phone_claims for all using (is_owner()) with check (is_owner());

drop policy if exists "profissional: clientes" on clients;
create policy "profissional: clientes" on clients for all using (is_owner()) with check (is_owner());
drop policy if exists "cliente vê o próprio cadastro" on clients;
create policy "cliente vê o próprio cadastro" on clients for select using (phone = current_phone());
drop policy if exists "cliente cria o próprio cadastro" on clients;
create policy "cliente cria o próprio cadastro" on clients for insert with check (phone = current_phone());
drop policy if exists "cliente edita o próprio cadastro" on clients;
create policy "cliente edita o próprio cadastro" on clients for update
  using (phone = current_phone()) with check (phone = current_phone());
drop policy if exists "cliente apaga o próprio cadastro" on clients;
create policy "cliente apaga o próprio cadastro" on clients for delete using (phone = current_phone());

drop policy if exists "profissional: agenda" on appointments;
create policy "profissional: agenda" on appointments for all using (is_owner()) with check (is_owner());
drop policy if exists "cliente vê os próprios horários" on appointments;
create policy "cliente vê os próprios horários" on appointments for select using (client_phone = current_phone());
drop policy if exists "cliente marca horário" on appointments;
create policy "cliente marca horário" on appointments for insert
  with check (client_phone = current_phone() and status = 'agendado');
drop policy if exists "cliente remarca ou cancela" on appointments;
create policy "cliente remarca ou cancela" on appointments for update
  using (client_phone = current_phone() and status in ('agendado', 'confirmado'))
  with check (client_phone = current_phone() and status in ('agendado', 'cancelado'));

drop policy if exists "profissional: financeiro" on transactions;
create policy "profissional: financeiro" on transactions for all using (is_owner()) with check (is_owner());

drop policy if exists "todos veem avaliações" on feedbacks;
create policy "todos veem avaliações" on feedbacks for select using (true);
drop policy if exists "cliente publica avaliação" on feedbacks;
create policy "cliente publica avaliação" on feedbacks for insert
  with check (auth.uid() is not null and author_id = auth.uid());
drop policy if exists "profissional remove avaliação" on feedbacks;
create policy "profissional remove avaliação" on feedbacks for delete using (is_owner());

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

drop policy if exists "todos veem os ajustes" on settings;
create policy "todos veem os ajustes" on settings for select using (true);
drop policy if exists "profissional: ajustes" on settings;
create policy "profissional: ajustes" on settings for all using (is_owner()) with check (is_owner());

-- Horários ocupados de um dia, sem expor quem marcou (usado pela cliente ao escolher horário).
create or replace function busy_slots(day date)
returns table (starts_at timestamp, ends_at timestamp)
language sql stable security definer set search_path = public as $$
  select a.starts_at, a.ends_at from appointments a
  where a.starts_at::date = day and a.status in ('agendado', 'confirmado', 'concluido');
$$;

grant execute on function busy_slots(date) to anon, authenticated;
grant execute on function claim_phone(text), release_my_phone() to authenticated;
grant execute on function is_owner() to authenticated;

-- Fotos das avaliações e das publicações: leitura pública, envio por quem está logada.
insert into storage.buckets (id, name, public) values ('avaliacoes', 'avaliacoes', true)
  on conflict (id) do nothing;
drop policy if exists "fotos de avaliação: leitura" on storage.objects;
create policy "fotos de avaliação: leitura" on storage.objects for select using (bucket_id = 'avaliacoes');
drop policy if exists "fotos de avaliação: envio" on storage.objects;
create policy "fotos de avaliação: envio" on storage.objects for insert
  with check (bucket_id = 'avaliacoes' and auth.uid() is not null);
drop policy if exists "fotos de avaliação: profissional remove" on storage.objects;
create policy "fotos de avaliação: profissional remove" on storage.objects for delete
  using (bucket_id = 'avaliacoes' and is_owner());

-- Lembrete no celular da cliente 1 hora antes do horário (notificação do navegador, Web Push).
-- O envio é feito pela função "lembretes" (supabase/functions/lembretes), chamada a cada 5 minutos.

-- Celulares que aceitaram receber lembretes (um por navegador). O número vem do login da cliente.
create table if not exists push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  phone text not null default current_phone(),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table push_subscriptions enable row level security;
drop policy if exists "cliente ativa lembretes" on push_subscriptions;
create policy "cliente ativa lembretes" on push_subscriptions for insert
  with check (user_id = auth.uid() and phone is not null and phone = current_phone());
drop policy if exists "cliente vê os próprios lembretes" on push_subscriptions;
create policy "cliente vê os próprios lembretes" on push_subscriptions for select using (user_id = auth.uid());
drop policy if exists "cliente desativa lembretes" on push_subscriptions;
create policy "cliente desativa lembretes" on push_subscriptions for delete using (user_id = auth.uid());

-- Chaves de envio (VAPID), criadas pela própria função na primeira vez. Só o servidor lê a privada.
create table if not exists push_config (
  id int primary key default 1 check (id = 1),
  public_key text not null,
  private_key text not null
);
alter table push_config enable row level security;

-- O app precisa só da chave pública para ativar os lembretes.
create or replace function vapid_public_key() returns text
language sql stable security definer set search_path = public as $$
  select public_key from push_config where id = 1;
$$;
grant execute on function vapid_public_key() to anon, authenticated;

-- Quando o lembrete do horário já foi enviado (volta a vazio se o horário mudar).
alter table appointments add column if not exists reminded_at timestamptz;

create or replace function reset_reminder() returns trigger
language plpgsql as $$
begin
  if new.starts_at is distinct from old.starts_at then
    new.reminded_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists appointments_reset_reminder on appointments;
create trigger appointments_reset_reminder before update on appointments
  for each row execute function reset_reminder();

-- Horários que começam na próxima hora (no fuso do studio) e ainda não tiveram lembrete,
-- com os celulares da cliente. Usada só pela função de envio.
create or replace function due_reminders(tz text default 'America/Sao_Paulo')
returns table (appointment_id text, starts_at timestamp, data jsonb, endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = public as $$
  select a.id, a.starts_at, a.data, s.endpoint, s.p256dh, s.auth
  from appointments a
  join push_subscriptions s on s.phone = a.client_phone
  where a.status in ('agendado', 'confirmado')
    and a.reminded_at is null
    and a.starts_at > (now() at time zone tz)
    and a.starts_at <= (now() at time zone tz) + interval '1 hour';
$$;

create or replace function mark_reminded(ids text[]) returns void
language sql security definer set search_path = public as $$
  update appointments set reminded_at = now() where id = any(ids);
$$;

revoke execute on function due_reminders(text) from public, anon, authenticated;
revoke execute on function mark_reminded(text[]) from public, anon, authenticated;
grant execute on function due_reminders(text), mark_reminded(text[]) to service_role;

-- Atualizações em tempo real nas telas abertas.
do $$
declare t text;
begin
  foreach t in array array['clients', 'appointments', 'transactions', 'feedbacks', 'settings', 'posts', 'likes'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
