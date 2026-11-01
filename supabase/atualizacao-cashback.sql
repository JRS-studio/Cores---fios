-- Atualização do banco para o cashback do Premium (troca o cartão de selos).
-- Cole no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez; não apaga nada.
-- (Tudo isto também está no schema.sql completo.)

-- Cashback do Premium: extrato de créditos (+) e usos (−) de cada cliente, pelo WhatsApp dela.
-- Só a profissional grava (ao concluir o atendimento); a cliente só lê o próprio extrato.
create table if not exists cashback (
  id text primary key,
  client_phone text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists cashback_client_phone on cashback (client_phone);
alter table cashback enable row level security;
drop policy if exists "profissional: cashback" on cashback;
create policy "profissional: cashback" on cashback for all using (is_owner()) with check (is_owner());
drop policy if exists "cliente vê o próprio cashback" on cashback;
create policy "cliente vê o próprio cashback" on cashback for select using (client_phone = current_phone());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'cashback') then
    alter publication supabase_realtime add table cashback;
  end if;
end $$;
