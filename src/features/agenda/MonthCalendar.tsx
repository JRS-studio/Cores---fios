import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/theme';
import { daysInMonth, MONTHS, today, WEEKDAYS_SHORT, weekdayOf } from '@/utils/date';

// Calendário de um mês (AAAA-MM): um quadradinho por dia, com pontinhos nos dias com horários marcados.
export function MonthCalendar({
  month,
  selected,
  onSelect,
  counts = {},
  workDays,
  blockedDays = [],
  minDate,
  maxDate,
  lockOutside = false,
}: {
  month: string;
  selected: string;
  onSelect: (date: string) => void;
  counts?: Record<string, number>;
  workDays: number[];
  // Dias inteiros bloqueados pela profissional (folga avulsa, feriado…): aparecem fechados.
  blockedDays?: string[];
  // Dias antes desta data aparecem apagados (já passaram).
  minDate?: string;
  // Até este dia (depois dele, apagado).
  maxDate?: string;
  // Dias fora de minDate/maxDate não podem ser escolhidos (ao agendar).
  lockOutside?: boolean;
}) {
  const total = daysInMonth(month);
  const days = Array.from({ length: total }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
  const lead = weekdayOf(days[0]);
  const cells: (string | null)[] = [...Array(lead).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const name = MONTHS[Number(month.slice(5, 7)) - 1];
  const todayIso = today();

  return (
    <View style={styles.box} accessibilityLabel={`Calendário de ${name}`}>
      <View style={styles.row}>
        {WEEKDAYS_SHORT.map((d) => (
          <Text key={d} style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, w) => (
        <View key={w} style={styles.row}>
          {cells.slice(w * 7, w * 7 + 7).map((d, i) => {
            if (!d) return <View key={`v${i}`} style={styles.cell} />;
            const active = d === selected;
            const past = (!!minDate && d < minDate) || (!!maxDate && d > maxDate);
            const locked = lockOutside && past;
            const blocked = blockedDays.includes(d);
            const closed = !workDays.includes(weekdayOf(d)) || blocked;
            const n = counts[d] ?? 0;
            return (
              <Pressable
                key={d}
                onPress={() => onSelect(d)}
                disabled={locked}
                style={[styles.cell, styles.day, active && styles.dayActive, (past || closed) && !active && styles.dayMuted]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${Number(d.slice(8))} de ${name}${n ? `, ${n} ${n === 1 ? 'horário' : 'horários'}` : ''}${
                  blocked ? ', bloqueado' : closed ? ', fechado' : ''
                }`}
              >
                <Text style={[styles.number, d === todayIso && styles.today, active && styles.textActive]}>{Number(d.slice(8))}</Text>
                <View style={styles.dots}>
                  {blocked ? (
                    <Ionicons name="lock-closed" size={9} color={active ? colors.roseGoldLight : colors.muted} />
                  ) : (
                    Array.from({ length: Math.min(n, 3) }, (_, k) => (
                      <View key={k} style={[styles.dot, active && { backgroundColor: colors.roseGoldLight }]} />
                    ))
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 8 },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 11, color: colors.muted, paddingVertical: 6 },
  cell: { flex: 1, aspectRatio: 1, margin: 2 },
  day: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  dayActive: { backgroundColor: colors.plum },
  dayMuted: { opacity: 0.4 },
  number: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  today: { color: colors.wine, textDecorationLine: 'underline' },
  textActive: { color: colors.white, textDecorationLine: 'none' },
  dots: { flexDirection: 'row', gap: 2, height: 5, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.wine },
});
