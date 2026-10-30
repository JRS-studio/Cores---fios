# Cores & Fios

App para manicures (Android e iOS) feito com **Expo / React Native** e **Expo Router**.

<img src="docs/home.png" width="300" alt="Página inicial" />

## Módulos

| Módulo | Status |
| --- | --- |
| Página inicial (resumo do dia, acesso rápido, próximos horários, cores em alta) | ✅ Pronto |
| Agenda de clientes | 🔜 Próxima etapa |
| Financeiro | 🔜 Próxima etapa |
| Provador Virtual (foto da mão + teste de esmaltes e designs) | 🔜 Próxima etapa |
| Clientes | 🔜 Próxima etapa |

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
  components/          # TabBar, Nail, SectionHeader, ComingSoon
  data/mock.ts         # dados de exemplo da página inicial
  theme/               # cores, fontes, raios e sombras
```
