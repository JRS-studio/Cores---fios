-- Agenda a função "lembretes" para rodar a cada 5 minutos (depois de criar a função no Supabase).
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
