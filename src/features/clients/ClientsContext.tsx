import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { levelFor } from '@/data/loyalty';
import { useLoyalty } from '@/features/settings/SettingsContext';
import { STORAGE_KEYS } from '@/data/storage';
import { toAuthPhone } from '@/data/supabase';
import { useCollection, type RemoteTable } from '@/data/useCollection';
import type { Client } from './types';

const REMOTE: RemoteTable<Client> = {
  table: 'clients',
  toRow: (c) => ({ id: c.id, phone: toAuthPhone(c.phone), data: c }),
};

type ClientsApi = {
  ready: boolean;
  clients: Client[];
  getClient: (id: string) => Client | undefined;
  findByPhone: (phone: string) => Client | undefined;
  saveClient: (client: Client) => void;
  removeClient: (id: string) => void;
  registerVisit: (id: string) => void;
  addReferralBonus: (id: string) => void;
  redeemReward: (id: string) => void;
};

const ClientsContext = createContext<ClientsApi | null>(null);

const emptyLoyalty = { stamps: 0, totalVisits: 0, rewardsRedeemed: 0 };

// O app não guarda documentos: remove o CPF de cadastros feitos em versões anteriores.
const withoutDocuments = (c: Client & { cpf?: string }): Client => {
  const copy = { ...c };
  delete copy.cpf;
  return copy;
};

export function ClientsProvider({ children }: { children: ReactNode }) {
  const [stored, commit, ready] = useCollection<Client>(STORAGE_KEYS.clients, REMOTE);
  // Cadastros antigos com CPF são limpos ao ler; o próximo salvamento já grava sem ele.
  const clients = useMemo(() => stored.map(withoutDocuments), [stored]);
  const LOYALTY = useLoyalty();

  const api = useMemo<ClientsApi>(() => {
    const update = (id: string, fn: (c: Client) => Client) => commit(clients.map((c) => (c.id === id ? fn(c) : c)));

    return {
      ready,
      clients,
      getClient: (id) => clients.find((c) => c.id === id),
      findByPhone: (phone) => clients.find((c) => c.phone === phone),
      saveClient: (client) => {
        const exists = clients.some((c) => c.id === client.id);
        commit(exists ? clients.map((c) => (c.id === client.id ? client : c)) : [client, ...clients]);
      },
      removeClient: (id) => commit(clients.filter((c) => c.id !== id)),
      registerVisit: (id) =>
        update(id, (c) => {
          const loyalty = c.loyalty ?? emptyLoyalty;
          const totalVisits = loyalty.totalVisits + 1;
          // Nível Diamante: selo extra a cada 5 atendimentos.
          const bonus = levelFor(loyalty.totalVisits).id === 'diamante' && totalVisits % 5 === 0 ? 1 : 0;
          return { ...c, loyalty: { ...loyalty, totalVisits, stamps: loyalty.stamps + 1 + bonus } };
        }),
      addReferralBonus: (id) =>
        update(id, (c) => {
          const loyalty = c.loyalty ?? emptyLoyalty;
          return { ...c, loyalty: { ...loyalty, stamps: loyalty.stamps + LOYALTY.referralStamps } };
        }),
      redeemReward: (id) =>
        update(id, (c) => {
          const loyalty = c.loyalty ?? emptyLoyalty;
          if (loyalty.stamps < LOYALTY.stampsForReward) return c;
          return {
            ...c,
            loyalty: {
              ...loyalty,
              stamps: loyalty.stamps - LOYALTY.stampsForReward,
              rewardsRedeemed: loyalty.rewardsRedeemed + 1,
            },
          };
        }),
    };
  }, [clients, commit, ready, LOYALTY]);

  return <ClientsContext.Provider value={api}>{children}</ClientsContext.Provider>;
}

export function useClients() {
  const ctx = useContext(ClientsContext);
  if (!ctx) throw new Error('useClients precisa estar dentro de ClientsProvider');
  return ctx;
}
