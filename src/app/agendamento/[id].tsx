import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chips, Field, ScreenHeader } from '@/components/ui';
import { useAppointments, PAYMENT_LABEL, type PaymentMethod } from '@/features/agenda/AppointmentsContext';
import { endTime, StatusChip } from '@/features/agenda/components';
import { useCancelRequests } from '@/features/agenda/CancelRequestsContext';
import { cancelRequestWhatsApp, newBookingWhatsApp } from '@/features/agenda/whatsapp';
import { cashbackFor, roundCents, useCashback, type CashbackEntry } from '@/features/cashback/CashbackContext';
import { useClients } from '@/features/clients/ClientsContext';
import { useFinance } from '@/features/finance/FinanceContext';
import { useSession } from '@/features/session/SessionContext';
import { useSettings } from '@/features/settings/SettingsContext';
import { colors, fonts, radius, shadow } from '@/theme';
import { newId } from '@/utils/id';
import { formatLongDate } from '@/utils/date';
import { brl, formatPhone } from '@/utils/format';
import { openExternal } from '@/utils/openExternal';
import { RemindersCard } from '@/features/reminders/RemindersCard';

const NOTICES: Record<string, string> = {
  criado: 'Horário agendado!',
  remarcado: 'Horário remarcado.',
};
// Para a cliente, o horário só vale depois que a profissional confirma.
const CLIENT_NOTICES: Record<string, string> = {
  criado: 'Pedido de horário enviado! Agora é só aguardar a confirmação.',
  remarcado: 'Pedido de remarcação enviado! Aguarde a confirmação.',
};

export default function AgendamentoScreen() {
  const insets = useSafeAreaInsets();
  const { id, novo } = useLocalSearchParams<{ id: string; novo?: string }>();
  const { ready, getAppointment, updateStatus, removeAppointment } = useAppointments();
  const { getClient, findByPhone } = useClients();
  const { balanceOf, addEntries } = useCashback();
  const { addTransaction } = useFinance();
  const { settings } = useSettings();
  // A cliente só remarca ou cancela; concluir, cobrar, confirmar e marcar falta são da profissional.
  const { canManage } = useSession();
  const { openFor, request, resolveFor } = useCancelRequests();
  const [action, setAction] = useState<{ message: string; novo?: string } | null>(null);
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [amount, setAmount] = useState('');
  const [confirm, setConfirm] = useState<'cancelar' | 'excluir' | null>(null);
  const a = getAppointment(id);

  if (!a) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 12, paddingHorizontal: 20 }]}>
        <ScreenHeader title="Agendamento" />
        <Text style={styles.muted}>{ready ? 'Agendamento não encontrado.' : 'Carregando…'}</Text>
      </View>
    );
  }

  const client = (a.clientId ? getClient(a.clientId) : undefined) ?? (a.clientPhone ? findByPhone(a.clientPhone) : undefined);
  // Cliente avulsa sem WhatsApp: sem botões de mensagem.
  const hasPhone = !!a.clientPhone;
  const open = a.status === 'agendado' || a.status === 'confirmado';
  const cancelRequest = openFor(a.id);
  // Cashback que a cliente escolheu usar: nunca mais que o saldo dela nem que o valor do serviço.
  const cashbackUse = open ? roundCents(Math.min(a.cashbackUse ?? 0, balanceOf(a.clientPhone), a.price)) : 0;
  const toReceive = roundCents(a.price - cashbackUse);
  const notice = action && action.novo === novo ? action.message : novo ? ((canManage ? NOTICES : CLIENT_NOTICES)[novo] ?? null) : null;
  const firstName = a.clientName.split(' ')[0];
  const when = `${formatLongDate(a.date)}, às ${a.time}`;

  const say = (message: string) => setAction({ message, novo });
  const justConfirmed = !!action?.message.includes('confirmado');

  function whatsapp(text: string) {
    openExternal(`https://wa.me/55${a!.clientPhone}?text=${encodeURIComponent(text)}`);
  }

  function complete() {
    const paid = Number((amount || String(toReceive)).replace(',', '.'));
    if (!(paid >= 0)) return;
    // Cliente Premium ganha cashback sobre o que pagou; o cashback usado sai do saldo.
    const earned = client?.plan === 'premium' ? cashbackFor(paid, settings.loyalty.cashbackPercent) : 0;
    const now = new Date().toISOString();
    const base = { createdAt: now, clientPhone: a!.clientPhone, clientName: a!.clientName, appointmentId: a!.id };
    const entries: CashbackEntry[] = [];
    if (cashbackUse > 0) entries.push({ ...base, id: newId(), kind: 'uso', amount: -cashbackUse, description: `Usado: ${a!.serviceName}` });
    if (earned > 0) entries.push({ ...base, id: newId(), kind: 'credito', amount: earned, description: a!.serviceName });
    addEntries(entries);
    updateStatus(a!.id, 'concluido', {
      paidAmount: paid,
      paymentMethod: method,
      cashbackUsed: cashbackUse || undefined,
      cashbackEarned: earned || undefined,
    });
    addTransaction({
      id: newId(),
      createdAt: new Date().toISOString(),
      type: 'entrada',
      amount: paid,
      description: `${a!.serviceName} · ${a!.clientName}`,
      category: 'Atendimento',
      method,
      date: a!.date,
      appointmentId: a!.id,
    });
    setPaying(false);
    say(
      `Atendimento concluído e ${brl(paid)} lançado no financeiro` +
        (cashbackUse > 0 ? ` · ${brl(cashbackUse)} de cashback usado` : '') +
        (earned > 0 ? ` · +${brl(earned)} de cashback para ${firstName}` : '') +
        '.',
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
    >
      <ScreenHeader title="Agendamento" subtitle={when} />

      {notice && (
        <View style={styles.notice}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      )}
      {open && cancelRequest && (
        <View style={styles.cancelRequest}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
            <Text style={styles.cancelRequestText}>
              {canManage
                ? `${firstName} pediu para cancelar este horário.`
                : `Você pediu o cancelamento. O horário continua marcado até ${settings.professionalName} responder.`}
            </Text>
          </View>
          {canManage && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button label="Cancelar horário" variant="danger" onPress={() => setConfirm('cancelar')} style={{ flex: 1 }} />
              <Button
                label="Manter horário"
                variant="secondary"
                onPress={() => {
                  resolveFor(a.id);
                  say(`Pedido de cancelamento de ${firstName} respondido: o horário continua marcado.`);
                }}
                style={{ flex: 1 }}
              />
            </View>
          )}
        </View>
      )}
      {!canManage && novo && settings.whatsapp ? (
        <Button
          label={`Avisar ${settings.professionalName} no WhatsApp`}
          icon="logo-whatsapp"
          variant="secondary"
          onPress={() => openExternal(newBookingWhatsApp(settings.whatsapp, a, novo === 'remarcado'))}
          style={{ marginBottom: 14 }}
        />
      ) : null}

      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.service}>{a.serviceName}</Text>
            <Text style={styles.muted}>
              {/* A cliente vê só o horário de início; o fim e a duração são da agenda da profissional. */}
              {canManage ? `${a.time} às ${endTime(a)} · ${a.duration} min` : `Às ${a.time}`}
            </Text>
          </View>
          <StatusChip status={a.status} />
        </View>
        <Row label="Cliente">
          {client ? (
            <Pressable onPress={() => router.push({ pathname: '/cliente/[id]', params: { id: client.id } })}>
              <Text style={[styles.rowValue, styles.link]}>{a.clientName} ›</Text>
            </Pressable>
          ) : (
            <Text style={styles.rowValue}>{a.clientName}</Text>
          )}
        </Row>
        <Row label="WhatsApp">
          <Text style={[styles.rowValue, !hasPhone && { color: colors.muted }]}>
            {hasPhone ? formatPhone(a.clientPhone) : 'Não informado'}
          </Text>
        </Row>
        <Row label={a.status === 'concluido' ? 'Pago' : 'Valor'}>
          <Text style={styles.rowValue}>
            {brl(a.paidAmount ?? a.price)}
            {a.paymentMethod ? ` · ${PAYMENT_LABEL[a.paymentMethod]}` : ''}
          </Text>
        </Row>
        {!!a.birthdayDiscount && (
          <Row label="Aniversário">
            <Text style={styles.rowValue}>
              {a.birthdayDiscount}% de desconto{a.fullPrice ? ` (de ${brl(a.fullPrice)})` : ''}
            </Text>
          </Row>
        )}
        {(cashbackUse > 0 || a.cashbackUsed || a.cashbackEarned) && (
          <Row label="Cashback">
            <Text style={styles.rowValue}>
              {open
                ? `${brl(cashbackUse)} do saldo · a pagar ${brl(toReceive)}`
                : [a.cashbackUsed ? `usou ${brl(a.cashbackUsed)}` : null, a.cashbackEarned ? `ganhou ${brl(a.cashbackEarned)}` : null]
                    .filter(Boolean)
                    .join(' · ')}
            </Text>
          </Row>
        )}
        {a.notes && (
          <Row label="Observações">
            <Text style={styles.rowValue}>{a.notes}</Text>
          </Row>
        )}
      </View>

      {client?.allergies?.length ? (
        <View style={styles.alert}>
          <Ionicons name="warning-outline" size={18} color="#B45309" />
          <Text style={styles.alertText}>Atenção, alergia: {client.allergies.join(', ')}</Text>
        </View>
      ) : null}

      {open && (
        <View style={styles.actions}>
          {paying ? (
            <View style={styles.payment}>
              <Text style={styles.paymentTitle}>Pagamento</Text>
              <Chips
                options={(Object.keys(PAYMENT_LABEL) as PaymentMethod[]).map((m) => ({ id: m, label: PAYMENT_LABEL[m] }))}
                selected={[method]}
                onToggle={(m) => setMethod(m as PaymentMethod)}
              />
              <View style={{ marginTop: 14 }}>
                {cashbackUse > 0 && (
                  <Text style={styles.cashbackNote}>
                    {firstName} usa {brl(cashbackUse)} de cashback: receba {brl(toReceive)} de {brl(a.price)}.
                  </Text>
                )}
                <Field
                  label="Valor recebido (R$)"
                  value={amount || String(toReceive)}
                  onChangeText={(t) => setAmount(t.replace(/[^\d,.]/g, ''))}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button label="Voltar" variant="secondary" onPress={() => setPaying(false)} style={{ flex: 1 }} />
                <Button label="Concluir" icon="checkmark-done" onPress={complete} style={{ flex: 2 }} />
              </View>
            </View>
          ) : (
            <>
              {canManage && a.status === 'agendado' && (
                <>
                  <Button
                    label="Confirmar horário"
                    icon="checkmark-circle-outline"
                    onPress={() => {
                      updateStatus(a.id, 'confirmado');
                      say(`Horário de ${firstName} confirmado.${hasPhone ? ' Avise a cliente pelo WhatsApp.' : ''}`);
                    }}
                  />
                  {hasPhone && (
                    <Button
                      label="Recusar e sugerir outro horário"
                      icon="logo-whatsapp"
                      variant="secondary"
                      onPress={() =>
                        whatsapp(
                          `Oi, ${firstName}! Aqui é a ${settings.professionalName}, do ${settings.studioName}. ` +
                            `Não vou conseguir te atender ${when}. Podemos ver outro horário? 💅`,
                        )
                      }
                    />
                  )}
                </>
              )}
              {canManage && a.status === 'confirmado' && (
                <>
                  <Button label="Concluir atendimento" icon="checkmark-done" onPress={() => setPaying(true)} />
                  {hasPhone && (
                    <Button
                      label={justConfirmed ? `Avisar ${firstName} que está confirmado` : 'Enviar lembrete no WhatsApp'}
                      icon="logo-whatsapp"
                      variant={justConfirmed ? 'primary' : 'secondary'}
                      onPress={() =>
                        whatsapp(
                          justConfirmed
                            ? `Oi, ${firstName}! Seu horário de ${a.serviceName.toLowerCase()} no ${settings.studioName} está confirmado para ${when}. Te espero! 💅`
                            : `Oi, ${firstName}! Passando para lembrar do seu horário de ${a.serviceName.toLowerCase()} ${when}. Te espero! 💅`,
                        )
                      }
                    />
                  )}
                </>
              )}
              {!canManage && <RemindersCard compact />}
              {!canManage && a.status === 'agendado' && (
                <View style={styles.pending}>
                  <Ionicons name="hourglass-outline" size={18} color="#B45309" />
                  <Text style={styles.pendingText}>
                    Aguardando a confirmação de {settings.professionalName}. Você recebe a confirmação pelo WhatsApp.
                  </Text>
                </View>
              )}
              <Button
                label="Remarcar"
                icon="calendar-outline"
                variant="secondary"
                onPress={() => router.push({ pathname: '/agendamento/novo', params: { id: a.id } })}
              />
              <View style={styles.inlineActions}>
                {canManage && (
                  <Pressable
                    onPress={() => {
                      updateStatus(a.id, 'faltou');
                      say(`${firstName} marcada como falta.`);
                    }}
                    hitSlop={6}
                  >
                    <Text style={styles.subtle}>Marcar falta</Text>
                  </Pressable>
                )}
                {canManage ? (
                  <Pressable onPress={() => setConfirm('cancelar')} hitSlop={6}>
                    <Text style={[styles.subtle, { color: colors.danger }]}>Cancelar horário</Text>
                  </Pressable>
                ) : (
                  // Só a profissional cancela: a cliente pede pelo app (vai para os Avisos da profissional, com
                  // notificação no celular dela) e pelo WhatsApp; o horário continua marcado até a resposta.
                  !cancelRequest && (
                    <Pressable
                      onPress={async () => {
                        const ok = await request(a);
                        if (settings.whatsapp) openExternal(cancelRequestWhatsApp(settings.whatsapp, a, settings.professionalName));
                        say(
                          ok
                            ? `Pedido de cancelamento enviado para ${settings.professionalName}. O horário continua marcado até ela responder.`
                            : 'Não foi possível enviar o pedido agora. Confira a internet e tente de novo.',
                        );
                      }}
                      hitSlop={6}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.subtle, { color: colors.danger }]}>Pedir cancelamento</Text>
                    </Pressable>
                  )
                )}
              </View>
            </>
          )}
        </View>
      )}

      {a.status === 'concluido' && (
        <View style={styles.actions}>
          <Button
            label={canManage ? 'Pedir avaliação' : 'Avaliar meu atendimento'}
            icon="star-outline"
            onPress={() => router.push('/avaliacoes/nova')}
          />
          {canManage && hasPhone && (
            <Button
              label="Enviar agradecimento no WhatsApp"
              icon="logo-whatsapp"
              variant="secondary"
              onPress={() =>
                whatsapp(
                  `Obrigada pela visita, ${firstName}! Se puder, deixe sua avaliação com a foto das unhas no app do ${settings.studioName}. 💕`,
                )
              }
            />
          )}
        </View>
      )}

      {(a.status === 'cancelado' || a.status === 'faltou') && (
        <View style={styles.actions}>
          {canManage ? (
            <>
              <Button
                label="Remarcar"
                icon="calendar-outline"
                onPress={() => router.push({ pathname: '/agendamento/novo', params: { id: a.id } })}
              />
              <Button label="Excluir da agenda" icon="trash-outline" variant="danger" onPress={() => setConfirm('excluir')} />
            </>
          ) : (
            <Button label="Agendar de novo" icon="calendar-outline" onPress={() => router.push('/agendamento/novo')} />
          )}
        </View>
      )}

      {confirm && (
        <View style={styles.confirm}>
          <Text style={styles.confirmText}>
            {confirm === 'cancelar'
              ? `Cancelar o horário de ${firstName}? O horário fica livre na agenda.`
              : 'Excluir este agendamento de vez?'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="Voltar" variant="secondary" onPress={() => setConfirm(null)} style={{ flex: 1 }} />
            <Button
              label={confirm === 'cancelar' ? 'Cancelar horário' : 'Excluir'}
              variant="danger"
              onPress={() => {
                if (confirm === 'cancelar') {
                  updateStatus(a.id, 'cancelado');
                  resolveFor(a.id);
                  setConfirm(null);
                  say('Horário cancelado.');
                } else {
                  removeAppointment(a.id);
                  router.back();
                }
              }}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  cancelRequest: { gap: 12, backgroundColor: '#FBEAE4', borderRadius: radius.md, padding: 14, marginBottom: 14 },
  cancelRequestText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19, color: colors.ink },
  cashbackNote: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.wine, marginBottom: 10 },
  pending: { flexDirection: 'row', gap: 10, backgroundColor: '#FEF3E2', borderRadius: radius.sm, padding: 12 },
  pendingText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: '#92400E' },
  screen: { flex: 1, backgroundColor: colors.cream },
  muted: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
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
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: 16, ...shadow },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  service: { fontFamily: fonts.display, fontSize: 21, color: colors.ink },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  rowValue: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink, textAlign: 'right', flexShrink: 1 },
  link: { color: colors.wine, fontFamily: fonts.semibold },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: radius.sm,
    padding: 12,
    marginTop: 14,
  },
  alertText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: '#92400E' },
  actions: { gap: 10, marginTop: 20 },
  inlineActions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, marginTop: 4 },
  subtle: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  payment: { backgroundColor: colors.white, borderRadius: radius.md, padding: 16, borderWidth: 1.5, borderColor: colors.plum },
  paymentTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, marginBottom: 10 },
  confirm: { gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: colors.blush, marginTop: 16 },
  confirmText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.ink },
});
