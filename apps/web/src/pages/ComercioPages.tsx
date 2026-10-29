import { PageHeading } from '../components/ui';
import { SecaoAbas } from '../components/SecaoAbas';
import { Pedidos } from '../features/pedidos/Pedidos';
import { Contratos } from '../features/contratos/Contratos';
import '../economy.css';

export function PedidosPage() {
  return (
    <>
      <SecaoAbas secao="comercio" />
      <PageHeading
        title="Pedidos e negociações"
        description="Compras e vendas combinadas com outras empresas: o que espera resposta, o que está a caminho e o que já foi entregue."
      />
      <div className="page-body">
        <Pedidos />
      </div>
    </>
  );
}

export function ContratosPage() {
  return (
    <>
      <SecaoAbas secao="comercio" />
      <PageHeading
        title="Contratos públicos"
        description="Prefeituras compram mercadoria para obras e programas. Quem oferece o melhor conjunto de qualidade, preço, prazo e frete leva o contrato."
      />
      <div className="page-body">
        <Contratos />
      </div>
    </>
  );
}
