// Dados de exemplo para a página inicial, até a integração com agenda e financeiro reais.

export type Appointment = {
  id: string;
  time: string;
  client: string;
  service: string;
  price: number;
  polish: string;
};

export const professional = {
  name: 'Juliana',
  studio: 'Studio Cores & Fios',
};

export const todayAppointments: Appointment[] = [
  { id: '1', time: '09:00', client: 'Mariana Alves', service: 'Esmaltação em gel', price: 70, polish: '#B3123C' },
  { id: '2', time: '10:30', client: 'Camila Rocha', service: 'Francesinha + spa', price: 85, polish: '#F2D6CF' },
  { id: '3', time: '13:00', client: 'Beatriz Lima', service: 'Alongamento fibra', price: 160, polish: '#6B2D5C' },
  { id: '4', time: '15:30', client: 'Ana Souza', service: 'Nail art floral', price: 95, polish: '#E8A0B4' },
];

export const todaySummary = {
  revenue: 410,
  goal: 600,
  appointments: todayAppointments.length,
  tryOns: 7,
};

export type Polish = { id: string; name: string; color: string };

export const trendingPolishes: Polish[] = [
  { id: 'p1', name: 'Rubi', color: '#B3123C' },
  { id: 'p2', name: 'Nude Rosé', color: '#E7BFB0' },
  { id: 'p3', name: 'Ameixa', color: '#6B2D5C' },
  { id: 'p4', name: 'Chiclete', color: '#E8A0B4' },
  { id: 'p5', name: 'Champagne', color: '#D9C2A0' },
  { id: 'p6', name: 'Noir', color: '#1E1A1D' },
  { id: 'p7', name: 'Azul Céu', color: '#8DB4D9' },
];
