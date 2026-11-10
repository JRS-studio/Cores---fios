import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { createElement, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { useClients } from '@/features/clients/ClientsContext';
import { isOpen, rankingName, useGame } from '@/features/game/GameContext';
import { WEB_URL } from '@/features/session/ClientLink';
import { useSession } from '@/features/session/SessionContext';
import { colors, fonts } from '@/theme';
import { openExternal } from '@/utils/openExternal';

// Endereço do jogo (public/jogo), ao lado do manifesto do site (no GitHub Pages fica no subcaminho).
function gameUrl(query: string) {
  const g = globalThis as { document?: Document; location?: Location };
  const manifest = g.document?.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  const base = manifest ? new URL('.', manifest.href).href : `${g.location?.origin ?? ''}/`;
  return `${base}jogo/esmalte-express.html?${query}`;
}

type GameMessage = { source?: string; type?: string; mode?: string; score?: number };

// A partida roda numa página própria (o jogo) dentro do app. No fim, o jogo manda a pontuação;
// o app salva no ranking com o login da cliente (no modo teste da profissional, não salva nada).
export default function PartidaScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ modo?: string }>();
  const { canManage, role, phone } = useSession();
  const { active, latest, saveScore } = useGame();
  const { findByPhone } = useClients();
  const [frameEl, setFrameEl] = useState<HTMLIFrameElement | null>(null);

  // Só vale ponto para cliente logada com o jogo aberto; o resto é sempre teste.
  const campaign = canManage ? latest : active;
  const valendo = params.modo === 'valendo' && !canManage && role === 'cliente' && !!active && isOpen(active) && !!phone;
  const mode = valendo ? 'valendo' : 'teste';
  const query = `modo=${mode}&premio=${encodeURIComponent(campaign?.prize ?? '')}`;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const w = globalThis as unknown as Window;
    const reply = (text: string) => frameEl?.contentWindow?.postMessage({ source: 'cores-app', type: 'status', text }, '*');
    const onMessage = async (e: MessageEvent<GameMessage>) => {
      if (!frameEl || e.source !== frameEl.contentWindow || e.data?.source !== 'esmalte-express' || e.data.type !== 'result') return;
      if (!valendo || !active || !phone) return;
      const name = rankingName(findByPhone(phone)?.name ?? 'Cliente');
      const result = await saveScore(active, phone, name, Math.max(0, Math.floor(Number(e.data.score) || 0)));
      reply(
        result.ok
          ? result.position
            ? `Salvo! Você está em ${result.position}º lugar.`
            : 'Salvo no ranking!'
          : 'Não foi possível salvar agora. Confira a internet e jogue de novo.',
      );
    };
    w.addEventListener('message', onMessage);
    return () => w.removeEventListener('message', onMessage);
  }, [frameEl, valendo, active, phone, findByPhone, saveScore]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/jogo'))} style={styles.back} accessibilityLabel="Voltar" hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>Esmalte Express</Text>
        <View style={[styles.badge, valendo ? styles.badgeOn : styles.badgeTest]}>
          <Text style={[styles.badgeText, valendo && { color: '#3a2706' }]}>{valendo ? 'Valendo' : 'Teste'}</Text>
        </View>
      </View>
      {Platform.OS === 'web' ? (
        createElement('iframe', {
          ref: setFrameEl,
          src: gameUrl(query),
          title: 'Esmalte Express',
          style: { flex: 1, width: '100%', border: 0, backgroundColor: 'transparent' },
          allow: 'autoplay',
        })
      ) : (
        <View style={styles.native}>
          <Text style={styles.nativeText}>O jogo abre no navegador do celular.</Text>
          <Button label="Abrir o jogo" icon="open-outline" onPress={() => openExternal(`${WEB_URL}/jogo`)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 8 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  badgeOn: { backgroundColor: '#e2bd5a' },
  badgeTest: { backgroundColor: colors.blush },
  badgeText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.wine },
  native: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  nativeText: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: 'center' },
});
