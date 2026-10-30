import type { ReactNode } from 'react';
import { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Mask, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { DesignId, ShapeId } from '@/data/catalog';
import { isLight, mix, nailGeometry } from './geometry';

type Props = {
  id: string;
  w: number;
  h: number;
  color: string;
  design: DesignId;
  shape: ShapeId;
  // Camada com a luz e a sombra da foto real, desenhada por cima do esmalte.
  lighting?: ReactNode;
};

// Base leitosa da francesinha: cobre a unha natural sem esconder totalmente o tom dela.
const MILKY_PINK = '#F4D0CB';
const NUDE = '#F3D3CB';

// Intensidade do top coat por acabamento (0 = matte).
const GLOSS: Record<DesignId, number> = {
  gel: 1,
  cromado: 1,
  glitter: 0.9,
  francesinha: 0.9,
  'baby-boomer': 0.9,
  poa: 0.9,
  cremoso: 0.7,
  matte: 0,
};

// Pseudoaleatório determinístico: o glitter fica igual a cada renderização.
const rnd = (i: number, k: number) => {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

// Glitter como nas fotos de referência: partículas finas e densas, tamanhos variados,
// iridescentes, a maioria apagada e poucas captando a luz; algumas lascas hexagonais maiores.
const SPARKLE_TONES = ['#FFFFFF', '#FFFFFF', '#F7D98B', '#A6F0FF', '#FFB8E2'];
const GLITTER = Array.from({ length: 320 }, (_, i) => {
  const bright = rnd(i, 4);
  return {
    x: rnd(i, 1) * 2 - 1,
    y: rnd(i, 2),
    r: 0.03 + rnd(i, 3) ** 5 * 0.08,
    opacity: 0.1 + bright ** 4 * 0.9,
    tone: Math.floor(rnd(i, 5) * (SPARKLE_TONES.length + 1)),
  };
});
const FLAKES = Array.from({ length: 5 }, (_, i) => ({
  x: rnd(i + 500, 1) * 1.6 - 0.8,
  y: 0.1 + rnd(i + 500, 2) * 0.8,
  r: 0.07 + rnd(i + 500, 3) * 0.05,
  angle: rnd(i + 500, 4) * 60,
  opacity: 0.35 + rnd(i + 500, 5) * 0.4,
  tone: SPARKLE_TONES[Math.floor(rnd(i + 500, 6) * SPARKLE_TONES.length)],
}));

const hexagon = (cx: number, cy: number, r: number, angle: number) =>
  Array.from({ length: 6 }, (_, k) => {
    const t = ((angle + k * 60) * Math.PI) / 180;
    return `${k ? 'L' : 'M'} ${cx + r * Math.cos(t)} ${cy + r * Math.sin(t)}`;
  }).join(' ') + ' Z';

const POA = [
  [-0.45, 0.12], [0.4, 0.22], [-0.05, 0.36], [0.45, 0.5], [-0.4, 0.58], [0.1, 0.74], [-0.3, 0.88], [0.42, 0.85],
];

// Esmalte desenhado dentro do contorno da unha, em coordenadas locais (ver nailGeometry).
export function NailArt({ id, w, h, color, design, shape, lighting }: Props) {
  const g = nailGeometry(shape, w, h);
  const a = g.halfWidth;
  const length = g.baseY - g.tipY;
  const gloss = GLOSS[design];
  const clip = `${id}-clip`;

  // Linha do "sorriso" da francesinha, acompanhando a borda livre.
  const smileSide = g.freeEdgeY + h * 0.24;
  const smileCenter = g.freeEdgeY + h * 0.03;

  const fill =
    design === 'baby-boomer' ? `url(#${id}-fade)` : design === 'cromado' ? `url(#${id}-chrome)` : color;

  return (
    <G>
      <Defs>
        <ClipPath id={clip}>
          <Path d={g.path} />
        </ClipPath>
        {/* A luz da foto só vale sobre a unha real: some em degradê perto da borda livre,
            para o alongamento (que fica sobre o fundo da foto) não ganhar uma emenda. */}
        <LinearGradient id={`${id}-fade-light`} gradientUnits="userSpaceOnUse" x1={0} y1={g.freeEdgeY} x2={0} y2={g.freeEdgeY + h * 0.35}>
          <Stop offset="0" stopColor="#FFF" stopOpacity={0} />
          <Stop offset="1" stopColor="#FFF" stopOpacity={1} />
        </LinearGradient>
        <Mask id={`${id}-natural`} maskUnits="userSpaceOnUse" x={-a * 2} y={g.tipY - a} width={a * 4} height={length + a * 3}>
          <Rect x={-a * 2} y={g.freeEdgeY} width={a * 4} height={g.baseY - g.freeEdgeY + a} fill={`url(#${id}-fade-light)`} />
        </Mask>
        {/* Curvatura: as laterais da unha escurecem rápido, o centro fica com a cor pura. */}
        <LinearGradient id={`${id}-curve`} gradientUnits="userSpaceOnUse" x1={-a} y1={0} x2={a} y2={0}>
          <Stop offset="0" stopColor="#000" stopOpacity={0.4} />
          <Stop offset="0.12" stopColor="#000" stopOpacity={0.14} />
          <Stop offset="0.3" stopColor="#000" stopOpacity={0} />
          <Stop offset="0.7" stopColor="#000" stopOpacity={0} />
          <Stop offset="0.88" stopColor="#000" stopOpacity={0.15} />
          <Stop offset="1" stopColor="#000" stopOpacity={0.42} />
        </LinearGradient>
        <LinearGradient id={`${id}-cuticle`} gradientUnits="userSpaceOnUse" x1={0} y1={g.baseY} x2={0} y2={g.baseY - h * 0.3}>
          <Stop offset="0" stopColor="#000" stopOpacity={0.16} />
          <Stop offset="1" stopColor="#000" stopOpacity={0} />
        </LinearGradient>
        {/* Reflexo do top coat: faixa estreita e nítida, com queda suave só nas pontas. */}
        <RadialGradient id={`${id}-streak`} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor="#FFF" stopOpacity={0.7 * gloss} />
          <Stop offset="0.45" stopColor="#FFF" stopOpacity={0.45 * gloss} />
          <Stop offset="0.8" stopColor="#FFF" stopOpacity={0.12 * gloss} />
          <Stop offset="1" stopColor="#FFF" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`${id}-bloom`} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor="#FFF" stopOpacity={design === 'matte' ? 0.1 : 0.18 * gloss} />
          <Stop offset="1" stopColor="#FFF" stopOpacity={0} />
        </RadialGradient>
        {design === 'baby-boomer' && (
          <LinearGradient id={`${id}-fade`} gradientUnits="userSpaceOnUse" x1={0} y1={g.tipY} x2={0} y2={g.baseY}>
            <Stop offset="0" stopColor={color} />
            <Stop offset="0.25" stopColor={color} />
            <Stop offset="0.9" stopColor={NUDE} stopOpacity={0.55} />
          </LinearGradient>
        )}
        {/* Cromado: espelho cilíndrico, com faixas de luz no sentido do comprimento da unha. */}
        {design === 'cromado' && (
          <LinearGradient id={`${id}-chrome`} gradientUnits="userSpaceOnUse" x1={-a} y1={0} x2={a} y2={0}>
            <Stop offset="0" stopColor={mix(color, '#000000', 0.65)} />
            <Stop offset="0.12" stopColor={mix(color, '#000000', 0.3)} />
            <Stop offset="0.28" stopColor={mix(color, '#FFFFFF', 0.92)} />
            <Stop offset="0.38" stopColor={mix(color, '#FFFFFF', 0.35)} />
            <Stop offset="0.55" stopColor={color} />
            <Stop offset="0.7" stopColor={mix(color, '#FFFFFF', 0.55)} />
            <Stop offset="0.82" stopColor={mix(color, '#000000', 0.1)} />
            <Stop offset="1" stopColor={mix(color, '#000000', 0.6)} />
          </LinearGradient>
        )}
      </Defs>

      <G clipPath={`url(#${clip})`}>
        {design === 'francesinha' ? (
          <>
            <Path d={g.path} fill={MILKY_PINK} fillOpacity={0.7} />
            <Path
              d={`M ${-a * 1.2} ${g.tipY - 2} L ${a * 1.2} ${g.tipY - 2} L ${a * 1.2} ${smileSide} Q 0 ${2 * smileCenter - smileSide} ${-a * 1.2} ${smileSide} Z`}
              fill={color}
            />
          </>
        ) : (
          <Path d={g.path} fill={fill} />
        )}

        {design === 'glitter' && (
          <>
            {GLITTER.map((p, i) => (
              <Circle
                key={i}
                cx={p.x * a}
                cy={g.tipY + p.y * length}
                r={p.r * a}
                fill={p.tone < SPARKLE_TONES.length ? SPARKLE_TONES[p.tone] : mix(color, '#FFFFFF', 0.5)}
                fillOpacity={p.opacity}
              />
            ))}
            {FLAKES.map((f, i) => (
              <Path key={i} d={hexagon(f.x * a, g.tipY + f.y * length, f.r * a, f.angle)} fill={f.tone} fillOpacity={f.opacity} />
            ))}
          </>
        )}

        {design === 'poa' &&
          POA.map(([x, y], i) => (
            <Circle key={i} cx={x * a} cy={g.tipY + y * length} r={a * 0.13} fill={isLight(color) ? '#2B1220' : '#FFFFFF'} />
          ))}

        {/* No matte a luz da foto entra fraca: a superfície aveludada não reflete. */}
        {lighting && (
          <G mask={`url(#${id}-natural)`} opacity={design === 'matte' ? 0.35 : 1}>
            {lighting}
          </G>
        )}

        <Rect x={-a} y={g.tipY} width={a * 2} height={length + a} fill={`url(#${id}-curve)`} />
        <Rect x={-a} y={g.baseY - h * 0.3} width={a * 2} height={h * 0.3 + a} fill={`url(#${id}-cuticle)`} />
        <Path d={g.path} fill="none" stroke={mix(color, '#000000', 0.45)} strokeOpacity={0.22} strokeWidth={a * 0.12} />

        <Ellipse cx={-a * 0.1} cy={g.tipY + length * 0.45} rx={a * 0.8} ry={length * 0.5} fill={`url(#${id}-bloom)`} />
        {gloss > 0 && (
          <>
            {/* Faixa de luz ao longo da unha e reflexo curvo onde a ponta se curva. */}
            <Ellipse cx={-a * 0.45} cy={g.tipY + length * 0.5} rx={a * 0.13} ry={length * 0.32} fill={`url(#${id}-streak)`} />
            <Ellipse cx={a * 0.1} cy={g.tipY + length * 0.14} rx={a * 0.45} ry={length * 0.05} fill={`url(#${id}-streak)`} />
          </>
        )}
      </G>
    </G>
  );
}
