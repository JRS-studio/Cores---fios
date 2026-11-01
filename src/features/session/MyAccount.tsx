import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { useClients } from '@/features/clients/ClientsContext';
import { formatPercent } from '@/data/loyalty';
import { CashbackCard } from '@/features/cashback/CashbackCard';
import { useCashback } from '@/features/cashback/CashbackContext';
import { useLoyalty } from '@/features/settings/SettingsContext';
import { colors, fonts, radius, shadow } from '@/theme';
import { formatPhone } from '@/utils/format';
import { RemindersCard } from '@/features/reminders/RemindersCard';
import { useSession } from './SessionContext';

// Aba "Conta" da cliente: o próprio cadastro, o saldo de cashback e o login.
export function MyAccount() {
  const LOYALTY = useLoyalty();
  const insets = useSafeAreaInsets();
  const { role, phone, signOut } = useSession();
  const { findByPhone } = useClients();
  const me = phone ? findByPhone(phone) : undefined;
  const { balanceOf } = useCashback();
  const showCashback = !!me && (me.plan === 'premium' || balanceOf(me.phone) > 0);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 130, paddingHorizontal: 20 }}
    >
      <Text style={styles.title}>Sua conta</Text>
      <Text style={styles.subtitle}>
        {role === 'cliente' ? `Entrou com o WhatsApp ${formatPhone(phone ?? '')}` : 'Entre com seu WhatsApp, sem senha'}
      </Text>

      <View style={{ marginBottom: 16 }}>
        <RemindersCard />
      </View>

      {me ? (
        <LinearGradient colors={[colors.wine, colors.plum]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
          <Text style={styles.cardName}>{me.name}</Text>
          <Text style={styles.cardPlan}>{me.plan === 'premium' ? 'Cliente Premium' : 'Cadastro rápido'}</Text>
        </LinearGradient>
      ) : (
        <View style={styles.empty}>
          <Ionicons name="person-circle-outline" size={34} color={colors.wine} />
          <Text style={styles.emptyText}>
            {role === 'cliente'
              ? 'Falta só completar seu cadastro para agendar.'
              : 'Com o cadastro, seus dados ficam prontos para os próximos agendamentos.'}
          </Text>
        </View>
      )}

      {showCashback && me && <CashbackCard phone={me.phone} history={5} />}
      {me && me.plan !== 'premium' && LOYALTY.cashbackPercent > 0 && (
        <View style={styles.upsell}>
          <Ionicons name="wallet-outline" size={22} color={colors.wine} />
          <Text style={styles.upsellText}>
            Seja Premium e ganhe {formatPercent(LOYALTY.cashbackPercent)} de cashback em todo atendimento para usar nos próximos.
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        {me ? (
          <>
            <Button label="Agendar horário" icon="calendar-outline" onPress={() => router.push('/agendamento/novo')} />
            {me.plan !== 'premium' && (
              <Button
                label="Quero ser Premium"
                icon="diamond-outline"
                variant="secondary"
                onPress={() => router.push({ pathname: '/cadastro', params: { tipo: 'premium', id: me.id } })}
              />
            )}
            <Button
              label="Meu cadastro"
              icon="person-outline"
              variant="secondary"
              onPress={() => router.push({ pathname: '/cliente/[id]', params: { id: me.id } })}
            />
          </>
        ) : (
          <>
            <Button label="Cadastro rápido" icon="flash-outline" onPress={() => router.push({ pathname: '/cadastro', params: { tipo: 'rapido' } })} />
            <Button
              label="Quero ser Premium"
              icon="diamond-outline"
              variant="secondary"
              onPress={() => router.push({ pathname: '/cadastro', params: { tipo: 'premium' } })}
            />
          </>
        )}
        {role === 'cliente' ? (
          <Button label="Sair" icon="log-out-outline" variant="secondary" onPress={signOut} />
        ) : (
          <Button label="Já tenho cadastro: entrar" icon="log-in-outline" variant="secondary" onPress={() => router.push('/entrar')} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginBottom: 18 },
  card: { borderRadius: radius.lg, padding: 20, gap: 4, ...shadow, shadowOpacity: 0.25 },
  cardName: { fontFamily: fonts.display, fontSize: 24, color: colors.white },
  cardPlan: { fontFamily: fonts.medium, fontSize: 12, color: colors.roseGoldLight },
  upsell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.roseGoldLight,
  },
  upsellText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.wine },
  empty: { alignItems: 'center', gap: 8, backgroundColor: colors.white, borderRadius: radius.md, padding: 20 },
  emptyText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.muted, textAlign: 'center' },
  actions: { gap: 10, marginTop: 20 },
});
