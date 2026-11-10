-- Atualização do banco para o jogo valendo prêmio (Esmalte Express).
-- Só cria tabelas e funções novas: não altera nem apaga nenhum dado existente (clientes, horários, financeiro…).
-- Pode rodar mais de uma vez. (Tudo isto também está no schema.sql completo.)

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

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'game_campaigns') then
    alter publication supabase_realtime add table game_campaigns;
  end if;
end $$;
