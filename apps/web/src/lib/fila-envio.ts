/** Ação enviada ou na fila de envio: a primeira está indo ao servidor, as outras esperam. */
export interface Pendente {
  id: number;
  chave: string;
  rotulo: string;
}

/**
 * Fila de envio de comandos (spec 013, fase 2). Um clique durante outra ação entra na fila em vez
 * de ser descartado em silêncio. As tarefas rodam uma de cada vez, na ordem dos cliques, porque a
 * ordem importa para o dinheiro; a falha de uma não trava as seguintes. A mesma ação (mesma chave)
 * repetida enquanto espera não entra de novo: protege contra clique duplo.
 */
export function createFilaEnvio(max = 5, aoMudar: (pendentes: Pendente[]) => void = () => {}) {
  let cauda: Promise<unknown> = Promise.resolve();
  let seq = 0;
  let pendentes: Pendente[] = [];
  const publicar = (lista: Pendente[]) => {
    pendentes = lista;
    aoMudar(pendentes);
  };
  return {
    pendentes: () => pendentes,
    /**
     * Devolve o resultado da tarefa, ou `'repetida'`/`'cheia'` quando a ação não entra na fila.
     */
    async enfileirar<T>(
      chave: string,
      rotulo: string,
      tarefa: () => Promise<T>,
    ): Promise<T | 'repetida' | 'cheia'> {
      if (pendentes.some((p) => p.chave === chave)) return 'repetida';
      if (pendentes.length >= max) return 'cheia';
      const item = { id: ++seq, chave, rotulo };
      publicar([...pendentes, item]);
      const vez = cauda.then(tarefa);
      cauda = vez.catch(() => undefined);
      try {
        return await vez;
      } finally {
        publicar(pendentes.filter((p) => p.id !== item.id));
      }
    },
  };
}
