import { useMemo } from 'react';
import { useGame, cr } from '../../lib/game';
import { products, type ProductId } from '../../../../../packages/simulation/src/model';
import { arrears } from '../../../../../packages/simulation/src/design';
import { contaDaPrateleira, equipeDaLoja } from '../business/precificacao';

/** Algo que só o jogador resolve. Toda pendência traz a ação que a resolve. */
export interface Pendencia {
  id: string;
  tom: 'brasa' | 'ouro';
  /** Negócio afetado, para o cartão dele mostrar o motivo. */
  negocioId?: string;
  /** Produto envolvido, para mostrar a imagem no cartão. */
  produto?: ProductId;
  titulo: string;
  detalhe: string;
  /** Dinheiro por dia em jogo (centavos, estimativa): quanto se perde sem agir, ou se ganha agindo. */
  porDia?: { valor: number; sinal: 'perde' | 'ganha' };
  /** Números que importam, mostrados como fichas em vez de perdidos no texto. */
  fichas?: { rotulo: string; valor: string; tom?: 'ouro' | 'brasa' | 'lavoura' | 'ceu' }[];
  /** Quanto se cumpre de algo: a equipe que atende a procura, por exemplo. */
  medida?: { parte: number; rotulo: string };
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
        const conta = contaDaPrateleira(world, e);
        // Equipe curta: a cidade procura mais do que a loja consegue atender.
        const equipe = equipeDaLoja(world, e);
        if (equipe.ideal > e.employees && equipe.perdaDia > 0)
          itens.push({
            id: `equipe-${e.id}`,
            negocioId: e.id,
            tom: 'brasa',
            titulo: `Falta gente na ${e.name}`,
            detalhe: `${e.employees} ${e.employees === 1 ? 'pessoa atende' : 'pessoas atendem'} cerca de ${Math.round(equipe.atende)} de ${Math.round(equipe.procura)} clientes por rodada. O ideal agora é ${equipe.ideal}.`,
            porDia: { valor: equipe.perdaDia, sinal: 'perde' },
            fichas: [
              { rotulo: 'Equipe', valor: `${e.employees} de ${equipe.ideal}`, tom: 'brasa' },
              { rotulo: 'Atende', valor: `${Math.round(equipe.atende)} por rodada` },
              { rotulo: 'Procura', valor: `${Math.round(equipe.procura)} por rodada`, tom: 'ouro' },
            ],
            medida: {
              parte: equipe.procura > 0 ? equipe.atende / equipe.procura : 1,
              rotulo: `atende ${Math.round((equipe.atende / Math.max(1, equipe.procura)) * 100)}% da procura`,
            },
            acao: { rotulo: 'Ver equipe', executar: () => openBusiness(e.id, 'Equipe') },
          });
        // Preço longe do ponto de maior lucro, pela mesma conta da prateleira.
        const ganho = conta.melhor - conta.agora;
        if (conta.ajustar.length && ganho > 0)
          itens.push({
            id: `preco-${e.id}`,
            produto: conta.ajustar[0].id,
            negocioId: e.id,
            tom: 'ouro',
            titulo: `${conta.ajustar.length === 1 ? 'Um preço rende' : `${conta.ajustar.length} preços rendem`} mais na ${e.name}`,
            detalhe: `${lista(conta.ajustar.map((x) => products[x.id].name))} ${conta.ajustar.length === 1 ? 'está longe' : 'estão longe'} do ponto de maior lucro.`,
            porDia: { valor: Math.round(ganho), sinal: 'ganha' },
            fichas: [
              { rotulo: 'Hoje', valor: `${cr(conta.agora, 0)} por dia` },
              {
                rotulo: 'Com os melhores preços',
                valor: `${cr(conta.melhor, 0)} por dia`,
                tom: 'lavoura',
              },
            ],
            acao: { rotulo: 'Ajustar preços', executar: () => openBusiness(e.id, 'Prateleira') },
          });
        // Acabando: menos de um dia de vendas ao preço atual, pela mesma conta da prateleira.
        // Carga já na estrada para esta loja conta como estoque: não pede para repor de novo.
        const naEstrada = (id: ProductId) =>
          world.shipments
            .filter((c) => !c.delivered && c.destinationId === e.id && c.product === id)
            .reduce((n, c) => n + c.quantity, 0);
        const acabando = conta.itens
          .map((x) => ({
            id: x.id,
            dias: x.dias,
            porDia: x.vende * x.preco,
            vende: x.vende,
            estoque: x.estoque,
          }))
          .filter((x) => x.dias < 1 && (x.estoque + naEstrada(x.id)) / Math.max(0.01, x.vende) < 1);
        if (acabando.length) {
          const esgotados = acabando.filter((x) => x.dias === 0);
          const perda = acabando.reduce((n, x) => n + x.porDia, 0);
          const nomes = (xs: typeof acabando) => lista(xs.map((x) => products[x.id].name));
          itens.push({
            id: `estoque-${e.id}`,
            produto: acabando[0].id,
            negocioId: e.id,
            tom: esgotados.length ? 'brasa' : 'ouro',
            titulo: esgotados.length
              ? `${nomes(esgotados)} ${esgotados.length === 1 ? 'esgotou' : 'esgotaram'}`
              : `${nomes(acabando)} ${acabando.length === 1 ? 'acaba' : 'acabam'} em ~${Math.max(1, Math.round(acabando[0].dias * 24))} h`,
            detalhe: `${e.name}: sem repor, deixa de vender cerca de ${cr(perda, 0)} por dia.`,
            porDia: { valor: Math.round(perda), sinal: 'perde' },
            fichas: acabando.slice(0, 3).map((x) => ({
              rotulo: products[x.id].name,
              valor: x.dias === 0 ? 'esgotado' : `dura ~${Math.max(1, Math.round(x.dias * 24))} h`,
              tom: x.dias === 0 ? ('brasa' as const) : ('ouro' as const),
            })),
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
          produto: falta[0][0],
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
    // Urgente antes de atenção; dentro de cada tom, o que mexe com mais dinheiro primeiro.
    return itens.sort(
      (a, b) =>
        (a.tom === b.tom ? 0 : a.tom === 'brasa' ? -1 : 1) ||
        (b.porDia?.valor ?? 0) - (a.porDia?.valor ?? 0),
    );
    // O mundo muda por revisão; as ações dependem só da empresa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world.revision, actor]);
}
