import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Nail } from '@/components/Nail';
import { colors, fonts, radius, shadow } from '@/theme';

type Props = {
  onCamera: () => void;
  onGallery: () => void;
  onSample: () => void;
  sampleLabel?: string;
};

const STEPS = [
  { icon: 'camera-outline', title: 'Fotografe a mão', text: 'Dedos afastados, mão apoiada e boa luz.' },
  { icon: 'finger-print-outline', title: 'Marque as unhas', text: 'Toque sobre cada unha da foto.' },
  { icon: 'color-palette-outline', title: 'Teste e escolha', text: 'Cores, designs e o valor do serviço na hora.' },
] as const;

const PREVIEW = [
  { color: '#B3123C', design: 'gel' },
  { color: '#E7BFB0', design: 'francesinha' },
  { color: '#6B2D5C', design: 'glitter' },
  { color: '#E8A0B4', design: 'poa' },
  { color: '#D9C2A0', design: 'cromado' },
] as const;

export function TryOnIntro({ onCamera, onGallery, onSample, sampleLabel = 'Experimentar com mão de exemplo' }: Props) {
  return (
    <View>
      <LinearGradient colors={[colors.wine, colors.plum]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.glow} />
        <Text style={styles.eyebrow}>PROVADOR VIRTUAL</Text>
        <Text style={styles.title}>
          Veja antes de <Text style={styles.titleItalic}>escolher</Text>
        </Text>
        <Text style={styles.subtitle}>
          Experimente esmaltes e designs na sua própria mão e descubra o serviço perfeito.
        </Text>
        <View style={styles.previewRow}>
          {PREVIEW.map((p, i) => (
            <Nail key={i} color={p.color} design={p.design} width={36} height={50} style={{ marginTop: i % 2 ? 0 : 10 }} />
          ))}
        </View>
      </LinearGradient>

      <View style={styles.steps}>
        {STEPS.map((step, i) => (
          <View key={step.title} style={styles.step}>
            <View style={styles.stepIcon}>
              <Ionicons name={step.icon} size={20} color={colors.wine} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>
                {i + 1}. {step.title}
              </Text>
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
          </View>
        ))}
      </View>

      <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={onCamera}>
        <Ionicons name="camera" size={20} color={colors.roseGoldLight} />
        <Text style={styles.primaryText}>Tirar foto da mão</Text>
      </Pressable>
      <Pressable style={({ pressed }) => [styles.secondary, pressed && styles.pressed]} onPress={onGallery}>
        <Ionicons name="images-outline" size={20} color={colors.plum} />
        <Text style={styles.secondaryText}>Escolher da galeria</Text>
      </Pressable>
      <Pressable onPress={onSample} hitSlop={8} style={styles.link}>
        <Text style={styles.linkText}>{sampleLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.lg,
    padding: 24,
    overflow: 'hidden',
    ...shadow,
    shadowOpacity: 0.25,
  },
  glow: {
    position: 'absolute',
    right: -70,
    top: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(201,162,126,0.18)',
  },
  eyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.roseGold,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 36,
    color: colors.white,
    marginTop: 8,
  },
  titleItalic: {
    fontFamily: fonts.displayItalic,
    color: colors.roseGoldLight,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 8,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 22,
  },
  steps: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 18,
    gap: 16,
    marginTop: 18,
    ...shadow,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stepIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink,
  },
  stepText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.plum,
    borderRadius: radius.pill,
    paddingVertical: 16,
    marginTop: 22,
  },
  primaryText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.white,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: radius.pill,
    paddingVertical: 15,
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: colors.plum,
  },
  secondaryText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.plum,
  },
  pressed: {
    opacity: 0.85,
  },
  link: {
    alignSelf: 'center',
    marginTop: 16,
  },
  linkText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.wine,
    textDecorationLine: 'underline',
  },
});
