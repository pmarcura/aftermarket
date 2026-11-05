/**
 * Onde desenhar um terreno no mapa: o centro na quadra (não a entrada na rua, que o servidor
 * usa para o frete), o lado que cabe ali e para onde a frente aponta. Só desenho.
 */
import type { Position, Property } from '../../../../../packages/simulation/src/model';

/** Preço curto para a etiqueta do mapa (recebe centavos): R$ 185 mil, R$ 1,2 mi. */
export function precoCurto(centavos: number) {
  const reais = centavos / 100;
  const numero = (v: number, casas: number) =>
    v.toLocaleString('pt-BR', { maximumFractionDigits: casas });
  if (reais >= 1_000_000) return `R$ ${numero(reais / 1_000_000, 1)} mi`;
  if (reais >= 1_000) return `R$ ${numero(reais / 1_000, 0)} mil`;
  return `R$ ${numero(reais, 0)}`;
}

export function centroDoTerreno(p: Property): Position {
  return p.roadAccess?.originalCoordinates ?? p.coordinates;
}

/** Lado do terreno desenhado (m): a área do jogo, limitada ao que cabe na quadra. */
export function ladoDoTerreno(p: Property) {
  const lado = Math.sqrt(p.area);
  return p.site ? Math.min(lado, p.site.side) : lado;
}

/** Zoom para ver o terreno inteiro: loja pequena de bem perto, fazenda grande de mais longe. */
export function zoomDoTerreno(p: Property) {
  return Math.min(17.6, Math.max(14.5, 17.6 - Math.log2(Math.max(ladoDoTerreno(p), 1) / 30)));
}

/** Caminho asfaltado do meio da frente do terreno até o ponto da rua (sem acesso: nada). */
export function acessoDoTerreno(p: Property): Position[] | null {
  const destino = p.site?.access;
  if (!destino) return null;
  const [lng, lat] = centroDoTerreno(p);
  const meio = ladoDoTerreno(p) / 2;
  const giro = p.site?.facing ?? 0;
  const cos = Math.cos((lat * Math.PI) / 180);
  // frente do modelo = +Z (sul) girado: leste = sen(giro), sul = cos(giro)
  const frente: Position = [
    lng + (Math.sin(giro) * meio) / (111_320 * cos),
    lat - (Math.cos(giro) * meio) / 111_320,
  ];
  return [frente, destino];
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
