import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { formatPercent } from '@/data/loyalty';
import { useCashback } from '@/features/cashback/CashbackContext';
import { useLoyalty } from '@/features/settings/SettingsContext';
import { colors, fonts, radius, shadow } from '@/theme';
import { brl, formatShortDate } from '@/utils/format';

// Cartão do cashback: saldo, quanto está separado para horários marcados e o extrato.
export function CashbackCard({ phone, name, history = 0 }: { phone: string; name?: string; history?: number }) {
  const { balanceOf, reservedOf, historyOf } = useCashback();
  const { cashbackPercent } = useLoyalty();
  const balance = balanceOf(phone);
  const reserved = Math.min(reservedOf(phone), balance);
  const entries = historyOf(phone).slice(0, history);

  return (
    <LinearGradient colors={[colors.wine, colors.plum]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.eyebrow}>CASHBACK{name ? ` · ${name.toUpperCase()}` : ''}</Text>
        <Ionicons name="wallet-outline" size={20} color={colors.roseGoldLight} />
      </View>
      <Text style={styles.balance} accessibilityLabel={`Saldo de cashback: ${brl(balance)}`}>
        {brl(balance)}
      </Text>
      {reserved > 0 ? (
        <Text style={styles.info}>
          {brl(reserved)} separado para horário marcado · {brl(balance - reserved)} livre para usar
        </Text>
      ) : (
        <Text style={styles.info}>
          {balance > 0 ? 'Use no próximo agendamento.' : 'Seu saldo aparece aqui depois do primeiro atendimento pago.'}
        </Text>
      )}
      {cashbackPercent > 0 && <Text style={styles.rule}>{formatPercent(cashbackPercent)} de volta em todo atendimento pago.</Text>}

      {entries.length > 0 && (
        <View style={styles.history}>
          {entries.map((e) => (
            <View key={e.id} style={styles.row}>
              <Text style={styles.rowText} numberOfLines={1}>
                {formatShortDate(e.createdAt)} · {e.description}
              </Text>
              <Text style={[styles.rowAmount, e.amount < 0 && styles.rowUse]}>
                {e.amount < 0 ? '−' : '+'}
                {brl(Math.abs(e.amount))}
              </Text>
            </View>
          ))}
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: 20, marginTop: 16, ...shadow, shadowOpacity: 0.25 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 2, color: colors.roseGold },
  balance: { fontFamily: fonts.display, fontSize: 34, color: colors.white, marginTop: 6 },
  info: { fontFamily: fonts.medium, fontSize: 13, color: colors.white, marginTop: 4 },
  rule: { fontFamily: fonts.regular, fontSize: 12, color: colors.roseGoldLight, marginTop: 6 },
  history: { marginTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(232,205,181,0.25)', paddingTop: 10, gap: 6 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  rowText: { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  rowAmount: { fontFamily: fonts.semibold, fontSize: 12, color: colors.roseGoldLight },
  rowUse: { color: colors.white },
});
