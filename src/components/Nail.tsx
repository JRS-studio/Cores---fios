import { useId } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg from 'react-native-svg';

import type { DesignId, ShapeId } from '@/data/catalog';
import { nailGeometry } from '@/features/nails/geometry';
import { NailArt } from '@/features/nails/NailArt';

type Props = {
  color: string;
  design?: DesignId;
  shape?: ShapeId;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

// Miniatura de unha esmaltada (amostras, cards de design, looks salvos).
export function Nail({ color, design = 'gel', shape = 'natural', width = 34, height = 46, style }: Props) {
  const id = `n${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  // Desenha numa unidade fixa e deixa o viewBox ajustar ao espaço disponível.
  const w = 34;
  const h = 40;
  const g = nailGeometry(shape, w, h);
  const top = g.tipY - 1;
  const bottom = g.baseY + w * 0.1 + 1;

  return (
    <View style={[{ width, height }, style]}>
      <Svg width="100%" height="100%" viewBox={`${-w / 2 - 1} ${top} ${w + 2} ${bottom - top}`}>
        <NailArt id={id} w={w} h={h} color={color} design={design} shape={shape} />
      </Svg>
    </View>
  );
}
