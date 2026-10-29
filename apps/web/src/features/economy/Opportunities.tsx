import { useState } from 'react';
import { useGame, cr } from '../../lib/game';
import { Empty, PageHeading } from '../../components/ui';
import { SecaoAbas } from '../../components/SecaoAbas';
import { IconePixel } from '../../components/IconePixel';
import { BusinessIdeas, useNegocios, type FiltroNegocios } from './BusinessIdeas';
import '../../design/cotacoes.css';

/**
 * Negócios para abrir: o que custa, o que rende e quanto tempo leva para se pagar. As cotações
 * mostram onde falta mercadoria; aqui está o que fazer com isso.
 */
export function OpportunitiesPage() {
  const { navigate } = useGame();
  const { itens, caixa } = useNegocios();
  const [filtro, setFiltro] = useState<FiltroNegocios>('todos');
  const faltam = itens.filter((i) => i.falta).length;
  const cabem = itens.filter((i) => i.investimento <= caixa).length;
  return (
    <>
      <SecaoAbas secao="comercio" />
      <PageHeading
        title="Negócios para abrir"
        description="Quanto custa abrir cada negócio, quanto ele rende por dia e em quanto tempo se paga."
      />
      <div className="page-body cotacoes">
        {itens.length ? (
          <>
            <div className="cot-resumo">
              <div className="cot-fato">
                <IconePixel nome="moeda" tamanho={40} />
                <span>
                  <b>{cr(caixa, 0)}</b>
                  <small>de caixa livre</small>
                </span>
              </div>
              <div className="cot-fato">
                <IconePixel nome="fabrica" tamanho={40} />
                <span>
                  <b>{cabem}</b>
                  <small>{cabem === 1 ? 'negócio cabe no caixa' : 'negócios cabem no caixa'}</small>
                </span>
              </div>
              <div className={`cot-fato ${faltam ? 'alerta' : ''}`}>
                <IconePixel nome="alerta" tamanho={40} />
                <span>
                  <b>{faltam}</b>
                  <small>{faltam === 1 ? 'produto sem ninguém vendendo' : 'produtos sem ninguém vendendo'}</small>
                </span>
              </div>
            </div>
            <div className="cot-grupos" role="radiogroup" aria-label="Filtrar negócios">
              {(
                [
                  ['todos', 'Todos'],
                  ['caixa', 'Cabem no meu caixa'],
                  ['falta', 'Falta no mercado'],
                ] as const
              ).map(([id, rotulo]) => (
                <button
                  key={id}
                  role="radio"
                  aria-checked={filtro === id}
                  className={filtro === id ? 'on' : ''}
                  onClick={() => setFiltro(id)}
                >
                  {rotulo}
                </button>
              ))}
            </div>
            <BusinessIdeas filtro={filtro} />
            <p className="neg-nota">
              O lucro é uma estimativa: usa os preços de referência e considera a linha de produção
              sempre ocupada.
            </p>
          </>
        ) : (
          <Empty
            title="Este mundo ainda não calcula negócios para abrir"
            description="Veja as cotações para descobrir quais produtos estão em falta e vale a pena produzir."
            action={
              <button className="primary" onClick={() => navigate('quotes')}>
                Ver cotações
              </button>
            }
          />
        )}
      </div>
    </>
  );
}
