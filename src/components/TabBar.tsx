import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, shadow } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const ICONS: Record<string, [IconName, IconName]> = {
  index: ['home', 'home-outline'],
  agenda: ['calendar', 'calendar-outline'],
  provador: ['color-palette', 'color-palette-outline'],
  financeiro: ['wallet', 'wallet-outline'],
  clientes: ['people', 'people-outline'],
};

// O Provador Virtual é o diferencial do app, por isso ganha um botão central em destaque.
const FEATURED = 'provador';

export function TabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const label = descriptors[route.key].options.title ?? route.name;
          const [activeIcon, idleIcon] = ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];

          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };

          if (route.name === FEATURED) {
            return (
              <Pressable key={route.key} onPress={onPress} style={styles.item} accessibilityRole="button" accessibilityLabel={label}>
                <LinearGradient colors={[colors.wine, colors.plum]} style={styles.featured}>
                  <Ionicons name="sparkles" size={24} color={colors.roseGoldLight} />
                </LinearGradient>
                <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
              </Pressable>
            );
          }

          return (
            <Pressable key={route.key} onPress={onPress} style={styles.item} accessibilityRole="button" accessibilityLabel={label}>
              <Ionicons name={focused ? activeIcon : idleIcon} size={22} color={focused ? colors.plum : colors.muted} />
              <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
              {focused && <View style={styles.dot} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: 'transparent',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.white,
    borderRadius: 28,
    paddingVertical: 10,
    paddingHorizontal: 6,
    ...shadow,
    shadowOpacity: 0.12,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  featured: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -34,
    borderWidth: 4,
    borderColor: colors.cream,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.muted,
  },
  labelActive: {
    color: colors.plum,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.roseGold,
  },
});
