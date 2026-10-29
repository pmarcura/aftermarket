import { num } from '../lib/game';
import { IconePixel } from './IconePixel';

/**
 * Estoque de um produto numa barra lisa: o que está no armazém, o que já está a caminho e o que
 * foi pedido. Duas etiquetas mostram a regra: onde a reposição dispara e até onde ela enche.
 */
export function BarraEstoque({
  fisico,
  aCaminho,
  pedido,
  minimo,
  alvo,
  unidade,
}: {
  fisico: number;
  aCaminho: number;
  pedido: number;
  minimo?: number;
  alvo?: number;
  unidade: string;
}) {
  const total = fisico + aCaminho + pedido;
  // A escala acompanha a regra; carga acima dela enche a barra e vira o aviso "+N além".
  const escala = Math.max(1, alvo ? alvo * 1.3 : total * 1.05);
  const pct = (v: number) => Math.min(100, (v / escala) * 100);
  const alem = Math.max(0, total - escala);
  const borda = (v: number) => (pct(v) < 14 ? ' borda-esq' : pct(v) > 86 ? ' borda-dir' : '');
  const texto = `${num(fisico)} ${unidade} no armazém${aCaminho ? `, ${num(aCaminho)} a caminho` : ''}${pedido ? `, ${num(pedido)} pedidos` : ''}${minimo !== undefined ? `. Repor ao cair a ${num(minimo)}` : ''}${alvo !== undefined ? `, encher até ${num(alvo)}` : ''}.`;
  return (
    <div className="bar-est" role="img" aria-label={texto}>
      <div className="bar-est-trilho" aria-hidden="true">
        <i className="fisico" style={{ width: `${pct(fisico)}%` }} />
        <i className="caminho" style={{ width: `${pct(aCaminho + fisico) - pct(fisico)}%` }} />
        <i className="pedido" style={{ width: `${pct(total) - pct(aCaminho + fisico)}%` }} />
      </div>
      {minimo !== undefined && (
        <span
          className={`bar-est-marco minimo${borda(minimo)}`}
          style={{ left: `${pct(minimo)}%` }}
          aria-hidden="true"
        >
          <small>repor aqui</small>
        </span>
      )}
      {alvo !== undefined && (
        <span
          className={`bar-est-marco alvo${borda(alvo)}`}
          style={{ left: `${pct(alvo)}%` }}
          aria-hidden="true"
        >
          <small>encher até</small>
        </span>
      )}
      {alem > 0 && (
        <em className="bar-est-alem">
          +{num(alem)} {unidade} além da barra
        </em>
      )}
    </div>
  );
}

/** Legenda única das barras de estoque: cada tipo com a sua ilustração. */
export function ChaveEstoque() {
  return (
    <div className="chave-est" aria-label="Legenda das barras de estoque">
      <div className="chave-est-grupo">
        <b>O que a barra mostra</b>
        <ul>
          <li>
            <IconePixel nome="caixa" tamanho={26} />
            <span>
              <i className="fisico" /> no armazém
            </span>
          </li>
          <li>
            <IconePixel nome="caminhao" tamanho={26} />
            <span>
              <i className="caminho" /> a caminho
            </span>
          </li>
          <li>
            <IconePixel nome="pedido" tamanho={26} />
            <span>
              <i className="pedido" /> pedido feito
            </span>
          </li>
        </ul>
      </div>
      <div className="chave-est-grupo">
        <b>A regra</b>
        <ul>
          <li>
            <span className="etiqueta minimo">repor aqui</span> quando cair até este ponto
          </li>
          <li>
            <span className="etiqueta alvo">encher até</span> a reposição para aqui
          </li>
        </ul>
      </div>
    </div>
  );
}
