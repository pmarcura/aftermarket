/**
 * Lê os prédios de um tile vetorial (camada `building` do OpenMapTiles) e devolve as plantas em
 * metros a partir do canto noroeste do tile. Usado pelo worker da cidade 3D e pelos testes.
 */
import { VectorTile, classifyRings } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import type { Planta, Ponto } from './predios3d';

/**
 * @param metrosPorTile quanto mede o lado do tile no espaço da cena (metros)
 */
export function plantasDoTile(dados: Uint8Array, metrosPorTile: number): Planta[] {
  if (!dados.length) return [];
  const camada = new VectorTile(new PbfReader(dados)).layers.building;
  if (!camada) return [];
  const extent = camada.extent;
  const m = metrosPorTile / extent;
  const plantas: Planta[] = [];
  for (let i = 0; i < camada.length; i++) {
    const f = camada.feature(i);
    if (f.type !== 3) continue;
    for (const poligono of classifyRings(f.loadGeometry())) {
      const anel = poligono[0];
      if (!anel || anel.length < 4) continue;
      // cada prédio fica com o tile onde está o seu centro (os vizinhos trazem uma cópia
      // cortada na borda; só um desenha)
      let cx = 0,
        cy = 0;
      for (const q of anel) {
        cx += q.x;
        cy += q.y;
      }
      cx /= anel.length;
      cy /= anel.length;
      if (cx < 0 || cy < 0 || cx >= extent || cy >= extent) continue;
      const pontos = anel.slice(0, -1);
      const contorno: Ponto[] = pontos.map((q) => [q.x * m, q.y * m]);
      // aresta sobre a linha de corte do tile não é parede de verdade
      const cortes = pontos.map((a, k) => {
        const b = pontos[(k + 1) % pontos.length];
        return (
          (a.x === b.x && (a.x <= 0 || a.x >= extent)) ||
          (a.y === b.y && (a.y <= 0 || a.y >= extent))
        );
      });
      plantas.push({
        id: Number(f.id ?? i * 10),
        contorno,
        altura: Number(f.properties.render_height) || undefined,
        base: Number(f.properties.render_min_height) || 0,
        cortes,
      });
    }
  }
  return plantas;
}
