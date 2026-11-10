// Testa a função "lembretes" (supabase/functions/lembretes/index.ts) no Deno, contra um Supabase e um
// serviço de push simulados: cria as chaves, envia a notificação criptografada, remove inscrição
// que não vale mais (410) e marca o horário como lembrado.
// Uso: node supabase/test/lembretes.test.js <caminho-do-deno>
//   (o Deno roda a função a partir de uma cópia fora do projeto; precisa de acesso ao npm e do openssl)
const http = require('http'); const https = require('https'); const fs = require('fs'); const os = require('os'); const path = require('path'); const { execFileSync } = require('child_process');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lembretes-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(TMP, 'key.pem'), '-out', path.join(TMP, 'cert.pem'), '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' });
fs.copyFileSync(path.join(__dirname, '../functions/lembretes/index.ts'), path.join(TMP, 'index.ts'));
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; const crypto = require('crypto'); const { spawn } = require('child_process'); const assert = require('assert/strict');
const sub = () => { const e = crypto.createECDH('prime256v1'); e.generateKeys(); return { p256dh: e.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') }; };
const state = { config: null, marked: null, cancelMarked: null, noticesMarked: null, deleted: [], pushes: [] };
let port; let pushPort;
const pushServer = https.createServer({ key: fs.readFileSync(path.join(TMP, 'key.pem')), cert: fs.readFileSync(path.join(TMP, 'cert.pem')) }, (req, res) => {
  let raw = ''; req.on('data', (c) => (raw += c)); req.on('end', () => {
    const u = new URL(req.url, 'http://x');
    state.pushes.push({ path: u.pathname, auth: req.headers.authorization, enc: req.headers['content-encoding'], ttl: req.headers.ttl, len: raw.length });
    res.writeHead(u.pathname === '/push/gone' ? 410 : 201); res.end();
  });
});
const api = http.createServer((req, res) => {
  let raw = ''; req.on('data', (c) => (raw += c)); req.on('end', () => {
    const u = new URL(req.url, 'http://x'); const obj = (req.headers.accept || '').includes('object+json');
    const send = (s, b) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(b === undefined ? '' : JSON.stringify(b)); };
    const one = (row) => obj ? (row ? send(200, row) : send(406, { code: 'PGRST116', message: 'no rows' })) : send(200, row ? [row] : []);
    if (u.pathname.startsWith('/push/')) { state.pushes.push({ path: u.pathname, auth: req.headers.authorization, enc: req.headers['content-encoding'], ttl: req.headers.ttl, len: raw.length }); return send(u.pathname === '/push/gone' ? 410 : 201, {}); }
    if (u.pathname === '/rest/v1/push_config' && req.method === 'GET') return one(state.config);
    if (u.pathname === '/rest/v1/push_config' && req.method === 'POST') { state.config = JSON.parse(raw); return send(201, []); }
    if (u.pathname === '/rest/v1/settings') return one({ data: { studioName: 'Studio Cores & Fios' } });
    if (u.pathname === '/rest/v1/rpc/due_reminders') {
      const a = sub(), b = sub();
      return send(200, [
        { appointment_id: 'a1', starts_at: '2026-10-31T15:30:00', data: { serviceName: 'Esmaltação em gel' }, endpoint: `https://localhost:${pushPort}/push/ok`, ...a },
        { appointment_id: 'a1', starts_at: '2026-10-31T15:30:00', data: { serviceName: 'Esmaltação em gel' }, endpoint: `https://localhost:${pushPort}/push/gone`, ...b },
      ]);
    }
    if (u.pathname === '/rest/v1/rpc/due_cancel_notices') {
      return send(200, [{ appointment_id: 'c1', data: { clientName: 'Paula Lima', serviceName: 'Manicure', date: '2026-11-04', time: '14:00' }, endpoint: `https://localhost:${pushPort}/push/pro`, ...sub() }]);
    }
    if (u.pathname === '/rest/v1/rpc/due_owner_notices') {
      const pro = `https://localhost:${pushPort}/push/pedidos`;
      return send(200, [
        { notice_id: 7, kind: 'agendamento', appointment_id: 'n1', data: { clientName: 'Ana', serviceName: 'Pedicure', date: '2026-11-05', time: '10:00' }, endpoint: pro, ...sub() },
        { notice_id: 8, kind: 'cancelamento', appointment_id: 'n2', data: { clientName: 'Bia', serviceName: 'Manicure', date: '2026-11-06', time: '15:00' }, endpoint: pro, ...sub() },
      ]);
    }
    if (u.pathname === '/rest/v1/rpc/due_game_announcements') {
      const c = `https://localhost:${pushPort}/push/clientes`;
      return send(200, [
        { campaign_id: 'g1', data: { title: 'Esmalte Express', prize: 'Gel grátis' }, ends_on: '2026-11-15', endpoint: c, ...sub() },
        { campaign_id: 'g1', data: { title: 'Esmalte Express', prize: 'Gel grátis' }, ends_on: '2026-11-15', endpoint: c, ...sub() },
      ]);
    }
    if (u.pathname === '/rest/v1/rpc/mark_game_announced') { state.gamesMarked = JSON.parse(raw).ids; return send(200, null); }
    if (u.pathname === '/rest/v1/rpc/mark_owner_notified') { state.noticesMarked = JSON.parse(raw).ids; return send(200, null); }
    if (u.pathname === '/rest/v1/rpc/mark_cancel_notified') { state.cancelMarked = JSON.parse(raw).ids; return send(200, null); }
    if (u.pathname === '/rest/v1/rpc/mark_reminded') { state.marked = JSON.parse(raw).ids; return send(200, null); }
    if (u.pathname === '/rest/v1/push_subscriptions' && req.method === 'DELETE') { state.deleted.push(u.searchParams.get('endpoint')); return send(204); }
    send(404, { message: 'nao simulado: ' + req.method + ' ' + u.pathname });
  });
});
pushServer.listen(0, () => { pushPort = pushServer.address().port; });
api.listen(0, async () => {
  port = api.address().port;
  await new Promise((r) => setTimeout(r, 300));
  const deno = spawn(process.argv[2], ['run', '--unsafely-ignore-certificate-errors=localhost', '--allow-net', '--allow-env', '--allow-read', '--allow-sys', path.join(TMP, 'index.ts')], {
    cwd: TMP,
    env: { ...process.env, SUPABASE_URL: `http://localhost:${port}`, SUPABASE_SERVICE_ROLE_KEY: 'chave-de-teste', PORT: '8000', NO_PROXY: 'localhost,127.0.0.1', no_proxy: 'localhost,127.0.0.1' },
  });
  let log = ''; deno.stdout.on('data', (d) => (log += d)); deno.stderr.on('data', (d) => (log += d));
  let out;
  for (let i = 0; i < 120 && !out; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try { out = await (await fetch('http://localhost:8000/', { method: 'POST' })).json(); } catch {}
  }
  deno.kill(); api.close(); pushServer.close();
  if (!out) { console.error(log); process.exit(1); }
  console.log('resposta:', out);
  assert.deepEqual(out, { horarios: 1, enviados: 1, removidos: 1, cancelamentos: 1, pedidos: 2, avisos: 3, jogos: 1, promocoes: 2 });
  assert.deepEqual(state.gamesMarked, ['g1']);
  assert.equal(state.pushes.filter((p) => p.path === '/push/clientes').length, 2);
  assert.ok(state.config?.public_key && state.config?.private_key, 'chaves VAPID criadas e guardadas');
  assert.deepEqual(state.marked, ['a1']);
  assert.deepEqual(state.deleted, [`eq.https://localhost:${pushPort}/push/gone`]);
  const ok = state.pushes.find((p) => p.path === '/push/ok');
  assert.match(ok.auth, /^vapid t=.+, k=/); assert.equal(ok.enc, 'aes128gcm'); assert.equal(ok.ttl, '3600'); assert.ok(ok.len > 100);
  // Aviso de cancelamento para a profissional.
  assert.deepEqual(state.cancelMarked, ['c1']);
  assert.deepEqual(state.noticesMarked, [7, 8]);
  assert.equal(state.pushes.filter((p) => p.path === '/push/pedidos').length, 2);
  const pro = state.pushes.find((p) => p.path === '/push/pro');
  assert.equal(pro.enc, 'aes128gcm'); assert.equal(pro.ttl, '86400'); assert.ok(pro.len > 100);
  console.log('ok: chaves criadas, notificação criptografada enviada, inscrição removida (410), lembrete marcado, avisos de pedido de horário e de cancelamento enviados à profissional, promoção do jogo enviada às clientes uma vez');
});
