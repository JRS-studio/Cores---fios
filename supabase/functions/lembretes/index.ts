// Função "lembretes" do Supabase (Edge Function). Chamada a cada 5 minutos (ver supabase/lembretes.sql):
// envia uma notificação ao celular da cliente quando falta 1 hora (ou menos) para o horário dela
// e avisa a profissional quando uma cliente pede horário, remarca ou pede cancelamento.
// Na primeira execução cria as chaves de envio (VAPID) e guarda na tabela push_config.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://jefersonroodrigo-cmyk.github.io/Cores---fios/';
const TZ = Deno.env.get('STUDIO_TZ') ?? 'America/Sao_Paulo';
const serviceKey =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? (JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>).default;
const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey!, { auth: { persistSession: false } });

type Keys = { public_key: string; private_key: string };

async function vapidKeys(): Promise<Keys> {
  const read = () => db.from('push_config').select('public_key, private_key').eq('id', 1).maybeSingle<Keys>();
  const { data } = await read();
  if (data) return data;
  const k = webpush.generateVAPIDKeys();
  await db.from('push_config').insert({ id: 1, public_key: k.publicKey, private_key: k.privateKey });
  // Se duas execuções criarem ao mesmo tempo, vale a que foi gravada.
  const { data: saved } = await read();
  return saved ?? { public_key: k.publicKey, private_key: k.privateKey };
}

type Due = { appointment_id: string; starts_at: string; data: { serviceName?: string }; endpoint: string; p256dh: string; auth: string };

Deno.serve(async () => {
  const keys = await vapidKeys();
  webpush.setVapidDetails(SITE_URL, keys.public_key, keys.private_key);

  const { data: due, error } = await db.rpc('due_reminders', { tz: TZ });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const { data: settings } = await db.from('settings').select('data').eq('id', 1).maybeSingle<{ data: { studioName?: string } }>();
  const studio = settings?.data.studioName ?? 'o studio';

  let sent = 0;
  let removed = 0;
  for (const row of (due ?? []) as Due[]) {
    const time = row.starts_at.slice(11, 16);
    const payload = JSON.stringify({
      title: 'Seu horário é daqui a 1 hora 💅',
      body: `${row.data.serviceName ?? 'Atendimento'} às ${time} no ${studio}. Te esperamos!`,
      url: `${SITE_URL.replace(/\/$/, '')}/agendamento/${row.appointment_id}`,
      tag: `lembrete-${row.appointment_id}`,
    });
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload, { TTL: 3600 });
      sent += 1;
    } catch (e) {
      // 404/410: a cliente desinstalou ou bloqueou; a inscrição não vale mais.
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
        removed += 1;
      }
    }
  }

  // Um lembrete por horário, mesmo que algum celular tenha falhado (evita repetir a cada 5 minutos).
  const ids = [...new Set(((due ?? []) as Due[]).map((d) => d.appointment_id))];
  if (ids.length) await db.rpc('mark_reminded', { ids });

  // Avisos de cancelamento para a profissional (a cliente cancelou pelo app).
  type Cancel = { appointment_id: string; data: { clientName?: string; serviceName?: string; date?: string; time?: string }; endpoint: string; p256dh: string; auth: string };
  const { data: cancels } = await db.rpc('due_cancel_notices');
  let avisos = 0;
  for (const row of (cancels ?? []) as Cancel[]) {
    const [, m, d] = (row.data.date ?? '').split('-');
    const payload = JSON.stringify({
      title: 'Horário cancelado',
      body: `${row.data.clientName ?? 'Uma cliente'} cancelou ${row.data.serviceName ?? 'o horário'}${d ? ` de ${d}/${m}` : ''}${row.data.time ? ` às ${row.data.time}` : ''}. O horário já está livre na agenda.`,
      url: `${SITE_URL.replace(/\/$/, '')}/agendamento/${row.appointment_id}`,
      tag: `cancelamento-${row.appointment_id}`,
    });
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload, { TTL: 86400 });
      avisos += 1;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
        removed += 1;
      }
    }
  }
  const cancelIds = [...new Set(((cancels ?? []) as Cancel[]).map((c) => c.appointment_id))];
  if (cancelIds.length) await db.rpc('mark_cancel_notified', { ids: cancelIds });

  // Avisos para a profissional: pedido de horário, remarcação e pedido de cancelamento feitos pelas clientes.
  type Notice = {
    notice_id: number;
    kind: 'agendamento' | 'remarcacao' | 'cancelamento';
    appointment_id: string;
    data: { clientName?: string; serviceName?: string; date?: string; time?: string };
    endpoint: string;
    p256dh: string;
    auth: string;
  };
  const TITLES = { agendamento: 'Novo pedido de horário', remarcacao: 'Pedido de remarcação', cancelamento: 'Pedido de cancelamento' };
  const { data: notices } = await db.rpc('due_owner_notices');
  for (const row of (notices ?? []) as Notice[]) {
    const [, m, d] = (row.data.date ?? '').split('-');
    const when = `${d ? `${d}/${m}` : ''}${row.data.time ? ` às ${row.data.time}` : ''}`.trim();
    const who = row.data.clientName ?? 'Uma cliente';
    const what = row.data.serviceName ?? 'horário';
    const body =
      row.kind === 'cancelamento'
        ? `${who} pediu para cancelar ${what}${when ? ` de ${when}` : ''}.`
        : row.kind === 'remarcacao'
          ? `${who} remarcou ${what} para ${when}. Confirme no app.`
          : `${who} pediu ${what}${when ? ` em ${when}` : ''}. Confirme no app.`;
    const payload = JSON.stringify({
      title: TITLES[row.kind],
      body,
      url: `${SITE_URL.replace(/\/$/, '')}/agendamento/${row.appointment_id}`,
      tag: `${row.kind}-${row.notice_id}`,
    });
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload, { TTL: 86400 });
      avisos += 1;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
        removed += 1;
      }
    }
  }
  const noticeIds = [...new Set(((notices ?? []) as Notice[]).map((n) => n.notice_id))];
  if (noticeIds.length) await db.rpc('mark_owner_notified', { ids: noticeIds });

  return Response.json({ horarios: ids.length, enviados: sent, removidos: removed, cancelamentos: cancelIds.length, pedidos: noticeIds.length, avisos });
});
