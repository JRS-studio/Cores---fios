# Cores & Fios

App para manicures (Android e iOS) feito com **Expo / React Native** e **Expo Router**.

<img src="docs/home.png" width="260" alt="Página inicial" /> <img src="docs/provador.png" width="260" alt="Provador Virtual" />

## Módulos

| Módulo | Status |
| --- | --- |
| Página inicial (resumo do dia, acesso rápido, próximos horários, cores em alta) | ✅ Pronto |
| Agenda de clientes | 🔜 Próxima etapa |
| Financeiro | 🔜 Próxima etapa |
| Provador Virtual (foto da mão + teste de esmaltes e designs) | ✅ Pronto |
| Clientes | 🔜 Próxima etapa |

## Provador Virtual

1. A cliente tira uma foto da mão (ou escolhe da galeria) — ou usa a **mão de exemplo**.
2. Toca sobre cada unha para marcá-la; pode arrastar, aumentar, alongar e girar cada uma.
3. Escolhe entre 14 cores e 7 designs (tradicional, gel, francesinha, baby boomer, glitter, cromado e nail art poá), com o preço de cada serviço.
4. Pode decorar uma **unha de destaque** (+R$ 15), segurar o botão para ver o **antes**, salvar looks para comparar e tocar em **Agendar** para levar o serviço escolhido à agenda.

Preços e cores ficam em `src/data/catalog.ts`.

## Como rodar

```bash
npm install
npx expo start
```

Depois, escaneie o QR Code com o app **Expo Go** (Android ou iPhone), ou pressione `a` (emulador Android) / `i` (simulador iOS).

## Estrutura

```
src/
  app/                 # rotas (Expo Router)
    _layout.tsx        # fontes e navegação raiz
    (tabs)/            # abas: início, agenda, provador, financeiro, clientes
  components/          # TabBar, Nail (renderiza os acabamentos), SectionHeader, ComingSoon
  features/tryon/      # Provador Virtual: área da foto, mão de exemplo, introdução
  data/catalog.ts      # esmaltes, designs e preços
  data/mock.ts         # dados de exemplo da página inicial
  theme/               # cores, fontes, raios e sombras
```
