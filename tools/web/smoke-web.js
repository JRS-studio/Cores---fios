// Testa a versão web publicável (expo export -p web): layout no computador e no celular,
// link direto para o agendamento, PWA (manifesto e ícones) e o link da profissional para as clientes.
// Uso (na raiz):
//   EXPO_PUBLIC_SUPABASE_URL=http://localhost:54330 EXPO_PUBLIC_SUPABASE_ANON_KEY=teste \
//   EXPO_PUBLIC_WEB_URL=https://cores-e-fios.expo.app CI=1 npx expo export -p web --output-dir dist-teste/site
//   node tools/web/smoke-web.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { chromium } = require('playwright');

const SITE = path.resolve(__dirname, '../../dist-teste/site');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };

// Hospedagem de página única: arquivo existente ou, senão, index.html.
const site = http.createServer((req, res) => {
  const file = path.join(SITE, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(SITE, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(target)] ?? 'application/octet-stream' });
  fs.createReadStream(target).pipe(res);
});

// Imitação mínima do Supabase: sem dados; a profissional entra com e-mail e senha.
let owner = false;
const api = http.createServer((req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };
  if (req.method === 'OPTIONS') return send(204);
  const p = new URL(req.url, 'http://x').pathname;
  req.resume();
  req.on('end', () => {
    if (p === '/auth/v1/token') {
      owner = true;
      const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const id = '00000000-0000-0000-0000-0000000000a1';
      return send(200, {
        access_token: `${b64({ alg: 'HS256' })}.${b64({ sub: id, role: 'authenticated', exp })}.x`,
        token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'r',
        user: { id, aud: 'authenticated', role: 'authenticated', email: 'juliana@studio.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
      });
    }
    if (p === '/rest/v1/rpc/is_owner') return send(200, owner);
    if (p === '/rest/v1/rpc/busy_slots') return send(200, []);
    if (p.startsWith('/rest/v1/')) return send(200, []);
    send(200, {});
  });
});

(async () => {
  await new Promise((r) => site.listen(0, r));
  await new Promise((r) => api.listen(54330, r));
  const base = `http://localhost:${site.address().port}`;
  const shots = path.resolve(__dirname, '../../dist-teste/prints-web');
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch();
  const errors = [];
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && !/realtime|websocket/i.test(m.text()) && errors.push(m.text()));
  };
  let passed = 0;
  const test = async (name, fn) => {
    await fn();
    passed += 1;
    console.log('ok  ', name);
  };

  await test('PWA: manifesto, ícones e página em pt-BR', async () => {
    const manifest = await (await fetch(`${base}/manifest.json`)).json();
    assert.equal(manifest.lang, 'pt-BR');
    assert.equal(manifest.display, 'standalone');
    for (const icon of manifest.icons) assert.equal((await fetch(base + icon.src)).status, 200, icon.src);
    const html = await (await fetch(base)).text();
    assert.match(html, /<html lang="pt-BR">/);
    assert.match(html, /<title>Cores &(amp;)? Fios<\/title>/);
    assert.match(html, /rel="manifest"/);
  });

  await test('celular: link direto abre o agendamento e pede o WhatsApp, sem instalar nada', async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    watch(page);
    await page.goto(`${base}/agendamento/novo`, { waitUntil: 'networkidle' });
    await page.getByText('Entrar com WhatsApp').waitFor();
    const box = await page.locator('#root').boundingBox();
    assert.equal(Math.round(box.width), 390);
    await page.screenshot({ path: path.join(shots, '01-celular-link.png') });
    await page.close();
  });

  await test('computador: app centralizado na largura de um celular', async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    watch(page);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.getByText('Acesso rápido').waitFor();
    const box = await page.locator('#root').boundingBox();
    assert.equal(Math.round(box.width), 480);
    assert.equal(Math.round(box.x), 400);
    await page.screenshot({ path: path.join(shots, '02-computador.png') });
    await page.close();
  });

  await test('profissional vê o link para enviar às clientes', async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    watch(page);
    await page.goto(`${base}/entrar`, { waitUntil: 'networkidle' });
    await page.getByText('Sou a profissional').click();
    await page.getByLabel('E-mail').fill('juliana@studio.com');
    await page.getByLabel('Senha').fill('senha123');
    await page.getByRole('button', { name: 'Entrar' }).last().click();
    await page.getByText('Você entrou como profissional.').first().waitFor();
    await page.goto(`${base}/ajustes`, { waitUntil: 'networkidle' });
    await page.getByText('https://cores-e-fios.expo.app/agendamento/novo').waitFor();
    await page.screenshot({ path: path.join(shots, '03-link-clientes.png') });
    await page.close();
  });

  await browser.close();
  site.close();
  api.close();
  if (errors.length) {
    console.error('\nErros no app:\n' + [...new Set(errors)].join('\n'));
    process.exit(1);
  }
  console.log(`\n${passed} testes da versão web passaram.`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
