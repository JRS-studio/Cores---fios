import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chips, Field, OwnerOnly, ScreenHeader, SectionTitle } from '@/components/ui';
import { useSession } from '@/features/session/SessionContext';
import { useSettings, type BreakRule } from '@/features/settings/SettingsContext';
import { colors, fonts, radius } from '@/theme';
import { WEEKDAYS, WEEKDAYS_SHORT, toMinutes, toTime } from '@/utils/date';
import { newId } from '@/utils/id';

const isTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
const formatTime = (t: string) => {
  const d = t.replace(/\D/g, '').slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
};

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
  const [breaks, setBreaks] = useState<BreakRule[]>(settings.breaks);
  const [tried, setTried] = useState(false);
  const breakError = (b: BreakRule) =>
    !isTime(b.start) || !isTime(b.end) || b.end <= b.start ? 'Use HH:MM, com o fim depois do início.' : b.days.length === 0 ? 'Escolha ao menos um dia.' : null;
  const updateBreak = (id: string, patch: Partial<BreakRule>) => {
    setBreaks((list) => list.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    setSaved(false);
  };
  // Horário que cai numa pausa fixa do dia escolhido.
  const inBreak = (t: string) =>
    breaks.some((b) => !breakError(b) && b.days.includes(Number(day)) && toMinutes(t) >= toMinutes(b.start) && toMinutes(t) < toMinutes(b.end));

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
    setTried(true);
    if (breaks.some(breakError)) return;
    saveSettings({ ...settings, clientSlots: slots, breaks: breaks.map((b) => ({ ...b, label: b.label.trim() || 'Pausa' })) });
    setSaved(true);
  }

  const released = all.filter(isOn).length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
    >
      <ScreenHeader title="Horários e pausas" subtitle="O que as clientes podem escolher ao agendar" />
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
          if (inBreak(t)) {
            return (
              <View key={t} style={[styles.slot, styles.slotPause]} accessibilityLabel={`${t} em pausa`}>
                <Text style={[styles.slotText, { color: colors.muted }]}>{t}</Text>
                <Text style={styles.pauseTag}>pausa</Text>
              </View>
            );
          }
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

      <SectionTitle hint="Horários fixos sem atendimento, como o almoço. Ninguém consegue marcar neles, nem você.">Pausas fixas</SectionTitle>
      {breaks.map((b, i) => {
        const err = tried ? breakError(b) : null;
        return (
          <View key={b.id} style={styles.breakCard}>
            <View style={styles.breakHead}>
              <View style={{ flex: 1 }}>
                <Field label="Nome" value={b.label} onChangeText={(t) => updateBreak(b.id, { label: t })} placeholder="Ex.: Almoço" maxLength={30} />
              </View>
              <Pressable
                onPress={() => {
                  setBreaks((list) => list.filter((x) => x.id !== b.id));
                  setSaved(false);
                }}
                style={{ paddingTop: 18 }}
                accessibilityLabel={`Remover pausa ${i + 1}`}
              >
                <Ionicons name="trash-outline" size={20} color={colors.wine} />
              </Pressable>
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Field label="Das" value={b.start} onChangeText={(t) => updateBreak(b.id, { start: formatTime(t) })} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Até" value={b.end} onChangeText={(t) => updateBreak(b.id, { end: formatTime(t) })} keyboardType="number-pad" />
              </View>
            </View>
            <Chips
              options={WEEKDAYS_SHORT.map((d, k) => ({ id: String(k), label: d }))}
              selected={b.days.map(String)}
              onToggle={(id) => {
                const d = Number(id);
                updateBreak(b.id, { days: b.days.includes(d) ? b.days.filter((x) => x !== d) : [...b.days, d].sort() });
              }}
            />
            {err && <Text style={styles.error}>{err}</Text>}
          </View>
        );
      })}
      <Button
        label="Adicionar pausa"
        icon="cafe-outline"
        variant="secondary"
        onPress={() => {
          setBreaks((list) => [...list, { id: newId(), label: 'Almoço', days: [...settings.workDays], start: '12:00', end: '13:00' }]);
          setSaved(false);
        }}
      />

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
  slotPause: { backgroundColor: '#F1ECEA', borderColor: '#F1ECEA', paddingVertical: 4 },
  pauseTag: { fontFamily: fonts.regular, fontSize: 9, color: colors.muted },
  breakCard: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 12, gap: 4 },
  breakHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  row: { flexDirection: 'row', gap: 12 },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.danger, marginTop: 6 },
  slotTextOff: { color: colors.muted, textDecorationLine: 'line-through' },
});
