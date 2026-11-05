/**
 * Camada 3D do mapa: desenha os negócios do jogo (de jogadores e de bots) com os modelos do kit,
 * no estágio de cada um. Só desenho: lê posições e estágios e não muda nada no jogo.
 *
 * O three.js desenha dentro do próprio canvas do MapLibre (camada "custom"), dividindo a mesma
 * câmera e o mesmo teste de profundidade. Os modelos ficam num espaço em metros com origem fixa,
 * para não perder precisão com coordenadas grandes.
 */
import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';
import type { Category, Position } from '../../../../../packages/simulation/src/model';
import { bandeira, construirModelo, luzes, type Estagio } from './modelos3d';
import { DesenhoPixel } from './pixel3d';

export interface Negocio3D {
  id: string;
  categoria: Category;
  estagio: Estagio;
  coordenadas: Position;
  proprio: boolean;
}

export const CAMADA_3D = 'negocios-3d';
// A partir deste zoom os modelos aparecem (de longe, os ícones resumem melhor).
export const ZOOM_3D = 12.5;
// Tamanho do pixel da arte no mapa (px de tela), o mesmo dos sprites da identidade.
export const TAMANHO_PIXEL = 2;
// Exagero de tamanho: de perto quase o tamanho real; de longe maior, para continuar visível.
function exagero(zoom: number) {
  return 3.6 * 2 ** (Math.max(0, 16.5 - zoom) * 0.55);
}

const ORIGEM = maplibregl.MercatorCoordinate.fromLngLat([-47.06, -22.9], 0);
const METRO = ORIGEM.meterInMercatorCoordinateUnits();

function paraCena([lng, lat]: Position) {
  const m = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], 0);
  return new THREE.Vector3((m.x - ORIGEM.x) / METRO, 0, (m.y - ORIGEM.y) / METRO);
}

export function criarCamada3D() {
  const cena = new THREE.Scene();
  const [ceu, sol] = luzes(200) as [THREE.HemisphereLight, THREE.DirectionalLight];
  cena.add(ceu, sol, sol.target);
  const raiz = new THREE.Group();
  cena.add(raiz);
  const camera = new THREE.Camera();
  const moldes = new Map<string, THREE.Group>();
  const instancias = new Map<string, { chave: string; obj: THREE.Group }>();
  let renderer: THREE.WebGLRenderer | null = null;
  let desenho: DesenhoPixel | null = null;
  let mapa: maplibregl.Map | null = null;
  let escalaAtual = 0;

  const molde = (categoria: Category, estagio: Estagio) => {
    const chave = `${categoria}:${estagio}`;
    let m = moldes.get(chave);
    if (!m) {
      m = construirModelo(categoria, estagio);
      moldes.set(chave, m);
    }
    return m;
  };

  function aplicarEscala(zoom: number) {
    const e = exagero(zoom);
    if (Math.abs(e - escalaAtual) < 0.01) return;
    escalaAtual = e;
    for (const { obj } of instancias.values()) obj.scale.setScalar(e);
  }

  const camada: maplibregl.CustomLayerInterface = {
    id: CAMADA_3D,
    type: 'custom',
    renderingMode: '3d',
    onAdd(map, gl) {
      mapa = map;
      renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: false,
      });
      desenho = new DesenhoPixel(renderer);
      renderer.autoClear = false;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    },
    onRemove() {
      desenho?.dispose();
      desenho = null;
      renderer?.dispose();
      renderer = null;
      mapa = null;
    },
    render(_gl, args) {
      if (!renderer || !mapa) return;
      const zoom = mapa.getZoom();
      raiz.visible = zoom >= ZOOM_3D;
      if (!raiz.visible || instancias.size === 0) return;
      aplicarEscala(zoom);
      // Sombra acompanha o que está na tela: o sol mira o centro da vista.
      const centro = paraCena(mapa.getCenter().toArray() as Position);
      const metrosNaTela =
        (mapa.getCanvas().clientWidth * 40075016 * Math.cos((-22.9 * Math.PI) / 180)) /
        (512 * 2 ** zoom);
      const alcance = Math.min(4000, metrosNaTela * 0.8);
      sol.target.position.copy(centro);
      sol.position.set(centro.x - alcance * 0.75, alcance, centro.z + alcance * 0.3);
      const sombra = sol.shadow.camera;
      sombra.left = -alcance;
      sombra.right = alcance;
      sombra.top = alcance;
      sombra.bottom = -alcance;
      sombra.near = 1;
      sombra.far = alcance * 4;
      sombra.updateProjectionMatrix();
      const matriz = new THREE.Matrix4().fromArray(
        args.defaultProjectionData.mainMatrix as unknown as number[],
      );
      const local = new THREE.Matrix4()
        .makeTranslation(ORIGEM.x, ORIGEM.y, ORIGEM.z ?? 0)
        .scale(new THREE.Vector3(METRO, -METRO, METRO))
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
      camera.projectionMatrix = matriz.multiply(local);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      renderer.resetState();
      // Pixel art da identidade: cada pixel da arte vale TAMANHO_PIXEL pixels de tela.
      const gl = renderer.getContext();
      desenho!.desenhar(
        cena,
        camera,
        { x: 0, y: 0, largura: gl.drawingBufferWidth, altura: gl.drawingBufferHeight },
        TAMANHO_PIXEL * window.devicePixelRatio,
      );
    },
  };

  /** Troca o conjunto de negócios desenhados (só recria o que mudou de estágio ou de dono). */
  function atualizar(negocios: Negocio3D[]) {
    const vistos = new Set<string>();
    for (const n of negocios) {
      vistos.add(n.id);
      const chave = `${n.categoria}:${n.estagio}:${n.proprio ? 1 : 0}`;
      const atual = instancias.get(n.id);
      if (atual?.chave === chave) continue;
      if (atual) raiz.remove(atual.obj);
      const obj = molde(n.categoria, n.estagio).clone();
      if (n.proprio) {
        const b = bandeira('#a6e05a');
        const caixa = new THREE.Box3().setFromObject(obj);
        b.position.set(caixa.min.x + 1.5, 0, caixa.max.z - 1.5);
        obj.add(b);
      }
      obj.position.copy(paraCena(n.coordenadas));
      // Frente para o sul (para a câmera na vista padrão) até a etapa dos bairros alinhar à rua.
      obj.rotation.y = 0;
      obj.scale.setScalar(escalaAtual || 1);
      obj.userData.id = n.id;
      raiz.add(obj);
      instancias.set(n.id, { chave, obj });
    }
    for (const [id, { obj }] of instancias)
      if (!vistos.has(id)) {
        raiz.remove(obj);
        instancias.delete(id);
      }
    escalaAtual = 0;
    mapa?.triggerRepaint();
  }

  return { camada, atualizar };
}
