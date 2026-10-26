import { useGame, cr, num } from '../lib/game';
import { Badge, Modal, Rows, Progress } from './ui';
import {
  laborMarket,
  logisticsQuality,
  operatingCosts,
  utilityTariff,
} from '../../../../packages/simulation/src/metrics';
import type { Property } from '../../../../packages/simulation/src/model';

export function InfrastructureDetails({
  property,
  onClose,
}: {
  property: Property;
  onClose: () => void;
}) {
  const { world } = useGame(),
    labor = laborMarket(world, property),
    logistics = logisticsQuality(world, property),
    tariff = utilityTariff(world, property);
  const e = world.establishments.find((e) => e.propertyId === property.id),
    costs = e ? operatingCosts(world, e) : null;
  return (
    <Modal title={`Como calculamos · ${property.city}`} onClose={onClose} wide>
      <Badge tone="blue">Parâmetros internos · {world.season.name}</Badge>
      <p>
        Estes indicadores são calculados com o estado do jogo e a configuração congelada na abertura
        da temporada. Não consultam o mercado externo.
      </p>
      <div className="infrastructure-grid">
        <section>
          <h3>Capacidade de contratação</h3>
          <Rows
            rows={[
              { label: 'Mercado de referência', value: labor.region.name },
              { label: 'Base populacional do cenário', value: num(labor.population) },
              { label: 'Trabalhadores elegíveis no jogo', value: num(labor.pool) },
              { label: 'Empregos em operações próximas', value: num(labor.employed) },
              { label: 'Candidatos disponíveis', value: num(labor.available) },
              { label: 'Salário-base estimado / mês', value: cr(labor.monthlySalary) },
            ]}
          />
          <p className="formula-note">{labor.formula}</p>
          <p className="small muted">
            Qualificação da atividade: {num(labor.qualifiedShare * 100)}%. O cenário representa uma
            fração da população. Este cálculo não estima o desemprego real do município.
          </p>
        </section>
        <section>
          <h3>Índice logístico · {logistics.score}/100</h3>
          {[
            { label: 'Acesso rodoviário · peso 35%', value: logistics.access },
            { label: 'Capacidade livre próxima · peso 35%', value: logistics.fleet },
            { label: 'Fornecimento próximo · peso 30%', value: logistics.supplier },
          ].map((row) => (
            <div className="index-component" key={row.label}>
              <span>{row.label}</span>
              <Progress value={row.value} color="blue" />
              <strong>{num(row.value)}</strong>
            </div>
          ))}
          <Rows
            rows={[
              {
                label: 'Distância ao acesso rodoviário',
                value: `${num(property.roadDistance, 1)} km`,
              },
              { label: 'Veículos livres em até 150 km', value: logistics.nearbyVehicles },
              {
                label: 'Fornecedor mais próximo com estoque',
                value:
                  logistics.nearestSupplierKm === null
                    ? 'Nenhum'
                    : `${num(logistics.nearestSupplierKm, 1)} km estimados`,
              },
            ]}
          />
          <p className="formula-note">{logistics.formula}</p>
          <p className="small muted">
            Acesso rodoviário é um atributo virtual da propriedade. Disponibilidade de veículos e
            estoques muda durante o jogo.
          </p>
        </section>
      </div>
      <section className="utility-breakdown">
        <h3>Água e energia são pagas por consumo</h3>
        <Rows
          rows={[
            { label: 'Energia · tarifa interna', value: `${cr(tariff.electricity)} / kWh` },
            { label: 'Água + esgoto · tarifa interna', value: `${cr(tariff.water)} / m³` },
            { label: 'Cobrança de produção', value: 'Consumo da receita × tarifa' },
            { label: 'Instalação em operação', value: 'Consumo-base por funcionário + manutenção' },
          ]}
        />
        {costs && (
          <Rows
            rows={[
              { label: 'Folha diária + encargos do cenário', value: cr(costs.payroll) },
              {
                label: 'Energia da instalação / dia',
                value: `${num(costs.energyKwh, 1)} kWh · ${cr(costs.energy)}`,
              },
              {
                label: 'Água da instalação / dia',
                value: `${num(costs.waterM3, 2)} m³ · ${cr(costs.water)}`,
              },
              { label: 'Manutenção / dia', value: cr(costs.maintenance) },
              { label: 'Total fixo / dia do jogo', value: cr(costs.total) },
            ]}
          />
        )}
        <p className="small muted">
          Produção paga seu consumo adicional separadamente. Os valores são lançados em Empresa e
          Finanças. Não há atualização automática por tarifas externas.
        </p>
      </section>
    </Modal>
  );
}
