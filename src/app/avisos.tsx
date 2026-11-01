import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OwnerOnly, ScreenHeader, SectionTitle } from '@/components/ui';
import { useAppointments, type Appointment } from '@/features/agenda/AppointmentsContext';
import { useCancelRequests } from '@/features/agenda/CancelRequestsContext';
import { RemindersCard } from '@/features/reminders/RemindersCard';
import { useSession } from '@/features/session/SessionContext';
import { colors, fonts, radius } from '@/theme';
import { formatLongDate, today } from '@/utils/date';
import { formatPhone } from '@/utils/format';

// Avisos da profissional: pedidos de cancelamento e pedidos de horário (a confirmar) das clientes.
export default function AvisosScreen() {
  const { canManage } = useSession();
  return canManage ? <Notices /> : <OwnerOnly title="Avisos" />;
}

function Notices() {
  const insets = useSafeAreaInsets();
  const { appointments, getAppointment } = useAppointments();
  const { open } = useCancelRequests();
  const todayIso = today();
  const requests = appointments
    .filter((a) => a.status === 'agendado' && a.date >= todayIso)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const cancels = open
    .map((r) => ({ request: r, appt: getAppointment(r.appointmentId) }))
    .filter((c): c is { request: typeof c.request; appt: Appointment } => !!c.appt && (c.appt.status === 'agendado' || c.appt.status === 'confirmado'));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
    >
      <ScreenHeader title="Avisos" subtitle="Pedidos das clientes para você responder" />

      <View style={{ marginBottom: 6 }}>
        <RemindersCard compact />
      </View>

      <SectionTitle hint={cancels.length ? 'Cancele ou mantenha o horário' : undefined}>
        {`Pedidos de cancelamento${cancels.length ? ` (${cancels.length})` : ''}`}
      </SectionTitle>
      {cancels.length === 0 ? (
        <Text style={styles.empty}>Nenhum pedido de cancelamento.</Text>
      ) : (
        cancels.map(({ request, appt }) => <NoticeRow key={request.id} appt={appt} icon="close-circle-outline" tone="danger" label="pediu para cancelar" />)
      )}

      <SectionTitle hint={requests.length ? 'Confirme ou sugira outro horário' : undefined}>
        {`Pedidos de horário${requests.length ? ` (${requests.length})` : ''}`}
      </SectionTitle>
      {requests.length === 0 ? (
        <Text style={styles.empty}>Nenhum pedido de horário para confirmar.</Text>
      ) : (
        requests.map((a) => <NoticeRow key={a.id} appt={a} icon="time-outline" tone="info" label="pediu um horário" />)
      )}
    </ScrollView>
  );
}

function NoticeRow({ appt: a, icon, tone, label }: { appt: Appointment; icon: keyof typeof Ionicons.glyphMap; tone: 'danger' | 'info'; label: string }) {
  return (
    <Pressable
      style={[styles.row, tone === 'danger' && styles.rowDanger]}
      onPress={() => router.push({ pathname: '/agendamento/[id]', params: { id: a.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${a.clientName} ${label}: ${a.serviceName}, ${formatLongDate(a.date)} às ${a.time}`}
    >
      <Ionicons name={icon} size={22} color={tone === 'danger' ? colors.danger : colors.wine} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>
          {a.clientName} <Text style={styles.label}>{label}</Text>
        </Text>
        <Text style={styles.detail}>
          {a.serviceName} · {formatLongDate(a.date)} às {a.time}
          {a.clientPhone ? ` · ${formatPhone(a.clientPhone)}` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  empty: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  rowDanger: { borderColor: '#F3C4B4', backgroundColor: '#FFF7F4' },
  title: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  label: { fontFamily: fonts.regular, color: colors.muted },
  detail: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 2 },
});
