import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui';
import { useSession } from '@/features/session/SessionContext';
import { useSettings } from '@/features/settings/SettingsContext';
import { activeTheme, colors, fonts, radius } from '@/theme';
import { applyTheme } from '@/theme/ThemeSync';
import { THEMES, type Theme } from '@/theme/themes';

// Cada pessoa escolhe o tema do próprio celular. A escolha da profissional vira também o padrão do studio,
// usado por quem ainda não escolheu.
export default function TemaScreen() {
  const insets = useSafeAreaInsets();
  const { settings, saveSettings } = useSettings();
  const { canManage } = useSession();

  async function choose(id: string) {
    if (canManage && settings.theme !== id) await saveSettings({ ...settings, theme: id });
    applyTheme(id, true);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
    >
      <ScreenHeader title="Tema do app" subtitle="Escolha as cores do app no seu celular" />
      <Text style={styles.hint}>
        Toque num tema para usar. O app recarrega com as cores novas (se não recarregar sozinho, feche e abra de novo).
        {canManage
          ? ' O tema que você escolher também vira o padrão do studio para as clientes que ainda não escolheram o delas.'
          : ' A escolha vale só para você, neste celular.'}
      </Text>
      {THEMES.map((t) => (
        <ThemeCard key={t.id} theme={t} selected={activeTheme.id === t.id} onPress={() => choose(t.id)} />
      ))}
    </ScrollView>
  );
}

// Miniatura do app com as cores do tema: barra do título, botão, chip e texto.
function ThemeCard({ theme: t, selected, onPress }: { theme: Theme; selected: boolean; onPress: () => void }) {
  const c = t.colors;
  const titleFont = t.serifTitles ? 'PlayfairDisplay_600SemiBold' : fonts.semibold;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, selected && styles.cardSelected]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`Tema ${t.name}: ${t.description}`}
    >
      <View style={[styles.preview, { backgroundColor: c.cream, borderColor: c.border }]}>
        <View style={styles.previewTop}>
          <View style={[styles.avatarRing, { borderColor: c.roseGold }]}>
            <View style={[styles.avatar, { backgroundColor: c.plum }]}>
              <Text style={[styles.avatarText, { color: c.roseGoldLight, fontFamily: titleFont }]}>C</Text>
            </View>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.previewTitle, { color: c.ink, fontFamily: titleFont }]} numberOfLines={1}>
              Cores & Fios
            </Text>
            <Text style={[styles.previewText, { color: c.muted }]}>Manicure e nail designer</Text>
          </View>
        </View>
        <View style={styles.previewRow}>
          <View style={[styles.previewButton, { backgroundColor: c.plum }]}>
            <Text style={[styles.previewButtonText, { color: '#FFFFFF' }]}>Agendar</Text>
          </View>
          <View style={[styles.previewChip, { backgroundColor: c.blush }]}>
            <Text style={[styles.previewButtonText, { color: c.wine }]}>Promoção</Text>
          </View>
          <Ionicons name="heart" size={18} color={c.wine} />
        </View>
      </View>
      <View style={styles.info}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{t.name}</Text>
          <Text style={styles.description}>{t.description}</Text>
        </View>
        <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? colors.wine : colors.muted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  hint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.muted, marginBottom: 14 },
  card: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, padding: 12, marginBottom: 12, gap: 10 },
  cardSelected: { borderColor: colors.wine, borderWidth: 2 },
  preview: { borderRadius: radius.sm, borderWidth: 1, padding: 12, gap: 12 },
  previewTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarRing: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16 },
  previewTitle: { fontSize: 17 },
  previewText: { fontFamily: fonts.regular, fontSize: 11 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewButton: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  previewChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  previewButtonText: { fontFamily: fonts.semibold, fontSize: 11 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  description: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
});
