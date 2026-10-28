import { useGame, type Page } from '../lib/game';

const secoes = {
  comercio: {
    nome: 'Comércio',
    abas: [
      ['market', 'Comprar'],
      ['quotes', 'Cotações'],
      ['orders', 'Pedidos'],
      ['contracts', 'Contratos'],
      ['logistics', 'Entregas'],
      ['opportunities', 'Oportunidades'],
    ],
  },
  negocios: {
    nome: 'Meus Negócios',
    abas: [
      ['businesses', 'Unidades'],
      ['carrier', 'Frota'],
    ],
  },
} as const satisfies Record<string, { nome: string; abas: readonly (readonly [Page, string])[] }>;

/** Abas de uma seção do menu: mostram onde a página está e levam às irmãs. */
export function SecaoAbas({ secao }: { secao: keyof typeof secoes }) {
  const { page, navigate } = useGame();
  const s = secoes[secao];
  return (
    <nav className="secao-abas" aria-label={s.nome}>
      <span className="secao-nome">{s.nome}</span>
      {s.abas.map(([id, rotulo]) => (
        <button
          key={id}
          className={page === id ? 'on' : ''}
          aria-current={page === id ? 'page' : undefined}
          onClick={() => navigate(id)}
        >
          {rotulo}
        </button>
      ))}
    </nav>
  );
}
