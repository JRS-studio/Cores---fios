import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { LOYALTY, levelFor } from '@/data/loyalty';
import { loadJson, saveJson, STORAGE_KEYS } from '@/data/storage';
import type { Client } from './types';

const KEY = STORAGE_KEYS.clients;

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

export function ClientsProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadJson<Client[]>(KEY, []).then((data) => {
      setClients(data);
      setReady(true);
    });
  }, []);

  const api = useMemo<ClientsApi>(() => {
    const commit = (next: Client[]) => {
      setClients(next);
      saveJson(KEY, next);
    };
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
  }, [clients, ready]);

  return <ClientsContext.Provider value={api}>{children}</ClientsContext.Provider>;
}

export function useClients() {
  const ctx = useContext(ClientsContext);
  if (!ctx) throw new Error('useClients precisa estar dentro de ClientsProvider');
  return ctx;
}
