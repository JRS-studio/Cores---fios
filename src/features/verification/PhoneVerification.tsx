import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui';
import { colors, fonts, radius } from '@/theme';
import { formatPhone, isValidPhone } from '@/utils/format';
import { CODE_LENGTH, checkCode, requestCode, RESEND_SECONDS, type CheckResult } from './whatsappCode';

const MESSAGES: Record<Exclude<CheckResult, 'ok'>, string> = {
  wrong: 'Código incorreto. Confira e tente de novo.',
  expired: 'O código expirou. Peça um novo.',
  blocked: 'Muitas tentativas. Peça um novo código.',
};

// Confirmação do número: envia um código pelo WhatsApp e a cliente digita aqui.
export function PhoneVerification({
  phone,
  verified,
  onVerified,
  error,
}: {
  phone: string; // só dígitos
  verified: boolean;
  onVerified: () => void;
  error?: string | null;
}) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [testCode, setTestCode] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  if (verified) {
    return (
      <View style={styles.verified}>
        <Ionicons name="shield-checkmark" size={18} color={colors.success} />
        <Text style={styles.verifiedText}>WhatsApp {formatPhone(phone)} verificado</Text>
      </View>
    );
  }

  // Se a pessoa trocar o número depois de pedir o código, o código antigo não vale mais.
  const awaiting = sentTo === phone;

  async function send() {
    const { testCode: generated } = await requestCode(phone);
    setSentTo(phone);
    setTestCode(generated);
    setCode('');
    setMessage(null);
    setWait(RESEND_SECONDS);
  }

  async function confirm(value: string) {
    const result = await checkCode(phone, value);
    if (result === 'ok') {
      setMessage(null);
      onVerified();
    } else {
      setMessage(MESSAGES[result]);
      if (result !== 'wrong') setSentTo(null);
    }
  }

  return (
    <View style={[styles.box, !!error && styles.boxError]}>
      <View style={styles.titleRow}>
        <Ionicons name="logo-whatsapp" size={18} color={colors.success} />
        <Text style={styles.title}>Confirme seu WhatsApp</Text>
      </View>
      {!awaiting ? (
        <>
          <Text style={styles.text}>Enviamos um código de {CODE_LENGTH} dígitos para o seu WhatsApp. Não pedimos documentos.</Text>
          <Button
            label="Enviar código pelo WhatsApp"
            icon="send"
            onPress={send}
            disabled={!isValidPhone(phone)}
            style={{ marginTop: 10 }}
          />
        </>
      ) : (
        <>
          <Text style={styles.text}>Digite o código enviado para {formatPhone(phone)}.</Text>
          {testCode && (
            <View style={styles.testNote}>
              <Ionicons name="flask-outline" size={14} color={colors.wine} />
              <Text style={styles.testText}>
                Versão de teste, sem servidor de envio: seu código é <Text style={styles.testCode}>{testCode}</Text>
              </Text>
            </View>
          )}
          <TextInput
            value={code}
            onChangeText={(t) => {
              const digits = t.replace(/\D/g, '').slice(0, CODE_LENGTH);
              setCode(digits);
              setMessage(null);
              if (digits.length === CODE_LENGTH) confirm(digits);
            }}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={CODE_LENGTH}
            placeholder={'•'.repeat(CODE_LENGTH)}
            placeholderTextColor={colors.muted}
            style={styles.codeInput}
            accessibilityLabel="Código de verificação"
          />
          {message && <Text style={styles.error}>{message}</Text>}
          <Pressable onPress={send} disabled={wait > 0} hitSlop={6} style={{ alignSelf: 'center', marginTop: 10 }}>
            <Text style={[styles.resend, wait > 0 && { color: colors.muted }]}>
              {wait > 0 ? `Reenviar código em ${wait}s` : 'Reenviar código'}
            </Text>
          </Pressable>
        </>
      )}
      {error && !awaiting && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 14,
  },
  boxError: { borderColor: colors.danger },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  text: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 4 },
  testNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.blush,
    borderRadius: radius.sm,
    padding: 10,
    marginTop: 10,
  },
  testText: { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.ink },
  testCode: { fontFamily: fonts.semibold, letterSpacing: 2, color: colors.wine },
  codeInput: {
    fontFamily: fonts.semibold,
    fontSize: 24,
    letterSpacing: 10,
    textAlign: 'center',
    color: colors.ink,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    marginTop: 12,
    backgroundColor: colors.cream,
  },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.danger, marginTop: 8 },
  resend: { fontFamily: fonts.semibold, fontSize: 13, color: colors.wine },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E6F3EC',
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 14,
  },
  verifiedText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.success },
});
