// Confere o site do GitHub Pages (dist-pages/) servido localmente em /Cores---fios/, contra o Supabase real:
// link direto, PWA e o caminho completo de uma cliente de teste (cadastro só com WhatsApp e exclusão).
// Uso: python3 tools/web/build-pages.py && node tools/web/check-pages.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { chromium } = require('playwright');

const DIST = path.resolve(__dirname, '../../dist-pages');
const BASE = '/Cores---fios';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };

// Imita o GitHub Pages: arquivo existente ou, senão, o 404.html (que é o app).
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = url.startsWith(BASE) ? path.join(DIST, url.slice(BASE.length)) : null;
  const found = file && fs.existsSync(file) && fs.statSync(file).isFile();
  const target = found ? file : path.join(DIST, '404.html');
  res.writeHead(found ? 200 : 404, { 'Content-Type': TYPES[path.extname(target)] ?? 'application/octet-stream' });
  fs.createReadStream(target).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const site = `http://localhost:${server.address().port}${BASE}`;
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy: proxy && { ...proxy, bypass: 'localhost' } });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // No GitHub Pages, o link direto chega como 404 (o 404.html é o app); qualquer outro 404 é erro.
  page.on('response', (r) => r.status() === 404 && r.request().resourceType() !== 'document' && errors.push(`404: ${r.url()}`));
  page.on('console', (m) => m.type() === 'error' && !/realtime|websocket|status of 404/i.test(m.text()) && errors.push(m.text()));
  const R = page.locator('#root');
  const shots = path.resolve(__dirname, '../../dist-teste/prints-pages');
  fs.mkdirSync(shots, { recursive: true });
  const step = async (name, fn) => {
    await fn();
    console.log('ok  ', name);
  };

  await step('manifesto e ícones no subcaminho', async () => {
    const manifest = await (await fetch(`${site}/manifest.json`)).json();
    assert.equal(manifest.start_url, `${BASE}/`);
    for (const icon of manifest.icons) assert.equal((await fetch(`http://localhost:${server.address().port}${icon.src}`)).status, 200);
  });
  await step('link direto abre o agendamento', async () => {
    await page.goto(`${site}/agendamento/novo`, { waitUntil: 'networkidle' });
    await R.getByText('Entrar com WhatsApp').waitFor({ timeout: 20000 });
    await page.screenshot({ path: path.join(shots, '01-link.png') });
  });
  await step('cliente de teste se cadastra só com o WhatsApp (gravado no Supabase)', async () => {
    await R.getByText('Fazer cadastro rápido').click();
    await page.waitForTimeout(600);
    await R.getByLabel('Nome', { exact: true }).fill('Teste Claude');
    // Número fictício diferente a cada execução (o número fica preso ao aparelho até a cliente sair).
    await R.getByLabel('WhatsApp').fill(`119000${String(Date.now()).slice(-5)}`);
    await R.getByText('Confirmar e entrar').click();
    await R.getByText(/verificado/).first().waitFor({ timeout: 20000 });
    await R.getByText(/Concordo com o uso/).click();
    await R.getByText('Concluir cadastro').click();
    await R.getByText(/Cadastro concluído/).waitFor({ timeout: 20000 });
    await page.screenshot({ path: path.join(shots, '02-cadastro.png') });
  });
  await step('cliente de teste apaga o próprio cadastro e sai', async () => {
    await R.getByText('Excluir cadastro').click();
    await R.getByText('Apagar', { exact: true }).click();
    // Só termina quando a saída (que solta o número) foi concluída: a aba Conta volta a oferecer "entrar".
    await R.getByText('Já tenho cadastro: entrar').waitFor({ timeout: 20000 });
  });

  await browser.close();
  server.close();
  if (errors.length) {
    console.error('\nErros:\n' + [...new Set(errors)].join('\n'));
    process.exit(1);
  }
  console.log('\nSite pronto para o GitHub Pages.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
