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

const SHEER_PINK = '#F3C6C0';
const NUDE = '#F3D3CB';

// Partículas fixas (sequência R2) para o glitter não mudar a cada renderização.
const GLITTER = Array.from({ length: 90 }, (_, i) => ({
  x: ((0.5 + i * 0.7548776662) % 1) * 2 - 1,
  y: (0.5 + i * 0.569840291) % 1,
  r: 0.025 + ((i * 7) % 5) * 0.012,
  tone: i % 4,
  opacity: 0.65 + ((i * 3) % 4) * 0.1,
}));

const POA = [
  [-0.45, 0.12], [0.4, 0.22], [-0.05, 0.36], [0.45, 0.5], [-0.4, 0.58], [0.1, 0.74], [-0.3, 0.88], [0.42, 0.85],
];

// Esmalte desenhado dentro do contorno da unha, em coordenadas locais (ver nailGeometry).
export function NailArt({ id, w, h, color, design, shape, lighting }: Props) {
  const g = nailGeometry(shape, w, h);
  const a = g.halfWidth;
  const length = g.baseY - g.tipY;
  const glossy = design !== 'cremoso';
  const clip = `${id}-clip`;

  const smileSide = g.freeEdgeY + h * 0.2;
  const smileCenter = g.freeEdgeY + h * 0.05;

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
        <LinearGradient id={`${id}-curve`} gradientUnits="userSpaceOnUse" x1={-a} y1={0} x2={a} y2={0}>
          <Stop offset="0" stopColor="#000" stopOpacity={0.28} />
          <Stop offset="0.28" stopColor="#000" stopOpacity={0} />
          <Stop offset="0.72" stopColor="#000" stopOpacity={0} />
          <Stop offset="1" stopColor="#000" stopOpacity={0.3} />
        </LinearGradient>
        <LinearGradient id={`${id}-cuticle`} gradientUnits="userSpaceOnUse" x1={0} y1={g.baseY} x2={0} y2={g.baseY - h * 0.3}>
          <Stop offset="0" stopColor="#000" stopOpacity={0.16} />
          <Stop offset="1" stopColor="#000" stopOpacity={0} />
        </LinearGradient>
        {/* Reflexo do top coat: faixa suave numa lateral, sem bordas duras. */}
        <RadialGradient id={`${id}-shine`} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor="#FFF" stopOpacity={glossy ? 0.45 : 0.2} />
          <Stop offset="0.55" stopColor="#FFF" stopOpacity={glossy ? 0.15 : 0.06} />
          <Stop offset="1" stopColor="#FFF" stopOpacity={0} />
        </RadialGradient>
        {design === 'baby-boomer' && (
          <LinearGradient id={`${id}-fade`} gradientUnits="userSpaceOnUse" x1={0} y1={g.tipY} x2={0} y2={g.baseY}>
            <Stop offset="0" stopColor={color} />
            <Stop offset="0.25" stopColor={color} />
            <Stop offset="0.9" stopColor={NUDE} stopOpacity={0.55} />
          </LinearGradient>
        )}
        {design === 'cromado' && (
          <LinearGradient id={`${id}-chrome`} gradientUnits="userSpaceOnUse" x1={-a} y1={g.tipY} x2={a} y2={g.baseY}>
            <Stop offset="0" stopColor={mix(color, '#000000', 0.35)} />
            <Stop offset="0.3" stopColor={mix(color, '#FFFFFF', 0.7)} />
            <Stop offset="0.45" stopColor={color} />
            <Stop offset="0.62" stopColor={mix(color, '#FFFFFF', 0.45)} />
            <Stop offset="1" stopColor={mix(color, '#000000', 0.4)} />
          </LinearGradient>
        )}
      </Defs>

      <G clipPath={`url(#${clip})`}>
        {design === 'francesinha' ? (
          <>
            <Path d={g.path} fill={SHEER_PINK} fillOpacity={0.55} />
            <Path
              d={`M ${-a * 1.2} ${g.tipY - 2} L ${a * 1.2} ${g.tipY - 2} L ${a * 1.2} ${smileSide} Q 0 ${2 * smileCenter - smileSide} ${-a * 1.2} ${smileSide} Z`}
              fill={color}
            />
          </>
        ) : (
          <Path
            d={g.path}
            fill={design === 'baby-boomer' ? `url(#${id}-fade)` : design === 'cromado' ? `url(#${id}-chrome)` : color}
          />
        )}

        {design === 'glitter' &&
          GLITTER.map((p, i) => (
            <Circle
              key={i}
              cx={p.x * a}
              cy={g.tipY + p.y * length}
              r={p.r * a}
              fill={p.tone === 0 ? '#F5D78E' : p.tone === 1 ? '#FFFFFF' : mix(color, '#FFFFFF', 0.55)}
              fillOpacity={p.opacity}
            />
          ))}

        {design === 'poa' &&
          POA.map(([x, y], i) => (
            <Circle key={i} cx={x * a} cy={g.tipY + y * length} r={a * 0.13} fill={isLight(color) ? '#2B1220' : '#FFFFFF'} />
          ))}

        {lighting && <G mask={`url(#${id}-natural)`}>{lighting}</G>}

        <Rect x={-a} y={g.tipY} width={a * 2} height={length + a} fill={`url(#${id}-curve)`} />
        <Rect x={-a} y={g.baseY - h * 0.3} width={a * 2} height={h * 0.3 + a} fill={`url(#${id}-cuticle)`} />
        <Path d={g.path} fill="none" stroke={mix(color, '#000000', 0.45)} strokeOpacity={0.22} strokeWidth={a * 0.12} />

        <Ellipse cx={-a * 0.42} cy={g.tipY + length * 0.45} rx={a * 0.22} ry={length * 0.4} fill={`url(#${id}-shine)`} />
        {glossy && <Ellipse cx={a * 0.45} cy={g.tipY + length * 0.3} rx={a * 0.14} ry={length * 0.2} fill={`url(#${id}-shine)`} />}
      </G>
    </G>
  );
}
