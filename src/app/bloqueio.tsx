import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, CheckRow, Field, OwnerOnly, ScreenHeader, SectionTitle } from '@/components/ui';
import { isActive, useAppointments } from '@/features/agenda/AppointmentsContext';
import { DateStrip } from '@/features/agenda/components';
import { keepRecent } from '@/features/agenda/DayGrid';
import { useSession } from '@/features/session/SessionContext';
import { blockedDates, useSettings } from '@/features/settings/SettingsContext';
import { colors, fonts } from '@/theme';
import { formatLongDate, today, toMinutes } from '@/utils/date';
import { newId } from '@/utils/id';

const isTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
const formatTime = (t: string) => {
  const d = t.replace(/\D/g, '').slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
};

export default function BloqueioScreen() {
  const { canManage } = useSession();
  return canManage ? <BloqueioContent /> : <OwnerOnly title="Bloquear horário" />;
}

function BloqueioContent() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ data?: string }>();
  const { settings, saveSettings } = useSettings();
  const { forDate } = useAppointments();
  const [date, setDate] = useState(params.data && params.data >= today() ? params.data : today());
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState(settings.openTime);
  const [end, setEnd] = useState(settings.closeTime);
  const [label, setLabel] = useState('');
  const [tried, setTried] = useState(false);

  const errors = {
    start: !allDay && !isTime(start) ? 'Use HH:MM.' : null,
    end: !allDay && (!isTime(end) || end <= start) ? 'Precisa ser depois do início.' : null,
  };
  const valid = !errors.start && !errors.end;

  // Horários já marcados no período continuam valendo: só avisamos.
  const s = allDay ? 0 : toMinutes(start);
  const e = allDay ? 24 * 60 : toMinutes(end);
  const clashes = forDate(date).filter((a) => isActive(a) && toMinutes(a.time) < e && toMinutes(a.time) + a.duration > s);

  function save() {
    setTried(true);
    if (!valid) return;
    saveSettings({
      ...settings,
      blocks: [...keepRecent(settings.blocks), { id: newId(), date, start: allDay ? settings.openTime : start, end: allDay ? settings.closeTime : end, allDay, label: label.trim() || undefined }],
    });
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.screen}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }}
      >
        <View style={styles.gutter}>
          <ScreenHeader title="Bloquear horário" subtitle="As clientes não conseguem marcar nesse período" />
          <SectionTitle>Dia</SectionTitle>
        </View>
        <DateStrip
          selected={date}
          onSelect={setDate}
          daysBefore={0}
          daysAfter={90}
          counts={{}}
          workDays={settings.workDays}
          blockedDays={blockedDates(settings)}
        />
        <View style={styles.gutter}>
          <Text style={styles.dateText}>{formatLongDate(date)}</Text>

          <CheckRow checked={allDay} onToggle={() => setAllDay(!allDay)}>
            Bloquear o dia inteiro (folga, feriado…)
          </CheckRow>

          {!allDay && (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Field label="Das" value={start} onChangeText={(t) => setStart(formatTime(t))} keyboardType="number-pad" error={tried ? errors.start : null} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Até" value={end} onChangeText={(t) => setEnd(formatTime(t))} keyboardType="number-pad" error={tried ? errors.end : null} />
              </View>
            </View>
          )}

          <Field label="Motivo" optional value={label} onChangeText={setLabel} placeholder="Ex.: Consulta médica" maxLength={40} helper="Só você vê." />

          {clashes.length > 0 && (
            <Text style={styles.warn}>
              Já {clashes.length === 1 ? 'existe 1 horário marcado' : `existem ${clashes.length} horários marcados`} nesse período. Eles continuam
              valendo; remarque ou cancele pela agenda, se precisar.
            </Text>
          )}

          <Button label="Bloquear" icon="lock-closed-outline" onPress={save} style={{ marginTop: 18 }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  gutter: { paddingHorizontal: 20 },
  dateText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, marginTop: 12, marginBottom: 6, textTransform: 'capitalize' },
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
  warn: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 18, color: '#B45309', marginTop: 12 },
});
