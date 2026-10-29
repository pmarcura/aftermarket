import { useMemo, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { useGame, cr, num, ProductIcon } from '../../lib/game';
import { Empty } from '../../components/ui';
import { GraficoPixel } from '../../components/GraficoPixel';
import { BarraEmpilhada, BarrasPixel, type ParteEmpilhada } from '../../components/BarrasPixel';
import { comecoDoDia } from '../inicio/tempo';
import {
  products,
  type Entry,
  type Establishment,
  type ProductId,
  type World,
} from '../../../../../packages/simulation/src/model';
import {
  GAME_DAY,
  gameCalendar,
  inventoryQuality,
  weekdayNames,
} from '../../../../../packages/simulation/src/operations';
import { householdDemand, regionFor } from '../../../../../packages/simulation/src/metrics';
import '../../design/financas.css';

type Grupo = 'mercadoria' | 'frete' | 'equipe' | 'energia' | 'operacao';

// Cada grupo mantém sempre a mesma cor e forma: a cor segue o assunto, nunca a posição.
const GRUPOS: Record<
  Grupo,
  Pick<ParteEmpilhada, 'rotulo' | 'cor' | 'forma' | 'ajuda'> & { tipos: Entry['kind'][] }
> = {
  mercadoria: {
    rotulo: 'Mercadoria',
    cor: 3,
    forma: 'quadrado',
    ajuda: 'Vira estoque; só pesa quando vender.',
    tipos: ['trade'],
  },
  frete: { rotulo: 'Frete', cor: 2, forma: 'losango', tipos: ['freight'] },
  equipe: { rotulo: 'Equipe', cor: 4, forma: 'triangulo', tipos: ['payroll', 'education'] },
  energia: { rotulo: 'Energia e água', cor: 1, forma: 'cruz', tipos: ['energy', 'water'] },
  operacao: {
    rotulo: 'Manutenção e outros',
    cor: 5,
    forma: 'octogono',
    tipos: [
      'maintenance',
      'operation',
      'budget',
      'property',
      'vehicle',
      'finance',
      'loan',
      'repayment',
    ],
  },
};
const grupoDe = (kind: Entry['kind']): Grupo =>
  (Object.keys(GRUPOS) as Grupo[]).find((g) => GRUPOS[g].tipos.includes(kind)) ?? 'operacao';

const dia2 = (n: number) => String(n).padStart(2, '0');

/** Uma passada pelo histórico: entradas e saídas por dia de jogo e saídas por assunto. */
function resumoDaUnidade(world: World, e: Establishment, dias: number) {
  const fim = comecoDoDia(world) + GAME_DAY;
  // Não conta dias antes de o mundo existir.
  const n = Math.max(1, Math.min(dias, Math.ceil((fim - world.economyStartedAt) / GAME_DAY)));
  const inicio = fim - n * GAME_DAY;
  const entrou = new Array<number>(n).fill(0);
  const saiu = new Array<number>(n).fill(0);
  const porGrupo: Record<Grupo, number> = {
    mercadoria: 0,
    frete: 0,
    equipe: 0,
    energia: 0,
    operacao: 0,
  };
  const balde = (at: number) => Math.min(n - 1, Math.floor((at - inicio) / GAME_DAY));
  for (const l of world.ledger) {
    if (l.at < inicio || l.establishmentId !== e.id) continue;
    if (l.to === e.companyId && l.kind === 'retail') entrou[balde(l.at)] += l.amount;
    else if (l.from === e.companyId && l.to !== e.companyId) {
      saiu[balde(l.at)] += l.amount;
      porGrupo[grupoDe(l.kind)] += l.amount;
    }
  }
  // Venda para outras empresas: o dinheiro entra no caixa do vendedor quando a carga sai.
  for (const s of world.shipments)
    if (s.originId === e.id && s.buyerId !== e.companyId && s.departedAt >= inicio)
      entrou[balde(s.departedAt)] += s.cost;
  const dataDoDia = (i: number) => gameCalendar(world, inicio + i * GAME_DAY + GAME_DAY / 2);
  return { n, entrou, saiu, porGrupo, dataDoDia };
}

function Cabecalho({ titulo, texto }: { titulo: string; texto?: string }) {
  return (
    <header className="fin-cab">
      <h3>{titulo}</h3>
      {texto && <p>{texto}</p>}
    </header>
  );
}

export function BusinessFinance({ establishment: e }: { establishment: Establishment }) {
  const { world } = useGame();
  const [dias, setDias] = useState(7);
  const r = useMemo(
    () => resumoDaUnidade(world, e, dias),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, e.id, dias],
  );
  const entrou = r.entrou.reduce((n, v) => n + v, 0);
  const saiu = r.saiu.reduce((n, v) => n + v, 0);
  const sobra = entrou - saiu;
  const semEstoque = sobra + r.porGrupo.mercadoria;
  const hoje = r.entrou[r.n - 1];
  const rotulos = r.entrou.map((_, i) =>
    i === r.n - 1
      ? 'hoje'
      : r.n <= 7
        ? r.dataDoDia(i).label.slice(0, 3).toLocaleLowerCase('pt-BR')
        : `${dia2(r.dataDoDia(i).date.getUTCDate())}/${dia2(r.dataDoDia(i).date.getUTCMonth() + 1)}`,
  );
  const partes: ParteEmpilhada[] = (Object.keys(GRUPOS) as Grupo[]).map((g) => ({
    id: g,
    rotulo: GRUPOS[g].rotulo,
    valor: r.porGrupo[g],
    cor: GRUPOS[g].cor,
    forma: GRUPOS[g].forma,
    ajuda: r.porGrupo[g] > 0 ? GRUPOS[g].ajuda : undefined,
  }));
  const estoque = Object.entries(e.inventory).reduce(
    (n, [id, q]) => n + q! * (e.unitCosts[id as ProductId] ?? 0),
    0,
  );
  return (
    <div className="fin">
      <div className="fin-topo">
        <Cabecalho
          titulo="O dinheiro desta unidade"
          texto="Entrada é venda; saída é tudo o que saiu do caixa para esta unidade."
        />
        <div className="fin-periodo" role="group" aria-label="Período">
          {[7, 30].map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={dias === d}
              className={dias === d ? 'on' : ''}
              onClick={() => setDias(d)}
            >
              {d} dias
            </button>
          ))}
        </div>
      </div>

      <section className="fin-numeros" aria-label="Resumo do período">
        <div className="fin-num tom-lavoura">
          <span>Entrou</span>
          <b>{cr(entrou, 0)}</b>
          <small>em vendas</small>
        </div>
        <div className="fin-num tom-ouro">
          <span>Saiu</span>
          <b>{cr(saiu, 0)}</b>
          <small>
            {r.porGrupo.mercadoria > 0
              ? `${cr(r.porGrupo.mercadoria, 0)} virou estoque`
              : 'em custos e compras'}
          </small>
        </div>
        <div
          className={`fin-num ${sobra >= 0 ? 'tom-lavoura' : semEstoque >= 0 ? 'tom-ouro' : 'tom-brasa'}`}
        >
          <span>{sobra >= 0 ? 'Sobrou' : 'Caixa caiu'}</span>
          <b>
            {sobra >= 0 ? '+' : '−'}
            {cr(Math.abs(sobra), 0)}
          </b>
          <small>
            {r.porGrupo.mercadoria > 0
              ? `sem o estoque: ${semEstoque >= 0 ? '+' : '−'}${cr(Math.abs(semEstoque), 0)}`
              : 'no caixa do período'}
          </small>
        </div>
      </section>

      {e.dailyCost > 0 && (
        <section className="fin-meta" aria-label="Meta do dia">
          <BarrasPixel
            titulo="Vendas de hoje contra o custo fixo do dia"
            itens={[
              {
                rotulo: 'Hoje cobriu',
                valor: hoje,
                tom: hoje >= e.dailyCost ? 'lavoura' : 'ouro',
                nota: `de ${cr(e.dailyCost, 0)} de custo fixo`,
              },
            ]}
            maximo={Math.max(e.dailyCost, hoje)}
            formato={(v) => cr(v, 0)}
          />
        </section>
      )}

      <section className="fin-bloco">
        <Cabecalho
          titulo="Entrou e saiu por dia"
          texto={`Últimos ${r.n} dias de jogo. Passe o mouse ou use as setas para ler um dia.`}
        />
        <GraficoPixel
          titulo={`Entradas e saídas por dia nos últimos ${r.n} dias de jogo`}
          tipo="barras"
          altura={280}
          rotulos={rotulos}
          destaque={r.n - 1}
          series={[
            { nome: 'Entrou', valores: r.entrou, cor: 1 },
            { nome: 'Saiu', valores: r.saiu, cor: 3 },
          ]}
          formato={(v) => cr(v)}
          formatoEixo={(v) => cr(v, 0)}
        />
      </section>

      <section className="fin-bloco">
        <Cabecalho
          titulo="Para onde foi o dinheiro"
          texto="Tudo o que saiu, separado por assunto."
        />
        <BarraEmpilhada
          titulo="Saídas do período por assunto"
          partes={partes}
          formato={(v) => cr(v, 0)}
        />
      </section>

      <section className="fin-bloco">
        <Cabecalho titulo="Resultado e capital" />
        <div className="fin-tiles">
          <div className="fin-tile">
            <span>Resultado desde o início</span>
            <b className={e.revenue - e.expenses >= 0 ? 'positive' : 'negative'}>
              {e.revenue - e.expenses >= 0 ? '+' : '−'}
              {cr(Math.abs(e.revenue - e.expenses), 0)}
            </b>
          </div>
          <div className="fin-tile">
            <span>Receita acumulada</span>
            <b>{cr(e.revenue, 0)}</b>
          </div>
          <div className="fin-tile">
            <span>Custos acumulados</span>
            <b>{cr(e.expenses, 0)}</b>
          </div>
          <div className="fin-tile">
            <span>Dinheiro parado em estoque</span>
            <b>{cr(estoque, 0)}</b>
          </div>
        </div>
        <p className="fin-nota">
          Custos incluem o custo das mercadorias vendidas e as despesas de operação. O gráfico de
          cima mostra pagamentos, que podem cair em outro dia.
        </p>
      </section>
    </div>
  );
}

/** Quem compra desta loja: o que as famílias procuram e o que a loja vendeu. */
export function Consumption({ establishment: e }: { establishment: Establishment }) {
  const { world } = useGame();
  const itens = Object.keys(e.inventory) as ProductId[];
  const [escolhido, setEscolhido] = useState<ProductId | undefined>(itens[0]);
  const product = escolhido && itens.includes(escolhido) ? escolhido : itens[0];
  const calendario = gameCalendar(world, world.nextEconomicAt - 60_000);
  if (!product)
    return (
      <div className="fin">
        <Empty
          title="Nada na prateleira ainda"
          description="Quando a loja tiver produtos, aqui aparece o que as famílias procuram e o que você vendeu."
        />
      </div>
    );
  const rodadas = world.consumptionHistory
    .filter((s) => s.establishmentId === e.id && s.product === product)
    .slice(-84);
  const vendido = rodadas.reduce((n, s) => n + s.sold, 0);
  const procurado = rodadas.reduce((n, s) => n + s.desired, 0);
  const p = world.properties.find((x) => x.id === e.propertyId)!;
  const regiao = regionFor(world, p.coordinates, p.city);
  const lojas = Math.max(
    1,
    world.establishments.filter(
      (x) =>
        x.enabled &&
        x.category === 'retail' &&
        world.properties.find((q) => q.id === x.propertyId)!.city === p.city,
    ).length,
  );
  const procuraPorLoja = (householdDemand(world, regiao.id, product) * calendario.factor) / lojas;
  const porDia = rodadas.length ? (vendido / rodadas.length) * 12 : null;
  const fator = world.season.config.operations.weekday;
  const melhor = fator.indexOf(Math.max(...fator));
  const pior = fator.indexOf(Math.min(...fator));
  const pct = (f: number) => `${f >= 1 ? '+' : '−'}${Math.round(Math.abs(f - 1) * 100)}%`;
  const rotulosRodada = rodadas.map((s) => {
    const d = gameCalendar(world, s.at).date;
    return `${dia2(d.getUTCDate())}/${dia2(d.getUTCMonth() + 1)} ${dia2(d.getUTCHours())}h`;
  });
  const estoque = e.inventory[product] ?? 0;
  const conselho =
    estoque === 0
      ? 'Reponha este produto: a procura das famílias não vira venda sem estoque.'
      : procurado > vendido
        ? 'Faltou atender parte da procura. Confira o estoque e a equipe antes de comprar mais.'
        : inventoryQuality(e, product) < 65
          ? 'Compare a qualidade dos fornecedores: material melhor atrai mais famílias.'
          : 'Compare o preço de venda com o custo e acompanhe a margem antes de crescer.';
  return (
    <div className="fin">
      <Cabecalho
        titulo="Quem compra de você"
        texto="Escolha um produto para ver o que as famílias procuraram e o que você vendeu."
      />
      <div className="fin-produtos" role="group" aria-label="Produto">
        {itens.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={id === product}
            className={id === product ? 'on' : ''}
            onClick={() => setEscolhido(id)}
          >
            <ProductIcon product={id} size={16} />
            {products[id].name}
          </button>
        ))}
      </div>

      <section className="fin-tiles" aria-label={`Números de ${products[product].name}`}>
        <div className="fin-tile">
          <span>Você vende por dia</span>
          <b>{porDia === null ? '—' : `${num(porDia, 1)} un`}</b>
          <small>
            {porDia === null ? 'Aguardando as primeiras vendas' : 'média das últimas rodadas'}
          </small>
        </div>
        <div className="fin-tile">
          <span>Procura da cidade por loja</span>
          <b>{num(procuraPorLoja, 1)} un/dia</b>
          <small>estimativa, dividida entre as lojas</small>
        </div>
        <div className={`fin-tile ${procurado > vendido ? 'alerta' : ''}`}>
          <span>Procura que ficou sem atender</span>
          <b>{num(Math.max(0, procurado - vendido))} un</b>
          <small>nas últimas rodadas</small>
        </div>
        <div className="fin-tile">
          <span>Qualidade do estoque</span>
          <b>{num(inventoryQuality(e, product))}/100</b>
          <small>qualidade e preço atraem as famílias</small>
        </div>
      </section>

      <section className="fin-bloco">
        <Cabecalho
          titulo="Procurado e vendido"
          texto="Cada ponto é uma rodada de 2 horas de jogo."
        />
        {rodadas.length ? (
          <GraficoPixel
            titulo={`Procura das famílias e unidades vendidas de ${products[product].name} por rodada`}
            altura={240}
            rotulos={rotulosRodada}
            series={[
              { nome: 'Famílias queriam', valores: rodadas.map((s) => s.desired), cor: 3 },
              { nome: 'Você vendeu', valores: rodadas.map((s) => s.sold), cor: 1 },
            ]}
            formato={(v) => `${num(v, 1)} un`}
            formatoEixo={(v) => num(v, 1)}
          />
        ) : (
          <Empty
            title="O histórico começa na próxima rodada"
            description="A simulação registra a procura e as vendas a cada rodada. Nada é inventado."
          />
        )}
      </section>

      <section className="fin-bloco">
        <Cabecalho
          titulo="Quais dias vendem mais"
          texto={`${weekdayNames[melhor]} é o dia mais forte (${pct(fator[melhor])}) e ${weekdayNames[pior].toLocaleLowerCase('pt-BR')} o mais fraco (${pct(fator[pior])}). Hoje é ${weekdayNames[calendario.weekday].toLocaleLowerCase('pt-BR')}: ${num(calendario.factor * 100)}% da média.`}
        />
        <GraficoPixel
          titulo="Força de cada dia da semana, em porcentagem da média"
          tipo="barras"
          altura={200}
          rotulos={weekdayNames.map((d) => d.slice(0, 3).toLocaleLowerCase('pt-BR'))}
          destaque={calendario.weekday}
          series={[{ nome: 'Procura', valores: fator.map((f) => f * 100) }]}
          formato={(v) => `${num(v)}% da média`}
          formatoEixo={(v) => `${num(v)}%`}
        />
      </section>

      <p className="fin-conselho">
        <Lightbulb size={18} aria-hidden="true" />
        <span>
          <b>Próxima decisão</b> {conselho}
        </span>
      </p>
    </div>
  );
}
