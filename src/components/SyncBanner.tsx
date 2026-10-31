import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { onSyncError } from '@/data/syncStatus';
import { colors, fonts, radius } from '@/theme';

// Faixa no topo quando o servidor recusa ou não recebe uma alteração. Some sozinha.
export function SyncBanner() {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => onSyncError(setMessage), []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 6000);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;
  return (
    <Pressable style={[styles.banner, { top: insets.top + 8 }]} onPress={() => setMessage(null)} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={18} color={colors.white} />
      <Text style={styles.text}>{message}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    padding: 14,
  },
  text: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.white },
});
