# Ligar o Cores & Fios a um servidor (Supabase)

Com o servidor, a cliente agenda, se cadastra e avalia pelo celular dela, e a profissional vê tudo no dela. Sem ele, o app continua funcionando só no aparelho.

O plano gratuito do Supabase é suficiente para começar.

## 1. Criar o projeto

1. Crie uma conta em [supabase.com](https://supabase.com) e um projeto novo (região **South America (São Paulo)**).
2. No menu **SQL Editor**, cole todo o conteúdo de [`schema.sql`](schema.sql) e clique em **Run**. Isso cria as tabelas, as regras de acesso, o espaço das fotos das avaliações e a atualização em tempo real.

## 2. Criar o acesso da profissional

1. Em **Authentication › Users**, clique em **Add user › Create new user** e informe o seu e-mail e uma senha (marque *Auto Confirm User*).
2. Copie o **UID** do usuário criado e rode no **SQL Editor**:

   ```sql
   insert into professionals (user_id) values ('COLE-O-UID-AQUI');
   ```

   Só quem está nessa tabela vê o financeiro, a lista de clientes e a agenda completa.

## 3. Código pelo WhatsApp para as clientes

As clientes entram só com o WhatsApp, recebendo um código (sem senha e sem documentos).

1. Crie uma conta na [Twilio](https://www.twilio.com) e ative o envio por WhatsApp (o *Sandbox* serve para testes; para uso real, aprove um número e o modelo de mensagem de código na Meta, pela própria Twilio).
2. No Supabase, em **Authentication › Sign In / Providers › Phone**, ative o provedor, escolha **Twilio** (ou **Twilio Verify**) e informe *Account SID*, *Auth Token* e o número/serviço de envio.
3. Ainda em Phone, deixe a validade do código em 10 minutos.

> O Supabase também aceita envio por SMS pelos mesmos provedores, caso prefira.

## 4. Ligar o app

1. Em **Project Settings › API**, copie a **Project URL** e a chave **anon public**.
2. Na raiz do projeto, copie `.env.example` para `.env` e preencha os dois valores.
3. Rode `npx expo start` de novo. Para os builds do EAS, cadastre as mesmas variáveis em **expo.dev › seu projeto › Environment variables** (ou com `npx eas-cli@latest env:create`).

Pronto: abra o app, vá em **Ajustes › Entrar › Sou a profissional** e entre com o e-mail e a senha do passo 2. Os ajustes do studio (nome, horários, meta) passam a valer para todas as clientes.

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
