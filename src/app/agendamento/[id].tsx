import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chips, Field, ScreenHeader } from '@/components/ui';
import { useAppointments, PAYMENT_LABEL, type PaymentMethod } from '@/features/agenda/AppointmentsContext';
import { endTime, StatusChip } from '@/features/agenda/components';
import { useClients } from '@/features/clients/ClientsContext';
import { useFinance } from '@/features/finance/FinanceContext';
import { useSettings } from '@/features/settings/SettingsContext';
import { colors, fonts, radius, shadow } from '@/theme';
import { newId } from '@/utils/id';
import { formatLongDate } from '@/utils/date';
import { brl, formatPhone } from '@/utils/format';

const NOTICES: Record<string, string> = {
  criado: 'Horário agendado!',
  remarcado: 'Horário remarcado.',
};

export default function AgendamentoScreen() {
  const insets = useSafeAreaInsets();
  const { id, novo } = useLocalSearchParams<{ id: string; novo?: string }>();
  const { ready, getAppointment, updateStatus, removeAppointment } = useAppointments();
  const { getClient, registerVisit } = useClients();
  const { addTransaction } = useFinance();
  const { settings } = useSettings();
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

  const client = a.clientId ? getClient(a.clientId) : undefined;
  const open = a.status === 'agendado' || a.status === 'confirmado';
  const notice = action && action.novo === novo ? action.message : novo ? (NOTICES[novo] ?? null) : null;
  const firstName = a.clientName.split(' ')[0];
  const when = `${formatLongDate(a.date)}, às ${a.time}`;

  const say = (message: string) => setAction({ message, novo });

  function whatsapp(text: string) {
    Linking.openURL(`https://wa.me/55${a!.clientPhone}?text=${encodeURIComponent(text)}`);
  }

  function complete() {
    const paid = Number((amount || String(a!.price)).replace(',', '.'));
    if (!(paid >= 0)) return;
    updateStatus(a!.id, 'concluido', { paidAmount: paid, paymentMethod: method });
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
    // Cliente Premium ganha o selo do cartão fidelidade automaticamente.
    if (client?.plan === 'premium') registerVisit(client.id);
    setPaying(false);
    say(`Atendimento concluído e ${brl(paid)} lançado no financeiro${client?.plan === 'premium' ? ` · +1 selo para ${firstName}` : ''}.`);
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

      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.service}>{a.serviceName}</Text>
            <Text style={styles.muted}>
              {a.time} às {endTime(a)} · {a.duration} min
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
          <Text style={styles.rowValue}>{formatPhone(a.clientPhone)}</Text>
        </Row>
        <Row label={a.status === 'concluido' ? 'Pago' : 'Valor'}>
          <Text style={styles.rowValue}>
            {brl(a.paidAmount ?? a.price)}
            {a.paymentMethod ? ` · ${PAYMENT_LABEL[a.paymentMethod]}` : ''}
          </Text>
        </Row>
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
                <Field
                  label="Valor recebido (R$)"
                  value={amount || String(a.price)}
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
              <Button label="Concluir atendimento" icon="checkmark-done" onPress={() => setPaying(true)} />
              {a.status === 'agendado' && (
                <Button
                  label="Marcar como confirmado"
                  icon="checkmark-circle-outline"
                  variant="secondary"
                  onPress={() => {
                    updateStatus(a.id, 'confirmado');
                    say(`Presença de ${firstName} confirmada.`);
                  }}
                />
              )}
              <Button
                label={a.status === 'agendado' ? 'Pedir confirmação no WhatsApp' : 'Enviar lembrete no WhatsApp'}
                icon="logo-whatsapp"
                variant="secondary"
                onPress={() =>
                  whatsapp(
                    `Oi, ${firstName}! Aqui é a ${settings.professionalName}, do ${settings.studioName}. ` +
                      `Seu horário de ${a.serviceName.toLowerCase()} está marcado para ${when}. ` +
                      (a.status === 'agendado' ? 'Pode confirmar, por favor? 💅' : 'Te espero! 💅'),
                  )
                }
              />
              <Button label="Remarcar" icon="calendar-outline" variant="secondary" onPress={() => router.push({ pathname: '/agendamento/novo', params: { id: a.id } })} />
              <View style={styles.inlineActions}>
                <Pressable
                  onPress={() => {
                    updateStatus(a.id, 'faltou');
                    say(`${firstName} marcada como falta.`);
                  }}
                  hitSlop={6}
                >
                  <Text style={styles.subtle}>Marcar falta</Text>
                </Pressable>
                <Pressable onPress={() => setConfirm('cancelar')} hitSlop={6}>
                  <Text style={[styles.subtle, { color: colors.danger }]}>Cancelar horário</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      )}

      {a.status === 'concluido' && (
        <View style={styles.actions}>
          <Button label="Pedir avaliação" icon="star-outline" onPress={() => router.push('/avaliacoes/nova')} />
          <Button
            label="Enviar agradecimento no WhatsApp"
            icon="logo-whatsapp"
            variant="secondary"
            onPress={() =>
              whatsapp(`Obrigada pela visita, ${firstName}! Se puder, deixe sua avaliação com a foto das unhas no app do ${settings.studioName}. 💕`)
            }
          />
        </View>
      )}

      {(a.status === 'cancelado' || a.status === 'faltou') && (
        <View style={styles.actions}>
          <Button label="Remarcar" icon="calendar-outline" onPress={() => router.push({ pathname: '/agendamento/novo', params: { id: a.id } })} />
          <Button label="Excluir da agenda" icon="trash-outline" variant="danger" onPress={() => setConfirm('excluir')} />
        </View>
      )}

      {confirm && (
        <View style={styles.confirm}>
          <Text style={styles.confirmText}>
            {confirm === 'cancelar' ? `Cancelar o horário de ${firstName}? O horário fica livre na agenda.` : 'Excluir este agendamento de vez?'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="Voltar" variant="secondary" onPress={() => setConfirm(null)} style={{ flex: 1 }} />
            <Button
              label={confirm === 'cancelar' ? 'Cancelar horário' : 'Excluir'}
              variant="danger"
              onPress={() => {
                if (confirm === 'cancelar') {
                  updateStatus(a.id, 'cancelado');
                  say('Horário cancelado.');
                  setConfirm(null);
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
