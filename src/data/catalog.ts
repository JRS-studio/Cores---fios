// Catálogo do Provador Virtual: esmaltes disponíveis e designs (cada design é um serviço com preço).

export type Polish = { id: string; name: string; color: string };

export const polishes: Polish[] = [
  { id: 'rubi', name: 'Rubi', color: '#B3123C' },
  { id: 'nude-rose', name: 'Nude Rosé', color: '#E7BFB0' },
  { id: 'ameixa', name: 'Ameixa', color: '#6B2D5C' },
  { id: 'chiclete', name: 'Chiclete', color: '#E8A0B4' },
  { id: 'champagne', name: 'Champagne', color: '#D9C2A0' },
  { id: 'noir', name: 'Noir', color: '#1E1A1D' },
  { id: 'azul-ceu', name: 'Azul Céu', color: '#8DB4D9' },
  { id: 'coral', name: 'Coral', color: '#F06D5B' },
  { id: 'vinho', name: 'Vinho', color: '#5A0F24' },
  { id: 'lilas', name: 'Lilás', color: '#B59BD6' },
  { id: 'menta', name: 'Menta', color: '#A8D8C2' },
  { id: 'branco', name: 'Branco', color: '#F7F4F2' },
  { id: 'terracota', name: 'Terracota', color: '#B5543A' },
  { id: 'verde-oliva', name: 'Oliva', color: '#6E7445' },
];

export type DesignId = 'cremoso' | 'gel' | 'francesinha' | 'baby-boomer' | 'glitter' | 'cromado' | 'poa';

export type Design = {
  id: DesignId;
  name: string;
  description: string;
  price: number;
};

export const designs: Design[] = [
  { id: 'cremoso', name: 'Tradicional', description: 'Esmalte cremoso', price: 35 },
  { id: 'gel', name: 'Gel', description: 'Brilho intenso, dura até 3 semanas', price: 70 },
  { id: 'francesinha', name: 'Francesinha', description: 'Ponta colorida, base nude', price: 45 },
  { id: 'baby-boomer', name: 'Baby Boomer', description: 'Degradê suave para o nude', price: 80 },
  { id: 'glitter', name: 'Glitter', description: 'Cor com brilho cintilante', price: 60 },
  { id: 'cromado', name: 'Cromado', description: 'Efeito espelhado metálico', price: 75 },
  { id: 'poa', name: 'Nail Art Poá', description: 'Bolinhas delicadas pintadas à mão', price: 95 },
];

export type ShapeId = 'natural' | 'quadrada' | 'redonda' | 'amendoada' | 'bailarina' | 'stiletto';

export type Shape = {
  id: ShapeId;
  name: string;
  description: string;
  price: number;
  // Quanto a unha passa da ponta natural, em fração do comprimento da unha natural.
  extension: number;
};

// Qualquer formato além do natural pressupõe alongamento, cobrado à parte.
export const shapes: Shape[] = [
  { id: 'natural', name: 'Natural', description: 'Unha da cliente, sem alongamento', price: 0, extension: 0.06 },
  { id: 'quadrada', name: 'Quadrada', description: 'Alongamento com ponta reta', price: 90, extension: 0.32 },
  { id: 'redonda', name: 'Redonda', description: 'Alongamento com ponta arredondada', price: 90, extension: 0.3 },
  { id: 'amendoada', name: 'Amendoada', description: 'Alongamento afinando na ponta', price: 90, extension: 0.5 },
  { id: 'bailarina', name: 'Bailarina', description: 'Alongamento com ponta reta e estreita', price: 100, extension: 0.55 },
  { id: 'stiletto', name: 'Stiletto', description: 'Alongamento pontudo', price: 100, extension: 0.7 },
];

// Valor adicional quando uma unha recebe decoração diferente das demais.
export const ACCENT_PRICE = 15;

export const polishById = (id: string) => polishes.find((p) => p.id === id) ?? polishes[0];
export const shapeById = (id: ShapeId) => shapes.find((s) => s.id === id) ?? shapes[0];
export const designById = (id: DesignId) => designs.find((d) => d.id === id) ?? designs[0];
