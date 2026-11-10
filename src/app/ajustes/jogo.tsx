import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Field, OwnerOnly, ScreenHeader, SectionTitle } from '@/components/ui';
import { isOpen, useGame, type GameCampaign, type RankingRow } from '@/features/game/GameContext';
import { RankingList } from '@/features/game/RankingList';
import { useSession } from '@/features/session/SessionContext';
import { colors, fonts, radius } from '@/theme';
import { addDays, brToIso, isoToBr, today } from '@/utils/date';
import { formatDate } from '@/utils/format';
import { newId } from '@/utils/id';

export default function JogoAjustesScreen() {
  const { canManage } = useSession();
  return canManage ? <Content /> : <OwnerOnly title="Jogo valendo prêmio" />;
}

const STATUS_TEXT: Record<GameCampaign['status'], string> = {
  rascunho: 'Rascunho · só você vê',
  publicado: 'Publicado para as clientes',
  encerrado: 'Encerrado',
};

function Content() {
  const insets = useSafeAreaInsets();
  const { latest, saveCampaign, ranking } = useGame();
  // Jogo encerrado: o formulário começa um novo; senão edita o atual.
  const editing = latest && latest.status !== 'encerrado' ? latest : null;
  const [form, setForm] = useState(() => ({
    prize: editing?.prize ?? '',
    start: isoToBr(editing?.startsOn ?? today()),
    end: isoToBr(editing?.endsOn ?? addDays(today(), 6)),
  }));
  const [tried, setTried] = useState(false);
  const [confirm, setConfirm] = useState<'publicar' | 'encerrar' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<RankingRow[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (latest) ranking(latest, null, true).then((r) => alive && setRows(r));
      return () => {
        alive = false;
      };
    }, [latest, ranking]),
  );

  const startIso = brToIso(form.start);
  const endIso = brToIso(form.end);
  const errors = {
    prize: form.prize.trim().length < 3 ? 'Escreva o prêmio (ex.: Esmaltação em gel).' : null,
    start: !startIso ? 'Use DD/MM/AAAA.' : null,
    end: !endIso ? 'Use DD/MM/AAAA.' : startIso && endIso < startIso ? 'Precisa ser depois do início.' : null,
  };
  const valid = !errors.prize && !errors.start && !errors.end;
  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setNotice(null);
  };

  async function save(status?: GameCampaign['status'], message?: string) {
    setTried(true);
    if (!valid || !startIso || !endIso || busy) return false;
    if (status === 'publicado' && endIso < today()) {
      setNotice('A data final já passou. Escolha uma data a partir de hoje para publicar.');
      return false;
    }
    setBusy(true);
    const next: GameCampaign = {
      id: editing?.id ?? newId(),
      createdAt: editing?.createdAt ?? new Date().toISOString(),
      title: 'Esmalte Express',
      prize: form.prize.trim(),
      startsOn: startIso,
      endsOn: endIso,
      status: status ?? editing?.status ?? 'rascunho',
    };
    const ok = await saveCampaign(next);
    setBusy(false);
    setConfirm(null);
    setNotice(ok ? (message ?? 'Salvo.') : 'Não foi possível salvar agora. Confira a internet e tente de novo.');
    return ok;
  }

  const status = editing?.status ?? 'rascunho';
  const live = editing ? isOpen(editing) : false;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.screen}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
      >
        <ScreenHeader title="Jogo valendo prêmio" subtitle="Esmalte Express: as clientes jogam e a 1ª colocada ganha" />

        <View style={[styles.status, status === 'publicado' && styles.statusOn]}>
          <Text style={styles.statusText}>{editing ? STATUS_TEXT[status] : 'Novo jogo (rascunho)'}</Text>
          {status === 'publicado' && editing && (
            <Text style={styles.statusSub}>
              {live ? 'Aberto agora: aparece fixado no feed e na tela inicial das clientes.' : editing.startsOn > today() ? `Abre em ${isoToBr(editing.startsOn)}.` : 'Fora do prazo.'}
            </Text>
          )}
        </View>

        <SectionTitle>Prêmio e datas</SectionTitle>
        <Field label="Prêmio da 1ª colocada" value={form.prize} onChangeText={(t) => set('prize', t)} placeholder="Ex.: Esmaltação em gel grátis" maxLength={80} error={tried ? errors.prize : null} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Início" value={form.start} onChangeText={(t) => set('start', formatDate(t))} keyboardType="number-pad" placeholder="DD/MM/AAAA" error={tried ? errors.start : null} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Fim" value={form.end} onChangeText={(t) => set('end', formatDate(t))} keyboardType="number-pad" placeholder="DD/MM/AAAA" error={tried ? errors.end : null} />
          </View>
        </View>
        <Text style={styles.hint}>O jogo fica aberto do primeiro minuto do início até 23h59 do dia final. Vence quem estiver em 1º no fim.</Text>

        {notice && <Text style={styles.notice}>{notice}</Text>}

        <View style={{ gap: 10, marginTop: 16 }}>
          <Button label="Salvar" icon="checkmark" variant="secondary" onPress={() => save()} disabled={busy} />
          <Button label="Testar o jogo" icon="game-controller-outline" variant="secondary" onPress={() => router.push({ pathname: '/jogo/partida', params: { modo: 'teste' } })} />
          <Text style={styles.hint}>No teste a sua pontuação não vai para o ranking.</Text>

          {status !== 'publicado' &&
            (confirm === 'publicar' ? (
              <View style={styles.confirm}>
                <Text style={styles.confirmText}>
                  Publicar para as clientes? O anúncio fica fixado no feed, aparece um botão na tela inicial delas e quem tem os avisos ligados recebe uma
                  notificação quando o jogo começar.
                </Text>
                <View style={styles.row}>
                  <Button label="Cancelar" variant="secondary" onPress={() => setConfirm(null)} style={{ flex: 1 }} />
                  <Button label="Publicar" icon="megaphone-outline" onPress={() => save('publicado', 'Publicado! As clientes já podem ver o jogo.')} style={{ flex: 1 }} disabled={busy} />
                </View>
              </View>
            ) : (
              <Button label="Publicar para as clientes" icon="megaphone-outline" onPress={() => { setTried(true); if (valid) setConfirm('publicar'); }} />
            ))}

          {status === 'publicado' &&
            (confirm === 'encerrar' ? (
              <View style={styles.confirm}>
                <Text style={styles.confirmText}>Encerrar o jogo agora? Ninguém mais pontua e o anúncio sai do feed. O ranking continua aqui.</Text>
                <View style={styles.row}>
                  <Button label="Manter" variant="secondary" onPress={() => setConfirm(null)} style={{ flex: 1 }} />
                  <Button label="Encerrar" variant="danger" onPress={() => save('encerrado', 'Jogo encerrado.')} style={{ flex: 1 }} disabled={busy} />
                </View>
              </View>
            ) : (
              <>
                <Button label="Ver como as clientes veem" icon="eye-outline" variant="secondary" onPress={() => router.push('/jogo')} />
                <Button label="Encerrar o jogo" icon="stop-circle-outline" variant="danger" onPress={() => setConfirm('encerrar')} />
              </>
            ))}
        </View>

        {latest && (
          <>
            <SectionTitle hint={latest.status === 'encerrado' ? 'Jogo encerrado: fale com a vencedora pelo WhatsApp.' : 'Atualiza quando você abre esta tela.'}>
              {latest.status === 'encerrado' ? 'Resultado final' : 'Ranking'}
            </SectionTitle>
            {rows === null ? <Text style={styles.hint}>Carregando…</Text> : <RankingList rows={rows} owner empty="Nenhuma cliente jogou ainda." />}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  row: { flexDirection: 'row', gap: 12 },
  hint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 6 },
  notice: { fontFamily: fonts.medium, fontSize: 13, color: colors.wine, marginTop: 12 },
  status: { padding: 14, borderRadius: radius.md, backgroundColor: colors.blush, gap: 2 },
  statusOn: { backgroundColor: '#e6f3ec' },
  statusText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  statusSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  confirm: { gap: 10, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  confirmText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.ink },
});
