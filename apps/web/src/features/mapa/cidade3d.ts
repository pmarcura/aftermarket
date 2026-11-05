/**
 * Cidade em 3D no mapa: os prédios reais do OpenStreetMap (mesmos tiles que o mapa já usa),
 * construídos por pedaço de mapa (tile do zoom 14) com predios3d.ts, só quando o jogador está
 * perto. A leitura e a montagem rodam em workers, para o mapa não travar; cada pedaço vira uma
 * malha, e os pedaços longe da vista saem da memória.
 */
import * as THREE from 'three';
import type * as maplibregl from 'maplibre-gl';
import { geometriaDe } from './predios3d';
import { criarMaterialDosPredios } from './fachadas';
import type { PedidoDeTile, RespostaDeTile } from './cidade.worker';

/** A partir deste zoom a cidade aparece em 3D (antes disso, o contorno plano do mapa). */
export const ZOOM_CIDADE = 15.5;
const Z = 14; // zoom dos tiles lidos (onde estão os prédios com detalhe)
const RAIO = 1; // pedaços em volta do centro da vista (3×3 cobre a tela mesmo inclinada)
const GUARDAR = 15; // pedaços mantidos na memória
const WORKERS = 2;

interface Pedaco {
  estado: 'baixando' | 'pronto' | 'vazio' | 'erro';
  malha?: THREE.Mesh;
  predios: number;
  usadoEm: number;
  canto: [number, number];
}

/**
 * @param paraCena converte coordenada Mercator (0–1) para o espaço da cena (metros, x leste, z sul)
 * @param metroEmMercator quanto vale 1 metro em unidades Mercator na origem da cena
 */
export function criarCidade3D(
  paraCena: (mx: number, my: number) => [number, number],
  metroEmMercator: number,
) {
  const grupo = new THREE.Group();
  grupo.name = 'cidade-3d';
  const material = criarMaterialDosPredios();
  const pedacos = new Map<string, Pedaco>();
  let pedidoDeDesenho: (() => void) | null = null;
  let modeloDeUrl: string | null = null;
  let workers: Worker[] = [];
  let proximo = 0;

  function receber(ev: MessageEvent<RespostaDeTile>) {
    const r = ev.data;
    const p = pedacos.get(r.chave);
    if (!p) return; // saiu da memória enquanto carregava
    if (!r.ok) {
      p.estado = 'erro';
      return;
    }
    if (!r.malha) {
      p.estado = 'vazio';
      return;
    }
    const malha = new THREE.Mesh(geometriaDe(r.malha), material);
    malha.position.set(p.canto[0], 0, p.canto[1]);
    malha.castShadow = malha.receiveShadow = true;
    malha.matrixAutoUpdate = false;
    malha.updateMatrix();
    p.malha = malha;
    p.predios = r.predios;
    p.estado = 'pronto';
    grupo.add(malha);
    pedidoDeDesenho?.();
  }

  function pedir(pedido: PedidoDeTile) {
    if (!workers.length)
      workers = Array.from({ length: WORKERS }, () => {
        const w = new Worker(new URL('./cidade.worker.ts', import.meta.url), { type: 'module' });
        w.onmessage = receber;
        return w;
      });
    workers[proximo++ % workers.length].postMessage(pedido);
  }

  /** Garante os pedaços em volta do centro da vista e tira da memória os mais antigos. */
  function atualizar(mapa: maplibregl.Map) {
    pedidoDeDesenho = () => mapa.triggerRepaint();
    if (!modeloDeUrl) {
      const fonte = mapa.getSource('openmaptiles') as { tiles?: string[] } | undefined;
      modeloDeUrl = fonte?.tiles?.[0] ?? null;
      if (!modeloDeUrl) return;
    }
    const n = 2 ** Z;
    const centro = mapa.getCenter();
    const tx = Math.floor(((centro.lng + 180) / 360) * n);
    const lat = (centro.lat * Math.PI) / 180;
    const ty = Math.floor(((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * n);
    const agora = performance.now();
    const visiveis = new Set<string>();
    for (let dx = -RAIO; dx <= RAIO; dx++)
      for (let dy = -RAIO; dy <= RAIO; dy++) {
        const x = tx + dx,
          y = ty + dy;
        const chave = `${x}/${y}`;
        visiveis.add(chave);
        const p = pedacos.get(chave);
        if (p) {
          p.usadoEm = agora;
          continue;
        }
        // canto noroeste do tile na cena; as plantas chegam em metros a partir dele
        const canto = paraCena(x / n, y / n);
        pedacos.set(chave, { estado: 'baixando', predios: 0, usadoEm: agora, canto });
        pedir({
          chave,
          url: modeloDeUrl.replace('{z}', `${Z}`).replace('{x}', `${x}`).replace('{y}', `${y}`),
          metrosPorTile: 1 / n / metroEmMercator,
        });
      }
    for (const [chave, p] of pedacos) if (p.malha) p.malha.visible = visiveis.has(chave);
    if (pedacos.size > GUARDAR) {
      const velhos = [...pedacos.entries()]
        .filter(([k, p]) => !visiveis.has(k) && p.estado !== 'baixando')
        .sort((a, b) => a[1].usadoEm - b[1].usadoEm);
      for (const [k, p] of velhos.slice(0, pedacos.size - GUARDAR)) {
        if (p.malha) {
          grupo.remove(p.malha);
          p.malha.geometry.dispose();
        }
        pedacos.delete(k);
      }
    }
  }

  /** Números para conferência (testes e laboratório). */
  function resumo() {
    let prontos = 0,
      predios = 0,
      visiveis = 0;
    for (const p of pedacos.values())
      if (p.estado === 'pronto') {
        prontos++;
        predios += p.predios;
        if (p.malha?.visible) visiveis++;
      }
    return { pedacos: prontos, predios, visiveis };
  }

  function encerrar() {
    for (const w of workers) w.terminate();
    workers = [];
  }

  return { grupo, atualizar, resumo, encerrar };
}
