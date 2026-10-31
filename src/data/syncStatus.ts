// Avisos de falha ao salvar no servidor, mostrados numa faixa no topo do app.
type Listener = (message: string | null) => void;
const listeners = new Set<Listener>();

export function reportSyncError(error: { code?: string; message?: string } | null) {
  const message = !error
    ? null
    : error.code === '23P01'
      ? 'Esse horário acabou de ser ocupado. Escolha outro.'
      : error.code === '42501'
        ? 'Você não tem permissão para fazer isso.'
        : 'Não foi possível salvar no servidor. Confira a internet e tente de novo.';
  listeners.forEach((l) => l(message));
}

export function onSyncError(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
