import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Field, OwnerOnly, ScreenHeader, SectionTitle } from '@/components/ui';
import { premiumBenefits } from '@/data/loyalty';
import { useSession } from '@/features/session/SessionContext';
import { useSettings } from '@/features/settings/SettingsContext';
import { colors, fonts, radius } from '@/theme';

const digits = (v: string, max = 3) => v.replace(/\D/g, '').slice(0, max);

export default function PremiumScreen() {
  const { canManage } = useSession();
  return canManage ? <PremiumContent /> : <OwnerOnly title="Benefícios do Premium" />;
}

function PremiumContent() {
  const insets = useSafeAreaInsets();
  const { settings, saveSettings } = useSettings();
  const l = settings.loyalty;
  const [form, setForm] = useState({
    stampsForReward: String(l.stampsForReward),
    reward: l.reward,
    welcomeStamps: String(l.welcomeStamps),
    referralStamps: String(l.referralStamps),
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
    stampsForReward: Number(form.stampsForReward || 0),
    reward: form.reward.trim(),
    welcomeStamps: Number(form.welcomeStamps || 0),
    referralStamps: Number(form.referralStamps || 0),
    birthdayDiscount: Number(form.birthdayDiscount || 0),
  };
  const errors = {
    stampsForReward: rules.stampsForReward < 1 ? 'Pelo menos 1 atendimento.' : null,
    reward: rules.reward.length < 3 ? 'Descreva o prêmio.' : null,
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
        <ScreenHeader title="Benefícios do Premium" subtitle="O que a cliente ganha no cadastro Premium" />

        <SectionTitle hint="O cartão de selos das clientes usa estes números.">Cartão fidelidade</SectionTitle>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field
              label="Atendimentos para o prêmio"
              value={form.stampsForReward}
              onChangeText={(t) => set('stampsForReward', digits(t, 2))}
              keyboardType="number-pad"
              error={tried ? errors.stampsForReward : null}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Selos de boas-vindas" value={form.welcomeStamps} onChangeText={(t) => set('welcomeStamps', digits(t, 2))} keyboardType="number-pad" />
          </View>
        </View>
        <Field
          label="Prêmio"
          value={form.reward}
          onChangeText={(t) => set('reward', t)}
          placeholder="Ex.: Esmaltação em gel grátis"
          error={tried ? errors.reward : null}
        />

        <SectionTitle hint="Use 0 para desligar.">Outras vantagens</SectionTitle>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field
              label="Desconto no aniversário (%)"
              value={form.birthdayDiscount}
              onChangeText={(t) => set('birthdayDiscount', digits(t))}
              keyboardType="number-pad"
              error={tried ? errors.birthdayDiscount : null}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Selos por indicação" value={form.referralStamps} onChangeText={(t) => set('referralStamps', digits(t, 2))} keyboardType="number-pad" />
          </View>
        </View>

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
  row: { flexDirection: 'row', gap: 12 },
  extraRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  removeButton: { paddingTop: 18 },
  preview: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  previewRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  previewText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.ink },
});
