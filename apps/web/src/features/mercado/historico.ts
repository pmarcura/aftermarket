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
    const ler = () =>
      Promise.all(
        ids.map((id) =>
          fetch(`/api/market-history?product=${id}&region=`)
            .then((r) => (r.ok ? r.json() : undefined))
            .then((v) => [id, v] as const)
            .catch(() => [id, undefined] as const),
        ),
      ).then((pares) => {
        if (!ativo) return;
        const novo: Historico = {};
        for (const [id, v] of pares) if (v) novo[id] = { samples: v.samples, trades: v.trades };
        setH(novo);
      });
    void ler();
    const t = setInterval(() => void ler(), intervalo);
    return () => {
      ativo = false;
      clearInterval(t);
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
