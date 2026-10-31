import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, CheckRow, Chips, Field, ScreenHeader, SectionTitle } from '@/components/ui';
import { polishes, shapes, type ShapeId } from '@/data/catalog';
import { LOYALTY, PREMIUM_BENEFITS } from '@/data/loyalty';
import { useClients } from '@/features/clients/ClientsContext';
import {
  ALLERGIES,
  CONTACT_CHANNELS,
  HEALTH_CONDITIONS,
  LENGTHS,
  PERIODS,
  REFERRAL_SOURCES,
  type Client,
  type Plan,
} from '@/features/clients/types';
import { colors, fonts, radius, shadow } from '@/theme';
import { newId } from '@/utils/id';
import { PhoneVerification } from '@/features/verification/PhoneVerification';
import { formatDate, formatPhone, isValidBirthDate, isValidEmail, isValidPhone, onlyDigits } from '@/utils/format';

const STEPS = ['Seus dados', 'Preferências', 'Ficha de saúde', 'Confirmação'];
const MAX_COLORS = 5;
const toOptions = (list: string[]) => list.map((l) => ({ id: l, label: l }));

export default function CadastroScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tipo?: Plan; id?: string }>();
  const { getClient, findByPhone, saveClient } = useClients();
  const existing = params.id ? getClient(params.id) : undefined;
  const plan: Plan = params.tipo === 'premium' ? 'premium' : 'rapido';
  const premium = plan === 'premium';

  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);
  const [form, setForm] = useState(() => ({
    name: existing?.name ?? '',
    phone: existing ? formatPhone(existing.phone) : '',
    email: existing?.email ?? '',
    birthDate: existing?.birthDate ?? '',
    address: existing?.address ?? '',
    contactChannel: existing?.contactChannel ?? 'whatsapp',
    preferredShape: existing?.preferredShape,
    preferredLength: existing?.preferredLength,
    favoriteColors: existing?.favoriteColors ?? [],
    preferredPeriods: existing?.preferredPeriods ?? [],
    referralSource: existing?.referralSource,
    referredBy: existing?.referredBy ?? '',
    allergies: existing?.allergies ?? [],
    healthConditions: existing?.healthConditions ?? [],
    healthNotes: existing?.healthNotes ?? '',
    healthConsent: existing?.healthConsent ?? false,
    privacyConsent: existing?.privacyConsent ?? false,
    remindersConsent: existing?.remindersConsent ?? true,
  }));
  type Form = typeof form;
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const toggleIn = (key: 'favoriteColors' | 'preferredPeriods' | 'allergies' | 'healthConditions', id: string, max = 99) =>
    setForm((f) => {
      const list = f[key];
      if (list.includes(id)) return { ...f, [key]: list.filter((x) => x !== id) };
      return list.length >= max ? f : { ...f, [key]: [...list, id] };
    });

  // O WhatsApp é a identificação da cliente: vale como verificado só o número confirmado por código.
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(existing?.phoneVerified ? existing.phone : null);
  const phoneDigits = onlyDigits(form.phone);
  const phoneVerified = verifiedPhone === phoneDigits;

  const hasHealthData = form.allergies.length > 0 || form.healthConditions.length > 0 || form.healthNotes.trim().length > 0;
  const duplicate = findByPhone(onlyDigits(form.phone));

  const errors: Record<string, string | null> = {
    name: form.name.trim().length < 2 ? 'Digite seu nome.' : null,
    phone: !isValidPhone(form.phone)
      ? 'Digite um celular com DDD, ex.: (11) 98765-4321.'
      : duplicate && duplicate.id !== existing?.id
        ? 'Já existe um cadastro com este WhatsApp.'
        : null,
    verification: !phoneVerified ? 'Confirme seu WhatsApp com o código para continuar.' : null,
    email: premium && form.email.trim() && !isValidEmail(form.email) ? 'Confira o e-mail ou deixe em branco.' : null,
    birthDate:
      premium && form.birthDate && !isValidBirthDate(form.birthDate) ? 'Use o formato DD/MM/AAAA ou deixe em branco.' : null,
    healthConsent: hasHealthData && !form.healthConsent ? 'Para salvar a ficha de saúde, autorize o registro.' : null,
    privacyConsent: !form.privacyConsent ? 'É preciso concordar para concluir o cadastro.' : null,
  };

  const stepFields: string[][] = premium
    ? [['name', 'phone', 'verification', 'email', 'birthDate'], [], ['healthConsent'], ['privacyConsent']]
    : [['name', 'phone', 'verification', 'privacyConsent']];
  const stepValid = stepFields[step].every((k) => !errors[k]);
  const lastStep = step === stepFields.length - 1;
  const showError = (key: string) => (tried ? errors[key] : null);

  function next() {
    setTried(true);
    if (!stepValid) return;
    setTried(false);
    if (lastStep) finish();
    else setStep(step + 1);
  }

  function back() {
    if (step === 0) {
      if (router.canGoBack()) router.back();
      else router.replace('/clientes');
    } else setStep(step - 1);
  }

  function finish() {
    const wasPremium = existing?.plan === 'premium';
    const prevLoyalty = existing?.loyalty ?? { stamps: 0, totalVisits: 0, rewardsRedeemed: 0 };
    const base: Client = {
      ...(existing ?? {}),
      id: existing?.id ?? newId(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      plan,
      name: form.name.trim(),
      phone: phoneDigits,
      phoneVerified: true,
      privacyConsent: true,
      remindersConsent: form.remindersConsent,
    };
    const client: Client = premium
      ? {
          ...base,
          email: form.email.trim() || undefined,
          birthDate: form.birthDate || undefined,
          address: form.address.trim() || undefined,
          contactChannel: form.contactChannel,
          preferredShape: form.preferredShape,
          preferredLength: form.preferredLength,
          favoriteColors: form.favoriteColors,
          preferredPeriods: form.preferredPeriods,
          referralSource: form.referralSource,
          referredBy: form.referralSource === 'Indicação de amiga' ? form.referredBy.trim() || undefined : undefined,
          // Dado sensível: só fica salvo com autorização específica.
          healthConsent: hasHealthData && form.healthConsent,
          allergies: form.healthConsent ? form.allergies : [],
          healthConditions: form.healthConsent ? form.healthConditions : [],
          healthNotes: form.healthConsent ? form.healthNotes.trim() : '',
          loyalty: wasPremium ? prevLoyalty : { ...prevLoyalty, stamps: prevLoyalty.stamps + LOYALTY.welcomeStamps },
        }
      : base;
    saveClient(client);
    // Se o perfil já estava aberto (edição ou upgrade), volta para ele em vez de empilhar outro.
    router.dismissTo({ pathname: '/cliente/[id]', params: { id: client.id, novo: existing ? (wasPremium || !premium ? 'editado' : 'premium') : plan } });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.screen}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
      >
        <ScreenHeader
          title={premium ? (existing?.plan === 'premium' ? 'Editar cadastro' : 'Cadastro Premium') : 'Cadastro rápido'}
          subtitle={premium ? `Passo ${step + 1} de ${STEPS.length} · ${STEPS[step]}` : 'Só o essencial para agendar'}
        />

        {premium && (
          <View style={styles.progress}>
            {STEPS.map((s, i) => (
              <View key={s} style={[styles.progressBar, i <= step && styles.progressBarOn]} />
            ))}
          </View>
        )}

        {/* Passo 1 (ou cadastro rápido): identificação e contato */}
        {step === 0 && (
          <>
            {!premium && (
              <View style={styles.intro}>
                <Ionicons name="flash-outline" size={20} color={colors.wine} />
                <Text style={styles.introText}>Ideal para quem agenda de vez em quando. Leva menos de 1 minuto.</Text>
              </View>
            )}
            <Field
              label="Nome"
              value={form.name}
              onChangeText={(t) => set('name', t)}
              placeholder={premium ? 'Ex.: Mariana Alves' : 'Como prefere ser chamada'}
              autoCapitalize="words"
              maxLength={60}
              error={showError('name')}
            />
            <Field
              label="WhatsApp"
              value={form.phone}
              onChangeText={(t) => set('phone', formatPhone(t))}
              placeholder="(11) 98765-4321"
              keyboardType="phone-pad"
              error={showError('phone')}
              helper="Seu WhatsApp é sua identificação no studio. Não pedimos documentos."
            />
            {!errors.phone && (
              <PhoneVerification
                phone={phoneDigits}
                verified={phoneVerified}
                onVerified={() => setVerifiedPhone(phoneDigits)}
                error={showError('verification')}
              />
            )}
            {premium && (
              <>
                <Field
                  label="E-mail"
                  optional
                  value={form.email}
                  onChangeText={(t) => set('email', t)}
                  placeholder="voce@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  error={showError('email')}
                />
                <Field
                  label="Data de nascimento"
                  optional
                  value={form.birthDate}
                  onChangeText={(t) => set('birthDate', formatDate(t))}
                  placeholder="DD/MM/AAAA"
                  keyboardType="number-pad"
                  error={showError('birthDate')}
                  helper={`Você ganha ${LOYALTY.birthdayDiscount}% de desconto no mês do aniversário.`}
                />
                <Field
                  label="Endereço"
                  optional
                  value={form.address}
                  onChangeText={(t) => set('address', t)}
                  placeholder="Rua, número, bairro"
                  helper="Preencha se quiser atendimento a domicílio."
                />
                <Text style={styles.subLabel}>Prefere ser contatada por</Text>
                <Chips
                  options={CONTACT_CHANNELS.map((c) => ({ id: c.id, label: c.label }))}
                  selected={[form.contactChannel]}
                  onToggle={(id) => set('contactChannel', id as Form['contactChannel'])}
                />
              </>
            )}
            {!premium && (
              <View style={{ marginTop: 6, gap: 6 }}>
                <PrivacyConsent checked={form.privacyConsent} onToggle={() => set('privacyConsent', !form.privacyConsent)} error={showError('privacyConsent')} />
                <CheckRow checked={form.remindersConsent} onToggle={() => set('remindersConsent', !form.remindersConsent)}>
                  Quero receber lembretes dos meus horários pelo WhatsApp.
                </CheckRow>
              </View>
            )}
          </>
        )}

        {/* Passo 2: preferências de atendimento */}
        {premium && step === 1 && (
          <>
            <Text style={styles.stepIntro}>Assim seu horário já começa do jeito que você gosta. Tudo aqui é opcional.</Text>
            <SectionTitle>Formato preferido</SectionTitle>
            <Chips
              options={shapes.map((s) => ({ id: s.id, label: s.name }))}
              selected={form.preferredShape ? [form.preferredShape] : []}
              onToggle={(id) => set('preferredShape', form.preferredShape === id ? undefined : (id as ShapeId))}
            />
            <SectionTitle>Comprimento</SectionTitle>
            <Chips
              options={LENGTHS.map((l) => ({ id: l.id, label: l.label }))}
              selected={form.preferredLength ? [form.preferredLength] : []}
              onToggle={(id) => set('preferredLength', form.preferredLength === id ? undefined : (id as Form['preferredLength']))}
            />
            <SectionTitle hint={`Escolha até ${MAX_COLORS}.`}>Cores favoritas</SectionTitle>
            <View style={styles.swatches}>
              {polishes.map((p) => {
                const active = form.favoriteColors.includes(p.id);
                return (
                  <Pressable
                    key={p.id}
                    style={styles.swatch}
                    onPress={() => toggleIn('favoriteColors', p.id, MAX_COLORS)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                    accessibilityLabel={p.name}
                  >
                    <View style={[styles.swatchRing, active && styles.swatchRingOn]}>
                      <View style={[styles.swatchColor, { backgroundColor: p.color }]} />
                    </View>
                    <Text style={[styles.swatchName, active && styles.swatchNameOn]} numberOfLines={1}>
                      {p.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <SectionTitle>Melhores horários</SectionTitle>
            <Chips options={toOptions(PERIODS)} selected={form.preferredPeriods} onToggle={(id) => toggleIn('preferredPeriods', id)} />
            <SectionTitle>Como conheceu o studio?</SectionTitle>
            <Chips
              options={toOptions(REFERRAL_SOURCES)}
              selected={form.referralSource ? [form.referralSource] : []}
              onToggle={(id) => set('referralSource', form.referralSource === id ? undefined : id)}
            />
            {form.referralSource === 'Indicação de amiga' && (
              <View style={{ marginTop: 14 }}>
                <Field
                  label="Quem indicou?"
                  optional
                  value={form.referredBy}
                  onChangeText={(t) => set('referredBy', t)}
                  placeholder="Nome da amiga"
                  autoCapitalize="words"
                  helper={`Ela ganha +${LOYALTY.referralStamps} selos quando você fizer o primeiro atendimento.`}
                />
              </View>
            )}
          </>
        )}

        {/* Passo 3: ficha de saúde (anamnese) */}
        {premium && step === 2 && (
          <>
            <View style={styles.intro}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.wine} />
              <Text style={styles.introText}>
                Para sua segurança: a manicure confere estas informações antes de cada atendimento. Só ela tem acesso.
              </Text>
            </View>
            <SectionTitle hint="Marque o que se aplica.">Alergias</SectionTitle>
            <Chips options={toOptions(ALLERGIES)} selected={form.allergies} onToggle={(id) => toggleIn('allergies', id)} />
            <SectionTitle hint="Marque o que se aplica.">Condições de saúde</SectionTitle>
            <Chips options={toOptions(HEALTH_CONDITIONS)} selected={form.healthConditions} onToggle={(id) => toggleIn('healthConditions', id)} />
            <View style={{ marginTop: 16 }}>
              <Field
                label="Observações"
                optional
                value={form.healthNotes}
                onChangeText={(t) => set('healthNotes', t)}
                placeholder="Outra alergia, medicamento, cuidado especial…"
                multiline
                maxLength={300}
              />
            </View>
            {hasHealthData ? (
              <CheckRow
                checked={form.healthConsent}
                onToggle={() => set('healthConsent', !form.healthConsent)}
                error={showError('healthConsent')}
              >
                Autorizo o registro destas informações de saúde para a segurança do meu atendimento. Posso pedir para
                apagá-las a qualquer momento.
              </CheckRow>
            ) : (
              <Text style={styles.stepIntro}>Nada a informar? É só avançar.</Text>
            )}
          </>
        )}

        {/* Passo 4: programa de fidelidade e consentimentos */}
        {premium && step === 3 && (
          <>
            <LinearGradient colors={[colors.wine, colors.plum]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.loyaltyCard}>
              <Text style={styles.loyaltyEyebrow}>PROGRAMA FIDELIDADE</Text>
              <Text style={styles.loyaltyTitle}>Suas vantagens Premium</Text>
              {PREMIUM_BENEFITS.map((b) => (
                <View key={b} style={styles.benefit}>
                  <Ionicons name="sparkles" size={14} color={colors.roseGoldLight} />
                  <Text style={styles.benefitText}>{b}</Text>
                </View>
              ))}
            </LinearGradient>
            <View style={{ marginTop: 18, gap: 6 }}>
              <PrivacyConsent checked={form.privacyConsent} onToggle={() => set('privacyConsent', !form.privacyConsent)} error={showError('privacyConsent')} />
              <CheckRow checked={form.remindersConsent} onToggle={() => set('remindersConsent', !form.remindersConsent)}>
                Quero receber lembretes de horário e novidades do studio pelo WhatsApp.
              </CheckRow>
            </View>
          </>
        )}

        <View style={styles.actions}>
          {premium && step > 0 && <Button label="Voltar" variant="secondary" onPress={back} style={{ flex: 1 }} />}
          <Button
            label={lastStep ? 'Concluir cadastro' : 'Continuar'}
            icon={lastStep ? 'checkmark' : 'arrow-forward'}
            onPress={next}
            style={{ flex: 2 }}
          />
        </View>

        {!premium && !existing && (
          <Pressable style={styles.upsell} onPress={() => router.setParams({ tipo: 'premium' })}>
            <View style={{ flex: 1 }}>
              <Text style={styles.upsellTitle}>Vem sempre? Seja Premium</Text>
              <Text style={styles.upsellText}>
                Cartão fidelidade: a cada {LOYALTY.stampsForReward} atendimentos, 1 {LOYALTY.reward.toLowerCase()}.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.wine} />
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PrivacyConsent({ checked, onToggle, error }: { checked: boolean; onToggle: () => void; error: string | null }) {
  return (
    <CheckRow checked={checked} onToggle={onToggle} error={error}>
      Concordo com o uso dos meus dados para agendamentos e contato, conforme a LGPD. Posso pedir a exclusão a qualquer
      momento.
    </CheckRow>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  progress: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  progressBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  progressBarOn: { backgroundColor: colors.wine },
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.blush,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 16,
  },
  introText: { flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.ink },
  stepIntro: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 4 },
  subLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink, marginBottom: 8, marginTop: 2 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  swatch: { width: 64, alignItems: 'center', gap: 4, marginBottom: 6 },
  swatchRing: { width: 46, height: 46, borderRadius: 23, padding: 3, borderWidth: 2, borderColor: 'transparent' },
  swatchRingOn: { borderColor: colors.plum },
  swatchColor: { flex: 1, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  swatchName: { fontFamily: fonts.regular, fontSize: 10, color: colors.muted },
  swatchNameOn: { fontFamily: fonts.semibold, color: colors.plum },
  loyaltyCard: { borderRadius: radius.lg, padding: 22, gap: 10, ...shadow, shadowOpacity: 0.25 },
  loyaltyEyebrow: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 2, color: colors.roseGold },
  loyaltyTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.white, marginBottom: 4 },
  benefit: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  benefitText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.88)' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 26 },
  upsell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.roseGoldLight,
    backgroundColor: colors.white,
  },
  upsellTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.wine },
  upsellText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
});
