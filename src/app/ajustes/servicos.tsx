import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Field, OwnerOnly, ScreenHeader } from '@/components/ui';
import { isServiceActive, type Service } from '@/data/services';
import { useSession } from '@/features/session/SessionContext';
import { useSettings } from '@/features/settings/SettingsContext';
import { colors, fonts, radius } from '@/theme';
import { newId } from '@/utils/id';

type Row = { id: string; name: string; price: string; duration: string; active: boolean };

const toRow = (s: Service): Row => ({ id: s.id, name: s.name, price: String(s.price).replace('.', ','), duration: String(s.duration), active: isServiceActive(s) });
const toNumber = (v: string) => Number(v.replace(',', '.'));

export default function ServicosScreen() {
  const { canManage } = useSession();
  return canManage ? <ServicosContent /> : <OwnerOnly title="Serviços" />;
}

function ServicosContent() {
  const insets = useSafeAreaInsets();
  const { settings, saveSettings } = useSettings();
  const [rows, setRows] = useState<Row[]>(() => settings.services.map(toRow));
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState(false);

  const errorsFor = (r: Row) => ({
    name: r.name.trim().length < 2 ? 'Digite o nome.' : null,
    price: r.price.trim() === '' || !(toNumber(r.price) >= 0) ? 'Valor inválido.' : null,
    duration: !(Number(r.duration) >= 5 && Number(r.duration) <= 600) ? 'De 5 a 600 min.' : null,
  });
  const valid = rows.every((r) => Object.values(errorsFor(r)).every((e) => !e));

  const update = (id: string, patch: Partial<Row>) => {
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setSaved(false);
  };

  function add() {
    setRows((list) => [...list, { id: newId(), name: '', price: '', duration: '60', active: true }]);
    setSaved(false);
  }

  function save() {
    setTried(true);
    if (!valid) return;
    saveSettings({
      ...settings,
      services: rows.map((r) => ({ id: r.id, name: r.name.trim(), price: toNumber(r.price), duration: Number(r.duration), active: r.active })),
    });
    setSaved(true);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.screen}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
      >
        <ScreenHeader title="Serviços" subtitle="Nome, preço e tempo de cada serviço" />
        <Text style={styles.hint}>
          O tempo define quanto da agenda o serviço ocupa. Serviços pausados não aparecem para as clientes nem no agendamento; os horários já
          marcados continuam como estão.
        </Text>

        {rows.map((r) => {
          const e = tried ? errorsFor(r) : { name: null, price: null, duration: null };
          return (
            <View key={r.id} style={[styles.card, !r.active && styles.cardOff]}>
              <Field label="Serviço" value={r.name} onChangeText={(t) => update(r.id, { name: t })} placeholder="Ex.: Blindagem" error={e.name} />
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Preço (R$)"
                    value={r.price}
                    onChangeText={(t) => update(r.id, { price: t.replace(/[^\d,.]/g, '') })}
                    keyboardType="decimal-pad"
                    error={e.price}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Tempo (min)"
                    value={r.duration}
                    onChangeText={(t) => update(r.id, { duration: t.replace(/\D/g, '').slice(0, 3) })}
                    keyboardType="number-pad"
                    error={e.duration}
                  />
                </View>
              </View>
              <View style={styles.actions}>
                <Pressable style={styles.action} onPress={() => update(r.id, { active: !r.active })} accessibilityRole="switch" accessibilityState={{ checked: r.active }}>
                  <Ionicons name={r.active ? 'eye-outline' : 'eye-off-outline'} size={17} color={colors.plum} />
                  <Text style={styles.actionText}>{r.active ? 'Oferecendo' : 'Pausado'}</Text>
                </Pressable>
                {confirmId === r.id ? (
                  <View style={styles.action}>
                    <Pressable onPress={() => setConfirmId(null)} hitSlop={6}>
                      <Text style={styles.cancel}>Cancelar</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setRows((list) => list.filter((x) => x.id !== r.id));
                        setConfirmId(null);
                        setSaved(false);
                      }}
                      hitSlop={6}
                    >
                      <Text style={styles.remove}>Remover</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable style={styles.action} onPress={() => setConfirmId(r.id)} accessibilityLabel={`Remover ${r.name || 'serviço'}`}>
                    <Ionicons name="trash-outline" size={17} color={colors.wine} />
                    <Text style={[styles.actionText, { color: colors.wine }]}>Remover</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}

        <Button label="Adicionar serviço" icon="add" variant="secondary" onPress={add} style={{ marginTop: 6 }} />
        {tried && !valid && <Text style={styles.error}>Confira os campos marcados.</Text>}
        <Button
          label={saved ? 'Serviços salvos' : 'Salvar serviços'}
          icon={saved ? 'checkmark-circle' : 'checkmark'}
          onPress={save}
          style={{ marginTop: 12 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  hint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.muted, marginBottom: 14 },
  card: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 12, gap: 4 },
  cardOff: { opacity: 0.6 },
  row: { flexDirection: 'row', gap: 12 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  actionText: { fontFamily: fonts.medium, fontSize: 13, color: colors.plum },
  cancel: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginRight: 10 },
  remove: { fontFamily: fonts.semibold, fontSize: 13, color: colors.wine },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.danger, marginTop: 10 },
});
