import { useRef, useState, type ComponentRef } from 'react';
import { Image, PanResponder, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, {
  Defs,
  FeColorMatrix,
  FeComposite,
  FeGaussianBlur,
  FeMerge,
  FeMergeNode,
  Filter,
  G,
  Image as SvgImage,
} from 'react-native-svg';

import { polishById } from '@/data/catalog';
import { NailArt } from '@/features/nails/NailArt';
import { colors, radius } from '@/theme';
import { SampleHand } from './SampleHand';
import type { Look, NailSpot } from './types';

type Props = {
  source: { uri: string } | 'sample';
  nails: NailSpot[];
  look: Look;
  accentNailId: string | null;
  editing: boolean;
  showOriginal: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddNail: (x: number, y: number) => void;
  onMoveNail: (id: string, x: number, y: number) => void;
  onDragStateChange: (dragging: boolean) => void;
};

const clamp = (v: number) => Math.min(Math.max(v, 0), 1);

// Transferência de luz da foto para o esmalte (filtro passa-alta): compara cada ponto da
// unha real com a média ao redor. O que é mais claro que a vizinhança (reflexos, relevo)
// vira brilho branco; o que é mais escuro (sombras, bordas, cutícula) vira sombra.
// A cor média não passa, então o tom do esmalte continua fiel ao vidro.
const LUM = '0.299 0.587 0.114';
const TO_LUMINANCE = `${LUM} 0 0  ${LUM} 0 0  ${LUM} 0 0  0 0 0 0 1`;
const INVERT = '-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0';
// Depois da composição, R = 0.5 + 0.5 * d (d = luz - média), então 2R - 1 recupera d.
// Diferenças abaixo do limiar são ignoradas para não clarear nem escurecer o tom do esmalte.
const HIGHLIGHT_GAIN = 2.8;
const SHADOW_GAIN = 2.4;
const THRESHOLD = 0.04;
const HIGHLIGHT_MATRIX = `0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  ${2 * HIGHLIGHT_GAIN} 0 0 0 ${-HIGHLIGHT_GAIN * (1 + THRESHOLD)}`;
const SHADOW_MATRIX = `0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${-2 * SHADOW_GAIN} 0 0 0 ${SHADOW_GAIN * (1 - THRESHOLD)}`;

export function TryOnCanvas(props: Props) {
  const { source, nails, look, accentNailId, editing, showOriginal, selectedId, onSelect, onAddNail } = props;
  const [size, setSize] = useState({ width: 0, height: 0 });
  const frameRef = useRef<ComponentRef<typeof View>>(null);
  const color = polishById(look.polishId).color;
  const { width: W, height: H } = size;
  // O raio do desfoque acompanha o tamanho das unhas na foto.
  const avgNailWidth = nails.length ? (nails.reduce((sum, n) => sum + n.w, 0) / nails.length) * W : 20;

  const onLayout = (e: LayoutChangeEvent) => setSize(e.nativeEvent.layout);

  return (
    <View ref={frameRef} style={styles.frame} onLayout={onLayout}>
      <Pressable
        style={StyleSheet.absoluteFill}
        disabled={!editing}
        onPress={(e) => {
          // locationX não é confiável entre plataformas (no web vem relativo ao filho tocado),
          // então a posição é calculada a partir do toque na janela.
          const { pageX, pageY } = e.nativeEvent;
          frameRef.current?.measureInWindow((x, y, width, height) => {
            if (width) onAddNail(clamp((pageX - x) / width), clamp((pageY - y) / height));
          });
        }}
      >
        {source === 'sample' ? (
          <SampleHand />
        ) : (
          <Image source={source} style={StyleSheet.absoluteFill} resizeMode="cover" />
        )}
      </Pressable>

      {!showOriginal && W > 0 && (
        <Svg
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, editing && { opacity: 0.6 }]}
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
        >
          {source !== 'sample' && (
            <Defs>
              <Filter id="nail-light" filterUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
                <FeColorMatrix in="SourceGraphic" type="matrix" values={TO_LUMINANCE} result="lum" />
                <FeGaussianBlur in="lum" stdDeviation={avgNailWidth * 0.2} result="avg" />
                <FeColorMatrix in="avg" type="matrix" values={INVERT} result="inv" />
                <FeComposite in="lum" in2="inv" operator="arithmetic" k1={0} k2={0.5} k3={0.5} k4={0} result="detail" />
                <FeColorMatrix in="detail" type="matrix" values={HIGHLIGHT_MATRIX} result="hi" />
                <FeColorMatrix in="detail" type="matrix" values={SHADOW_MATRIX} result="sh" />
                <FeMerge>
                  <FeMergeNode in="sh" />
                  <FeMergeNode in="hi" />
                </FeMerge>
              </Filter>
            </Defs>
          )}
          {nails.map((nail) => {
            const cx = nail.x * W;
            const cy = nail.y * H;
            return (
              <G key={nail.id} transform={`translate(${cx} ${cy}) rotate(${nail.rotation})`}>
                <NailArt
                  id={`nail-${nail.id}`}
                  w={nail.w * W}
                  h={nail.h * W}
                  color={color}
                  shape={look.shapeId}
                  design={nail.id === accentNailId && look.accentDesign ? look.accentDesign : look.designId}
                  lighting={
                    source !== 'sample' && (
                      // A foto inteira, desfeita a rotação da unha, para alinhar com o fundo.
                      <G transform={`rotate(${-nail.rotation}) translate(${-cx} ${-cy})`}>
                        <SvgImage
                          href={source.uri}
                          x={0}
                          y={0}
                          width={W}
                          height={H}
                          preserveAspectRatio="xMidYMid slice"
                          filter="url(#nail-light)"
                        />
                      </G>
                    )
                  }
                />
              </G>
            );
          })}
        </Svg>
      )}

      {!showOriginal &&
        W > 0 &&
        nails.map((nail) => (
          <NailHandle
            key={nail.id}
            nail={nail}
            size={size}
            editing={editing}
            selected={nail.id === selectedId}
            onSelect={onSelect}
            onMove={props.onMoveNail}
            onDragStateChange={props.onDragStateChange}
          />
        ))}
    </View>
  );
}

type HandleProps = {
  nail: NailSpot;
  size: { width: number; height: number };
  editing: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDragStateChange: (dragging: boolean) => void;
};

// Área de toque invisível sobre cada unha: seleciona e, no modo de ajuste, arrasta.
function NailHandle({ nail, size, editing, selected, onSelect, onMove, onDragStateChange }: HandleProps) {
  // PanResponder é criado uma vez; o ref mantém sempre as props mais recentes.
  const latest = useRef({ nail, size, editing, onSelect, onMove, onDragStateChange });
  latest.current = { nail, size, editing, onSelect, onMove, onDragStateChange };
  const start = useRef({ x: 0, y: 0 });

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const { nail: n, editing: canDrag } = latest.current;
        start.current = { x: n.x, y: n.y };
        latest.current.onSelect(n.id);
        if (canDrag) latest.current.onDragStateChange(true);
      },
      onPanResponderMove: (_, g) => {
        const { nail: n, size: s, editing: canDrag } = latest.current;
        if (!canDrag) return;
        latest.current.onMove(n.id, clamp(start.current.x + g.dx / s.width), clamp(start.current.y + g.dy / s.height));
      },
      onPanResponderRelease: () => latest.current.onDragStateChange(false),
      onPanResponderTerminate: () => latest.current.onDragStateChange(false),
    }),
  ).current;

  const w = nail.w * size.width;
  const h = nail.h * size.width;

  return (
    <View
      {...responder.panHandlers}
      style={[
        styles.handle,
        {
          width: w,
          height: h,
          left: nail.x * size.width - w / 2,
          top: nail.y * size.height - h / 2,
          borderTopLeftRadius: w / 2,
          borderTopRightRadius: w / 2,
          borderBottomLeftRadius: w / 2.5,
          borderBottomRightRadius: w / 2.5,
          transform: [{ rotate: `${nail.rotation}deg` }],
        },
        editing && selected && styles.selected,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.blush,
  },
  handle: {
    position: 'absolute',
  },
  selected: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.white,
  },
});
