import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';
import { brl } from '@/utils/format';

const CHART_HEIGHT = 120;

// Barras verticais de uma série (ex.: entradas por dia). Toque numa barra mostra o valor.
export function DailyBars({
  values,
  labelFor,
  color,
  emptyText,
}: {
  values: number[];
  labelFor: (index: number) => string;
  color: string;
  emptyText: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(...values, 0);
  if (max === 0) return <Text style={styles.empty}>{emptyText}</Text>;
  const ticks = [0, Math.floor((values.length - 1) / 2), values.length - 1];
  const active = selected ?? values.reduce((best, v, i) => (v > values[best] ? i : best), 0);

  return (
    <View>
      <Text style={styles.tooltip}>
        <Text style={styles.tooltipValue}>{brl(values[active])}</Text>
        {`  ${labelFor(active)}${selected === null ? ' · melhor dia' : ''}`}
      </Text>
      <View style={styles.plot}>
        <View style={[styles.grid, { top: 0 }]} />
        <View style={[styles.grid, { top: CHART_HEIGHT / 2 }]} />
        <Text style={[styles.gridLabel, { top: -2 }]}>{brl(max)}</Text>
        <View style={styles.bars}>
          {values.map((v, i) => (
            <Pressable
              key={i}
              style={styles.barHit}
              onPress={() => setSelected(i === selected ? null : i)}
              accessibilityLabel={`${labelFor(i)}: ${brl(v)}`}
            >
              <View
                style={[
                  styles.bar,
                  {
                    height: v > 0 ? Math.max(3, (v / max) * CHART_HEIGHT) : 0,
                    backgroundColor: color,
                    opacity: selected === null || selected === i ? 1 : 0.35,
                  },
                ]}
              />
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.axis}>
        {ticks.map((t) => (
          <Text key={t} style={styles.axisLabel}>
            {labelFor(t)}
          </Text>
        ))}
      </View>
    </View>
  );
}

// Barras horizontais por categoria, com o valor em texto ao lado (identidade nunca só pela cor).
export function CategoryBars({ data, color, emptyText }: { data: { label: string; value: number }[]; color: string; emptyText: string }) {
  const rows = data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  const max = Math.max(...rows.map((r) => r.value), 0);
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (!rows.length) return <Text style={styles.empty}>{emptyText}</Text>;
  return (
    <View style={{ gap: 10 }}>
      {rows.map((r) => (
        <View key={r.label}>
          <View style={styles.hRowTop}>
            <Text style={styles.hLabel}>{r.label}</Text>
            <Text style={styles.hValue}>
              {brl(r.value)} <Text style={styles.hShare}>{Math.round((r.value / total) * 100)}%</Text>
            </Text>
          </View>
          <View style={styles.hTrack}>
            <View style={[styles.hBar, { width: `${(r.value / max) * 100}%`, backgroundColor: color }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, paddingVertical: 12 },
  tooltip: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginBottom: 10 },
  tooltipValue: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  plot: { height: CHART_HEIGHT, justifyContent: 'flex-end' },
  grid: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  gridLabel: { position: 'absolute', right: 0, fontFamily: fonts.regular, fontSize: 10, color: colors.muted, backgroundColor: colors.white, paddingLeft: 4 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, borderBottomWidth: 1, borderBottomColor: colors.muted },
  barHit: { flex: 1, height: '100%', justifyContent: 'flex-end', paddingHorizontal: 1 },
  bar: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisLabel: { fontFamily: fonts.regular, fontSize: 10, color: colors.muted },
  hRowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  hLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  hValue: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  hShare: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  hTrack: { height: 8, borderRadius: 4, backgroundColor: colors.blush, overflow: 'hidden' },
  hBar: { height: '100%', borderRadius: 4 },
});
