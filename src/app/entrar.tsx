import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Field, ScreenHeader } from '@/components/ui';
import { useSession } from '@/features/session/SessionContext';
import { PhoneVerification } from '@/features/verification/PhoneVerification';
import { colors, fonts, radius } from '@/theme';
import { formatPhone, isValidPhone, onlyDigits } from '@/utils/format';

type Who = 'cliente' | 'profissional';

export default function EntrarScreen() {
  const insets = useSafeAreaInsets();
  const { remote, role, phone: loggedPhone, signInProfessional, signOut } = useSession();
  const [who, setWho] = useState<Who>('cliente');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const done = () => (router.canGoBack() ? router.back() : router.replace('/'));

  async function loginProfessional() {
    setBusy(true);
    setError(await signInProfessional(email, password));
    setBusy(false);
  }

  if (!remote) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 12, paddingHorizontal: 20 }]}>
        <ScreenHeader title="Entrar" />
        <Text style={styles.text}>
          Este app ainda funciona só neste aparelho. O login de clientes e da profissional fica disponível quando ele for
          ligado ao servidor (veja supabase/README.md).
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.screen}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
      >
        <ScreenHeader title="Entrar" subtitle="Seus horários e dados em qualquer celular" />

        {role !== 'visitante' ? (
          <View style={styles.logged}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <Text style={styles.loggedText}>
              {role === 'profissional'
                ? 'Você entrou como profissional.'
                : `Você entrou com o WhatsApp ${formatPhone(loggedPhone ?? '')}.`}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
              <Button label="Continuar" onPress={done} style={{ flex: 1 }} />
              <Button label="Sair" variant="secondary" onPress={signOut} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <>
            <View style={styles.segment}>
              {(
                [
                  ['cliente', 'Sou cliente'],
                  ['profissional', 'Sou a profissional'],
                ] as const
              ).map(([id, label]) => (
                <Pressable key={id} style={[styles.segmentItem, who === id && styles.segmentActive]} onPress={() => setWho(id)}>
                  <Text style={[styles.segmentText, who === id && { color: colors.white }]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            {who === 'cliente' ? (
              <View style={{ marginTop: 18 }}>
                <Field
                  label="WhatsApp"
                  value={phone}
                  onChangeText={(t) => setPhone(formatPhone(t))}
                  placeholder="(11) 98765-4321"
                  keyboardType="phone-pad"
                  helper="Sem senha e sem documentos: você recebe um código no WhatsApp."
                />
                {isValidPhone(phone) && <PhoneVerification phone={onlyDigits(phone)} verified={false} onVerified={done} />}
                <Pressable onPress={() => router.replace({ pathname: '/cadastro', params: { tipo: 'rapido' } })} hitSlop={6}>
                  <Text style={styles.link}>Ainda não tenho cadastro</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ marginTop: 18 }}>
                <Field label="Login" value={email} onChangeText={setEmail} autoCapitalize="none" placeholder="Seu login ou e-mail" />
                <Field label="Senha" value={password} onChangeText={setPassword} autoCapitalize="none" secure />
                {error && <Text style={styles.error}>{error}</Text>}
                <Button label="Entrar" icon="log-in-outline" onPress={loginProfessional} disabled={busy || !email || !password} />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  text: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.muted },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.pill },
  segmentActive: { backgroundColor: colors.plum },
  segmentText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.plum },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.wine, textAlign: 'center', marginTop: 8 },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.danger, marginBottom: 10 },
  logged: { alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: radius.md, padding: 18 },
  loggedText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink, textAlign: 'center' },
});
