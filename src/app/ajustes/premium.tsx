import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Field, OwnerOnly, ScreenHeader, SectionTitle } from '@/components/ui';
import { premiumBenefits } from '@/data/loyalty';
import { cashbackFor } from '@/features/cashback/CashbackContext';
import { useSession } from '@/features/session/SessionContext';
import { useSettings } from '@/features/settings/SettingsContext';
import { colors, fonts, radius } from '@/theme';
import { brl } from '@/utils/format';

const digits = (v: string, max = 3) => v.replace(/\D/g, '').slice(0, max);

export default function PremiumScreen() {
  const { canManage } = useSession();
  return canManage ? <PremiumContent /> : <OwnerOnly title="Cashback e benefícios" />;
}

function PremiumContent() {
  const insets = useSafeAreaInsets();
  const { settings, saveSettings } = useSettings();
  const l = settings.loyalty;
  const [form, setForm] = useState({
    cashbackPercent: String(l.cashbackPercent).replace('.', ','),
    birthdayDiscount: String(l.birthdayDiscount),
  });
  const [extra, setExtra] = useState<string[]>(settings.extraBenefits);
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  };

  const rules = {
    cashbackPercent: Number(form.cashbackPercent.replace(',', '.') || 0),
    birthdayDiscount: Number(form.birthdayDiscount || 0),
  };
  const errors = {
    cashbackPercent: !(rules.cashbackPercent >= 0 && rules.cashbackPercent <= 50) ? 'Use de 0 a 50%.' : null,
    birthdayDiscount: rules.birthdayDiscount > 100 ? 'No máximo 100%.' : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  const preview = premiumBenefits(rules, extra);

  function save() {
    setTried(true);
    if (!valid) return;
    saveSettings({ ...settings, loyalty: rules, extraBenefits: extra.map((b) => b.trim()).filter(Boolean) });
    setSaved(true);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.screen}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
      >
        <ScreenHeader title="Cashback e benefícios" subtitle="O que a cliente ganha no cadastro Premium" />

        <SectionTitle hint="Em todo atendimento pago, essa porcentagem volta para a cliente Premium como saldo no app.">Cashback</SectionTitle>
        <Field
          label="Cashback (%)"
          value={form.cashbackPercent}
          onChangeText={(t) => set('cashbackPercent', t.replace(/[^\d,]/g, '').slice(0, 4))}
          keyboardType="decimal-pad"
          helper={
            rules.cashbackPercent > 0
              ? `Ex.: num atendimento de R$ 100, ela ganha ${brl(cashbackFor(100, rules.cashbackPercent))}. Use 0 para desligar.`
              : 'Cashback desligado.'
          }
          error={tried ? errors.cashbackPercent : null}
        />

        <SectionTitle hint="Vale para todas as clientes Premium que informaram a data de nascimento, em qualquer serviço marcado no mês do aniversário. Entra sozinho no agendamento e o atendimento também gera cashback. Use 0 para desligar.">
          Desconto de aniversário
        </SectionTitle>
        <Field
          label="Desconto no aniversário (%)"
          value={form.birthdayDiscount}
          onChangeText={(t) => set('birthdayDiscount', digits(t))}
          keyboardType="number-pad"
          error={tried ? errors.birthdayDiscount : null}
        />

        <SectionTitle hint="Escreva do jeito que a cliente vai ler.">Benefícios extras</SectionTitle>
        {extra.map((b, i) => (
          <View key={i} style={styles.extraRow}>
            <View style={{ flex: 1 }}>
              <Field
                label={`Benefício ${i + 1}`}
                value={b}
                onChangeText={(t) => {
                  setExtra((list) => list.map((x, k) => (k === i ? t : x)));
                  setSaved(false);
                }}
                placeholder="Ex.: Café e água à vontade"
              />
            </View>
            <Pressable
              onPress={() => {
                setExtra((list) => list.filter((_, k) => k !== i));
                setSaved(false);
              }}
              style={styles.removeButton}
              accessibilityLabel={`Remover benefício ${i + 1}`}
            >
              <Ionicons name="close-circle" size={24} color={colors.muted} />
            </Pressable>
          </View>
        ))}
        <Button label="Adicionar benefício" icon="add" variant="secondary" onPress={() => setExtra((list) => [...list, ''])} />

        <SectionTitle>Como a cliente vê</SectionTitle>
        <View style={styles.preview}>
          {preview.map((b) => (
            <View key={b} style={styles.previewRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.wine} />
              <Text style={styles.previewText}>{b}</Text>
            </View>
          ))}
          {preview.length === 0 && <Text style={styles.previewText}>Nenhum benefício.</Text>}
        </View>

        <Button label={saved ? 'Benefícios salvos' : 'Salvar benefícios'} icon={saved ? 'checkmark-circle' : 'checkmark'} onPress={save} style={{ marginTop: 22 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  extraRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  removeButton: { paddingTop: 18 },
  preview: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  previewRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  previewText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.ink },
});
