/**
 * Vitrine dos modelos 3D (ferramenta de design, em /modelos): cada tipo de negócio em cada
 * estágio, girando devagar, para o Pedro avaliar forma, cor e crescimento antes de irem ao mapa.
 * Um único canvas desenha todas as células (scissor), porque o navegador limita contextos WebGL.
 */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { categoryInfo, type Category } from '../../../../../packages/simulation/src/model';
import { bandeira, construirModelo, luzes, type Estagio } from './modelos3d';
import './modelos.css';

const categorias: Category[] = ['retail', 'industry', 'farm', 'mine', 'warehouse', 'logistics'];
const estagios: Estagio[] = ['obra', 1, 2, 3, 4];
const nomeDoEstagio = (e: Estagio) => (e === 'obra' ? 'Em obra' : `Nível ${e}`);

interface Celula {
  el: HTMLDivElement;
  cena: THREE.Scene;
  camera: THREE.OrthographicCamera;
  modelo: THREE.Group;
  angulo: number;
  raio: number;
  centro: THREE.Vector3;
}

export function ModelosPage() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pagina = useRef<HTMLDivElement>(null);
  const grade = useRef<HTMLDivElement>(null);
  // Célula ampliada (duplo clique): "categoria:estágio".
  const [foco, setFoco] = useState<string | null>(null);
  const [girando, setGirando] = useState(true);
  const [proprio, setProprio] = useState(false);
  const girandoRef = useRef(girando);
  girandoRef.current = girando;

  useEffect(() => {
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas.current!,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setScissorTest(true);
    const celulas: Celula[] = [];
    const seletor = foco ? '.modelos-foco[data-celula]' : '.modelos-celula[data-celula]';
    for (const el of pagina.current!.querySelectorAll<HTMLDivElement>(seletor)) {
      const [categoria, estagioTxt] = el.dataset.celula!.split(':');
      const estagio = (estagioTxt === 'obra' ? 'obra' : Number(estagioTxt)) as Estagio;
      const cena = new THREE.Scene();
      for (const luz of luzes()) cena.add(luz);
      const modelo = construirModelo(categoria as Category, estagio);
      if (proprio) {
        const b = bandeira('#a6e05a');
        const caixa = new THREE.Box3().setFromObject(modelo);
        b.position.set(caixa.min.x + 1, 0, caixa.max.z - 1);
        modelo.add(b);
      }
      cena.add(modelo);
      const esfera = new THREE.Box3().setFromObject(modelo).getBoundingSphere(new THREE.Sphere());
      const raio = esfera.radius;
      const camera = new THREE.OrthographicCamera(-raio, raio, raio, -raio, 0.1, raio * 8);
      celulas.push({ el, cena, camera, modelo, angulo: -0.6, raio, centro: esfera.center });
    }
    // Arrastar gira o modelo da célula.
    let arrastando: Celula | null = null;
    let ultimoX = 0;
    const descer = (ev: PointerEvent) => {
      arrastando = celulas.find((c) => c.el.contains(ev.target as Node)) ?? null;
      ultimoX = ev.clientX;
    };
    const mover = (ev: PointerEvent) => {
      if (!arrastando) return;
      arrastando.angulo += (ev.clientX - ultimoX) * 0.01;
      ultimoX = ev.clientX;
    };
    const subir = () => (arrastando = null);
    pagina.current!.addEventListener('pointerdown', descer);
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', subir);

    let quadro = 0;
    const desenhar = () => {
      quadro = requestAnimationFrame(desenhar);
      const { clientWidth: w, clientHeight: h } = renderer.domElement;
      if (renderer.domElement.width !== Math.floor(w * window.devicePixelRatio))
        renderer.setSize(w, h, false);
      renderer.setClearColor(0x000000, 0);
      renderer.setScissor(0, 0, w, h);
      renderer.clear();
      const topo = renderer.domElement.getBoundingClientRect().top;
      for (const c of celulas) {
        const r = c.el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > h) continue;
        if (girandoRef.current && c !== arrastando) c.angulo += 0.004;
        const d = c.raio * 3;
        c.camera.position.set(
          c.centro.x + Math.sin(c.angulo) * d,
          c.centro.y + d * 0.75,
          c.centro.z + Math.cos(c.angulo) * d,
        );
        c.camera.lookAt(c.centro);
        const aspecto = r.width / r.height;
        c.camera.left = -c.raio * aspecto * 0.85;
        c.camera.right = c.raio * aspecto * 0.85;
        c.camera.top = c.raio * 0.85;
        c.camera.bottom = -c.raio * 0.85;
        c.camera.updateProjectionMatrix();
        const y = h - (r.bottom - topo);
        renderer.setViewport(r.left, y, r.width, r.height);
        renderer.setScissor(r.left, y, r.width, r.height);
        renderer.render(c.cena, c.camera);
      }
    };
    desenhar();
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', subir);
      renderer.dispose();
    };
  }, [proprio, foco]);

  return (
    <div className="modelos-pagina" ref={pagina}>
      <canvas ref={canvas} className="modelos-canvas" />
      <header className="modelos-topo">
        <div>
          <h1>Modelos 3D dos negócios</h1>
          <p>
            Cada negócio cresce no mapa conforme a equipe, as linhas de equipamento e a capacidade.
            Arraste um modelo para girar; dois cliques para ver de perto.
          </p>
        </div>
        <div className="modelos-controles">
          <label>
            <input
              type="checkbox"
              checked={girando}
              onChange={(e) => setGirando(e.target.checked)}
            />{' '}
            Girar
          </label>
          <label>
            <input
              type="checkbox"
              checked={proprio}
              onChange={(e) => setProprio(e.target.checked)}
            />{' '}
            Bandeira de dono
          </label>
        </div>
      </header>
      <div
        className="modelos-grade"
        ref={grade}
        onDoubleClick={(ev) =>
          setFoco(
            (ev.target as HTMLElement).closest<HTMLElement>('[data-celula]')?.dataset.celula ??
              null,
          )
        }
      >
        <div />
        {estagios.map((e) => (
          <div key={String(e)} className="modelos-coluna">
            {nomeDoEstagio(e)}
          </div>
        ))}
        {categorias.map((c) => (
          <Linha key={c} categoria={c} />
        ))}
      </div>
      {foco && (
        <div className="modelos-foco" data-celula={foco} onDoubleClick={() => setFoco(null)}>
          <button type="button" onClick={() => setFoco(null)}>
            Fechar
          </button>
          <span>
            {categoryInfo[foco.split(':')[0] as Category].label} ·{' '}
            {nomeDoEstagio(
              (foco.split(':')[1] === 'obra' ? 'obra' : Number(foco.split(':')[1])) as Estagio,
            )}
          </span>
        </div>
      )}
    </div>
  );
}

function Linha({ categoria }: { categoria: Category }) {
  return (
    <>
      <div className="modelos-linha" style={{ borderColor: categoryInfo[categoria].color }}>
        {categoryInfo[categoria].label}
      </div>
      {estagios.map((e) => (
        <div key={String(e)} className="modelos-celula" data-celula={`${categoria}:${e}`} />
      ))}
    </>
  );
}
