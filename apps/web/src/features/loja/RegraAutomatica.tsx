import { useEffect, useMemo, useState } from 'react';
import { useGame, cr, num } from '../../lib/game';
import { Interruptor, Passo } from '../business/Abastecimento';
import { unidade } from '../economy/Carga';
import {
  products,
  type Establishment,
  type ProductId,
  type SupplyPolicy,
  type SupplyRule,
} from '../../../../../packages/simulation/src/model';
import { defaultSupplyPolicy } from '../../../../../packages/simulation/src/competition';
import { supplyForecast } from '../../../../../packages/simulation/src/supply';

/** A regra de repor sozinho de um produto da loja: liga, desliga e ajusta aqui mesmo. */
export function useRegra(loja: Establishment, product: ProductId) {
  const { world } = useGame();
  const salva = loja.supplyPolicy;
  const politica = useMemo<SupplyPolicy>(
    () => salva ?? { ...defaultSupplyPolicy(world, loja), rules: [] },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [salva, loja.id],
  );
  const regra = politica.rules.find((r) => r.product === product);
  return { politica, regra, ligada: Boolean(regra) && politica.enabled };
}

export function RegraAutomatica({ loja, product }: { loja: Establishment; product: ProductId }) {
  const { world, run, pending } = useGame();
  const { politica, regra } = useRegra(loja, product);
  const [r, setR] = useState<SupplyRule | undefined>(regra);
  useEffect(
    () => setR(regra),
    [regra?.minimum, regra?.target, regra?.maxBuy, regra?.maxPrice, regra?.originId],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const previsao = useMemo(
    () => supplyForecast(world, loja, politica),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, loja.id, politica],
  );
  const un = unidade(product, 2);
  const nome = products[product].name;
  const salvar = (proxima: SupplyPolicy, mensagem: string) =>
    run({ type: 'configureSupply', establishmentId: loja.id, policy: proxima }, mensagem);
  const modelo = (): SupplyRule =>
    defaultSupplyPolicy(world, loja).rules.find((x) => x.product === product) ?? {
      product,
      minimum: 10,
      target: 100,
      maxBuy: 100,
      maxPrice: Math.round(world.season.config.basePrices[product] * 1.5),
    };
  const ligar = () =>
    salvar(
      {
        ...politica,
        enabled: politica.rules.length === 0 ? true : politica.enabled,
        rules: [...politica.rules, modelo()],
      },
      `${nome} agora é reposto sozinho.`,
    );
  const desligar = () =>
    salvar(
      { ...politica, rules: politica.rules.filter((x) => x.product !== product) },
      `${nome} deixou de ser reposto sozinho.`,
    );

  const mudou =
    r &&
    regra &&
    (r.minimum !== regra.minimum || r.target !== regra.target || r.maxBuy !== regra.maxBuy);
  const valido = r ? Number.isInteger(r.minimum) && r.minimum >= 0 && r.minimum < r.target : true;
  const passo = Math.max(1, Math.round((r?.target ?? 100) / 20));
  const linha = previsao.rows.find((x) => x.product === product);
  const gasto = previsao.spent.executed;

  return (
    <section className="bl-regra" aria-label={`Repor ${nome} sozinho`}>
      <header>
        <span className="lv-rotulo">Repor sozinho</span>
        <Interruptor
          ligado={Boolean(regra)}
          desabilitado={pending}
          rotulo={`Repor ${nome} sozinho`}
          onChange={() => void (regra ? desligar() : ligar())}
        />
      </header>
      {!regra ? (
        <p className="bl-regra-dica">
          Desligado: nada é comprado sozinho. Ligue para a loja pedir{' '}
          {nome.toLocaleLowerCase('pt-BR')} quando o estoque cair, sem você precisar lembrar.
        </p>
      ) : (
        r && (
          <>
            {!politica.enabled && (
              <p className="bl-regra-aviso">
                O abastecimento automático da loja está pausado, então nada é comprado ainda.{' '}
                <button
                  className="text-button"
                  disabled={pending}
                  onClick={() =>
                    void salvar({ ...politica, enabled: true }, 'Abastecimento automático ligado.')
                  }
                >
                  Ligar agora
                </button>
              </p>
            )}
            <div className="bl-regra-passos">
              <Passo
                rotulo="Quando cair a"
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
            </div>
            <p className="bl-regra-plano">
              {linha?.want
                ? linha.best
                  ? `Próxima reposição: ${num(linha.best.quantity)} ${un} de ${linha.best.origin.name} por ${cr(linha.best.total, 0)}.`
                  : 'Ninguém atende às regras agora. Aumente o preço máximo na tela de Mercado.'
                : 'Estoque dentro da regra. Nada a repor agora.'}{' '}
              <small>
                Gasto de hoje: {cr(gasto, 0)} de {cr(politica.dailyBudget, 0)}.
              </small>
            </p>
            <footer>
              {!valido && (
                <span className="bl-erro">O valor de repor precisa ser menor que o de encher.</span>
              )}
              <button
                className="primary"
                disabled={!mudou || !valido || pending}
                onClick={() =>
                  void salvar(
                    {
                      ...politica,
                      rules: politica.rules.map((x) => (x.product === product ? r : x)),
                    },
                    `Regra de ${nome} salva.`,
                  )
                }
              >
                {mudou ? 'Salvar regra' : 'Regra salva'}
              </button>
            </footer>
          </>
        )
      )}
    </section>
  );
}
