import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import { loadJson, saveJson, STORAGE_KEYS } from '@/data/storage';
import { supabase } from '@/data/supabase';
import { useCollection, type RemoteTable } from '@/data/useCollection';
import { today } from '@/utils/date';

// Jogo valendo prêmio (Esmalte Express). A profissional cria em rascunho, testa sem pontuar e publica
// com datas e prêmio. Clientes só veem o jogo publicado; pontuam enquanto ele está aberto (regra do banco).
export type GameStatus = 'rascunho' | 'publicado' | 'encerrado';

export type GameCampaign = {
  id: string;
  createdAt: string;
  title: string;
  prize: string;
  startsOn: string; // AAAA-MM-DD
  endsOn: string; // AAAA-MM-DD
  status: GameStatus;
};

export type RankingRow = { pos: number; name: string; best: number; mine: boolean; phone?: string };

const REMOTE: RemoteTable<GameCampaign> = {
  table: 'game_campaigns',
  toRow: (c) => ({ id: c.id, status: c.status, starts_on: c.startsOn, ends_on: c.endsOn, data: c }),
};

// Aberto para jogar e pontuar hoje.
export const isOpen = (c: GameCampaign, day = today()) => c.status === 'publicado' && c.startsOn <= day && day <= c.endsOn;

type LocalScore = { campaignId: string; phone: string; name: string; best: number; plays: number; updatedAt: string };

type GameApi = {
  ready: boolean;
  campaigns: GameCampaign[];
  // Jogo aberto agora (o que as clientes jogam e o feed anuncia).
  active: GameCampaign | null;
  // O jogo que a profissional está preparando ou acompanhando.
  latest: GameCampaign | null;
  saveCampaign: (c: GameCampaign) => Promise<boolean>;
  // Grava a pontuação da cliente se for o melhor resultado dela; devolve a posição (ou null se não salvou).
  saveScore: (c: GameCampaign, phone: string, name: string, score: number) => Promise<{ ok: boolean; position: number | null }>;
  ranking: (c: GameCampaign, phone: string | null, owner: boolean) => Promise<RankingRow[]>;
};

const GameContext = createContext<GameApi | null>(null);

async function rankingRemote(c: GameCampaign, owner: boolean): Promise<RankingRow[]> {
  if (!supabase) return [];
  if (owner) {
    // A profissional vê a lista completa, com o WhatsApp para falar com a vencedora.
    const { data } = await supabase.from('game_scores').select('phone, best, data, updated_at').eq('campaign_id', c.id).order('best', { ascending: false }).order('updated_at', { ascending: true }).limit(50);
    return (data ?? []).map((r, i) => ({ pos: i + 1, name: String((r.data as { name?: string })?.name || 'Cliente'), best: r.best as number, mine: false, phone: r.phone as string }));
  }
  const { data } = await supabase.rpc('game_ranking', { p_campaign: c.id });
  return ((data ?? []) as RankingRow[]).map((r) => ({ pos: r.pos, name: r.name, best: r.best, mine: r.mine }));
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [campaigns, commit, ready] = useCollection<GameCampaign>(STORAGE_KEYS.games, REMOTE);

  const saveCampaign = useCallback(
    (c: GameCampaign) => commit(campaigns.some((x) => x.id === c.id) ? campaigns.map((x) => (x.id === c.id ? c : x)) : [c, ...campaigns]),
    [campaigns, commit],
  );

  const saveScore = useCallback<GameApi['saveScore']>(async (c, phone, name, score) => {
    if (supabase) {
      const id = `${c.id}:55${phone}`;
      const { data: prev } = await supabase.from('game_scores').select('best, data').eq('id', id).maybeSingle();
      const plays = Number((prev?.data as { plays?: number } | undefined)?.plays ?? 0) + 1;
      const best = Math.max(score, Number(prev?.best ?? 0));
      const { error } = await supabase.from('game_scores').upsert({ id, campaign_id: c.id, best, data: { name, plays } });
      if (error) return { ok: false, position: null };
      const rows = await rankingRemote(c, false);
      return { ok: true, position: rows.find((r) => r.mine)?.pos ?? null };
    }
    // Sem servidor (página de teste): guarda no aparelho.
    const list = await loadJson<LocalScore[]>(STORAGE_KEYS.gameScores, []);
    const prev = list.find((s) => s.campaignId === c.id && s.phone === phone);
    const next: LocalScore = { campaignId: c.id, phone, name, best: Math.max(score, prev?.best ?? 0), plays: (prev?.plays ?? 0) + 1, updatedAt: new Date().toISOString() };
    const all = [...list.filter((s) => s !== prev), next];
    await saveJson(STORAGE_KEYS.gameScores, all);
    const pos = all.filter((s) => s.campaignId === c.id).sort((a, b) => b.best - a.best || a.updatedAt.localeCompare(b.updatedAt)).findIndex((s) => s.phone === phone);
    return { ok: true, position: pos + 1 };
  }, []);

  const ranking = useCallback<GameApi['ranking']>(async (c, phone, owner) => {
    if (supabase) return rankingRemote(c, owner);
    const list = (await loadJson<LocalScore[]>(STORAGE_KEYS.gameScores, []))
      .filter((s) => s.campaignId === c.id)
      .sort((a, b) => b.best - a.best || a.updatedAt.localeCompare(b.updatedAt));
    return list
      .map((s, i) => ({ pos: i + 1, name: s.name, best: s.best, mine: s.phone === phone, phone: owner ? s.phone : undefined }))
      .filter((r) => owner || r.pos <= 5 || r.mine);
  }, []);

  const api = useMemo<GameApi>(() => {
    const day = today();
    const sorted = [...campaigns].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      ready,
      campaigns: sorted,
      active: sorted.find((c) => isOpen(c, day)) ?? null,
      latest: sorted.find((c) => c.status !== 'encerrado') ?? sorted[0] ?? null,
      saveCampaign,
      saveScore,
      ranking,
    };
  }, [campaigns, ready, saveCampaign, saveScore, ranking]);

  return <GameContext.Provider value={api}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame precisa estar dentro de GameProvider');
  return ctx;
}

// Nome curto que aparece no ranking: primeiro nome e a inicial do sobrenome (ex.: "Ana S.").
export function rankingName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Cliente';
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
}
