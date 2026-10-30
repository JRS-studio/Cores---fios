import { shapeById, type ShapeId } from '@/data/catalog';

// Geometria de uma unha em coordenadas locais: centro da unha natural em (0, 0),
// ponta para cima (y negativo) e cutícula para baixo (y positivo).
// `w` e `h` são a largura e o comprimento da unha natural marcada na foto.
export type NailGeometry = {
  path: string;
  tipY: number; // ponta final (com alongamento)
  freeEdgeY: number; // onde termina a unha natural
  baseY: number; // linha da cutícula
  halfWidth: number;
};

export function nailGeometry(shape: ShapeId, w: number, h: number): NailGeometry {
  const a = w / 2;
  // Esmalte bem aplicado deixa um fio de pele livre na cutícula.
  const baseY = h / 2 - h * 0.04;
  const freeEdgeY = -h / 2;
  const tipY = freeEdgeY - h * shapeById(shape).extension;
  // Cutícula em arco (formato de U), como a lúnula da unha natural.
  const baseRise = Math.min(a * 0.9, h * 0.45);
  const baseCurve = `M ${-a} ${baseY - baseRise} C ${-a} ${baseY + baseRise * 0.3} ${a} ${baseY + baseRise * 0.3} ${a} ${baseY - baseRise}`;
  // As laterais seguem retas até perto da ponta natural; a partir daí cada formato desenha a ponta.
  // Na unha natural e na redonda a borda livre acompanha a curva da ponta do dedo.
  const rounded = shape === 'natural' || shape === 'redonda';
  const sideY = freeEdgeY + h * (rounded ? 0.3 : 0.18);
  const span = tipY - sideY;

  let tip: string;
  switch (shape) {
    case 'quadrada': {
      const r = a * 0.22;
      tip = `L ${a} ${tipY + r} Q ${a} ${tipY} ${a - r} ${tipY} L ${-a + r} ${tipY} Q ${-a} ${tipY} ${-a} ${tipY + r} L ${-a} ${sideY}`;
      break;
    }
    case 'amendoada':
      tip = `C ${a} ${sideY + span * 0.55} ${a * 0.3} ${tipY} 0 ${tipY} C ${-a * 0.3} ${tipY} ${-a} ${sideY + span * 0.55} ${-a} ${sideY}`;
      break;
    case 'stiletto':
      tip = `C ${a} ${sideY + span * 0.45} ${a * 0.12} ${tipY + span * -0.12} 0 ${tipY} C ${-a * 0.12} ${tipY + span * -0.12} ${-a} ${sideY + span * 0.45} ${-a} ${sideY}`;
      break;
    case 'bailarina': {
      const t = a * 0.55;
      const r = a * 0.12;
      tip = `L ${t} ${tipY + r} Q ${t} ${tipY} ${t - r} ${tipY} L ${-t + r} ${tipY} Q ${-t} ${tipY} ${-t} ${tipY + r} L ${-a} ${sideY}`;
      break;
    }
    default: {
      // Natural e redonda: arco cujo pico (75% do controle numa cúbica simétrica) toca a ponta.
      const c = sideY + span / 0.75;
      tip = `C ${a} ${c} ${-a} ${c} ${-a} ${sideY}`;
    }
  }

  return {
    path: `${baseCurve} L ${a} ${sideY} ${tip} Z`,
    tipY,
    freeEdgeY,
    baseY,
    halfWidth: a,
  };
}

export function mix(hex: string, target: string, amount: number) {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(target.slice(1), 16);
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - amount) + ((b >> shift) & 255) * amount);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

export function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 170;
}
