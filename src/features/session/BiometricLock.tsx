import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { biometricAvailable, biometricEnabled, disableBiometric, enableBiometric, verifyBiometric } from '@/features/session/biometric';
import { useSession } from '@/features/session/SessionContext';
import { useSettings } from '@/features/settings/SettingsContext';
import { colors, fonts, radius } from '@/theme';

// Depois de quanto tempo fora do app ele trava de novo.
const RELOCK_MS = 2 * 60 * 1000;

// Tela que cobre o app da profissional até ela passar o rosto ou a digital.
export function BiometricLock() {
  const { ready, role, signOut } = useSession();
  const { settings } = useSettings();
  const [locked, setLocked] = useState(biometricEnabled);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tried = useRef(false);

  const unlock = useCallback(async () => {
    setBusy(true);
    setError(null);
    const ok = await verifyBiometric();
    setBusy(false);
    if (ok) setLocked(false);
    else setError('Não foi possível confirmar. Toque para tentar de novo.');
  }, []);

  // Trava de novo quando ela volta ao app depois de um tempo fora.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const doc = (globalThis as { document?: Document }).document;
    if (!doc) return;
    let hiddenAt = 0;
    const onChange = () => {
      if (doc.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > RELOCK_MS && biometricEnabled()) {
        tried.current = false;
        setLocked(true);
      }
    };
    doc.addEventListener('visibilitychange', onChange);
    return () => doc.removeEventListener('visibilitychange', onChange);
  }, []);

  const show = locked && (!ready || role === 'profissional');

  // Já pede a biometria ao abrir (se o celular não deixar sem um toque, fica o botão).
  useEffect(() => {
    if (show && ready && !tried.current) {
      tried.current = true;
      unlock();
    }
  }, [show, ready, unlock]);

  if (!show) return null;

  return (
    <View style={styles.cover} accessibilityViewIsModal>
      <Text style={styles.studio}>{settings.studioName}</Text>
      <View style={styles.icon}>
        <Ionicons name="finger-print" size={46} color={colors.roseGold} />
      </View>
      <Text style={styles.title}>Olá, {settings.professionalName}</Text>
      <Text style={styles.text}>Use o rosto ou a digital para entrar.</Text>
      {error && <Text style={styles.lockError}>{error}</Text>}
      <Button label={busy ? 'Aguardando…' : 'Entrar com biometria'} icon="finger-print" variant="secondary" onPress={unlock} disabled={busy || !ready} style={styles.button} />
      <Text
        style={styles.link}
        onPress={async () => {
          await signOut();
          setLocked(false);
          router.push('/entrar');
        }}
      >
        Entrar com login e senha
      </Text>
    </View>
  );
}

// Botão para ligar ou desligar a entrada pela biometria (Ajustes e logo depois do login).
export function BiometricToggle({ highlight }: { highlight?: boolean }) {
  const { role } = useSession();
  const { settings } = useSettings();
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(biometricEnabled);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    biometricAvailable().then(setAvailable);
  }, []);

  if (role !== 'profissional' || !available) return null;

  if (enabled) {
    return (
      <View style={styles.toggle}>
        <Ionicons name="finger-print" size={20} color={colors.success} />
        <Text style={styles.toggleText}>Entrada pela biometria ativada neste celular.</Text>
        <Text
          style={styles.toggleLink}
          onPress={() => {
            disableBiometric();
            setEnabled(false);
          }}
        >
          Desativar
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.toggleBox, highlight && styles.toggleBoxHighlight]}>
      <Text style={styles.boxText}>Entre só com o rosto ou a digital nas próximas vezes, sem digitar a senha.</Text>
      {message && <Text style={styles.error}>{message}</Text>}
      <Button
        label="Ativar biometria"
        icon="finger-print"
        variant={highlight ? 'primary' : 'secondary'}
        onPress={async () => {
          const err = await enableBiometric(settings.professionalName);
          setMessage(err);
          if (!err) setEnabled(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    ...StyleSheet.absoluteFill,
    zIndex: 200,
    backgroundColor: colors.plum,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  studio: { fontFamily: fonts.displayItalic, fontSize: 24, color: colors.white, marginBottom: 36 },
  icon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: colors.roseGold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: { fontFamily: fonts.semibold, fontSize: 20, color: colors.white },
  text: { fontFamily: fonts.regular, fontSize: 14, color: colors.white, opacity: 0.8, marginTop: 6, textAlign: 'center' },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.danger, marginTop: 10, textAlign: 'center' },
  lockError: { fontFamily: fonts.medium, fontSize: 12, color: colors.roseGoldLight, marginTop: 10, textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: 28, backgroundColor: colors.blush },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.roseGold, marginTop: 18, padding: 6 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch' },
  toggleText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  toggleLink: { fontFamily: fonts.semibold, fontSize: 13, color: colors.wine, padding: 4 },
  boxText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.ink },
  toggleBox: { gap: 10, alignSelf: 'stretch', borderRadius: radius.md, padding: 14, backgroundColor: colors.cream },
  toggleBoxHighlight: { borderWidth: 1, borderColor: colors.roseGold },
});
