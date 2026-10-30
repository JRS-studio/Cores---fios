import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { NailSpot } from './types';

// Ilustração de mão usada no modo demonstração (sem foto). As posições das unhas abaixo
// casam com os dedos desenhados (viewBox 300x400, mesma proporção 3:4 do provador).
export const SAMPLE_NAILS: NailSpot[] = [
  { id: 'polegar', x: 0.127, y: 0.58, w: 0.12, h: 0.15, rotation: -25 },
  { id: 'indicador', x: 0.323, y: 0.33, w: 0.1, h: 0.14, rotation: 0 },
  { id: 'medio', x: 0.473, y: 0.243, w: 0.107, h: 0.15, rotation: 0 },
  { id: 'anelar', x: 0.623, y: 0.295, w: 0.1, h: 0.14, rotation: 0 },
  { id: 'minimo', x: 0.76, y: 0.408, w: 0.087, h: 0.12, rotation: 0 },
];

export function SampleHand() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F7ECE8" />
          <Stop offset="1" stopColor="#EAD3CB" />
        </LinearGradient>
        <LinearGradient id="skin" gradientUnits="userSpaceOnUse" x1="40" y1="60" x2="260" y2="400">
          <Stop offset="0" stopColor="#F1CDB8" />
          <Stop offset="1" stopColor="#DDAE95" />
        </LinearGradient>
      </Defs>

      <Rect width="300" height="400" fill="url(#bg)" />
      <Circle cx="250" cy="60" r="90" fill="#FFFFFF" opacity={0.35} />

      <G fill="url(#skin)">
        <G transform="rotate(-25 95 320)">
          <Rect x="60" y="190" width="42" height="150" rx="21" />
        </G>
        <Rect x="78" y="105" width="38" height="200" rx="19" />
        <Rect x="122" y="70" width="40" height="230" rx="20" />
        <Rect x="168" y="92" width="38" height="210" rx="19" />
        <Rect x="212" y="140" width="32" height="170" rx="16" />
        <Path d="M76 262 Q78 236 97 232 Q118 228 142 230 Q170 228 190 232 Q226 236 246 258 Q250 300 240 330 Q232 365 226 400 L92 400 Q86 362 80 330 Q74 296 76 262 Z" />
      </G>

      {/* dobras dos dedos */}
      <G stroke="#C99780" strokeWidth={1.2} strokeLinecap="round" opacity={0.45}>
        <Path d="M88 200 Q97 204 106 200" />
        <Path d="M132 175 Q142 179 152 175" />
        <Path d="M177 190 Q187 194 197 190" />
        <Path d="M220 222 Q228 225 236 222" />
      </G>
    </Svg>
  );
}
