import { useEffect, useMemo, useState } from 'react';
import { useGame, cr, num } from '../../../lib/game';
import { Passo } from '../Abastecimento';
import { BotaoEspera } from '../../../components/Espera';
import { IconePixel, type NomeIcone } from '../../../components/IconePixel';
import { ProdutoArte } from '../../economy/Vitrine';
import { Lacuna, ReguaEstoque } from '../../loja/RegraAutomatica';
import { politicaCom } from '../CadeiaBlocos';
import { nomeTransportadora } from '../../loja/frete';
import {
  products,
  type Establishment,
  type ProductId,
  type SupplyPolicy,
  type SupplyRule,
} from '../../../../../../packages/simulation/src/model';
import { defaultSupplyPolicy } from '../../../../../../packages/simulation/src/competition';
import { dailyNeed, supplyForecast } from '../../../../../../packages/simulation/src/supply';
import '../../../design/loja-balcao.css';
import '../../../design/producao-insumo.css';

/** Quantos dias de consumo da linha manter: pede quando cai à metade e enche até o total. */
const DIAS = [
  { dias: 3, ajuda: 'Pouco dinheiro parado; o caminhão sai mais vezes.' },
  { dias: 7, ajuda: 'Uma semana de produção garantida: o equilíbrio.' },
  { dias: 15, ajuda: 'Cargas grandes e frete mais barato; mais dinheiro parado em estoque.' },
] as const;

interface Aviso {
  tom: 'brasa' | 'ouro';
  icone: NomeIcone;
  texto: string;
  acao?: { rotulo: string; agir: () => void };
}

/**
 * O insumo de uma unidade de produção como um combinado com o gerente: quantos dias de consumo
 * manter e de onde trazer. Mesmo comando (`configureSupply`) e mesma conta da regra da loja.
 */
export function RegraInsumo({
  unidade: e,
  product,
  onTrazer,
}: {
  unidade: Establishment;
  product: ProductId;
  /** Abre a transferência avulsa de outra unidade sua (só quando alguma tem o insumo). */
  onTrazer?: () => void;
}) {
  const { world, actor, run, pending, openRepor } = useGame();
  const politica = useMemo<SupplyPolicy>(
    () => e.supplyPolicy ?? { ...defaultSupplyPolicy(world, e), rules: [] },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [e.supplyPolicy, e.id],
  );
  const regra = politica.rules.find((r) => r.product === product);
  const [r, setR] = useState<SupplyRule | undefined>(regra);
  useEffect(
    () => setR(regra),
    [regra?.minimum, regra?.target, regra?.maxBuy, regra?.maxPrice, regra?.originId],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const previsao = useMemo(
    () => supplyForecast(world, e, politica),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, e.id, politica],
  );
  const nome = products[product].name;
  const un = products[product].unit;
  const gastaDia = dailyNeed(world, e, product);
  const consumo = Math.max(0.01, gastaDia);
  const estoque = e.inventory[product] ?? 0;
  const linha = previsao.rows.find((x) => x.product === product);
  const aCaminho = (linha?.incoming ?? 0) + (linha?.promised ?? 0);
  const fonte = regra ? (regra.originId ?? 'mercado') : null;
  const proprias = world.establishments.filter(
    (x) =>
      x.companyId === actor &&
      x.id !== e.id &&
      Object.keys(
        world.season.config.recipes.find((rc) => rc.id === x.specialization)?.output ?? {},
      ).includes(product),
  );

  const salvar = (proxima: SupplyPolicy, mensagem: string) =>
    run({ type: 'configureSupply', establishmentId: e.id, policy: proxima }, mensagem);
  const paraDias = (base: SupplyRule, dias: number): SupplyRule => {
    const target = Math.max(2, Math.ceil(consumo * dias));
    return {
      ...base,
      minimum: Math.min(target - 1, Math.ceil(target / 2)),
      target,
      maxBuy: target,
    };
  };
  const trocarFonte = (nova: string | 'mercado' | null) => {
    const base = politicaCom(world, e, product, nova);
    // Regra que nasce aqui já vem com uma semana de consumo.
    const nasceu = !regra && nova !== null;
    const politicaFinal = nasceu
      ? {
          ...base,
          rules: base.rules.map((x) => (x.product === product ? paraDias(x, 7) : x)),
        }
      : base;
    return salvar(
      politicaFinal,
      nova === null
        ? `${nome}: agora você manda buscar na mão.`
        : nova === 'mercado'
          ? `${nome}: o gerente compra no mercado.`
          : `${nome}: vem de ${proprias.find((x) => x.id === nova)?.name}.`,
    );
  };
  const trocarRegra = (nova: SupplyRule, mensagem: string) =>
    salvar(
      { ...politica, rules: politica.rules.map((x) => (x.product === product ? nova : x)) },
      mensagem,
    );

  const diasAtuais = regra
    ? DIAS.find(
        (d) => Math.abs(regra.target - Math.ceil(consumo * d.dias)) <= consumo * d.dias * 0.15,
      )?.dias
    : undefined;
  const mudou =
    r &&
    regra &&
    (r.minimum !== regra.minimum ||
      r.target !== regra.target ||
      r.maxBuy !== regra.maxBuy ||
      r.maxPrice !== regra.maxPrice);
  const valido = r ? Number.isInteger(r.minimum) && r.minimum >= 0 && r.minimum < r.target : true;
  const passo = Math.max(1, Math.round((r?.target ?? 100) / 20));
  const durabilidade = gastaDia > 0 ? estoque / gastaDia : Infinity;

  const fala = !regra
    ? ''
    : linha?.want
      ? linha.best
        ? `Vou ${linha.best.internal ? 'trazer' : 'comprar'} ${num(linha.best.quantity)} ${un} de ${linha.best.origin.name}: ${cr(linha.best.total, 0)}, com ${cr(linha.best.q.price / linha.best.quantity)} de frete por ${un} (${nomeTransportadora(world, linha.best.q.carrierId, actor)}).`
        : `O estoque baixou do combinado, mas ninguém entrega ${nome.toLocaleLowerCase('pt-BR')} dentro das regras agora.`
      : aCaminho > 0
        ? `${estoque <= 0 ? 'O armazém está vazio, mas ' : ''}${num(aCaminho)} ${un} já ${linha?.incoming ? 'estão na estrada' : 'foram pedidos'}.`
        : `Tudo dentro do combinado. Peço de novo quando baixar de ${num(regra.minimum)} ${un}.`;

  const avisos: Aviso[] = [];
  if (regra && !politica.enabled)
    avisos.push({
      tom: 'ouro',
      icone: 'alerta',
      texto: 'O abastecimento automático desta unidade está pausado: o gerente não compra nada.',
      acao: {
        rotulo: 'Retomar',
        agir: () => void salvar({ ...politica, enabled: true }, 'O gerente voltou a repor.'),
      },
    });
  if (regra && gastaDia > 0 && regra.target < gastaDia)
    avisos.push({
      tom: 'brasa',
      icone: 'prazo',
      texto: `O combinado guarda no máximo ${num(regra.target)} ${un}, menos do que a linha gasta em um dia (${num(gastaDia, 1)} ${un}). Ela vai parar entre uma entrega e outra.`,
      acao: {
        rotulo: 'Usar 7 dias',
        agir: () => void trocarRegra(paraDias(regra, 7), `Combinado: 7 dias de ${nome}.`),
      },
    });
  if (regra && linha?.want && !linha.best)
    avisos.push({
      tom: 'brasa',
      icone: 'alerta',
      texto: `Ninguém entrega ${nome.toLocaleLowerCase('pt-BR')} por até ${cr(regra.maxPrice)} por ${un}, até ${num(politica.maxDistanceKm)} km. Sem insumo, a linha para.`,
      acao: {
        rotulo: 'Mandar buscar agora',
        agir: () => openRepor({ destinationId: e.id, product }),
      },
    });
  if (regra && e.supplyStatus?.startsWith('Orçamento'))
    avisos.push({
      tom: 'ouro',
      icone: 'moeda',
      texto: `${e.supplyStatus}. Aumente o gasto por dia ou a reserva de caixa nas regras gerais, abaixo.`,
    });

  // Uma vez, sem regra: comprar no mercado ou trazer de outra unidade sua.
  const avulsas = (
    <>
      <button className="secondary" onClick={() => openRepor({ destinationId: e.id, product })}>
        Mandar buscar uma vez
      </button>
      {onTrazer && (
        <button className="secondary" onClick={onTrazer}>
          Trazer de outra unidade
        </button>
      )}
    </>
  );

  return (
    <section className="bl-regra pi" aria-label={`Abastecer ${nome}`}>
      <header className="pi-cab">
        <ProdutoArte product={product} escala={2} />
        <div>
          <span className="lv-rotulo">Insumo da linha</span>
          <h3 className="lv-grande">{nome}</h3>
          <p>
            {num(estoque)} {un} no armazém ·{' '}
            {gastaDia > 0
              ? `a linha gasta ${num(gastaDia, gastaDia < 10 ? 1 : 0)} ${un} por dia${durabilidade < Infinity ? ` · dura ${num(durabilidade, durabilidade < 10 ? 1 : 0)} d` : ''}`
              : 'a linha está parada'}
          </p>
        </div>
      </header>

      {!regra ? (
        <div className="bl-como">
          <p>
            O gerente pode manter {nome.toLocaleLowerCase('pt-BR')} no armazém para a linha não
            parar:
          </p>
          <ol>
            <li>
              <IconePixel nome="caixa" tamanho={32} />
              <span>Você diz quantos dias de produção quer garantir.</span>
            </li>
            <li>
              <IconePixel nome="caminhao" tamanho={32} />
              <span>Quando o estoque cai à metade, ele traz mais.</span>
            </li>
            <li>
              <IconePixel nome="moeda" tamanho={32} />
              <span>De um negócio seu, ou do mercado, de quem entregar mais barato.</span>
            </li>
          </ol>
          <div className="pi-comecar">
            <button
              className="primary"
              disabled={pending}
              onClick={() => void trocarFonte(proprias[0]?.id ?? 'mercado')}
            >
              Combinar com o gerente
            </button>
            {avulsas}
          </div>
        </div>
      ) : (
        r && (
          <>
            <article className="lv-nota bl-bilhete">
              <span className="lv-fita a" aria-hidden="true" />
              <p className="lv-mao">Combinado com o gerente</p>
              <p className="bl-frase">
                Manter{' '}
                <Lacuna
                  rotulo="Dias de produção garantidos"
                  valor={diasAtuais ? `${diasAtuais} dias` : 'regra própria'}
                  desabilitada={pending}
                  opcoes={DIAS.map((d) => ({
                    id: d.dias,
                    nome: `${d.dias} dias · ~${num(Math.ceil(consumo * d.dias))} ${un}`,
                    ajuda: d.ajuda,
                    atual: diasAtuais === d.dias,
                  }))}
                  onEscolher={(d) =>
                    void trocarRegra(paraDias(regra, d), `Combinado: ${d} dias de ${nome}.`)
                  }
                />{' '}
                de {nome} no armazém, umas{' '}
                <b>
                  {num(regra.target)} {un}
                </b>
                . Quando baixar de{' '}
                <b>
                  {num(regra.minimum)} {un}
                </b>
                , trazer{' '}
                <Lacuna
                  rotulo="De onde vem"
                  valor={
                    fonte === 'mercado'
                      ? 'do mercado'
                      : `de ${proprias.find((x) => x.id === fonte)?.name ?? 'outra unidade'}`
                  }
                  desabilitada={pending}
                  opcoes={[
                    ...proprias.map((x) => ({
                      id: x.id,
                      nome: x.name,
                      ajuda: `Seu negócio · ${num(Math.floor(x.inventory[product] ?? 0))} ${un} no armazém. Paga só o frete.`,
                      atual: fonte === x.id,
                    })),
                    {
                      id: 'mercado',
                      nome: 'Do mercado',
                      ajuda: 'O gerente compra de quem entregar mais barato, frete incluído.',
                      atual: fonte === 'mercado',
                    },
                    {
                      id: 'mao',
                      nome: 'Na mão',
                      ajuda: 'Ninguém repõe sozinho: você manda buscar quando quiser.',
                      atual: false,
                    },
                  ]}
                  onEscolher={(id) => void trocarFonte(id === 'mao' ? null : id)}
                />
                .
              </p>
            </article>

            <ReguaEstoque
              atual={estoque}
              aCaminho={aCaminho}
              pede={regra.minimum}
              enche={regra.target}
              un={un}
              onde="no armazém"
            />

            <div className="bl-gerente">
              <IconePixel nome="equipe" tamanho={28} />
              <p>
                <b>Gerente:</b> {fala}
              </p>
            </div>

            {avisos.length > 0 && (
              <ul className="bl-avisos">
                {avisos.map((a) => (
                  <li key={a.texto} className={`tom-${a.tom}`}>
                    <IconePixel nome={a.icone} tamanho={24} />
                    <span>{a.texto}</span>
                    {a.acao && (
                      <button className="secondary" disabled={pending} onClick={a.acao.agir}>
                        {a.acao.rotulo}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="pi-comecar">{avulsas}</div>

            <details className="bl-ajuste">
              <summary>Ajuste fino</summary>
              <div className="bl-ajuste-corpo">
                <div className="bl-regra-passos">
                  <Passo
                    rotulo="Pedir quando cair a"
                    valor={r.minimum}
                    passo={passo}
                    max={Math.max(0, r.target - 1)}
                    unidade={un}
                    onChange={(v) => setR({ ...r, minimum: v })}
                  />
                  <Passo
                    rotulo="Encher até"
                    valor={r.target}
                    passo={passo}
                    min={1}
                    unidade={un}
                    onChange={(v) =>
                      setR({ ...r, target: v, maxBuy: Math.max(r.maxBuy, v - r.minimum) })
                    }
                  />
                  <Passo
                    rotulo={`Pagar no máximo, por ${un} (R$)`}
                    valor={r.maxPrice / 100}
                    passo={Math.max(0.5, Math.round(r.maxPrice / 2000) / 10)}
                    casas={2}
                    onChange={(v) => setR({ ...r, maxPrice: Math.round(v * 100) })}
                  />
                </div>
                {(mudou || !valido) && (
                  <footer className="bl-regra-salvar">
                    {!valido && (
                      <span className="bl-erro">
                        O valor de pedir precisa ser menor que o de encher.
                      </span>
                    )}
                    <BotaoEspera
                      className="primary"
                      esperando="Salvando…"
                      disabled={!valido || pending}
                      onClick={() => trocarRegra(r, `Regra de ${nome} salva.`)}
                    >
                      Salvar
                    </BotaoEspera>
                    <button className="text-button" onClick={() => setR(regra)}>
                      Desfazer
                    </button>
                  </footer>
                )}
              </div>
            </details>
          </>
        )
      )}
    </section>
  );
}
