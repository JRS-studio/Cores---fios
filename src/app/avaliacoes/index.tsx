import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, ScreenHeader, Stars } from '@/components/ui';
import { useFeedback, type Feedback } from '@/features/feedback/FeedbackContext';
import { colors, fonts, radius, shadow } from '@/theme';
import { formatShortDate } from '@/utils/format';

type Filter = 'todas' | 'foto' | '5';

export default function AvaliacoesScreen() {
  const insets = useSafeAreaInsets();
  const { feedbacks, average, removeFeedback } = useFeedback();
  const { publicada } = useLocalSearchParams<{ publicada?: string }>();
  const [filter, setFilter] = useState<Filter>('todas');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const visible = feedbacks.filter((f) => (filter === 'foto' ? !!f.photoUri : filter === '5' ? f.rating === 5 : true));
  const counts = [5, 4, 3, 2, 1].map((n) => ({ n, count: feedbacks.filter((f) => f.rating === n).length }));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
    >
      <ScreenHeader title="Avaliações" subtitle="O que as clientes dizem do atendimento" />

      {publicada && (
        <View style={styles.success}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={styles.successText}>Avaliação publicada. Obrigada pelo carinho!</Text>
        </View>
      )}

      <View style={styles.summary}>
        <View style={styles.summaryScore}>
          <Text style={styles.average}>{feedbacks.length ? average.toFixed(1).replace('.', ',') : '–'}</Text>
          <Stars value={average} size={18} />
          <Text style={styles.count}>
            {feedbacks.length} {feedbacks.length === 1 ? 'avaliação' : 'avaliações'}
          </Text>
        </View>
        <View style={styles.bars}>
          {counts.map(({ n, count }) => (
            <View key={n} style={styles.barRow}>
              <Text style={styles.barLabel}>{n}</Text>
              <Ionicons name="star" size={11} color="#E0A526" />
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${feedbacks.length ? (count / feedbacks.length) * 100 : 0}%` }]} />
              </View>
              <Text style={styles.barCount}>{count}</Text>
            </View>
          ))}
        </View>
      </View>

      <Button label="Deixar minha avaliação" icon="create-outline" onPress={() => router.push('/avaliacoes/nova')} style={{ marginTop: 16 }} />

      {feedbacks.length > 0 && (
        <View style={styles.filters}>
          {(
            [
              ['todas', 'Todas'],
              ['foto', 'Com foto'],
              ['5', '5 estrelas'],
            ] as const
          ).map(([id, label]) => (
            <Pressable key={id} style={[styles.filter, filter === id && styles.filterActive]} onPress={() => setFilter(id)}>
              <Text style={[styles.filterText, filter === id && styles.filterTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {feedbacks.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.wine} />
          </View>
          <Text style={styles.emptyTitle}>Ainda não há avaliações</Text>
          <Text style={styles.emptyText}>
            Depois do atendimento, a cliente envia a foto das unhas prontas, dá de 1 a 5 estrelas e deixa um comentário,
            com o nome dela ou de forma anônima.
          </Text>
        </View>
      ) : visible.length === 0 ? (
        <Text style={styles.emptyText}>Nenhuma avaliação neste filtro.</Text>
      ) : (
        visible.map((f) => (
          <FeedbackCard
            key={f.id}
            feedback={f}
            confirming={confirmId === f.id}
            onAskRemove={() => setConfirmId(f.id)}
            onCancel={() => setConfirmId(null)}
            onRemove={() => {
              removeFeedback(f.id);
              setConfirmId(null);
            }}
          />
        ))
      )}
    </ScrollView>
  );
}

function FeedbackCard({
  feedback: f,
  confirming,
  onAskRemove,
  onCancel,
  onRemove,
}: {
  feedback: Feedback;
  confirming: boolean;
  onAskRemove: () => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.card}>
      {f.photoUri && <Image source={{ uri: f.photoUri }} style={styles.photo} resizeMode="cover" accessibilityLabel="Foto do resultado" />}
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={[styles.avatar, !f.displayName && styles.avatarAnon]}>
            {f.displayName ? (
              <Text style={styles.avatarText}>{f.displayName.trim()[0]?.toUpperCase()}</Text>
            ) : (
              <Ionicons name="person" size={16} color={colors.muted} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{f.displayName ?? 'Cliente anônima'}</Text>
            <Text style={styles.date}>{formatShortDate(f.createdAt)}</Text>
          </View>
          <Stars value={f.rating} size={15} />
        </View>
        {f.service && (
          <View style={styles.serviceTag}>
            <Text style={styles.serviceTagText}>{f.service}</Text>
          </View>
        )}
        {!!f.comment && <Text style={styles.comment}>{f.comment}</Text>}

        {confirming ? (
          <View style={styles.confirm}>
            <Text style={styles.confirmText}>Remover esta avaliação?</Text>
            <Pressable onPress={onCancel} hitSlop={6}>
              <Text style={styles.confirmCancel}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={onRemove} hitSlop={6}>
              <Text style={styles.confirmRemove}>Remover</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={onAskRemove} hitSlop={6} style={styles.removeLink}>
            <Text style={styles.removeText}>Remover</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  success: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E6F3EC',
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 14,
  },
  successText: { fontFamily: fonts.medium, fontSize: 13, color: colors.success, flex: 1 },
  summary: {
    flexDirection: 'row',
    gap: 18,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 18,
    ...shadow,
  },
  summaryScore: { alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 96 },
  average: { fontFamily: fonts.display, fontSize: 44, color: colors.ink, lineHeight: 50 },
  count: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  bars: { flex: 1, gap: 6, justifyContent: 'center' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink, width: 10, textAlign: 'right' },
  barTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: colors.blush, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: '#E0A526' },
  barCount: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, width: 20, textAlign: 'right' },
  filters: { flexDirection: 'row', gap: 8, marginTop: 22, marginBottom: 4 },
  filter: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  filterActive: { backgroundColor: colors.plum, borderColor: colors.plum },
  filterText: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink },
  filterTextActive: { color: colors.white },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 12 },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, marginBottom: 6 },
  emptyText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.muted, textAlign: 'center', marginTop: 12 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    marginTop: 14,
    overflow: 'hidden',
    ...shadow,
  },
  photo: { width: '100%', aspectRatio: 4 / 5, backgroundColor: colors.blush },
  cardBody: { padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.roseGoldLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarAnon: { backgroundColor: colors.blush },
  avatarText: { fontFamily: fonts.display, fontSize: 16, color: colors.plum },
  name: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  date: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  serviceTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.blush,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 10,
  },
  serviceTagText: { fontFamily: fonts.medium, fontSize: 11, color: colors.wine },
  comment: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.ink, marginTop: 10 },
  removeLink: { alignSelf: 'flex-end', marginTop: 8 },
  removeText: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10, justifyContent: 'flex-end' },
  confirmText: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink, flex: 1 },
  confirmCancel: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  confirmRemove: { fontFamily: fonts.semibold, fontSize: 12, color: colors.wine },
});
