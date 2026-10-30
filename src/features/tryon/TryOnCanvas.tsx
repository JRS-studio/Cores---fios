import { useRef, useState, type ComponentRef } from 'react';
import { Image, PanResponder, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Nail } from '@/components/Nail';
import { polishById } from '@/data/catalog';
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

export function TryOnCanvas(props: Props) {
  const { source, nails, look, accentNailId, editing, showOriginal, selectedId, onSelect, onAddNail } = props;
  const [size, setSize] = useState({ width: 0, height: 0 });
  const frameRef = useRef<ComponentRef<typeof View>>(null);
  const color = polishById(look.polishId).color;

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

      {!showOriginal &&
        size.width > 0 &&
        nails.map((nail) => (
          <DraggableNail
            key={nail.id}
            nail={nail}
            size={size}
            color={color}
            design={nail.id === accentNailId && look.accentDesign ? look.accentDesign : look.designId}
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

type DraggableProps = {
  nail: NailSpot;
  size: { width: number; height: number };
  color: string;
  design: Look['designId'];
  editing: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDragStateChange: (dragging: boolean) => void;
};

function DraggableNail({ nail, size, color, design, editing, selected, onSelect, onMove, onDragStateChange }: DraggableProps) {
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
        styles.nailSpot,
        {
          left: nail.x * size.width - w / 2,
          top: nail.y * size.height - h / 2,
          transform: [{ rotate: `${nail.rotation}deg` }],
          opacity: editing ? 0.75 : 0.96,
        },
      ]}
    >
      <Nail color={color} design={design} width={w} height={h} />
      {selected && <View pointerEvents="none" style={[styles.selection, { borderRadius: w }]} />}
    </View>
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
  nailSpot: {
    position: 'absolute',
  },
  selection: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.white,
  },
});
