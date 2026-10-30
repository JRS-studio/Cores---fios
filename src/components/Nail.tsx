import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { DesignId } from '@/data/catalog';

type Props = {
  color: string;
  design?: DesignId;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

const NUDE_BASE = '#F2D8CE';

// Pontos fixos (em %) para o glitter não "piscar" a cada renderização.
// Sequência quase-aleatória R2: espalha os pontos de forma uniforme, sem padrões visíveis.
const GLITTER = Array.from({ length: 26 }, (_, i) => ({
  left: ((0.5 + i * 0.7548776662) % 1) * 88 + 2,
  top: ((0.5 + i * 0.5698402910) % 1) * 86 + 4,
  size: 1.5 + ((i * 7) % 3),
  gold: i % 3 === 0,
}));

const POA = [
  [28, 18], [68, 30], [38, 46], [74, 58], [26, 72], [60, 84],
];

function mix(hex: string, target: string, amount: number) {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(target.slice(1), 16);
  const ch = (shift: number) =>
    Math.round(((a >> shift) & 255) * (1 - amount) + ((b >> shift) & 255) * amount);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 170;
}

// Unha estilizada (formato amendoado) com brilho; o `design` define o acabamento aplicado.
export function Nail({ color, design = 'gel', width = 34, height = 46, style }: Props) {
  const shape: ViewStyle = {
    width,
    height,
    borderTopLeftRadius: width / 2,
    borderTopRightRadius: width / 2,
    borderBottomLeftRadius: width * 0.3,
    borderBottomRightRadius: width * 0.3,
  };

  return (
    <View style={[styles.nail, shape, { backgroundColor: design === 'francesinha' ? NUDE_BASE : color }, style]}>
      {design === 'francesinha' && (
        <View
          style={[
            styles.frenchTip,
            {
              backgroundColor: color,
              height: height * 0.34,
              borderBottomLeftRadius: width * 0.7,
              borderBottomRightRadius: width * 0.7,
            },
          ]}
        />
      )}

      {design === 'baby-boomer' && (
        <LinearGradient colors={[color, mix(color, NUDE_BASE, 0.55), NUDE_BASE]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      )}

      {design === 'cromado' && (
        <LinearGradient
          colors={[mix(color, '#000000', 0.25), mix(color, '#FFFFFF', 0.75), color, mix(color, '#FFFFFF', 0.5), mix(color, '#000000', 0.3)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      {design === 'glitter' &&
        GLITTER.map((dot, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: `${dot.left}%`,
              top: `${dot.top}%`,
              width: dot.size * (width / 34),
              height: dot.size * (width / 34),
              borderRadius: dot.size,
              backgroundColor: dot.gold ? '#F5D78E' : 'rgba(255,255,255,0.9)',
            }}
          />
        ))}

      {design === 'poa' &&
        POA.map(([left, top], i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: `${top}%`,
              width: width * 0.16,
              height: width * 0.16,
              borderRadius: width,
              backgroundColor: isLight(color) ? '#2B1220' : '#FFFFFF',
            }}
          />
        ))}

      {design !== 'cremoso' && (
        <LinearGradient
          colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.shine, { width: width * 0.26, height: height * 0.55, borderRadius: width }]}
        />
      )}
      {design === 'cremoso' && (
        <View style={[styles.shine, styles.softShine, { width: width * 0.2, height: height * 0.4, borderRadius: width }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  nail: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  frenchTip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  shine: {
    position: 'absolute',
    top: '12%',
    left: '18%',
  },
  softShine: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
});
