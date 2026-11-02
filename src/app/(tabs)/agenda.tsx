import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { isActive, useAppointments } from '@/features/agenda/AppointmentsContext';
import { AppointmentCard } from '@/features/agenda/components';
import { DayGrid } from '@/features/agenda/DayGrid';
import { DatePicker } from '@/features/agenda/DatePicker';
import { useSession } from '@/features/session/SessionContext';
import { useClients } from '@/features/clients/ClientsContext';
import { blockedDates, isDayBlocked, useSettings } from '@/features/settings/SettingsContext';
import { colors, fonts, radius } from '@/theme';
import { formatDayMonth, formatLongDate, MONTHS, monthKey, shiftMonth, today, weekdayOf } from '@/utils/date';
import { brl } from '@/utils/format';

export default function AgendaScreen() {
  const insets = useSafeAreaInsets();
  const { appointments, forDate } = useAppointments();
  const { getClient } = useClients();
  const { settings, saveSettings } = useSettings();
  const { canManage } = useSession();
  const [date, setDate] = useState(today());
  const [view, setView] = useState<'grade' | 'lista'>('grade');
  // Agenda organizada em Semana e nos meses pelo nome (ex.: Semana, Novembro, Dezembro).
  const todayIso = today();
  const thisMonth = monthKey(todayIso);
  const nextMonth = shiftMonth(thisMonth, 1);
  const nextName = MONTHS[Number(nextMonth.slice(5, 7)) - 1].replace(/^./, (c) => c.toUpperCase());
  const nextReleased = (settings.releasedMonths ?? []).includes(nextMonth);
  // Libera (ou fecha de novo) o mês seguinte inteiro; meses que já passaram saem da lista.
  const setRelease = (open: boolean) => {
    const kept = (settings.releasedMonths ?? []).filter((m) => m > thisMonth && m !== nextMonth);
    saveSettings({ ...settings, releasedMonths: open ? [...kept, nextMonth] : kept });
  };
  // Pedidos das clientes que ainda esperam a confirmação da profissional.
  const toConfirm = appointments
    .filter((a) => a.status === 'agendado' && a.date >= today())
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const dayBlocked = isDayBlocked(settings, date);

  const counts: Record<string, number> = {};
  appointments.filter(isActive).forEach((a) => (counts[a.date] = (counts[a.date] ?? 0) + 1));
  const dayItems = forDate(date);
  const active = dayItems.filter(isActive);
  const expected = active.reduce((sum, a) => sum + a.price, 0);
  const closed = !settings.workDays.includes(weekdayOf(date)) || dayBlocked;
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
        {canManage && (
          <Pressable
            style={[styles.addButton, styles.blockButton]}
            onPress={() => router.push({ pathname: '/bloqueio', params: { data: date } })}
            accessibilityLabel="Bloquear horário"
          >
            <Ionicons name="lock-closed-outline" size={16} color={colors.plum} />
            <Text style={[styles.addText, { color: colors.plum }]}>Bloquear</Text>
          </Pressable>
        )}
        <Pressable style={styles.addButton} onPress={() => newBooking()} accessibilityLabel="Novo agendamento">
          <Ionicons name="add" size={20} color={colors.white} />
          <Text style={styles.addText}>Agendar</Text>
        </Pressable>
      </View>

      {canManage && toConfirm.length > 0 && (
        <View style={[styles.gutter, { marginBottom: 14 }]}>
          <View style={styles.pendingBox}>
            <View style={styles.pendingHead}>
              <Ionicons name="hourglass-outline" size={18} color="#B45309" />
              <Text style={styles.pendingTitle}>
                {toConfirm.length} {toConfirm.length === 1 ? 'pedido aguardando' : 'pedidos aguardando'} sua confirmação
              </Text>
            </View>
            {toConfirm.slice(0, 5).map((a) => (
              <Pressable
                key={a.id}
                style={styles.pendingRow}
                onPress={() => router.push({ pathname: '/agendamento/[id]', params: { id: a.id } })}
              >
                <Text style={styles.pendingText} numberOfLines={1}>
                  {a.date === today() ? 'Hoje' : formatDayMonth(a.date)} {a.time} · {a.clientName.split(' ')[0]} · {a.serviceName}
                </Text>
                <Text style={styles.pendingLink}>Ver ›</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <DatePicker
        selected={date}
        onSelect={setDate}
        months={[thisMonth, nextMonth]}
        workDays={settings.workDays}
        counts={counts}
        blockedDays={blockedDates(settings)}
        minDate={todayIso}
        lockedMonths={canManage && !nextReleased ? [nextMonth] : []}
      />

      {/* O mês seguinte só abre para as clientes quando a profissional libera (o mês inteiro, num botão). */}
      {canManage && monthKey(date) === nextMonth && (
        <View style={[styles.gutter, { marginTop: 14 }]}>
          {nextReleased ? (
            <View style={styles.released}>
              <Ionicons name="lock-open-outline" size={18} color={colors.success} />
              <Text style={styles.releasedText}>{nextName} liberado para as clientes agendarem.</Text>
              <Pressable onPress={() => setRelease(false)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Fechar ${nextName}`}>
                <Text style={styles.releasedLink}>Fechar</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.closedMonth}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Ionicons name="lock-closed-outline" size={18} color="#92400E" />
                <Text style={styles.closedMonthText}>
                  {nextName} está fechado para as clientes: elas veem o mês, mas sem horários. Você pode agendar normalmente.
                </Text>
              </View>
              <Button label={`Liberar ${nextName.toLowerCase()}`} icon="lock-open-outline" onPress={() => setRelease(true)} />
            </View>
          )}
        </View>
      )}

      <View style={[styles.gutter, { marginTop: 18 }]}>
        <Text style={styles.dayTitle}>{dayTitle}</Text>
        <Text style={styles.daySummary}>
          {dayBlocked
            ? 'Dia bloqueado'
            : closed
            ? 'Studio fechado neste dia'
            : active.length
              ? `${active.length} ${active.length === 1 ? 'atendimento' : 'atendimentos'} · ${brl(expected)} previstos`
              : 'Nenhum horário marcado'}
        </Text>

        {canManage && !closed && (
          <View style={styles.toggle}>
            {(
              [
                ['grade', 'Dia completo'],
                ['lista', 'Só horários marcados'],
              ] as const
            ).map(([id, label]) => (
              <Pressable
                key={id}
                style={[styles.toggleItem, view === id && styles.toggleActive]}
                onPress={() => setView(id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: view === id }}
              >
                <Text style={[styles.toggleText, view === id && { color: colors.white }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {dayBlocked && canManage && (
          <Button
            label="Desbloquear o dia"
            icon="lock-open-outline"
            variant="secondary"
            onPress={() => saveSettings({ ...settings, blocks: settings.blocks.filter((b) => !(b.date === date && b.allDay)) })}
            style={{ marginTop: 14 }}
          />
        )}

        {canManage && !closed && view === 'grade' ? (
          <View style={{ marginTop: 14 }}>
            <DayGrid date={date} appointments={dayItems} allergyFor={(a) => !!(a.clientId && getClient(a.clientId)?.allergies?.length)} />
            {dayItems.filter((a) => !isActive(a)).length > 0 && (
              <Text style={styles.cancelledNote}>Cancelados e faltas deste dia aparecem em “Só horários marcados”.</Text>
            )}
          </View>
        ) : (
          <>
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
          </>
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
  blockButton: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, marginRight: 8 },
  pendingBox: { backgroundColor: '#FEF3E2', borderRadius: radius.md, padding: 14, gap: 6 },
  pendingHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pendingTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: '#92400E' },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  pendingText: { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: '#92400E' },
  pendingLink: { fontFamily: fonts.semibold, fontSize: 12, color: '#92400E' },
  closedMonth: { gap: 12, backgroundColor: '#FEF3E2', borderRadius: radius.md, padding: 14 },
  closedMonthText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: '#92400E' },
  released: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#E6F3EC', borderRadius: radius.md, padding: 12 },
  releasedText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.success },
  releasedLink: { fontFamily: fonts.semibold, fontSize: 13, color: colors.wine },
  toggle: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, padding: 4, marginTop: 14 },
  toggleItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.pill },
  toggleActive: { backgroundColor: colors.plum },
  toggleText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.plum },
  cancelledNote: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 10, textAlign: 'center' },
  dayTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  daySummary: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  emptyText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
});
