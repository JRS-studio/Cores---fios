// Testa o esquema e as regras de acesso (RLS) num Postgres local (PGlite), simulando o Supabase.
// Uso: node supabase/test/rls.test.mjs
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const db = new PGlite();
const OWNER = '00000000-0000-0000-0000-000000000001';
const CLIENT = '00000000-0000-0000-0000-000000000002';
const OTHER = '00000000-0000-0000-0000-000000000003';
const DEVICE_A = '00000000-0000-0000-0000-0000000000d1';
const DEVICE_B = '00000000-0000-0000-0000-0000000000d2';

// O que o Supabase já traz pronto: esquema auth, storage, papéis e publicação do realtime.
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id serial primary key, bucket_id text, name text);
  alter table storage.objects enable row level security;
  create publication supabase_realtime;
  grant usage on schema public, auth, storage to anon, authenticated;
  grant execute on all functions in schema auth to anon, authenticated;
`);
const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
await db.exec(schema);
// Rodar de novo não pode dar erro (a pessoa pode clicar em Run mais de uma vez).
await db.exec(schema);
await db.exec(`
  grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
  grant usage on schema public to service_role;
  grant select, insert, delete on storage.objects to anon, authenticated;
  grant usage on all sequences in schema storage to anon, authenticated;
  insert into auth.users values ('${OWNER}'), ('${CLIENT}'), ('${OTHER}'), ('${DEVICE_A}'), ('${DEVICE_B}');
  insert into professionals values ('${OWNER}');
`);

// Executa SQL como uma pessoa: profissional, cliente (telefone) ou visitante (anon).
async function as(who, sql, params = []) {
  const claims = who === 'anon' || who === 'service' ? {} : who;
  const role = who === 'anon' ? 'anon' : who === 'service' ? 'service_role' : 'authenticated';
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    await tx.exec(`set local role ${role}`);
    return tx.query(sql, params);
  });
}
const owner = { sub: OWNER };
const ana = { sub: CLIENT, phone: '5511987654321' };
const bia = { sub: OTHER, phone: '5521999998888' };
const rows = async (who, sql, p) => (await as(who, sql, p)).rows;
const fails = async (who, sql, p) => {
  try {
    await as(who, sql, p);
  } catch {
    return true;
  }
  return false;
};
const appt = (id, phone, start, end, status = 'agendado') =>
  [`insert into appointments (id, client_phone, status, starts_at, ends_at, data) values ($1, $2, $3, $4, $5, '{}')`,
    [id, phone, status, start, end]];

let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed += 1;
  console.log('ok  ', name);
};

await test('profissional cadastra clientes e vê todas', async () => {
  await as(owner, `insert into clients (id, phone, data) values ('c1', '5511987654321', '{}'), ('c2', '5521999998888', '{}')`);
  assert.equal((await rows(owner, 'select * from clients')).length, 2);
});
await test('cliente vê só o próprio cadastro', async () => {
  const r = await rows(ana, 'select id from clients');
  assert.deepEqual(r.map((x) => x.id), ['c1']);
});
await test('cliente não cria cadastro com o telefone de outra', async () => {
  assert.ok(await fails(ana, `insert into clients (id, phone, data) values ('x', '5531900000000', '{}')`));
});
await test('visitante não vê clientes', async () => {
  assert.equal((await rows('anon', 'select * from clients')).length, 0);
});
await test('cliente marca horário livre para si', async () => {
  await as(ana, ...appt('a1', '5511987654321', '2026-11-03 10:00', '2026-11-03 11:00'));
});
await test('cliente não marca horário em nome de outra', async () => {
  assert.ok(await fails(ana, ...appt('a2', '5521999998888', '2026-11-03 14:00', '2026-11-03 15:00')));
});
await test('cliente não marca já como concluído', async () => {
  assert.ok(await fails(ana, ...appt('a3', '5511987654321', '2026-11-03 16:00', '2026-11-03 17:00', 'concluido')));
});
await test('banco recusa horário sobreposto, de qualquer pessoa', async () => {
  assert.ok(await fails(bia, ...appt('a4', '5521999998888', '2026-11-03 10:30', '2026-11-03 11:30')));
  assert.ok(await fails(owner, ...appt('a5', '5521999998888', '2026-11-03 10:59', '2026-11-03 11:30')));
});
await test('horário encostado no anterior é aceito', async () => {
  await as(bia, ...appt('a6', '5521999998888', '2026-11-03 11:00', '2026-11-03 12:00'));
});
await test('cliente vê só os próprios horários', async () => {
  assert.deepEqual((await rows(ana, 'select id from appointments')).map((x) => x.id), ['a1']);
  assert.equal((await rows('anon', 'select * from appointments')).length, 0);
});
await test('qualquer pessoa vê os horários ocupados, sem dados de quem marcou', async () => {
  const r = await rows('anon', `select * from busy_slots('2026-11-03')`);
  assert.equal(r.length, 2);
  assert.deepEqual(Object.keys(r[0]).sort(), ['ends_at', 'starts_at']);
});
await test('só a profissional cancela: a cliente não consegue; depois do cancelamento o espaço fica livre', async () => {
  assert.ok(await fails(ana, `update appointments set status = 'cancelado' where id = 'a1'`));
  assert.equal((await rows(owner, `select status from appointments where id = 'a1'`))[0].status, 'agendado');
  await as(owner, `update appointments set status = 'cancelado' where id = 'a1'`);
  await as(bia, ...appt('a7', '5521999998888', '2026-11-03 10:00', '2026-11-03 11:00'));
});
await test('cliente não conclui nem cancela horário de outra', async () => {
  await as(ana, ...appt('a8', '5511987654321', '2026-11-04 10:00', '2026-11-04 11:00'));
  assert.ok(await fails(ana, `update appointments set status = 'concluido' where id = 'a8'`));
  await as(ana, `update appointments set status = 'agendado' where id = 'a1'`);
  assert.equal((await rows(owner, `select status from appointments where id = 'a1'`))[0].status, 'cancelado');
  await as(ana, `update appointments set status = 'cancelado' where id = 'a7'`);
  assert.equal((await rows(owner, `select status from appointments where id = 'a7'`))[0].status, 'agendado');
});
await test('financeiro: só a profissional', async () => {
  await as(owner, `insert into transactions (id, data) values ('t1', '{"amount":70}')`);
  assert.equal((await rows(ana, 'select * from transactions')).length, 0);
  assert.ok(await fails(ana, `insert into transactions (id, data) values ('t2', '{}')`));
});
await test('avaliações: quem entrou envia, só aparece para todas depois de aprovada, só a profissional remove', async () => {
  await as(ana, `insert into feedbacks (id, data) values ('f1', '{"rating":5,"approved":false}')`);
  assert.ok(await fails('anon', `insert into feedbacks (id, data) values ('f2', '{}')`));
  // Esperando aprovação: só a autora e a profissional veem.
  assert.equal((await rows('anon', 'select * from feedbacks')).length, 0);
  assert.equal((await rows(bia, 'select * from feedbacks')).length, 0);
  assert.equal((await rows(ana, 'select * from feedbacks')).length, 1);
  assert.equal((await rows(owner, 'select * from feedbacks')).length, 1);
  // A cliente não se aprova sozinha (nem pela coluna, nem pelo registro).
  assert.ok(await fails(ana, `insert into feedbacks (id, approved, data) values ('f3', true, '{"approved":true}')`));
  assert.ok(await fails(ana, `insert into feedbacks (id, data) values ('f4', '{"rating":5}')`));
  await as(ana, `update feedbacks set approved = true where id = 'f1'`);
  assert.equal((await rows('anon', 'select * from feedbacks')).length, 0);
  // A profissional aprova: aparece para todas.
  await as(owner, `update feedbacks set approved = true, data = '{"rating":5,"approved":true}' where id = 'f1'`);
  assert.equal((await rows('anon', 'select * from feedbacks')).length, 1);
  await as(bia, `delete from feedbacks where id = 'f1'`);
  assert.equal((await rows('anon', 'select * from feedbacks')).length, 1);
  await as(owner, `delete from feedbacks where id = 'f1'`);
  assert.equal((await rows('anon', 'select * from feedbacks')).length, 0);
});
await test('ajustes: todos leem, só a profissional altera', async () => {
  await as(owner, `insert into settings (id, data) values (1, '{"studioName":"Studio"}')`);
  assert.equal((await rows('anon', 'select * from settings')).length, 1);
  await as(ana, `update settings set data = '{}' where id = 1`);
  assert.equal((await rows(owner, 'select data from settings'))[0].data.studioName, 'Studio');
});
await test('cliente pode apagar o próprio cadastro (LGPD)', async () => {
  await as(ana, `delete from clients where id = 'c1'`);
  assert.equal((await rows(owner, `select * from clients where id = 'c1'`)).length, 0);
});
await test('is_owner identifica a profissional', async () => {
  assert.equal((await rows(owner, 'select is_owner() as v'))[0].v, true);
  assert.equal((await rows(ana, 'select is_owner() as v'))[0].v, false);
});

// O app grava com upsert (INSERT ... ON CONFLICT DO UPDATE), como a biblioteca do Supabase envia.
const upsert = (table, cols, values) =>
  [`insert into ${table} (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})
    on conflict (id) do update set ${cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ')}`, values];

await test('upsert: cliente publica avaliação nova', async () => {
  await as(ana, ...upsert('feedbacks', ['id', 'approved', 'data'], ['f9', false, '{"rating":4,"approved":false}']));
  assert.equal((await rows(ana, `select * from feedbacks where id = 'f9'`)).length, 1);
  assert.equal((await rows('anon', `select * from feedbacks where id = 'f9'`)).length, 0);
});
await test('upsert: cliente não altera avaliação já publicada', async () => {
  assert.ok(await fails(ana, ...upsert('feedbacks', ['id', 'approved', 'data'], ['f9', false, '{"rating":1,"approved":false}'])));
});
await test('upsert: profissional aprova a avaliação e ela aparece para todas', async () => {
  await as(owner, ...upsert('feedbacks', ['id', 'approved', 'data'], ['f9', true, '{"rating":4,"approved":true}']));
  assert.equal((await rows('anon', `select * from feedbacks where id = 'f9'`)).length, 1);
});
await test('upsert: cliente cria e edita o próprio cadastro', async () => {
  await as(ana, ...upsert('clients', ['id', 'phone', 'data'], ['c9', '5511987654321', '{"name":"Ana"}']));
  await as(ana, ...upsert('clients', ['id', 'phone', 'data'], ['c9', '5511987654321', '{"name":"Ana Souza"}']));
  assert.equal((await rows(owner, `select data from clients where id = 'c9'`))[0].data.name, 'Ana Souza');
});
await test('upsert: cliente remarca o próprio horário para um espaço livre', async () => {
  const cols = ['id', 'client_phone', 'status', 'starts_at', 'ends_at', 'data'];
  await as(ana, ...upsert('appointments', cols, ['a20', '5511987654321', 'agendado', '2026-11-05 09:00', '2026-11-05 10:00', '{}']));
  await as(ana, ...upsert('appointments', cols, ['a20', '5511987654321', 'agendado', '2026-11-05 15:00', '2026-11-05 16:00', '{}']));
  assert.equal((await rows(owner, `select starts_at::text as s from appointments where id = 'a20'`))[0].s, '2026-11-05 15:00:00');
});
await test('upsert: profissional confirma e conclui', async () => {
  const cols = ['id', 'client_phone', 'status', 'starts_at', 'ends_at', 'data'];
  await as(owner, ...upsert('appointments', cols, ['a20', '5511987654321', 'concluido', '2026-11-05 15:00', '2026-11-05 16:00', '{}']));
  assert.equal((await rows(ana, `select status from appointments where id = 'a20'`))[0].status, 'concluido');
});

// Entrada sem código: login anônimo + número preso ao aparelho.
const deviceA = { sub: DEVICE_A, is_anonymous: true };
const deviceB = { sub: DEVICE_B, is_anonymous: true };

await test('sem código: cliente entra com o número e vê o próprio cadastro', async () => {
  await as(owner, `insert into clients (id, phone, data) values ('c30', '5511911112222', '{}')`);
  await as(deviceA, `select claim_phone('5511911112222')`);
  assert.deepEqual((await rows(deviceA, 'select id from clients')).map((x) => x.id), ['c30']);
});
await test('sem código: outro aparelho não consegue usar o mesmo número', async () => {
  assert.ok(await fails(deviceB, `select claim_phone('5511911112222')`));
  assert.equal((await rows(deviceB, 'select * from clients')).length, 0);
});
await test('sem código: número inválido e visitante sem login são recusados', async () => {
  assert.ok(await fails(deviceB, `select claim_phone('123')`));
  assert.ok(await fails('anon', `select claim_phone('5511933334444')`));
});
await test('sem código: cliente marca horário pelo número preso ao aparelho', async () => {
  await as(deviceA, ...appt('a30', '5511911112222', '2026-11-06 10:00', '2026-11-06 11:00'));
  assert.ok(await fails(deviceA, ...appt('a31', '5521999998888', '2026-11-06 14:00', '2026-11-06 15:00')));
});
await test('sem código: ao sair, o número fica livre para outro aparelho', async () => {
  await as(deviceA, 'select release_my_phone()');
  assert.equal((await rows(deviceA, 'select * from clients')).length, 0);
  await as(deviceB, `select claim_phone('5511911112222')`);
  assert.equal((await rows(deviceB, 'select id from clients'))[0].id, 'c30');
});
await test('sem código: profissional libera o número para um aparelho novo', async () => {
  assert.ok(await fails(deviceA, `select claim_phone('5511911112222')`));
  await as(owner, `delete from phone_claims where phone = '5511911112222'`);
  await as(deviceA, `select claim_phone('5511911112222')`);
});
await test('sem código: cliente não vê nem apaga o número de outra', async () => {
  assert.equal((await rows(deviceB, 'select * from phone_claims')).length, 0);
  await as(deviceB, `delete from phone_claims where phone = '5511911112222'`);
  assert.equal((await rows(owner, `select * from phone_claims where phone = '5511911112222'`)).length, 1);
});

await test('publicações: só a profissional publica, apaga e edita; todas veem', async () => {
  await as(owner, `insert into posts (id, data) values ('p1', '{"caption":"Novidade"}')`);
  assert.ok(await fails(ana, `insert into posts (id, data) values ('p2', '{}')`));
  assert.ok(await fails('anon', `insert into posts (id, data) values ('p3', '{}')`));
  await as(ana, `update posts set data = '{"caption":"x"}' where id = 'p1'`);
  await as(ana, `delete from posts where id = 'p1'`);
  assert.equal((await rows('anon', 'select data from posts'))[0].data.caption, 'Novidade');
  assert.equal((await rows(ana, 'select id from posts')).length, 1);
});
const like = (id, item, userId) => [
  `insert into likes (id, item_id, data) values ($1, $2, $3) on conflict (id) do update set data = excluded.data`,
  [id, item, JSON.stringify({ id, itemId: item, userId })],
];
await test('curtidas: cada pessoa curte em nome próprio, uma vez por item', async () => {
  await as(ana, ...like(`p1:${CLIENT}`, 'p1', CLIENT));
  await as(ana, ...like(`p1:${CLIENT}`, 'p1', CLIENT)); // de novo (upsert do app) não duplica
  await as(bia, ...like(`p1:${OTHER}`, 'p1', OTHER));
  // Quem só visita (login anônimo sem WhatsApp) não curte: modo visualização.
  const VISITOR = '00000000-0000-0000-0000-0000000000e1';
  await db.exec(`insert into auth.users values ('${VISITOR}') on conflict do nothing`);
  assert.ok(await fails({ sub: VISITOR }, ...like(`p1:${VISITOR}`, 'p1', VISITOR)));
  assert.ok(await fails('anon', ...like('p1:anon', 'p1', null)));
  // Não dá para curtir duas vezes o mesmo item com outro id.
  assert.ok(await fails(ana, ...like('p1:outro', 'p1', CLIENT)));
  // Não dá para curtir em nome de outra pessoa.
  assert.ok(await fails(ana, `insert into likes (id, item_id, user_id, data) values ('p1:x', 'p1', '${OTHER}', '{}')`));
  const all = await rows('anon', `select user_id from likes where item_id = 'p1'`);
  assert.equal(all.length, 2);
});
await test('curtidas: só a dona descurte', async () => {
  await as(bia, `delete from likes where id = 'p1:${CLIENT}'`);
  await as(owner, `delete from likes where id = 'p1:${CLIENT}'`);
  assert.equal((await rows('anon', `select * from likes where id = 'p1:${CLIENT}'`)).length, 1);
  await as(ana, `delete from likes where id = 'p1:${CLIENT}'`);
  assert.equal((await rows('anon', `select * from likes where item_id = 'p1'`)).length, 1);
});

const sub = (endpoint) => [`insert into push_subscriptions (endpoint, p256dh, auth) values ($1, 'k', 'a')`, [endpoint]];
await test('lembretes: cliente ativa no próprio número; outra não vê; visitante não ativa', async () => {
  await as(ana, ...sub('https://push.example/ana'));
  const mine = await rows(ana, 'select phone from push_subscriptions');
  assert.equal(mine.length, 1);
  assert.equal(mine[0].phone, '5511987654321');
  assert.equal((await rows(bia, 'select * from push_subscriptions')).length, 0);
  assert.ok(await fails('anon', ...sub('https://push.example/anon')));
  // Login anônimo sem número preso ao aparelho não ativa lembrete.
  assert.ok(await fails({ sub: OWNER }, `insert into push_subscriptions (endpoint, p256dh, auth, phone) values ('x', 'k', 'a', '5511987654321')`));
  await as(bia, `delete from push_subscriptions where endpoint = 'https://push.example/ana'`);
  assert.equal((await rows(ana, 'select * from push_subscriptions')).length, 1);
});
await test('lembretes: só o servidor lista os horários da próxima hora e marca como enviados', async () => {
  assert.ok(await fails(ana, `select * from due_reminders()`));
  assert.ok(await fails(ana, `select mark_reminded(array['x'])`));
  // Os outros testes usam datas fixas; tira o que cair nas próximas horas para o teste valer em qualquer dia.
  await as(owner, `delete from appointments where starts_at < (now() at time zone 'America/Sao_Paulo') + interval '5 hours'
    and ends_at > (now() at time zone 'America/Sao_Paulo') - interval '1 hour'`);
  await as(owner, `insert into appointments (id, client_phone, status, starts_at, ends_at, data) values
    ('lemb1', '5511987654321', 'confirmado', (now() at time zone 'America/Sao_Paulo') + interval '40 minutes', (now() at time zone 'America/Sao_Paulo') + interval '100 minutes', '{"serviceName":"Gel"}'),
    ('lemb2', '5511987654321', 'confirmado', (now() at time zone 'America/Sao_Paulo') + interval '3 hours', (now() at time zone 'America/Sao_Paulo') + interval '4 hours', '{}')`);
  const due = await rows('service', 'select appointment_id, endpoint from due_reminders()');
  assert.deepEqual(due.map((d) => d.appointment_id), ['lemb1']);
  assert.equal(due[0].endpoint, 'https://push.example/ana');
  await as('service', `select mark_reminded(array['lemb1'])`);
  assert.equal((await rows('service', 'select * from due_reminders()')).length, 0);
  // Remarcar para daqui a 30 minutos libera um novo lembrete.
  await as(owner, `update appointments set starts_at = starts_at - interval '10 minutes' where id = 'lemb1'`);
  assert.equal((await rows('service', 'select * from due_reminders()')).length, 1);
  // A atualização normal do app (sem mudar o horário) mantém o lembrete como enviado.
  await as('service', `select mark_reminded(array['lemb1'])`);
  await as(owner, `update appointments set data = '{"x":1}' where id = 'lemb1'`);
  assert.equal((await rows('service', 'select * from due_reminders()')).length, 0);
  assert.equal(await rows('anon', 'select vapid_public_key() as k').then((r) => r[0].k), null);
});

await test('cashback: só a profissional lança; cada cliente vê só o próprio extrato', async () => {
  await as(owner, `insert into cashback (id, client_phone, data) values ('cb1', '5511987654321', '{"amount": 1.5}'), ('cb2', '5521999998888', '{"amount": 2}')`);
  assert.equal((await rows(owner, 'select * from cashback')).length, 2);
  const mine = await rows(ana, 'select id from cashback');
  assert.deepEqual(mine.map((r) => r.id), ['cb1']);
  assert.equal((await rows('anon', 'select * from cashback')).length, 0);
  // A cliente não cria crédito para si, não altera nem apaga o extrato.
  assert.ok(await fails(ana, `insert into cashback (id, client_phone, data) values ('cb3', '5511987654321', '{"amount": 100}')`));
  await as(ana, `update cashback set data = '{"amount": 100}' where id = 'cb1'`);
  await as(ana, `delete from cashback where id = 'cb1'`);
  assert.deepEqual((await rows(owner, `select data from cashback where id = 'cb1'`))[0].data, { amount: 1.5 });
  assert.ok(await fails('anon', `insert into cashback (id, client_phone, data) values ('cb4', '5511987654321', '{}')`));
});

await test('comentários: quem entrou comenta, só aparece para todas depois de aprovado; autora ou profissional apaga', async () => {
  await as(owner, `insert into posts (id, data) values ('pc1', '{}')`);
  const visitor = { sub: DEVICE_A }; // login anônimo de quem só visita
  await as(visitor, `insert into comments (id, post_id, data) values ('cm1', 'pc1', '{"text":"Lindo!","approved":false}')`);
  assert.ok(await fails('anon', `insert into comments (id, post_id, data) values ('cm2', 'pc1', '{"approved":false}')`));
  assert.ok(await fails(ana, `insert into comments (id, post_id, approved, data) values ('cm3', 'pc1', true, '{"approved":true}')`));
  assert.ok(await fails(ana, `insert into comments (id, post_id, data) values ('cm4', 'pc1', '{"text":"x"}')`));
  // Esperando aprovação: só a autora e a profissional veem.
  assert.equal((await rows('anon', 'select * from comments')).length, 0);
  assert.equal((await rows(ana, 'select * from comments')).length, 0);
  assert.equal((await rows(visitor, 'select * from comments')).length, 1);
  assert.equal((await rows(owner, 'select * from comments')).length, 1);
  await as(visitor, `update comments set approved = true where id = 'cm1'`);
  assert.equal((await rows('anon', 'select * from comments')).length, 0);
  await as(owner, `update comments set approved = true, data = '{"text":"Lindo!","approved":true}' where id = 'cm1'`);
  assert.equal((await rows('anon', 'select * from comments')).length, 1);
  // Outra pessoa não apaga; a autora apaga o dela.
  await as(ana, `delete from comments where id = 'cm1'`);
  assert.equal((await rows('anon', 'select * from comments')).length, 1);
  await as(visitor, `delete from comments where id = 'cm1'`);
  assert.equal((await rows('anon', 'select * from comments')).length, 0);
  // A profissional comenta já aprovado, e apagar a publicação apaga os comentários.
  await as(owner, `insert into comments (id, post_id, approved, data) values ('cm5', 'pc1', true, '{"approved":true}')`);
  assert.equal((await rows('anon', 'select * from comments')).length, 1);
  await as(owner, `delete from posts where id = 'pc1'`);
  assert.equal((await rows(owner, 'select * from comments')).length, 0);
});

await test('cliente não cancela horário confirmado (pede pelo WhatsApp); a profissional cancela sem gerar aviso', async () => {
  await as(owner, `update settings set data = jsonb_set(data, '{releasedMonths}', '["2026-12"]') where id = 1`); // dezembro liberado pela profissional
  await as(owner, ...appt('cx1', '5511987654321', '2026-12-01 10:00', '2026-12-01 11:00', 'confirmado'));
  assert.ok(await fails(ana, `update appointments set status = 'cancelado' where id = 'cx1'`));
  // Remarcar continua liberado (volta a "a confirmar").
  await as(ana, `update appointments set status = 'agendado', starts_at = '2026-12-01 14:00', ends_at = '2026-12-01 15:00' where id = 'cx1'`);
  assert.equal((await rows(owner, `select status from appointments where id = 'cx1'`))[0].status, 'agendado');
  await as(owner, `update appointments set status = 'cancelado' where id = 'cx1'`);
  const [c1] = await rows(owner, `select status, client_cancelled_at from appointments where id = 'cx1'`);
  assert.equal(c1.status, 'cancelado');
  assert.equal(c1.client_cancelled_at, null);
  assert.equal((await rows('anon', `select * from busy_slots('2026-12-01')`)).length, 0, 'o horário fica livre');
});

await test('modo visualização: quem não entrou com o WhatsApp não curte, não comenta e não avalia', async () => {
  const VISITOR = '00000000-0000-0000-0000-0000000000e2';
  await db.exec(`insert into auth.users values ('${VISITOR}') on conflict do nothing`);
  await as(owner, `insert into posts (id, data) values ('pv1', '{}') on conflict do nothing`);
  const v = { sub: VISITOR };
  assert.ok(await fails(v, `insert into likes (id, item_id, user_id, data) values ('pv1:v', 'pv1', '${VISITOR}', '{}')`));
  assert.ok(await fails(v, `insert into comments (id, post_id, data) values ('cv1', 'pv1', '{"approved":false}')`));
  assert.ok(await fails(v, `insert into feedbacks (id, data) values ('fv1', '{"rating":5,"approved":false}')`));
  // A cliente com WhatsApp continua podendo; a visitante só vê.
  await as(ana, `insert into comments (id, post_id, data) values ('cv2', 'pv1', '{"approved":false}')`);
  assert.equal((await rows(v, 'select * from posts where id = \'pv1\'')).length, 1);
});

await test('cliente avulsa sem WhatsApp: a profissional agenda e nenhuma cliente vê o horário', async () => {
  await as(owner, ...appt('sw1', '', '2026-12-10 10:00', '2026-12-10 11:00', 'confirmado'));
  assert.equal((await rows(owner, `select * from appointments where id = 'sw1'`)).length, 1);
  assert.equal((await rows(ana, `select * from appointments where id = 'sw1'`)).length, 0);
  assert.equal((await rows('anon', `select * from busy_slots('2026-12-10')`)).length, 1, 'o horário aparece como ocupado');
});

await test('avisos para a profissional: pedido de horário, remarcação e pedido de cancelamento', async () => {
  await as('service', 'delete from owner_notices');
  const notices = async () => (await rows('service', 'select kind, appointment_id from owner_notices order by id')).map((n) => `${n.kind}:${n.appointment_id}`);
  // A cliente pede um horário: aviso de agendamento. O que a profissional marca não gera aviso.
  await as(owner, `update settings set data = jsonb_set(data, '{releasedMonths}', '["2026-12"]') where id = 1`); // dezembro liberado pela profissional
  await as(ana, ...appt('av1', '5511987654321', '2026-12-15 10:00', '2026-12-15 11:00'));
  await as(owner, ...appt('av2', '5521999998888', '2026-12-15 14:00', '2026-12-15 15:00', 'confirmado'));
  // A cliente remarca: aviso de remarcação. A profissional confirmar não gera aviso.
  await as(ana, `update appointments set starts_at = '2026-12-15 12:00', ends_at = '2026-12-15 13:00' where id = 'av1'`);
  await as(owner, `update appointments set status = 'confirmado' where id = 'av1'`);
  // Pedido de cancelamento só do próprio horário, e só aberto.
  await as(ana, `insert into cancel_requests (id, appointment_id, data) values ('cr1', 'av1', '{}')`);
  assert.ok(await fails(ana, `insert into cancel_requests (id, appointment_id, data) values ('cr2', 'av2', '{}')`), 'horário de outra');
  assert.ok(await fails(ana, `insert into cancel_requests (id, appointment_id, status, data) values ('cr3', 'av1', 'resolvido', '{}')`));
  assert.ok(await fails('anon', `insert into cancel_requests (id, appointment_id, data) values ('cr4', 'av1', '{}')`));
  assert.deepEqual(await notices(), ['agendamento:av1', 'remarcacao:av1', 'cancelamento:av1']);
  // A cliente vê o próprio pedido; outra cliente não; a profissional vê e resolve.
  assert.equal((await rows(ana, 'select * from cancel_requests')).length, 1);
  assert.equal((await rows(bia, 'select * from cancel_requests')).length, 0);
  await as(owner, `update cancel_requests set status = 'resolvido' where id = 'cr1'`);
  assert.equal((await rows(ana, `select status from cancel_requests where id = 'cr1'`))[0].status, 'resolvido');
  await as(ana, `update cancel_requests set status = 'aberto' where id = 'cr1'`);
  assert.equal((await rows(owner, `select status from cancel_requests where id = 'cr1'`))[0].status, 'resolvido', 'cliente não reabre');
  // Os avisos só o servidor lê e envia, para os celulares da profissional.
  assert.equal((await rows(owner, 'select * from owner_notices')).length, 0);
  assert.ok(await fails(ana, 'select * from due_owner_notices()'));
  await db.exec(`insert into push_subscriptions (endpoint, p256dh, auth, user_id, phone) values ('https://push.example/pro2', 'k', 'a', '${OWNER}', 'profissional') on conflict do nothing`);
  const due = await rows('service', 'select notice_id, kind, endpoint from due_owner_notices()');
  assert.ok(due.length >= 3 && due.every((d) => d.endpoint.startsWith('https://push.example/pro')));
  await as('service', 'select mark_owner_notified($1)', [due.map((d) => d.notice_id)]);
  assert.equal((await rows('service', 'select * from due_owner_notices()')).length, 0);
});

await test('mês seguinte: fechado até a profissional liberar; a cliente nunca passa do fim dele; a profissional, sem limite', async () => {
  const [{ ok, fora }] = await rows('service', `select
    to_char(date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '2 months' - interval '1 day', 'YYYY-MM-DD') as ok,
    to_char(date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '2 months', 'YYYY-MM-DD') as fora`);
  // Sem a profissional liberar, o mês seguinte fica fechado para as clientes.
  await as(owner, `update settings set data = data - 'releasedMonths' where id = 1`);
  assert.ok(await fails(ana, ...appt('pm0', '5511987654321', `${ok} 09:00`, `${ok} 09:30`)), 'mês seguinte ainda não liberado');
  // A profissional libera o mês inteiro (um botão): a cliente agenda.
  await as(owner, `update settings set data = jsonb_set(data, '{releasedMonths}', to_jsonb(array[left('${ok}', 7)])) where id = 1`);
  await as(ana, ...appt('pm1', '5511987654321', `${ok} 10:00`, `${ok} 11:00`));
  // Só a profissional libera.
  await as(ana, `update settings set data = jsonb_set(data, '{releasedMonths}', '[]') where id = 1`);
  assert.equal((await rows(owner, `select data -> 'releasedMonths' as m from settings where id = 1`))[0].m.length, 1);
  assert.ok(await fails(ana, ...appt('pm2', '5511987654321', `${fora} 10:00`, `${fora} 11:00`)), 'mês depois do próximo');
  assert.ok(await fails(ana, `update appointments set starts_at = '${fora} 10:00', ends_at = '${fora} 11:00' where id = 'pm1'`), 'remarcar para fora');
  await as(owner, ...appt('pm3', '5521999998888', `${fora} 14:00`, `${fora} 15:00`, 'confirmado'));
});

console.log(`\n${passed} testes passaram.`);
