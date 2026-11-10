import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, ScreenHeader, SectionTitle } from '@/components/ui';
import { isOpen, useGame, type RankingRow } from '@/features/game/GameContext';
import { RankingList } from '@/features/game/RankingList';
import { useSession } from '@/features/session/SessionContext';
import { colors, fonts, radius } from '@/theme';
import { fromISODate, isoToBr, today } from '@/utils/date';

// Página do jogo valendo prêmio: prêmio, prazo, botão de jogar e o Top 5.
// A profissional vê também o jogo em rascunho e joga em modo teste (a pontuação dela não entra no ranking).
export default function JogoScreen() {
  const insets = useSafeAreaInsets();
  const { canManage, role, phone } = useSession();
  const { active, latest, ranking, ready } = useGame();
  const campaign = canManage ? latest : active;
  const [rows, setRows] = useState<RankingRow[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (campaign) ranking(campaign, phone, false).then((r) => alive && setRows(r));
      return () => {
        alive = false;
      };
    }, [campaign, phone, ranking]),
  );

  if (!campaign) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 12, paddingHorizontal: 20 }]}>
        <ScreenHeader title="Jogo" />
        <Text style={styles.muted}>
          {!ready ? 'Carregando…' : canManage ? 'Você ainda não criou um jogo.' : 'Nenhum jogo valendo prêmio no momento. Fique de olho no feed!'}
        </Text>
        {canManage && ready && <Button label="Criar o jogo" icon="add" onPress={() => router.push('/ajustes/jogo')} style={{ marginTop: 16 }} />}
      </View>
    );
  }

  const open = isOpen(campaign);
  const daysLeft = Math.round((fromISODate(campaign.endsOn).getTime() - fromISODate(today()).getTime()) / 86400000);
  const endsText = !open
    ? campaign.status === 'rascunho'
      ? 'Rascunho: só você vê este jogo'
      : campaign.status === 'encerrado' || campaign.endsOn < today()
        ? 'Jogo encerrado'
        : `Começa em ${isoToBr(campaign.startsOn).slice(0, 5)}`
    : daysLeft === 0
      ? 'Último dia para jogar!'
      : `Termina em ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}`;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20, gap: 14 }}>
      <ScreenHeader title="Jogo valendo prêmio" subtitle={canManage ? 'Como as clientes veem' : 'Jogue, pontue e fique em 1º'} />

      <LinearGradient colors={['#4a1d33', '#2b1220']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Text style={styles.eyebrow}>{endsText}</Text>
        <Text style={styles.title}>
          Esmalte <Text style={styles.titleItalic}>Express</Text>
        </Text>
        <View style={styles.prizeRow}>
          <View style={styles.medal}>
            <Text style={styles.medalText}>1º</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.prizeLabel}>Prêmio da 1ª colocada</Text>
            <Text style={styles.prize}>{campaign.prize}</Text>
          </View>
        </View>
        <Text style={styles.period}>
          De {isoToBr(campaign.startsOn).slice(0, 5)} a {isoToBr(campaign.endsOn).slice(0, 5)} · vale a sua maior pontuação
        </Text>
      </LinearGradient>

      {canManage ? (
        <>
          <Button label="Jogar em modo teste" icon="game-controller-outline" onPress={() => router.push({ pathname: '/jogo/partida', params: { modo: 'teste' } })} />
          <Text style={styles.note}>No modo teste a sua pontuação não vai para o ranking.</Text>
          <Button label="Datas, prêmio e publicação" icon="settings-outline" variant="secondary" onPress={() => router.push('/ajustes/jogo')} />
        </>
      ) : role === 'cliente' ? (
        <Button label="Jogar agora · 60s" icon="play" onPress={() => router.push({ pathname: '/jogo/partida', params: { modo: 'valendo' } })} disabled={!open} />
      ) : (
        <>
          <Button label="Entrar com WhatsApp para jogar" icon="log-in-outline" onPress={() => router.push('/entrar')} />
          <Text style={styles.note}>O ranking é das clientes cadastradas: entre com seu WhatsApp para a pontuação valer.</Text>
        </>
      )}

      <SectionTitle>Ranking</SectionTitle>
      {rows === null ? (
        <Text style={styles.muted}>Carregando o ranking…</Text>
      ) : (
        <RankingList rows={rows} empty="Ninguém jogou ainda. A primeira partida já vale o 1º lugar!" />
      )}

      <View style={styles.rules}>
        <Ionicons name="information-circle-outline" size={18} color={colors.wine} />
        <Text style={styles.rulesText}>
          Pinte cada unha com a cor da ficha da cliente. São 10 cores e os vidros mudam de lugar a cada mão. Acertos seguidos multiplicam os pontos; erro
          tira 2 segundos. Quem estiver em 1º no fim do prazo ganha.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  muted: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, textAlign: 'center' },
  hero: { borderRadius: radius.lg, padding: 22, gap: 10 },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: '#e8cdb5' },
  title: { fontFamily: fonts.display, fontSize: 38, color: '#fff', lineHeight: 42 },
  titleItalic: { fontFamily: fonts.displayItalic, color: '#e8cdb5' },
  prizeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  medal: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e2bd5a', alignItems: 'center', justifyContent: 'center' },
  medalText: { fontFamily: fonts.display, fontSize: 17, color: '#3a2706' },
  prizeLabel: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  prize: { fontFamily: fonts.semibold, fontSize: 16, color: '#fff' },
  period: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  rules: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: colors.blush },
  rulesText: { flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.ink },
});
