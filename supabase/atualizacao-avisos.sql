-- Atualização do banco: avisos para a profissional (pedidos de horário, remarcação e cancelamento).
-- Cole no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez; não apaga nada.
-- (Tudo isto também está no schema.sql completo; o envio na hora fica em lembretes.sql.)

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

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'cancel_requests') then
    alter publication supabase_realtime add table cancel_requests;
  end if;
end $$;
