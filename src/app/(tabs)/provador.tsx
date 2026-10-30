import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Nail } from '@/components/Nail';
import { ACCENT_PRICE, designById, designs, polishById, polishes, type DesignId } from '@/data/catalog';
import { SAMPLE_NAILS } from '@/features/tryon/SampleHand';
import { TryOnCanvas } from '@/features/tryon/TryOnCanvas';
import { TryOnIntro } from '@/features/tryon/TryOnIntro';
import type { Look, NailSpot, SavedLook } from '@/features/tryon/types';
import { colors, fonts, radius, shadow } from '@/theme';

const MAX_NAILS = 5;
const ACCENT_OPTIONS: (DesignId | null)[] = [null, 'glitter', 'poa', 'cromado', 'francesinha'];
const INITIAL_LOOK: Look = { polishId: 'rubi', designId: 'gel', accentDesign: null };

const brl = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

const lookPrice = (look: Look) => designById(look.designId).price + (look.accentDesign ? ACCENT_PRICE : 0);

export default function ProvadorScreen() {
  const insets = useSafeAreaInsets();
  const [source, setSource] = useState<{ uri: string } | 'sample' | null>(null);
  const [nails, setNails] = useState<NailSpot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [look, setLook] = useState<Look>(INITIAL_LOOK);
  const [accentNailId, setAccentNailId] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedLook[]>([]);

  const polish = polishById(look.polishId);
  const design = designById(look.designId);
  const total = lookPrice(look);
  // Por padrão a unha de destaque é o anelar (4ª unha marcada).
  const accentTarget = accentNailId ?? nails[3]?.id ?? nails[nails.length - 1]?.id ?? null;
  const selected = nails.find((n) => n.id === selectedId);

  async function pickImage(fromCamera: boolean) {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', fromCamera ? 'Libere o acesso à câmera nas configurações.' : 'Libere o acesso às fotos nas configurações.');
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [3, 4], quality: 0.8 };
    const result = fromCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    setSource({ uri: result.assets[0].uri });
    setNails([]);
    setSelectedId(null);
    setAccentNailId(null);
    setEditing(true);
  }

  function startSample() {
    setSource('sample');
    setNails(SAMPLE_NAILS);
    setSelectedId(null);
    setAccentNailId('anelar');
    setEditing(false);
  }

  function reset() {
    setSource(null);
    setNails([]);
    setSelectedId(null);
    setEditing(false);
  }

  function addNail(x: number, y: number) {
    if (nails.length >= MAX_NAILS) return;
    const nail: NailSpot = { id: `n${Date.now()}`, x, y, w: 0.1, h: 0.14, rotation: 0 };
    setNails((prev) => [...prev, nail]);
    setSelectedId(nail.id);
  }

  function updateSelected(patch: (n: NailSpot) => Partial<NailSpot>) {
    setNails((prev) => prev.map((n) => (n.id === selectedId ? { ...n, ...patch(n) } : n)));
  }

  function removeSelected() {
    setNails((prev) => prev.filter((n) => n.id !== selectedId));
    if (accentNailId === selectedId) setAccentNailId(null);
    setSelectedId(null);
  }

  function selectNail(id: string) {
    setSelectedId(id);
    // Fora do modo de ajuste, tocar numa unha a escolhe como unha de destaque.
    if (!editing) setAccentNailId(id);
  }

  function saveLook() {
    const exists = saved.some(
      (s) => s.polishId === look.polishId && s.designId === look.designId && s.accentDesign === look.accentDesign,
    );
    if (exists) return;
    setSaved((prev) => [{ ...look, id: `${Date.now()}` }, ...prev].slice(0, 6));
  }

  function schedule() {
    const accent = look.accentDesign ? ` + destaque ${designById(look.accentDesign).name}` : '';
    router.navigate({
      pathname: '/agenda',
      params: { servico: `${design.name} ${polish.name}${accent}`, valor: String(total) },
    });
  }

  return (
    <ScrollView
      style={styles.screen}
      scrollEnabled={!dragging}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 130, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Provador Virtual</Text>
          <Text style={styles.subtitle}>
            {!source ? 'Teste cores e designs na sua mão' : editing ? 'Marque e ajuste as unhas' : 'Escolha a cor e o design'}
          </Text>
        </View>
        {source && (
          <Pressable style={styles.iconButton} onPress={reset} accessibilityLabel="Trocar foto">
            <Ionicons name="camera-reverse-outline" size={22} color={colors.plum} />
          </Pressable>
        )}
      </View>

      {!source ? (
        <TryOnIntro onCamera={() => pickImage(true)} onGallery={() => pickImage(false)} onSample={startSample} />
      ) : (
        <>
          {editing && (
            <View style={styles.hint}>
              <Ionicons name="finger-print-outline" size={18} color={colors.wine} />
              <Text style={styles.hintText}>
                {nails.length < MAX_NAILS
                  ? `Toque sobre cada unha da foto para marcá-la (${nails.length}/${MAX_NAILS}). Arraste para posicionar.`
                  : 'Todas as unhas marcadas. Arraste e ajuste o tamanho se precisar.'}
              </Text>
            </View>
          )}

          <TryOnCanvas
            source={source}
            nails={nails}
            look={look}
            accentNailId={accentTarget}
            editing={editing}
            showOriginal={showOriginal}
            selectedId={editing ? selectedId : null}
            onSelect={selectNail}
            onAddNail={addNail}
            onMoveNail={(id, x, y) => setNails((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)))}
            onDragStateChange={setDragging}
          />

          {editing ? (
            <>
              <View style={[styles.card, !selected && styles.disabled]} pointerEvents={selected ? 'auto' : 'none'}>
                <Text style={styles.cardTitle}>{selected ? 'Ajustar unha selecionada' : 'Selecione uma unha para ajustar'}</Text>
                <View style={styles.adjustRow}>
                  <Stepper
                    label="Tamanho"
                    onMinus={() => updateSelected((n) => ({ w: n.w * 0.9, h: n.h * 0.9 }))}
                    onPlus={() => updateSelected((n) => ({ w: n.w * 1.1, h: n.h * 1.1 }))}
                  />
                  <Stepper
                    label="Comprimento"
                    onMinus={() => updateSelected((n) => ({ h: Math.max(n.h - 0.012, n.w * 0.8) }))}
                    onPlus={() => updateSelected((n) => ({ h: n.h + 0.012 }))}
                  />
                  <Stepper
                    label="Girar"
                    minusIcon="arrow-undo"
                    plusIcon="arrow-redo"
                    onMinus={() => updateSelected((n) => ({ rotation: n.rotation - 10 }))}
                    onPlus={() => updateSelected((n) => ({ rotation: n.rotation + 10 }))}
                  />
                </View>
                <Pressable onPress={removeSelected} style={styles.remove} hitSlop={6}>
                  <Ionicons name="trash-outline" size={16} color={colors.wine} />
                  <Text style={styles.removeText}>Remover unha</Text>
                </Pressable>
              </View>

              <Pressable
                style={[styles.primary, nails.length === 0 && styles.disabled]}
                disabled={nails.length === 0}
                onPress={() => {
                  setEditing(false);
                  setSelectedId(null);
                }}
              >
                <Text style={styles.primaryText}>Continuar para cores e designs</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.white} />
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.toolbar}>
                <Pressable
                  style={styles.toolButton}
                  onPressIn={() => setShowOriginal(true)}
                  onPressOut={() => setShowOriginal(false)}
                >
                  <Ionicons name="eye-outline" size={16} color={colors.plum} />
                  <Text style={styles.toolText}>Segure: antes</Text>
                </Pressable>
                <Pressable style={styles.toolButton} onPress={() => setEditing(true)}>
                  <Ionicons name="move-outline" size={16} color={colors.plum} />
                  <Text style={styles.toolText}>Ajustar unhas</Text>
                </Pressable>
              </View>

              <Text style={styles.sectionTitle}>Cores</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.hList}>
                {polishes.map((p) => {
                  const active = p.id === look.polishId;
                  return (
                    <Pressable key={p.id} style={styles.swatch} onPress={() => setLook({ ...look, polishId: p.id })}>
                      <View style={[styles.swatchRing, active && styles.swatchRingActive]}>
                        <View style={[styles.swatchColor, { backgroundColor: p.color }]} />
                      </View>
                      <Text style={[styles.swatchName, active && styles.swatchNameActive]} numberOfLines={1}>
                        {p.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={styles.sectionTitle}>Design</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.hList}>
                {designs.map((d) => {
                  const active = d.id === look.designId;
                  return (
                    <Pressable key={d.id} style={[styles.designCard, active && styles.designCardActive]} onPress={() => setLook({ ...look, designId: d.id })}>
                      <Nail color={polish.color} design={d.id} width={30} height={42} />
                      <Text style={[styles.designName, active && styles.designNameActive]}>{d.name}</Text>
                      <Text style={[styles.designPrice, active && styles.designPriceActive]}>{brl(d.price)}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={styles.sectionTitle}>Unha de destaque</Text>
              <Text style={styles.sectionHint}>Toque numa unha da foto para escolher qual recebe o destaque (+{brl(ACCENT_PRICE)}).</Text>
              <View style={styles.chips}>
                {ACCENT_OPTIONS.map((id) => {
                  const active = look.accentDesign === id;
                  return (
                    <Pressable key={id ?? 'none'} style={[styles.chip, active && styles.chipActive]} onPress={() => setLook({ ...look, accentDesign: id })}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{id ? designById(id).name : 'Nenhuma'}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.card, styles.summary]}>
                <Text style={styles.summaryLabel}>Seu serviço</Text>
                <View style={styles.summaryRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.summaryTitle}>
                      {design.name} · {polish.name}
                    </Text>
                    <Text style={styles.summaryDetail}>
                      {design.description}
                      {look.accentDesign ? ` + destaque ${designById(look.accentDesign).name.toLowerCase()}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.summaryPrice}>{brl(total)}</Text>
                </View>
                <View style={styles.summaryActions}>
                  <Pressable style={styles.outline} onPress={saveLook}>
                    <Ionicons name="heart-outline" size={18} color={colors.plum} />
                    <Text style={styles.outlineText}>Salvar look</Text>
                  </Pressable>
                  <Pressable style={[styles.primary, styles.primaryCompact]} onPress={schedule}>
                    <Ionicons name="calendar" size={18} color={colors.roseGoldLight} />
                    <Text style={styles.primaryText}>Agendar</Text>
                  </Pressable>
                </View>
              </View>

              {saved.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Looks salvos</Text>
                  <Text style={styles.sectionHint}>Toque para comparar na foto.</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.hList}>
                    {saved.map((s) => (
                      <Pressable key={s.id} style={styles.savedCard} onPress={() => setLook(s)}>
                        <View style={styles.savedNails}>
                          {[0, 1, 2].map((i) => (
                            <Nail
                              key={i}
                              color={polishById(s.polishId).color}
                              design={i === 2 && s.accentDesign ? s.accentDesign : s.designId}
                              width={20}
                              height={28}
                            />
                          ))}
                        </View>
                        <Text style={styles.savedName} numberOfLines={1}>
                          {designById(s.designId).name} · {polishById(s.polishId).name}
                        </Text>
                        <Text style={styles.designPrice}>{brl(lookPrice(s))}</Text>
                        <Pressable
                          style={styles.savedRemove}
                          hitSlop={8}
                          onPress={() => setSaved((prev) => prev.filter((x) => x.id !== s.id))}
                          accessibilityLabel="Remover look"
                        >
                          <Ionicons name="close" size={14} color={colors.muted} />
                        </Pressable>
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              )}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

type StepperProps = {
  label: string;
  onMinus: () => void;
  onPlus: () => void;
  minusIcon?: keyof typeof Ionicons.glyphMap;
  plusIcon?: keyof typeof Ionicons.glyphMap;
};

function Stepper({ label, onMinus, onPlus, minusIcon = 'remove', plusIcon = 'add' }: StepperProps) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperButtons}>
        <Pressable style={styles.stepperButton} onPress={onMinus} accessibilityLabel={`${label}: diminuir`}>
          <Ionicons name={minusIcon} size={18} color={colors.plum} />
        </Pressable>
        <Pressable style={styles.stepperButton} onPress={onPlus} accessibilityLabel={`${label}: aumentar`}>
          <Ionicons name={plusIcon} size={18} color={colors.plum} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.blush,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 12,
  },
  hintText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.ink,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 16,
    marginTop: 14,
    ...shadow,
  },
  cardTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink,
    marginBottom: 12,
  },
  disabled: {
    opacity: 0.45,
  },
  adjustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepper: {
    alignItems: 'center',
    gap: 6,
  },
  stepperLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.muted,
  },
  stepperButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    marginTop: 14,
  },
  removeText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.wine,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.plum,
    borderRadius: radius.pill,
    paddingVertical: 16,
    marginTop: 16,
  },
  primaryCompact: {
    flex: 1,
    marginTop: 0,
    paddingVertical: 13,
  },
  primaryText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.white,
  },
  toolbar: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  toolButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toolText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.plum,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 19,
    color: colors.ink,
    marginTop: 22,
    marginBottom: 10,
  },
  sectionHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: -6,
    marginBottom: 10,
  },
  bleed: {
    marginHorizontal: -20,
  },
  hList: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 10,
  },
  swatch: {
    alignItems: 'center',
    width: 62,
    gap: 6,
  },
  swatchRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    padding: 3,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchRingActive: {
    borderColor: colors.plum,
  },
  swatchColor: {
    flex: 1,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  swatchName: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.muted,
  },
  swatchNameActive: {
    fontFamily: fonts.semibold,
    color: colors.plum,
  },
  designCard: {
    width: 104,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: 14,
    gap: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  designCardActive: {
    backgroundColor: colors.plum,
    borderColor: colors.plum,
  },
  designName: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.ink,
    marginTop: 6,
  },
  designNameActive: {
    color: colors.white,
  },
  designPrice: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.wine,
  },
  designPriceActive: {
    color: colors.roseGoldLight,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.wine,
    borderColor: colors.wine,
  },
  chipText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.ink,
  },
  chipTextActive: {
    color: colors.white,
  },
  summary: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: colors.roseGoldLight,
  },
  summaryLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.roseGold,
    textTransform: 'uppercase',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  summaryTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
  },
  summaryDetail: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  summaryPrice: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.wine,
  },
  summaryActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  outline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.plum,
    paddingVertical: 12,
  },
  outlineText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.plum,
  },
  savedCard: {
    width: 130,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 12,
    alignItems: 'center',
    gap: 4,
    ...shadow,
  },
  savedNails: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  savedName: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.ink,
  },
  savedRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
});
