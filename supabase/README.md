# Ligar o Cores & Fios a um servidor (Supabase)

Com o servidor, a cliente agenda, se cadastra e avalia pelo celular dela, e a profissional vê tudo no dela. Sem ele, o app continua funcionando só no aparelho.

O plano gratuito do Supabase é suficiente para começar.

## 1. Criar o projeto

1. Crie uma conta em [supabase.com](https://supabase.com) e um projeto novo (região **South America (São Paulo)**).
2. No menu **SQL Editor**, cole todo o conteúdo de [`schema.sql`](schema.sql) e clique em **Run**. Isso cria as tabelas, as regras de acesso, o espaço das fotos das avaliações e a atualização em tempo real.
   **Quando o app ganhar uma função nova** (como o feed com publicações e curtidas), rode o arquivo de novo do mesmo jeito: ele só cria o que falta e não apaga nada. Se o app mostrar "O servidor precisa ser atualizado", é isso que falta.

## 2. Criar o acesso da profissional

1. Em **Authentication › Users**, clique em **Add user › Create new user** e informe o seu e-mail e uma senha (marque *Auto Confirm User*).
2. Copie o **UID** do usuário criado e rode no **SQL Editor**:

   ```sql
   insert into professionals (user_id) values ('COLE-O-UID-AQUI');
   ```

   Só quem está nessa tabela vê o financeiro, a lista de clientes e a agenda completa.

## 3. Como as clientes entram

**Sem a Twilio (padrão):** a cliente entra só com o número do WhatsApp, sem código. O número fica preso ao primeiro celular que o usou: outro aparelho não consegue entrar com ele. Se a cliente trocar de celular, ela toca em **Sair** no aparelho antigo ou a profissional toca em **Liberar acesso em outro celular** no perfil dela. Para isso, ative em **Authentication › Sign In / Providers** a opção **Allow anonymous sign-ins**.

> Sem código, alguém que saiba o número de uma cliente que ainda não usou o app poderia entrar antes dela. Para fechar essa brecha, ligue a Twilio (abaixo).

### Com código pelo WhatsApp (opcional, Twilio)

As clientes entram só com o WhatsApp, recebendo um código (sem senha e sem documentos).

1. Crie uma conta na [Twilio](https://www.twilio.com) e ative o envio por WhatsApp (o *Sandbox* serve para testes; para uso real, aprove um número e o modelo de mensagem de código na Meta, pela própria Twilio).
2. No Supabase, em **Authentication › Sign In / Providers › Phone**, ative o provedor, escolha **Twilio** (ou **Twilio Verify**) e informe *Account SID*, *Auth Token* e o número/serviço de envio.
3. Ainda em Phone, deixe a validade do código em 10 minutos.
4. No `.env`, coloque `EXPO_PUBLIC_WHATSAPP_CODE=1` e publique o app de novo.

> O Supabase também aceita envio por SMS pelos mesmos provedores, caso prefira.

## 4. Ligar o app

1. Em **Project Settings › API**, copie a **Project URL** e a chave **anon public**.
2. Na raiz do projeto, copie `.env.example` para `.env` e preencha os dois valores.
3. Rode `npx expo start` de novo. Para os builds do EAS, cadastre as mesmas variáveis em **expo.dev › seu projeto › Environment variables** (ou com `npx eas-cli@latest env:create`).

Pronto: abra o app, vá em **Ajustes › Entrar › Sou a profissional** e entre com o e-mail e a senha do passo 2. Os ajustes do studio (nome, horários, meta) passam a valer para todas as clientes.

## 5. Versão web para as clientes (opcional)

1. Com o `.env` preenchido, rode `npm run web:deploy` e entre com uma conta Expo gratuita quando pedir. Ao final aparece o endereço do site (ex.: `https://cores-e-fios.expo.app`).
2. Coloque esse endereço em `EXPO_PUBLIC_WEB_URL` no `.env` (e nas variáveis do EAS) e publique de novo.
3. Em **Ajustes › Link para as clientes**, envie o link pelo WhatsApp. A cliente abre no navegador, entra com o código e agenda.
4. No Supabase, em **Authentication › URL Configuration**, coloque esse endereço em *Site URL*.

## Quem vê o quê

| | Profissional | Cliente (entrou pelo WhatsApp) | Sem login |
| --- | --- | --- | --- |
| Agenda | todos os horários | só os dela; marca, remarca e cancela | só "ocupado" nos horários dos outros |
| Clientes | todas | só o próprio cadastro (pode editar e excluir) | – |
| Financeiro | sim | não | não |
| Avaliações | lê e remove | lê e publica | lê |
| Ajustes do studio | edita | lê | lê |

Essas regras ficam no banco (Row Level Security), não só nas telas. O banco também recusa dois horários sobrepostos, mesmo que duas clientes tentem marcar ao mesmo tempo. Os testes das regras rodam sem servidor:

```bash
npm run test:db
```

O app também tem um teste no modo com servidor, contra uma imitação local da API do Supabase (cadastro com código, agendamento da cliente, login da profissional):

```bash
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54329 EXPO_PUBLIC_SUPABASE_ANON_KEY=teste \
  python3 tools/pagina-de-teste/build.py --saida dist-teste/remoto.html
node supabase/test/app-remote.test.js
```
