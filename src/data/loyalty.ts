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
    rules.birthdayDiscount > 0 ? `${rules.birthdayDiscount}% de desconto no mês do aniversário` : null,
    ...extra.map((b) => b.trim()).filter(Boolean),
  ].filter((b): b is string => !!b);
}
