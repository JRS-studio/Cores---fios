// Teste de fumaça da página de teste: percorre o app num celular simulado e falha se algo quebrar.
// Uso (na raiz, depois do build.py):  node tools/pagina-de-teste/smoke.js
// Requer Playwright com Chromium (require('playwright')).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DIST = path.resolve(__dirname, '../../dist-teste');
const PRINTS = path.join(DIST, 'prints');
const page = fs.readFileSync(path.join(DIST, 'cores-e-fios-teste.html'));

(async () => {
  fs.mkdirSync(PRINTS, { recursive: true });
  // A página reescreve a URL para "/" e as rotas do app mudam o caminho: qualquer caminho serve a mesma página.
  const server = http.createServer((_, res) => res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(page));
  await new Promise((r) => server.listen(0, r));
  const url = `http://localhost:${server.address().port}/`;

  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const R = p.locator('#root');
  const shot = async (name) => { await p.waitForTimeout(400); await p.screenshot({ path: path.join(PRINTS, `${name}.png`) }); };
  const tab = async (label) => { await R.getByLabel(label, { exact: true }).click(); await p.waitForTimeout(500); };
  const back = async () => { await R.getByLabel('Voltar').last().click(); await p.waitForTimeout(500); };
  const step = async (name, fn) => {
    try { await fn(); console.log(`ok   ${name}`); } catch (e) { errors.push(`${name}: ${e.message.split('\n')[0]}`); console.log(`FALHA ${name}`); }
  };

  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);

  await step('Início em formato de feed', async () => {
    await R.getByText('horários hoje').waitFor();
    await R.getByText(/Semana da francesinha/).waitFor();
    if (await R.getByText(/Provador/).count()) throw new Error('Provador ainda aparece');
    await shot('01-inicio');
  });
  await step('Agenda e detalhe do horário', async () => {
    await tab('Agenda'); await shot('02-agenda');
    await R.getByText('Mariana Alves').last().click(); await p.waitForTimeout(500);
    await R.getByText(/alergia: Acetona/).waitFor(); await shot('03-horario'); await back();
  });
  await step('Novo agendamento só com horários livres', async () => {
    await R.getByLabel('Novo agendamento').click(); await p.waitForTimeout(500);
    await R.getByText('Esmaltação em gel', { exact: true }).last().click();
    await R.getByText('Horário', { exact: true }).waitFor(); await shot('04-novo-agendamento'); await back();
  });
  await step('Financeiro', async () => { await tab('Financeiro'); await R.getByText('Lucro do mês').waitFor(); await shot('05-financeiro'); });
  await step('Cadastro rápido com código do WhatsApp', async () => {
    await tab('Clientes');
    await R.getByText('Cadastro rápido', { exact: true }).click(); await p.waitForTimeout(500);
    await R.getByLabel('Nome', { exact: true }).fill('Teste');
    await R.getByLabel('WhatsApp').fill('11955550000');
    await R.getByText('Enviar código pelo WhatsApp').click(); await p.waitForTimeout(300);
    const code = (await R.getByText(/seu código é/).last().innerText()).match(/(\d{6})/)[1];
    await R.getByLabel('Código de verificação').fill(code); await p.waitForTimeout(300);
    await R.getByText(/WhatsApp .* verificado/).waitFor();
    if (await R.getByText('CPF').count()) throw new Error('campo CPF ainda aparece');
    await R.getByText(/Concordo com o uso/).click();
    await R.getByText('Concluir cadastro').click(); await p.waitForTimeout(600);
    await R.getByText(/Cadastro concluído/).waitFor(); await shot('06-cadastro'); await back();
  });
  await step('Política de privacidade', async () => {
    await tab('Início');
    await R.getByLabel('Ajustes').first().click(); await p.waitForTimeout(500);
    await R.getByText('Política de privacidade').click(); await p.waitForTimeout(500);
    await R.getByText('Quem cuida dos seus dados').waitFor(); await shot('07-privacidade'); await back(); await back();
  });
  await step('Avaliação aparece no feed', async () => {
    await R.getByLabel('Avaliações', { exact: true }).click(); await p.waitForTimeout(500);
    await R.getByText('Deixar minha avaliação').click(); await p.waitForTimeout(500);
    await R.getByLabel('5 estrelas: Excelente').click();
    await R.getByPlaceholder(/Atendimento, acabamento/).fill('Amei a esmaltação!');
    await R.getByText('Anônima', { exact: true }).click();
    await R.getByText('Publicar avaliação').click(); await p.waitForTimeout(600);
    await R.getByText(/Avaliação publicada/).waitFor(); await shot('08-avaliacoes'); await back();
    await R.getByText('Amei a esmaltação!').first().waitFor();
  });
  await step('Publicação da manicure e curtida', async () => {
    await R.getByRole('button', { name: 'Publicar' }).last().click(); await p.waitForTimeout(500);
    await R.getByText('Novidade', { exact: true }).click();
    await R.getByLabel('Legenda').fill('Chegaram as cores de verão!');
    await R.getByText('Publicar', { exact: true }).last().click(); await p.waitForTimeout(800);
    await R.getByText('Chegaram as cores de verão!').first().waitFor();
    await R.getByLabel('Curtir').first().click(); await p.waitForTimeout(300);
    await R.getByLabel('Descurtir').first().waitFor();
    await shot('09-feed');
  });

  await browser.close();
  server.close();
  if (errors.length) {
    console.error('\nProblemas encontrados:\n' + errors.join('\n'));
    process.exit(1);
  }
  console.log(`\nTudo certo. Prints em ${PRINTS}`);
})();
