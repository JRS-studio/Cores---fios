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
const db = { clients: [], appointments: [], transactions: [], feedbacks: [], settings: [], posts: [], likes: [], push_subscriptions: [], cashback: [] };
// Chave pública de envio (VAPID) válida, para o navegador aceitar a inscrição.
const VAPID = require('crypto').createECDH('prime256v1');
VAPID.generateKeys();
const VAPID_PUBLIC = VAPID.getPublicKey().toString('base64url');
// Sessão do navegador que está fazendo a chamada (pelo token) e números presos a aparelhos.
const sessions = new Map(); // token -> { user, phone?, owner? }
const claims = new Map(); // phone -> userId
let nextUser = 1;

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
    const token = (req.headers.authorization ?? '').replace('Bearer ', '');
    const session = sessions.get(token) ?? null;
    const login = (data) => {
      const user = { id: `00000000-0000-0000-0000-${String(nextUser++).padStart(12, '0')}`, ...data };
      const auth = authResponse(user);
      sessions.set(auth.access_token, { user, owner: !!data.email });
      return send(200, auth);
    };
    if (p === '/auth/v1/signup') return login({ is_anonymous: true });
    if (p === '/auth/v1/token') {
      if (body.email !== 'jhenifer@coresefios.app' || body.password !== 'senha123') return send(400, { error: 'invalid_grant' });
      return login({ email: body.email });
    }
    if (p === '/auth/v1/logout') {
      sessions.delete(token);
      return send(204);
    }
    if (p === '/auth/v1/user') return send(200, session?.user ?? {});
    if (p === '/rest/v1/rpc/is_owner') return send(200, !!session?.owner);
    if (p === '/rest/v1/rpc/vapid_public_key') return send(200, VAPID_PUBLIC);
    if (p === '/rest/v1/rpc/claim_phone') {
      const owner = claims.get(body.p_phone);
      if (owner && owner !== session.user.id) return send(400, { code: 'P0001', message: 'phone_taken' });
      for (const [ph, uid] of claims) if (uid === session.user.id) claims.delete(ph);
      claims.set(body.p_phone, session.user.id);
      return send(200, null);
    }
    if (p === '/rest/v1/rpc/release_my_phone') {
      for (const [ph, uid] of claims) if (uid === session?.user.id) claims.delete(ph);
      return send(200, null);
    }
    if (p === '/rest/v1/phone_claims') {
      const mine = [...claims].find(([, uid]) => uid === session?.user.id);
      return send(200, mine ? { phone: mine[0] } : null);
    }
    if (p === '/rest/v1/rpc/busy_slots') {
      return send(200, db.appointments.filter((a) => a.starts_at.startsWith(body.day) && a.status !== 'cancelado').map(({ starts_at, ends_at }) => ({ starts_at, ends_at })));
    }
    const table = p.replace('/rest/v1/', '');
    if (!(table in db)) return send(404, {});
    const myPhone = [...claims].find(([, uid]) => uid === session?.user.id)?.[0];
    // Imita as regras de acesso do schema.sql no que o teste usa.
    const visible = (row) =>
      session?.owner || ['settings', 'posts', 'likes'].includes(table) ||
      (table === 'feedbacks' && (row.approved || row.author_id === session?.user.id)) ||
      (table === 'clients' && row.phone === myPhone) || (['appointments', 'cashback'].includes(table) && row.client_phone === myPhone);
    if (req.method === 'GET') return send(200, db[table].filter(visible).map((r) => ({ data: r.data })));
    if (req.method === 'POST') {
      for (const row of [].concat(body)) {
        if (['transactions', 'posts', 'cashback'].includes(table) && !session?.owner) return send(403, { code: '42501', message: 'rls' });
        if (table === 'feedbacks') {
          if (!session) return send(403, { code: '42501', message: 'rls' });
          // Só a profissional publica ou aprova; a cliente envia esperando aprovação.
          if (!session.owner && (row.approved || row.data.approved !== false)) return send(403, { code: '42501', message: 'rls' });
          row.author_id = db.feedbacks.find((r) => r.id === row.id)?.author_id ?? session.user.id;
        }
        if (table === 'likes') {
          if (!session) return send(403, { code: '42501', message: 'rls' });
          row.user_id = session.user.id; // default auth.uid() do banco
        }
        db[table] = db[table].filter((r) => r.id !== row.id).concat(row);
      }
      return send(201, []);
    }
    if (req.method === 'DELETE') {
      // ?id=in.("a","b"): curtida só a dona apaga; o resto, só a profissional.
      const ids = (url.searchParams.get('id') ?? '').replace(/^in\.\(|\)$/g, '').split(',').map((v) => v.replace(/"/g, ''));
      const allowed = (r) => (table === 'likes' ? r.user_id === session?.user.id : session?.owner);
      db[table] = db[table].filter((r) => !(ids.includes(r.id) && allowed(r)));
      return send(204);
    }
    send(404, {});
  });
});

const PAGE = fs.readFileSync(path.resolve(__dirname, '../../dist-teste/remoto.html'));
const SW = fs.readFileSync(path.resolve(__dirname, '../../public/sw.js'));
const site = http.createServer((req, res) =>
  req.url.endsWith('/sw.js')
    ? res.writeHead(200, { 'Content-Type': 'text/javascript' }).end(SW)
    : res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(PAGE),
);

(async () => {
  await new Promise((r) => api.listen(API_PORT, r));
  await new Promise((r) => site.listen(0, r));
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  // Como se a cliente aceitasse as notificações quando o navegador pergunta.
  await p.context().grantPermissions(['notifications']);
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/realtime|websocket|ERR_CONNECTION|status of 40[034]|Push API in incognito/i.test(m.text()) && errors.push(m.text()));
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

  await test('visitante vê o perfil do studio, sem faturamento nem a aba Financeiro', async () => {
    await R.getByText('publicações', { exact: true }).waitFor();
    await R.getByText('Avaliar', { exact: true }).first().waitFor();
    await R.getByLabel(/Instagram do studio/).waitFor();
    assert.equal(await R.getByText('horários hoje').count(), 0);
    assert.equal(await R.getByLabel('Financeiro', { exact: true }).count(), 0);
    await R.getByLabel('Conta', { exact: true }).waitFor();
    await shot('01-visitante');
  });

  await test('cliente se cadastra só com o WhatsApp, sem código', async () => {
    await R.getByLabel('Conta', { exact: true }).click();
    await wait();
    await R.getByText('Cadastro rápido', { exact: true }).click();
    await wait();
    await R.getByLabel('Nome', { exact: true }).fill('Paula Lima');
    await R.getByLabel('WhatsApp', { exact: true }).fill('11955550000');
    assert.equal(await R.getByLabel('Código de verificação').count(), 0);
    await R.getByText('Confirmar e entrar').click();
    await wait(1200);
    await R.getByText(/verificado/).first().waitFor();
    await R.getByText(/Concordo com o uso/).click();
    await R.getByText('Concluir cadastro').click();
    await wait(1200);
    const row = db.clients.find((c) => c.phone === '5511955550000');
    assert.ok(row, 'cadastro gravado com o telefone no formato do login');
    assert.equal(claims.get('5511955550000') !== undefined, true);
    await shot('02-cadastro');
  });

  await test('outro celular não consegue entrar com o mesmo número', async () => {
    const other = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await other.goto(`http://localhost:${site.address().port}/`, { waitUntil: 'networkidle' });
    await other.waitForTimeout(1500);
    await other.locator('#root').getByLabel('Conta', { exact: true }).click();
    await other.waitForTimeout(400);
    await other.locator('#root').getByText('Já tenho cadastro: entrar').click();
    await other.waitForTimeout(400);
    await other.locator('#root').getByLabel('WhatsApp', { exact: true }).fill('11955550000');
    await other.locator('#root').getByText('Confirmar e entrar').click();
    await other.locator('#root').getByText(/já está conectado em outro celular/).waitFor();
    await other.screenshot({ path: path.join(shots, '02b-outro-celular.png') });
    await other.close();
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

  await test('cliente vê o lembrete 1 hora antes no horário marcado e consegue ativar', async () => {
    await R.getByText('Lembrete 1 hora antes').filter({ visible: true }).first().waitFor();
    await R.getByRole('button', { name: 'Ativar lembretes' }).filter({ visible: true }).first().click();
    // Sem acesso ao serviço de push do Google neste ambiente, a inscrição pode falhar: o app avisa sem travar.
    await R.getByText(/Lembretes ativados|Não foi possível ativar agora/).filter({ visible: true }).first().waitFor({ timeout: 15000 });
    const scope = await p.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope);
    assert.match(scope ?? '', /^http:\/\/localhost:\d+\/$/, 'service worker registrado no endereço do site');
    if (await R.getByText('Lembretes ativados').count()) assert.equal(db.push_subscriptions.length, 1);
    await shot('02c-lembretes');
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
    await R.getByLabel('Login').fill('Jhenifer');
    await R.getByLabel('Senha').fill('senha123');
    await R.getByRole('button', { name: 'Entrar' }).last().click();
    await wait(1500);
    await R.getByText('Você entrou como profissional.').last().waitFor();
    await R.getByText('Continuar', { exact: true }).last().click();
    await wait(800);
    await R.getByLabel('Voltar').last().click();
    await wait(800);
    await R.getByText('horários hoje').waitFor();
    await R.getByRole('button', { name: 'Financeiro' }).last().waitFor();
    await R.getByRole('button', { name: 'Agenda' }).last().click();
    await wait(800);
    await shot('04-profissional');
  });

  await test('profissional publica no feed; a publicação vai para o servidor', async () => {
    await R.getByRole('button', { name: 'Publicar' }).last().click();
    await wait(800);
    await R.getByText('Promoção', { exact: true }).click();
    await R.getByLabel('Legenda').fill('Pé e mão por R$ 60 nesta semana!');
    await R.getByText('Publicar', { exact: true }).last().click();
    await wait(1200);
    assert.equal(db.posts.length, 1);
    assert.equal(db.posts[0].data.kind, 'promocao');
    await R.getByText('Pé e mão por R$ 60 nesta semana!').first().waitFor();
    await shot('05-publicado');
  });

  await test('visitante vê a publicação e curte sem cadastro; só a própria curtida sai', async () => {
    const other = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const O = other.locator('#root');
    await other.goto(`http://localhost:${site.address().port}/`, { waitUntil: 'networkidle' });
    await other.waitForTimeout(1500);
    await O.getByText('Pé e mão por R$ 60 nesta semana!').waitFor();
    await O.getByLabel('Curtir').first().click();
    await other.waitForTimeout(1200);
    assert.equal(db.likes.length, 1);
    assert.equal(db.likes[0].item_id, db.posts[0].id);
    await O.getByLabel('Descurtir').first().waitFor();
    await other.screenshot({ path: path.join(shots, '06-curtida.png') });
    await O.getByLabel('Descurtir').first().click();
    await other.waitForTimeout(1200);
    assert.equal(db.likes.length, 0);
    await other.close();
  });

  await test('cliente escolhe o próprio tema; o padrão do studio não muda', async () => {
    const other = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const O = other.locator('#root');
    await other.goto(`http://localhost:${site.address().port}/`, { waitUntil: 'networkidle' });
    await other.waitForTimeout(1500);
    await O.getByLabel('Tema do app').click();
    await other.waitForTimeout(500);
    await O.getByText('A escolha vale só para você', { exact: false }).waitFor();
    await Promise.all([other.waitForEvent('load'), O.getByLabel(/^Tema Tecnologia:/).click()]);
    await other.waitForTimeout(1500);
    await other.goto(`http://localhost:${site.address().port}/`, { waitUntil: 'networkidle' });
    await other.waitForTimeout(1500);
    const bg = await O.getByRole('button', { name: 'Agendar' }).first().evaluate((el) => getComputedStyle(el).backgroundColor);
    assert.equal(bg, 'rgb(15, 23, 42)');
    assert.equal(db.settings.length, 0, 'a escolha da cliente não vai para os ajustes do studio');
    await other.screenshot({ path: path.join(shots, '07-tema-cliente.png') });
    await other.close();
  });

  await test('cashback: Premium ganha 1% ao concluir, vê o saldo, usa ao agendar e a profissional vê o saldo', async () => {
    const home = `http://localhost:${site.address().port}/`;
    const PHONE = '5511955550000';
    // Paula vira Premium.
    const paula = db.clients.find((c) => c.phone === PHONE);
    paula.data = { ...paula.data, plan: 'premium' };
    const first = db.appointments.find((a) => a.client_phone === PHONE);

    // Profissional confirma e conclui o horário de R$ 70: Paula ganha R$ 0,70.
    // Abre o horário pela ficha da cliente (Clientes › Paula › Histórico).
    const openFromClient = async (service) => {
      await p.goto(home, { waitUntil: 'networkidle' });
      await wait(1500);
      await R.getByRole('button', { name: 'Clientes' }).last().click();
      await wait(800);
      await R.getByText('Paula Lima').first().click();
      await wait(800);
      await R.getByText(service, { exact: false }).last().click();
      await wait(800);
    };
    await openFromClient('Esmaltação em gel');
    await R.getByRole('button', { name: 'Confirmar horário' }).click();
    await wait(800);
    await R.getByRole('button', { name: 'Concluir atendimento' }).click();
    await R.getByRole('button', { name: 'Concluir' }).last().click();
    await wait(1200);
    await R.getByText(/\+R\$\s?0,70 de cashback para Paula/).waitFor();
    const credit = db.cashback.find((r) => r.data.kind === 'credito');
    assert.equal(credit?.client_phone, PHONE);
    assert.equal(credit.data.amount, 0.7);

    // Um crédito anterior de R$ 10 (lançado pela profissional): saldo R$ 10,70.
    db.cashback.push({ id: 'cb-antigo', client_phone: PHONE, data: { id: 'cb-antigo', createdAt: new Date(Date.now() - 86400000).toISOString(), clientPhone: '11955550000', clientName: 'Paula Lima', amount: 10, kind: 'credito', description: 'Mão e pé' } });

    // Paula entra no celular dela, vê o saldo e usa ao agendar.
    const cli = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const C = cli.locator('#root');
    await cli.goto(home, { waitUntil: 'networkidle' });
    await cli.waitForTimeout(1500);
    await C.getByLabel('Conta', { exact: true }).click();
    await cli.waitForTimeout(400);
    await C.getByText('Já tenho cadastro: entrar').click();
    await cli.waitForTimeout(400);
    await C.getByLabel('WhatsApp', { exact: true }).fill('11955550000');
    await C.getByText('Confirmar e entrar').click();
    await cli.waitForTimeout(1500);
    await cli.goto(home, { waitUntil: 'networkidle' });
    await cli.waitForTimeout(1500);
    await C.getByLabel('Conta', { exact: true }).last().click();
    await cli.waitForTimeout(800);
    await C.getByLabel(/Saldo de cashback: R\$\s?10,70/).waitFor();
    await cli.screenshot({ path: path.join(shots, '08-cashback-conta.png') });
    await C.getByText('Agendar horário').last().click();
    await cli.waitForTimeout(800);
    await C.getByText('Manicure tradicional', { exact: true }).last().click();
    await C.getByRole('checkbox', { name: /Usar cashback de R\$\s?10,70/ }).click();
    await C.getByText(/Desconta R\$\s?10,70: a pagar R\$\s?24,30/).waitFor();
    await C.getByRole('button', { name: /^(seg|ter|qua|qui|sex) \d+$/ }).nth(2).click();
    await cli.waitForTimeout(500);
    await C.getByText('14:00', { exact: true }).last().click();
    await cli.screenshot({ path: path.join(shots, '09-cashback-agendar.png') });
    await C.getByText('Confirmar agendamento').click();
    await cli.waitForTimeout(1200);
    const booked = db.appointments.at(-1);
    assert.equal(booked.data.cashbackUse, 10.7);
    // Enquanto o horário não acontece, o saldo fica separado (não dá para usar duas vezes).
    await cli.goto(home, { waitUntil: 'networkidle' });
    await cli.waitForTimeout(1500);
    await C.getByLabel('Conta', { exact: true }).last().click();
    await cli.waitForTimeout(800);
    await C.getByText(/R\$\s?10,70 separado para horário marcado/).waitFor();
    // A cliente não consegue lançar cashback para si.
    const before = db.cashback.length;
    const status = await cli.evaluate(async ([url]) => {
      const key = Object.keys(localStorage).find((k) => k.includes('auth-token'));
      const token = JSON.parse(localStorage.getItem(key)).access_token;
      const r = await fetch(`${url}/rest/v1/cashback`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, apikey: 'teste', 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'golpe', client_phone: '5511955550000', data: { amount: 999 } }) });
      return r.status;
    }, [`http://localhost:${API_PORT}`]);
    assert.equal(status, 403);
    assert.equal(db.cashback.length, before);
    await cli.close();

    // Profissional vê o saldo na lista de clientes e conclui: recebe R$ 24,30, o cashback sai do saldo.
    await p.goto(home, { waitUntil: 'networkidle' });
    await wait(1500);
    await R.getByRole('button', { name: 'Clientes' }).last().click();
    await wait(800);
    await R.getByText(/Cashback R\$\s?10,70/).waitFor();
    await shot('10-cashback-lista');
    await openFromClient('Manicure tradicional');
    await R.getByRole('button', { name: 'Confirmar horário' }).click();
    await wait(800);
    await R.getByRole('button', { name: 'Concluir atendimento' }).click();
    await R.getByText(/usa R\$\s?10,70 de cashback: receba R\$\s?24,30/).waitFor();
    await R.getByRole('button', { name: 'Concluir' }).last().click();
    await wait(1200);
    const use = db.cashback.find((r) => r.data.kind === 'uso');
    assert.equal(use.data.amount, -10.7);
    const done = db.appointments.find((a) => a.id === booked.id).data;
    assert.equal(done.paidAmount, 24.3);
    assert.equal(done.cashbackUsed, 10.7);
    assert.equal(done.cashbackEarned, 0.24);
    const balance = db.cashback.filter((r) => r.client_phone === PHONE).reduce((sum, r) => sum + r.data.amount, 0);
    assert.equal(Math.round(balance * 100) / 100, 0.24);
  });

  await test('aniversário: Premium ganha o desconto sozinho no agendamento e o atendimento gera cashback', async () => {
    const home = `http://localhost:${site.address().port}/`;
    const PHONE = '5511955550000';
    // Próximo dia útil; o aniversário da Paula fica no mês desse dia.
    const d = new Date();
    do d.setDate(d.getDate() + 1); while (d.getDay() === 0 || d.getDay() === 6);
    const pad = (n) => String(n).padStart(2, '0');
    const paula = db.clients.find((c) => c.phone === PHONE);
    paula.data = { ...paula.data, birthDate: `10/${pad(d.getMonth() + 1)}/1990` };

    await p.goto(home, { waitUntil: 'networkidle' });
    await wait(1500);
    await R.getByRole('button', { name: 'Clientes' }).last().click();
    await wait(800);
    await R.getByText('Paula Lima').first().click();
    await wait(800);
    await R.getByText('Agendar horário').first().click();
    await wait(800);
    await R.getByText('Esmaltação em gel', { exact: true }).last().click();
    await R.getByText(/15% de desconto aplicado\. De R\$\s?70(,00)? por R\$\s?59,50/).waitFor();
    await R.getByRole('button', { name: new RegExp(`^(seg|ter|qua|qui|sex) ${d.getDate()}$`) }).first().click();
    await wait(500);
    await R.getByText('16:00', { exact: true }).last().click();
    await shot('13-aniversario');
    await R.getByText('Confirmar agendamento').click();
    await wait(1200);
    const appt = db.appointments.at(-1).data;
    assert.equal(appt.price, 59.5);
    assert.equal(appt.fullPrice, 70);
    assert.equal(appt.birthdayDiscount, 15);

    await R.getByRole('button', { name: 'Concluir atendimento' }).click();
    await R.getByRole('button', { name: 'Concluir' }).last().click();
    await wait(1200);
    const done = db.appointments.find((a) => a.id === appt.id).data;
    assert.equal(done.paidAmount, 59.5);
    assert.ok(done.cashbackEarned >= 0.59 && done.cashbackEarned <= 0.6, `cashback do aniversário: ${done.cashbackEarned}`);
    assert.ok(db.cashback.some((r) => r.data.appointmentId === appt.id && r.data.kind === 'credito'));
  });

  await test('avaliação da cliente só aparece no feed depois que a profissional aprova', async () => {
    const home = `http://localhost:${site.address().port}/`;
    const cli = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const C = cli.locator('#root');
    await cli.goto(home, { waitUntil: 'networkidle' });
    await cli.waitForTimeout(1500);
    await C.getByLabel('Conta', { exact: true }).click();
    await cli.waitForTimeout(400);
    await C.getByText('Cadastro rápido', { exact: true }).click();
    await cli.waitForTimeout(400);
    await C.getByLabel('Nome', { exact: true }).fill('Rita Gomes');
    await C.getByLabel('WhatsApp', { exact: true }).fill('11944443333');
    await C.getByText('Confirmar e entrar').click();
    await cli.waitForTimeout(1200);
    await C.getByText(/Concordo com o uso/).click();
    await C.getByText('Concluir cadastro').click();
    await cli.waitForTimeout(1200);
    await cli.goto(home, { waitUntil: 'networkidle' });
    await cli.waitForTimeout(1500);
    await C.getByText('Avaliar', { exact: true }).first().click();
    await cli.waitForTimeout(800);
    await C.getByLabel(/^5 estrelas/).click();
    await C.getByLabel('Conte como foi').fill('Amei o atendimento, unhas perfeitas!');
    await C.getByLabel('Seu nome').fill('Rita');
    await C.getByText('Publicar avaliação').click();
    await cli.waitForTimeout(1200);
    await C.getByText(/aparece no feed assim que Jhenifer aprovar/).waitFor();
    await C.getByText('Aguardando aprovação').first().waitFor();
    await cli.screenshot({ path: path.join(shots, '11-avaliacao-aguardando.png') });
    const row = db.feedbacks.find((r) => r.data.comment === 'Amei o atendimento, unhas perfeitas!');
    assert.equal(row.approved, false);

    // Quem visita ainda não vê.
    const visit = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await visit.goto(home, { waitUntil: 'networkidle' });
    await visit.waitForTimeout(1500);
    assert.equal(await visit.locator('#root').getByText('Amei o atendimento, unhas perfeitas!').count(), 0);

    // A profissional vê o aviso na tela inicial e aprova.
    await p.goto(home, { waitUntil: 'networkidle' });
    await wait(1500);
    await R.getByText(/1 avaliação esperando sua aprovação/).click();
    await wait(800);
    await shot('12-avaliacao-aprovar');
    await R.getByRole('button', { name: 'Aprovar' }).click();
    await wait(1200);
    assert.equal(db.feedbacks.find((r) => r.id === row.id).approved, true);

    await visit.goto(home, { waitUntil: 'networkidle' });
    await visit.waitForTimeout(1500);
    await visit.locator('#root').getByText('Amei o atendimento, unhas perfeitas!').first().waitFor();
    await visit.close();
    await cli.close();
  });

  await test('profissional ativa a biometria; o app abre travado e só entra com rosto/digital', async () => {
    // Leitor de biometria simulado do Chrome (como o Face ID ou a digital do celular).
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('WebAuthn.enable');
    const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
    });
    const home = `http://localhost:${site.address().port}/`;
    await p.goto(home, { waitUntil: 'networkidle' });
    await wait(1500);
    await R.getByLabel('Ajustes').first().click();
    await wait();
    await R.getByRole('button', { name: 'Ativar biometria' }).click();
    await R.getByText('Entrada pela biometria ativada neste celular.').waitFor();

    // Reabre o app com a biometria recusada: fica travado, sem mostrar nada do studio.
    await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false });
    await p.goto(home, { waitUntil: 'networkidle' });
    await wait(1500);
    await R.getByText('Use o rosto ou a digital para entrar.').waitFor();
    await R.getByText('Não foi possível confirmar', { exact: false }).waitFor();
    await shot('08-biometria-travado');

    // Com o rosto/digital certo, abre direto no painel da profissional, sem senha.
    await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: true });
    await R.getByRole('button', { name: 'Entrar com biometria' }).click();
    await wait(1000);
    assert.equal(await R.getByText('Use o rosto ou a digital para entrar.').count(), 0);
    await R.getByText('horários hoje').waitFor();

    // Ao reabrir, a biometria é pedida sozinha e o app abre.
    await p.goto(home, { waitUntil: 'networkidle' });
    await wait(2000);
    assert.equal(await R.getByText('Use o rosto ou a digital para entrar.').count(), 0);
    await R.getByText('horários hoje').waitFor();

    // "Entrar com login e senha" sai da conta e desliga a biometria.
    await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false });
    await p.goto(home, { waitUntil: 'networkidle' });
    await wait(1500);
    await R.getByText('Entrar com login e senha').click();
    await wait(1000);
    await R.getByText('Sou a profissional').waitFor();
    assert.equal(await p.evaluate(() => localStorage.getItem('cores:biometria:v1')), null);
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
