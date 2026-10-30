import type { DesignId } from '@/data/catalog';

// Posição de uma unha sobre a foto. x/y são o centro, em fração da largura/altura do provador;
// w/h são em fração da largura (assim a unha mantém a proporção em qualquer tamanho de tela).
export type NailSpot = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
};

export type Look = {
  polishId: string;
  designId: DesignId;
  // Decoração diferente aplicada em uma unha (geralmente o anelar).
  accentDesign: DesignId | null;
};

export type SavedLook = Look & { id: string };
