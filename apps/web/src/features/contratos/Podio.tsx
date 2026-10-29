import { IconePixel } from '../../components/IconePixel';
import { num } from '../../lib/game';
import type { InfrastructureBid } from '../../../../../packages/simulation/src/model';
import '../../design/contratos.css';

/**
 * Pódio das propostas de um contrato: as três melhores notas em colunas lisas, a do jogador em
 * verde e o troféu em cima de quem leva (ou está levando). Sem propostas, o pódio vazio convida a
 * entrar na disputa.
 */
export function Podio({
  propostas,
  nomeDe,
  eu,
}: {
  propostas: InfrastructureBid[];
  nomeDe: (supplierId: string) => string;
  eu: string;
}) {
  const ordem = [...propostas].sort((a, b) => b.score - a.score);
  const top = ordem.slice(0, 3);
  // Disposição de pódio: 2º à esquerda, 1º no meio, 3º à direita.
  const colunas = [top[1], top[0], top[2]];
  const posicoes = [2, 1, 3];
  const meu = ordem.findIndex((b) => b.supplierId === eu);
  return (
    <figure
      className="ctr-podio"
      aria-label={
        ordem.length
          ? `Pódio: ${top.map((b, i) => `${i + 1}º ${nomeDe(b.supplierId)}, nota ${num(b.score, 1)}`).join('; ')}`
          : 'Ainda sem propostas'
      }
    >
      <div className="ctr-podio-colunas">
        {colunas.map((b, i) => {
          const pos = posicoes[i];
          const minha = b?.supplierId === eu;
          const altura = b ? Math.max(28, Math.round((b.score / 100) * 110)) : 28;
          return (
            <div
              key={pos}
              className={`ctr-coluna pos-${pos} ${minha ? 'eu' : ''} ${b ? '' : 'vazia'}`}
            >
              <span className="ctr-nota">{b ? num(b.score, 1) : ''}</span>
              <div className="ctr-barra" style={{ height: altura }}>
                {b && pos === 1 && <IconePixel nome="trofeu" tamanho={28} />}
                <b>{pos}º</b>
              </div>
              <span className="ctr-nome">{b ? (minha ? 'Você' : nomeDe(b.supplierId)) : '—'}</span>
            </div>
          );
        })}
      </div>
      {meu >= 3 && (
        <figcaption>
          Você está em {meu + 1}º, com nota {num(ordem[meu].score, 1)}.
        </figcaption>
      )}
    </figure>
  );
}
