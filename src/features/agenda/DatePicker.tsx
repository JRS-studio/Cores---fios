import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DateStrip } from '@/features/agenda/components';
import { MonthCalendar } from '@/features/agenda/MonthCalendar';
import { colors, fonts, radius } from '@/theme';
import { addDays, fromISODate, MONTHS, monthKey, today, weekdayOf } from '@/utils/date';

const monthName = (key: string) => {
  const name = MONTHS[Number(key.slice(5, 7)) - 1];
  return name[0].toUpperCase() + name.slice(1);
};

// Escolha do dia em "Semana" (faixa com os dias da semana atual) ou pelo nome do mês (calendário):
// ex.: Semana, Novembro, Dezembro. Usado na agenda e na tela de agendar.
export function DatePicker({
  selected,
  onSelect,
  months,
  workDays,
  counts = {},
  minDate,
  maxDate,
  lockOutside = false,
}: {
  selected: string;
  onSelect: (date: string) => void;
  // Meses com botão (AAAA-MM), na ordem.
  months: string[];
  workDays: number[];
  counts?: Record<string, number>;
  minDate?: string;
  maxDate?: string;
  // Ao agendar: dias que já passaram ou depois do limite não podem ser escolhidos.
  lockOutside?: boolean;
}) {
  const todayIso = today();
  const weekStart = addDays(todayIso, -weekdayOf(todayIso));
  const weekEnd = addDays(weekStart, 6);
  const stripStart = lockOutside && minDate && minDate > weekStart ? minDate : weekStart;
  const stripEnd = maxDate && maxDate < weekEnd ? maxDate : weekEnd;
  const inWeek = selected >= stripStart && selected <= stripEnd;
  const [period, setPeriod] = useState<string>(inWeek ? 'semana' : monthKey(selected));

  function choose(p: string) {
    setPeriod(p);
    if (p === 'semana') {
      if (!(selected >= stripStart && selected <= stripEnd)) onSelect(stripStart);
      return;
    }
    if (monthKey(selected) === p) return;
    // Primeiro dia de atendimento do mês que pode ser escolhido.
    const days = Array.from({ length: 31 }, (_, i) => addDays(`${p}-01`, i)).filter((d) => monthKey(d) === p);
    const allowed = days.filter((d) => !lockOutside || ((!minDate || d >= minDate) && (!maxDate || d <= maxDate)));
    onSelect(allowed.find((d) => workDays.includes(weekdayOf(d))) ?? allowed[0] ?? days[0]);
  }

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periods}>
        {['semana', ...months].map((id) => {
          const active = period === id;
          return (
            <Pressable
              key={id}
              style={[styles.period, active && styles.periodActive]}
              onPress={() => choose(id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.periodText, active && { color: colors.white }]}>{id === 'semana' ? 'Semana' : monthName(id)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {period === 'semana' ? (
        <DateStrip
          selected={selected}
          onSelect={onSelect}
          daysBefore={Math.round((fromISODate(todayIso).getTime() - fromISODate(stripStart).getTime()) / 86400000)}
          until={stripEnd}
          counts={counts}
          workDays={workDays}
        />
      ) : (
        <View style={styles.gutter}>
          <MonthCalendar
            month={period}
            selected={selected}
            onSelect={onSelect}
            counts={counts}
            workDays={workDays}
            minDate={minDate}
            maxDate={maxDate}
            lockOutside={lockOutside}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gutter: { paddingHorizontal: 20 },
  periods: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 14, flexGrow: 1 },
  period: {
    flexGrow: 1,
    minWidth: 96,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  periodActive: { backgroundColor: colors.plum, borderColor: colors.plum },
  periodText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.plum },
});
