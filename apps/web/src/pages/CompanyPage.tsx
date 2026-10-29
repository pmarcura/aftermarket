import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useGame, cr, num } from '../lib/game';
import { PageHeading, Rows } from '../components/ui';
import { IconePixel, type NomeIcone } from '../components/IconePixel';
import { GraficoPixel } from '../components/GraficoPixel';
import { BarraEmpilhada, type ParteEmpilhada } from '../components/BarrasPixel';
import { Recovery } from '../features/business/Recovery';
import { Transacoes, momentoDoJogo } from '../features/empresa/Transacoes';
import { GRUPOS, porteDe, resumoDaEmpresa, type GrupoSaida } from '../features/empresa/resumo';
import { operatingCosts } from '../../../../packages/simulation/src/metrics';
import { arrears, freeCash, outstandingLoans } from '../../../../packages/simulation/src/design';
import type { ProductId } from '../../../../packages/simulation/src/model';
import '../design/empresa.css';

const PERIODOS = [7, 30] as const;

export function CompanyPage() {
  const { world, actor, notice } = useGame();
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(7);
  const company = world.companies.find((c) => c.id === actor)!,
    units = world.establishments.filter((e) => e.companyId === actor),
    fleet = world.vehicles.filter((v) => v.companyId === actor);

  // Patrimônio: o que a empresa tem menos o que deve (mesmas contas de antes).
  const propertyAssets = world.properties
    .filter((p) => p.ownerId === actor)
    .reduce((n, p) => n + p.price, 0);
  const inventory = units.reduce(
    (n, e) =>
      n +
      Object.entries(e.inventory).reduce(
        (sum, [id, q]) => sum + (e.unitCosts[id as ProductId] ?? 0) * q!,
        0,
      ),
    0,
  );
  const wip = world.jobs
    .filter((j) => !j.completed && units.some((e) => e.id === j.establishmentId))
    .reduce((n, j) => n + j.cost, 0);
  const inTransit = world.shipments
    .filter((s) => s.buyerId === actor && !s.delivered)
    .reduce((n, s) => n + s.cost + s.freight, 0);
  const vehicles = fleet.reduce((n, v) => n + (v.purchasePrice ?? 28000000), 0);
  const equipment = units.reduce((n, e) => n + (e.installationValue ?? 0), 0);
  const assets = company.balance + propertyAssets + inventory + wip + inTransit + vehicles;
  const liabilities = arrears(world, actor) + outstandingLoans(world, actor);
  const netWorth = assets + equipment - liabilities;
  const porte = porteDe(netWorth);
  const totalBens = Math.max(assets + equipment, 1);

  const revenue = units.reduce((n, e) => n + e.revenue, 0);
  const expenses = units.reduce((n, e) => n + e.expenses, 0) + (company.financingExpense ?? 0);
  const forecast = units.reduce((n, e) => n + operatingCosts(world, e).total, 0);

  const resumo = useMemo(
    () => resumoDaEmpresa(world, actor, dias),
    // O mundo muda por revisão; o resto são as escolhas do jogador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, actor, dias],
  );
  const sobrou = resumo.entrou - resumo.saiu;
  const semInvestir = sobrou + resumo.porGrupo.mercadoria + resumo.porGrupo.imoveis;
  const partes: ParteEmpilhada[] = (Object.keys(GRUPOS) as GrupoSaida[]).map((g) => ({
    id: g,
    valor: resumo.porGrupo[g],
    ...GRUPOS[g],
  }));
  const rotulo = (at: number) => {
    const m = momentoDoJogo(world, at);
    return `Dia ${m.dia}, ${String(m.hora).padStart(2, '0')}h`;
  };

  const bens: { id: string; nome: string; icone: NomeIcone; valor: number; matiz: number }[] = [
    { id: 'caixa', nome: 'Dinheiro em caixa', icone: 'moeda', valor: company.balance, matiz: 46 },
    {
      id: 'imoveis',
      nome: 'Imóveis e equipamentos',
      icone: 'predio',
      valor: propertyAssets + equipment,
      matiz: 212,
    },
    { id: 'frota', nome: 'Caminhões', icone: 'caminhao', valor: vehicles, matiz: 190 },
    {
      id: 'estoque',
      nome: 'Estoques e produção',
      icone: 'caixa',
      valor: inventory + wip + inTransit,
      matiz: 112,
    },
  ];

  const baixarExtrato = () => {
    const linhas = world.ledger.filter((e) => e.from === actor || e.to === actor);
    const csv =
      '﻿Dia do jogo;Hora do jogo;Descrição;Tipo;Entrada (R$);Saída (R$)\r\n' +
      linhas
        .map((e) => {
          const m = momentoDoJogo(world, e.at);
          return [
            m.dia,
            m.hora,
            `"${e.description.replaceAll('"', '""')}"`,
            e.kind,
            e.to === actor ? (e.amount / 100).toFixed(2) : '',
            e.from === actor ? (e.amount / 100).toFixed(2) : '',
          ].join(';');
        })
        .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aftermarket-extrato.csv';
    a.click();
    URL.revokeObjectURL(url);
    notice('Extrato baixado.');
  };

  return (
    <>
      <PageHeading
        title="Minha empresa"
        description="Quanto vale, de onde vem o dinheiro e para onde ele vai."
      />
      <div className="page-body emp-pagina">
        <section className="emp-hero" aria-labelledby="emp-nome">
          <div className="emp-hero-id">
            <IconePixel nome="predio" tamanho={64} />
            <div>
              <h2 id="emp-nome">{company.name}</h2>
              <span className="emp-porte">Empresa {porte.atual.nome.toLocaleLowerCase('pt-BR')}</span>
            </div>
          </div>
          <div className="emp-hero-valor">
            <span>Patrimônio</span>
            <b className={netWorth < 0 ? 'ruim' : ''}>{cr(netWorth, 0)}</b>
            <small>tudo o que a empresa tem, menos o que deve</small>
          </div>
          <div className="emp-hero-porte">
            <div
              className="emp-meter"
              role="img"
              aria-label={
                porte.proximo
                  ? `${Math.round(porte.avanco * 100)}% do caminho para empresa ${porte.proximo.nome.toLocaleLowerCase('pt-BR')}`
                  : 'Porte máximo'
              }
            >
              <i style={{ width: `${porte.avanco * 100}%` }} />
            </div>
            <small>
              {porte.proximo
                ? `Faltam ${cr(porte.falta, 0)} para virar empresa ${porte.proximo.nome.toLocaleLowerCase('pt-BR')}.`
                : 'Você chegou ao maior porte.'}
            </small>
          </div>
          <dl className="emp-hero-fatos">
            <div>
              <dt>Caixa livre</dt>
              <dd>{cr(freeCash(world, actor), 0)}</dd>
            </div>
            <div>
              <dt>Custos fixos por dia</dt>
              <dd>{cr(forecast, 0)}</dd>
            </div>
            <div>
              <dt>Negócios</dt>
              <dd>{num(units.length)}</dd>
            </div>
            <div>
              <dt>Funcionários</dt>
              <dd>{num(units.reduce((n, e) => n + e.employees, 0))}</dd>
            </div>
          </dl>
        </section>

        <section className="emp-bloco" aria-labelledby="emp-fluxo">
          <header className="emp-bloco-cab">
            <h2 id="emp-fluxo">O dinheiro dos últimos dias</h2>
            <div className="emp-chips" role="group" aria-label="Período">
              {PERIODOS.filter((p) => p <= (world.view?.ledgerDays ?? 30)).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={dias === p}
                  className={dias === p ? 'on' : ''}
                  onClick={() => setDias(p)}
                >
                  {p} dias
                </button>
              ))}
            </div>
          </header>
          <p className="emp-vazio">
            Movimentações disponíveis dos últimos {resumo.dias} dias de jogo, até agora.
            {world.view && ' O servidor envia um extrato recente limitado; os totais podem ser parciais.'}
          </p>
          <div className="emp-tres">
            <div className="entrou">
              <IconePixel nome="moeda" tamanho={32} />
              <span>Entrou</span>
              <b>{cr(resumo.entrou, 0)}</b>
              <small>em vendas e recebimentos</small>
            </div>
            <div className="saiu">
              <IconePixel nome="caixa" tamanho={32} />
              <span>Saiu</span>
              <b>{cr(resumo.saiu, 0)}</b>
              <small>
                {resumo.porGrupo.mercadoria + resumo.porGrupo.imoveis > 0
                  ? `${cr(resumo.porGrupo.mercadoria + resumo.porGrupo.imoveis, 0)} viraram estoque e bens`
                  : 'em compras e custos'}
              </small>
            </div>
            <div className={sobrou >= 0 ? 'sobrou' : 'faltou'}>
              <IconePixel nome={sobrou >= 0 ? 'estrela' : 'alerta'} tamanho={32} />
              <span>{sobrou >= 0 ? 'Sobrou' : 'O caixa caiu'}</span>
              <b>
                {sobrou >= 0 ? '+' : '−'}
                {cr(Math.abs(sobrou), 0)}
              </b>
              <small>
                fluxo excluindo compras de estoque e bens: {semInvestir >= 0 ? '+' : '−'}
                {cr(Math.abs(semInvestir), 0)}
              </small>
            </div>
          </div>
          <GraficoPixel
            titulo="Variação do caixa nas movimentações disponíveis do período"
            altura={280}
            rotulos={resumo.caixa.map((p) => rotulo(p.at))}
            series={[{ nome: 'Variação do caixa', valores: resumo.caixa.map((p) => p.valor) }]}
            formato={(v) => cr(v)}
            formatoEixo={(v) => cr(v, 0)}
          />
        </section>

        <section className="emp-bloco" aria-labelledby="emp-saidas">
          <header className="emp-bloco-cab">
            <h2 id="emp-saidas">Para onde foi o dinheiro</h2>
          </header>
          <BarraEmpilhada
            titulo={`Saídas dos últimos ${resumo.dias} dias por assunto`}
            partes={partes}
            formato={(v) => cr(v, 0)}
          />
        </section>

        <section className="emp-bloco" aria-labelledby="emp-bens">
          <header className="emp-bloco-cab">
            <h2 id="emp-bens">O que a empresa tem</h2>
          </header>
          <ul className="emp-bens">
            {bens.map((b) => {
              const parte = Math.max(0, b.valor) / totalBens;
              return (
                <li key={b.id} className="item" style={{ ['--h' as string]: b.matiz }}>
                  <div className="emp-bem">
                    <IconePixel nome={b.icone} tamanho={48} />
                    <span>{b.nome}</span>
                    <b>{cr(b.valor, 0)}</b>
                    <div className="emp-meter peq" role="img" aria-label={`${Math.round(parte * 100)}% dos bens`}>
                      <i style={{ width: `${parte * 100}%` }} />
                    </div>
                    <small>{Math.round(parte * 100)}% dos bens</small>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <Recovery />

        <section className="emp-bloco" aria-labelledby="emp-trans">
          <header className="emp-bloco-cab">
            <h2 id="emp-trans">Últimas movimentações</h2>
            <button type="button" className="secondary" onClick={baixarExtrato}>
              <Download size={16} aria-hidden="true" /> Baixar extrato disponível
            </button>
          </header>
          <Transacoes />
        </section>

        <details className="emp-lab">
          <summary>
            <span>Balanço completo</span>
            <small>cada parte do patrimônio, em números</small>
          </summary>
          <div className="emp-lab-corpo">
            <Rows
              rows={[
                { label: 'Caixa', value: cr(company.balance) },
                { label: 'Imóveis e instalações', value: cr(propertyAssets) },
                { label: 'Equipamentos', value: cr(equipment) },
                { label: 'Caminhões', value: cr(vehicles) },
                { label: 'Estoque disponível', value: cr(inventory) },
                { label: 'Materiais em produção', value: cr(wip) },
                { label: 'Mercadoria a caminho', value: cr(inTransit) },
                { label: 'O que a empresa deve', value: cr(liabilities) },
                { label: 'Patrimônio', value: cr(netWorth) },
                { label: 'Vendas desde o início', value: cr(revenue) },
                { label: 'Custos desde o início', value: cr(expenses) },
              ]}
            />
            <p className="emp-nota">
              Estoques e materiais em produção usam o custo médio. Imóveis e caminhões valem o que
              foi pago por eles.
            </p>
          </div>
        </details>
      </div>
    </>
  );
}
