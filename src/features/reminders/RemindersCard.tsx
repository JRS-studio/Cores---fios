import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/features/session/SessionContext';
import { colors, fonts, radius } from '@/theme';
import { disableReminders, enableReminders, getReminderState, type ReminderState } from './push';

const TEXT: Partial<Record<ReminderState, string>> = {
  off: 'Receba uma notificação no celular 1 hora antes de cada horário.',
  on: 'Lembretes ativados: você recebe uma notificação 1 hora antes de cada horário.',
  install:
    'No iPhone, os lembretes chegam só pelo app na Tela de Início: toque em Compartilhar › Adicionar à Tela de Início, abra o app por lá e ative aqui.',
  denied: 'As notificações deste site estão bloqueadas no navegador. Libere nas configurações do site para receber os lembretes.',
  'not-ready': 'Os lembretes ainda não foram ligados pelo studio. Tente de novo mais tarde.',
  error: 'Não foi possível ativar agora. Confira a internet e tente de novo.',
};

// Para a profissional: notificação no celular quando uma cliente pede horário, remarca ou pede cancelamento.
const OWNER_TEXT: Partial<Record<ReminderState, string>> = {
  ...TEXT,
  off: 'Receba uma notificação no celular quando uma cliente pedir um horário, remarcar ou pedir cancelamento.',
  on: 'Avisos ativados: você recebe uma notificação a cada pedido das clientes.',
  install:
    'No iPhone, os avisos chegam só pelo app na Tela de Início: toque em Compartilhar › Adicionar à Tela de Início, abra o app por lá e ative aqui.',
  denied: 'As notificações deste site estão bloqueadas no navegador. Libere nas configurações do site para receber os avisos.',
};

// Cliente logada: lembrete 1 hora antes (vai para o número dela). Profissional: avisos dos pedidos das clientes.
export function RemindersCard({ compact }: { compact?: boolean }) {
  const { role } = useSession();
  const owner = role === 'profissional';
  const [state, setState] = useState<ReminderState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (role === 'cliente' || role === 'profissional') getReminderState().then(setState);
  }, [role]);

  if ((role !== 'cliente' && !owner) || !state || state === 'unsupported') return null;
  if (compact && state === 'on') return null;

  async function toggle() {
    setBusy(true);
    setState(state === 'on' ? await disableReminders() : await enableReminders(owner));
    setBusy(false);
  }

  const canToggle = state === 'off' || state === 'on' || state === 'error' || state === 'not-ready';
  return (
    <View style={[styles.box, state === 'on' && styles.boxOn]}>
      <Ionicons name={state === 'on' ? 'notifications' : 'notifications-outline'} size={20} color={state === 'on' ? colors.success : colors.wine} />
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={styles.title}>{owner ? 'Avisos no celular' : 'Lembrete 1 hora antes'}</Text>
        <Text style={styles.text}>{(owner ? OWNER_TEXT : TEXT)[state]}</Text>
        {canToggle && (
          <Pressable onPress={toggle} disabled={busy} style={[styles.button, state === 'on' && styles.buttonOff]} accessibilityRole="button">
            <Text style={[styles.buttonText, state === 'on' && { color: colors.plum }]}>
              {busy ? 'Aguarde…' : state === 'on' ? (owner ? 'Desativar avisos' : 'Desativar lembretes') : owner ? 'Ativar avisos' : 'Ativar lembretes'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: 12, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14 },
  boxOn: { borderColor: colors.border },
  title: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  text: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.muted },
  button: { alignSelf: 'flex-start', backgroundColor: colors.plum, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 8, marginTop: 2 },
  buttonOff: { backgroundColor: colors.blush },
  buttonText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.white },
});
