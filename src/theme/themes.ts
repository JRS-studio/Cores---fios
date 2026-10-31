// Os 5 temas do app, do mais feminino ao mais tecnológico. Só mudam cores e a fonte dos títulos;
// os textos sobre o botão principal continuam brancos, por isso `plum` é sempre um tom escuro.
export type ThemeId = 'romantico' | 'rose' | 'nude' | 'basico' | 'tech';

type Palette = {
  plum: string; // cor principal escura (botões, barra de baixo)
  plumSoft: string;
  wine: string; // destaque (links, ícones)
  roseGold: string; // detalhe metálico (anéis, bordas)
  roseGoldLight: string;
  blush: string; // fundos suaves (chips, campos)
  cream: string; // fundo das telas
  ink: string; // texto
  muted: string; // texto secundário
  border: string;
};

export type Theme = { id: ThemeId; name: string; description: string; colors: Palette; serifTitles: boolean };

export const THEMES: Theme[] = [
  {
    id: 'romantico',
    name: 'Romântico',
    description: 'Rosa e pink, delicado e bem feminino',
    serifTitles: true,
    colors: {
      plum: '#4A1530',
      plumSoft: '#6E2348',
      wine: '#B22D63',
      roseGold: '#E79AB6',
      roseGoldLight: '#F8D3E0',
      blush: '#FCE9F0',
      cream: '#FFF7FA',
      ink: '#3A1F2B',
      muted: '#80606D',
      border: '#F2D7E2',
    },
  },
  {
    id: 'rose',
    name: 'Rosé Gold',
    description: 'Vinho e rosé gold, o visual original do studio',
    serifTitles: true,
    colors: {
      plum: '#2B1220',
      plumSoft: '#4A2236',
      wine: '#7A2E4A',
      roseGold: '#C9A27E',
      roseGoldLight: '#E8CDB5',
      blush: '#F7ECE8',
      cream: '#FCF8F6',
      ink: '#2A1F24',
      muted: '#76666C',
      border: '#EADCD6',
    },
  },
  {
    id: 'nude',
    name: 'Nude',
    description: 'Tons de areia e café, elegante e neutro',
    serifTitles: true,
    colors: {
      plum: '#3B2F28',
      plumSoft: '#5A4A40',
      wine: '#8A5A3C',
      roseGold: '#C9AE94',
      roseGoldLight: '#E9DCCD',
      blush: '#F3ECE4',
      cream: '#FBF8F4',
      ink: '#2E2622',
      muted: '#75675C',
      border: '#E7DDD2',
    },
  },
  {
    id: 'basico',
    name: 'Básico',
    description: 'Preto e branco, limpo e simples',
    serifTitles: false,
    colors: {
      plum: '#161616',
      plumSoft: '#333333',
      wine: '#3D3D3D',
      roseGold: '#B5B5B5',
      roseGoldLight: '#E2E2E2',
      blush: '#F1F1F1',
      cream: '#FAFAFA',
      ink: '#161616',
      muted: '#737373',
      border: '#E4E4E4',
    },
  },
  {
    id: 'tech',
    name: 'Tecnologia',
    description: 'Azul-marinho, roxo e ciano, moderno e digital',
    serifTitles: false,
    colors: {
      plum: '#0F172A',
      plumSoft: '#1E293B',
      wine: '#4F46E5',
      roseGold: '#22B8CF',
      roseGoldLight: '#A5F3FC',
      blush: '#EEF2FF',
      cream: '#F8FAFC',
      ink: '#0F172A',
      muted: '#64748B',
      border: '#E2E8F0',
    },
  },
];

export const DEFAULT_THEME: ThemeId = 'rose';
export const themeById = (id?: string) => THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME)!;
