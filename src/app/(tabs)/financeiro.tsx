import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppointments, PAYMENT_LABEL, type Appointment, type PaymentMethod } from '@/features/agenda/AppointmentsContext';
import { CategoryBars, DailyBars } from '@/features/finance/charts';
import { useFinance, type Transaction } from '@/features/finance/FinanceContext';
import { buckets, inRange, periodLabel, PERIODS, rangeFor, shiftAnchor, type Period, type Range } from '@/features/finance/period';
import { useSettings } from '@/features/settings/SettingsContext';
import { OwnerOnly } from '@/components/ui';
import { useSession } from '@/features/session/SessionContext';
import { colors, fonts, radius, shadow } from '@/theme';
import { formatDayMonth, today } from '@/utils/date';
import { brl } from '@/utils/format';

type Filter = 'todos' | 'entrada' | 'saida';

// Ainda vai acontecer (ou passou sem ser concluído): é dinheiro previsto, não recebido.
const isPending = (a: Appointment) => a.status === 'agendado' || a.status === 'confirmado';

export default function FinanceiroScreen() {
  const { canManage } = useSession();
  return canManage ? <FinanceiroScreenContent /> : <OwnerOnly title="Financeiro" />;
}

function FinanceiroScreenContent() {
  const insets = useSafeAreaInsets();
  const { lancado } = useLocalSearchParams<{ lancado?: string }>();
  const { transactions, removeTransaction } = useFinance();
  const { appointments } = useAppointments();
  const { settings } = useSettings();
  const [period, setPeriod] = useState<Period>('mes');
  const [anchor, setAnchor] = useState(today());
  const [filter, setFilter] = useState<Filter>('todos');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const range = rangeFor(period, anchor);
  const totals = (r: Range) => {
    const received = transactions.filter((t) => t.type === 'entrada' && inRange(t.date, r)).reduce((s, t) => s + t.amount, 0);
    const expected = appointments.filter((a) => isPending(a) && inRange(a.date, r)).reduce((s, a) => s + a.price, 0);
    return { received, expected };
  };

  const items = transactions
    .filter((t) => inRange(t.date, range))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const income = items.filter((t) => t.type === 'entrada');
  const expense = items.filter((t) => t.type === 'saida');
  const totalIn = income.reduce((s, t) => s + t.amount, 0);
  const totalOut = expense.reduce((s, t) => s + t.amount, 0);
  const profit = totalIn - totalOut;

  const periodAppts = appointments.filter((a) => inRange(a.date, range));
  const pending = periodAppts.filter(isPending).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const expected = pending.reduce((s, a) => s + a.price, 0);
  const todayIso = today();
  const nowTime = new Date().toTimeString().slice(0, 5);
  const overdue = pending.filter((a) => a.date < todayIso || (a.date === todayIso && a.time < nowTime));
  const done = periodAppts.filter((a) => a.status === 'concluido');
  const missed = periodAppts.filter((a) => a.status === 'faltou').length;
  const ticket = done.length ? done.reduce((s, a) => s + (a.paidAmount ?? a.price), 0) / done.length : 0;

  // Meta mensal: no mês mostra quanto já entrou e quanto ainda está marcado.
  const goal = period === 'mes' ? settings.monthlyGoal : 0;
  const goalDone = goal > 0 ? Math.min(totalIn / goal, 1) : 0;
  const goalExpected = goal > 0 ? Math.min((totalIn + expected) / goal, 1) - goalDone : 0;

  const chart = buckets(period, range);
  const perBucket = chart.map((b) => income.filter((t) => inRange(t.date, b.range)).reduce((s, t) => s + t.amount, 0));
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
  const quick: [string, Period][] = [
    ['Hoje', 'dia'],
    ['Esta semana', 'semana'],
    ['Este mês', 'mes'],
  ];
  const periodName = { dia: 'do dia', semana: 'da semana', mes: 'do mês', ano: 'do ano' }[period];

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

      {lancado && (
        <View style={[styles.notice, { marginTop: 12 }]}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={styles.noticeText}>Lançamento salvo.</Text>
        </View>
      )}

      {/* Rendimentos de hoje, da semana e do mês, lado a lado. */}
      <View style={styles.quickRow}>
        {quick.map(([label, p]) => {
          const t = totals(rangeFor(p, todayIso));
          return (
            <Pressable
              key={p}
              style={styles.quickCard}
              onPress={() => {
                setPeriod(p);
                setAnchor(todayIso);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${label}: recebido ${brl(t.received)}, previsto ${brl(t.expected)}`}
            >
              <Text style={styles.cardLabel}>{label}</Text>
              <Text style={styles.quickValue} numberOfLines={1} adjustsFontSizeToFit>
                {brl(t.received)}
              </Text>
              <Text style={styles.quickExpected} numberOfLines={1}>
                + {brl(t.expected)} previsto
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.segment}>
        {PERIODS.map(([id, label]) => (
          <Pressable
            key={id}
            style={[styles.segmentItem, period === id && styles.segmentActive]}
            onPress={() => setPeriod(id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: period === id }}
          >
            <Text style={[styles.segmentText, period === id && { color: colors.white }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.monthNav}>
        <Pressable onPress={() => setAnchor(shiftAnchor(period, anchor, -1))} hitSlop={10} accessibilityLabel="Período anterior">
          <Ionicons name="chevron-back" size={22} color={colors.plum} />
        </Pressable>
        <Pressable onPress={() => setAnchor(todayIso)} accessibilityLabel="Voltar para hoje">
          <Text style={styles.monthLabel}>{periodLabel(period, anchor)}</Text>
        </Pressable>
        <Pressable onPress={() => setAnchor(shiftAnchor(period, anchor, 1))} hitSlop={10} accessibilityLabel="Próximo período">
          <Ionicons name="chevron-forward" size={22} color={colors.plum} />
        </Pressable>
      </View>

      <View style={styles.profitCard}>
        <View style={styles.inOut}>
          <View style={styles.inOutItem}>
            <View style={[styles.marker, { backgroundColor: colors.chartIncome }]} />
            <View>
              <Text style={styles.cardLabel}>Recebido</Text>
              <Text style={styles.bigValue}>{brl(totalIn)}</Text>
            </View>
          </View>
          <View style={styles.inOutItem}>
            <View style={[styles.marker, { backgroundColor: colors.chartIncome, opacity: 0.35 }]} />
            <View>
              <Text style={styles.cardLabel}>Previsto a receber</Text>
              <Text style={styles.bigValue}>{brl(expected)}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.expectedNote}>
          Total esperado {periodName}: <Text style={styles.expectedStrong}>{brl(totalIn + expected)}</Text>
          {pending.length > 0 ? ` · ${pending.length} ${pending.length === 1 ? 'horário marcado' : 'horários marcados'}` : ''}
        </Text>

        {goal > 0 && (
          <>
            <View style={styles.goalTrack}>
              <View style={[styles.goalFill, { width: `${goalDone * 100}%` }]} />
              <View style={[styles.goalFill, styles.goalExpected, { width: `${goalExpected * 100}%` }]} />
            </View>
            <Text style={styles.goalText}>
              {Math.round(goalDone * 100)}% da meta de {brl(goal)} recebido
              {expected > 0 ? ` · ${Math.round((goalDone + goalExpected) * 100)}% com os horários marcados` : ''}
            </Text>
          </>
        )}

        <View style={[styles.inOut, styles.profitBottom]}>
          <View style={styles.inOutItem}>
            <View style={[styles.marker, { backgroundColor: colors.chartExpense }]} />
            <View>
              <Text style={styles.cardLabel}>Saídas</Text>
              <Text style={styles.inOutValue}>− {brl(totalOut)}</Text>
            </View>
          </View>
          <View style={styles.inOutItem}>
            <View style={[styles.marker, { backgroundColor: profit >= 0 ? colors.success : colors.danger }]} />
            <View>
              <Text style={styles.cardLabel}>Lucro</Text>
              <Text style={[styles.inOutValue, profit < 0 && { color: colors.danger }]}>{brl(profit)}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.stats}>
        <Stat icon="checkmark-done" value={String(done.length)} label="Realizados" />
        <Stat icon="calendar-outline" value={String(pending.length)} label="A realizar" />
        <Stat icon="pricetag-outline" value={brl(Math.round(ticket))} label="Ticket médio" />
        <Stat icon="alert-circle-outline" value={String(missed)} label="Faltas" />
      </View>

      <Section title="A receber dos horários marcados">
        {pending.length === 0 ? (
          <Text style={styles.muted}>Nenhum horário marcado neste período.</Text>
        ) : (
          <>
            {overdue.length > 0 && (
              <View style={styles.warn}>
                <Ionicons name="time-outline" size={16} color="#B45309" />
                <Text style={styles.warnText}>
                  {overdue.length} {overdue.length === 1 ? 'horário já passou' : 'horários já passaram'} sem conclusão. Conclua na agenda para
                  registrar o pagamento.
                </Text>
              </View>
            )}
            {pending.slice(0, 30).map((a, i) => (
              <Pressable
                key={a.id}
                style={[styles.rankRow, i > 0 && styles.divider]}
                onPress={() => router.push({ pathname: '/agendamento/[id]', params: { id: a.id } })}
              >
                <View style={{ width: 62 }}>
                  <Text style={styles.pendingDate}>{a.date === todayIso ? 'Hoje' : formatDayMonth(a.date)}</Text>
                  <Text style={styles.muted}>{a.time}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rankName} numberOfLines={1}>
                    {a.clientName}
                  </Text>
                  <Text style={styles.muted} numberOfLines={1}>
                    {a.serviceName}
                    {a.status === 'confirmado' ? ' · confirmado' : ''}
                  </Text>
                </View>
                <Text style={styles.rankValue}>{brl(a.price)}</Text>
              </Pressable>
            ))}
            {pending.length > 30 && <Text style={[styles.muted, { marginTop: 8 }]}>e mais {pending.length - 30} horários.</Text>}
          </>
        )}
      </Section>

      {chart.length > 0 && (
        <Section title={period === 'ano' ? 'Recebido por mês' : 'Recebido por dia'}>
          <DailyBars values={perBucket} color={colors.chartIncome} labelFor={(i) => chart[i].label} emptyText={`Nenhuma entrada neste período.`} />
        </Section>
      )}

      <Section title="Recebido por forma de pagamento">
        <CategoryBars data={byMethod} color={colors.chartIncome} emptyText="Nenhuma entrada neste período." />
      </Section>

      <Section title="Saídas por categoria">
        <CategoryBars data={expenseByCategory} color={colors.chartExpense} emptyText="Nenhuma saída neste período." />
      </Section>

      <Section title="Serviços que mais faturaram">
        {topServices.length === 0 ? (
          <Text style={styles.muted}>Conclua atendimentos na agenda para ver o ranking.</Text>
        ) : (
          topServices.map(([name, sv], i) => (
            <View key={name} style={[styles.rankRow, i > 0 && styles.divider]}>
              <Text style={styles.rank}>{i + 1}</Text>
              <Text style={styles.rankName} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.muted}>{sv.count}×</Text>
              <Text style={styles.rankValue}>{brl(sv.total)}</Text>
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
        <Text style={[styles.muted, { textAlign: 'center', paddingVertical: 16 }]}>Nenhum lançamento neste período.</Text>
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
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.cardLabel, { fontSize: 11 }]} numberOfLines={1}>
        {label}
      </Text>
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
  bigValue: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  expectedNote: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 12 },
  expectedStrong: { fontFamily: fonts.semibold, color: colors.ink },
  goalExpected: { backgroundColor: colors.chartIncome, opacity: 0.35, borderRadius: 0 },
  profitBottom: { marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  quickCard: { flex: 1, backgroundColor: colors.white, borderRadius: radius.md, padding: 12, gap: 2, ...shadow },
  quickValue: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  quickExpected: { fontFamily: fonts.regular, fontSize: 10, color: colors.wine },
  segment: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, padding: 4, marginTop: 16 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.pill },
  segmentActive: { backgroundColor: colors.plum },
  segmentText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.plum },
  warn: { flexDirection: 'row', gap: 8, backgroundColor: '#FEF3E2', borderRadius: radius.sm, padding: 10, marginBottom: 8 },
  warnText: { flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: '#92400E' },
  pendingDate: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  goalTrack: { flexDirection: 'row', height: 8, borderRadius: 4, backgroundColor: colors.blush, marginTop: 16, overflow: 'hidden' },
  goalFill: { height: '100%', borderRadius: 4, backgroundColor: colors.chartIncome },
  goalText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 6 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 12 },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 10, gap: 2, ...shadow },
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
