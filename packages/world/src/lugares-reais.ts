/**
 * Lugares reais dos negócios em cada cidade (scripts/lugares-reais.ts): pontos dentro de zonas
 * reais do mapa (comércio, indústria, lavoura, mineração), com o maior terreno que cabe sem
 * cruzar rua e a frente virada para a rua. Dado geográfico apenas: nenhuma regra de economia.
 */
import dados from '../data/lugares-reais.json' with { type: 'json' };

export type ZonaReal = 'comercio' | 'industria' | 'lavoura' | 'mineracao';

/**
 * [lng, lat, giro em radianos (0 = frente para o sul), lado máximo do terreno em metros,
 *  1 = zona real do mapa / 0 = zona substituta (a cidade não tem a zona marcada no mapa)]
 */
export type LugarReal = [number, number, number, number, number];

type Cidade = { nome: string; uf: string } & Partial<Record<ZonaReal, LugarReal[]>>;
const cidades = (dados as unknown as { cidades: Record<string, Cidade> }).cidades;

/** Código IBGE da cidade pelo nome e UF; se a UF não bater, pelo nome (quando único). */
export function codigoDaCidade(nome: string, uf: string): string | undefined {
  const lista = Object.entries(cidades);
  const exato = lista.find(([, c]) => c.nome === nome && c.uf === uf);
  if (exato) return exato[0];
  const pelonome = lista.filter(([, c]) => c.nome === nome);
  return pelonome.length === 1 ? pelonome[0][0] : undefined;
}

export function lugaresReais(codigoIbge: string, zona: ZonaReal): LugarReal[] {
  return cidades[codigoIbge]?.[zona] ?? [];
}
