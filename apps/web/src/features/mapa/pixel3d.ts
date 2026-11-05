/**
 * Desenho em pixel art dos modelos 3D, na mão da identidade visual (sprites de /arte):
 * a cena é desenhada em baixa resolução e ampliada sem suavizar; em volta da silhueta entra um
 * contorno escuro de 1 pixel, e as arestas internas ganham brilho, como nos desenhos à mão.
 *
 * Funciona tanto no canvas da vitrine quanto dentro do canvas do mapa: pixels vazios são
 * descartados, então o que está por baixo (o mapa) continua aparecendo.
 */
import * as THREE from 'three';

// Camada dos traços de aresta (LineSegments): fora do passe de normais.
export const CAMADA_TRACOS = 1;

const TINTA = new THREE.Color('#1d1a12');

const vertice = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmento = /* glsl */ `
  uniform sampler2D tCor;
  uniform sampler2D tNormal;
  uniform sampler2D tProfundidade;
  uniform vec4 resolucao; // largura, altura, 1/largura, 1/altura (em pixels grandes)
  uniform vec3 tinta;
  uniform float brilhoAresta;
  uniform float limiteProfundidade;
  varying vec2 vUv;

  vec4 cor(vec2 d) { return texture2D(tCor, vUv + d * resolucao.zw); }
  vec3 normal(vec2 d) { return texture2D(tNormal, vUv + d * resolucao.zw).rgb * 2.0 - 1.0; }
  float prof(vec2 d) { return texture2D(tProfundidade, vUv + d * resolucao.zw).r; }

  void main() {
    vec4 c = cor(vec2(0.0));
    if (c.a < 0.5) {
      // Fora do modelo: contorno de 1 pixel onde algum vizinho é modelo.
      float vizinho = max(max(cor(vec2(1.0, 0.0)).a, cor(vec2(-1.0, 0.0)).a),
                          max(cor(vec2(0.0, 1.0)).a, cor(vec2(0.0, -1.0)).a));
      if (vizinho < 0.5) discard;
      gl_FragColor = vec4(tinta, 1.0);
      #include <colorspace_fragment>
      return;
    }
    // Dentro: peça na frente de outra ganha contorno escuro; dobra de face ganha brilho.
    float p = prof(vec2(0.0));
    float salto = 0.0;
    salto += clamp(prof(vec2(1.0, 0.0)) - p, 0.0, 1.0);
    salto += clamp(prof(vec2(-1.0, 0.0)) - p, 0.0, 1.0);
    salto += clamp(prof(vec2(0.0, 1.0)) - p, 0.0, 1.0);
    salto += clamp(prof(vec2(0.0, -1.0)) - p, 0.0, 1.0);
    if (salto > limiteProfundidade) {
      gl_FragColor = vec4(mix(c.rgb, tinta, 0.85), 1.0);
      #include <colorspace_fragment>
      return;
    }
    vec3 n = normal(vec2(0.0));
    float dobra = 0.0;
    for (int i = 0; i < 4; i++) {
      vec2 d = i == 0 ? vec2(1.0, 0.0) : i == 1 ? vec2(-1.0, 0.0) : i == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0);
      vec3 m = normal(d);
      // só o lado mais "virado para a luz/câmera" acende, para a linha ter 1 pixel
      float vez = step(0.0, dot(n - m, vec3(1.0, 1.0, 1.0)));
      float maisPerto = step(0.0, prof(d) - p + 0.0001);
      dobra += (1.0 - dot(n, m)) * vez * maisPerto;
    }
    float f = dobra > 0.15 ? 1.0 + brilhoAresta : 1.0;
    gl_FragColor = vec4(c.rgb * f, 1.0);
    #include <colorspace_fragment>
  }
`;

export interface Retangulo {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export class DesenhoPixel {
  private cor = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    type: THREE.HalfFloatType,
  });
  private normais = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    type: THREE.HalfFloatType,
  });
  private materialNormal = new THREE.MeshNormalMaterial();
  private quadro: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private cenaQuadro = new THREE.Scene();
  private cameraQuadro = new THREE.Camera();
  /** Força do brilho nas dobras de face (0 = sem brilho). */
  brilhoAresta = 0.28;
  /** Salto de profundidade (0–1) que conta como peça na frente de outra. */
  limiteProfundidade = 0.004;

  constructor(private renderer: THREE.WebGLRenderer) {
    this.cor.depthTexture = new THREE.DepthTexture(1, 1);
    this.quadro = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: {
          tCor: { value: null },
          tNormal: { value: null },
          tProfundidade: { value: null },
          resolucao: { value: new THREE.Vector4() },
          tinta: { value: TINTA },
          brilhoAresta: { value: 0 },
          limiteProfundidade: { value: 0 },
        },
        vertexShader: vertice,
        fragmentShader: fragmento,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.quadro.frustumCulled = false;
    this.cenaQuadro.add(this.quadro);
  }

  /**
   * Desenha a cena em pixels grandes dentro do retângulo (em pixels do dispositivo, origem
   * embaixo à esquerda) do destino atual (null = a tela/canvas).
   */
  desenhar(
    cena: THREE.Scene,
    camera: THREE.Camera,
    area: Retangulo,
    tamanhoPixel: number,
    destino: THREE.WebGLRenderTarget | null = null,
  ) {
    const r = this.renderer;
    const w = Math.max(1, Math.ceil(area.largura / tamanhoPixel));
    const h = Math.max(1, Math.ceil(area.altura / tamanhoPixel));
    if (this.cor.width !== w || this.cor.height !== h) {
      this.cor.setSize(w, h);
      this.normais.setSize(w, h);
    }
    const tesoura = r.getScissorTest();
    const corFundo = r.getClearColor(new THREE.Color());
    const alfaFundo = r.getClearAlpha();
    r.setScissorTest(false);
    r.setClearColor(0x000000, 0);

    const camadas = camera.layers.mask;
    camera.layers.enable(CAMADA_TRACOS);
    r.setRenderTarget(this.cor);
    r.clear(true, true, false);
    r.render(cena, camera);

    camera.layers.disable(CAMADA_TRACOS);
    const antes = cena.overrideMaterial;
    cena.overrideMaterial = this.materialNormal;
    r.setRenderTarget(this.normais);
    r.clear(true, true, false);
    r.render(cena, camera);
    cena.overrideMaterial = antes;
    camera.layers.mask = camadas;

    const u = this.quadro.material.uniforms;
    u.tCor.value = this.cor.texture;
    u.tNormal.value = this.normais.texture;
    u.tProfundidade.value = this.cor.depthTexture;
    u.resolucao.value.set(w, h, 1 / w, 1 / h);
    u.brilhoAresta.value = this.brilhoAresta;
    u.limiteProfundidade.value = this.limiteProfundidade;

    r.setRenderTarget(destino);
    // o quadro ocupa exatamente w×h pixels grandes, alinhados ao canto da área
    r.setViewport(area.x, area.y, w * tamanhoPixel, h * tamanhoPixel);
    r.setScissor(area.x, area.y, area.largura, area.altura);
    r.setScissorTest(true);
    r.render(this.cenaQuadro, this.cameraQuadro);

    r.setScissorTest(tesoura);
    r.setClearColor(corFundo, alfaFundo);
  }

  dispose() {
    this.cor.dispose();
    this.normais.dispose();
    this.materialNormal.dispose();
    this.quadro.geometry.dispose();
    this.quadro.material.dispose();
  }
}
