import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { STORAGE_KEYS } from '@/data/storage';
import { useCollection, type RemoteTable } from '@/data/useCollection';
import type { PaymentMethod } from '@/features/agenda/AppointmentsContext';

export type TransactionType = 'entrada' | 'saida';

export type Transaction = {
  id: string;
  createdAt: string;
  type: TransactionType;
  amount: number;
  description: string;
  category: string;
  method?: PaymentMethod;
  date: string; // AAAA-MM-DD
  appointmentId?: string;
};

export const INCOME_CATEGORIES = ['Atendimento', 'Venda de produto', 'Outros'];
export const EXPENSE_CATEGORIES = ['Materiais', 'Aluguel', 'Contas', 'Transporte', 'Marketing', 'Outros'];

const REMOTE: RemoteTable<Transaction> = { table: 'transactions', toRow: (t) => ({ id: t.id, data: t }) };

type FinanceApi = {
  ready: boolean;
  transactions: Transaction[];
  addTransaction: (t: Transaction) => void;
  removeTransaction: (id: string) => void;
  forMonth: (key: string) => Transaction[];
};

const FinanceContext = createContext<FinanceApi | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [transactions, commit, ready] = useCollection<Transaction>(STORAGE_KEYS.transactions, REMOTE);

  const api = useMemo<FinanceApi>(
    () => ({
      ready,
      transactions,
      addTransaction: (t) => commit([t, ...transactions]),
      removeTransaction: (id) => commit(transactions.filter((t) => t.id !== id)),
      forMonth: (key) =>
        transactions.filter((t) => t.date.startsWith(key)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    }),
    [transactions, commit, ready],
  );

  return <FinanceContext.Provider value={api}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance precisa estar dentro de FinanceProvider');
  return ctx;
}
