-- Atualização do banco: só a profissional cancela horários (a cliente pede pelo WhatsApp).
-- Cole no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez; não apaga nada.
alter policy "cliente remarca ou cancela" on appointments
  with check (client_phone = current_phone() and status = 'agendado');
