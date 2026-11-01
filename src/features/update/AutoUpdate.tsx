import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, radius } from '@/theme';

// Atualização automática da versão web (app instalado na tela inicial).
// O celular deixa o app "dormindo" e, ao voltar, mostra a versão que já estava aberta; o GitHub Pages
// ainda deixa a página guardada por alguns minutos. Por isso o app confere o version.json publicado
// junto com o site e, se houver versão nova, recarrega: ao abrir, ao voltar para o app ou, durante o
// uso, com um aviso para tocar (assim ninguém perde o que estava digitando).
const VERSION = process.env.EXPO_PUBLIC_APP_VERSION;
const SITE = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/?$/, '/');
const CHECK_EVERY_MS = 10 * 60 * 1000;

const g = globalThis as { document?: Document; location?: Location; sessionStorage?: Storage };

async function latestVersion(): Promise<string | null> {
  try {
    const r = await fetch(`${SITE}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    return ((await r.json()) as { version?: string }).version ?? null;
  } catch {
    return null;
  }
}

async function reloadTo(version: string) {
  // Tenta uma vez por versão (se o GitHub ainda estiver publicando, não fica recarregando sem parar).
  const key = `cores:atualizado-para:${version}`;
  if (g.sessionStorage?.getItem(key)) return;
  g.sessionStorage?.setItem(key, '1');
  try {
    // Busca a página de novo no servidor (e não na cópia guardada) antes de recarregar.
    await fetch(g.location!.href, { cache: 'reload' });
  } catch {
    // Sem internet: recarrega mesmo assim.
  }
  g.location?.reload();
}

export function AutoUpdate() {
  const insets = useSafeAreaInsets();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !VERSION || !SITE || !g.document) return;
    const doc = g.document;
    let alive = true;

    const check = async (moment: 'abrir' | 'voltar' | 'uso') => {
      const latest = await latestVersion();
      if (!alive || !latest || latest === VERSION) return;
      if (moment === 'uso') setPending(latest);
      else reloadTo(latest);
    };

    check('abrir');
    const onVisible = () => doc.visibilityState === 'visible' && check('voltar');
    doc.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(() => doc.visibilityState === 'visible' && check('uso'), CHECK_EVERY_MS);
    return () => {
      alive = false;
      doc.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, []);

  if (!pending) return null;
  return (
    <Pressable
      style={[styles.banner, { top: insets.top + 8 }]}
      onPress={() => {
        g.sessionStorage?.removeItem(`cores:atualizado-para:${pending}`);
        reloadTo(pending);
      }}
      accessibilityRole="button"
      accessibilityLabel="Atualizar o app"
    >
      <Ionicons name="refresh" size={18} color={colors.white} />
      <Text style={styles.text}>Nova versão do app. Toque para atualizar.</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 150,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.plum,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  text: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.white },
});
