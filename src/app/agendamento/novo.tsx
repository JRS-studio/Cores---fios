import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, CheckRow, Field, ScreenHeader, SectionTitle } from '@/components/ui';
import { shapeById } from '@/data/catalog';
import { LOYALTY } from '@/data/loyalty';
import { serviceById, services, tryOnDuration } from '@/data/services';
import { useAppointments, type Appointment } from '@/features/agenda/AppointmentsContext';
import { DateStrip, endTime } from '@/features/agenda/components';
import { useClients } from '@/features/clients/ClientsContext';
import { useSettings } from '@/features/settings/SettingsContext';
import { colors, fonts, radius } from '@/theme';
import { newId } from '@/utils/id';
import { formatLongDate, today } from '@/utils/date';
import { brl, formatPhone, initials, isValidPhone, onlyDigits, parseDate } from '@/utils/format';

const TRY_ON = 'provador';

export default function NovoAgendamentoScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ data?: string; servico?: string; valor?: string; id?: string; cliente?: string }>();
  const { getAppointment, saveAppointment, availableSlots } = useAppointments();
  const { clients, getClient, findByPhone, saveClient } = useClients();
  const { settings } = useSettings();
  const editing = params.id ? getAppointment(params.id) : undefined;

  const [clientId, setClientId] = useState<string | undefined>(editing?.clientId ?? params.cliente);
  const [walkIn, setWalkIn] = useState(editing ? !editing.clientId : clients.length === 0);
  const [query, setQuery] = useState('');
  const [name, setName] = useState(editing && !editing.clientId ? editing.clientName : '');
  const [phone, setPhone] = useState(editing && !editing.clientId ? formatPhone(editing.clientPhone) : '');
  const [saveAsClient, setSaveAsClient] = useState(true);
  const tryOnName = params.servico;
  const [serviceId, setServiceId] = useState<string | undefined>(editing ? (editing.serviceId ?? TRY_ON) : tryOnName ? TRY_ON : undefined);
  const [price, setPrice] = useState(editing ? String(editing.price) : params.valor ?? '');
  const [date, setDate] = useState(editing?.date ?? (params.data && params.data >= today() ? params.data : today()));
  const [time, setTime] = useState<string | undefined>(editing?.time);
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [tried, setTried] = useState(false);

  const client = clientId ? getClient(clientId) : undefined;
  const service = serviceById(serviceId);
  const serviceName = serviceId === TRY_ON ? (editing?.serviceId ? '' : editing?.serviceName ?? tryOnName ?? '') : service?.name ?? '';
  const duration = serviceId === TRY_ON ? (editing && !editing.serviceId ? editing.duration : tryOnDuration(serviceName)) : service?.duration ?? 60;
  const slots = availableSlots(date, duration, settings, editing?.id);
  const birthday = client?.plan === 'premium' && client.birthDate ? parseDate(client.birthDate) : null;
  const birthdayMonth = !!birthday && birthday.getMonth() === new Date(date + 'T12:00').getMonth();

  const q = query.trim().toLowerCase();
  const matches = clients
    .filter((c) => !q || c.name.toLowerCase().includes(q) || (onlyDigits(q) && c.phone.includes(onlyDigits(q))))
    .slice(0, 5);

  const walkInErrors = {
    name: name.trim().length < 2 ? 'Digite o nome da cliente.' : null,
    phone: !isValidPhone(phone) ? 'Digite um WhatsApp válido com DDD.' : null,
  };
  const errors = {
    client: walkIn ? (walkInErrors.name ?? walkInErrors.phone) : !client ? 'Escolha a cliente.' : null,
    service: !serviceName ? 'Escolha o serviço.' : null,
    price: !(Number(price.replace(',', '.')) >= 0) || price.trim() === '' ? 'Informe o valor.' : null,
    time: !time || !slots.includes(time) ? 'Escolha um horário livre.' : null,
  };
  const valid = Object.values(errors).every((e) => !e);

  function chooseService(id: string) {
    setServiceId(id);
    const s = serviceById(id);
    setPrice(id === TRY_ON ? (params.valor ?? price) : s ? String(s.price) : '');
    setTime(undefined);
  }

  function submit() {
    setTried(true);
    if (!valid || !time) return;
    let finalClientId = walkIn ? undefined : clientId;
    let clientName = client?.name ?? name.trim();
    let clientPhone = client?.phone ?? onlyDigits(phone);
    if (walkIn) {
      // Se o WhatsApp já é de uma cliente cadastrada, liga o agendamento a ela.
      const existing = findByPhone(onlyDigits(phone));
      if (existing) {
        finalClientId = existing.id;
        clientName = existing.name;
        clientPhone = existing.phone;
      } else if (saveAsClient) {
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
      serviceId: serviceId === TRY_ON ? undefined : serviceId,
      serviceName,
      price: Number(price.replace(',', '.')),
      duration,
      date,
      time,
      // Remarcar devolve o horário para "agendado".
      status: editing && editing.status !== 'confirmado' ? 'agendado' : (editing?.status ?? 'agendado'),
      notes: notes.trim() || undefined,
    };
    saveAppointment(appointment);
    router.dismissTo({ pathname: '/agendamento/[id]', params: { id: appointment.id, novo: editing ? 'remarcado' : 'criado' } });
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
          {clients.length > 0 && (
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

          {!walkIn && client ? (
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
              <Pressable onPress={() => setClientId(undefined)} hitSlop={8}>
                <Text style={styles.link}>Trocar</Text>
              </Pressable>
            </View>
          ) : !walkIn ? (
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
              <Field label="WhatsApp" value={phone} onChangeText={(t) => setPhone(formatPhone(t))} placeholder="(11) 98765-4321" keyboardType="phone-pad" error={tried ? walkInErrors.phone : null} />
              <CheckRow checked={saveAsClient} onToggle={() => setSaveAsClient(!saveAsClient)}>
                A cliente autorizou salvar nome e WhatsApp (cadastro rápido) para os próximos agendamentos.
              </CheckRow>
            </View>
          )}
          {tried && !walkIn && errors.client && <Text style={styles.error}>{errors.client}</Text>}

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
          {(tryOnName || (editing && !editing.serviceId)) && (
            <ServiceOption
              active={serviceId === TRY_ON}
              name={tryOnName ?? editing?.serviceName ?? ''}
              detail={`Do provador · ${tryOnDuration(tryOnName ?? editing?.serviceName ?? '')} min`}
              price={Number(params.valor ?? editing?.price ?? 0)}
              onPress={() => chooseService(TRY_ON)}
              highlight
            />
          )}
          {services.map((s) => (
            <ServiceOption key={s.id} active={serviceId === s.id} name={s.name} detail={`${s.duration} min`} price={s.price} onPress={() => chooseService(s.id)} />
          ))}
          {tried && errors.service && <Text style={styles.error}>{errors.service}</Text>}

          <View style={{ marginTop: 12 }}>
            <Field
              label="Valor cobrado (R$)"
              value={price}
              onChangeText={(t) => setPrice(t.replace(/[^\d,.]/g, ''))}
              keyboardType="decimal-pad"
              error={tried ? errors.price : null}
            />
          </View>
          {birthdayMonth && service && (
            <Pressable
              style={styles.birthday}
              onPress={() => setPrice(String(Math.round(service.price * (1 - LOYALTY.birthdayDiscount / 100))))}
            >
              <Ionicons name="gift-outline" size={18} color={colors.wine} />
              <Text style={styles.birthdayText}>Mês de aniversário: aplicar {LOYALTY.birthdayDiscount}% de desconto</Text>
            </Pressable>
          )}
        </View>

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
          daysAfter={60}
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
              {serviceName} em {formatLongDate(date)}, das {time} às {endTime({ time, duration })} · {brl(Number(price.replace(',', '.')))}
            </Text>
          )}
          <Button label={editing ? 'Salvar novo horário' : 'Confirmar agendamento'} icon="checkmark" onPress={submit} style={{ marginTop: 10 }} />
        </View>
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
  serviceActive: { borderColor: colors.plum, backgroundColor: '#FBF5F7' },
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
