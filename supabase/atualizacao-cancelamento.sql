-- Atualização do banco: aviso de cancelamento no celular da profissional.
-- Cole no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez; não apaga nada.
-- (Tudo isto também está no schema.sql completo; o aviso imediato fica em lembretes.sql.)

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
