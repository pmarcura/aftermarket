import { useMemo } from 'react';
import { useGame, cr } from '../../lib/game';
import { products, type ProductId } from '../../../../../packages/simulation/src/model';
import { arrears } from '../../../../../packages/simulation/src/design';
import { contaDaPrateleira } from '../business/precificacao';

/** Algo que só o jogador resolve. Toda pendência traz a ação que a resolve. */
export interface Pendencia {
  id: string;
  tom: 'brasa' | 'ouro';
  /** Negócio afetado, para o cartão dele mostrar o motivo. */
  negocioId?: string;
  titulo: string;
  detalhe: string;
  acao: { rotulo: string; executar: () => void };
}

const lista = (nomes: string[]) =>
  nomes.length <= 2
    ? nomes.join(' e ')
    : `${nomes.slice(0, 2).join(', ')} e mais ${nomes.length - 2}`;

/**
 * Pendências conferidas no estado do mundo: continuam aparecendo até a causa sumir.
 * Mesma fonte para o Início e para o sino da barra de cima.
 */
export function usePendencias(): Pendencia[] {
  const { world, actor, navigate, openBusiness, openRepor } = useGame();
  return useMemo(() => {
    const itens: Pendencia[] = [];
    const atraso = arrears(world, actor);
    if (atraso > 0)
      itens.push({
        id: 'atraso',
        tom: 'brasa',
        titulo: 'Pagamentos atrasados',
        detalhe: `${cr(atraso)} em aberto. Atraso trava compras e crédito.`,
        acao: { rotulo: 'Resolver', executar: () => navigate('company') },
      });

    for (const o of world.orders) {
      if (o.status !== 'pending') continue;
      const ultima = o.proposals?.at(-1);
      if (!ultima || ultima.proposedBy === actor) continue;
      if (o.buyerId !== actor && ultima.sellerId !== actor) continue;
      const quem = world.companies.find((c) => c.id === ultima.proposedBy)?.name ?? 'Uma empresa';
      itens.push({
        id: `proposta-${o.id}`,
        tom: 'ouro',
        titulo: `${quem} fez uma proposta`,
        detalhe: `${products[o.product].name}: ${cr(ultima.unitPrice)} por unidade.`,
        acao: { rotulo: 'Responder', executar: () => navigate('orders') },
      });
    }

    for (const e of world.establishments.filter((x) => x.companyId === actor)) {
      if (e.installed === false) {
        itens.push({
          id: `instalar-${e.id}`,
          negocioId: e.id,
          tom: 'ouro',
          titulo: `${e.name} ainda não foi instalado`,
          detalhe: 'Sem equipamento, o imóvel só gera custo.',
          acao: { rotulo: 'Instalar', executar: () => openBusiness(e.id) },
        });
        continue;
      }
      if (!e.enabled) {
        itens.push({
          id: `parado-${e.id}`,
          negocioId: e.id,
          tom: 'ouro',
          titulo: `${e.name} está ${e.mothballed ? 'suspenso' : 'pausado'}`,
          detalhe: 'Não vende nem produz enquanto estiver parado.',
          acao: { rotulo: 'Abrir', executar: () => openBusiness(e.id) },
        });
        continue;
      }
      if (e.category === 'retail') {
        // Acabando: menos de um dia de vendas ao preço atual, pela mesma conta da prateleira.
        const acabando = contaDaPrateleira(world, e)
          .itens.map((x) => ({ id: x.id, dias: x.dias, porDia: x.vende * x.preco }))
          .filter((x) => x.dias < 1);
        if (acabando.length) {
          const esgotados = acabando.filter((x) => x.dias === 0);
          const perda = acabando.reduce((n, x) => n + x.porDia, 0);
          const nomes = (xs: typeof acabando) => lista(xs.map((x) => products[x.id].name));
          itens.push({
            id: `estoque-${e.id}`,
            negocioId: e.id,
            tom: esgotados.length ? 'brasa' : 'ouro',
            titulo: esgotados.length
              ? `${nomes(esgotados)} ${esgotados.length === 1 ? 'esgotou' : 'esgotaram'}`
              : `${nomes(acabando)} ${acabando.length === 1 ? 'acaba' : 'acabam'} em ~${Math.max(1, Math.round(acabando[0].dias * 24))} h`,
            detalhe: `${e.name}: sem repor, deixa de vender cerca de ${cr(perda, 0)} por dia.`,
            acao: {
              rotulo: 'Repor',
              executar: () => openRepor({ destinationId: e.id, product: acabando[0].id }),
            },
          });
        }
        continue;
      }
      const receita = world.season.config.recipes.find((r) => r.id === e.specialization);
      const falta = receita
        ? (Object.entries(receita.input) as [ProductId, number][]).filter(
            ([p, q]) => (e.inventory[p] ?? 0) < q,
          )
        : [];
      if (falta.length)
        itens.push({
          id: `insumo-${e.id}`,
          negocioId: e.id,
          tom: 'brasa',
          titulo: `${e.name} sem ${lista(falta.map(([p]) => products[p].name.toLocaleLowerCase('pt-BR')))}`,
          detalhe: 'Não há insumo para o próximo ciclo de produção.',
          acao: {
            rotulo: 'Repor',
            executar: () => openRepor({ destinationId: e.id, product: falta[0][0] }),
          },
        });
    }
    return itens.sort((a, b) => (a.tom === b.tom ? 0 : a.tom === 'brasa' ? -1 : 1));
    // O mundo muda por revisão; as ações dependem só da empresa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world.revision, actor]);
}
