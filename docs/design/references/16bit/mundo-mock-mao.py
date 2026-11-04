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
W, H = 640, 400
rng = random.Random(3)
im = Image.new('RGB', (W, H), P['campo'])
px = im.load()
d = ImageDraw.Draw(im)
from PIL import ImageFont
try:
    FONTE = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 11)
except Exception:
    FONTE = ImageFont.load_default()

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
def pico(cx, cy, w, h, luz=True):
    for j in range(h):
        y = cy - j
        meia = int(w * (1 - j / h) / 2)
        for x in range(-meia, meia + 1):
            t = x / max(1, meia)
            if t < -0.15: c = 'serra_c' if luz else 'serra'
            elif t < 0.3: c = 'serra'
            else: c = 'serra_s'
            if j > h - 3: c = 'branco' if j == h - 1 else 'serra_c'
            if abs(x) == meia and j < h - 2: c = 'contorno' if t > 0 else 'serra'
            put(cx + x, y, c)
    for x in range(-w // 2, w // 2 + 1): put(cx + x, cy + 1, 'mata_e')

def serra(cx, cy, w, h):
    """Cordilheira: picos em 3 fileiras, de trás para frente, com sopé de mata escura."""
    fil = [(0.55, -8), (0.8, -3), (1.0, 2)]
    for esc, dy in fil:
        x = cx
        while x < cx + w:
            pw = int(rng.choice([18, 22, 26]) * esc); ph = int(h * esc * rng.uniform(0.75, 1.0))
            pico(x + pw // 2, cy + dy, pw, ph)
            x += pw - rng.choice([4, 6, 8])
    for x in range(cx - 4, cx + w + 4):
        for k in range(3):
            if (x + k) % 2 == 0: put(x, cy + 2 + k, 'mata')

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

def rio(path, larg=5):
    pts = suave(path)
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
def estrada(path, larg=3, cor='areia', borda='estrada_e'):
    pts = [(int(x), int(y)) for x, y in suave(path)]
    for x, y in pts:
        for dx in range(-larg, larg + 1):
            for dy in range(-larg, larg + 1):
                if dx * dx + dy * dy <= (larg) ** 2:
                    put(x + dx, y + dy, borda)
    for x, y in pts:
        for dx in range(-larg + 1, larg):
            for dy in range(-larg + 1, larg):
                if dx * dx + dy * dy <= (larg - 1) ** 2:
                    put(x + dx, y + dy, cor)
    return pts

def rodovia(path):
    pts = estrada(path, larg=3, cor='ouro', borda='contorno')
    for i, (x, y) in enumerate(pts):
        if i % 8 < 3: put(x, y, 'branco')

# ---------- casas e cidades ----------
def casa(x, y, w=7, h=5, telhado='terracota'):
    for i in range(w):
        for j in range(h):
            put(x + i, y + j, 'muro')
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
    for dx in range(-26, 27):
        for dy in range(-16, 17):
            if dx * dx * 0.4 + dy * dy <= 256:
                put(cx + dx, cy + dy, 'areia' if (dx + dy) % 2 else 'muro')
    for dx, dy in [(-22, -10), (-12, -12), (-2, -11), (10, -12), (18, -8), (-20, 0), (-8, -1), (4, -2), (16, 0), (-14, 7), (-2, 8), (10, 7)]:
        casa(cx + dx, cy + dy, rng.choice([6, 7, 8]), rng.choice([4, 5, 6]), rng.choice(['terracota', 'terracota', 'telhado']))
    igreja(cx - 2, cy - 4)
    # muralha/borda
    for dx in range(-26, 27):
        for dy in range(-16, 17):
            r = dx * dx * 0.4 + dy * dy
            if 230 <= r <= 256: put(cx + dx, cy + dy, 'estrada_e')

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

# ================= composição =================
campo()
# serras ao fundo (nordeste) e sudeste
serra(470, 120, 110, 48); serra(540, 100, 90, 40); serra(600, 150, 60, 30)
serra(20, 330, 90, 36); serra(560, 330, 80, 34)
# matas
for cx, cy, r, n in [(120, 90, 55, 70), (300, 70, 45, 50), (380, 300, 60, 80), (190, 340, 40, 36), (520, 240, 38, 34), (60, 210, 30, 22), (560, 300, 40, 30)]:
    mata(cx, cy, r, n)
# rio
rio([(0, 150), (70, 180), (150, 150), (230, 185), (310, 196), (400, 160), (470, 200), (560, 205), (640, 180)], larg=6)
rio([(330, 200), (320, 290), (280, 400)], larg=4)
# estradas de terra
estrada([(100, 250), (160, 240), (230, 230), (300, 236), (330, 212)])
estrada([(590, 60), (560, 150), (520, 220), (440, 250)])
estrada([(230, 230), (250, 320), (300, 380)])
# rodovia
rodovia([(0, 300), (120, 290), (240, 262), (330, 212), (420, 110), (500, 60)])
rodovia([(330, 212), (420, 250), (500, 262), (640, 285)])
# pontes: areia sobre o rio nos cruzamentos
# cidades
vila(130, 250, 5); vila(590, 60, 4); vila(250, 320, 6)
cidade(440, 250); cidade(120, 290)
metropole(330, 212)
# caminhões
caminhao(200, 268, 1); caminhao(470, 236, 0); caminhao(380, 150, 1)
selo(445, 222); selo(128, 272)
rotulo(300, 240, 'Campinas'); rotulo(415, 272, 'Jundiaí'); rotulo(100, 312, 'Sorocaba'); rotulo(112, 262, 'Itu')
rotulo(575, 72, 'Serra Negra'); rotulo(232, 334, 'Indaiatuba')

out = sys.argv[1]
im.save(out + '/mundo-1x.png')
im.resize((W * 2, H * 2), Image.NEAREST).save(out + '/mundo-2x.png')
print('ok')
