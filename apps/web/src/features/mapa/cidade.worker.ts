/**
 * Worker da cidade 3D: baixa um tile, lê os prédios e monta a malha fora da tela principal,
 * para o mapa não travar enquanto uma cidade densa (São Paulo) carrega.
 */
import { malhaDosPredios } from './predios3d';
import { plantasDoTile } from './tile-predios';

export interface PedidoDeTile {
  chave: string;
  url: string;
  metrosPorTile: number;
}
export type RespostaDeTile =
  | { chave: string; ok: true; predios: number; malha: ReturnType<typeof malhaDosPredios> }
  | { chave: string; ok: false };

self.onmessage = async (ev: MessageEvent<PedidoDeTile>) => {
  const { chave, url, metrosPorTile } = ev.data;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(String(r.status));
    const plantas = plantasDoTile(new Uint8Array(await r.arrayBuffer()), metrosPorTile);
    const malha = malhaDosPredios(plantas);
    const resposta: RespostaDeTile = { chave, ok: true, predios: plantas.length, malha };
    const transferir = malha
      ? [malha.posicao, malha.normal, malha.cor, malha.uv, malha.fachada].map((a) => a.buffer)
      : [];
    (self as unknown as Worker).postMessage(resposta, transferir);
  } catch {
    (self as unknown as Worker).postMessage({ chave, ok: false } satisfies RespostaDeTile);
  }
};
