// Regras do programa de fidelidade do cadastro Premium.
export const LOYALTY = {
  stampsForReward: 10,
  reward: 'Esmaltação em gel grátis',
  welcomeStamps: 1,
  referralStamps: 2,
  birthdayDiscount: 15,
};

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

export const PREMIUM_BENEFITS = [
  `A cada ${LOYALTY.stampsForReward} atendimentos, 1 ${LOYALTY.reward.toLowerCase()}`,
  `${LOYALTY.welcomeStamps} selo de boas-vindas ao entrar`,
  `${LOYALTY.birthdayDiscount}% de desconto no mês do aniversário`,
  `+${LOYALTY.referralStamps} selos por amiga indicada que fizer o primeiro atendimento`,
  'Preferências e ficha de saúde salvas para cada atendimento',
  'Níveis Rosé, Ouro e Diamante com vantagens extras',
];
