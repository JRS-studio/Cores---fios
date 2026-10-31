import { addDays, formatDayMonth, fromISODate, MONTHS, today, toISODate, WEEKDAYS_SHORT } from '@/utils/date';

// Períodos do financeiro: o dia, a semana (segunda a domingo), o mês ou o ano que contém `anchor`.
export type Period = 'dia' | 'semana' | 'mes' | 'ano';

export const PERIODS: [Period, string][] = [
  ['dia', 'Dia'],
  ['semana', 'Semana'],
  ['mes', 'Mês'],
  ['ano', 'Ano'],
];

export type Range = { start: string; end: string }; // AAAA-MM-DD, inclusivos

const pad = (n: number) => String(n).padStart(2, '0');
const lastDayOfMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

export function rangeFor(period: Period, anchor: string): Range {
  const d = fromISODate(anchor);
  const y = d.getFullYear();
  const m = d.getMonth();
  if (period === 'dia') return { start: anchor, end: anchor };
  if (period === 'semana') {
    const start = addDays(anchor, -((d.getDay() + 6) % 7));
    return { start, end: addDays(start, 6) };
  }
  if (period === 'mes') return { start: `${y}-${pad(m + 1)}-01`, end: `${y}-${pad(m + 1)}-${pad(lastDayOfMonth(y, m))}` };
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

export function shiftAnchor(period: Period, anchor: string, delta: number) {
  if (period === 'dia') return addDays(anchor, delta);
  if (period === 'semana') return addDays(anchor, delta * 7);
  const d = fromISODate(anchor);
  if (period === 'mes') return toISODate(new Date(d.getFullYear(), d.getMonth() + delta, 1));
  return toISODate(new Date(d.getFullYear() + delta, 0, 1));
}

export function periodLabel(period: Period, anchor: string) {
  const r = rangeFor(period, anchor);
  const d = fromISODate(anchor);
  const t = today();
  if (period === 'dia') {
    const prefix = anchor === t ? 'Hoje, ' : anchor === addDays(t, -1) ? 'Ontem, ' : anchor === addDays(t, 1) ? 'Amanhã, ' : `${WEEKDAYS_SHORT[d.getDay()]}, `;
    return prefix + formatDayMonth(anchor);
  }
  if (period === 'semana') return `${formatDayMonth(r.start)} – ${formatDayMonth(r.end)}`;
  if (period === 'mes') return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return String(d.getFullYear());
}

export const inRange = (date: string, r: Range) => date >= r.start && date <= r.end;

// Fatias do gráfico: dias da semana ou do mês, ou meses do ano (o dia não tem gráfico).
export function buckets(period: Period, r: Range): { range: Range; label: string }[] {
  if (period === 'dia') return [];
  if (period === 'ano') {
    const y = r.start.slice(0, 4);
    return MONTHS.map((name, m) => ({
      range: { start: `${y}-${pad(m + 1)}-01`, end: `${y}-${pad(m + 1)}-${pad(lastDayOfMonth(Number(y), m))}` },
      label: `${name} ${y}`,
    }));
  }
  const out: { range: Range; label: string }[] = [];
  for (let day = r.start; day <= r.end; day = addDays(day, 1)) {
    out.push({ range: { start: day, end: day }, label: period === 'semana' ? `${WEEKDAYS_SHORT[fromISODate(day).getDay()]} ${formatDayMonth(day)}` : formatDayMonth(day) });
  }
  return out;
}
