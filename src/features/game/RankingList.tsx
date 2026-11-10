import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { RankingRow } from '@/features/game/GameContext';
import { colors, fonts, radius } from '@/theme';
import { formatPhone } from '@/utils/format';
import { openExternal } from '@/utils/openExternal';

const MEDAL = ['#d9a93a', '#a9b0ba', '#b8764a'];

// Lista do ranking: as 5 primeiras e, se for o caso, a posição de quem está vendo.
// Para a profissional, mostra também o WhatsApp de cada jogadora (para avisar a vencedora).
export function RankingList({ rows, owner, empty }: { rows: RankingRow[]; owner?: boolean; empty: string }) {
  if (!rows.length) return <Text style={styles.empty}>{empty}</Text>;
  return (
    <View style={{ gap: 8 }}>
      {rows.map((r) => (
        <View key={`${r.pos}-${r.name}`} style={[styles.row, r.mine && styles.mine]}>
          <View style={[styles.pos, r.pos <= 3 && { backgroundColor: MEDAL[r.pos - 1] }]}>
            <Text style={[styles.posText, r.pos <= 3 && { color: '#2b1220' }]}>{r.pos}º</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name} numberOfLines={1}>
              {r.name}
              {r.mine ? ' (você)' : ''}
            </Text>
            {owner && r.phone ? <Text style={styles.sub}>{formatPhone(r.phone.replace(/^55/, ''))}</Text> : null}
          </View>
          <Text style={styles.pts}>
            {r.best}
            <Text style={styles.ptsUnit}> pts</Text>
          </Text>
          {owner && r.phone && r.pos === 1 ? (
            <Pressable
              onPress={() => openExternal(`https://wa.me/${r.phone}`)}
              accessibilityRole="button"
              accessibilityLabel={`Falar com ${r.name} no WhatsApp`}
              hitSlop={8}
            >
              <Ionicons name="logo-whatsapp" size={22} color={colors.success} />
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mine: { borderColor: colors.roseGold, borderWidth: 2 },
  pos: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blush },
  posText: { fontFamily: fonts.display, fontSize: 15, color: colors.muted },
  name: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  pts: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  ptsUnit: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
});
