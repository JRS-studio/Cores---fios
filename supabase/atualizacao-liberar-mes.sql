-- Atualização do banco: o mês seguinte só abre para as clientes depois que a profissional libera.
-- Cole no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez; não apaga nada.
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

alter policy "cliente marca horário" on appointments
  with check (client_phone = current_phone() and status = 'agendado' and client_month_open(starts_at));
alter policy "cliente remarca ou cancela" on appointments
  with check (client_phone = current_phone() and status = 'agendado' and client_month_open(starts_at));
