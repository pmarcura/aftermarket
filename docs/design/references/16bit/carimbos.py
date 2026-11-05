"""Pintura 16-bit à mão (por carimbos) no estilo da referência escolhida pelo John.

Trabalha em 1 px = 1 pixel de jogo (quadro 640×400), salva também em 2× para ver.
"""
import math, random, sys
from PIL import Image, ImageDraw

P = dict(
    campo='#00c369', campo_t='#38cf73', campo_s='#00a54b',
    mata_c='#009b72', mata='#00804c', mata_e='#006c56',
    serra_c='#80cc85', serra='#4d7962', pedra='#7f786b', serra_s='#37596b',
    agua='#00a9f8', agua_f='#3a5d6e', agua_c='#7fd4ff',
    areia='#d5bb97', estrada_e='#b9a991', muro='#cdb796', telhado='#9a946e',
    terracota='#b54a3a', madeira='#8a5a32', ouro='#eec156', alerta='#e4572e',
    contorno='#1a2a24', luz='#fff2b0', metal='#cfcfc0', branco='#f3e7cc',
)
from PIL import ImageFont
W = H = 0; rng = None; im = None; px = None; d = None; FONTE = None

def setup(w, h, seed=3):
    global W, H, rng, im, px, d, FONTE, RIOS
    W, H = w, h
    rng = random.Random(seed)
    im = Image.new('RGB', (W, H), P['campo'])
    px = im.load()
    d = ImageDraw.Draw(im)
    RIOS = []
    try:
        FONTE = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 11)
    except Exception:
        FONTE = ImageFont.load_default()

def save(base):
    im.save(base + '-1x.png')
    im.resize((W * 2, H * 2), Image.NEAREST).save(base + '-2x.png')

def put(x, y, c):
    if 0 <= x < W and 0 <= y < H:
        px[x, y] = tuple(int(P[c][i:i + 2], 16) for i in (1, 3, 5))

def get(x, y):
    if 0 <= x < W and 0 <= y < H:
        return '#%02x%02x%02x' % px[x, y]
    return None

# ---------- campo: tufos esparsos de capim (3 formas), como na referência ----------
TUFOS = [
    [(0, 0), (1, 0), (2, 0)],
    [(0, 1), (1, 0), (2, 1)],
    [(0, 0), (0, 1), (2, 0), (2, 1)],
    [(1, 0), (0, 1), (1, 1), (2, 1)],
]
def campo():
    for _ in range(int(W * H / 180)):
        x, y = rng.randrange(W), rng.randrange(H)
        t = rng.choice(TUFOS)
        c = 'campo_s' if rng.random() < 0.75 else 'campo_t'
        for dx, dy in t:
            put(x + dx, y + dy, c)

# ---------- mata: copas redondas sobrepostas com luz no alto esquerdo e tronco ----------
def copa(cx, cy, r):
    for y in range(-r, r + 2):
        for x in range(-r, r + 1):
            if x * x + (y * 1.15) ** 2 <= r * r:
                c = 'mata'
                if x * x + (y + 2) ** 2 <= (r - 1) ** 2 and (x + y) % 2 == 0 and y < 0:
                    c = 'mata_c'
                if y > r * 0.35:
                    c = 'mata_e'
                put(cx + x, cy + y, c)
    # contorno inferior e tronco
    for x in range(-r + 1, r):
        if get(cx + x, cy + r + 2) == P['campo'] or get(cx + x, cy + r + 2) in (P['campo_s'], P['campo_t']):
            put(cx + x, cy + r + 1, 'mata_e')
    put(cx, cy + r + 1, 'madeira'); put(cx, cy + r + 2, 'madeira')
    put(cx + 1, cy + r + 2, 'contorno')

def mata(cx, cy, raio, n):
    pts = []
    for _ in range(n):
        a = rng.random() * math.tau; rr = raio * math.sqrt(rng.random())
        pts.append((int(cx + math.cos(a) * rr), int(cy + math.sin(a) * rr * 0.6)))
    pts.sort(key=lambda p: p[1])
    for x, y in pts:
        copa(x, y, rng.choice([5, 6, 6, 7]))

# ---------- serra: cristas em camadas, pedra cinza com sombra à direita ----------
def morro(cx, cy, w, h):
    """Maciço arredondado como na referência: massa cinza-esverdeada, face de rocha à direita
    com sombra, cristas claras no alto-esquerda, base tramada que funde com a mata."""
    for j in range(h):
        y = cy - j
        t = j / h
        meia = int(w / 2 * math.sqrt(max(0.0, 1 - t * t)) * (0.92 + 0.08 * math.sin(j * 1.7)))
        for x in range(-meia, meia + 1):
            u = x / max(1, meia)
            if u < -0.25: c = 'serra_c'
            elif u < 0.25: c = 'serra'
            elif u < 0.7: c = 'pedra' if (x - j) % 4 == 0 else 'serra_s'
            else: c = 'serra_s'
            if j >= h - 2 and -0.3 < u < 0.3: c = 'branco'
            if j < 2 and (x + j) % 2: c = 'mata_e'
            put(cx + x, y, c)
        if meia: put(cx + meia + 1, y, 'contorno')
    # cristas e rachaduras
    for k in range(4):
        y0 = cy - int(h * (0.3 + 0.15 * k)); x0 = -int(w * 0.3) + k * 3
        for i in range(0, int(w * 0.35)):
            put(cx + x0 + i, y0 - i // 3, 'serra_c' if i % 2 else 'pedra')
    for k in range(3):
        y0 = cy - int(h * (0.2 + 0.2 * k)); x0 = int(w * 0.15) + k * 2
        for i in range(0, 7):
            put(cx + x0 + i, y0 + i // 2, 'contorno')

def serra(cx, cy, w, h):
    """Cordilheira: morros de trás para a frente, menores ao fundo; sopé de mata escura."""
    fil = [(0.6, -int(h * 0.45)), (0.85, -int(h * 0.2)), (1.0, 0)]
    for esc, dy in fil:
        x = cx + rng.randrange(0, 10)
        while x < cx + w:
            mw = int(rng.choice([30, 36, 44]) * esc); mh = int(h * esc * rng.uniform(0.8, 1.0))
            morro(x + mw // 2, cy + dy, mw, mh)
            x += mw - rng.choice([8, 10, 14])
    for x in range(cx - 6, cx + w + 6):
        for k in range(4):
            if (x + k) % 2 == 0: put(x, cy + 1 + k, 'mata_e' if k < 2 else 'mata')
    for _ in range(int(w / 6)):
        copa(cx + rng.randrange(-4, w + 4), cy + 6 + rng.randrange(0, 5), rng.choice([4, 5]))

# ---------- rio: faixa de água com margem clara e brilho ----------
def suave(path, passo=1.0):
    """Catmull-Rom: pontos densos numa curva suave pelos nós."""
    P_ = [path[0]] + list(path) + [path[-1]]
    out = []
    for i in range(1, len(P_) - 2):
        p0, p1, p2, p3 = P_[i - 1], P_[i], P_[i + 1], P_[i + 2]
        n = int(max(abs(p2[0] - p1[0]), abs(p2[1] - p1[1])) / passo) + 1
        for k in range(n):
            t = k / n; t2 = t * t; t3 = t2 * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((x, y))
    out.append(path[-1])
    return out

RIOS = []

def rio(path, larg=5, suavizar=True):
    pts = suave(path) if suavizar else [(x, y) for x, y in path]
    if not suavizar:
        # densifica a polilinha
        dens = []
        for i in range(len(pts) - 1):
            (x0, y0), (x1, y1) = pts[i], pts[i + 1]
            n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
            for k in range(n): dens.append((x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n))
        pts = dens or pts
    RIOS.append((pts, larg))
    for x, y in pts:
        for dx in range(-larg - 1, larg + 2):
            for dy in range(-larg - 1, larg + 2):
                if dx * dx + dy * dy <= (larg + 1) ** 2:
                    put(int(x + dx), int(y + dy), 'areia')
    for x, y in pts:
        for dx in range(-larg, larg + 1):
            for dy in range(-larg, larg + 1):
                if dx * dx + dy * dy <= larg * larg:
                    put(int(x + dx), int(y + dy), 'agua')
    for i, (x, y) in enumerate(pts):
        if i % 9 in (0, 1, 2):
            put(int(x) - 1, int(y) - 1, 'agua_c')

# ---------- estrada de terra com borda escura ----------
def na_agua(x, y):
    c = get(x, y)
    return c in (P['agua'], P['agua_c'], P['agua_f'])

def ponte(pts):
    """Tabuleiro de madeira com guarda-corpo onde a estrada cruza água."""
    for i, (x, y) in enumerate(pts):
        if not na_agua(x, y): continue
        # direção local
        x2, y2 = pts[min(i + 2, len(pts) - 1)]; x1, y1 = pts[max(i - 2, 0)]
        dx, dy = x2 - x1, y2 - y1
        n = max(1, math.hypot(dx, dy)); nx, ny = -dy / n, dx / n
        for k in range(-3, 4):
            c = 'madeira' if abs(k) < 3 else 'contorno'
            if abs(k) < 3 and i % 3 == 0: c = 'estrada_e'
            put(int(x + nx * k), int(y + ny * k), c)
        if i % 4 == 0:
            put(int(x + nx * 3), int(y + ny * 3) - 1, 'luz'); put(int(x - nx * 3), int(y - ny * 3) - 1, 'luz')

def estrada(path, larg=3, cor='areia', borda='estrada_e', suavizar=True):
    if suavizar: pts = [(int(x), int(y)) for x, y in suave(path)]
    else:
        pts = []
        for i in range(len(path) - 1):
            (x0, y0), (x1, y1) = path[i], path[i + 1]
            n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
            for k in range(n): pts.append((int(x0 + (x1 - x0) * k / n), int(y0 + (y1 - y0) * k / n)))
    for x, y in pts:
        if na_agua(x, y): continue
        for dx in range(-larg, larg + 1):
            for dy in range(-larg, larg + 1):
                if dx * dx + dy * dy <= (larg) ** 2:
                    put(x + dx, y + dy, borda)
    for x, y in pts:
        if na_agua(x, y): continue
        for dx in range(-larg + 1, larg):
            for dy in range(-larg + 1, larg):
                if dx * dx + dy * dy <= (larg - 1) ** 2:
                    put(x + dx, y + dy, cor)
    ponte(pts)
    return pts

def rodovia(path, suavizar=True, larg=3):
    pts = estrada(path, larg=larg, cor='ouro', borda='contorno', suavizar=suavizar)
    for i, (x, y) in enumerate(pts):
        if i % 8 < 3 and not na_agua(x, y): put(x, y, 'branco')

# ---------- casas e cidades ----------
def casa(x, y, w=7, h=5, telhado='terracota'):
    for i in range(w):
        for j in range(h):
            put(x + i, y + j, 'branco' if (i + j) % 7 else 'muro')
    for i in range(-1, w + 1):
        for j in range(3):
            if 0 <= i + j - 1 and i - j + 1 < w + 1:
                put(x + i, y - 3 + j, telhado)
    put(x + 1, y + h - 1, 'contorno'); put(x + w - 2, y + 1, 'luz')
    for i in range(w): put(x + i, y + h, 'contorno')
    put(x + w, y + h - 1, 'contorno')

def igreja(x, y):
    casa(x, y, 9, 6, 'telhado')
    for j in range(8): put(x + 4, y - 3 - j, 'muro'); put(x + 5, y - 3 - j, 'muro')
    put(x + 4, y - 12, 'contorno'); put(x + 5, y - 12, 'contorno'); put(x + 4, y - 11, 'terracota'); put(x + 5, y - 11, 'terracota')

def vila(cx, cy, n=5):
    # chão de terra batida
    for dx in range(-16, 17):
        for dy in range(-9, 10):
            if dx * dx * 0.35 + dy * dy <= 81 and (dx + dy) % 2 == 0:
                put(cx + dx, cy + dy, 'areia')
    pos = [(-13, -4), (-3, -6), (6, -3), (-9, 3), (2, 4), (9, 2)]
    for i in range(n):
        dx, dy = pos[i]
        casa(cx + dx, cy + dy, rng.choice([6, 7]), rng.choice([4, 5]))

def cidade(cx, cy):
    R = 30
    for dx in range(-R, R + 1):
        for dy in range(-18, 19):
            if dx * dx * 0.38 + dy * dy <= 324:
                put(cx + dx, cy + dy, 'areia' if (dx * 3 + dy) % 5 else 'estrada_e')
    # ruas em cruz e anel
    for dx in range(-R, R + 1):
        if dx * dx * 0.38 <= 320: put(cx + dx, cy, 'estrada_e'); put(cx + dx, cy + 1, 'estrada_e')
    for dy in range(-18, 19): put(cx, cy + dy, 'estrada_e'); put(cx + 1, cy + dy, 'estrada_e')
    quadras = [(-26, -12), (-16, -14), (-6, -15), (5, -15), (15, -13), (23, -9),
               (-26, 4), (-16, 6), (-6, 7), (6, 7), (16, 6), (24, 3),
               (-21, -5), (10, -6), (-12, 12), (12, 12)]
    seed = cx * 7 + cy
    for k, (dx, dy) in enumerate(quadras):
        w = 8 + (k * 3 + seed) % 3; h = 5 + (k * 5 + seed) % 3
        telhado = ['terracota', 'terracota', 'telhado', 'serra_s'][(k + seed) % 4]
        casa(cx + dx, cy + dy, w, h, telhado)
    igreja(cx - 5, cy - 8)
    # praça com árvores
    for dx, dy in [(8, 2), (14, 1)]:
        copa(cx + dx, cy + dy, 3)
    # muro/borda da cidade
    for dx in range(-R - 1, R + 2):
        for dy in range(-19, 20):
            r = dx * dx * 0.38 + dy * dy
            if 300 <= r <= 324: put(cx + dx, cy + dy, 'estrada_e' if (dx + dy) % 2 else 'contorno')

def metropole(cx, cy):
    for dx in range(-36, 37):
        for dy in range(-22, 23):
            if dx * dx * 0.45 + dy * dy <= 484:
                put(cx + dx, cy + dy, 'muro' if (dx + dy) % 3 else 'areia')
    # quadras de prédios altos
    for dx, dy, h in [(-30, -6, 10), (-22, -14, 14), (-12, -16, 18), (0, -17, 22), (12, -15, 16), (22, -12, 12), (-26, 6, 8), (-14, 4, 12), (-2, 2, 14), (10, 3, 10), (22, 2, 8), (-8, 12, 6), (6, 12, 6)]:
        w = 7
        for i in range(w):
            for j in range(h):
                c = 'muro' if (i % 3 != 1 or j % 2 == 0) else 'luz'
                if i == w - 1: c = 'contorno'
                put(cx + dx + i, cy + dy - j, c)
        for i in range(w): put(cx + dx + i, cy + dy - h, 'serra_s')
        for i in range(w): put(cx + dx + i, cy + dy + 1, 'contorno')
    for dx in range(-36, 37):
        for dy in range(-22, 23):
            r = dx * dx * 0.45 + dy * dy
            if 450 <= r <= 484: put(cx + dx, cy + dy, 'estrada_e')

def caminhao(x, y, dir=1):
    for i in range(8):
        for j in range(5): put(x + i, y + j, 'metal')
    for i in range(3):
        for j in range(5): put(x + (8 if dir else -3) + i, y + j, 'terracota')
    put(x + (9 if dir else -2), y + 1, 'luz')
    for i in range(-3, 11): put(x + i, y + 5, 'contorno')
    put(x + 1, y + 6, 'contorno'); put(x + 6, y + 6, 'contorno')

def selo(x, y):
    for i in range(9):
        for j in range(9): put(x + i, y + j, 'contorno')
    for i in range(1, 8):
        for j in range(1, 8): put(x + i, y + j, 'alerta')
    for j in range(2, 5): put(x + 4, y + j, 'luz')
    put(x + 4, y + 6, 'luz')

def rotulo(x, y, txt):
    for ox, oy in [(1,0),(-1,0),(0,1),(0,-1),(1,1)]: d.text((x + ox, y + oy), txt, fill=P['contorno'], font=FONTE)
    d.text((x, y), txt, fill=P['branco'], font=FONTE)


# ---------- oceano, lago e fronteira (mundo real) ----------
def oceano(mask):
    m = mask.load()
    for y in range(H):
        for x in range(W):
            if m[x, y]:
                borda = any(0 <= x + dx < W and 0 <= y + dy < H and not m[x + dx, y + dy] for dx, dy in ((-3, 0), (3, 0), (0, -3), (0, 3)))
                c = 'agua'
                if borda: c = 'agua_c'
                elif (x * 7 + y * 13) % 97 == 0 and (x + y) % 3 == 0: c = 'agua_c'
                elif (x * 5 + y * 11) % 131 == 0: c = 'agua_f'
                put(x, y, c)
    # areia na terra junto ao mar
    for y in range(H):
        for x in range(W):
            if not m[x, y] and any(0 <= x + dx < W and 0 <= y + dy < H and m[x + dx, y + dy] for dx, dy in ((-2, 0), (2, 0), (0, -2), (0, 2))):
                put(x, y, 'areia')

def lago(ring):
    mask = Image.new('1', (W, H), 0)
    ImageDraw.Draw(mask).polygon(ring, fill=1)
    m = mask.load()
    for y in range(H):
        for x in range(W):
            if m[x, y]: put(x, y, 'agua' if (x * 7 + y * 3) % 23 else 'agua_c')

def fronteira(ring):
    for i in range(len(ring) - 1):
        (x0, y0), (x1, y1) = ring[i], ring[i + 1]
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for k in range(n):
            if (k // 4) % 2 == 0:
                x, y = int(x0 + (x1 - x0) * k / n), int(y0 + (y1 - y0) * k / n)
                if get(x, y) in (P['campo'], P['campo_s'], P['campo_t']): put(x, y, 'mata_e')
