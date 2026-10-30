import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { isActive, useAppointments } from '@/features/agenda/AppointmentsContext';
import { AppointmentCard, DateStrip } from '@/features/agenda/components';
import { useClients } from '@/features/clients/ClientsContext';
import { useSettings } from '@/features/settings/SettingsContext';
import { colors, fonts, radius } from '@/theme';
import { formatLongDate, today, weekdayOf } from '@/utils/date';
import { brl } from '@/utils/format';

export default function AgendaScreen() {
  const insets = useSafeAreaInsets();
  const { appointments, forDate } = useAppointments();
  const { getClient } = useClients();
  const { settings } = useSettings();
  const [date, setDate] = useState(today());

  const counts: Record<string, number> = {};
  appointments.filter(isActive).forEach((a) => (counts[a.date] = (counts[a.date] ?? 0) + 1));
  const dayItems = forDate(date);
  const active = dayItems.filter(isActive);
  const expected = active.reduce((sum, a) => sum + a.price, 0);
  const closed = !settings.workDays.includes(weekdayOf(date));
  const longDate = date === today() ? `hoje, ${formatLongDate(date).split(', ')[1]}` : formatLongDate(date);
  const dayTitle = longDate[0].toUpperCase() + longDate.slice(1);

  const newBooking = () => router.push({ pathname: '/agendamento/novo', params: { data: date } });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 130 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, styles.gutter]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Agenda</Text>
          <Text style={styles.subtitle}>
            {settings.openTime} às {settings.closeTime}
          </Text>
        </View>
        <Pressable style={styles.addButton} onPress={() => newBooking()} accessibilityLabel="Novo agendamento">
          <Ionicons name="add" size={20} color={colors.white} />
          <Text style={styles.addText}>Agendar</Text>
        </Pressable>
      </View>

      <DateStrip selected={date} onSelect={setDate} daysBefore={14} daysAfter={45} counts={counts} workDays={settings.workDays} />

      <View style={[styles.gutter, { marginTop: 18 }]}>
        <Text style={styles.dayTitle}>{dayTitle}</Text>
        <Text style={styles.daySummary}>
          {closed
            ? 'Studio fechado neste dia'
            : active.length
              ? `${active.length} ${active.length === 1 ? 'atendimento' : 'atendimentos'} · ${brl(expected)} previstos`
              : 'Nenhum horário marcado'}
        </Text>

        <View style={{ marginTop: 14 }}>
          {dayItems.map((a) => (
            <AppointmentCard
              key={a.id}
              appointment={a}
              alert={!!(a.clientId && getClient(a.clientId)?.allergies?.length)}
              onPress={() => router.push({ pathname: '/agendamento/[id]', params: { id: a.id } })}
            />
          ))}
        </View>

        {dayItems.length === 0 && !closed && (
          <View style={styles.empty}>
            <Ionicons name="calendar-clear-outline" size={28} color={colors.wine} />
            <Text style={styles.emptyText}>Dia livre. Que tal encaixar uma cliente?</Text>
            <Button label="Agendar neste dia" icon="add" onPress={() => newBooking()} style={{ alignSelf: 'stretch' }} />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  gutter: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.plum,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.white },
  dayTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  daySummary: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  emptyText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
});
