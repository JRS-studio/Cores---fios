import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, ScreenHeader } from '@/components/ui';
import { polishById, shapeById } from '@/data/catalog';
import { LEVELS, LOYALTY, levelFor, nextLevel } from '@/data/loyalty';
import { useAppointments } from '@/features/agenda/AppointmentsContext';
import { StatusChip } from '@/features/agenda/components';
import { useClients } from '@/features/clients/ClientsContext';
import { supabase, toAuthPhone } from '@/data/supabase';
import { reportSyncError } from '@/data/syncStatus';
import { useSession } from '@/features/session/SessionContext';
import { CODE_BY_WHATSAPP } from '@/features/verification/whatsappCode';
import { CONTACT_CHANNELS, LENGTHS, type Client } from '@/features/clients/types';
import { colors, fonts, radius, shadow } from '@/theme';
import { formatDayMonth } from '@/utils/date';
import { brl, formatPhone, formatShortDate, initials, parseDate } from '@/utils/format';

const WELCOME: Record<string, string> = {
  rapido: 'Cadastro concluído! Seus dados já ficam prontos para o próximo agendamento.',
  premium: `Bem-vinda ao Premium! Você já ganhou ${LOYALTY.welcomeStamps} selo de boas-vindas.`,
  editado: 'Cadastro atualizado.',
};

export default function ClienteScreen() {
  const insets = useSafeAreaInsets();
  const { id, novo } = useLocalSearchParams<{ id: string; novo?: string }>();
  const { ready, getClient, registerVisit, addReferralBonus, redeemReward, removeClient } = useClients();
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
  const loyalty = client.loyalty ?? { stamps: 0, totalVisits: 0, rewardsRedeemed: 0 };
  const birthday = client.birthDate ? parseDate(client.birthDate) : null;
  const birthdayMonth = !!birthday && birthday.getMonth() === new Date().getMonth();

  const act = (fn: () => void, message: string) => {
    fn();
    setAction({ message, novo });
  };

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
        <LoyaltyCard client={client} />
      ) : (
        <View style={styles.upgrade}>
          <Text style={styles.upgradeTitle}>Ganhe vantagens com o Premium</Text>
          <Text style={styles.upgradeText}>
            Cartão fidelidade ({LOYALTY.stampsForReward} atendimentos = 1 {LOYALTY.reward.toLowerCase()}),{' '}
            {LOYALTY.birthdayDiscount}% no mês do aniversário e preferências salvas. Os dados atuais são aproveitados.
          </Text>
          <Button
            label="Virar Premium"
            icon="diamond-outline"
            onPress={() => router.push({ pathname: '/cadastro', params: { tipo: 'premium', id: client.id } })}
            style={{ marginTop: 12 }}
          />
        </View>
      )}

      {premium && birthdayMonth && (
        <View style={styles.birthday}>
          <Ionicons name="gift-outline" size={22} color={colors.wine} />
          <Text style={styles.birthdayText}>
            Mês de aniversário! {LOYALTY.birthdayDiscount}% de desconto em qualquer serviço até o fim do mês.
          </Text>
        </View>
      )}

      {premium && canManage && (
        <Section title="Área da profissional">
          <Text style={styles.muted}>Use depois de cada atendimento para atualizar o cartão da cliente.</Text>
          <View style={styles.proActions}>
            <Button label="Registrar atendimento (+1 selo)" icon="add-circle-outline" onPress={() => act(() => registerVisit(client.id), 'Atendimento registrado: +1 selo.')} />
            <Button
              label={`Bônus de indicação (+${LOYALTY.referralStamps} selos)`}
              icon="people-outline"
              variant="secondary"
              onPress={() => act(() => addReferralBonus(client.id), `Indicação registrada: +${LOYALTY.referralStamps} selos.`)}
            />
            {loyalty.stamps >= LOYALTY.stampsForReward && (
              <Button
                label={`Resgatar ${LOYALTY.reward.toLowerCase()}`}
                icon="gift-outline"
                onPress={() => act(() => redeemReward(client.id), 'Prêmio resgatado. Aproveite!')}
              />
            )}
          </View>
        </Section>
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
              Apagar todos os dados de {client.name.split(' ')[0]}? {premium ? 'Os selos acumulados também serão perdidos.' : ''}
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

function LoyaltyCard({ client }: { client: Client }) {
  const loyalty = client.loyalty ?? { stamps: 0, totalVisits: 0, rewardsRedeemed: 0 };
  const level = levelFor(loyalty.totalVisits);
  const upcoming = nextLevel(loyalty.totalVisits);
  const filled = Math.min(loyalty.stamps, LOYALTY.stampsForReward);
  const remaining = LOYALTY.stampsForReward - filled;

  return (
    <LinearGradient colors={[colors.wine, colors.plum]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={styles.cardTop}>
        <View>
          <Text style={styles.cardEyebrow}>CARTÃO FIDELIDADE</Text>
          <Text style={styles.cardTitle}>Nível {level.name}</Text>
        </View>
        <View style={styles.levelPill}>
          <Ionicons name="diamond" size={12} color={colors.plum} />
          <Text style={styles.levelPillText}>{loyalty.totalVisits} atendimentos</Text>
        </View>
      </View>

      <View style={styles.stamps}>
        {Array.from({ length: LOYALTY.stampsForReward }, (_, i) => (
          <View key={i} style={[styles.stamp, i < filled && styles.stampOn]}>
            {i < filled ? (
              <Ionicons name="sparkles" size={16} color={colors.plum} />
            ) : (
              <Text style={styles.stampNumber}>{i + 1}</Text>
            )}
          </View>
        ))}
      </View>

      <Text style={styles.cardStatus}>
        {remaining === 0
          ? `Prêmio liberado: ${LOYALTY.reward.toLowerCase()}!`
          : `Faltam ${remaining} ${remaining === 1 ? 'selo' : 'selos'} para ${LOYALTY.reward.toLowerCase()}.`}
        {loyalty.stamps > LOYALTY.stampsForReward ? ` (+${loyalty.stamps - LOYALTY.stampsForReward} guardados)` : ''}
      </Text>
      <Text style={styles.cardPerk}>{level.perk}</Text>
      {upcoming && (
        <Text style={styles.cardNext}>
          Próximo nível: {upcoming.name} com {upcoming.minVisits} atendimentos.
        </Text>
      )}
      {loyalty.rewardsRedeemed > 0 && (
        <Text style={styles.cardNext}>
          {loyalty.rewardsRedeemed} {loyalty.rewardsRedeemed === 1 ? 'prêmio resgatado' : 'prêmios resgatados'}.
        </Text>
      )}
      <View style={styles.levels}>
        {LEVELS.map((l) => (
          <Text key={l.id} style={[styles.levelName, l.id === level.id && styles.levelNameOn]}>
            {l.name}
          </Text>
        ))}
      </View>
    </LinearGradient>
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
  card: { borderRadius: radius.lg, padding: 20, marginTop: 16, ...shadow, shadowOpacity: 0.25 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardEyebrow: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 2, color: colors.roseGold },
  cardTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.white, marginTop: 2 },
  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.roseGoldLight,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  levelPillText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.plum },
  stamps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18, justifyContent: 'space-between' },
  stamp: {
    width: '17%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(232,205,181,0.45)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampOn: { backgroundColor: colors.roseGoldLight, borderStyle: 'solid', borderColor: colors.roseGoldLight },
  stampNumber: { fontFamily: fonts.medium, fontSize: 12, color: 'rgba(232,205,181,0.6)' },
  cardStatus: { fontFamily: fonts.semibold, fontSize: 14, color: colors.white, marginTop: 16 },
  cardPerk: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  cardNext: { fontFamily: fonts.regular, fontSize: 12, color: colors.roseGoldLight, marginTop: 4 },
  levels: { flexDirection: 'row', gap: 14, marginTop: 14 },
  levelName: { fontFamily: fonts.medium, fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  levelNameOn: { color: colors.roseGoldLight, textDecorationLine: 'underline' },
  proActions: { gap: 10, marginTop: 12 },
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
