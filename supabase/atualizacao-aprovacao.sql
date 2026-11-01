-- Atualização do banco: avaliações só aparecem no feed depois de aprovadas pela profissional.
-- Cole no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez; não apaga nada.
-- (Tudo isto também está no schema.sql completo.)

-- Avaliações só aparecem para todas depois que a profissional aprova.
-- As que já existiam ao criar a coluna continuam no ar; as novas nascem esperando aprovação.
alter table feedbacks add column if not exists approved boolean not null default true;
alter table feedbacks alter column approved set default false;
drop policy if exists "todos veem avaliações" on feedbacks;
drop policy if exists "todos veem avaliações aprovadas" on feedbacks;
create policy "todos veem avaliações aprovadas" on feedbacks for select
  using (approved or is_owner() or author_id = auth.uid());
drop policy if exists "cliente publica avaliação" on feedbacks;
create policy "cliente publica avaliação" on feedbacks for insert
  with check (auth.uid() is not null and author_id = auth.uid() and approved = false and data ->> 'approved' = 'false');
drop policy if exists "profissional publica avaliação" on feedbacks;
create policy "profissional publica avaliação" on feedbacks for insert with check (is_owner());
drop policy if exists "profissional aprova avaliação" on feedbacks;
create policy "profissional aprova avaliação" on feedbacks for update using (is_owner()) with check (is_owner());
