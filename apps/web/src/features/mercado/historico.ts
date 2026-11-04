import { useEffect, useState } from 'react';
import type { MarketSample, ProductId, World } from '../../../../../packages/simulation/src/model';
import { gameDay } from '../../../../../packages/simulation/src/clock';

export interface Negocio {
  at: number;
  from: string;
  to: string;
  product: ProductId;
  quantity: number;
  unitPrice: number;
}
export type Historico = Partial<Record<ProductId, { samples: MarketSample[]; trades: Negocio[] }>>;

/** Histórico nacional dos produtos, pelo mesmo endereço que a ficha do produto usa. */
export function useHistorico(ids: ProductId[], intervalo = 30000) {
  const [h, setH] = useState<Historico>({});
  const chave = ids.join(',');
  useEffect(() => {
    let ativo = true;
    let pending = false;
    let controller: AbortController | undefined;
    const ler = async () => {
      if (pending || !ids.length || document.hidden) return;
      pending = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 15000);
      try {
        const response = await fetch(
          `/api/market-history?products=${encodeURIComponent(chave)}&region=`,
          { signal: controller.signal },
        );
        if (!response.ok) return;
        const values = (await response.json()) as Historico;
        if (ativo) setH(values);
      } catch {
        /* Keep the last valid prices; next interval retries. */
      } finally {
        clearTimeout(timeout);
        pending = false;
      }
    };
    void ler();
    const t = setInterval(() => void ler(), intervalo);
    const visible = () => {
      if (!document.hidden) void ler();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      ativo = false;
      clearInterval(t);
      controller?.abort();
      document.removeEventListener('visibilitychange', visible);
    };
    // A lista de produtos só muda com a temporada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, intervalo]);
  return h;
}

/**
 * Preço nacional de agora, a variação contra um dia de jogo atrás e os pontos do minigráfico.
 * Sem amostra de um dia atrás, compara com a mais antiga e avisa que o período é menor.
 */
export function cotacaoDe(world: World, historico: Historico, id: ProductId, pontos = 40) {
  const amostras = (historico[id]?.samples ?? []).filter((s) => s.price !== null);
  const ultima = amostras.at(-1);
  const umDia = amostras.filter((s) => s.at <= world.updatedAt - gameDay(world)).pop();
  const base = umDia ?? (amostras.length > 1 ? amostras[0] : undefined);
  const variacao = ultima?.price && base?.price ? ultima.price / base.price - 1 : 0;
  return {
    preco: ultima?.price ?? undefined,
    variacao,
    /** true quando a comparação cobre um dia inteiro de jogo. */
    diaInteiro: Boolean(umDia),
    temComparacao: Boolean(ultima?.price && base?.price && base !== ultima),
    faisca: amostras.slice(-pontos).map((s) => s.price!),
  };
}
