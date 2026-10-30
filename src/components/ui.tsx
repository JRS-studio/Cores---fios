import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, radius } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <Pressable
        style={styles.back}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        accessibilityLabel="Voltar"
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={22} color={colors.plum} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string | null;
  helper?: string;
  optional?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  multiline?: boolean;
  maxLength?: number;
};

export function Field({ label, error, helper, optional, multiline, ...input }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {optional && <Text style={styles.optional}>  opcional</Text>}
      </Text>
      <TextInput
        {...input}
        multiline={multiline}
        placeholderTextColor={colors.muted}
        style={[styles.input, multiline && styles.inputMultiline, !!error && styles.inputError]}
        accessibilityLabel={label}
      />
      {error ? <Text style={styles.error}>{error}</Text> : helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

type ChipOption = { id: string; label: string };

export function Chips({
  options,
  selected,
  onToggle,
}: {
  options: ChipOption[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const active = selected.includes(o.id);
        return (
          <Pressable
            key={o.id}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onToggle(o.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
          >
            {active && <Ionicons name="checkmark" size={14} color={colors.white} />}
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function CheckRow({
  checked,
  onToggle,
  children,
  error,
}: {
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
  error?: string | null;
}) {
  return (
    <View>
      <Pressable style={styles.checkRow} onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked }}>
        <View style={[styles.checkbox, checked && styles.checkboxOn, !!error && !checked && styles.inputError]}>
          {checked && <Ionicons name="checkmark" size={16} color={colors.white} />}
        </View>
        <Text style={styles.checkText}>{children}</Text>
      </Pressable>
      {error && !checked && <Text style={[styles.error, { marginLeft: 34 }]}>{error}</Text>}
    </View>
  );
}

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const primary = variant === 'primary';
  const tint = primary ? colors.white : variant === 'danger' ? colors.wine : colors.plum;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : variant === 'danger' ? styles.buttonDanger : styles.buttonSecondary,
        (pressed || disabled) && { opacity: disabled ? 0.45 : 0.85 },
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={18} color={primary ? colors.roseGoldLight : tint} />}
      <Text style={[styles.buttonText, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

const RATING_LABELS = ['', 'Péssimo', 'Ruim', 'Regular', 'Bom', 'Excelente'];

export function Stars({ value, size = 16, onChange }: { value: number; size?: number; onChange?: (v: number) => void }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((n) => {
        const icon: IconName = value >= n ? 'star' : value >= n - 0.5 ? 'star-half' : 'star-outline';
        const star = <Ionicons name={icon} size={size} color={value >= n - 0.5 ? '#E0A526' : colors.border} />;
        return onChange ? (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={`${n} ${n === 1 ? 'estrela' : 'estrelas'}: ${RATING_LABELS[n]}`}
          >
            {star}
          </Pressable>
        ) : (
          <View key={n}>{star}</View>
        );
      })}
    </View>
  );
}

export const ratingLabel = (n: number) => RATING_LABELS[n] ?? '';

export function SectionTitle({ children, hint }: { children: string; hint?: string }) {
  return (
    <View style={{ marginTop: 22, marginBottom: 10 }}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {hint && <Text style={styles.sectionHint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.ink,
  },
  headerSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.ink,
    marginBottom: 6,
  },
  optional: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.muted,
  },
  input: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputMultiline: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#C2410C',
  },
  error: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#C2410C',
    marginTop: 5,
  },
  helper: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 5,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    backgroundColor: colors.white,
  },
  checkboxOn: {
    backgroundColor: colors.plum,
    borderColor: colors.plum,
  },
  checkText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.pill,
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  buttonPrimary: {
    backgroundColor: colors.plum,
  },
  buttonSecondary: {
    borderWidth: 1.5,
    borderColor: colors.plum,
  },
  buttonDanger: {
    borderWidth: 1.5,
    borderColor: colors.wine,
  },
  buttonText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 19,
    color: colors.ink,
  },
  sectionHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
});
