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
-- Mês aberto para as clientes: o mês atual sempre; o seguinte só depois que a profissional libera
-- (Agenda › Liberar <mês>, que grava o mês em settings.data.releasedMonths). Nunca depois do mês seguinte.
create or replace function client_month_open(ts timestamp) returns boolean
language sql stable security definer set search_path = public as $$
  select ts < date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '2 months'
    and (
      date_trunc('month', ts) <= date_trunc('month', now() at time zone 'America/Sao_Paulo')
      or to_char(ts, 'YYYY-MM') in (select jsonb_array_elements_text(coalesce(data -> 'releasedMonths', '[]')) from settings where id = 1)
    );
$$;

-- A cliente agenda e remarca no mês atual e, depois de liberado pela profissional, no seguinte.
create policy "cliente marca horário" on appointments for insert
  with check (client_phone = current_phone() and status = 'agendado' and client_month_open(starts_at));
-- A cliente só remarca (o horário volta a "a confirmar"); cancelar é só com a profissional
-- (no app, a cliente pede o cancelamento pelo WhatsApp).
drop policy if exists "cliente remarca ou cancela" on appointments;
create policy "cliente remarca ou cancela" on appointments for update
  using (client_phone = current_phone() and status in ('agendado', 'confirmado'))
  with check (client_phone = current_phone() and status = 'agendado' and client_month_open(starts_at));

drop policy if exists "profissional: financeiro" on transactions;
create policy "profissional: financeiro" on transactions for all using (is_owner()) with check (is_owner());

-- Avaliações só aparecem para todas depois que a profissional aprova.
-- As que já existiam ao criar a coluna continuam no ar; as novas nascem esperando aprovação.
alter table feedbacks add column if not exists approved boolean not null default true;
alter table feedbacks alter column approved set default false;
drop policy if exists "todos veem avaliações" on feedbacks;
drop policy if exists "todos veem avaliações aprovadas" on feedbacks;
create policy "todos veem avaliações aprovadas" on feedbacks for select
  using (approved or is_owner() or author_id = auth.uid());
drop policy if exists "cliente publica avaliação" on feedbacks;
-- Só quem entrou com o WhatsApp (current_phone) avalia, curte e comenta; quem só visita apenas vê.
create policy "cliente publica avaliação" on feedbacks for insert
  with check (current_phone() is not null and author_id = auth.uid() and approved = false and data ->> 'approved' = 'false');
drop policy if exists "profissional publica avaliação" on feedbacks;
create policy "profissional publica avaliação" on feedbacks for insert with check (is_owner());
drop policy if exists "profissional aprova avaliação" on feedbacks;
create policy "profissional aprova avaliação" on feedbacks for update using (is_owner()) with check (is_owner());
drop policy if exists "profissional remove avaliação" on feedbacks;
create policy "profissional remove avaliação" on feedbacks for delete using (is_owner());

drop policy if exists "todos veem publicações" on posts;
create policy "todos veem publicações" on posts for select using (true);
drop policy if exists "profissional: publicações" on posts;
create policy "profissional: publicações" on posts for all using (is_owner()) with check (is_owner());

drop policy if exists "todos veem curtidas" on likes;
create policy "todos veem curtidas" on likes for select using (true);
drop policy if exists "curte em nome próprio" on likes;
create policy "curte em nome próprio" on likes for insert
  with check (user_id = auth.uid() and (current_phone() is not null or is_owner()));
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

-- Cashback do Premium: extrato de créditos (+) e usos (−) de cada cliente, pelo WhatsApp dela.
-- Só a profissional grava (ao concluir o atendimento); a cliente só lê o próprio extrato.
create table if not exists cashback (
  id text primary key,
  client_phone text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists cashback_client_phone on cashback (client_phone);
alter table cashback enable row level security;
drop policy if exists "profissional: cashback" on cashback;
create policy "profissional: cashback" on cashback for all using (is_owner()) with check (is_owner());
drop policy if exists "cliente vê o próprio cashback" on cashback;
create policy "cliente vê o próprio cashback" on cashback for select using (client_phone = current_phone());

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
  with check (current_phone() is not null and author_id = auth.uid() and approved = false and data ->> 'approved' = 'false');
drop policy if exists "profissional comenta" on comments;
create policy "profissional comenta" on comments for insert with check (is_owner());
drop policy if exists "profissional aprova comentário" on comments;
create policy "profissional aprova comentário" on comments for update using (is_owner()) with check (is_owner());
drop policy if exists "profissional ou autora apaga comentário" on comments;
create policy "profissional ou autora apaga comentário" on comments for delete using (is_owner() or author_id = auth.uid());

-- Aviso de cancelamento no celular da profissional: quando a cliente cancela pelo app, o banco anota
-- (client_cancelled_at) e a função "lembretes" manda a notificação para os celulares da profissional
-- que ativaram os avisos (push_subscriptions com phone = 'profissional').
alter table appointments add column if not exists client_cancelled_at timestamptz;
alter table appointments add column if not exists cancel_notified_at timestamptz;

create or replace function mark_client_cancel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelado' and old.status is distinct from 'cancelado' and not is_owner() then
    new.client_cancelled_at := now();
  end if;
  return new;
end;
$$;
create or replace trigger appointments_client_cancel before update on appointments
  for each row execute function mark_client_cancel();

-- A profissional ativa os avisos no celular dela.
drop policy if exists "profissional ativa avisos" on push_subscriptions;
create policy "profissional ativa avisos" on push_subscriptions for insert
  with check (is_owner() and user_id = auth.uid() and phone = 'profissional');

-- Cancelamentos das últimas 24 horas ainda sem aviso, com os celulares da profissional. Só para a função de envio.
create or replace function due_cancel_notices()
returns table (appointment_id text, data jsonb, endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = public as $$
  select a.id, a.data, s.endpoint, s.p256dh, s.auth
  from appointments a
  cross join push_subscriptions s
  where s.phone = 'profissional'
    and a.client_cancelled_at is not null
    and a.cancel_notified_at is null
    and a.client_cancelled_at > now() - interval '1 day';
$$;

create or replace function mark_cancel_notified(ids text[]) returns void
language sql security definer set search_path = public as $$
  update appointments set cancel_notified_at = now() where id = any(ids);
$$;

revoke execute on function due_cancel_notices() from public, anon, authenticated;
revoke execute on function mark_cancel_notified(text[]) from public, anon, authenticated;
grant execute on function due_cancel_notices(), mark_cancel_notified(text[]) to service_role;

-- Pedidos de cancelamento: a cliente não cancela sozinha; ela pede e a profissional decide.
create table if not exists cancel_requests (
  id text primary key,
  appointment_id text not null references appointments (id) on delete cascade,
  client_phone text not null default current_phone(),
  status text not null default 'aberto' check (status in ('aberto', 'resolvido')),
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists cancel_requests_appointment on cancel_requests (appointment_id);
alter table cancel_requests enable row level security;
drop policy if exists "profissional: pedidos de cancelamento" on cancel_requests;
create policy "profissional: pedidos de cancelamento" on cancel_requests for all using (is_owner()) with check (is_owner());
drop policy if exists "cliente pede cancelamento do próprio horário" on cancel_requests;
create policy "cliente pede cancelamento do próprio horário" on cancel_requests for insert
  with check (
    client_phone = current_phone() and status = 'aberto'
    and exists (select 1 from appointments a where a.id = appointment_id and a.client_phone = current_phone()
                and a.status in ('agendado', 'confirmado'))
  );
drop policy if exists "cliente vê os próprios pedidos" on cancel_requests;
create policy "cliente vê os próprios pedidos" on cancel_requests for select using (client_phone = current_phone());

-- Avisos para a profissional (pedido de horário, remarcação e pedido de cancelamento). Só o servidor lê:
-- a função "lembretes" manda cada aviso como notificação para os celulares da profissional.
create table if not exists owner_notices (
  id bigserial primary key,
  kind text not null check (kind in ('agendamento', 'remarcacao', 'cancelamento')),
  appointment_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  notified_at timestamptz
);
alter table owner_notices enable row level security;

create or replace function notice_from_appointment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if is_owner() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    insert into owner_notices (kind, appointment_id, data) values ('agendamento', new.id, new.data);
  elsif new.starts_at is distinct from old.starts_at then
    insert into owner_notices (kind, appointment_id, data) values ('remarcacao', new.id, new.data);
  end if;
  return new;
end;
$$;
create or replace trigger appointments_owner_notice after insert or update on appointments
  for each row execute function notice_from_appointment();

create or replace function notice_from_cancel_request() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into owner_notices (kind, appointment_id, data)
    select 'cancelamento', a.id, a.data from appointments a where a.id = new.appointment_id;
  return new;
end;
$$;
create or replace trigger cancel_requests_owner_notice after insert on cancel_requests
  for each row execute function notice_from_cancel_request();

-- Avisos das últimas 24 horas ainda não enviados, com os celulares da profissional. Só para a função de envio.
create or replace function due_owner_notices()
returns table (notice_id bigint, kind text, appointment_id text, data jsonb, endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = public as $$
  select n.id, n.kind, n.appointment_id, n.data, s.endpoint, s.p256dh, s.auth
  from owner_notices n
  cross join push_subscriptions s
  where s.phone = 'profissional' and n.notified_at is null and n.created_at > now() - interval '1 day';
$$;

create or replace function mark_owner_notified(ids bigint[]) returns void
language sql security definer set search_path = public as $$
  update owner_notices set notified_at = now() where id = any(ids);
$$;

revoke execute on function due_owner_notices() from public, anon, authenticated;
revoke execute on function mark_owner_notified(bigint[]) from public, anon, authenticated;
grant execute on function due_owner_notices(), mark_owner_notified(bigint[]) to service_role;

-- Jogo valendo prêmio (Esmalte Express). Só acrescenta tabelas e funções: não mexe em nada do que já existe.
-- A profissional cria o jogo (rascunho), testa sem pontuar, publica com datas e prêmio; as clientes jogam
-- enquanto o jogo está ativo e o ranking mostra só o nome curto e os pontos (nunca o telefone).
create table if not exists game_campaigns (
  id text primary key,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'encerrado')),
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  data jsonb not null,                -- título, prêmio etc.
  published_at timestamptz,
  announced_at timestamptz,           -- quando a notificação da promoção foi enviada
  updated_at timestamptz not null default now()
);
alter table game_campaigns enable row level security;
drop policy if exists "todos veem jogos publicados" on game_campaigns;
create policy "todos veem jogos publicados" on game_campaigns for select using (status in ('publicado', 'encerrado'));
drop policy if exists "profissional: jogos" on game_campaigns;
create policy "profissional: jogos" on game_campaigns for all using (is_owner()) with check (is_owner());

-- Ao publicar, marca a data e deixa a notificação para a função de envio mandar.
create or replace function game_campaign_publish() returns trigger
language plpgsql as $$
begin
  if new.status = 'publicado' and (tg_op = 'INSERT' or old.status is distinct from 'publicado') then
    new.published_at := now();
    new.announced_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists game_campaigns_publish on game_campaigns;
create trigger game_campaigns_publish before insert or update on game_campaigns
  for each row execute function game_campaign_publish();

-- Jogo aberto para pontuar hoje (no fuso do studio).
create or replace function game_is_open(p_campaign text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from game_campaigns c
    where c.id = p_campaign and c.status = 'publicado'
      and (now() at time zone 'America/Sao_Paulo')::date between c.starts_on and c.ends_on
  );
$$;

-- Melhor pontuação de cada cliente em cada jogo (uma linha por número de WhatsApp).
create table if not exists game_scores (
  id text primary key,                -- <jogo>:<telefone>
  campaign_id text not null references game_campaigns (id) on delete cascade,
  phone text not null default current_phone(),
  user_id uuid not null default auth.uid(),
  best int not null check (best >= 0 and best <= 100000),
  data jsonb not null,                -- nome curto mostrado no ranking, partidas
  updated_at timestamptz not null default now(),
  unique (campaign_id, phone)
);
alter table game_scores enable row level security;
drop policy if exists "profissional: pontuações" on game_scores;
create policy "profissional: pontuações" on game_scores for all using (is_owner()) with check (is_owner());
drop policy if exists "cliente vê a própria pontuação" on game_scores;
create policy "cliente vê a própria pontuação" on game_scores for select using (phone = current_phone());
drop policy if exists "cliente pontua no jogo aberto" on game_scores;
create policy "cliente pontua no jogo aberto" on game_scores for insert
  with check (phone = current_phone() and user_id = auth.uid() and game_is_open(campaign_id));
drop policy if exists "cliente melhora a própria pontuação" on game_scores;
create policy "cliente melhora a própria pontuação" on game_scores for update
  using (phone = current_phone())
  with check (phone = current_phone() and user_id = auth.uid() and game_is_open(campaign_id));

create or replace function game_scores_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists game_scores_touch on game_scores;
create trigger game_scores_touch before insert or update on game_scores
  for each row execute function game_scores_touch();

-- Ranking público de um jogo: as 5 primeiras e a posição de quem está vendo, sem telefone.
create or replace function game_ranking(p_campaign text)
returns table (pos int, name text, best int, mine boolean)
language sql stable security definer set search_path = public as $$
  with visible as (
    select 1 from game_campaigns c
    where c.id = p_campaign and (c.status in ('publicado', 'encerrado') or is_owner())
  ), ranked as (
    select (row_number() over (order by s.best desc, s.updated_at asc))::int as pos,
      coalesce(nullif(s.data ->> 'name', ''), 'Cliente') as name, s.best,
      (current_phone() is not null and s.phone = current_phone()) as mine
    from game_scores s
    where s.campaign_id = p_campaign and exists (select 1 from visible)
  )
  select pos, name, best, mine from ranked where pos <= 5 or mine order by pos;
$$;
grant execute on function game_ranking(text) to anon, authenticated;
grant execute on function game_is_open(text) to anon, authenticated;

-- Notificação da promoção para as clientes com lembretes ativos: quando o jogo publicado começa.
-- Só para a função de envio.
create or replace function due_game_announcements(tz text default 'America/Sao_Paulo')
returns table (campaign_id text, data jsonb, ends_on date, endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = public as $$
  select c.id, c.data, c.ends_on, s.endpoint, s.p256dh, s.auth
  from game_campaigns c
  cross join push_subscriptions s
  where c.status = 'publicado' and c.announced_at is null
    and (now() at time zone tz)::date between c.starts_on and c.ends_on
    and s.phone is not null and s.phone <> 'profissional';
$$;

create or replace function mark_game_announced(ids text[]) returns void
language sql security definer set search_path = public as $$
  update game_campaigns set announced_at = now() where id = any(ids);
$$;

revoke execute on function due_game_announcements(text) from public, anon, authenticated;
revoke execute on function mark_game_announced(text[]) from public, anon, authenticated;
grant execute on function due_game_announcements(text), mark_game_announced(text[]) to service_role;

-- Atualizações em tempo real nas telas abertas.
do $$
declare t text;
begin
  foreach t in array array['clients', 'appointments', 'transactions', 'feedbacks', 'settings', 'posts', 'likes', 'cashback', 'comments', 'cancel_requests', 'game_campaigns'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
