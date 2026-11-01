// Datas no fuso do aparelho, guardadas como 'AAAA-MM-DD' (sem horário) para não sofrer com fuso.
const pad = (n: number) => String(n).padStart(2, '0');

export const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => toISODate(new Date());

export function fromISODate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number) {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export const weekdayOf = (iso: string) => fromISODate(iso).getDay();

// "sexta, 30 de outubro"
export function formatLongDate(iso: string) {
  const d = fromISODate(iso);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

// "30/10"
export const formatDayMonth = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

export const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};
export const toTime = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

export const monthKey = (iso: string) => iso.slice(0, 7);
export function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}
export const daysInMonth = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

// Último dia que as clientes podem agendar: o fim do mês seguinte. A agenda do próximo mês abre sempre
// no dia 1º (em novembro vai até 31 de dezembro; em 1º de dezembro passa a ir até 31 de janeiro).
export function lastBookableDate(fromIso = today()) {
  const next = shiftMonth(monthKey(fromIso), 1);
  return `${next}-${pad(daysInMonth(next))}`;
}

// "DD/MM/AAAA" <-> "AAAA-MM-DD"
export const isoToBr = (iso: string) => iso.split('-').reverse().join('/');
export function brToIso(br: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br);
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  return toISODate(fromISODate(iso)) === iso ? iso : null;
}

// "agora", "há 5 min", "há 2 h", "ontem", "há 3 dias" e, depois de uma semana, a data.
export function timeAgo(isoDateTime: string, now = new Date()) {
  const then = new Date(isoDateTime);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round((fromISODate(toISODate(now)).getTime() - fromISODate(toISODate(then)).getTime()) / 86400000);
  if (days <= 1) return 'ontem';
  if (days < 7) return `há ${days} dias`;
  const sameYear = then.getFullYear() === now.getFullYear();
  return `${then.getDate()} de ${MONTHS[then.getMonth()].toLowerCase()}${sameYear ? '' : ` de ${then.getFullYear()}`}`;
}
