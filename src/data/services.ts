// Serviços oferecidos na agenda, com duração usada para calcular os horários livres.
// A profissional edita a lista em Ajustes › Serviços e preços (fica nos ajustes do studio).
export type Service = { id: string; name: string; price: number; duration: number; active?: boolean };

export const DEFAULT_SERVICES: Service[] = [
  { id: 'manicure', name: 'Manicure tradicional', price: 35, duration: 45 },
  { id: 'pedicure', name: 'Pedicure', price: 40, duration: 50 },
  { id: 'mao-pe', name: 'Mão e pé', price: 70, duration: 90 },
  { id: 'gel', name: 'Esmaltação em gel', price: 70, duration: 60 },
  { id: 'francesinha', name: 'Francesinha', price: 45, duration: 50 },
  { id: 'nail-art', name: 'Nail art', price: 95, duration: 75 },
  { id: 'alongamento', name: 'Alongamento em fibra', price: 160, duration: 120 },
  { id: 'manutencao', name: 'Manutenção de alongamento', price: 100, duration: 90 },
  { id: 'spa-pes', name: 'Spa dos pés', price: 60, duration: 45 },
];

export const isServiceActive = (s: Service) => s.active !== false;
