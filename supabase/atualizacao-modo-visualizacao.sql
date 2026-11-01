-- Atualização do banco: quem não entrou só vê (não curte, não comenta e não avalia).
-- Cole no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez; não apaga nada.
alter policy "cliente publica avaliação" on feedbacks
  with check (current_phone() is not null and author_id = auth.uid() and approved = false and data ->> 'approved' = 'false');
alter policy "curte em nome próprio" on likes
  with check (user_id = auth.uid() and (current_phone() is not null or is_owner()));
alter policy "quem entrou comenta" on comments
  with check (current_phone() is not null and author_id = auth.uid() and approved = false and data ->> 'approved' = 'false');
