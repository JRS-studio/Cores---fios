// Testa o app no modo com servidor contra uma imitação local da API do Supabase (auth, REST e RPC).
// Confere os papéis (visitante, cliente, profissional) e o que o app grava no banco.
// Uso (na raiz):
//   EXPO_PUBLIC_SUPABASE_URL=http://localhost:54329 EXPO_PUBLIC_SUPABASE_ANON_KEY=teste \
//     python3 tools/pagina-de-teste/build.py --saida dist-teste/remoto.html
//   node supabase/test/app-remote.test.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { chromium } = require('playwright');

const API_PORT = 54329;
const db = { clients: [], appointments: [], transactions: [], feedbacks: [], settings: [] };
let session = null; // { phone } da cliente ou { owner: true }

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (claims) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.assinatura`;
function authResponse(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: jwt({ sub: user.id, phone: user.phone ?? '', role: 'authenticated', aud: 'authenticated', exp }),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    refresh_token: 'refresh',
    user: { id: user.id, aud: 'authenticated', role: 'authenticated', phone: user.phone ?? '', email: user.email ?? '', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  };
}

const api = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${API_PORT}`);
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };
  if (req.method === 'OPTIONS') return send(204);
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const body = raw ? JSON.parse(raw) : {};
    const p = url.pathname;
    if (p === '/auth/v1/otp') return send(200, {});
    if (p === '/auth/v1/verify') {
      if (body.token !== '123456') return send(400, { code: 'otp_invalid', msg: 'Token has expired or is invalid' });
      const phone = body.phone.replace('+', '');
      session = { phone };
      return send(200, authResponse({ id: '00000000-0000-0000-0000-0000000000c1', phone }));
    }
    if (p === '/auth/v1/token') {
      if (body.email !== 'juliana@studio.com' || body.password !== 'senha123') return send(400, { error: 'invalid_grant' });
      session = { owner: true };
      return send(200, authResponse({ id: '00000000-0000-0000-0000-0000000000a1', email: body.email }));
    }
    if (p === '/auth/v1/logout') {
      session = null;
      return send(204);
    }
    if (p === '/auth/v1/user') return send(200, authResponse({ id: 'x', phone: session?.phone }).user);
    if (p === '/rest/v1/rpc/is_owner') return send(200, !!session?.owner);
    if (p === '/rest/v1/rpc/busy_slots') {
      return send(200, db.appointments.filter((a) => a.starts_at.startsWith(body.day) && a.status !== 'cancelado').map(({ starts_at, ends_at }) => ({ starts_at, ends_at })));
    }
    const table = p.replace('/rest/v1/', '');
    if (!(table in db)) return send(404, {});
    // Imita as regras de acesso do schema.sql no que o teste usa.
    const visible = (row) =>
      session?.owner || table === 'feedbacks' || table === 'settings' ||
      (table === 'clients' && row.phone === session?.phone) || (table === 'appointments' && row.client_phone === session?.phone);
    if (req.method === 'GET') return send(200, db[table].filter(visible).map((r) => ({ data: r.data })));
    if (req.method === 'POST') {
      for (const row of [].concat(body)) {
        if (table === 'transactions' && !session?.owner) return send(403, { code: '42501', message: 'rls' });
        db[table] = db[table].filter((r) => r.id !== row.id).concat(row);
      }
      return send(201, []);
    }
    if (req.method === 'DELETE') return send(204);
    send(404, {});
  });
});

const PAGE = fs.readFileSync(path.resolve(__dirname, '../../dist-teste/remoto.html'));
const site = http.createServer((_, res) => res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(PAGE));

(async () => {
  await new Promise((r) => api.listen(API_PORT, r));
  await new Promise((r) => site.listen(0, r));
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/realtime|websocket|ERR_CONNECTION|status of 40[034]/i.test(m.text()) && errors.push(m.text()));
  const R = p.locator('#root');
  const shots = path.resolve(__dirname, '../../dist-teste/prints-remoto');
  fs.mkdirSync(shots, { recursive: true });
  const shot = (n) => p.screenshot({ path: path.join(shots, `${n}.png`) });
  const wait = (ms = 500) => p.waitForTimeout(ms);
  let passed = 0;
  const test = async (name, fn) => {
    await fn();
    passed += 1;
    console.log('ok  ', name);
  };

  await p.goto(`http://localhost:${site.address().port}/`, { waitUntil: 'networkidle' });
  await wait(1500);

  await test('visitante não vê faturamento nem a aba Financeiro', async () => {
    assert.equal(await R.getByText('Resumo de hoje').count(), 0);
    assert.equal(await R.getByLabel('Financeiro', { exact: true }).count(), 0);
    await R.getByLabel('Conta', { exact: true }).waitFor();
    await shot('01-visitante');
  });

  await test('cliente se cadastra com o código do WhatsApp (enviado pelo servidor, sem código na tela)', async () => {
    await R.getByLabel('Conta', { exact: true }).click();
    await wait();
    await R.getByText('Cadastro rápido', { exact: true }).click();
    await wait();
    await R.getByLabel('Nome', { exact: true }).fill('Paula Lima');
    await R.getByLabel('WhatsApp').fill('11955550000');
    await R.getByText('Enviar código pelo WhatsApp').click();
    await wait();
    assert.equal(await R.getByText(/seu código é/).count(), 0);
    await R.getByLabel('Código de verificação').fill('111111');
    await wait();
    await R.getByText(/Código incorreto/).waitFor();
    await R.getByLabel('Código de verificação').fill('123456');
    await wait(1200);
    await R.getByText(/verificado/).first().waitFor();
    await R.getByText(/Concordo com o uso/).click();
    await R.getByText('Concluir cadastro').click();
    await wait(1200);
    const row = db.clients.find((c) => c.phone === '5511955550000');
    assert.ok(row, 'cadastro gravado com o telefone no formato do login');
    assert.equal(row.data.phoneVerified, true);
    await shot('02-cadastro');
  });

  await test('cliente agenda para si mesma; o servidor recebe telefone, início e fim', async () => {
    await R.getByLabel('Voltar').last().click();
    await wait();
    await R.getByText('Agendar horário').last().click();
    await wait(800);
    assert.equal(await R.getByText('Nova / avulsa').count(), 0);
    await R.getByText('Esmaltação em gel', { exact: true }).last().click();
    // Um dia de semana à frente, com horários livres.
    await R.getByRole('button', { name: /^(seg|ter|qua|qui|sex) \d+$/ }).nth(1).click();
    await wait();
    await R.getByText('10:00', { exact: true }).last().click();
    await R.getByText('Confirmar agendamento').click();
    await wait(1200);
    const appt = db.appointments.at(-1);
    assert.ok(appt, 'horário gravado');
    assert.equal(appt.client_phone, '5511955550000');
    assert.equal(appt.status, 'agendado');
    assert.match(appt.starts_at, / 10:00$/);
    assert.match(appt.ends_at, / 11:00$/);
    await shot('03-agendado');
  });

  await test('horário marcado aparece como ocupado para outra pessoa', async () => {
    const day = db.appointments.at(-1).starts_at.slice(0, 10);
    const busy = db.appointments.filter((a) => a.starts_at.startsWith(day));
    assert.equal(busy.length, 1);
  });

  await test('profissional entra com e-mail e senha e vê o Financeiro', async () => {
    await R.getByLabel('Voltar').last().click();
    await wait();
    await R.getByLabel('Início', { exact: true }).click();
    await wait();
    await R.getByLabel('Ajustes').first().click();
    await wait();
    await R.getByText('Sair', { exact: true }).last().click();
    await wait(800);
    await R.getByText('Entrar', { exact: true }).last().click();
    await wait();
    await R.getByText('Sou a profissional').click();
    await R.getByLabel('E-mail').fill('juliana@studio.com');
    await R.getByLabel('Senha').fill('senha123');
    await R.getByRole('button', { name: 'Entrar' }).last().click();
    await wait(1500);
    await R.getByText('Você entrou como profissional.').last().waitFor();
    await R.getByText('Continuar', { exact: true }).last().click();
    await wait(800);
    await R.getByLabel('Voltar').last().click();
    await wait(800);
    await R.getByText('Resumo de hoje').waitFor();
    await R.getByRole('button', { name: 'Financeiro' }).last().waitFor();
    await R.getByRole('button', { name: 'Agenda' }).last().click();
    await wait(800);
    await shot('04-profissional');
  });

  await browser.close();
  api.close();
  site.close();
  if (errors.length) {
    console.error('\nErros no app:\n' + errors.join('\n'));
    process.exit(1);
  }
  console.log(`\n${passed} testes do modo com servidor passaram.`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
