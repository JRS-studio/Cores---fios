// Regras do programa de fidelidade do cadastro Premium (a profissional muda em Ajustes › Benefícios do Premium).
export type LoyaltyRules = {
  stampsForReward: number;
  reward: string;
  welcomeStamps: number;
  referralStamps: number;
  birthdayDiscount: number; // %
};

export const DEFAULT_LOYALTY: LoyaltyRules = {
  stampsForReward: 10,
  reward: 'Esmaltação em gel grátis',
  welcomeStamps: 1,
  referralStamps: 2,
  birthdayDiscount: 15,
};

// Benefícios escritos livremente pela profissional, além dos que saem das regras acima.
export const DEFAULT_EXTRA_BENEFITS = [
  'Preferências e ficha de saúde salvas para cada atendimento',
  'Níveis Rosé, Ouro e Diamante com vantagens extras',
];

export type LoyaltyLevel = { id: string; name: string; minVisits: number; perk: string };

// O nível sobe com o total de atendimentos e nunca cai.
export const LEVELS: LoyaltyLevel[] = [
  { id: 'rose', name: 'Rosé', minVisits: 0, perk: 'Cartão de selos e desconto de aniversário' },
  { id: 'ouro', name: 'Ouro', minVisits: 10, perk: 'Prioridade nos horários de sexta e sábado' },
  { id: 'diamante', name: 'Diamante', minVisits: 25, perk: 'Um selo extra a cada 5 atendimentos' },
];

export function levelFor(totalVisits: number) {
  return [...LEVELS].reverse().find((l) => totalVisits >= l.minVisits) ?? LEVELS[0];
}

export function nextLevel(totalVisits: number) {
  return LEVELS.find((l) => l.minVisits > totalVisits) ?? null;
}

// Lista mostrada à cliente: o que vem das regras (só os que estão ligados) e os benefícios extras.
export function premiumBenefits(rules: LoyaltyRules, extra: string[]) {
  return [
    rules.stampsForReward > 0 && rules.reward.trim() ? `A cada ${rules.stampsForReward} atendimentos, 1 ${rules.reward.trim().toLowerCase()}` : null,
    rules.welcomeStamps > 0 ? `${rules.welcomeStamps} ${rules.welcomeStamps === 1 ? 'selo' : 'selos'} de boas-vindas ao entrar` : null,
    rules.birthdayDiscount > 0 ? `${rules.birthdayDiscount}% de desconto no mês do aniversário` : null,
    rules.referralStamps > 0 ? `+${rules.referralStamps} ${rules.referralStamps === 1 ? 'selo' : 'selos'} por amiga indicada que fizer o primeiro atendimento` : null,
    ...extra.map((b) => b.trim()).filter(Boolean),
  ].filter((b): b is string => !!b);
}
