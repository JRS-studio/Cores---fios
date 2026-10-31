# Cores & Fios

App para manicures (Android e iOS) feito com **Expo / React Native** e **Expo Router**.

<img src="docs/home.png" width="260" alt="Página inicial em formato de feed" />

## Módulos

| Módulo | Status |
| --- | --- |
| Página inicial em formato de rede social (publicações do studio, avaliações, curtidas) | ✅ Pronto |
| Agenda de clientes | ✅ Pronto |
| Financeiro | ✅ Pronto |
| Ajustes do studio | ✅ Pronto |
| Clientes: cadastro rápido e Premium com programa fidelidade | ✅ Pronto |
| Avaliações com foto, estrelas e opção anônima | ✅ Pronto |

## Página inicial (feed)

A tela inicial funciona como o perfil de uma rede social:

- **Perfil do studio**: foto (inicial do studio), número de publicações, de avaliações e a nota média. Para a cliente, botões **Agendar horário** e **Avaliar**; para a profissional, **Publicar** e **Agenda**.
- **Atalhos em círculos**, como destaques: agendar, despesa, nova cliente, avaliações e ajustes (profissional) ou agendar, horários, avaliar e conta (cliente).
- **Resumo do dia** só para a profissional (horários de hoje, próxima cliente, recebido hoje); a cliente vê o **próximo horário** dela.
- **Feed** com as publicações da profissional e as avaliações das clientes, da mais nova para a mais antiga, com filtro (Tudo, Do studio, Avaliações).
- **Publicações** da profissional (`src/app/publicacao/nova.tsx`): até 4 fotos que passam para o lado, ou só texto em destaque, com o tipo (trabalho feito, promoção, novidade ou aviso). A profissional pode excluir.
- **Curtidas** com o coração ou com dois toques na foto. Quem não tem cadastro também curte (o app faz um login anônimo, sem pedir nada). **Compartilhar** abre o menu do celular ou o WhatsApp.
- O **+** no meio da barra de baixo publica (profissional) ou agenda (cliente).

## Agenda

- Faixa de dias com marcação de quantos horários há em cada um; dias fechados aparecem apagados.
- **Novo agendamento**: cliente cadastrada (com alerta de alergia e preferências) ou avulsa (pode virar cadastro rápido), serviço com duração e preço (`src/data/services.ts`), desconto de aniversário para Premium e **só os horários livres**, calculados pela duração do serviço, pelo horário de funcionamento e pelos horários já ocupados.
- **Confirmação:** o horário que a cliente marca fica **"A confirmar"** até a profissional tocar em **Confirmar horário** (depois ela avisa a cliente pelo WhatsApp com a mensagem pronta). A Agenda mostra os pedidos aguardando confirmação. O que a própria profissional marca já nasce confirmado.
- **Dia completo**: a profissional vê todos os horários do dia (livres, ocupados, pausas e bloqueios), agenda ou bloqueia um horário livre com um toque e desbloqueia quando quiser.
- **Bloquear horário** (`src/app/bloqueio.tsx`): um período ou o dia inteiro (folga, feriado), com motivo opcional.
- **Pausas fixas** (Ajustes › Horários liberados e pausas): ex.: almoço das 12h às 13h nos dias escolhidos.
- No horário: confirmar presença, pedir confirmação ou lembrete no **WhatsApp**, remarcar, cancelar ou marcar falta.
- **Concluir atendimento** registra o pagamento (Pix, dinheiro, débito ou crédito), lança a entrada no financeiro e, se a cliente for Premium, dá o selo do cartão fidelidade.

## Financeiro

- Resumo rápido de **hoje, da semana e do mês**: quanto já entrou e quanto ainda está **previsto** pelos horários marcados.
- Visão por **dia, semana, mês ou ano**: recebido, previsto a receber, total esperado, saídas e lucro; meta do mês com o que já entrou e o que está marcado.
- Lista do que falta receber (horários marcados), com alerta dos que já passaram sem conclusão.
- Atendimentos realizados e a realizar, ticket médio e faltas.
- Gráficos: entradas por dia, entradas por forma de pagamento e saídas por categoria (cores validadas para daltonismo e contraste), e ranking dos serviços que mais faturaram.
- Lançamentos manuais de despesas e outras entradas, com filtro e exclusão.

## Ajustes

- Nome da profissional e do studio, **WhatsApp da profissional**, meta do mês, horário de funcionamento, dias de atendimento e intervalo entre horários.
- **Serviços, preços e tempo**: criar, editar, pausar e remover serviços (`src/app/ajustes/servicos.tsx`).
- **Horários liberados para as clientes**: por dia da semana, quais horários a cliente pode escolher; a profissional agenda em qualquer um.
- **Benefícios do Premium**: atendimentos para o prêmio, prêmio, selos de boas-vindas e de indicação, desconto de aniversário e benefícios extras escritos à mão.
- Com o WhatsApp preenchido, ao agendar a cliente abre o WhatsApp com a mensagem pronta para a profissional (sem uma API paga de WhatsApp, o envio automático não é possível; a cliente só toca em enviar).
- **Instagram e WhatsApp do studio**: botões no perfil da página inicial (o WhatsApp é o cadastrado nos Ajustes; o Instagram aceita @perfil ou o link colado). Atalho para o tema no topo da tela inicial (só a profissional).
- **Tema do app** (`src/theme/themes.ts`): Romântico, Rosé Gold, Nude, Básico e Tecnologia. Vale para todas as clientes; o app recarrega uma vez ao trocar.
- Sem servidor, a opção de apagar todos os dados do aparelho.

## Avaliações

Na página inicial, **Avaliar** (ou "Como ficaram suas unhas?") abre o formulário: foto do resultado (câmera ou galeria), nota de 1 a 5 estrelas, serviço realizado, comentário e a escolha entre publicar **com o nome** ou como **anônima**. A avaliação aparece no feed da página inicial. A lista completa mostra a média, a distribuição das notas e filtros (com foto, 5 estrelas); a profissional pode remover uma avaliação.

## Cadastro de clientes

Campos escolhidos a partir do que sistemas de agendamento de salão e fichas de manicure costumam pedir. **O app não pede documentos (CPF etc.)**: a cliente se identifica só pelo WhatsApp, confirmado com um código de 6 dígitos (`src/features/verification/`). Nesta versão, sem servidor, o código é gerado no aparelho e mostrado na tela; ao ligar um servidor, ele passa a ser enviado pela API do WhatsApp Business (ou SMS) sem mudar as telas.

| | Rápido | Premium |
| --- | --- | --- |
| Para quem | Agenda de vez em quando | Cliente recorrente |
| Dados | Nome e WhatsApp | Nome e WhatsApp; e-mail, nascimento (desconto de aniversário) e endereço (domicílio) opcionais; canal de contato |
| Validação | Código pelo WhatsApp | Código pelo WhatsApp |
| Preferências | – | Formato, comprimento, até 5 cores favoritas, melhores horários, como conheceu / quem indicou |
| Ficha de saúde | – | Alergias, condições (diabetes, circulação, gestante, anticoagulante, unhas frágeis, micose) e observações — só salva com autorização específica (dado sensível pela LGPD) |
| Fidelidade | – | Cartão de 10 selos = 1 esmaltação em gel grátis, selo de boas-vindas, 15% no mês do aniversário, +2 selos por indicação, níveis Rosé, Ouro e Diamante |

O cadastro rápido pode virar Premium aproveitando os dados. No perfil, a profissional registra atendimentos (+1 selo), bônus de indicação e o resgate do prêmio; a cliente pode editar ou excluir o cadastro. Regras da fidelidade em `src/data/loyalty.ts`.

Os dados ficam salvos **no aparelho** (AsyncStorage; fotos na pasta de documentos do app). Para clientes e profissional compartilharem os mesmos dados entre celulares, o próximo passo é um backend (ex.: Supabase ou Firebase).

## Como rodar

```bash
npm install
npx expo start
```

Depois, escaneie o QR Code com o app **Expo Go** (Android ou iPhone), ou pressione `a` (emulador Android) / `i` (simulador iOS).

Antes de enviar mudanças:

```bash
npx tsc --noEmit
npx expo lint
```

## Página de teste

Gera o app inteiro (versão web) num único arquivo HTML, com roteiro do que testar e dados de exemplo (clientes fictícias, um mês de atendimentos e despesas, datas relativas ao dia em que for aberta):

```bash
python3 tools/pagina-de-teste/build.py          # saída: dist-teste/cores-e-fios-teste.html
node tools/pagina-de-teste/smoke.js             # percorre o app e falha se algo quebrar (Playwright)
```

## Publicar nas lojas

Ícone, ícone adaptativo do Android, tela de abertura e favicon são gerados por `python3 tools/brand/generate_icons.py`. O build é feito na nuvem pelo EAS (não precisa de Mac nem Android Studio):

```bash
npx eas-cli@latest login
npx eas-cli@latest build --profile preview --platform android     # APK para instalar e testar
npx eas-cli@latest build --profile production --platform all      # versões para Google Play e App Store
npx eas-cli@latest submit --platform all                          # envia para as lojas
```

Antes de publicar:

- Contas de desenvolvedor: Google Play (taxa única) e Apple Developer (anual).
- Hospedar `docs/politica-de-privacidade.md` (com o nome e o WhatsApp do studio) e informar a URL nas lojas.
- Identificadores do app: `com.coresefios.app` (iOS e Android), em `app.json`.

## Versão web (sem instalar nada)

O mesmo app roda no navegador do celular ou do computador: a cliente abre um link e agenda, sem baixar nada. No computador ele aparece centralizado, na largura de um celular. É um PWA: no celular dá para tocar em "Adicionar à tela inicial" e ele abre como um app, com o ícone do studio.

```bash
npm run web:build       # gera o site em dist/
npm run web:deploy      # publica no EAS Hosting (ex.: https://cores-e-fios.expo.app)
```

**Publicado em: https://jefersonroodrigo-cmyk.github.io/Cores---fios/** (GitHub Pages, branch `gh-pages`). Para publicar de novo depois de mudanças:

```bash
python3 tools/web/build-pages.py     # gera dist-pages/ com o Supabase do .env
node tools/web/check-pages.js        # confere o site contra o Supabase real
# envie dist-pages/ para o branch gh-pages (o GitHub publica sozinho em ~1 minuto)
```

- Para as clientes, a versão web precisa do **servidor online** (abaixo): sem ele, os dados de cada cliente ficariam só no navegador dela.
- Depois de publicar, coloque o endereço em `EXPO_PUBLIC_WEB_URL` (`.env`). Em **Ajustes › Link para as clientes**, a profissional copia ou envia pelo WhatsApp o link que abre direto no agendamento.
- Em outras hospedagens (Netlify, Vercel, Cloudflare Pages…), configure para qualquer endereço abrir o `index.html` (o arquivo `public/_redirects` já faz isso na Netlify).
- Teste da versão web: `node tools/web/smoke-web.js` (instruções no próprio arquivo).

## Servidor online (Supabase)

Sem configuração, o app funciona só no aparelho. Com o Supabase ligado (passo a passo em [`supabase/README.md`](supabase/README.md)):

- **Profissional** entra com e-mail e senha e vê tudo: agenda completa, clientes, financeiro e ajustes.
- **Cliente** entra só com o WhatsApp, recebendo o código de verdade (Twilio pelo Supabase Auth). Vê e marca só os próprios horários, edita o próprio cadastro e publica avaliações. As abas mudam: sem Financeiro, e "Clientes" vira "Conta".
- **Sem login**: vê o feed (publicações e avaliações), curte e pode se cadastrar.
- As regras ficam no banco (Row Level Security, em `supabase/schema.sql`), testadas com `npm run test:db`. O banco recusa horários sobrepostos, inclusive de duas clientes ao mesmo tempo.
- Os dados ficam em cache no aparelho e se atualizam em tempo real entre os celulares; as fotos das avaliações vão para o Storage do Supabase.

## Próximos passos

- Comentários nas publicações.

## Estrutura

```
src/
  app/                 # rotas (Expo Router)
    _layout.tsx        # fontes e navegação raiz
    (tabs)/            # abas: início (feed), agenda, financeiro, clientes
    publicacao/nova.tsx # nova publicação da profissional
    avaliacoes/        # lista e nova avaliação
    cadastro.tsx       # cadastro rápido e Premium (4 passos)
    cliente/[id].tsx   # perfil com cartão fidelidade e histórico
    agendamento/       # novo agendamento e detalhe do horário
    financeiro/novo.tsx # novo lançamento
    ajustes.tsx        # ajustes do studio
    privacidade.tsx    # política de privacidade (LGPD)
    entrar.tsx         # login da profissional e da cliente
  components/          # TabBar (com o + central), SectionHeader, ui (campos, botões, estrelas)
  features/feed/       # publicações, curtidas e os cartões do feed
  data/catalog.ts      # cores, designs e formatos (preferências da cliente Premium)
  data/loyalty.ts      # regras do programa fidelidade
  data/services.ts     # serviços da agenda (preço e duração)
  features/agenda/     # agendamentos, horários livres e componentes da agenda
  features/finance/    # lançamentos e gráficos do financeiro
  features/settings/   # ajustes do studio
  features/verification/ # código de verificação do WhatsApp
  features/session/    # login (profissional, cliente) e conta da cliente
  data/supabase.ts     # conexão com o servidor (opcional)
  data/useCollection.ts # dados no aparelho + sincronização com o Supabase
supabase/              # banco: esquema, regras de acesso, testes e passo a passo
  features/clients/    # cadastro de clientes (tipos e armazenamento)
  features/feedback/   # avaliações (armazenamento)
  data/mock.ts         # cores em destaque na página inicial
  theme/               # cores, fontes, raios e sombras
```
