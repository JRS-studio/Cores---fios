-- Atualização do banco: a cliente agenda e remarca até o fim do mês seguinte (a agenda do próximo mês abre no dia 1º).
-- Cole no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez; não apaga nada.
alter policy "cliente marca horário" on appointments
  with check (client_phone = current_phone() and status = 'agendado' and starts_at < date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '2 months');
alter policy "cliente remarca ou cancela" on appointments
  with check (client_phone = current_phone() and status = 'agendado' and starts_at < date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '2 months');
