import { useEffect, useState } from 'react';
import './landing.css';

const planeta = '/arte/landing/planeta-brasil.png';

// Telas reais do jogo, fotografadas por `npm run landing:telas`. Textos sem números da versão de
// teste: só o que vale para o jogo em qualquer versão (princípios do GDD).
const cenas = [
  {
    id: 'mapa',
    passo: 'Localize',
    titulo: 'O Brasil de verdade, no mapa.',
    texto:
      'Cidades, estradas e rios reais. Cada negócio que alguém abre passa a existir para todo mundo.',
    alt: 'Mapa do jogo na região de Campinas, com empresas marcadas por tipo',
  },
  {
    id: 'comprar',
    passo: 'Compare',
    titulo: 'Antes de comprar, a conta pronta.',
    texto:
      'Mercadoria, frete e lucro na mesma tela. Você sabe se vale a pena antes de fechar negócio.',
    alt: 'Vitrine de compra com o lucro de cada mercadoria já com o frete',
  },
  {
    id: 'loja',
    passo: 'Opere',
    titulo: 'O preço é decisão sua.',
    texto:
      'Veja quanto vende e quanto lucra em cada faixa de preço. A concorrência está fazendo o mesmo.',
    alt: 'Página da loja com a régua de preço de cada produto',
  },
] as const;

const pilares = [
  {
    arte: 'lavoura',
    w: 91,
    h: 62,
    titulo: 'Nada surge do nada.',
    texto:
      'Toda mercadoria tem origem: uma lavoura, uma mina, uma fábrica. Sem insumo, não existe produção.',
  },
  {
    arte: 'caminhao',
    w: 83,
    h: 66,
    titulo: 'Distância custa dinheiro.',
    texto:
      'Cada carga precisa de caminhão, rota e prazo. Onde a sua empresa está muda o seu lucro.',
  },
  {
    arte: 'loja',
    w: 85,
    h: 62,
    titulo: 'Quem joga faz o preço.',
    texto:
      'Cobre caro e venda pouco, ou barato e venda muito. O mercado responde ao que todos decidem.',
  },
] as const;

const caminhos = [
  ['loja', 'Varejo', 'Conquiste as prateleiras de uma cidade.'],
  ['lavoura', 'Campo', 'Plante e venda para quem fabrica.'],
  ['fazenda-leite', 'Pecuária', 'Leite fresco para o comércio.'],
  ['soja-oleo', 'Agroindústria', 'Transforme a safra em produto.'],
  ['mina', 'Mineração', 'Extraia o que um dia acaba.'],
  ['siderurgica', 'Indústria', 'Matéria-prima entra, aço sai.'],
  ['silos', 'Armazém', 'Guarde quando sobra, venda quando falta.'],
  ['caminhao', 'Logística', 'Leve a carga de todo mundo.'],
] as const;

const principios = [
  ['Um só mapa', 'Todos os jogadores dividem a mesma economia.'],
  ['Mesmas regras', 'Jogadores e empresas automáticas seguem as mesmas regras.'],
  ['Recursos finitos', 'Minas se esgotam. Quem chega primeiro leva.'],
  ['Sem vitória única', 'Patrimônio, mercado, indústria ou logística: você escolhe.'],
] as const;

function useMovimentoReduzido() {
  const [reduzido, setReduzido] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  useEffect(() => {
    const consulta = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!consulta) return;
    const mudou = () => setReduzido(consulta.matches);
    consulta.addEventListener('change', mudou);
    return () => consulta.removeEventListener('change', mudou);
  }, []);
  return reduzido;
}

/** Céu fixo e determinístico; só algumas estrelas piscam. */
function Estrelas() {
  return (
    <svg
      className="landing-estrelas"
      viewBox="0 0 736 720"
      preserveAspectRatio="none"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      {Array.from({ length: 150 }, (_, i) => (
        <rect
          key={i}
          className={i % 5 === 0 ? 'landing-estrela-pisca' : undefined}
          style={{ animationDelay: `${(i % 9) * 0.7}s` }}
          x={(i * 211 + 37) % 736}
          y={(i * 97 + 11) % 720}
          width={i % 7 === 0 ? 3 : 2}
          height={i % 7 === 0 ? 3 : 2}
          fill={i % 4 === 0 ? '#d6f7a4' : '#f3e7cc'}
          opacity={0.2 + (i % 4) * 0.14}
        />
      ))}
    </svg>
  );
}

/** Mira do GPS sobre o Sudeste, nas coordenadas da imagem do planeta (200 × 200). */
function MiraGps() {
  return (
    <svg
      className="landing-mira"
      viewBox="0 0 200 200"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <g className="landing-mira-cruz">
        <rect x="-400" y="133.7" width="1000" height="0.6" />
        <rect x="119.7" y="-200" width="0.6" height="390" />
      </g>
      <path
        className="landing-mira-cantos"
        d="M98 112h8v1.4h-6.6v6.6H98zM142 112h-8v1.4h6.6v6.6h1.4zM98 156h8v-1.4h-6.6v-6.6H98zM142 156h-8v-1.4h6.6v-6.6h1.4z"
      />
      <rect className="landing-mira-onda" x="116" y="130" width="8" height="8" />
      <rect
        className="landing-mira-onda landing-mira-onda--2"
        x="116"
        y="130"
        width="8"
        height="8"
      />
      <rect className="landing-mira-ponto" x="118" y="132" width="4" height="4" />
    </svg>
  );
}

function Tela({ aparelho, ativa }: { aparelho: 'pc' | 'cel'; ativa: number }) {
  return (
    <div className="landing-tela">
      {cenas.map((c, i) => (
        <img
          key={c.id}
          className={i === ativa ? 'ativa' : undefined}
          src={`/arte/landing/tela-${c.id}-${aparelho}.jpg`}
          alt={i === ativa ? c.alt : ''}
          aria-hidden={i === ativa ? undefined : true}
          loading={i === 0 ? 'eager' : 'lazy'}
          draggable="false"
        />
      ))}
    </div>
  );
}

const TEMPO_CENA = 6500;

export function LandingPage() {
  const reduzido = useMovimentoReduzido();
  const [cena, setCena] = useState(0);
  const [volta, setVolta] = useState(0);

  useEffect(() => {
    document.title = 'AFTERMARKET · Aonde você quiser';
  }, []);
  useEffect(() => {
    if (reduzido) return;
    const t = window.setTimeout(() => setCena((c) => (c + 1) % cenas.length), TEMPO_CENA);
    return () => window.clearTimeout(t);
  }, [cena, volta, reduzido]);

  const escolher = (i: number) => {
    setCena(i);
    setVolta((v) => v + 1);
  };

  return (
    <div className="landing">
      <a href="#como-jogar" className="landing-skip">
        Pular para o conteúdo
      </a>
      <main>
        {/* O céu ocupa a tela inteira; a composição fica centralizada até 1600 px. */}
        <div className="landing-topo">
          <Estrelas />
          <section className="landing-artboard" aria-labelledby="landing-title">
            <div className="landing-ceu" aria-hidden="true">
              <div className="landing-orbita">
                <img
                  className="landing-earth"
                  src={planeta}
                  alt=""
                  fetchPriority="high"
                  draggable="false"
                />
                <MiraGps />
              </div>
              <svg className="landing-satelite" viewBox="0 0 13 7" shapeRendering="crispEdges">
                <path d="M0 2h4v3H0zM9 2h4v3H9z" fill="#5aaee6" />
                <path d="M4 3h1v1H4zM8 3h1v1H8zM5 1h3v5H5z" fill="#f3e7cc" />
              </svg>
              <span className="landing-mira-rotulo">
                DESTINO TRAVADO
                <br />
                SUDESTE · BRASIL
              </span>
              <svg
                className="landing-feixe"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d="M60 32.3 C 60 42, 56.5 44, 56.5 52.7" />
                <path className="landing-feixe-luz" d="M60 32.3 C 60 42, 56.5 44, 56.5 52.7" />
              </svg>
              <div className="landing-palco-luz" />
            </div>

            <header className="landing-header">
              <a href="#" className="landing-wordmark" aria-label="AFTERMARKET, início">
                <img src="/arte/marca-logo.png" alt="" width="52" height="30" />
                <span>AFTERMARKET</span>
              </a>
              <nav aria-label="Navegação da apresentação">
                <a href="#como-jogar">Como jogar</a>
                <a href="/jogar" aria-label="Entrar no jogo">
                  <span className="landing-longo">Entrar no jogo</span>
                  <span className="landing-curto">Jogar</span> <span aria-hidden="true">↗</span>
                </a>
              </nav>
            </header>

            <div className="landing-hud">
              <p className="landing-selo">
                <i aria-hidden="true" /> Em desenvolvimento
              </p>
              <h1 id="landing-title">
                <span>Aonde você</span>{' '}
                <span>
                  quiser.
                  <span className="landing-cursor" aria-hidden="true">
                    _
                  </span>
                </span>
              </h1>
              <p className="landing-hud-sub">
                Uma economia inteira funcionando ao mesmo tempo, no mapa do Brasil. Escolha a
                cidade, abra o seu negócio e dispute cada cliente com todos os outros jogadores.
              </p>
              <div className="landing-hud-acoes">
                <a className="landing-botao" href="/jogar">
                  Entrar no jogo <span aria-hidden="true">↗</span>
                </a>
                <a className="landing-botao landing-botao--linha" href="#como-jogar">
                  Ver o jogo
                </a>
              </div>
            </div>

            <div
              className="landing-device landing-tablet"
              role="group"
              aria-label="Tela do jogo no computador"
            >
              <Tela aparelho="pc" ativa={cena} />
            </div>
            <div
              className="landing-device landing-phone"
              role="group"
              aria-label="Tela do jogo no celular"
            >
              <Tela aparelho="cel" ativa={cena} />
            </div>
          </section>
        </div>

        <section className="landing-cenas" id="como-jogar" aria-labelledby="landing-cenas-titulo">
          <h2 id="landing-cenas-titulo" className="landing-sr-only">
            Como se joga
          </h2>
          <p className="landing-cenas-nota">Telas reais da versão em desenvolvimento</p>
          <div className="landing-cenas-lista" role="group" aria-label="Escolher a tela mostrada">
            {cenas.map((c, i) => (
              <button
                key={c.id}
                type="button"
                className={i === cena ? 'ativa' : undefined}
                aria-pressed={i === cena}
                onClick={() => escolher(i)}
              >
                <span className="landing-cenas-passo">
                  0{i + 1} · {c.passo}
                </span>
                <b>{c.titulo}</b>
                <span>{c.texto}</span>
                <i aria-hidden="true">
                  <span key={`${cena}-${volta}`} style={{ animationDuration: `${TEMPO_CENA}ms` }} />
                </i>
              </button>
            ))}
          </div>
        </section>

        <section className="landing-guide" aria-labelledby="landing-guide-title">
          <div className="landing-guide-intro">
            <h2 id="landing-guide-title">
              UM SÓ MUNDO.
              <br />
              TODO MUNDO
              <br />
              JOGANDO NELE.
            </h2>
            <div className="landing-guide-copy">
              <p>
                Não existe partida só sua. Você abre a sua empresa no mesmo mapa em que outras já
                compram, produzem e vendem. O que uma decide muda o preço para todas.
              </p>
              <p>
                E o mundo não para quando você sai: lojas continuam vendendo, cargas seguem na
                estrada e a concorrência continua se mexendo.
              </p>
            </div>
          </div>
          <ol className="landing-steps" aria-label="O que move a economia">
            {pilares.map((p, i) => (
              <li key={p.arte}>
                <div className="landing-steps-arte">
                  <img src={`/arte/${p.arte}.png`} alt="" width={p.w * 2} height={p.h * 2} />
                </div>
                <span aria-hidden="true">0{i + 1}</span>
                <h3>{p.titulo}</h3>
                <p>{p.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-mapa" aria-labelledby="landing-mapa-titulo">
          <div className="landing-mapa-topo">
            <h2 id="landing-mapa-titulo">
              MUITOS CAMINHOS
              <br />
              PARA CRESCER
            </h2>
            <p>
              Não há uma única forma de vencer. Comece pequeno, encontre o seu espaço e cresça na
              direção que fizer sentido para a sua empresa.
            </p>
          </div>
          <ul className="landing-negocios">
            {caminhos.map(([arte, nome, texto]) => (
              <li key={arte}>
                <img src={`/arte/${arte}.png`} alt="" />
                <b>{nome}</b>
                <span>{texto}</span>
              </li>
            ))}
          </ul>
          <dl className="landing-principios">
            {principios.map(([titulo, texto]) => (
              <div key={titulo}>
                <dt>{titulo}</dt>
                <dd>{texto}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="landing-autor" aria-labelledby="landing-autor-titulo">
          <div className="landing-autor-texto">
            <p className="landing-selo landing-selo--escuro">
              <i aria-hidden="true" /> Em desenvolvimento
            </p>
            <h2 id="landing-autor-titulo">UM PROJETO EM CONSTRUÇÃO.</h2>
            <p>
              O AFTERMARKET está sendo feito agora. As primeiras partidas acontecem em sessões de
              teste com convidados, e cada rodada muda o jogo. O que você vê nesta página é a versão
              de hoje.
            </p>
            <a className="landing-enter" href="/jogar">
              Entrar no jogo <span aria-hidden="true">↗</span>
            </a>
          </div>
          <figure className="landing-assinatura">
            <img src="/arte/marca-logo.png" alt="" width="104" height="60" />
            <figcaption>
              <span>Um jogo de</span>
              <b>Pedro Marçura</b>
              <span>Criação e design</span>
            </figcaption>
            <svg viewBox="0 0 120 12" aria-hidden="true" shapeRendering="crispEdges">
              <path d="M0 8h10V6h12v2h14V4h10v4h18V6h16v2h12V5h10v3h18v2H0z" />
            </svg>
          </figure>
        </section>

        <section
          className="landing-guide landing-perguntas"
          aria-labelledby="landing-perguntas-titulo"
        >
          <div className="landing-questions">
            <h2 id="landing-perguntas-titulo">
              ANTES DE
              <br />
              COMEÇAR<span aria-hidden="true">_</span>
            </h2>
            <div>
              <details>
                <summary>
                  Que tipo de jogo é o AFTERMARKET?<span aria-hidden="true">+</span>
                </summary>
                <p>
                  Um simulador de negócios no mapa do Brasil. Você compra, produz, transporta e
                  vende em um mercado dividido com outras empresas. O resultado depende dos seus
                  custos, dos seus preços e de onde você decide estar.
                </p>
              </details>
              <details>
                <summary>
                  Já posso jogar?<span aria-hidden="true">+</span>
                </summary>
                <p>
                  Ainda não há acesso aberto. O jogo está em testes fechados com convidados; o
                  acesso público vem depois dessa fase.
                </p>
              </details>
              <details>
                <summary>
                  Preciso ficar conectado o tempo todo?<span aria-hidden="true">+</span>
                </summary>
                <p>
                  Não. O mundo segue enquanto você está fora: a loja vende, a carga chega e os
                  concorrentes reagem. Você volta, olha os números e decide o próximo passo.
                </p>
              </details>
              <details>
                <summary>
                  O dinheiro do jogo é real?<span aria-hidden="true">+</span>
                </summary>
                <p>
                  Não. Dinheiro, preços e resultados fazem parte da simulação. O mapa usa lugares
                  reais; a economia é uma experiência de jogo.
                </p>
              </details>
            </div>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <a href="#" aria-label="AFTERMARKET, voltar ao início">
          AFTERMARKET//
        </a>
        <span>© 2026 Pedro Marçura · Projeto em desenvolvimento</span>
        <a href="/jogar">
          Vamos jogar <span aria-hidden="true">↗</span>
        </a>
        <small>Mapa das telas: © colaboradores do OpenStreetMap, OpenMapTiles e OpenFreeMap.</small>
      </footer>
    </div>
  );
}
