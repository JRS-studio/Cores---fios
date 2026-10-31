import { readThemeSync } from './storage';
import { themeById } from './themes';

export const colors = {
  plum: '#2B1220',
  plumSoft: '#4A2236',
  wine: '#7A2E4A',
  roseGold: '#C9A27E',
  roseGoldLight: '#E8CDB5',
  blush: '#F7ECE8',
  cream: '#FCF8F6',
  white: '#FFFFFF',
  ink: '#2A1F24',
  muted: '#8C7A80',
  border: '#EADCD6',
  success: '#3E8E6B',
  // Gráficos do financeiro (validados para daltonismo e contraste sobre branco)
  chartIncome: '#A33D63',
  chartExpense: '#C27A3A',
  danger: '#C2410C',
};

export const fonts = {
  display: 'PlayfairDisplay_600SemiBold',
  displayItalic: 'PlayfairDisplay_600SemiBold_Italic',
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
};

export const radius = {
  sm: 12,
  md: 18,
  lg: 26,
  pill: 999,
};

export const shadow = {
  shadowColor: '#2B1220',
  shadowOpacity: 0.08,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
};

// Tema escolhido pela profissional (Ajustes › Tema do app), aplicado antes de qualquer estilo ser criado.
export const activeTheme = themeById(readThemeSync() ?? undefined);
Object.assign(colors, activeTheme.colors);
if (!activeTheme.serifTitles) {
  fonts.display = fonts.semibold;
  fonts.displayItalic = fonts.semibold;
}
