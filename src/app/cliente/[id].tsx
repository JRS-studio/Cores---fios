import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, ScreenHeader } from '@/components/ui';
import { polishById, shapeById } from '@/data/catalog';
import { birthdayWeekContaining, formatPercent } from '@/data/loyalty';
import { CashbackCard } from '@/features/cashback/CashbackCard';
import { useAppointments } from '@/features/agenda/AppointmentsContext';
import { StatusChip } from '@/features/agenda/components';
import { useClients } from '@/features/clients/ClientsContext';
import { supabase, toAuthPhone } from '@/data/supabase';
import { reportSyncError } from '@/data/syncStatus';
import { useSession } from '@/features/session/SessionContext';
import { CODE_BY_WHATSAPP } from '@/features/verification/whatsappCode';
import { CONTACT_CHANNELS, LENGTHS } from '@/features/clients/types';
import { useLoyalty } from '@/features/settings/SettingsContext';
import { colors, fonts, radius, shadow } from '@/theme';
import { formatDayMonth, today } from '@/utils/date';
import { brl, formatPhone, formatShortDate, initials, parseDate } from '@/utils/format';

const welcome = (cashbackPercent: number): Record<string, string> => ({
  rapido: 'Cadastro concluído! Seus dados já ficam prontos para o próximo agendamento.',
  premium:
    cashbackPercent > 0
      ? `Bem-vinda ao Premium! A partir de agora, ${formatPercent(cashbackPercent)} de cada atendimento pago volta para você em cashback.`
      : 'Bem-vinda ao Premium!',
  editado: 'Cadastro atualizado.',
});

export default function ClienteScreen() {
  const LOYALTY = useLoyalty();
  const WELCOME = welcome(LOYALTY.cashbackPercent);
  const insets = useSafeAreaInsets();
  const { id, novo } = useLocalSearchParams<{ id: string; novo?: string }>();
  const { ready, getClient, removeClient } = useClients();
  const { appointments } = useAppointments();
  const { canManage, role, signOut } = useSession();
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Aviso da última ação nesta tela; ao voltar de uma edição (novo parâmetro), vale o aviso da edição.
  const [action, setAction] = useState<{ message: string; novo?: string } | null>(null);
  const notice = action && action.novo === novo ? action.message : novo ? (WELCOME[novo] ?? null) : null;
  const client = getClient(id);

  if (!client) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 12, paddingHorizontal: 20 }]}>
        <ScreenHeader title="Cliente" />
        <Text style={styles.muted}>{ready ? 'Cadastro não encontrado.' : 'Carregando…'}</Text>
      </View>
    );
  }

  const premium = client.plan === 'premium';
  const history = appointments
    .filter((a) => a.clientId === client.id)
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const birthday = client.birthDate ? parseDate(client.birthDate) : null;
  const birthdayWeek = birthday ? birthdayWeekContaining(birthday, today()) : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
    >
      <ScreenHeader title={client.name.split(' ')[0]} subtitle={premium ? 'Cliente Premium' : 'Cadastro rápido'} />

      {notice && (
        <View style={styles.notice}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      )}

      <View style={styles.profile}>
        <LinearGradient colors={[colors.roseGoldLight, colors.roseGold]} style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(client.name)}</Text>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{client.name}</Text>
          <Text style={styles.muted}>{formatPhone(client.phone)}</Text>
          <Text style={styles.since}>Cliente desde {formatShortDate(client.createdAt)}</Text>
        </View>
        <View style={[styles.badge, premium && styles.badgePremium]}>
          <Text style={[styles.badgeText, premium && styles.badgeTextPremium]}>{premium ? 'Premium' : 'Rápido'}</Text>
        </View>
      </View>

      <Button
        label="Agendar horário"
        icon="calendar-outline"
        onPress={() => router.push({ pathname: '/agendamento/novo', params: { cliente: client.id } })}
        style={{ marginTop: 14 }}
      />

      {premium ? (
        <CashbackCard phone={client.phone} history={canManage ? 10 : 5} />
      ) : (
        <View style={styles.upgrade}>
          <Text style={styles.upgradeTitle}>Ganhe vantagens com o Premium</Text>
          <Text style={styles.upgradeText}>
            {LOYALTY.cashbackPercent > 0 ? `${formatPercent(LOYALTY.cashbackPercent)} de cashback em todo atendimento pago, ` : ''}
            {LOYALTY.birthdayDiscount}% na semana do aniversário e preferências salvas. Os dados atuais são aproveitados.
          </Text>
          <Button
            label="Virar Premium"
            icon="diamond-outline"
            onPress={() => router.push({ pathname: '/cadastro', params: { tipo: 'premium', id: client.id } })}
            style={{ marginTop: 12 }}
          />
        </View>
      )}

      {premium && birthdayWeek && LOYALTY.birthdayDiscount > 0 && (
        <View style={styles.birthday}>
          <Ionicons name="gift-outline" size={22} color={colors.wine} />
          <Text style={styles.birthdayText}>
            Semana de aniversário! {LOYALTY.birthdayDiscount}% de desconto em qualquer serviço até{' '}
            {formatDayMonth(birthdayWeek.end)}.
          </Text>
        </View>
      )}

      <Section title="Histórico">
        {history.length === 0 ? (
          <Text style={styles.muted}>Nenhum atendimento ainda.</Text>
        ) : (
          history.slice(0, 8).map((a) => (
            <Pressable
              key={a.id}
              style={styles.row}
              onPress={() => router.push({ pathname: '/agendamento/[id]', params: { id: a.id } })}
            >
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.rowValue}>{a.serviceName}</Text>
                <Text style={styles.rowLabel}>
                  {formatDayMonth(a.date)} às {a.time} · {brl(a.paidAmount ?? a.price)}
                </Text>
              </View>
              <StatusChip status={a.status} />
            </Pressable>
          ))
        )}
      </Section>

      <Section title="Contato">
        <Row label="WhatsApp" value={`${formatPhone(client.phone)}${client.phoneVerified ? ' · verificado' : ''}`} />
        {client.email && <Row label="E-mail" value={client.email} />}
        {client.birthDate && <Row label="Nascimento" value={client.birthDate} />}
        {client.address && <Row label="Endereço" value={client.address} />}
        {client.contactChannel && (
          <Row label="Prefere contato por" value={CONTACT_CHANNELS.find((c) => c.id === client.contactChannel)?.label ?? ''} />
        )}
        <Row label="Lembretes no WhatsApp" value={client.remindersConsent ? 'Sim' : 'Não'} />
      </Section>

      {premium && (
        <Section title="Preferências">
          <Row label="Formato" value={client.preferredShape ? shapeById(client.preferredShape).name : 'Não informado'} />
          <Row label="Comprimento" value={LENGTHS.find((l) => l.id === client.preferredLength)?.label ?? 'Não informado'} />
          <Row label="Melhores horários" value={client.preferredPeriods?.join(', ') || 'Não informado'} />
          {!!client.favoriteColors?.length && (
            <View style={styles.colorsRow}>
              <Text style={styles.rowLabel}>Cores favoritas</Text>
              <View style={styles.colors}>
                {client.favoriteColors.map((c) => (
                  <View key={c} style={[styles.colorDot, { backgroundColor: polishById(c).color }]} accessibilityLabel={polishById(c).name} />
                ))}
              </View>
            </View>
          )}
          {client.referralSource && (
            <Row label="Conheceu por" value={client.referredBy ? `${client.referralSource} (${client.referredBy})` : client.referralSource} />
          )}
        </Section>
      )}

      {premium && (
        <Section title="Ficha de saúde">
          {client.healthConsent ? (
            <>
              {!!client.allergies?.length && (
                <View style={styles.alert}>
                  <Ionicons name="warning-outline" size={18} color="#B45309" />
                  <Text style={styles.alertText}>Alergia: {client.allergies.join(', ')}</Text>
                </View>
              )}
              <Row label="Condições" value={client.healthConditions?.join(', ') || 'Nenhuma informada'} />
              {!!client.healthNotes && <Row label="Observações" value={client.healthNotes} />}
            </>
          ) : (
            <Text style={styles.muted}>Nenhuma informação de saúde registrada.</Text>
          )}
        </Section>
      )}

      <View style={{ marginTop: 22, gap: 10 }}>
        {/* Entrada sem código: o número fica preso a um celular; a profissional libera quando a cliente troca de aparelho. */}
        {supabase && canManage && !CODE_BY_WHATSAPP && (
          <Button
            label="Liberar acesso em outro celular"
            icon="phone-portrait-outline"
            variant="secondary"
            onPress={async () => {
              const { error } = await supabase!.from('phone_claims').delete().eq('phone', toAuthPhone(client.phone));
              if (error) reportSyncError(error);
              else setAction({ message: `${client.name.split(' ')[0]} já pode entrar no app por um celular novo.`, novo });
            }}
          />
        )}
        <Button
          label="Editar cadastro"
          icon="create-outline"
          variant="secondary"
          onPress={() => router.push({ pathname: '/cadastro', params: { tipo: client.plan, id: client.id } })}
        />
        {confirmDelete ? (
          <View style={styles.confirm}>
            <Text style={styles.confirmText}>
              Apagar todos os dados de {client.name.split(' ')[0]}? {premium ? 'O cadastro Premium e as preferências também serão apagados.' : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button label="Cancelar" variant="secondary" onPress={() => setConfirmDelete(false)} style={{ flex: 1 }} />
              <Button
                label="Apagar"
                variant="danger"
                onPress={() => {
                  removeClient(client.id);
                  // A cliente que apaga o próprio cadastro também sai da conta.
                  if (role === 'cliente') signOut();
                  router.replace('/clientes');
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : (
          <Button label="Excluir cadastro" icon="trash-outline" variant="danger" onPress={() => setConfirmDelete(true)} />
        )}
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  muted: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, lineHeight: 19 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E6F3EC',
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 14,
  },
  noticeText: { fontFamily: fonts.medium, fontSize: 13, color: colors.success, flex: 1 },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 16,
    ...shadow,
  },
  avatar: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.display, fontSize: 20, color: colors.plum },
  name: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  since: { fontFamily: fonts.regular, fontSize: 11, color: colors.roseGold, marginTop: 2 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.blush },
  badgePremium: { backgroundColor: colors.plum },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.wine },
  badgeTextPremium: { color: colors.roseGoldLight },
  upgrade: {
    marginTop: 16,
    padding: 18,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.roseGoldLight,
    backgroundColor: colors.white,
  },
  upgradeTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  upgradeText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 6 },
  birthday: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.blush,
    borderRadius: radius.sm,
    padding: 14,
    marginTop: 14,
  },
  birthdayText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.wine },
  section: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  rowValue: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink, flexShrink: 1, textAlign: 'right' },
  colorsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  colors: { flexDirection: 'row', gap: 6 },
  colorDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: radius.sm,
    padding: 10,
    marginBottom: 6,
  },
  alertText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: '#92400E' },
  confirm: { gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: colors.blush },
  confirmText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink, lineHeight: 19 },
});
