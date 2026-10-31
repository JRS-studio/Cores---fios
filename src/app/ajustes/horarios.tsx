import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, OwnerOnly, ScreenHeader, SectionTitle } from '@/components/ui';
import { useSession } from '@/features/session/SessionContext';
import { useSettings } from '@/features/settings/SettingsContext';
import { colors, fonts, radius } from '@/theme';
import { WEEKDAYS, WEEKDAYS_SHORT, toMinutes, toTime } from '@/utils/date';

export default function HorariosScreen() {
  const { canManage } = useSession();
  return canManage ? <HorariosContent /> : <OwnerOnly title="Horários" />;
}

function HorariosContent() {
  const insets = useSafeAreaInsets();
  const { settings, saveSettings } = useSettings();
  const [slots, setSlots] = useState<Record<string, string[]>>(settings.clientSlots);
  const [day, setDay] = useState(String(settings.workDays[0] ?? 1));
  const [saved, setSaved] = useState(false);

  // Todos os inícios possíveis no horário de funcionamento.
  const all: string[] = [];
  for (let m = toMinutes(settings.openTime); m < toMinutes(settings.closeTime); m += settings.slotStep) all.push(toTime(m));

  const custom = slots[day];
  const isOn = (t: string) => !custom || custom.includes(t);

  function change(next: string[] | null) {
    setSlots((prev) => {
      const copy = { ...prev };
      if (next === null) delete copy[day];
      else copy[day] = next;
      return copy;
    });
    setSaved(false);
  }

  function toggle(t: string) {
    const current = custom ?? all;
    const next = current.includes(t) ? current.filter((x) => x !== t) : [...current, t].sort();
    change(next.length === all.length && all.every((x) => next.includes(x)) ? null : next);
  }

  function save() {
    saveSettings({ ...settings, clientSlots: slots });
    setSaved(true);
  }

  const released = all.filter(isOn).length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
    >
      <ScreenHeader title="Horários liberados" subtitle="O que as clientes podem escolher ao agendar" />
      <Text style={styles.hint}>
        Toque nos horários para liberar ou bloquear. As clientes só veem os liberados que estiverem livres na agenda e couberem no serviço. Você
        continua podendo agendar em qualquer horário. Abertura, fechamento e dias de atendimento ficam em Ajustes.
      </Text>

      <SectionTitle>Dia da semana</SectionTitle>
      <View style={styles.days}>
        {WEEKDAYS_SHORT.map((label, i) => {
          const id = String(i);
          const open = settings.workDays.includes(i);
          return (
            <Pressable
              key={id}
              disabled={!open}
              onPress={() => setDay(id)}
              style={[styles.day, day === id && styles.dayActive, !open && styles.dayClosed]}
              accessibilityRole="tab"
              accessibilityState={{ selected: day === id, disabled: !open }}
              accessibilityLabel={WEEKDAYS[i]}
            >
              <Text style={[styles.dayText, day === id && { color: colors.white }]}>{label}</Text>
              {open && slots[id] && <View style={[styles.dot, day === id && { backgroundColor: colors.roseGoldLight }]} />}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {WEEKDAYS[Number(day)][0].toUpperCase() + WEEKDAYS[Number(day)].slice(1)}: {custom ? `${released} de ${all.length} horários liberados` : 'todos os horários liberados'}
        </Text>
        <View style={styles.quick}>
          <Pressable onPress={() => change(null)} hitSlop={6}>
            <Text style={styles.quickText}>Liberar todos</Text>
          </Pressable>
          <Pressable onPress={() => change([])} hitSlop={6}>
            <Text style={styles.quickText}>Bloquear todos</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.grid}>
        {all.map((t) => {
          const on = isOn(t);
          return (
            <Pressable
              key={t}
              onPress={() => toggle(t)}
              style={[styles.slot, on ? styles.slotOn : styles.slotOff]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${t} ${on ? 'liberado' : 'bloqueado'}`}
            >
              <Text style={[styles.slotText, on ? { color: colors.white } : styles.slotTextOff]}>{t}</Text>
            </Pressable>
          );
        })}
      </View>

      <Button label={saved ? 'Horários salvos' : 'Salvar horários'} icon={saved ? 'checkmark-circle' : 'checkmark'} onPress={save} style={{ marginTop: 22 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  hint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.muted },
  days: { flexDirection: 'row', gap: 6 },
  day: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 3,
  },
  dayActive: { backgroundColor: colors.plum, borderColor: colors.plum },
  dayClosed: { opacity: 0.35 },
  dayText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.wine },
  summary: { marginTop: 18, marginBottom: 10, gap: 6 },
  summaryText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  quick: { flexDirection: 'row', gap: 18 },
  quickText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.wine },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { width: '22.5%', alignItems: 'center', paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1 },
  slotOn: { backgroundColor: colors.wine, borderColor: colors.wine },
  slotOff: { backgroundColor: colors.white, borderColor: colors.border },
  slotText: { fontFamily: fonts.semibold, fontSize: 13 },
  slotTextOff: { color: colors.muted, textDecorationLine: 'line-through' },
});
