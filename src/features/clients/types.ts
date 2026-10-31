import type { ShapeId } from '@/data/catalog';

export type Plan = 'rapido' | 'premium';

export type Loyalty = {
  stamps: number;
  totalVisits: number;
  rewardsRedeemed: number;
};

export type Client = {
  id: string;
  plan: Plan;
  createdAt: string;
  name: string;
  phone: string; // só dígitos; é a identificação da cliente (sem documentos)
  phoneVerified?: boolean; // confirmado por código no WhatsApp
  privacyConsent: boolean;
  remindersConsent: boolean;

  // Cadastro Premium
  email?: string;
  birthDate?: string; // DD/MM/AAAA
  address?: string;
  contactChannel?: 'whatsapp' | 'ligacao' | 'email';
  preferredShape?: ShapeId;
  preferredLength?: 'curta' | 'media' | 'longa';
  favoriteColors?: string[];
  preferredPeriods?: string[];
  referralSource?: string;
  referredBy?: string;

  // Ficha de saúde (dado sensível pela LGPD: só é salva com consentimento específico)
  healthConsent?: boolean;
  allergies?: string[];
  healthConditions?: string[];
  healthNotes?: string;

  loyalty?: Loyalty;
};

export const CONTACT_CHANNELS = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'ligacao', label: 'Ligação' },
  { id: 'email', label: 'E-mail' },
] as const;

export const LENGTHS = [
  { id: 'curta', label: 'Curta' },
  { id: 'media', label: 'Média' },
  { id: 'longa', label: 'Longa' },
] as const;

export const PERIODS = ['Manhã', 'Tarde', 'Noite', 'Sábado'];
export const REFERRAL_SOURCES = ['Instagram', 'Indicação de amiga', 'Google', 'Passei em frente', 'Outro'];
export const ALLERGIES = ['Acetona', 'Esmalte comum', 'Gel / cabine UV', 'Látex', 'Cola de unhas', 'Removedor'];
export const HEALTH_CONDITIONS = [
  'Diabetes',
  'Problemas de circulação',
  'Gestante',
  'Usa anticoagulante',
  'Unhas frágeis ou quebradiças',
  'Micose ou fungos nas unhas',
];
