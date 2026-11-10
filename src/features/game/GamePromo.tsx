import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { loadJson, saveJson } from '@/data/storage';
import { isOpen, useGame } from '@/features/game/GameContext';
import { useSession } from '@/features/session/SessionContext';
import { colors, fonts, radius } from '@/theme';
import { isoToBr, today } from '@/utils/date';

const until = (iso: string) => isoToBr(iso).slice(0, 5);

// Tela inicial: para a cliente, botão grande para o jogo aberto; para a profissional, o andamento do jogo.
export function GameHomeCard() {
  const { canManage } = useSession();
  const { active, latest } = useGame();

  if (canManage) {
    const c = latest && latest.status !== 'encerrado' ? latest : null;
    const label = !c
      ? 'Crie um jogo valendo prêmio para as clientes'
      : c.status === 'rascunho'
        ? 'Jogo em rascunho: teste e publique quando quiser'
        : isOpen(c)
          ? `Jogo no ar até ${until(c.endsOn)} · prêmio: ${c.prize}`
          : c.startsOn > today()
            ? `Jogo publicado: abre em ${until(c.startsOn)}`
            : 'Jogo fora do prazo: veja o resultado';
    return (
      <Pressable style={styles.ownerCard} onPress={() => router.push('/ajustes/jogo')} accessibilityRole="button">
        <View style={styles.ownerIcon}>
          <Ionicons name="game-controller-outline" size={20} color={colors.wine} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.ownerTitle}>Esmalte Express</Text>
          <Text style={styles.ownerText}>{label}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
    );
  }

  if (!active) return null;
  return (
    <Pressable onPress={() => router.push('/jogo')} accessibilityRole="button" accessibilityLabel={`Jogar Esmalte Express. Prêmio: ${active.prize}`} style={styles.wrap}>
      <LinearGradient colors={['#4a1d33', '#2b1220']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.clientCard}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.eyebrow}>Jogue e ganhe · até {until(active.endsOn)}</Text>
          <Text style={styles.clientTitle}>
            Esmalte <Text style={styles.italic}>Express</Text>
          </Text>
          <Text style={styles.clientText} numberOfLines={2}>
            Prêmio: {active.prize}
          </Text>
        </View>
        <View style={styles.playBtn}>
          <Ionicons name="play" size={18} color="#2b1220" />
          <Text style={styles.playText}>Jogar</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

// Anúncio fixado no topo do feed enquanto houver um jogo aberto (para todas, inclusive sem login).
export function GamePinnedPost() {
  const { active } = useGame();
  if (!active) return null;
  return (
    <Pressable onPress={() => router.push('/jogo')} style={styles.pinned} accessibilityRole="button" accessibilityLabel={`Anúncio fixado: jogo valendo ${active.prize}`}>
      <View style={styles.pinRow}>
        <Ionicons name="pin" size={14} color={colors.wine} />
        <Text style={styles.pinText}>Fixado pelo studio</Text>
      </View>
      <LinearGradient colors={['#4a1d33', '#2b1220']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pinnedBody}>
        <Text style={styles.eyebrow}>Promoção · de {until(active.startsOn)} a {until(active.endsOn)}</Text>
        <Text style={styles.pinnedTitle}>
          Jogue o Esmalte <Text style={styles.italic}>Express</Text> e ganhe {active.prize.toLowerCase()}
        </Text>
        <Text style={styles.clientText}>Pinte as unhas no pedido certo em 60 segundos. Quem estiver em 1º no ranking no fim do prazo ganha.</Text>
        <View style={[styles.playBtn, { alignSelf: 'flex-start', marginTop: 4 }]}>
          <Ionicons name="trophy-outline" size={16} color="#2b1220" />
          <Text style={styles.playText}>Jogar e ver o ranking</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

// Aviso da promoção: aparece uma vez por jogo para as clientes (e visitantes) ao abrir o app.
export function GamePromoNotice() {
  const { canManage } = useSession();
  const { active } = useGame();
  const [show, setShow] = useState(false);
  const key = active ? `cores:jogo-aviso:${active.id}` : null;

  useEffect(() => {
    let alive = true;
    if (!key || canManage) return;
    loadJson<boolean>(key, false).then((seen) => alive && !seen && setShow(true));
    return () => {
      alive = false;
    };
  }, [key, canManage]);

  if (!active || canManage) return null;
  const close = (go: boolean) => {
    setShow(false);
    if (key) saveJson(key, true);
    if (go) router.push('/jogo');
  };
  return (
    <Modal visible={show} transparent animationType="fade" onRequestClose={() => close(false)}>
      <View style={styles.backdrop}>
        <LinearGradient colors={['#4a1d33', '#2b1220']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modal}>
          <View style={styles.medal}>
            <Ionicons name="trophy" size={26} color="#3a2706" />
          </View>
          <Text style={styles.eyebrow}>Promoção nova no studio</Text>
          <Text style={styles.modalTitle}>
            Esmalte <Text style={styles.italic}>Express</Text>
          </Text>
          <Text style={styles.modalText}>
            Jogue até {until(active.endsOn)} e fique em 1º no ranking para ganhar: {active.prize}.
          </Text>
          <Pressable style={styles.modalBtn} onPress={() => close(true)} accessibilityRole="button">
            <Text style={styles.modalBtnText}>Jogar agora</Text>
          </Pressable>
          <Pressable onPress={() => close(false)} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.later}>Depois</Text>
          </Pressable>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 12, marginTop: 12 },
  clientCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, padding: 16 },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 10.5, letterSpacing: 1.4, textTransform: 'uppercase', color: '#e8cdb5' },
  clientTitle: { fontFamily: fonts.display, fontSize: 22, color: '#fff' },
  italic: { fontFamily: fonts.displayItalic, color: '#e8cdb5' },
  clientText: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: 'rgba(255,255,255,0.8)' },
  playBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e8cdb5', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 9 },
  playText: { fontFamily: fonts.semibold, fontSize: 13, color: '#2b1220' },
  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 12,
    marginTop: 12,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ownerIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center' },
  ownerTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  ownerText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  pinned: { marginHorizontal: 12, marginBottom: 14, gap: 6 },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  pinText: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.wine },
  pinnedBody: { borderRadius: radius.md, padding: 18, gap: 8 },
  pinnedTitle: { fontFamily: fonts.display, fontSize: 21, lineHeight: 27, color: '#fff' },
  backdrop: { flex: 1, backgroundColor: 'rgba(20,8,14,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modal: { width: '100%', maxWidth: 380, borderRadius: radius.lg, padding: 24, alignItems: 'center', gap: 10 },
  medal: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#e2bd5a', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontFamily: fonts.display, fontSize: 32, color: '#fff' },
  modalText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  modalBtn: { alignSelf: 'stretch', backgroundColor: '#e8cdb5', borderRadius: 99, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  modalBtnText: { fontFamily: fonts.semibold, fontSize: 15, color: '#2b1220' },
  later: { fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.75)', paddingVertical: 6 },
});
