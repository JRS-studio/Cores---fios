import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCashback } from '@/features/cashback/CashbackContext';
import { useClients } from '@/features/clients/ClientsContext';
import { MyAccount } from '@/features/session/MyAccount';
import { useSession } from '@/features/session/SessionContext';
import { colors, fonts, radius, shadow } from '@/theme';
import { brl, formatPhone, initials, onlyDigits } from '@/utils/format';

export default function ClientesScreen() {
  const { canManage } = useSession();
  // Para a cliente, esta aba é a conta dela; a lista de clientes é só da profissional.
  return canManage ? <ClientList /> : <MyAccount />;
}

function ClientList() {
  const { balanceOf } = useCashback();
  const insets = useSafeAreaInsets();
  const { clients, ready } = useClients();
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const visible = clients.filter(
    (c) => !q || c.name.toLowerCase().includes(q) || (onlyDigits(q) && c.phone.includes(onlyDigits(q))),
  );
  const premiumCount = clients.filter((c) => c.plan === 'premium').length;

  return (
    <ScrollView
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 130, paddingHorizontal: 20 }}
    >
      <Text style={styles.title}>Clientes</Text>
      <Text style={styles.subtitle}>
        {clients.length
          ? `${clients.length} ${clients.length === 1 ? 'cadastro' : 'cadastros'} · ${premiumCount} Premium`
          : 'Cadastre-se para agendar mais rápido'}
      </Text>

      <View style={styles.plans}>
        <Pressable style={styles.plan} onPress={() => router.push({ pathname: '/cadastro', params: { tipo: 'rapido' } })}>
          <View style={styles.planIcon}>
            <Ionicons name="flash-outline" size={20} color={colors.wine} />
          </View>
          <Text style={styles.planName}>Cadastro rápido</Text>
          <Text style={styles.planText}>Nome e WhatsApp. Para quem agenda de vez em quando.</Text>
          <Text style={styles.planCta}>Cadastrar ›</Text>
        </Pressable>

        <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: '/cadastro', params: { tipo: 'premium' } })}>
          <LinearGradient colors={[colors.wine, colors.plum]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.plan, styles.planPremium]}>
            <View style={[styles.planIcon, { backgroundColor: 'rgba(232,205,181,0.18)' }]}>
              <Ionicons name="diamond-outline" size={20} color={colors.roseGoldLight} />
            </View>
            <Text style={[styles.planName, { color: colors.white }]}>Premium</Text>
            <Text style={[styles.planText, { color: 'rgba(255,255,255,0.78)' }]}>
              Cashback em todo atendimento, desconto no aniversário e preferências salvas.
            </Text>
            <Text style={[styles.planCta, { color: colors.roseGoldLight }]}>Ser Premium ›</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {clients.length > 0 && (
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por nome ou WhatsApp"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            accessibilityLabel="Buscar cliente"
          />
        </View>
      )}

      {!ready ? null : clients.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={30} color={colors.wine} />
          <Text style={styles.emptyTitle}>Nenhuma cliente cadastrada</Text>
          <Text style={styles.emptyText}>
            Os cadastros ficam salvos neste aparelho e preenchem os próximos agendamentos automaticamente.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {visible.map((c, i) => {
            const cashback = balanceOf(c.phone);
            return (
              <Pressable
                key={c.id}
                style={[styles.item, i > 0 && styles.itemDivider]}
                onPress={() => router.push({ pathname: '/cliente/[id]', params: { id: c.id } })}
              >
                <View style={[styles.avatar, c.plan === 'premium' && styles.avatarPremium]}>
                  <Text style={[styles.avatarText, c.plan === 'premium' && { color: colors.roseGoldLight }]}>{initials(c.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{c.name}</Text>
                  <Text style={styles.itemPhone}>{formatPhone(c.phone)}</Text>
                  {(c.plan === 'premium' || cashback > 0) && (
                    <View style={styles.cashback}>
                      <Ionicons name="wallet-outline" size={13} color={colors.wine} />
                      <Text style={styles.cashbackText}>Cashback {brl(cashback)}</Text>
                    </View>
                  )}
                </View>
                {!!c.allergies?.length && <Ionicons name="warning-outline" size={18} color="#B45309" accessibilityLabel="Possui alergia" />}
                <View style={[styles.badge, c.plan === 'premium' && styles.badgePremium]}>
                  <Text style={[styles.badgeText, c.plan === 'premium' && { color: colors.roseGoldLight }]}>
                    {c.plan === 'premium' ? 'Premium' : 'Rápido'}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          {visible.length === 0 && <Text style={styles.noResult}>Nenhuma cliente encontrada para “{query}”.</Text>}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginBottom: 18 },
  plans: { flexDirection: 'row', gap: 12 },
  plan: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planPremium: { borderWidth: 0, ...shadow, shadowOpacity: 0.2, height: '100%' },
  planIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  planName: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  planText: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted, flex: 1 },
  planCta: { fontFamily: fonts.semibold, fontSize: 12, color: colors.wine, marginTop: 4 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    marginTop: 22,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.ink, paddingVertical: 12 },
  empty: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  emptyText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.muted, textAlign: 'center' },
  list: { backgroundColor: colors.white, borderRadius: radius.md, paddingHorizontal: 14, marginTop: 14, ...shadow },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  itemDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  avatarPremium: { backgroundColor: colors.plum },
  avatarText: { fontFamily: fonts.display, fontSize: 16, color: colors.plum },
  itemName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  itemPhone: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  cashback: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  cashbackText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.wine },
  badge: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: colors.blush },
  badgePremium: { backgroundColor: colors.plum },
  badgeText: { fontFamily: fonts.semibold, fontSize: 10, color: colors.wine },
  noResult: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, paddingVertical: 16, textAlign: 'center' },
});
