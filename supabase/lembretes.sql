-- Agenda a função "lembretes" para rodar a cada 5 minutos e chama na hora quando uma cliente cancela (depois de criar a função no Supabase).
-- O endereço abaixo é o do projeto do Cores & Fios. Em outro projeto, troque tnnlwaloowsxormyxtss pelo código
-- dele (o que aparece em https://CODIGO.supabase.co).
-- Pode rodar de novo sem problema.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'lembretes';
select cron.schedule(
  'lembretes',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://tnnlwaloowsxormyxtss.supabase.co/functions/v1/lembretes',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb
     ) $$
);

-- Aviso de cancelamento na hora: quando a cliente cancela, o banco chama a função na mesma hora
-- (sem esperar os 5 minutos do agendador, que continua como reserva).
create or replace function poke_cancel_notice() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.client_cancelled_at is not null and old.client_cancelled_at is null then
    perform net.http_post(
      url := 'https://tnnlwaloowsxormyxtss.supabase.co/functions/v1/lembretes',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  end if;
  return new;
end;
$$;
create or replace trigger appointments_poke_cancel_notice after update on appointments
  for each row execute function poke_cancel_notice();

-- Avisos para a profissional na hora (pedido de horário, remarcação, pedido de cancelamento).
create or replace function poke_owner_notice() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://tnnlwaloowsxormyxtss.supabase.co/functions/v1/lembretes',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  return new;
end;
$$;
create or replace trigger owner_notices_poke after insert on owner_notices
  for each row execute function poke_owner_notice();
