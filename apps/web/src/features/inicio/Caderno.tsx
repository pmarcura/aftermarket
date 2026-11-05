import { useEffect, useRef, useState } from 'react';
import { useGame, cr } from '../../lib/game';
import { BotaoProduto } from '../../components/BotaoProduto';
import { Carimbo } from '../../components/Livro';
import { IconePixel, type NomeIcone } from '../../components/IconePixel';
import { PixelArt } from '../../components/PixelArt';
import { ProdutoArte } from '../economy/Vitrine';
import { spriteDoNegocio } from '../../design/arte';
import type { Pendencia } from './pendencias';
import { NumeroVivo } from './vivo';
import { Ficha, Medidor } from './pecas';

/** O selo de cada tipo de pendência: o estado como objeto, não como etiqueta genérica. */
function selo(p: Pendencia): { texto: string; icone: NomeIcone } {
  const tipo = p.id.split('-')[0];
  if (tipo === 'estoque')
    return { texto: p.tom === 'brasa' ? 'Esgotado' : 'Acabando', icone: 'caixa' };
  if (tipo === 'equipe') return { texto: 'Falta gente', icone: 'equipe' };
  if (tipo === 'preco') return { texto: 'Preço', icone: 'justo' };
  if (tipo === 'proposta') return { texto: 'Proposta', icone: 'carta' };
  if (tipo === 'atraso') return { texto: 'Atrasado', icone: 'alerta' };
  if (tipo === 'instalar') return { texto: 'Instalar', icone: 'engrenagem' };
  if (tipo === 'insumo') return { texto: 'Sem insumo', icone: 'fabrica' };
  return { texto: 'Parado', icone: 'prazo' };
}

const MOSTRAR = 5;
const FEITO_MS = 2600;

/**
 * A lista do dono: cada linha é algo que só o jogador resolve, com o dinheiro em jogo por dia e o
 * botão que resolve. O que foi resolvido fica riscado um instante, com o carimbo de feito.
 */
export function Caderno({ pendencias }: { pendencias: Pendencia[] }) {
  const { world } = useGame();
  const [feitos, setFeitos] = useState<Pendencia[]>([]);
  const [tudo, setTudo] = useState(false);
  const antes = useRef(pendencias);
  const relogios = useRef<number[]>([]);
  useEffect(() => {
    const agora = new Set(pendencias.map((p) => p.id));
    const sumiram = antes.current.filter((p) => !agora.has(p.id));
    antes.current = pendencias;
    if (!sumiram.length) return;
    const ids = new Set(sumiram.map((p) => p.id));
    setFeitos((f) => [...f.filter((x) => !ids.has(x.id) && !agora.has(x.id)), ...sumiram]);
    relogios.current.push(
      window.setTimeout(() => setFeitos((f) => f.filter((x) => !ids.has(x.id))), FEITO_MS),
    );
  }, [pendencias]);
  useEffect(() => () => relogios.current.forEach((t) => clearTimeout(t)), []);

  const perde = pendencias.reduce(
    (n, p) => n + (p.porDia?.sinal === 'perde' ? p.porDia.valor : 0),
    0,
  );
  const visiveis = tudo ? pendencias : pendencias.slice(0, MOSTRAR);
  const linhas = [
    ...visiveis.map((p) => ({ p, feito: false })),
    ...feitos
      .filter((f) => !pendencias.some((p) => p.id === f.id))
      .map((p) => ({ p, feito: true })),
  ];

  return (
    <section className="cad" aria-labelledby="cad-titulo">
      <header className="cad-cab">
        <h2 id="cad-titulo" className="lv-grande">
          Hoje você precisa
        </h2>
        {pendencias.length > 0 && (
          <p className="cad-resumo">
            <span className="cad-conta">{pendencias.length}</span>
            {perde > 0 ? (
              <span className="lv-mao">custa ~{cr(perde, 0)} por dia não resolver</span>
            ) : (
              <span className="lv-mao">a primeira é a mais urgente</span>
            )}
          </p>
        )}
      </header>

      {linhas.length === 0 ? (
        <div className="cad-vazio">
          <Carimbo tom="lavoura" giro={-6}>
            Em dia
          </Carimbo>
          <p className="lv-mao">Nada esperando por você.</p>
          <p>Bom momento para crescer: as oportunidades estão logo abaixo.</p>
        </div>
      ) : (
        <ol className="cad-lista">
          {linhas.map(({ p, feito }) => {
            const s = selo(p);
            const negocio = world.establishments.find((e) => e.id === p.negocioId);
            return (
              <li key={p.id} className={`cad-item tom-${p.tom} ${feito ? 'feito' : ''}`}>
                <span className="cad-caixa" aria-hidden="true">
                  {feito && <i />}
                </span>
                <span className="cad-arte">
                  {p.produto ? (
                    <BotaoProduto product={p.produto}>
                      <ProdutoArte product={p.produto} escala={2} />
                    </BotaoProduto>
                  ) : negocio ? (
                    <PixelArt name={spriteDoNegocio(negocio, world)} scale={1} />
                  ) : (
                    <IconePixel nome={s.icone} tamanho={44} />
                  )}
                </span>
                <div className="cad-texto">
                  <Carimbo tom={feito ? 'lavoura' : p.tom} giro={p.tom === 'brasa' ? -3 : 2}>
                    {feito ? 'Feito' : s.texto}
                  </Carimbo>
                  <strong>{p.titulo}</strong>
                  <small>{p.detalhe}</small>
                  {p.fichas && (
                    <span className="cad-fichas">
                      {p.fichas.map((f) => (
                        <Ficha key={f.rotulo} rotulo={f.rotulo} valor={f.valor} tom={f.tom} />
                      ))}
                    </span>
                  )}
                  {p.medida && (
                    <Medidor
                      parte={p.medida.parte}
                      rotulo={p.medida.rotulo}
                      tom={p.tom === 'brasa' ? 'brasa' : 'ouro'}
                    />
                  )}
                </div>
                {p.porDia && (
                  <div className={`cad-valor ${p.porDia.sinal}`}>
                    <b>
                      {p.porDia.sinal === 'perde' ? '−' : '+'}
                      <NumeroVivo
                        valor={p.porDia.valor}
                        formato={(v) => cr(v, 0)}
                        id={`cad-${p.id}`}
                      />
                    </b>
                    <span>por dia · estimativa</span>
                  </div>
                )}
                {!feito && (
                  <button
                    className={`cad-acao ${p.tom === 'brasa' ? 'primary' : 'secondary'}`}
                    onClick={p.acao.executar}
                  >
                    {p.acao.rotulo}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {pendencias.length > MOSTRAR && (
        <button className="cad-mais" onClick={() => setTudo((v) => !v)} aria-expanded={tudo}>
          {tudo ? 'Mostrar só as principais' : `Ver mais ${pendencias.length - MOSTRAR}`}
        </button>
      )}
    </section>
  );
}
