/**
 * Onde desenhar um terreno no mapa: o centro na quadra (não a entrada na rua, que o servidor
 * usa para o frete), o lado que cabe ali e para onde a frente aponta. Só desenho.
 */
import type { Position, Property } from '../../../../../packages/simulation/src/model';

export function centroDoTerreno(p: Property): Position {
  return p.roadAccess?.originalCoordinates ?? p.coordinates;
}

/** Lado do terreno desenhado (m): a área do jogo, limitada ao que cabe na quadra. */
export function ladoDoTerreno(p: Property) {
  const lado = Math.sqrt(p.area);
  return p.site ? Math.min(lado, p.site.side) : lado;
}

/** Quadrado do terreno em graus, girado para a rua (frente = sul quando o giro é 0). */
export function contornoDoTerreno(p: Property): Position[] {
  const [lng, lat] = centroDoTerreno(p);
  const meio = ladoDoTerreno(p) / 2;
  const giro = p.site?.facing ?? 0;
  const k = 111_320;
  const cos = Math.cos((lat * Math.PI) / 180);
  // cantos em metros (leste, sul) girados como o modelo 3D (rotação em torno do eixo vertical)
  const cantos: [number, number][] = [
    [-meio, -meio],
    [meio, -meio],
    [meio, meio],
    [-meio, meio],
  ];
  const pontos = cantos.map(([x, z]): Position => {
    const leste = x * Math.cos(giro) + z * Math.sin(giro);
    const sul = -x * Math.sin(giro) + z * Math.cos(giro);
    return [lng + leste / (k * cos), lat - sul / k];
  });
  return [...pontos, pontos[0]];
}
