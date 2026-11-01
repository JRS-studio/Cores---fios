import { useAppointments } from '@/features/agenda/AppointmentsContext';
import { useCancelRequests } from '@/features/agenda/CancelRequestsContext';
import { today } from '@/utils/date';

// Quantos avisos a profissional tem para resolver (número no sininho da tela inicial).
export function useNoticeCount() {
  const { appointments } = useAppointments();
  const { open } = useCancelRequests();
  const todayIso = today();
  return appointments.filter((a) => a.status === 'agendado' && a.date >= todayIso).length + open.length;
}
