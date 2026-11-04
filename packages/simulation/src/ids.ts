import type { World } from './model';

/**
 * Código de cada registro novo do mundo (spec 014): contador do próprio mundo, não sorteio. Assim
 * repetir as mesmas ações sobre a mesma foto do mundo gera os mesmos códigos, e o diário reconstrói
 * o mundo idêntico depois de uma queda. O prefixo `n-` nunca colide com os UUIDs já existentes.
 */
export function newId(w: World) {
  w.idSeq = (w.idSeq ?? 0) + 1;
  return `n-${w.idSeq.toString(36)}`;
}
