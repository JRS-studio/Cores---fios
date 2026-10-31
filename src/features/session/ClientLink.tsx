import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { colors, fonts, radius } from '@/theme';
import { openExternal } from '@/utils/openExternal';

// Endereço da versão web publicada (ver supabase/README.md › Versão web).
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '') ?? '';

// Link que a profissional envia: a cliente abre no navegador, sem instalar nada, e já cai no agendamento.
export function ClientLink({ studioName }: { studioName: string }) {
  const [copied, setCopied] = useState(false);
  if (!WEB_URL) return null;
  const link = `${WEB_URL}/agendamento/novo`;
  const message = `Oi! Agende seu horário no ${studioName} pelo link, sem instalar nada: ${link}`;

  return (
    <View style={styles.box}>
      <View style={styles.titleRow}>
        <Ionicons name="link-outline" size={18} color={colors.wine} />
        <Text style={styles.title}>Link para as clientes</Text>
      </View>
      <Text style={styles.text}>Abre no navegador do celular, sem instalar nada. Dá para adicionar à tela inicial como um app.</Text>
      <Text style={styles.link} selectable>
        {link}
      </Text>
      <View style={styles.actions}>
        <Button
          label="Enviar no WhatsApp"
          icon="logo-whatsapp"
          onPress={() => openExternal(`https://wa.me/?text=${encodeURIComponent(message)}`)}
          style={{ flex: 1 }}
        />
        <Button
          label={copied ? 'Copiado' : 'Copiar'}
          icon={copied ? 'checkmark' : 'copy-outline'}
          variant="secondary"
          onPress={async () => {
            await Clipboard.setStringAsync(link);
            setCopied(true);
          }}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: 8,
    padding: 16,
    marginBottom: 20,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.roseGoldLight,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  text: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.muted },
  link: { fontFamily: fonts.medium, fontSize: 13, color: colors.wine },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
