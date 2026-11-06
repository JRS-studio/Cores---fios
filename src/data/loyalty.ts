// Regras do cadastro Premium (a profissional muda em Ajustes › Cashback e benefícios).
export type LoyaltyRules = {
  cashbackPercent: number; // % do valor pago que volta como cashback
  birthdayDiscount: number; // %
};

export const DEFAULT_LOYALTY: LoyaltyRules = {
  cashbackPercent: 1,
  birthdayDiscount: 15,
};

// Benefícios escritos livremente pela profissional, além dos que saem das regras acima.
export const DEFAULT_EXTRA_BENEFITS = ['Preferências e ficha de saúde salvas para cada atendimento'];

// Ajustes salvos antes do cashback (cartão de selos e níveis): fica só o que ainda vale.
export function migrateLoyalty(stored: Partial<LoyaltyRules> | undefined): LoyaltyRules {
  return {
    cashbackPercent: stored?.cashbackPercent ?? DEFAULT_LOYALTY.cashbackPercent,
    birthdayDiscount: stored?.birthdayDiscount ?? DEFAULT_LOYALTY.birthdayDiscount,
  };
}
export const withoutOldBenefits = (extra: string[]) => extra.filter((b) => !/^Níveis Rosé/.test(b));

export const formatPercent = (p: number) => `${String(p).replace('.', ',')}%`;

// Lista mostrada à cliente: o que vem das regras (só os que estão ligados) e os benefícios extras.
export function premiumBenefits(rules: LoyaltyRules, extra: string[]) {
  return [
    rules.cashbackPercent > 0 ? `${formatPercent(rules.cashbackPercent)} de cashback em todo atendimento pago, para usar nos próximos agendamentos` : null,
    rules.birthdayDiscount > 0 ? `${rules.birthdayDiscount}% de desconto na semana do aniversário` : null,
    ...extra.map((b) => b.trim()).filter(Boolean),
  ].filter((b): b is string => !!b);
}

// Semana do aniversário: de segunda a domingo da semana em que cai o aniversário (no ano da data).
// O desconto de aniversário do Premium vale só nesses 7 dias.
const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function birthdayWeekOf(birth: Date, year: number) {
  // 29/02 em ano que não é bissexto vira 01/03, como o próprio calendário faz.
  const day = new Date(year, birth.getMonth(), birth.getDate());
  const start = new Date(day);
  start.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: isoDate(start), end: isoDate(end) };
}

// A semana do aniversário que contém a data (AAAA-MM-DD), ou null. Olha também o ano anterior e o
// seguinte, por causa das semanas que atravessam a virada do ano (aniversário em 31/12 ou 01/01).
export function birthdayWeekContaining(birth: Date, date: string) {
  const year = Number(date.slice(0, 4));
  for (const y of [year - 1, year, year + 1]) {
    const week = birthdayWeekOf(birth, y);
    if (date >= week.start && date <= week.end) return week;
  }
  return null;
}
