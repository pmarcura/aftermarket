import { describe, expect, it } from 'vitest';
import { createFilaEnvio, type Pendente } from '../apps/web/src/lib/fila-envio';

// Spec 013, fase 2: clique durante outra ação entra na fila em vez de sumir.
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('fila de envio de comandos', () => {
  it('roda na ordem dos cliques, uma de cada vez, e mostra o que está na fila', async () => {
    const vistos: string[][] = [];
    const fila = createFilaEnvio(5, (p: Pendente[]) => vistos.push(p.map((x) => x.rotulo)));
    const ordem: string[] = [];
    let rodando = 0,
      maxSimultaneas = 0;
    const tarefa = (nome: string, ms: number) => async () => {
      rodando++;
      maxSimultaneas = Math.max(maxSimultaneas, rodando);
      await esperar(ms);
      ordem.push(nome);
      rodando--;
      return nome;
    };
    const resultados = await Promise.all([
      fila.enfileirar('a', 'Compra', tarefa('a', 30)),
      fila.enfileirar('b', 'Preço', tarefa('b', 5)),
      fila.enfileirar('c', 'Regra', tarefa('c', 1)),
    ]);
    expect(resultados).toEqual(['a', 'b', 'c']);
    expect(ordem).toEqual(['a', 'b', 'c']);
    expect(maxSimultaneas).toBe(1);
    expect(vistos[2]).toEqual(['Compra', 'Preço', 'Regra']);
    expect(fila.pendentes()).toEqual([]);
  });

  it('a mesma ação repetida enquanto espera não entra de novo (clique duplo)', async () => {
    const fila = createFilaEnvio();
    let vezes = 0;
    const comprar = async () => {
      vezes++;
      await esperar(10);
      return true;
    };
    const [primeira, segunda] = await Promise.all([
      fila.enfileirar('comprar|soja|300', 'Compra', comprar),
      fila.enfileirar('comprar|soja|300', 'Compra', comprar),
    ]);
    expect(primeira).toBe(true);
    expect(segunda).toBe('repetida');
    expect(vezes).toBe(1);
    // Depois de confirmada, a mesma ação pode ser feita de novo.
    expect(await fila.enfileirar('comprar|soja|300', 'Compra', comprar)).toBe(true);
    expect(vezes).toBe(2);
  });

  it('fila cheia recusa sem enviar, e erro de uma ação não trava as seguintes', async () => {
    const fila = createFilaEnvio(2);
    const lenta = () => esperar(20).then(() => 'ok');
    const falha = async () => {
      throw new Error('recusada');
    };
    const a = fila.enfileirar('1', 'Um', falha);
    const b = fila.enfileirar('2', 'Dois', lenta);
    const c = fila.enfileirar('3', 'Três', lenta);
    await expect(a).rejects.toThrow('recusada');
    expect(await b).toBe('ok');
    expect(await c).toBe('cheia');
    expect(fila.pendentes()).toEqual([]);
  });
});
