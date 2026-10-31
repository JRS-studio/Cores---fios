import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chips, Field, ScreenHeader, SectionTitle } from '@/components/ui';
import { clearAll, STORAGE_KEYS } from '@/data/storage';
import { ClientLink } from '@/features/session/ClientLink';
import { useSession } from '@/features/session/SessionContext';
import { useSettings } from '@/features/settings/SettingsContext';
import { colors, fonts, radius } from '@/theme';
import { WEEKDAYS_SHORT } from '@/utils/date';
import { formatPhone, isValidPhone, onlyDigits } from '@/utils/format';
import { Ionicons } from '@expo/vector-icons';

const isTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
const formatTime = (t: string) => {
  const d = t.replace(/\D/g, '').slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
};

export default function AjustesScreen() {
  const insets = useSafeAreaInsets();
  const { settings, saveSettings } = useSettings();
  const { remote, role, phone, canManage, signOut } = useSession();
  const [form, setForm] = useState({ ...settings, monthlyGoal: String(settings.monthlyGoal), whatsapp: formatPhone(settings.whatsapp) });
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  };

  const errors = {
    professionalName: form.professionalName.trim().length < 2 ? 'Digite seu nome.' : null,
    studioName: form.studioName.trim().length < 2 ? 'Digite o nome do studio.' : null,
    monthlyGoal: !(Number(form.monthlyGoal) >= 0) ? 'Digite um valor.' : null,
    openTime: !isTime(form.openTime) ? 'Use HH:MM.' : null,
    closeTime: !isTime(form.closeTime) || form.closeTime <= form.openTime ? 'Precisa ser depois da abertura.' : null,
    workDays: form.workDays.length === 0 ? 'Escolha ao menos um dia.' : null,
    whatsapp: form.whatsapp && !isValidPhone(form.whatsapp) ? 'Digite um WhatsApp válido com DDD.' : null,
  };

  function save() {
    setTried(true);
    if (Object.values(errors).some(Boolean)) return;
    saveSettings({
      ...form,
      professionalName: form.professionalName.trim(),
      studioName: form.studioName.trim(),
      monthlyGoal: Number(form.monthlyGoal),
      whatsapp: onlyDigits(form.whatsapp),
    });
    setSaved(true);
  }

  async function resetAll() {
    await clearAll(Object.values(STORAGE_KEYS));
    // Recarrega o app do zero (no navegador) ou volta ao início (no celular, ao reabrir o app).
    const g = globalThis as { location?: { reload: () => void } };
    if (Platform.OS === 'web' && g.location) g.location.reload();
    else router.replace('/');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.screen}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
      >
        <ScreenHeader title="Ajustes" subtitle={canManage ? 'Seu studio e sua agenda' : 'Sua conta e privacidade'} />

        {/* O link só faz sentido com servidor: sem ele, os dados da cliente ficariam no celular dela. */}
        {remote && canManage && <ClientLink studioName={settings.studioName} />}

        {remote && (
          <View style={styles.account}>
            <Text style={styles.accountText}>
              {role === 'profissional'
                ? 'Você entrou como profissional.'
                : role === 'cliente'
                  ? `Você entrou com o WhatsApp ${formatPhone(phone ?? '')}.`
                  : 'Você ainda não entrou.'}
            </Text>
            {role === 'visitante' ? (
              <Button label="Entrar" icon="log-in-outline" onPress={() => router.push('/entrar')} />
            ) : (
              <Button label="Sair" icon="log-out-outline" variant="secondary" onPress={signOut} />
            )}
          </View>
        )}

        {canManage && (
          <View style={styles.menu}>
            {(
              [
                ['cut-outline', 'Serviços, preços e tempo', '/ajustes/servicos'],
                ['time-outline', 'Horários liberados e pausas', '/ajustes/horarios'],
                ['diamond-outline', 'Benefícios do Premium', '/ajustes/premium'],
              ] as const
            ).map(([icon, label, href], i) => (
              <Pressable key={href} style={[styles.menuRow, i > 0 && styles.menuDivider]} onPress={() => router.push(href)} accessibilityRole="button">
                <Ionicons name={icon} size={20} color={colors.wine} />
                <Text style={styles.menuText}>{label}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        )}

        {canManage && (
          <>
            <SectionTitle>Studio</SectionTitle>
            <Field
              label="Seu nome"
              value={form.professionalName}
              onChangeText={(t) => set('professionalName', t)}
              autoCapitalize="words"
              error={tried ? errors.professionalName : null}
            />
            <Field
              label="Nome do studio"
              value={form.studioName}
              onChangeText={(t) => set('studioName', t)}
              autoCapitalize="words"
              error={tried ? errors.studioName : null}
            />
            <Field
              label="Seu WhatsApp (recebe os novos agendamentos)"
              optional
              value={form.whatsapp}
              onChangeText={(t) => set('whatsapp', formatPhone(t))}
              placeholder="(11) 98765-4321"
              keyboardType="phone-pad"
              helper="Quando uma cliente agenda, o WhatsApp dela abre com a mensagem pronta para você."
              error={tried ? errors.whatsapp : null}
            />
            <Field
              label="Meta de faturamento do mês (R$)"
              value={form.monthlyGoal}
              onChangeText={(t) => set('monthlyGoal', t.replace(/\D/g, ''))}
              keyboardType="number-pad"
              error={tried ? errors.monthlyGoal : null}
            />

            <SectionTitle hint="Usado para mostrar só os horários livres na agenda.">Horário de atendimento</SectionTitle>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Abre às"
                  value={form.openTime}
                  onChangeText={(t) => set('openTime', formatTime(t))}
                  keyboardType="number-pad"
                  error={tried ? errors.openTime : null}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Fecha às"
                  value={form.closeTime}
                  onChangeText={(t) => set('closeTime', formatTime(t))}
                  keyboardType="number-pad"
                  error={tried ? errors.closeTime : null}
                />
              </View>
            </View>
            <Text style={styles.label}>Dias de atendimento</Text>
            <Chips
              options={WEEKDAYS_SHORT.map((d, i) => ({ id: String(i), label: d }))}
              selected={form.workDays.map(String)}
              onToggle={(id) => {
                const day = Number(id);
                set('workDays', form.workDays.includes(day) ? form.workDays.filter((d) => d !== day) : [...form.workDays, day].sort());
              }}
            />
            {tried && errors.workDays && <Text style={styles.error}>{errors.workDays}</Text>}
            <Text style={styles.label}>Intervalo entre horários</Text>
            <Chips
              options={[15, 30, 60].map((m) => ({ id: String(m), label: `${m} min` }))}
              selected={[String(form.slotStep)]}
              onToggle={(id) => set('slotStep', Number(id))}
            />

            <Button
              label={saved ? 'Ajustes salvos' : 'Salvar ajustes'}
              icon={saved ? 'checkmark-circle' : 'checkmark'}
              onPress={save}
              style={{ marginTop: 26 }}
            />
          </>
        )}

        <Pressable style={styles.linkRow} onPress={() => router.push('/privacidade')}>
          <Text style={styles.linkText}>Política de privacidade</Text>
          <Text style={styles.linkText}>›</Text>
        </Pressable>

        {/* Sem servidor, os dados vivem só neste aparelho e podem ser apagados daqui. */}
        {!remote && (
          <View style={styles.danger}>
            <Text style={styles.dangerTitle}>Apagar todos os dados</Text>
            <Text style={styles.dangerText}>
              Remove clientes, agenda, lançamentos, avaliações e ajustes deste aparelho. Não dá para desfazer.
            </Text>
            {confirmReset ? (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <Button label="Manter" variant="secondary" onPress={() => setConfirmReset(false)} style={{ flex: 1 }} />
                <Button label="Apagar tudo" variant="danger" onPress={resetAll} style={{ flex: 1 }} />
              </View>
            ) : (
              <Button
                label="Apagar dados"
                icon="trash-outline"
                variant="danger"
                onPress={() => setConfirmReset(true)}
                style={{ marginTop: 12 }}
              />
            )}
          </View>
        )}
        <Text style={styles.version}>Cores & Fios · versão {Constants.expoConfig?.version ?? '1.0.0'}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink, marginTop: 12, marginBottom: 8 },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.danger, marginTop: 6 },
  menu: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 15 },
  menuDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  menuText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  account: {
    gap: 12,
    padding: 16,
    marginBottom: 20,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 26,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  linkText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.plum },
  version: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 20 },
  danger: { marginTop: 30, padding: 16, borderRadius: radius.md, borderWidth: 1, borderColor: '#F1C7B8', backgroundColor: '#FFF8F5' },
  dangerTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.danger },
  dangerText: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 4 },
});
