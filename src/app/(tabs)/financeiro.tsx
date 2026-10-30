import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppointments, PAYMENT_LABEL, type PaymentMethod } from '@/features/agenda/AppointmentsContext';
import { CategoryBars, DailyBars } from '@/features/finance/charts';
import { useFinance, type Transaction } from '@/features/finance/FinanceContext';
import { useSettings } from '@/features/settings/SettingsContext';
import { colors, fonts, radius, shadow } from '@/theme';
import { daysInMonth, formatDayMonth, monthKey, monthLabel, shiftMonth, today } from '@/utils/date';
import { brl } from '@/utils/format';

type Filter = 'todos' | 'entrada' | 'saida';

export default function FinanceiroScreen() {
  const insets = useSafeAreaInsets();
  const { lancado } = useLocalSearchParams<{ lancado?: string }>();
  const { forMonth, removeTransaction } = useFinance();
  const { appointments } = useAppointments();
  const { settings } = useSettings();
  const [month, setMonth] = useState(monthKey(today()));
  const [filter, setFilter] = useState<Filter>('todos');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const items = forMonth(month);
  const income = items.filter((t) => t.type === 'entrada');
  const expense = items.filter((t) => t.type === 'saida');
  const totalIn = income.reduce((s, t) => s + t.amount, 0);
  const totalOut = expense.reduce((s, t) => s + t.amount, 0);
  const profit = totalIn - totalOut;
  const goalProgress = settings.monthlyGoal > 0 ? Math.min(totalIn / settings.monthlyGoal, 1) : 0;

  const monthAppts = appointments.filter((a) => a.date.startsWith(month));
  const done = monthAppts.filter((a) => a.status === 'concluido');
  const missed = monthAppts.filter((a) => a.status === 'faltou').length;
  const ticket = done.length ? done.reduce((s, a) => s + (a.paidAmount ?? a.price), 0) / done.length : 0;

  const days = daysInMonth(month);
  const perDay = Array.from({ length: days }, (_, i) => {
    const iso = `${month}-${String(i + 1).padStart(2, '0')}`;
    return income.filter((t) => t.date === iso).reduce((s, t) => s + t.amount, 0);
  });
  const byMethod = (Object.keys(PAYMENT_LABEL) as PaymentMethod[]).map((m) => ({
    label: PAYMENT_LABEL[m],
    value: income.filter((t) => t.method === m).reduce((s, t) => s + t.amount, 0),
  }));
  const expenseByCategory = Object.entries(
    expense.reduce<Record<string, number>>((acc, t) => ({ ...acc, [t.category]: (acc[t.category] ?? 0) + t.amount }), {}),
  ).map(([label, value]) => ({ label, value }));
  const topServices = Object.entries(
    done.reduce<Record<string, { count: number; total: number }>>((acc, a) => {
      const cur = acc[a.serviceName] ?? { count: 0, total: 0 };
      return { ...acc, [a.serviceName]: { count: cur.count + 1, total: cur.total + (a.paidAmount ?? a.price) } };
    }, {}),
  )
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5);

  const visible = items.filter((t) => filter === 'todos' || t.type === filter);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 130, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Financeiro</Text>
        <Pressable style={styles.addButton} onPress={() => router.push('/financeiro/novo')} accessibilityLabel="Novo lançamento">
          <Ionicons name="add" size={20} color={colors.white} />
          <Text style={styles.addText}>Lançar</Text>
        </Pressable>
      </View>

      <View style={styles.monthNav}>
        <Pressable onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={10} accessibilityLabel="Mês anterior">
          <Ionicons name="chevron-back" size={22} color={colors.plum} />
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
        <Pressable onPress={() => setMonth(shiftMonth(month, 1))} hitSlop={10} accessibilityLabel="Próximo mês">
          <Ionicons name="chevron-forward" size={22} color={colors.plum} />
        </Pressable>
      </View>

      {lancado && (
        <View style={styles.notice}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={styles.noticeText}>Lançamento salvo.</Text>
        </View>
      )}

      <View style={styles.profitCard}>
        <Text style={styles.cardLabel}>Lucro do mês</Text>
        <View style={styles.profitRow}>
          <Text style={styles.profit}>{brl(profit)}</Text>
          {items.length > 0 && (
            <View style={[styles.profitTag, profit < 0 && styles.profitTagNeg]}>
              <Ionicons name={profit >= 0 ? 'trending-up' : 'trending-down'} size={14} color={profit >= 0 ? colors.success : colors.danger} />
              <Text style={[styles.profitTagText, profit < 0 && { color: colors.danger }]}>{profit >= 0 ? 'No azul' : 'No vermelho'}</Text>
            </View>
          )}
        </View>
        <View style={styles.inOut}>
          <View style={styles.inOutItem}>
            <View style={[styles.marker, { backgroundColor: colors.chartIncome }]} />
            <View>
              <Text style={styles.cardLabel}>Entradas</Text>
              <Text style={styles.inOutValue}>+ {brl(totalIn)}</Text>
            </View>
          </View>
          <View style={styles.inOutItem}>
            <View style={[styles.marker, { backgroundColor: colors.chartExpense }]} />
            <View>
              <Text style={styles.cardLabel}>Saídas</Text>
              <Text style={styles.inOutValue}>− {brl(totalOut)}</Text>
            </View>
          </View>
        </View>
        <View style={styles.goalTrack}>
          <View style={[styles.goalFill, { width: `${goalProgress * 100}%` }]} />
        </View>
        <Text style={styles.goalText}>
          {Math.round(goalProgress * 100)}% da meta de {brl(settings.monthlyGoal)} em entradas
        </Text>
      </View>

      <View style={styles.stats}>
        <Stat icon="checkmark-done" value={String(done.length)} label="Atendimentos" />
        <Stat icon="pricetag-outline" value={brl(Math.round(ticket))} label="Ticket médio" />
        <Stat icon="alert-circle-outline" value={String(missed)} label="Faltas" />
      </View>

      <Section title="Entradas por dia">
        <DailyBars
          values={perDay}
          color={colors.chartIncome}
          labelFor={(i) => formatDayMonth(`${month}-${String(i + 1).padStart(2, '0')}`)}
          emptyText="Nenhuma entrada neste mês."
        />
      </Section>

      <Section title="Entradas por forma de pagamento">
        <CategoryBars data={byMethod} color={colors.chartIncome} emptyText="Nenhuma entrada neste mês." />
      </Section>

      <Section title="Saídas por categoria">
        <CategoryBars data={expenseByCategory} color={colors.chartExpense} emptyText="Nenhuma saída neste mês." />
      </Section>

      <Section title="Serviços que mais faturaram">
        {topServices.length === 0 ? (
          <Text style={styles.muted}>Conclua atendimentos na agenda para ver o ranking.</Text>
        ) : (
          topServices.map(([name, s], i) => (
            <View key={name} style={[styles.rankRow, i > 0 && styles.divider]}>
              <Text style={styles.rank}>{i + 1}</Text>
              <Text style={styles.rankName} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.muted}>{s.count}×</Text>
              <Text style={styles.rankValue}>{brl(s.total)}</Text>
            </View>
          ))
        )}
      </Section>

      <Text style={styles.listTitle}>Lançamentos</Text>
      <View style={styles.filters}>
        {(
          [
            ['todos', 'Todos'],
            ['entrada', 'Entradas'],
            ['saida', 'Saídas'],
          ] as const
        ).map(([id, label]) => (
          <Pressable key={id} style={[styles.filter, filter === id && styles.filterActive]} onPress={() => setFilter(id)}>
            <Text style={[styles.filterText, filter === id && { color: colors.white }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {visible.length === 0 ? (
        <Text style={[styles.muted, { textAlign: 'center', paddingVertical: 16 }]}>Nenhum lançamento.</Text>
      ) : (
        <View style={styles.list}>
          {visible.map((t, i) => (
            <TransactionRow
              key={t.id}
              t={t}
              first={i === 0}
              confirming={confirmId === t.id}
              onAsk={() => setConfirmId(t.id)}
              onCancel={() => setConfirmId(null)}
              onRemove={() => {
                removeTransaction(t.id);
                setConfirmId(null);
              }}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function TransactionRow({
  t,
  first,
  confirming,
  onAsk,
  onCancel,
  onRemove,
}: {
  t: Transaction;
  first: boolean;
  confirming: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const isIn = t.type === 'entrada';
  return (
    <View style={[styles.tRow, !first && styles.divider]}>
      <View style={[styles.tIcon, { backgroundColor: isIn ? '#F6E6EC' : '#F8EDE2' }]}>
        <Ionicons name={isIn ? 'arrow-down' : 'arrow-up'} size={16} color={isIn ? colors.chartIncome : colors.chartExpense} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.tDesc} numberOfLines={1}>
          {t.description}
        </Text>
        <Text style={styles.muted}>
          {formatDayMonth(t.date)} · {t.category}
          {t.method ? ` · ${PAYMENT_LABEL[t.method]}` : ''}
        </Text>
        {confirming && (
          <View style={styles.confirmRow}>
            <Pressable onPress={onCancel} hitSlop={6}>
              <Text style={styles.muted}>Manter</Text>
            </Pressable>
            <Pressable onPress={onRemove} hitSlop={6}>
              <Text style={styles.removeText}>Excluir lançamento</Text>
            </Pressable>
          </View>
        )}
      </View>
      <Pressable onLongPress={onAsk} onPress={onAsk} hitSlop={4} accessibilityLabel="Opções do lançamento">
        <Text style={styles.tAmount}>
          {isIn ? '+' : '−'} {brl(t.amount)}
        </Text>
      </Pressable>
    </View>
  );
}

function Stat({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={colors.wine} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  muted: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.plum,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.white },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 14 },
  monthLabel: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, textTransform: 'capitalize' },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E6F3EC',
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 14,
  },
  noticeText: { fontFamily: fonts.medium, fontSize: 13, color: colors.success, flex: 1 },
  profitCard: { backgroundColor: colors.white, borderRadius: radius.md, padding: 18, ...shadow },
  cardLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  profitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profit: { fontFamily: fonts.display, fontSize: 34, color: colors.ink },
  profitTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E6F3EC',
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  profitTagNeg: { backgroundColor: '#FBEAE4' },
  profitTagText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.success },
  inOut: { flexDirection: 'row', gap: 16, marginTop: 14 },
  inOutItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  marker: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  inOutValue: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  goalTrack: { height: 8, borderRadius: 4, backgroundColor: colors.blush, marginTop: 16, overflow: 'hidden' },
  goalFill: { height: '100%', borderRadius: 4, backgroundColor: colors.chartIncome },
  goalText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 6 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 12 },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: radius.md, padding: 12, gap: 2, ...shadow },
  statValue: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink, marginTop: 4 },
  section: { backgroundColor: colors.white, borderRadius: radius.md, padding: 16, marginTop: 14, ...shadow },
  sectionTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.ink, marginBottom: 12 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rank: { fontFamily: fonts.semibold, fontSize: 13, color: colors.roseGold, width: 14 },
  rankName: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  rankValue: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink, minWidth: 64, textAlign: 'right' },
  listTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, marginTop: 24 },
  filters: { flexDirection: 'row', gap: 8, marginVertical: 10 },
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
  list: { backgroundColor: colors.white, borderRadius: radius.md, paddingHorizontal: 14, ...shadow },
  tRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  tIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  tDesc: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  tAmount: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  confirmRow: { flexDirection: 'row', gap: 18, marginTop: 6 },
  removeText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.danger },
});
