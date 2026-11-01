import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatPercent } from '@/data/loyalty';
import { useCashback } from '@/features/cashback/CashbackContext';
import { useClients } from '@/features/clients/ClientsContext';
import { useSession } from '@/features/session/SessionContext';
import { useSettings } from '@/features/settings/SettingsContext';
import { colors, fonts, radius, shadow } from '@/theme';

// Tela inicial: convite "Seja Premium" para quem ainda não é (o saldo da Premium fica no topo do perfil).
export function PremiumHomeCard() {
  const { canManage, phone } = useSession();
  const { findByPhone } = useClients();
  const { balanceOf } = useCashback();
  const { settings } = useSettings();
  if (canManage) return null;

  const me = phone ? findByPhone(phone) : undefined;
  const { cashbackPercent, birthdayDiscount } = settings.loyalty;
  const balance = me ? balanceOf(me.phone) : 0;

  // Premium (ou com saldo): o cashback aparece só no topo do perfil.
  if (me && (me.plan === 'premium' || balance > 0)) return null;

  const perks = [
    cashbackPercent > 0 ? `${formatPercent(cashbackPercent)} de cashback em todo atendimento` : null,
    birthdayDiscount > 0 ? `${birthdayDiscount}% de desconto no mês do aniversário` : null,
  ].filter(Boolean);

  return (
    <LinearGradient colors={[colors.wine, colors.plum]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, styles.invite]}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <Ionicons name="diamond-outline" size={22} color={colors.roseGoldLight} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Seja Premium</Text>
          <Text style={styles.info}>{perks.length ? perks.join(' · ') : 'Vantagens para quem vem sempre'}</Text>
        </View>
      </View>
      <Pressable
        style={styles.button}
        onPress={() => router.push({ pathname: '/cadastro', params: me ? { tipo: 'premium', id: me.id } : { tipo: 'premium' } })}
        accessibilityRole="button"
        accessibilityLabel="Seja Premium"
      >
        <Text style={styles.buttonText}>Quero ser Premium</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.plum} />
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 12,
    marginTop: 12,
    padding: 16,
    borderRadius: radius.md,
    ...shadow,
    shadowOpacity: 0.2,
  },
  invite: { flexDirection: 'column', alignItems: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(232,205,181,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 2, color: colors.roseGold },
  balance: { fontFamily: fonts.display, fontSize: 26, color: colors.white },
  title: { fontFamily: fonts.display, fontSize: 21, color: colors.white },
  info: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 17, color: colors.roseGoldLight, marginTop: 2 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.blush,
  },
  buttonText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.plum },
});
