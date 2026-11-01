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
const db = { clients: [], appointments: [], transactions: [], feedbacks: [], settings: [], posts: [], likes: [], push_subscriptions: [], cashback: [], comments: [], cancel_requests: [] };
// Chave pública de envio (VAPID) válida, para o navegador aceitar a inscrição.
const VAPID = require('crypto').createECDH('prime256v1');
VAPID.generateKeys();
const VAPID_PUBLIC = VAPID.getPublicKey().toString('base64url');
// Sessão do navegador que está fazendo a chamada (pelo token) e números presos a aparelhos.
const sessions = new Map(); // token -> { user, phone?, owner? }
const claims = new Map(); // phone -> userId
let nextUser = 1;
// Como cada "Sair" pediu para desconectar (local = só este aparelho; global = todos os aparelhos da conta).
const logouts = [];

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
      logouts.push(url.searchParams.get('scope'));
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
      (['feedbacks', 'comments'].includes(table) && (row.approved || row.author_id === session?.user.id)) ||
      (table === 'clients' && row.phone === myPhone) || (['appointments', 'cashback', 'cancel_requests'].includes(table) && row.client_phone === myPhone);
    if (req.method === 'GET') return send(200, db[table].filter(visible).map((r) => ({ data: r.data })));
    if (req.method === 'POST') {
      for (const row of [].concat(body)) {
        if (['transactions', 'posts', 'cashback'].includes(table) && !session?.owner) return send(403, { code: '42501', message: 'rls' });
        if (table === 'feedbacks' || table === 'comments') {
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
      const allowed = (r) => (['likes', 'comments'].includes(table) && r.user_id === session?.user.id) || (table === 'comments' && r.author_id === session?.user.id) || session?.owner;
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

  // Escolhe o dia na tela de agendar pelo formato Semana / Novembro / Dezembro: o botão do mês e o dia no calendário.
  const MESES_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const capitalize = (m) => m[0].toUpperCase() + m.slice(1);
  async function pickDate(L, d) {
    const mes = MESES_PT[d.getMonth()];
    await L.getByRole('tab', { name: capitalize(mes), exact: true }).click();
    await L.page().waitForTimeout(300);
    await L.getByRole('button', { name: new RegExp(`^${d.getDate()} de ${mes}(,|$)`) }).first().click();
    return d;
  }
  // O n-ésimo dia útil (seg a sex) a partir de amanhã (n = 0 é o primeiro).
  async function pickWeekday(L, n) {
    const d = new Date();
    for (let k = -1; k < n; ) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) k += 1;
    }
    return pickDate(L, d);
  }
  const test = async (name, fn) => {
    await fn();
    passed += 1;
    console.log('ok  ', name);
  };

  await p.goto(`http://localhost:${site.address().port}/`, { waitUntil: 'networkidle' });
  await wait(1500);

  await test('visitante só vê: perfil do studio (sem o nome da profissional), botões Entrar e Cadastrar, sem ações', async () => {
    await R.getByText('publicações', { exact: true }).waitFor();
    await R.getByText('Cores & Fios', { exact: true }).first().waitFor();
    assert.equal(await R.getByText('Jhenifer', { exact: true }).count(), 0, 'sem o nome da profissional');
    await R.getByRole('button', { name: 'Entrar' }).first().waitFor();
    await R.getByRole('button', { name: 'Cadastrar' }).first().waitFor();
    await R.getByText('Você está só olhando.', { exact: false }).waitFor();
    // Nada de agendar, avaliar, publicar ou ver horários sem entrar.
    for (const label of ['Avaliar', 'Horários', 'Agendar']) assert.equal(await R.getByRole('button', { name: label, exact: true }).count(), 0, label);
    assert.equal(await R.getByText('Como ficaram suas unhas?', { exact: false }).count(), 0);
    await R.getByLabel(/Instagram do studio/).waitFor();
    assert.equal(await R.getByText('horários hoje').count(), 0);
    assert.equal(await R.getByLabel('Financeiro', { exact: true }).count(), 0);
    await R.getByText('Seja Premium', { exact: true }).waitFor();
    await R.getByRole('button', { name: 'Seja Premium' }).waitFor();
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
    await pickWeekday(R, 1);
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

  await test('visitante vê a publicação mas não curte, não comenta nem compartilha; cliente curte e descurte', async () => {
    const vis = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await vis.goto(`http://localhost:${site.address().port}/`, { waitUntil: 'networkidle' });
    await vis.waitForTimeout(1500);
    const VV = vis.locator('#root');
    await VV.getByText('Pé e mão por R$ 60 nesta semana!').waitFor();
    for (const label of ['Curtir', 'Comentar', 'Compartilhar']) assert.equal(await VV.getByLabel(label, { exact: true }).count(), 0, label);
    assert.equal(await VV.getByText('Adicione um comentário…').count(), 0);
    await vis.screenshot({ path: path.join(shots, '06-visitante-feed.png') });
    await vis.close();

    // Cliente logada curte.
    const other = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const O = other.locator('#root');
    await other.goto(`http://localhost:${site.address().port}/`, { waitUntil: 'networkidle' });
    await other.waitForTimeout(1500);
    await O.getByLabel('Conta', { exact: true }).click();
    await other.waitForTimeout(400);
    await O.getByText('Cadastro rápido', { exact: true }).click();
    await other.waitForTimeout(400);
    await O.getByLabel('Nome', { exact: true }).fill('Bia Lopes');
    await O.getByLabel('WhatsApp', { exact: true }).fill('11922221111');
    await O.getByText('Confirmar e entrar').click();
    await other.waitForTimeout(1200);
    await O.getByText(/Concordo com o uso/).click();
    await O.getByText('Concluir cadastro').click();
    await other.waitForTimeout(1200);
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
    // Quem só visita não troca o tema (modo visualização); a cliente entra primeiro.
    assert.equal(await O.getByLabel('Tema do app').count(), 0);
    await O.getByLabel('Conta', { exact: true }).click();
    await other.waitForTimeout(400);
    await O.getByText('Cadastro rápido', { exact: true }).click();
    await other.waitForTimeout(400);
    await O.getByLabel('Nome', { exact: true }).fill('Tati Rocha');
    await O.getByLabel('WhatsApp', { exact: true }).fill('11900009999');
    await O.getByText('Confirmar e entrar').click();
    await other.waitForTimeout(1200);
    await O.getByText(/Concordo com o uso/).click();
    await O.getByText('Concluir cadastro').click();
    await other.waitForTimeout(1200);
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
    // Na tela inicial: o saldo no lugar do convite "Seja Premium".
    await C.getByRole('button', { name: /Seu cashback: R\$\s?10,70/ }).waitFor();
    assert.equal(await C.getByText('SEU CASHBACK').count(), 0, 'sem o cartão grande de cashback');
    assert.equal(await C.getByRole('button', { name: 'Seja Premium' }).count(), 0);
    // O topo mostra o perfil da cliente logada: inicial e nome dela, não os do studio.
    await C.getByLabel('Foto de perfil de Paula Lima').waitFor();
    await C.getByText('Paula Lima', { exact: true }).first().waitFor();
    await C.getByText('atendimentos', { exact: true }).waitFor();
    assert.equal(await C.getByText('Jhenifer', { exact: true }).count(), 0);
    await cli.screenshot({ path: path.join(shots, '18-cashback-inicio.png') });
    await C.getByLabel('Conta', { exact: true }).last().click();
    await cli.waitForTimeout(800);
    await C.getByLabel(/Saldo de cashback: R\$\s?10,70/).waitFor();
    await cli.screenshot({ path: path.join(shots, '08-cashback-conta.png') });
    await C.getByText('Agendar horário').last().click();
    await cli.waitForTimeout(800);
    await C.getByText('Manicure tradicional', { exact: true }).last().click();
    await pickWeekday(C, 2);
    await cli.waitForTimeout(500);
    await C.getByText('14:00', { exact: true }).last().click();
    // Sem ter marcado o cashback, o app pergunta ao confirmar.
    await C.getByText('Confirmar agendamento').click();
    await cli.waitForTimeout(600);
    const ask = cli.getByText(/Você tem R\$\s?10,70 de cashback/);
    await ask.waitFor();
    await cli.getByText(/fica R\$\s?24,30 em vez de R\$\s?35/).waitFor();
    await cli.screenshot({ path: path.join(shots, '09-cashback-agendar.png') });
    await cli.getByRole('button', { name: /Usar R\$\s?10,70 de cashback/ }).click();
    await cli.waitForTimeout(1200);
    const booked = db.appointments.at(-1);
    assert.equal(booked.data.cashbackUse, 10.7);
    // Enquanto o horário não acontece, o saldo fica separado (não dá para usar duas vezes).
    await cli.goto(home, { waitUntil: 'networkidle' });
    await cli.waitForTimeout(1500);
    await C.getByLabel('Conta', { exact: true }).last().click();
    await cli.waitForTimeout(800);
    await C.getByText(/R\$\s?10,70 separado para horário marcado/).filter({ visible: true }).first().waitFor();
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
    await pickDate(R, d);
    await wait(500);
    await R.getByText('16:00', { exact: true }).last().click();
    await shot('13-aniversario');
    await R.getByText('Confirmar agendamento').click();
    await wait(600);
    await p.getByText(/Paula tem R\$\s?0,24 de cashback/).waitFor();
    await p.getByRole('button', { name: 'Agora não, guardar o saldo' }).click();
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

  await test('comentário na publicação só aparece depois que a profissional aprova', async () => {
    const home = `http://localhost:${site.address().port}/`;
    // Quem comenta precisa ter entrado: a Carla faz o cadastro rápido.
    const vis = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const V = vis.locator('#root');
    await vis.goto(home, { waitUntil: 'networkidle' });
    await vis.waitForTimeout(1500);
    await V.getByLabel('Conta', { exact: true }).click();
    await vis.waitForTimeout(400);
    await V.getByText('Cadastro rápido', { exact: true }).click();
    await vis.waitForTimeout(400);
    await V.getByLabel('Nome', { exact: true }).fill('Carla Dias');
    await V.getByLabel('WhatsApp', { exact: true }).fill('11911110000');
    await V.getByText('Confirmar e entrar').click();
    await vis.waitForTimeout(1200);
    await V.getByText(/Concordo com o uso/).click();
    await V.getByText('Concluir cadastro').click();
    await vis.waitForTimeout(1200);
    await vis.goto(home, { waitUntil: 'networkidle' });
    await vis.waitForTimeout(1500);
    await V.getByRole('button', { name: 'Comentar' }).first().click();
    await vis.waitForTimeout(800);
    await V.getByText('Ainda não há comentários', { exact: false }).waitFor();
    assert.equal(await V.getByLabel('Seu nome').count(), 0, 'cliente comenta com o próprio nome');
    await V.getByLabel('Comentário').fill('Que promoção boa! Tem horário sábado?');
    await V.getByRole('button', { name: 'Comentar' }).click();
    await vis.waitForTimeout(1200);
    await V.getByText(/aparece para todas depois que Jhenifer aprovar/).first().waitFor();
    await V.getByText(/Aguardando aprovação/).first().waitFor();
    await vis.screenshot({ path: path.join(shots, '14-comentario-enviado.png') });
    const row = db.comments[0];
    assert.equal(row.approved, false);
    assert.equal(row.post_id, db.posts[0].id);

    // Outra pessoa ainda não vê.
    const other = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await other.goto(home, { waitUntil: 'networkidle' });
    await other.waitForTimeout(1500);
    assert.equal(await other.locator('#root').getByText('Que promoção boa! Tem horário sábado?').count(), 0);

    // A profissional aprova pelo aviso da tela inicial.
    await p.goto(home, { waitUntil: 'networkidle' });
    await wait(1500);
    await R.getByText(/1 comentário esperando sua aprovação/).click();
    await wait(800);
    await shot('15-comentario-aprovar');
    await R.getByRole('button', { name: 'Aprovar' }).click();
    await wait(1200);
    assert.equal(db.comments[0].approved, true);

    // A profissional responde: a resposta aparece na hora, já aprovada, embaixo do comentário.
    await R.getByLabel('Voltar').last().click();
    await wait(800);
    await R.getByRole('button', { name: /^Comentários \(1\)/ }).first().click();
    await wait(800);
    await R.getByRole('button', { name: 'Responder Carla' }).click();
    await R.getByLabel('Sua resposta para Carla').fill('Tem sim, Carla! Sábado às 10h está livre.');
    await R.getByRole('button', { name: 'Enviar resposta' }).click();
    await wait(1200);
    await shot('17-resposta');
    const reply = db.comments.find((r) => r.data.replyTo === row.id);
    assert.equal(reply.approved, true);
    assert.equal(reply.data.fromStudio, true);

    await other.goto(home, { waitUntil: 'networkidle' });
    await other.waitForTimeout(1500);
    await other.locator('#root').getByText('Que promoção boa! Tem horário sábado?').first().waitFor();
    await other.locator('#root').getByText('Tem sim, Carla! Sábado às 10h está livre.').first().waitFor();
    await other.locator('#root').getByRole('button', { name: 'Comentários (2)' }).first().waitFor();
    await other.screenshot({ path: path.join(shots, '16-comentario-no-feed.png') });
    await other.close();
    await vis.close();
  });

  await test('pedido de horário e pedido de cancelamento aparecem nos Avisos da profissional; só ela cancela e libera o horário', async () => {
    const home = `http://localhost:${site.address().port}/`;
    db.settings = [{ id: 1, data: { whatsapp: '11999990000' } }];
    const cli = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const C = cli.locator('#root');
    await cli.goto(home, { waitUntil: 'networkidle' });
    await cli.waitForTimeout(1500);
    await C.getByLabel('Conta', { exact: true }).click();
    await cli.waitForTimeout(400);
    await C.getByText('Cadastro rápido', { exact: true }).click();
    await cli.waitForTimeout(400);
    await C.getByLabel('Nome', { exact: true }).fill('Lia Souza');
    await C.getByLabel('WhatsApp', { exact: true }).fill('11933332222');
    await C.getByText('Confirmar e entrar').click();
    await cli.waitForTimeout(1200);
    await C.getByText(/Concordo com o uso/).click();
    await C.getByText('Concluir cadastro').click();
    await cli.waitForTimeout(1200);
    await C.getByText('Agendar horário').last().click();
    await cli.waitForTimeout(800);
    await C.getByText('Pedicure', { exact: true }).last().click();
    // A cliente vê o mês atual e o seguinte (e só eles); tocar no mês pula para os dias dele.
    const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const now = new Date();
    const [esteMes, proximo, depois] = [0, 1, 2].map((k) => MESES[(now.getMonth() + k) % 12]);
    await C.getByRole('tab', { name: capitalize(esteMes), exact: true }).waitFor();
    await C.getByRole('tab', { name: capitalize(proximo), exact: true }).click();
    await cli.waitForTimeout(500);
    await C.getByLabel(`Calendário de ${proximo}`).waitFor();
    // O mês seguinte aparece, mas sem horários até a profissional liberar.
    await C.getByText(new RegExp(`A agenda de ${proximo} ainda não foi liberada por Jhenifer`)).waitFor();
    assert.equal(await C.getByText('09:00', { exact: true }).count(), 0, 'sem horários no mês fechado');
    assert.equal(await C.getByRole('tab', { name: capitalize(depois), exact: true }).count(), 0, 'o mês depois do próximo ainda não abriu');
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate();
    await C.getByRole('button', { name: new RegExp(`^${lastDay} de ${proximo}`) }).waitFor();
    await cli.screenshot({ path: path.join(shots, '27-proximo-mes.png') });
    await pickWeekday(C, 3);
    await cli.waitForTimeout(500);
    await C.getByText('11:00', { exact: true }).last().click();
    // O WhatsApp abre ao agendar: fecha a aba aberta.
    const booking = cli.context().waitForEvent('page', { timeout: 5000 }).catch(() => null);
    await C.getByText('Confirmar agendamento').click();
    (await booking)?.close();
    await cli.waitForTimeout(1200);
    const appt = db.appointments.at(-1);
    assert.equal(appt.client_phone, '5511933332222');
    // O pedido de horário aparece nos Avisos da profissional (sininho da tela inicial).
    await p.goto(home, { waitUntil: 'networkidle' });
    await wait(1500);
    await R.getByLabel(/^Avisos: \d+ para responder$/).click();
    await wait(800);
    await R.getByLabel(/^Lia Souza pediu um horário: Pedicure/).waitFor();
    await shot('24-avisos-pedido-de-horario');
    // A profissional aceita o horário.
    appt.status = 'confirmado';
    appt.data = { ...appt.data, status: 'confirmado' };
    await cli.goto(home, { waitUntil: 'networkidle' });
    await cli.waitForTimeout(1500);
    // Abre o horário pelo cartão "próximo horário" da tela inicial.
    await C.getByText(/às 11:00 · Pedicure/).first().click();
    await cli.waitForTimeout(800);
    assert.equal(await C.getByText('Cancelar horário', { exact: true }).count(), 0, 'a cliente não cancela sozinha');
    // Sem internet para o WhatsApp aqui: responde a página do wa.me com algo simples.
    await cli.context().route('https://wa.me/**', (r) => r.fulfill({ contentType: 'text/html', body: 'WhatsApp' }));
    const whats = cli.context().waitForEvent('page');
    await C.getByRole('button', { name: 'Pedir cancelamento' }).click();
    const wa = await whats;
    await wa.waitForLoadState().catch(() => {});
    const url = decodeURIComponent(wa.url());
    assert.match(url, /wa\.me\/5511999990000/);
    assert.match(url, /Gostaria de cancelar meu horário de Pedicure/);
    await wa.close();
    await C.getByText(/Pedido de cancelamento enviado para Jhenifer\. O horário continua marcado até ela responder\./).waitFor();
    await C.getByText(/Você pediu o cancelamento/).waitFor();
    assert.equal(await C.getByRole('button', { name: 'Pedir cancelamento' }).count(), 0, 'não pede duas vezes');
    assert.equal(db.cancel_requests.length, 1);
    assert.equal(db.cancel_requests[0].status, 'aberto');
    assert.equal(db.cancel_requests[0].client_phone, '5511933332222');
    await cli.screenshot({ path: path.join(shots, '19-pedido-cancelamento.png') });
    assert.equal(db.appointments.find((a) => a.id === appt.id).status, 'confirmado', 'o horário continua marcado');

    // O pedido aparece nos Avisos da profissional; ela abre e cancela. Aí o horário fica livre.
    await p.goto(home, { waitUntil: 'networkidle' });
    await wait(1500);
    await R.getByLabel(/^Avisos: \d+ para responder$/).click();
    await wait(800);
    await shot('25-avisos-pedido-de-cancelamento');
    await R.getByLabel(/^Lia Souza pediu para cancelar: Pedicure/).click();
    await wait(800);
    await R.getByText('Lia pediu para cancelar este horário.').waitFor();
    await R.getByRole('button', { name: 'Cancelar horário' }).first().click();
    await R.getByText(/Cancelar o horário de Lia\?/).waitFor();
    await R.getByRole('button', { name: 'Cancelar horário' }).last().click();
    await wait(1200);
    const row = db.appointments.find((a) => a.id === appt.id);
    assert.equal(row.status, 'cancelado');
    assert.equal(db.cancel_requests[0].status, 'resolvido', 'pedido respondido');
    // Celular de cliente que guardou a biometria da profissional (testes no mesmo aparelho): ao abrir,
    // não aparece "Olá, Jhenifer" nem o perfil do studio; abre direto como a cliente e a trava antiga some.
    await cli.evaluate(() => localStorage.setItem('cores:biometria:v1', JSON.stringify({ credentialId: 'AAAA' })));
    assert.equal(JSON.parse(await cli.evaluate(() => localStorage.getItem('cores:sessao:v1'))).role, 'cliente');
    await cli.goto(home, { waitUntil: 'domcontentloaded' });
    await C.getByText('Lia Souza', { exact: true }).first().waitFor({ timeout: 5000 });
    assert.equal(await C.getByText('Use o rosto ou a digital para entrar.').count(), 0);
    assert.equal(await C.getByText(/Jhenifer/).count(), 0, 'nada da Jhenifer na tela da cliente');
    await cli.waitForTimeout(1500);
    assert.equal(await cli.evaluate(() => localStorage.getItem('cores:biometria:v1')), null, 'trava antiga apagada');
    db.settings = [];
    await cli.close();
  });

  await test('profissional agenda para cliente que pediu fora do app (nova, com nome e WhatsApp)', async () => {
    const home = `http://localhost:${site.address().port}/`;
    await p.goto(home, { waitUntil: 'networkidle' });
    await wait(1500);
    await R.getByText('Agendar', { exact: true }).first().click();
    await wait(800);
    await R.getByText('Nova / avulsa').click();
    await R.getByLabel('Nome', { exact: true }).fill('Bruna Costa');
    await R.getByLabel('WhatsApp', { exact: true }).fill('11977776666');
    await R.getByText('Mão e pé', { exact: true }).last().click();
    await pickWeekday(R, 4);
    await wait(500);
    await R.getByText('09:00', { exact: true }).last().click();
    await R.getByText('Confirmar agendamento').click();
    await wait(1500);
    await shot('20-profissional-agendou');
    const appt = db.appointments.find((a) => a.client_phone === '5511977776666');
    assert.ok(appt, 'horário gravado no servidor');
    assert.equal(appt.status, 'confirmado');
    assert.ok(db.clients.some((c) => c.phone === '5511977776666'), 'cadastro rápido criado');
    await R.getByText('Horário agendado!').first().waitFor();
  });

  await test('profissional: cliente nova/avulsa e troca de dia em qualquer ordem, sem a tela travar', async () => {
    const home = `http://localhost:${site.address().port}/`;
    const before = errors.length;
    await p.goto(home, { waitUntil: 'networkidle' });
    await wait(1500);
    await R.getByText('Agendar', { exact: true }).first().click();
    await wait(800);
    await R.getByText('Nova / avulsa').click();
    // Troca o dia antes de tudo, com o nome pela metade, depois de escolher o serviço e de novo.
    await pickWeekday(R, 1);
    await wait(300);
    await R.getByLabel('Nome', { exact: true }).fill('Dani');
    await pickWeekday(R, 2);
    await wait(300);
    await R.getByLabel('WhatsApp', { exact: true }).fill('1198');
    await pickWeekday(R, 3);
    await wait(300);
    await R.getByLabel('WhatsApp', { exact: true }).fill('11988887777');
    await pickWeekday(R, 4);
    await wait(300);
    await R.getByText('Pedicure', { exact: true }).last().click();
    for (let i = 1; i <= 6; i++) {
      await pickWeekday(R, i);
      await wait(250);
    }
    await shot('21-avulsa-trocando-dia');
    assert.equal(errors.length, before, `erros na tela: ${errors.slice(before).join(' | ')}`);
    assert.ok((await R.innerText()).includes('Novo agendamento'), 'a tela continua aberta');
    await pickWeekday(R, 2);
    await wait(400);
    await R.getByText('15:00', { exact: true }).last().click();
    await R.getByText('Confirmar agendamento').click();
    await wait(1500);
    assert.ok(db.appointments.some((a) => a.client_phone === '5511988887777'), 'horário gravado');
  });

  await test('profissional com ajustes como os reais e um registro vazio no banco: nova/avulsa trocando de dia não trava', async () => {
    // Como os ajustes do studio de verdade: das 6h às 20h de 15 em 15 minutos, serviços longos e curtos,
    // muitos bloqueios de 15 minutos e horários liberados para as clientes.
    const quarter = (from, to) => {
      const out = [];
      for (let t = from; t < to; t += 15) out.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
      return out;
    };
    const iso = (offset) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const blocks = [[2, 375, 660], [3, 435, 720], [4, 480, 720], [5, 375, 435]].flatMap(([day, from, to]) =>
      quarter(from, to).map((start, i) => ({ id: `b${day}-${i}`, date: iso(day), start, end: quarter(from + 15 * (i + 1), from + 15 * (i + 2))[0] ?? '23:59' })),
    );
    db.settings = [{ id: 1, data: {
      openTime: '06:00', closeTime: '20:00', slotStep: 15, workDays: [1, 2, 3, 4, 5, 6], breaks: [], blocks,
      clientSlots: Object.fromEntries([1, 2, 3, 4, 5, 6].map((w) => [String(w), [...quarter(360, 480), ...quarter(720, 1200)]])),
      services: [
        { id: 'pedicure', name: 'Pedicure', price: 30, active: true, duration: 60 },
        { id: 'pr', name: 'Progressiva (apartir de:)', price: 130, active: true, duration: 240 },
        { id: 's', name: 'Sombrancelha', price: 25, active: true, duration: 10 },
      ],
    } }];
    // Registro antigo e vazio que existe no banco real (de testes): o app não pode quebrar por causa dele.
    db.appointments.push({ id: 'teste-vazio', client_phone: '5511900000001', status: 'cancelado', starts_at: '2030-01-02 10:00', ends_at: '2030-01-02 11:00', data: {} });
    const home = `http://localhost:${site.address().port}/`;
    const before = errors.length;
    await p.goto(home, { waitUntil: 'networkidle' });
    await wait(2000);
    await R.getByText('Agendar', { exact: true }).first().click();
    await wait(800);
    await R.getByText('Nova / avulsa').click();
    await R.getByLabel('Nome', { exact: true }).fill('Teste Real');
    await R.getByLabel('WhatsApp', { exact: true }).fill('31977776666');
    for (const service of ['Pedicure', 'Progressiva (apartir de:)', 'Sombrancelha']) {
      await R.getByText(service, { exact: true }).last().click();
      for (let i = 0; i <= 10; i++) {
        await pickWeekday(R, i);
        await wait(200);
      }
    }
    await shot('22-ajustes-reais');
    assert.equal(errors.length, before, `erros: ${errors.slice(before).join(' | ')}`);
    db.settings = [];
    db.appointments = db.appointments.filter((a) => a.id !== 'teste-vazio');
  });

  await test('profissional agenda cliente avulsa sem WhatsApp (só o nome)', async () => {
    const home = `http://localhost:${site.address().port}/`;
    const clientsBefore = db.clients.length;
    await p.goto(home, { waitUntil: 'networkidle' });
    await wait(1500);
    await R.getByText('Agendar', { exact: true }).first().click();
    await wait(800);
    await R.getByText('Nova / avulsa').click();
    await R.getByLabel('Nome', { exact: true }).fill('Dona Cida');
    // WhatsApp pela metade não passa; em branco, passa.
    await R.getByLabel('WhatsApp', { exact: true }).fill('1199');
    await R.getByText('Pedicure', { exact: true }).last().click();
    await pickWeekday(R, 5);
    await wait(500);
    await R.getByText('16:00', { exact: true }).last().click();
    await R.getByText('Confirmar agendamento').click();
    await R.getByText('Digite um WhatsApp válido com DDD ou deixe em branco.').waitFor();
    await R.getByLabel('WhatsApp', { exact: true }).fill('');
    await R.getByText('Confirmar agendamento').click();
    await wait(1500);
    const appt = db.appointments.find((a) => a.data.clientName === 'Dona Cida');
    assert.ok(appt, 'horário gravado');
    assert.equal(appt.client_phone, '');
    assert.equal(appt.status, 'confirmado');
    assert.equal(db.clients.length, clientsBefore, 'sem WhatsApp não cria cadastro');
    await R.getByText('Não informado').waitFor();
    assert.equal(await R.getByText('Enviar lembrete no WhatsApp').count(), 0, 'sem botões de WhatsApp');
    await shot('23-avulsa-sem-whatsapp');
  });

  await test('intervalo de 0 min: horários colados, o próximo começa quando o anterior termina', async () => {
    const home = `http://localhost:${site.address().port}/`;
    const d = new Date();
    do d.setDate(d.getDate() + 1); while (d.getDay() === 0 || d.getDay() === 6);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    db.settings = [{ id: 1, data: {
      openTime: '06:00', closeTime: '10:00', slotStep: 0, workDays: [1, 2, 3, 4, 5, 6], breaks: [], blocks: [], clientSlots: {},
      services: [
        { id: 'pedicure', name: 'Pedicure', price: 30, active: true, duration: 60 },
        { id: 'manicure', name: 'Manicure tradicional', price: 30, active: true, duration: 40 },
      ],
    } }];
    // Já existe uma manicure das 6:00 às 6:40 nesse dia.
    db.appointments.push({ id: 'colado-1', client_phone: '', status: 'confirmado', starts_at: `${day} 06:00`, ends_at: `${day} 06:40`,
      data: { id: 'colado-1', createdAt: new Date().toISOString(), clientName: 'Primeira', clientPhone: '', serviceName: 'Manicure tradicional', price: 30, duration: 40, date: day, time: '06:00', status: 'confirmado' } });
    await p.goto(home, { waitUntil: 'networkidle' });
    await wait(2000);
    // Ajustes mostra a opção 0 min marcada e a explicação.
    await R.getByLabel('Ajustes').first().click();
    await wait(800);
    await R.getByText('0 min', { exact: true }).waitFor();
    await R.getByText(/Horários colados/).waitFor();
    await p.goto(home, { waitUntil: 'networkidle' });
    await wait(1500);
    await R.getByText('Agendar', { exact: true }).first().click();
    await wait(800);
    await R.getByText('Nova / avulsa').click();
    await R.getByLabel('Nome', { exact: true }).fill('Segunda');
    await R.getByText('Pedicure', { exact: true }).last().click();
    await pickDate(R, d);
    await wait(600);
    for (const t of ['06:40', '07:40', '08:40']) await R.getByText(t, { exact: true }).last().waitFor();
    for (const t of ['06:00', '07:00', '06:15']) assert.equal(await R.getByText(t, { exact: true }).count(), 0, `não oferece ${t}`);
    await shot('26-intervalo-0-min');
    await R.getByText('06:40', { exact: true }).last().click();
    await R.getByText('Confirmar agendamento').click();
    await wait(1500);
    const appt = db.appointments.find((a) => a.data.clientName === 'Segunda');
    assert.match(appt.starts_at, / 06:40$/);
    assert.match(appt.ends_at, / 07:40$/);
    db.settings = [];
  });

  await test('agenda organizada em Semana e nos meses pelo nome (ex.: Novembro, Dezembro)', async () => {
    const home = `http://localhost:${site.address().port}/`;
    const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const now = new Date();
    const [esteMes, proximo] = [0, 1].map((k) => MESES[(now.getMonth() + k) % 12]);
    // Um horário no dia 15 do próximo mês, para aparecer no calendário.
    const y = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
    const day15 = `${y}-${String(((now.getMonth() + 1) % 12) + 1).padStart(2, '0')}-15`;
    db.appointments.push({ id: 'mes-15', client_phone: '', status: 'confirmado', starts_at: `${day15} 10:00`, ends_at: `${day15} 11:00`,
      data: { id: 'mes-15', createdAt: new Date().toISOString(), clientName: 'Cliente do dia 15', clientPhone: '', serviceName: 'Pedicure', price: 30, duration: 60, date: day15, time: '10:00', status: 'confirmado' } });
    await p.goto(home, { waitUntil: 'networkidle' });
    await wait(1500);
    await R.getByRole('button', { name: 'Agenda' }).last().click();
    await wait(800);
    // Semana: os 7 dias da semana atual.
    await R.getByRole('tab', { name: 'Semana' }).waitFor();
    assert.equal(await R.getByRole('button', { name: /^(dom|seg|ter|qua|qui|sex|sáb) \d+/ }).count(), 7);
    // Mês: o calendário do mês atual.
    const cap = (m) => m[0].toUpperCase() + m.slice(1);
    assert.equal(await R.getByRole('tab', { name: 'Próximo mês' }).count(), 0, 'sem o botão "Próximo mês"');
    await R.getByRole('tab', { name: cap(esteMes), exact: true }).click();
    await wait(400);
    await R.getByLabel(`Calendário de ${esteMes}`).waitFor();
    // Próximo mês: o calendário do mês seguinte, com o horário do dia 15.
    await R.getByRole('tab', { name: cap(proximo), exact: true }).click();
    await wait(400);
    await R.getByLabel(`Calendário de ${proximo}`).waitFor();
    await R.getByLabel(new RegExp(`^15 de ${proximo}, 1 horário`)).click();
    // O mês seguinte está fechado para as clientes; a profissional libera o mês inteiro num botão.
    await R.getByText(new RegExp(`${cap(proximo)} está fechado para as clientes`)).waitFor();
    await shot('29-mes-fechado');
    await R.getByRole('button', { name: `Liberar ${proximo}` }).click();
    await wait(1000);
    await R.getByText(`${cap(proximo)} liberado para as clientes agendarem.`).waitFor();
    const nextKey = day15.slice(0, 7);
    assert.deepEqual(db.settings[0].data.releasedMonths, [nextKey]);
    // A cliente passa a ver os horários de dezembro.
    const cli = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const C = cli.locator('#root');
    await cli.goto(home, { waitUntil: 'networkidle' });
    await cli.waitForTimeout(1500);
    await C.getByLabel('Conta', { exact: true }).click();
    await cli.waitForTimeout(400);
    await C.getByText('Cadastro rápido', { exact: true }).click();
    await cli.waitForTimeout(400);
    await C.getByLabel('Nome', { exact: true }).fill('Vera Lúcia');
    await C.getByLabel('WhatsApp', { exact: true }).fill('11955554444');
    await C.getByText('Confirmar e entrar').click();
    await cli.waitForTimeout(1200);
    await C.getByText(/Concordo com o uso/).click();
    await C.getByText('Concluir cadastro').click();
    await cli.waitForTimeout(1200);
    await C.getByText('Agendar horário').last().click();
    await cli.waitForTimeout(800);
    await C.getByText('Pedicure', { exact: true }).last().click();
    await C.getByRole('tab', { name: cap(proximo), exact: true }).click();
    await cli.waitForTimeout(500);
    assert.equal(await C.getByText(/ainda não foi liberada/).count(), 0);
    assert.ok((await C.getByText(/^\d{2}:\d{2}$/).count()) > 0, 'horários de dezembro aparecem');
    await cli.close();
    // E pode fechar de novo.
    await R.getByRole('button', { name: `Fechar ${cap(proximo)}` }).click();
    await wait(800);
    assert.deepEqual(db.settings[0].data.releasedMonths, []);
    db.settings = [];
    await wait(500);
    await R.getByText(new RegExp(`15 de ${proximo}$`)).first().waitFor();
    await R.getByText('Cliente do dia 15', { exact: false }).first().waitFor();
    await shot('28-agenda-proximo-mes');
    db.appointments = db.appointments.filter((a) => a.id !== 'mes-15');
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
    // Sair desconecta só este aparelho: a profissional continua logada nos outros celulares.
    assert.ok(logouts.length >= 2, 'houve saídas no teste');
    assert.ok(logouts.every((scope) => scope === 'local'), `todas as saídas só deste aparelho: ${logouts.join(', ')}`);
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
