import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { LOYALTY } from '@/data/loyalty';
import { useClients } from '@/features/clients/ClientsContext';
import { colors, fonts, radius, shadow } from '@/theme';
import { formatPhone } from '@/utils/format';
import { useSession } from './SessionContext';

// Aba "Conta" da cliente: o próprio cadastro, o cartão fidelidade e o login.
export function MyAccount() {
  const insets = useSafeAreaInsets();
  const { role, phone, signOut } = useSession();
  const { findByPhone } = useClients();
  const me = phone ? findByPhone(phone) : undefined;
  const stamps = Math.min(me?.loyalty?.stamps ?? 0, LOYALTY.stampsForReward);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 130, paddingHorizontal: 20 }}
    >
      <Text style={styles.title}>Sua conta</Text>
      <Text style={styles.subtitle}>
        {role === 'cliente' ? `Entrou com o WhatsApp ${formatPhone(phone ?? '')}` : 'Entre com seu WhatsApp, sem senha'}
      </Text>

      {me ? (
        <LinearGradient colors={[colors.wine, colors.plum]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
          <Text style={styles.cardName}>{me.name}</Text>
          <Text style={styles.cardPlan}>{me.plan === 'premium' ? 'Cliente Premium' : 'Cadastro rápido'}</Text>
          {me.plan === 'premium' && (
            <>
              <View style={styles.stamps}>
                {Array.from({ length: LOYALTY.stampsForReward }, (_, i) => (
                  <View key={i} style={[styles.stamp, i < stamps && styles.stampOn]} />
                ))}
              </View>
              <Text style={styles.cardPlan}>
                {stamps}/{LOYALTY.stampsForReward} selos para {LOYALTY.reward.toLowerCase()}
              </Text>
            </>
          )}
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

      <View style={styles.actions}>
        {me ? (
          <>
            <Button label="Agendar horário" icon="calendar-outline" onPress={() => router.push('/agendamento/novo')} />
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
  stamps: { flexDirection: 'row', gap: 6, marginVertical: 10 },
  stamp: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.roseGoldLight },
  stampOn: { backgroundColor: colors.roseGoldLight },
  empty: { alignItems: 'center', gap: 8, backgroundColor: colors.white, borderRadius: radius.md, padding: 20 },
  emptyText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.muted, textAlign: 'center' },
  actions: { gap: 10, marginTop: 20 },
});
