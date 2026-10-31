import type { Appointment } from '@/features/agenda/AppointmentsContext';
import { brl, formatPhone } from '@/utils/format';

// Mensagem pronta para a profissional no WhatsApp dela, aberta pela cliente ao agendar.
// Sem uma API paga de WhatsApp, o envio automático não é possível: a cliente só toca em "enviar".
export function newBookingWhatsApp(whatsapp: string, a: Appointment, rescheduled: boolean) {
  const [y, m, d] = a.date.split('-');
  const text = `${rescheduled ? 'Horário remarcado' : 'Novo agendamento'} pelo app:\n${a.clientName} (${formatPhone(a.clientPhone)})\n${a.serviceName} · ${brl(a.price)}\n${d}/${m}/${y} às ${a.time}`;
  return `https://wa.me/55${whatsapp}?text=${encodeURIComponent(text)}`;
}
