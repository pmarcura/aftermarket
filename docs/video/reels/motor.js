// Motor dos reels do Aftermarket (9:16, 1080×1920).
// Tudo é calculado a partir do tempo t: window.__seek(t) desenha o quadro exato.
// Cada reel define suas cenas em uma lista: [id, duração em s, legenda, função(u, d)].
// u = segundos desde o início da cena; d = duração da cena.
const FPS = 30;
const E = {
  out: (x) => 1 - Math.pow(1 - x, 3),
  io: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  back: (x) => {
    const c1 = 1.9,
      c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  },
};
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const q = (u, a, d) => clamp((u - a) / d);
const $ = (id) => document.getElementById(id);

// Posiciona e transforma um elemento. Valores em px; s = escala; r = graus.
function T(el, { x = 0, y = 0, s = 1, r = 0, o = 1 } = {}) {
  if (!el) return;
  el.style.transform = `translate(${x}px,${y}px) scale(${s}) rotate(${r}deg)`;
  el.style.opacity = o;
}
// Entra subindo, com desaceleração.
function entra(el, u, a, d = 0.45, dist = 90) {
  const k = E.out(q(u, a, d));
  T(el, { y: (1 - k) * dist, o: k });
  return k;
}
// Estala: cresce com um leve estouro (overshoot), como um carimbo.
function estala(el, u, a, d = 0.4, r = 0) {
  const p = q(u, a, d);
  T(el, { s: p <= 0 ? 0 : E.back(p), o: clamp(p * 6), r });
  return p;
}
// Tremor curto depois de um impacto (carimbo, pancada).
function treme(u, a, amp = 14, dur = 0.3) {
  if (u < a || u > a + dur) return [0, 0];
  const f = 1 - (u - a) / dur;
  return [Math.sin(u * 120) * amp * f, Math.cos(u * 97) * amp * f];
}

// Legenda: palavras aparecem uma a uma, a da vez em verde.
function legenda(texto, u, d) {
  // Legenda em partes: [[inicio, 'texto'], ...] (inicio em segundos dentro da cena).
  if (Array.isArray(texto)) {
    let i = 0;
    for (let k = 0; k < texto.length; k++) if (u >= texto[k][0]) i = k;
    const ini = texto[i][0],
      fim = i + 1 < texto.length ? texto[i + 1][0] : d;
    return legenda(texto[i][1], u - ini, fim - ini);
  }
  const p = $('cap-p');
  const palavras = texto.split(' ');
  const k = Math.min(palavras.length - 1, Math.floor((u / d) * palavras.length));
  p.innerHTML = palavras
    .map((w, i) => (i > k ? '' : `<span class="${i === k ? 'agora' : 'dita'}">${w}</span>`))
    .join(' ');
}

// Divide um título em palavras animáveis (cada palavra vira <span class="w">).
function dividir(el) {
  const anda = (n) =>
    [...n.childNodes].forEach((c) => {
      if (c.nodeType === 3) {
        const f = document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach((p) => {
          if (!p) return;
          if (/^\s+$/.test(p)) f.append(p);
          else {
            const s = document.createElement('span');
            s.className = 'w';
            s.textContent = p;
            f.append(s);
          }
        });
        c.replaceWith(f);
      } else if (c.nodeName !== 'BR') anda(c);
    });
  anda(el);
}
// Palavras do título entram uma a uma (sobem e aparecem).
function palavras(el, u, a, gap = 0.1, d = 0.4) {
  el.querySelectorAll('.w').forEach((w, i) => {
    const k = E.out(q(u, a + i * gap, d));
    w.style.transform = `translateY(${(1 - k) * 50}px)`;
    w.style.opacity = k;
  });
}
// Traça uma linha SVG de 0 a 1.
function tracar(p, k) {
  const L = p.getTotalLength();
  p.style.strokeDasharray = L;
  p.style.strokeDashoffset = L * (1 - clamp(k));
}
// Contador que sobe de "de" até "ate".
function contar(el, u, a, d, de, ate, f = (n) => Math.round(n)) {
  el.textContent = f(de + (ate - de) * E.out(q(u, a, d)));
}
// Tremor aplicado ao próprio elemento (cena inteira, por exemplo).
function sacode(el, u, a, amp = 12) {
  const [x, y] = treme(u, a, amp, 0.3);
  el.style.transform = `translate(${x}px,${y}px)`;
}
// Posição ao longo de pontos [tempo, valor], com suavização entre eles.
function trecho(u, pts) {
  if (u <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (u <= pts[i][0]) {
      const [a, va] = pts[i - 1],
        [b, vb] = pts[i];
      return va + (vb - va) * E.io(q(u, a, b - a));
    }
  }
  return pts[pts.length - 1][1];
}

let CENAS = [],
  DUR = 0,
  t = 0;
// Flash branco curto no corte entre cenas: dá o "pulo" de edição.
function flash(u) {
  return clamp(1 - u / 0.14) * 0.85;
}

function render() {
  let c = CENAS[CENAS.length - 1];
  for (const x of CENAS)
    if (t >= x.a && t < x.a + x.d) {
      c = x;
      break;
    }
  for (const x of CENAS) x.el.style.visibility = x === c ? 'visible' : 'hidden';
  const u = t - c.a;
  c.fn(u, c.d);
  legenda(c.leg, u, c.d);
  $('flash').style.opacity = c === CENAS[0] ? 0 : flash(u);
  $('tt').textContent = `${t.toFixed(1)} / ${DUR.toFixed(1)} s`;
}

// Monta a linha do tempo a partir da lista de cenas.
function montar(lista) {
  document.querySelectorAll('.h').forEach(dividir);
  let a = 0;
  CENAS = lista.map(([id, d, leg, fn]) => {
    const x = { id, a, d, leg, fn, el: $('c-' + id) };
    a += d;
    return x;
  });
  DUR = a;
  window.__duracao = DUR;
}

// Reprodução na página (botões Tocar / Do início).
let tocando = false,
  t0 = 0;
function loop(ts) {
  if (!tocando) return;
  t = (ts - t0) / 1000;
  if (t >= DUR) {
    t = 0;
    t0 = ts;
  }
  render();
  requestAnimationFrame(loop);
}
const btPlay = document.getElementById('play'),
  btRst = document.getElementById('rst');
if (btPlay)
  btPlay.addEventListener('click', () => {
    tocando = !tocando;
    btPlay.textContent = tocando ? '❚❚ Pausar' : '▶ Tocar';
    if (tocando) {
      t0 = performance.now() - t * 1000;
      requestAnimationFrame(loop);
    }
  });
if (btRst)
  btRst.addEventListener('click', () => {
    t = 0;
    t0 = performance.now();
    render();
  });

// Ganchos usados pelo renderizador (.runtime/video/render.mts).
window.__fps = FPS;
window.__pronto = Promise.all([
  document.fonts.ready,
  ...[...document.images].map((im) => im.decode().catch(() => {})),
]).then(() => {
  render();
  return true;
});
window.__seek = (v) => {
  t = Math.min(v, DUR - 1e-6);
  render();
  return true;
};
