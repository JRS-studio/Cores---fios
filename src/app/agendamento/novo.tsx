import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, CheckRow, Field, ScreenHeader, SectionTitle } from '@/components/ui';
import { shapeById } from '@/data/catalog';
import { isServiceActive } from '@/data/services';
import { useAppointments, type Appointment } from '@/features/agenda/AppointmentsContext';
import { DateStrip, endTime } from '@/features/agenda/components';
import { newBookingWhatsApp } from '@/features/agenda/whatsapp';
import { roundCents, useCashback } from '@/features/cashback/CashbackContext';
import { useClients } from '@/features/clients/ClientsContext';
import { useSession } from '@/features/session/SessionContext';
import { isReleasedTime, releasedSlots, serviceIn, useSettings } from '@/features/settings/SettingsContext';
import { colors, fonts, radius } from '@/theme';
import { newId } from '@/utils/id';
import { addDays, formatLongDate, lastBookableDate, today } from '@/utils/date';
import { brl, formatPhone, initials, isValidPhone, onlyDigits, parseDate } from '@/utils/format';
import { openExternal } from '@/utils/openExternal';

// Horário antigo com um serviço fora da lista (mantém nome, duração e valor que já tinha).
const CUSTOM = 'personalizado';

export default function NovoAgendamentoScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ data?: string; id?: string; cliente?: string; hora?: string }>();
  const { getAppointment, saveAppointment, availableSlots, loadBusy } = useAppointments();
  const { clients, getClient, findByPhone, saveClient } = useClients();
  const { settings } = useSettings();
  const { canManage, phone: sessionPhone } = useSession();
  // A cliente agenda só para si mesma: o cadastro dela é encontrado pelo WhatsApp do login.
  const clientMode = !canManage;
  const me = clientMode && sessionPhone ? findByPhone(sessionPhone) : undefined;
  const editing = params.id ? getAppointment(params.id) : undefined;

  const [clientId, setClientId] = useState<string | undefined>(editing?.clientId ?? params.cliente);
  const [walkIn, setWalkIn] = useState(editing ? !editing.clientId : clients.length === 0);
  const [query, setQuery] = useState('');
  const [name, setName] = useState(editing && !editing.clientId ? editing.clientName : '');
  const [phone, setPhone] = useState(editing && !editing.clientId ? formatPhone(editing.clientPhone) : '');
  const [saveAsClient, setSaveAsClient] = useState(true);
  const custom = editing && !editing.serviceId ? editing : undefined;
  const [serviceId, setServiceId] = useState<string | undefined>(editing ? (editing.serviceId ?? CUSTOM) : undefined);
  const [price, setPrice] = useState(editing ? String(editing.fullPrice ?? editing.price) : '');
  // Clientes agendam até o fim do mês seguinte (a agenda do próximo mês abre no dia 1º); a profissional, até 6 meses.
  const lastDate = clientMode ? lastBookableDate() : addDays(today(), 180);
  const [date, setDate] = useState(
    editing?.date ?? (params.data && params.data >= today() && params.data <= lastDate ? params.data : today()),
  );
  const [time, setTime] = useState<string | undefined>(editing?.time ?? params.hora);
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [useCashbackBalance, setUseCashbackBalance] = useState(!!editing?.cashbackUse);
  // Com saldo e sem ter marcado, o app pergunta antes de confirmar.
  const [askCashback, setAskCashback] = useState(false);
  const [tried, setTried] = useState(false);

  const isWalkIn = !clientMode && walkIn;
  const selectedId = clientMode ? me?.id : clientId;
  const client = selectedId ? getClient(selectedId) : undefined;
  const LOYALTY = settings.loyalty;
  const services = settings.services.filter(isServiceActive);
  const service = serviceIn(settings, serviceId);
  const serviceName = serviceId === CUSTOM ? (custom?.serviceName ?? '') : (service?.name ?? '');
  const duration = serviceId === CUSTOM ? (custom?.duration ?? 60) : (service?.duration ?? 60);
  // A cliente só vê os horários que a profissional liberou para aquele dia da semana.
  const released = clientMode ? releasedSlots(settings, date) : null;
  const slots = availableSlots(date, duration, settings, editing?.id).filter((t) => !released || isReleasedTime(settings, released, t));

  // Com servidor, os horários das outras clientes vêm só como "ocupado".
  useEffect(() => {
    loadBusy(date);
  }, [date, loadBusy]);
  // Cashback livre da cliente (o que já está separado para outros horários não conta).
  const { availableOf } = useCashback();
  const available = !isWalkIn && client ? availableOf(client.phone, editing?.id) : 0;
  const birthday = client?.plan === 'premium' && client.birthDate ? parseDate(client.birthDate) : null;
  const birthdayMonth = !!birthday && birthday.getMonth() === new Date(date + 'T12:00').getMonth();
  // Cliente Premium no mês do aniversário: o desconto (o mesmo para todas, em Ajustes) entra sozinho.
  const birthdayDiscount = birthdayMonth ? LOYALTY.birthdayDiscount : 0;
  const fullPrice = Number(price.replace(',', '.')) || 0;
  const priceValue = birthdayDiscount > 0 ? roundCents(fullPrice * (1 - birthdayDiscount / 100)) : fullPrice;
  const cashbackFor = (use: boolean) => (use && available > 0 ? roundCents(Math.min(available, priceValue)) : 0);
  const cashbackUse = cashbackFor(useCashbackBalance);

  const q = query.trim().toLowerCase();
  const matches = clients
    .filter((c) => !q || c.name.toLowerCase().includes(q) || (onlyDigits(q) && c.phone.includes(onlyDigits(q))))
    .slice(0, 5);

  const walkInErrors = {
    name: name.trim().length < 2 ? 'Digite o nome da cliente.' : null,
    // Cliente avulsa marcada pela profissional: o WhatsApp é opcional (se preencher, precisa estar certo).
    phone: onlyDigits(phone) && !isValidPhone(phone) ? 'Digite um WhatsApp válido com DDD ou deixe em branco.' : null,
  };
  const errors = {
    client: isWalkIn ? (walkInErrors.name ?? walkInErrors.phone) : !client ? 'Escolha a cliente.' : null,
    service: !serviceName ? 'Escolha o serviço.' : null,
    price: !(Number(price.replace(',', '.')) >= 0) || price.trim() === '' ? 'Informe o valor.' : null,
    time: !time || !slots.includes(time) ? 'Escolha um horário livre.' : null,
  };
  const valid = Object.values(errors).every((e) => !e);

  function chooseService(id: string) {
    setServiceId(id);
    const s = serviceIn(settings, id);
    setPrice(id === CUSTOM ? String(custom?.price ?? price) : s ? String(s.price) : '');
    setTime(undefined);
  }

  function submit() {
    setTried(true);
    if (!valid || !time) return;
    if (available > 0 && priceValue > 0 && !useCashbackBalance) {
      setAskCashback(true);
      return;
    }
    save(useCashbackBalance);
  }

  function save(useBalance: boolean) {
    setAskCashback(false);
    if (!time) return;
    const cashbackUse = cashbackFor(useBalance);
    let finalClientId = isWalkIn ? undefined : selectedId;
    let clientName = isWalkIn ? name.trim() : (client?.name ?? '');
    let clientPhone = isWalkIn ? onlyDigits(phone) : (client?.phone ?? '');
    if (isWalkIn) {
      // Se o WhatsApp já é de uma cliente cadastrada, liga o agendamento a ela.
      const existing = clientPhone ? findByPhone(clientPhone) : undefined;
      if (existing) {
        finalClientId = existing.id;
        clientName = existing.name;
        clientPhone = existing.phone;
      } else if (saveAsClient && clientPhone) {
        finalClientId = newId();
        saveClient({
          id: finalClientId,
          plan: 'rapido',
          createdAt: new Date().toISOString(),
          name: name.trim(),
          phone: onlyDigits(phone),
          privacyConsent: true,
          remindersConsent: true,
        });
      }
    }
    const appointment: Appointment = {
      ...(editing ?? {}),
      id: editing?.id ?? newId(),
      createdAt: editing?.createdAt ?? new Date().toISOString(),
      clientId: finalClientId,
      clientName,
      clientPhone,
      serviceId: serviceId === CUSTOM ? undefined : serviceId,
      serviceName,
      price: priceValue,
      fullPrice: birthdayDiscount > 0 ? fullPrice : undefined,
      birthdayDiscount: birthdayDiscount > 0 ? birthdayDiscount : undefined,
      duration,
      date,
      time,
      // Pedido da cliente (novo ou remarcado) fica "a confirmar" até a profissional confirmar.
      // O que a própria profissional marca ou remarca já nasce confirmado.
      status: clientMode ? 'agendado' : 'confirmado',
      notes: notes.trim() || undefined,
      cashbackUse: cashbackUse > 0 ? cashbackUse : undefined,
    };
    saveAppointment(appointment);
    // A cliente avisa a profissional pelo WhatsApp dela (mensagem pronta; é só tocar em enviar).
    if (clientMode && settings.whatsapp) openExternal(newBookingWhatsApp(settings.whatsapp, appointment, !!editing));
    router.dismissTo({ pathname: '/agendamento/[id]', params: { id: appointment.id, novo: editing ? 'remarcado' : 'criado' } });
  }

  if (clientMode && !me) {
    return (
      <View style={[styles.screen, styles.gutter, { paddingTop: insets.top + 12 }]}>
        <ScreenHeader title="Agendar" />
        <Text style={styles.summary}>
          {sessionPhone
            ? 'Falta só o seu cadastro para escolher o horário.'
            : 'Para agendar, entre com seu WhatsApp. Sem senha e sem documentos.'}
        </Text>
        <View style={{ gap: 10, marginTop: 16 }}>
          {!sessionPhone && <Button label="Entrar com WhatsApp" icon="log-in-outline" onPress={() => router.push('/entrar')} />}
          <Button
            label="Fazer cadastro rápido"
            icon="flash-outline"
            variant={sessionPhone ? 'primary' : 'secondary'}
            onPress={() => router.push({ pathname: '/cadastro', params: { tipo: 'rapido' } })}
          />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.screen}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }}
      >
        <View style={styles.gutter}>
          <ScreenHeader title={editing ? 'Remarcar' : 'Novo agendamento'} subtitle={editing ? editing.clientName : 'Cliente, serviço e horário'} />

          {/* Cliente */}
          <SectionTitle>Cliente</SectionTitle>
          {!clientMode && clients.length > 0 && (
            <View style={styles.segment}>
              {[
                { id: false, label: 'Cadastrada' },
                { id: true, label: 'Nova / avulsa' },
              ].map((o) => (
                <Pressable key={o.label} style={[styles.segmentItem, walkIn === o.id && styles.segmentActive]} onPress={() => setWalkIn(o.id)}>
                  <Text style={[styles.segmentText, walkIn === o.id && { color: colors.white }]}>{o.label}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {!isWalkIn && client ? (
            <View style={styles.selectedClient}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(client.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.clientName}>{client.name}</Text>
                <Text style={styles.muted}>
                  {formatPhone(client.phone)} · {client.plan === 'premium' ? 'Premium' : 'Cadastro rápido'}
                </Text>
              </View>
              {!clientMode && (
                <Pressable onPress={() => setClientId(undefined)} hitSlop={8}>
                  <Text style={styles.link}>Trocar</Text>
                </Pressable>
              )}
            </View>
          ) : !isWalkIn ? (
            <>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar por nome ou WhatsApp"
                placeholderTextColor={colors.muted}
                style={styles.search}
                accessibilityLabel="Buscar cliente"
              />
              {matches.map((c) => (
                <Pressable key={c.id} style={styles.clientOption} onPress={() => setClientId(c.id)}>
                  <View style={styles.avatarSmall}>
                    <Text style={styles.avatarSmallText}>{initials(c.name)}</Text>
                  </View>
                  <Text style={[styles.clientName, { flex: 1, fontSize: 14 }]}>{c.name}</Text>
                  <Text style={styles.muted}>{formatPhone(c.phone)}</Text>
                </Pressable>
              ))}
              {matches.length === 0 && <Text style={styles.muted}>Nenhuma cliente encontrada.</Text>}
            </>
          ) : (
            <View style={{ marginTop: 12 }}>
              <Field label="Nome" value={name} onChangeText={setName} placeholder="Nome da cliente" autoCapitalize="words" maxLength={60} error={tried ? walkInErrors.name : null} />
              <Field
                label="WhatsApp"
                optional
                value={phone}
                onChangeText={(t) => setPhone(formatPhone(t))}
                placeholder="(11) 98765-4321"
                keyboardType="phone-pad"
                helper="Sem WhatsApp, o horário fica só na agenda (sem cadastro e sem mensagens para a cliente)."
                error={tried ? walkInErrors.phone : null}
              />
              {isValidPhone(phone) && (
                <CheckRow checked={saveAsClient} onToggle={() => setSaveAsClient(!saveAsClient)}>
                  A cliente autorizou salvar nome e WhatsApp (cadastro rápido) para os próximos agendamentos.
                </CheckRow>
              )}
            </View>
          )}
          {tried && !isWalkIn && errors.client && <Text style={styles.error}>{errors.client}</Text>}

          {client?.allergies?.length ? (
            <View style={styles.alert}>
              <Ionicons name="warning-outline" size={18} color="#B45309" />
              <Text style={styles.alertText}>Alergia: {client.allergies.join(', ')}</Text>
            </View>
          ) : null}
          {client?.plan === 'premium' && (client.preferredShape || client.favoriteColors?.length) ? (
            <Text style={styles.prefs}>
              Prefere {client.preferredShape ? `formato ${shapeById(client.preferredShape).name.toLowerCase()}` : ''}
              {client.preferredPeriods?.length ? ` · ${client.preferredPeriods.join(', ').toLowerCase()}` : ''}
            </Text>
          ) : null}

          {/* Serviço */}
          <SectionTitle>Serviço</SectionTitle>
          {custom && (
            <ServiceOption
              active={serviceId === CUSTOM}
              name={custom.serviceName}
              detail={`${custom.duration} min`}
              price={custom.price}
              onPress={() => chooseService(CUSTOM)}
              highlight
            />
          )}
          {services.map((s) => (
            <ServiceOption key={s.id} active={serviceId === s.id} name={s.name} detail={`${s.duration} min`} price={s.price} onPress={() => chooseService(s.id)} />
          ))}
          {tried && errors.service && <Text style={styles.error}>{errors.service}</Text>}

          <View style={{ marginTop: 12 }}>
            <Field
              label="Valor do serviço (R$)"
              value={price}
              onChangeText={(t) => setPrice(t.replace(/[^\d,.]/g, ''))}
              keyboardType="decimal-pad"
              error={tried ? errors.price : null}
            />
          </View>
          {birthdayDiscount > 0 && fullPrice > 0 && (
            <View style={styles.birthday}>
              <Ionicons name="gift-outline" size={18} color={colors.wine} />
              <Text style={styles.birthdayText}>
                Mês de aniversário: {birthdayDiscount}% de desconto aplicado. De {brl(fullPrice)} por {brl(priceValue)}.
              </Text>
            </View>
          )}
        </View>

        {available > 0 && (
          <View style={styles.gutter}>
            <Pressable
              style={[styles.cashback, useCashbackBalance && styles.cashbackOn]}
              onPress={() => setUseCashbackBalance((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: useCashbackBalance }}
              accessibilityLabel={`Usar cashback de ${brl(available)}`}
            >
              <Ionicons name={useCashbackBalance ? 'checkbox' : 'square-outline'} size={22} color={colors.wine} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cashbackTitle}>
                  {clientMode ? 'Usar meu cashback' : 'Usar o cashback da cliente'} ({brl(available)})
                </Text>
                <Text style={styles.cashbackText}>
                  {useCashbackBalance && priceValue > 0
                    ? `Desconta ${brl(cashbackUse)}: a pagar ${brl(roundCents(priceValue - cashbackUse))}.`
                    : 'O valor é descontado quando o atendimento for concluído.'}
                </Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* Data e horário */}
        <View style={styles.gutter}>
          <SectionTitle hint={formatLongDate(date)}>Data</SectionTitle>
        </View>
        <DateStrip
          selected={date}
          onSelect={(d) => {
            setDate(d);
            setTime(undefined);
          }}
          until={lastDate}
          showMonths
          workDays={settings.workDays}
        />

        <View style={styles.gutter}>
          <SectionTitle hint={serviceName ? `Duração: ${duration} min` : 'Escolha o serviço para ver os horários'}>Horário</SectionTitle>
          {slots.length === 0 ? (
            <Text style={styles.muted}>
              {settings.workDays.includes(new Date(date + 'T12:00').getDay()) ? 'Sem horários livres neste dia.' : 'Studio fechado neste dia.'}
            </Text>
          ) : (
            <View style={styles.slots}>
              {slots.map((s) => (
                <Pressable key={s} style={[styles.slot, time === s && styles.slotActive]} onPress={() => setTime(s)}>
                  <Text style={[styles.slotText, time === s && { color: colors.white }]}>{s}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {tried && errors.time && <Text style={styles.error}>{errors.time}</Text>}

          <View style={{ marginTop: 18 }}>
            <Field label="Observações" optional value={notes} onChangeText={setNotes} placeholder="Ex.: trazer o esmalte dela" multiline maxLength={200} />
          </View>

          {valid && time && (
            <Text style={styles.summary}>
              {serviceName} em {formatLongDate(date)}, das {time} às {endTime({ time, duration })} · {brl(priceValue)}
              {cashbackUse > 0 ? ` · cashback −${brl(cashbackUse)} · a pagar ${brl(roundCents(priceValue - cashbackUse))}` : ''}
            </Text>
          )}
          <Button label={editing ? 'Salvar novo horário' : 'Confirmar agendamento'} icon="checkmark" onPress={submit} style={{ marginTop: 10 }} />
        </View>

        <Modal visible={askCashback} transparent animationType="fade" onRequestClose={() => setAskCashback(false)}>
          <View style={styles.askOverlay}>
            <View style={styles.ask}>
              <View style={styles.askIcon}>
                <Ionicons name="wallet-outline" size={26} color={colors.wine} />
              </View>
              <Text style={styles.askTitle}>
                {clientMode ? `Você tem ${brl(available)} de cashback` : `${client?.name.split(' ')[0]} tem ${brl(available)} de cashback`}
              </Text>
              <Text style={styles.askText}>
                {clientMode ? 'Quer usar neste agendamento?' : 'Usar neste agendamento?'} Com o cashback, fica{' '}
                {brl(roundCents(priceValue - cashbackFor(true)))} em vez de {brl(priceValue)}.
              </Text>
              <Button label={`Usar ${brl(cashbackFor(true))} de cashback`} icon="checkmark-circle-outline" onPress={() => save(true)} />
              <Button label="Agora não, guardar o saldo" variant="secondary" onPress={() => save(false)} />
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ServiceOption({
  active,
  name,
  detail,
  price,
  onPress,
  highlight,
}: {
  active: boolean;
  name: string;
  detail: string;
  price: number;
  onPress: () => void;
  highlight?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.service, highlight && styles.serviceHighlight, active && styles.serviceActive]}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
    >
      <View style={[styles.radio, active && styles.radioOn]}>{active && <View style={styles.radioDot} />}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.serviceName}>{name}</Text>
        <Text style={styles.muted}>{detail}</Text>
      </View>
      <Text style={styles.servicePrice}>{brl(price)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  gutter: { paddingHorizontal: 20 },
  muted: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.wine },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.danger, marginTop: 6 },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginBottom: 12,
  },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.pill },
  segmentActive: { backgroundColor: colors.plum },
  segmentText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.plum },
  search: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 8,
  },
  clientOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  selectedClient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1.5,
    borderColor: colors.plum,
  },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.roseGoldLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.display, fontSize: 16, color: colors.plum },
  avatarSmall: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  avatarSmallText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.plum },
  clientName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: radius.sm,
    padding: 10,
    marginTop: 10,
  },
  alertText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: '#92400E' },
  prefs: { fontFamily: fonts.regular, fontSize: 12, color: colors.wine, marginTop: 8 },
  service: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
  },
  serviceHighlight: { borderColor: colors.roseGold },
  serviceActive: { borderColor: colors.plum, backgroundColor: colors.blush },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.plum },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.plum },
  serviceName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  servicePrice: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  birthday: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.blush,
    borderRadius: radius.sm,
    padding: 12,
  },
  cashback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.roseGoldLight,
    backgroundColor: colors.white,
  },
  cashbackOn: { borderColor: colors.wine, backgroundColor: colors.blush },
  askOverlay: { flex: 1, backgroundColor: 'rgba(43, 18, 32, 0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  ask: { width: '100%', maxWidth: 380, backgroundColor: colors.cream, borderRadius: radius.lg, padding: 22, gap: 10 },
  askIcon: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askTitle: { fontFamily: fonts.display, fontSize: 21, color: colors.ink, textAlign: 'center' },
  askText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center', marginBottom: 6 },
  cashbackTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  cashbackText: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 2 },
  birthdayText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.wine },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: {
    width: '22.5%',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  slotActive: { backgroundColor: colors.plum, borderColor: colors.plum },
  slotText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  summary: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.ink, marginTop: 8 },
});
