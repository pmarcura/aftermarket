import { useState } from 'react';
import { BarraEmpilhada } from '../../components/BarrasPixel';
import { IconePixel } from '../../components/IconePixel';
import { useGame, cr, num } from '../../lib/game';
import { useClock } from '../../lib/clock';
import {
  treasuryAvailable,
  treasuryReserved,
} from '../../../../../packages/simulation/src/operations';
import type { InfrastructureContract } from '../../../../../packages/simulation/src/model';
import { CartaoContrato, minhaSituacao } from './CartaoContrato';
import { ModalDisputa } from './ModalDisputa';
import '../../design/pedidos.css';
import '../../design/contratos.css';

const POR_VEZ = 6;
const SITUACOES = [
  ['', 'Todos'],
  ['open', 'Em disputa'],
  ['delivering', 'Em entrega'],
  ['completed', 'Concluídos'],
  ['expired', 'Sem vencedor'],
] as const;

/**
 * Contratos públicos como jogo de disputa: primeiro os que você pode atender agora, depois os
 * demais em disputa, as entregas em andamento e, recolhidos, os encerrados.
 */
export function Contratos() {
  const { world, actor } = useGame();
  const agora = useClock();
  const [uf, setUf] = useState('');
  const [situacao, setSituacao] = useState('');
  const [disputa, setDisputa] = useState<InfrastructureContract>();
  const [mais, setMais] = useState(POR_VEZ);
  const [verFim, setVerFim] = useState(false);

  const governo = world.companies.filter(
    (c) =>
      (c.id.startsWith('treasury:') && (!uf || c.homeState === uf)) ||
      (!uf && c.id === 'treasury' && c.balance > 0),
  );
  const estados = [
    '',
    ...world.infrastructure
      .map((c) => c.state ?? '')
      .filter(Boolean)
      .sort(),
  ].filter((e, i, todos) => todos.indexOf(e) === i);
  const todos = world.infrastructure
    .filter((c) => (!uf || c.state === uf) && (!situacao || c.status === situacao))
    .slice()
    .reverse();
  const aberto = (c: InfrastructureContract) =>
    c.status === 'open' && (!c.biddingEndsAt || agora < c.biddingEndsAt);
  const atendo = todos.filter(
    (c) => aberto(c) && minhaSituacao(c, actor, world.establishments).atende,
  );
  const naDisputa = todos.filter((c) => !atendo.includes(c) && c.status === 'open');
  const entregando = todos.filter((c) => c.status === 'delivering');
  const encerrados = todos.filter(
    (c) => (c.status === 'completed' || c.status === 'expired') && !atendo.includes(c),
  );
  const demais = naDisputa.slice(0, mais);

  return (
    <div className="ctr">
      <section className="ctr-caixa" aria-label="Dinheiro das prefeituras">
        <div className="ctr-caixa-titulo">
          <IconePixel nome="prefeitura" tamanho={44} />
          <div>
            <h2>Quanto as prefeituras têm para gastar</h2>
            <p>{uf ? `Estado de ${uf}` : 'Todos os estados'}</p>
          </div>
        </div>
        <dl>
          <div>
            <dt>No caixa</dt>
            <dd>
              {cr(
                governo.reduce((n, c) => n + c.balance, 0),
                0,
              )}
            </dd>
          </div>
          <div>
            <dt>Já prometido</dt>
            <dd>{cr(treasuryReserved(world, uf || undefined), 0)}</dd>
          </div>
          <div className="livre">
            <dt>Livre para novos contratos</dt>
            <dd>{cr(treasuryAvailable(world, uf || undefined), 0)}</dd>
          </div>
        </dl>
      </section>

      <section className="ctr-regra" aria-label="Como a vencedora é escolhida">
        <h2>Como se ganha um contrato</h2>
        <BarraEmpilhada
          titulo="Pesos da nota, em pontos de 100"
          formato={(v) => `${v} pontos`}
          partes={[
            {
              id: 'q',
              rotulo: 'Qualidade',
              valor: 45,
              cor: 1,
              forma: 'quadrado',
              ajuda: 'o que pesa mais',
            },
            {
              id: 'p',
              rotulo: 'Preço',
              valor: 25,
              cor: 3,
              forma: 'losango',
              ajuda: 'quanto menor, melhor',
            },
            {
              id: 't',
              rotulo: 'Prazo',
              valor: 20,
              cor: 2,
              forma: 'triangulo',
              ajuda: 'entrega mais rápida',
            },
            {
              id: 'f',
              rotulo: 'Frete',
              valor: 10,
              cor: 4,
              forma: 'cruz',
              ajuda: 'frete mais barato',
            },
          ]}
        />
        <p className="ped-nota">
          O teto por unidade é o preço de referência mais 25%. Caixa e estoque são conferidos quando
          a disputa fecha.
        </p>
      </section>

      <div className="ctr-filtros">
        <div role="group" aria-label="Estado dos contratos públicos">
          {estados.map((e) => (
            <button
              key={e || 'todos'}
              aria-pressed={uf === e}
              className={uf === e ? 'on' : ''}
              onClick={() => setUf(e)}
            >
              {e || 'Todos os estados'}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Situação dos contratos públicos">
          {SITUACOES.map(([v, rotulo]) => (
            <button
              key={v || 'todos'}
              aria-pressed={situacao === v}
              className={situacao === v ? 'on' : ''}
              onClick={() => setSituacao(v)}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {atendo.length > 0 && (
        <section className="ped-secao">
          <h2>
            Você pode atender <span className="ped-conta">{atendo.length}</span>
          </h2>
          <p className="ped-nota">Você tem estoque, na qualidade pedida, para entrar agora.</p>
          <div className="ped-lista">
            {atendo.map((c) => (
              <CartaoContrato key={c.id} c={c} onParticipar={setDisputa} />
            ))}
          </div>
        </section>
      )}

      {naDisputa.length > 0 && (
        <section className="ped-secao">
          <h2>
            Outros em disputa <span className="ped-conta">{naDisputa.length}</span>
          </h2>
          <div className="ped-lista">
            {demais.map((c) => (
              <CartaoContrato key={c.id} c={c} onParticipar={setDisputa} />
            ))}
            {naDisputa.length > mais && (
              <button className="secondary ped-mais" onClick={() => setMais(mais + POR_VEZ)}>
                Mostrar mais contratos
              </button>
            )}
          </div>
        </section>
      )}

      {entregando.length > 0 && (
        <section className="ped-secao">
          <h2>
            Em entrega <span className="ped-conta">{entregando.length}</span>
          </h2>
          <div className="ped-lista">
            {entregando.map((c) => (
              <CartaoContrato key={c.id} c={c} onParticipar={setDisputa} />
            ))}
          </div>
        </section>
      )}

      {encerrados.length > 0 && (
        <section className="ped-secao">
          <h2>
            Encerrados <span className="ped-conta">{encerrados.length}</span>
          </h2>
          {verFim ? (
            <div className="ped-lista">
              {encerrados.slice(0, 12).map((c) => (
                <CartaoContrato key={c.id} c={c} onParticipar={setDisputa} />
              ))}
              {encerrados.length > 12 && (
                <p className="ped-nota">
                  Mostrando os 12 mais recentes de {num(encerrados.length)}.
                </p>
              )}
            </div>
          ) : (
            <button className="secondary ped-mais" onClick={() => setVerFim(true)}>
              Ver contratos encerrados
            </button>
          )}
        </section>
      )}

      {todos.length === 0 && (
        <div className="ped-vazio">
          <IconePixel nome="prefeitura" tamanho={56} />
          <h3>Nenhum contrato por aqui</h3>
          <p>
            Os estados abrem contratos conforme a arrecadação e o orçamento livre. Mude os filtros
            ou volte daqui a pouco.
          </p>
        </div>
      )}

      {disputa && (
        <ModalDisputa
          contrato={world.infrastructure.find((c) => c.id === disputa.id) ?? disputa}
          onClose={() => setDisputa(undefined)}
        />
      )}
    </div>
  );
}
