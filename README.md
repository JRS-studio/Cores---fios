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
3. Escolhe entre 15 cores, 8 designs (tradicional, gel, matte, francesinha, baby boomer, glitter, cromado e nail art poá) e 6 formatos (natural ou alongamento quadrado, redondo, amendoado, bailarina e stiletto), com o preço de cada serviço.
4. Pode decorar uma **unha de destaque** (+R$ 15), segurar o botão para ver o **antes**, salvar looks para comparar e tocar em **Agendar** para levar o serviço escolhido à agenda.

Preços, cores e formatos ficam em `src/data/catalog.ts`.

### Realismo

O esmalte é desenhado em SVG (`src/features/nails/`) no contorno do formato escolhido e recebe a luz da foto: um filtro passa-alta compara cada ponto da unha real com a vizinhança e transfere reflexos e sombras para o esmalte, sem mudar o tom do vidro. Somam-se curvatura lateral, sombra na cutícula, borda e o brilho do top coat. Os acabamentos foram calibrados comparando com fotos reais de unhas feitas (Open Images, CC BY 2.0, usadas só como referência visual): reflexo em faixa ao longo da unha e curvo na ponta no gel, glitter fino e iridescente com poucas lascas maiores, cromado com faixas no sentido do comprimento e matte sem reflexo. Sobre o alongamento (fora da unha real) a luz da foto some em degradê.

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
  components/          # TabBar, Nail (miniatura de unha), SectionHeader, ComingSoon
  features/nails/      # desenho do esmalte em SVG: formatos, designs e acabamento
  features/tryon/      # Provador Virtual: área da foto, mão de exemplo, introdução
  data/catalog.ts      # esmaltes, designs e preços
  data/mock.ts         # dados de exemplo da página inicial
  theme/               # cores, fontes, raios e sombras
```
