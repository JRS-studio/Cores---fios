import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { isActive, type Appointment } from '@/features/agenda/AppointmentsContext';
import { AppointmentCard } from '@/features/agenda/components';
import { unavailableOn, useSettings, type Block } from '@/features/settings/SettingsContext';
import { colors, fonts, radius } from '@/theme';
import { addDays, today, toMinutes, toTime } from '@/utils/date';
import { newId } from '@/utils/id';

type Segment =
  | { type: 'appt'; start: number; end: number; appt: Appointment }
  | { type: 'pausa' | 'bloqueio'; start: number; end: number; label: string; id: string }
  | { type: 'livre'; start: number; end: number };

// Bloqueios de dias que já passaram não servem mais: saem ao salvar um novo.
export const keepRecent = (blocks: Block[]) => blocks.filter((b) => b.date >= addDays(today(), -1));

// O dia inteiro da profissional, do primeiro ao último horário: atendimentos, pausas, bloqueios e horários livres.
export function DayGrid({ date, appointments, allergyFor }: { date: string; appointments: Appointment[]; allergyFor: (a: Appointment) => boolean }) {
  const { settings, saveSettings } = useSettings();
  const step = settings.slotStep;
  const appts = appointments
    .filter(isActive)
    .map((a) => ({ start: toMinutes(a.time), end: toMinutes(a.time) + a.duration, appt: a }))
    .sort((x, y) => x.start - y.start);
  const off = unavailableOn(settings, date).sort((x, y) => x.start - y.start);
  const open = Math.min(toMinutes(settings.openTime), ...appts.map((a) => a.start));
  const close = Math.max(toMinutes(settings.closeTime), ...appts.map((a) => a.end));
  const now = new Date();
  const nowMin = date === today() ? now.getHours() * 60 + now.getMinutes() : date < today() ? 24 * 60 : -1;

  const segments: Segment[] = [];
  let t = open;
  while (t < close) {
    const a = appts.find((x) => x.start <= t && t < x.end);
    if (a) {
      segments.push({ type: 'appt', ...a });
      t = a.end;
      continue;
    }
    const u = off.find((x) => x.start <= t && t < x.end);
    if (u) {
      segments.push({ type: u.kind, start: t, end: u.end, label: u.label, id: u.id });
      t = u.end;
      continue;
    }
    // Livres seguem a grade de horários (ex.: depois de um atendimento que acaba 15:15, o próximo é 15:30).
    const grid = toMinutes(settings.openTime) + Math.floor((t - toMinutes(settings.openTime)) / step + 1) * step;
    const next = Math.min(grid, close, ...[...appts, ...off].filter((x) => x.start > t).map((x) => x.start));
    segments.push({ type: 'livre', start: t, end: next });
    t = next;
  }

  const block = (start: number, end: number) =>
    saveSettings({ ...settings, blocks: [...keepRecent(settings.blocks), { id: newId(), date, start: toTime(start), end: toTime(end) }] });
  const unblock = (id: string) => saveSettings({ ...settings, blocks: settings.blocks.filter((b) => b.id !== id) });

  return (
    <View style={{ gap: 8 }}>
      {segments.map((s) => {
        const range = `${toTime(s.start)} – ${toTime(s.end)}`;
        if (s.type === 'appt') {
          return (
            <AppointmentCard
              key={s.appt.id}
              appointment={s.appt}
              alert={allergyFor(s.appt)}
              onPress={() => router.push({ pathname: '/agendamento/[id]', params: { id: s.appt.id } })}
            />
          );
        }
        if (s.type === 'pausa' || s.type === 'bloqueio') {
          const pause = s.type === 'pausa';
          return (
            <View key={`${s.id}-${s.start}`} style={[styles.row, pause ? styles.pause : styles.blocked]}>
              <Ionicons name={pause ? 'cafe-outline' : 'lock-closed'} size={16} color={pause ? colors.muted : colors.wine} />
              <View style={{ flex: 1 }}>
                <Text style={styles.time}>{range}</Text>
                <Text style={styles.label}>{pause ? `${s.label} (pausa fixa)` : s.label}</Text>
              </View>
              {pause ? (
                <Pressable onPress={() => router.push('/ajustes/horarios')} hitSlop={6}>
                  <Text style={styles.link}>Editar</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => unblock(s.id)} hitSlop={6} accessibilityLabel={`Desbloquear ${range}`}>
                  <Text style={styles.link}>Desbloquear</Text>
                </Pressable>
              )}
            </View>
          );
        }
        const past = s.start <= nowMin;
        return (
          <View key={`livre-${s.start}`} style={[styles.row, styles.free, past && { opacity: 0.45 }]}>
            <Text style={styles.freeTime}>{toTime(s.start)}</Text>
            <Text style={styles.freeLabel}>Livre</Text>
            {!past && (
              <View style={styles.freeActions}>
                <Pressable
                  onPress={() => block(s.start, s.end)}
                  style={styles.smallButton}
                  accessibilityLabel={`Bloquear ${toTime(s.start)}`}
                >
                  <Ionicons name="lock-closed-outline" size={14} color={colors.plum} />
                  <Text style={styles.smallText}>Bloquear</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push({ pathname: '/agendamento/novo', params: { data: date, hora: toTime(s.start) } })}
                  style={[styles.smallButton, styles.smallPrimary]}
                  accessibilityLabel={`Agendar às ${toTime(s.start)}`}
                >
                  <Ionicons name="add" size={14} color={colors.white} />
                  <Text style={[styles.smallText, { color: colors.white }]}>Agendar</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 10 },
  pause: { backgroundColor: '#F1ECEA' },
  blocked: { backgroundColor: colors.blush, borderWidth: 1, borderColor: colors.roseGold, borderStyle: 'dashed' },
  time: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  label: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  link: { fontFamily: fonts.semibold, fontSize: 12, color: colors.wine },
  free: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  freeTime: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink, width: 44 },
  freeLabel: { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.success },
  freeActions: { flexDirection: 'row', gap: 6 },
  smallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  smallPrimary: { backgroundColor: colors.plum, borderColor: colors.plum },
  smallText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.plum },
});
