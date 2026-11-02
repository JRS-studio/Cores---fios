import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, shadow } from '@/theme';
import { addDays, fromISODate, MONTHS, monthKey, toMinutes, toTime, today, WEEKDAYS_SHORT, weekdayOf } from '@/utils/date';
import { brl } from '@/utils/format';
import { STATUS_LABEL, type Appointment, type AppointmentStatus } from './AppointmentsContext';

const DAY_WIDTH = 58;
const DAY_GAP = 8;

// Faixa horizontal de dias. `daysBefore` permite olhar o histórico; abre já posicionada no dia escolhido.
export function DateStrip({
  selected,
  onSelect,
  daysBefore = 0,
  daysAfter = 30,
  until,
  showMonths = false,
  counts = {},
  workDays,
  blockedDays = [],
}: {
  selected: string;
  onSelect: (date: string) => void;
  daysBefore?: number;
  daysAfter?: number;
  // Último dia mostrado (no lugar de daysAfter), ex.: o fim do mês seguinte para as clientes.
  until?: string;
  // Botões dos meses acima dos dias, para pular direto para um mês.
  showMonths?: boolean;
  counts?: Record<string, number>;
  workDays: number[];
  // Dias inteiros bloqueados pela profissional (folga avulsa, feriado…): aparecem fechados.
  blockedDays?: string[];
}) {
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const start = addDays(today(), -daysBefore);
  const count = until ? Math.max(0, Math.round((fromISODate(until).getTime() - fromISODate(start).getTime()) / 86400000)) + 1 : daysBefore + daysAfter + 1;
  const days = Array.from({ length: count }, (_, i) => addDays(start, i));
  const selectedIndex = Math.max(0, days.indexOf(selected));
  const months = [...new Set(days.map(monthKey))];
  const scrollTo = (index: number, animated: boolean) =>
    ref.current?.scrollTo({ x: Math.max(0, index - 1) * (DAY_WIDTH + DAY_GAP), animated });

  // Ao trocar de mês (ou de dia por fora), a faixa acompanha o dia escolhido.
  useEffect(() => {
    scrollTo(selectedIndex, true);
  }, [selectedIndex]);

  const strip = (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
      onLayout={() => scrollTo(selectedIndex, false)}
    >
      {days.map((d) => {
        const active = d === selected;
        const blocked = blockedDays.includes(d);
        const closed = !workDays.includes(weekdayOf(d)) || blocked;
        const date = fromISODate(d);
        return (
          <Pressable
            key={d}
            onPress={() => onSelect(d)}
            style={[styles.day, active && styles.dayActive, closed && !active && styles.dayClosed]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${WEEKDAYS_SHORT[date.getDay()]} ${date.getDate()}${blocked ? ', bloqueado' : closed ? ', fechado' : ''}`}
          >
            <Text style={[styles.dayName, active && styles.dayTextActive]}>{d === today() ? 'hoje' : WEEKDAYS_SHORT[date.getDay()]}</Text>
            <Text style={[styles.dayNumber, active && styles.dayTextActive]}>{date.getDate()}</Text>
            <View style={styles.dots}>
              {blocked ? (
                <Ionicons name="lock-closed" size={10} color={active ? colors.roseGoldLight : colors.muted} />
              ) : (
                Array.from({ length: Math.min(counts[d] ?? 0, 3) }, (_, i) => (
                  <View key={i} style={[styles.dot, active && { backgroundColor: colors.roseGoldLight }]} />
                ))
              )}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
  if (!showMonths || months.length < 2) return strip;

  const currentMonth = monthKey(selected);
  return (
    <View>
      <View style={monthStyles.months}>
        {months.map((m) => {
          const active = m === currentMonth;
          const name = MONTHS[Number(m.slice(5, 7)) - 1];
          return (
            <Pressable
              key={m}
              onPress={() => {
                // Primeiro dia daquele mês dentro da faixa, de preferência um dia de atendimento.
                const inMonth = days.filter((d) => monthKey(d) === m);
                onSelect(inMonth.find((d) => workDays.includes(weekdayOf(d))) ?? inMonth[0]);
              }}
              style={[monthStyles.month, active && monthStyles.monthActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Mês de ${name}`}
            >
              <Text style={[monthStyles.monthText, active && monthStyles.monthTextActive]}>{name[0].toUpperCase() + name.slice(1)}</Text>
            </Pressable>
          );
        })}
      </View>
      {strip}
    </View>
  );
}

const monthStyles = StyleSheet.create({
  months: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 10 },
  month: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  monthActive: { backgroundColor: colors.plum, borderColor: colors.plum },
  monthText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.plum },
  monthTextActive: { color: colors.white },
});

const STATUS_STYLE: Record<AppointmentStatus, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  agendado: { icon: 'time-outline', color: colors.plumSoft, bg: colors.blush },
  confirmado: { icon: 'checkmark-circle', color: colors.success, bg: '#E6F3EC' },
  concluido: { icon: 'checkmark-done', color: colors.plum, bg: colors.blush },
  cancelado: { icon: 'close-circle', color: colors.danger, bg: '#FBEAE4' },
  faltou: { icon: 'alert-circle', color: '#92400E', bg: '#FEF3C7' },
};

export function StatusChip({ status }: { status: AppointmentStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <View style={[styles.status, { backgroundColor: s.bg }]}>
      <Ionicons name={s.icon} size={12} color={s.color} />
      <Text style={[styles.statusText, { color: s.color }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

export const endTime = (a: Pick<Appointment, 'time' | 'duration'>) => toTime(toMinutes(a.time) + a.duration);

export function AppointmentCard({ appointment: a, onPress, alert }: { appointment: Appointment; onPress: () => void; alert?: boolean }) {
  const inactive = a.status === 'cancelado' || a.status === 'faltou';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, inactive && { opacity: 0.6 }, pressed && { opacity: 0.85 }]}>
      <View style={styles.timeCol}>
        <Text style={styles.time}>{a.time}</Text>
        <Text style={styles.timeEnd}>{endTime(a)}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <Text style={[styles.client, inactive && styles.strike]} numberOfLines={1}>
            {a.clientName}
          </Text>
          {alert && <Ionicons name="warning-outline" size={15} color="#B45309" accessibilityLabel="Cliente com alergia" />}
        </View>
        <Text style={styles.service} numberOfLines={1}>
          {a.serviceName}
        </Text>
        <View style={[styles.cardRow, { marginTop: 6 }]}>
          <StatusChip status={a.status} />
          <Text style={styles.price}>{brl(a.paidAmount ?? a.price)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: { gap: DAY_GAP, paddingHorizontal: 20, paddingVertical: 4 },
  day: {
    width: DAY_WIDTH,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayActive: { backgroundColor: colors.plum, borderColor: colors.plum },
  dayClosed: { opacity: 0.45 },
  dayName: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted, textTransform: 'lowercase' },
  dayNumber: { fontFamily: fonts.semibold, fontSize: 18, color: colors.ink, marginTop: 2 },
  dayTextActive: { color: colors.white },
  dots: { flexDirection: 'row', gap: 3, height: 6, marginTop: 4 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.wine },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  statusText: { fontFamily: fonts.semibold, fontSize: 11 },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: 10,
    ...shadow,
  },
  timeCol: {
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.plum,
    paddingVertical: 14,
  },
  time: { fontFamily: fonts.semibold, fontSize: 16, color: colors.roseGoldLight },
  timeEnd: { fontFamily: fonts.regular, fontSize: 11, color: 'rgba(232,205,181,0.7)', marginTop: 2 },
  cardBody: { flex: 1, padding: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  client: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, flexShrink: 1 },
  strike: { textDecorationLine: 'line-through' },
  service: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 1 },
  price: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
});
