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
    try { await fn(); console.log(`ok   ${name}`); } catch (e) { await p.screenshot({ path: path.join(PRINTS, 'falha-' + name.slice(0, 20).replace(/\W+/g, '-') + '.png') }).catch(() => {}); errors.push(`${name}: ${e.message.split('\n')[0]}`); console.log(`FALHA ${name}`); }
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
  await step('Agenda: confirmar pedido, dia completo e bloqueio', async () => {
    await R.getByText(/aguardando sua confirmação/).waitFor();
    await R.getByText('Ver ›').first().click(); await p.waitForTimeout(500);
    await R.getByText('Confirmar horário').click();
    await R.getByText(/que está confirmado/).waitFor(); await shot('03b-confirmado'); await back();
    await R.getByText('Dia completo').waitFor();
    await R.getByLabel(/^Bloquear \d\d:\d\d$/).first().click(); await p.waitForTimeout(300);
    await R.getByText('Desbloquear').first().waitFor(); await shot('03c-dia-completo');
    await R.getByText('Desbloquear').first().click();
    await R.getByLabel('Bloquear horário').click(); await p.waitForTimeout(500);
    await R.getByText(/Bloquear o dia inteiro/).click();
    await R.getByText('Bloquear', { exact: true }).last().click(); await p.waitForTimeout(500);
    await R.getByText('Desbloquear o dia').waitFor(); await shot('03d-dia-bloqueado');
    await R.getByText('Desbloquear o dia').click();
  });
  await step('Novo agendamento só com horários livres', async () => {
    await R.getByLabel('Novo agendamento').click(); await p.waitForTimeout(500);
    await R.getByText('Esmaltação em gel', { exact: true }).last().click();
    await R.getByText('Horário', { exact: true }).waitFor(); await shot('04-novo-agendamento'); await back();
  });
  await step('Financeiro', async () => { await tab('Financeiro'); await R.getByText('Previsto a receber').waitFor(); await R.getByText('A receber dos horários marcados').waitFor(); await shot('05-financeiro');
    await R.getByText('Semana', { exact: true }).click(); await p.waitForTimeout(300); await shot('05b-financeiro-semana');
    await R.getByText('Mês', { exact: true }).click(); });
  await step('Cadastro rápido com código do WhatsApp', async () => {
    await tab('Clientes');
    await R.getByText('Cadastro rápido', { exact: true }).click(); await p.waitForTimeout(500);
    await R.getByLabel('Nome', { exact: true }).fill('Teste');
    await R.getByLabel('WhatsApp', { exact: true }).fill('11955550000');
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
  await step('Ajustes: serviços, horários liberados e Premium', async () => {
    await tab('Início');
    await R.getByLabel('Ajustes').first().click(); await p.waitForTimeout(500);
    await R.getByText('Serviços, preços e tempo').click(); await p.waitForTimeout(500);
    await R.getByText('Adicionar serviço').click();
    await R.getByLabel('Serviço', { exact: true }).last().fill('Blindagem');
    await R.getByLabel('Preço (R$)').last().fill('80');
    await R.getByText('Salvar serviços').click(); await R.getByText('Serviços salvos').waitFor(); await shot('10-servicos'); await back();
    await R.getByText('Horários liberados e pausas').click(); await p.waitForTimeout(500);
    await R.getByLabel('12:00 liberado').click(); await R.getByLabel('12:00 bloqueado').waitFor();
    await R.getByText('Adicionar pausa').click();
    await R.getByLabel('12:00 em pausa').waitFor();
    await R.getByText('Salvar horários').click(); await R.getByText('Horários salvos').waitFor(); await shot('11-horarios'); await back();
    await R.getByText('Benefícios do Premium').click(); await p.waitForTimeout(500);
    await R.getByLabel('Desconto no aniversário (%)').fill('20');
    await R.getByText('20% de desconto no mês do aniversário').waitFor();
    await R.getByText('Salvar benefícios').click(); await R.getByText('Benefícios salvos').waitFor(); await shot('12-premium'); await back(); await back();
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

  await step('WhatsApp da profissional e atalho de temas no topo', async () => {
    await tab('Início');
    if (await R.getByLabel(/WhatsApp do studio/).count()) throw new Error('botão do WhatsApp aparece sem número cadastrado');
    await R.getByLabel('Cadastrar seu WhatsApp para as clientes').waitFor();
    await R.getByLabel('Ajustes').first().click(); await p.waitForTimeout(400);
    await R.getByPlaceholder('(11) 98765-4321').fill('11987654321');
    await R.getByText('Salvar ajustes').click(); await back();
    await p.context().route(/wa\.me/, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }));
    const [wa] = await Promise.all([p.waitForEvent('popup', { timeout: 5000 }), R.getByLabel(/WhatsApp do studio/).click()]);
    await wa.waitForURL(/wa\.me\/5511987654321/, { timeout: 5000 }); await wa.close();
    await shot('14-perfil-botoes');
    await R.getByLabel('Tema do app').click(); await p.waitForTimeout(400);
    await R.getByText('Escolha as cores do app no seu celular').waitFor(); await back();
  });
  await step('Instagram e os 5 temas', async () => {
    await tab('Início');
    const ig = R.getByLabel(/Instagram do studio/);
    await ig.waitFor();
    // O Instagram não é acessado de verdade: só confere o endereço que o botão abre.
    await p.context().route(/instagram\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }));
    const [popup] = await Promise.all([p.waitForEvent('popup', { timeout: 5000 }), ig.click()]);
    await popup.waitForURL(/instagram\.com\/js\.cooresefios/, { timeout: 5000 });
    await popup.close();
    for (const [name, plum] of [['Romântico', 'rgb(74, 21, 48)'], ['Nude', 'rgb(59, 47, 40)'], ['Básico', 'rgb(22, 22, 22)'], ['Tecnologia', 'rgb(15, 23, 42)'], ['Rosé Gold', 'rgb(43, 18, 32)']]) {
      await R.getByLabel('Ajustes').first().click(); await p.waitForTimeout(400);
      await R.getByText('Tema do app').click(); await p.waitForTimeout(400);
      await Promise.all([p.waitForEvent('load'), R.getByLabel(new RegExp(`^Tema ${name}:`)).click()]);
      await p.waitForTimeout(1500);
      await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
      const bg = await R.getByRole('button', { name: 'Publicar' }).first().evaluate((el) => getComputedStyle(el).backgroundColor);
      if (bg !== plum) throw new Error(`tema ${name}: cor ${bg}, esperado ${plum}`);
      await shot(`13-tema-${name.normalize('NFD').replace(/[^a-zA-Z]/g, '').toLowerCase()}`);
    }
  });

  await browser.close();
  server.close();
  if (errors.length) {
    console.error('\nProblemas encontrados:\n' + errors.join('\n'));
    process.exit(1);
  }
  console.log(`\nTudo certo. Prints em ${PRINTS}`);
})();
