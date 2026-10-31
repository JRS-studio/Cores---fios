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
  financeiro: ['wallet', 'wallet-outline'],
  clientes: ['people', 'people-outline'],
};

// Botão central em destaque, como o "+" das redes sociais: não é uma aba, abre uma tela de criação.
export type CenterAction = { label: string; onPress: () => void };

type Props = BottomTabBarProps & { hidden?: string[]; center?: CenterAction };

export function TabBar({ state, descriptors, emitter, navigateToTab, hidden = [], center }: Props) {
  const insets = useSafeAreaInsets();
  const visible = state.routes.filter((r) => !hidden.includes(r.name));
  const centerAt = Math.ceil(visible.length / 2);

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          if (hidden.includes(route.name)) return null;
          const tab = (
            <TabItem key={route.key} route={route} index={index} state={state} descriptors={descriptors} emitter={emitter} navigateToTab={navigateToTab} />
          );
          if (!center || visible.indexOf(route) !== centerAt) return tab;
          return [
            <Pressable key="center" onPress={center.onPress} style={styles.item} accessibilityRole="button" accessibilityLabel={center.label}>
              <LinearGradient colors={[colors.wine, colors.plum]} style={styles.featured}>
                <Ionicons name="add" size={30} color={colors.roseGoldLight} />
              </LinearGradient>
              <Text style={styles.label}>{center.label}</Text>
            </Pressable>,
            tab,
          ];
        })}
      </View>
    </View>
  );
}

type TabItemProps = Pick<BottomTabBarProps, 'state' | 'descriptors' | 'emitter' | 'navigateToTab'> & {
  route: BottomTabBarProps['state']['routes'][number];
  index: number;
};

function TabItem({ route, index, state, descriptors, emitter, navigateToTab }: TabItemProps) {
  const focused = state.index === index;
  const label = descriptors[route.key].options.title ?? route.name;
  const [activeIcon, idleIcon] = ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];

  const onPress = () => {
    const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigateToTab(route.key);
  };

  return (
    <Pressable onPress={onPress} style={styles.item} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={focused ? activeIcon : idleIcon} size={22} color={focused ? colors.plum : colors.muted} />
      <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
      {focused && <View style={styles.dot} />}
    </Pressable>
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
