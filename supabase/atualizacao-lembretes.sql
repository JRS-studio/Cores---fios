-- Atualização do banco para os lembretes 1 hora antes (notificação no celular da cliente).
-- Cole no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez; não apaga nada.
-- (Tudo isto também está no schema.sql completo.)

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
