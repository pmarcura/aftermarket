import { useGame, type Page } from '../lib/game';

/** Páginas que moram dentro de outra aba: a aba da mãe fica acesa. */
const dentroDe: Partial<Record<Page, Page>> = { logistics: 'orders', opportunities: 'quotes' };

const secoes = {
  comercio: {
    nome: 'Comércio',
    abas: [
      ['market', 'Comprar'],
      ['quotes', 'Cotações'],
      ['orders', 'Pedidos'],
      ['contracts', 'Contratos'],
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
  const ativa = dentroDe[page] ?? page;
  return (
    <nav className="secao-abas" aria-label={s.nome}>
      <span className="secao-nome">{s.nome}</span>
      {s.abas.map(([id, rotulo]) => (
        <button
          key={id}
          className={ativa === id ? 'on' : ''}
          aria-current={ativa === id ? 'page' : undefined}
          onClick={() => navigate(id)}
        >
          {rotulo}
        </button>
      ))}
    </nav>
  );
}
