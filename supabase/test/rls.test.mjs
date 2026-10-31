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
  create role anon nologin; create role authenticated nologin;
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
  grant select, insert, update, delete on all tables in schema public to anon, authenticated;
  grant select, insert, delete on storage.objects to anon, authenticated;
  grant usage on all sequences in schema storage to anon, authenticated;
  insert into auth.users values ('${OWNER}'), ('${CLIENT}'), ('${OTHER}'), ('${DEVICE_A}'), ('${DEVICE_B}');
  insert into professionals values ('${OWNER}');
`);

// Executa SQL como uma pessoa: profissional, cliente (telefone) ou visitante (anon).
async function as(who, sql, params = []) {
  const claims = who === 'anon' ? {} : who;
  const role = who === 'anon' ? 'anon' : 'authenticated';
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
await test('cliente cancela o próprio horário e o espaço fica livre', async () => {
  await as(ana, `update appointments set status = 'cancelado' where id = 'a1'`);
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
await test('avaliações: todos leem, quem entrou publica, só a profissional remove', async () => {
  await as(ana, `insert into feedbacks (id, data) values ('f1', '{"rating":5}')`);
  assert.ok(await fails('anon', `insert into feedbacks (id, data) values ('f2', '{}')`));
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
  await as(ana, ...upsert('feedbacks', ['id', 'data'], ['f9', '{"rating":4}']));
  assert.equal((await rows('anon', `select * from feedbacks where id = 'f9'`)).length, 1);
});
await test('upsert: cliente não altera avaliação já publicada', async () => {
  assert.ok(await fails(ana, ...upsert('feedbacks', ['id', 'data'], ['f9', '{"rating":1}'])));
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
  await as(deviceB, ...like(`p1:${DEVICE_B}`, 'p1', DEVICE_B)); // login anônimo também curte
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

console.log(`\n${passed} testes passaram.`);
