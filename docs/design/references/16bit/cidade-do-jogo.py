"""Cidade do jogo a partir dos lotes reais (protótipo das regras; o jogo reimplementa em TS).

Uso: cidade-jogo.py <pasta das peças> <lotes.json> <cidade> <saida> [populacao_mil]
- Malha de quadras de tamanhos variados, avenidas grossas no centro, ruas médias.
- Cada lote do jogo ocupa uma quadra inteira, escolhida pela posição relativa do lote na
  cidade (lotes a norte ficam ao norte etc.). Prédio por categoria e tamanho; lote livre = placa.
- Quadras restantes: preenchimento por população, mais denso no centro.
"""
import os, sys, json, random, math
from PIL import Image, ImageDraw, ImageFont

BASE, LOTES, CIDADE, OUT = sys.argv[1:5]
POP = int(sys.argv[5]) if len(sys.argv) > 5 else 400
T = 16
lotes = json.load(open(LOTES))[CIDADE]
rng = random.Random(sum(ord(c) for c in CIDADE))

def img(*p): return Image.open(os.path.join(BASE, *p)).convert('RGBA')
def listar(*parts):
    out = []
    for root, _, fs in os.walk(os.path.join(BASE, *parts)):
        for f in sorted(fs):
            if f.endswith('.png'): out.append(os.path.join(root, f))
    return out
ROADS = 'ROADS and ROAD ELEMENTS (all 16x16)'
GROUND = 'Grounds (Asphalt and grass) (all 16x16)'
def road(kind, name):
    return img(ROADS, {'thick': 'Roads Type 1 (Thick)', 'medium': 'Roads Type 2 (medium)'}[kind], name + '.png')
def ground(kind, name):
    return img(GROUND, {'grass': 'Grass cover', 'asph': 'Asphalt pavement 02 (light GREY)', 'asph1': 'Asphalt pavement 01 (GREY)', 'asph3': 'Asphalt pavement 03 (Light Light GREY)'}[kind], 'MAIN GROUND (16x16)', name + '.png')
HB = 'Houses and Buildings'
BIG = listar(HB, 'Buildings (all 48x48)'); HUGE = listar(HB, 'Buildings (all 64x64)')
MED = listar(HB, 'Houses (medium and big) (all 32x32)'); SMALL = listar(HB, 'Houses (small (all 24x24)')
TINY = listar(HB, 'Houses (very small (all 16x16)'); SHOPS = listar(HB, 'Special buildings (all 32x32)')
TREES = listar('Trees and Bushes', 'Trees and bushes 2 (all 16x16)'); BUSH = listar('Trees and Bushes', 'Trees and bushes (all 8x8)')
CARS = listar('Cars and People', 'CARS (all 16x16)')
PARK = listar('pedestrian overpasses gates and parkings (different sizes)', 'Parking places')
BILL = listar('Billboards, barriers, traffic lights and road signs', 'Billboards (all 24x24)')
GREYTOWER = [p for p in MED if 'Type 6' in p]

# ---------- tamanho e malha ----------
tam = 'metropole' if POP >= 2000 else 'cidade' if POP >= 400 else 'vila'
COLS, ROWS = {'metropole': (64, 48), 'cidade': (48, 36), 'vila': (30, 22)}[tam]
def cortes(n, centro_denso=True):
    """Posições de ruas com espaçamento variado (quadras menores no centro)."""
    pos = [0]; x = 0
    while x < n - 4:
        meio = abs((x / n) - 0.5) < 0.25
        passo = rng.choice([5, 6, 7] if meio else [7, 8, 10])
        x += passo
        if x < n - 2: pos.append(x)
    pos.append(n - 1)
    return pos
ruas_h, ruas_v = cortes(ROWS), cortes(COLS)
grid = [[None] * COLS for _ in range(ROWS)]
for r in range(ROWS):
    for c in range(COLS):
        if r in ruas_h or c in ruas_v:
            thick = (r in (ruas_h[len(ruas_h) // 2],) ) or (c in (ruas_v[len(ruas_v) // 2],)) or r in (0, ROWS - 1) or c in (0, COLS - 1)
            grid[r][c] = 'thick' if thick else 'medium'
def road_tile(r, c):
    k = grid[r][c]
    U = r > 0 and grid[r - 1][c]; D = r < ROWS - 1 and grid[r + 1][c]
    L = c > 0 and grid[r][c - 1]; R = c < COLS - 1 and grid[r][c + 1]
    key = ''.join(n for n, v in (('U', U), ('D', D), ('L', L), ('R', R)) if v)
    name = {'UDLR': 'Cross', 'UD': 'Vertical', 'LR': 'Horizontal', 'UDL': 'UDL', 'UDR': 'UDR', 'ULR': 'ULR', 'DLR': 'DLR', 'UL': 'UL', 'UR': 'UR', 'DL': 'DL', 'DR': 'DR', 'U': 'U end', 'D': 'D end', 'L': 'L end', 'R': 'R end'}.get(key, 'Cross')
    if k == 'medium' and any(v == 'thick' for v in (U, D, L, R)) and key in ('UDLR', 'UDL', 'UDR', 'ULR', 'DLR'): k = 'thick'
    return road(k, name)
def quadras():
    seen = [[False] * COLS for _ in range(ROWS)]; out = []
    for r in range(ROWS):
        for c in range(COLS):
            if grid[r][c] or seen[r][c]: continue
            r2 = r
            while r2 + 1 < ROWS and not grid[r2 + 1][c]: r2 += 1
            c2 = c
            while c2 + 1 < COLS and not grid[r][c2 + 1]: c2 += 1
            for i in range(r, r2 + 1):
                for j in range(c, c2 + 1): seen[i][j] = True
            out.append((r, c, r2, c2))
    return out
Q = quadras()

# ---------- lotes do jogo → quadras ----------
lons = [l['coords'][0] for l in lotes]; lats = [l['coords'][1] for l in lotes]
clon, clat = (min(lons) + max(lons)) / 2, (min(lats) + max(lats)) / 2
span = max(max(lons) - min(lons), max(lats) - min(lats), 0.02)
def alvo(l):
    x = (l['coords'][0] - clon) / span; y = -(l['coords'][1] - clat) / span
    return (0.5 + x * 0.8) * COLS, (0.5 + y * 0.8) * ROWS
livres = list(Q); atribuicao = {}
for l in sorted(lotes, key=lambda l: -l['area']):
    tx, ty = alvo(l)
    rural = l['category'] in ('farm', 'mine')
    def custo(q):
        r, c, r2, c2 = q; cy, cx = (r + r2) / 2, (c + c2) / 2
        d = math.hypot(cx - tx, cy - ty)
        borda = min(r, c, ROWS - 1 - r2, COLS - 1 - c2)
        if rural: d += 0 if borda <= 1 else 12
        else: d += 10 if borda <= 1 else 0
        if (r2 - r + 1) * (c2 - c + 1) < 20: d += 8
        return d
    q = min(livres, key=custo); livres.remove(q); atribuicao[l['id']] = q

# ---------- desenho ----------
canvas = Image.new('RGBA', (COLS * T, ROWS * T), (0, 0, 0, 255))
def paste(im, x, y): canvas.alpha_composite(im, (x, y))
for r in range(ROWS):
    for c in range(COLS): paste(ground('grass', rng.choice(['C1', 'C2', 'C3'])), c * T, r * T)
def chao(q, kind):
    r, c, r2, c2 = q; h, w = r2 - r + 1, c2 - c + 1
    for i in range(h):
        for j in range(w):
            if i == 0 and j == 0: n = 'UL'
            elif i == 0 and j == w - 1: n = 'UR'
            elif i == h - 1 and j == 0: n = 'DL'
            elif i == h - 1 and j == w - 1: n = 'DR'
            elif i == 0: n = rng.choice(['U1', 'U2'])
            elif i == h - 1: n = rng.choice(['D1', 'D2'])
            elif j == 0: n = rng.choice(['L1', 'L2'])
            elif j == w - 1: n = rng.choice(['R1', 'R2'])
            else: n = rng.choice(['C1', 'C2', 'C3'])
            paste(ground(kind, n), (c + j) * T, (r + i) * T)
objetos = []
def coloca(path_or_im, x, y):
    im = path_or_im if isinstance(path_or_im, Image.Image) else Image.open(path_or_im).convert('RGBA')
    objetos.append((y + im.height, im, x, y))
def preencher(q, pool_fn, gap=(1, 3), margem=3, arvores=0.1):
    r, c, r2, c2 = q
    x0, y0 = c * T + margem, r * T + margem; W, H = (c2 - c + 1) * T - 2 * margem, (r2 - r + 1) * T - 2 * margem
    y = y0
    while y < y0 + H - 16:
        x = x0; alt = 0
        while x < x0 + W - 16:
            if rng.random() < arvores:
                t = Image.open(rng.choice(TREES)).convert('RGBA'); coloca(t, x, y); x += 18; alt = max(alt, 16); continue
            im = Image.open(rng.choice(pool_fn())).convert('RGBA')
            if x + im.width > x0 + W or y + im.height > y0 + H:
                im = Image.open(rng.choice(TINY)).convert('RGBA')
                if x + im.width > x0 + W or y + im.height > y0 + H: break
            coloca(im, x, y); alt = max(alt, im.height); x += im.width + rng.randint(*gap)
        y += (alt or 16) + rng.randint(*gap)
def placa(q, texto):
    r, c, r2, c2 = q
    b = Image.open(rng.choice(BILL)).convert('RGBA')
    coloca(b, (c + c2 + 1) * T // 2 - 12, (r + r2 + 1) * T // 2 - 14)
    etiquetas.append(((c + c2 + 1) * T // 2, (r + r2 + 1) * T // 2 + 14, texto))
etiquetas = []

for q in Q:
    r, c, r2, c2 = q
    lote = next((l for l in lotes if atribuicao.get(l['id']) == q), None)
    cy, cx = (r + r2) / 2 / ROWS, (c + c2) / 2 / COLS
    centro = math.hypot(cx - 0.5, cy - 0.5) < 0.22
    if lote:
        cat = lote['category']; livre = lote['owner'] is None; meu = lote['owner'] == 'player'
        if livre:
            chao(q, 'grass'); placa(q, 'À VENDA · ' + lote['name'])
            for _ in range(3): coloca(rng.choice(BUSH), c * T + rng.randrange(0, (c2 - c + 1) * T - 8), r * T + rng.randrange(0, (r2 - r + 1) * T - 8))
        elif cat == 'retail':
            chao(q, 'asph3')
            big = lote['area'] >= 50000
            coloca(rng.choice(HUGE) if big else rng.choice(SHOPS), c * T + 4, r * T + 4)
            for k in range(2): coloca(rng.choice(SHOPS), c * T + 4 + (k + 1) * 36, r * T + 4 + (18 if big else 0))
            for k in range(3): coloca(rng.choice(CARS), c * T + 6 + k * 20, r2 * T - 14)
        elif cat == 'warehouse':
            chao(q, 'asph1')
            coloca(BIG[0], c * T + 4, r * T + 4); coloca(BIG[0], c * T + 4, r * T + 4 + 46) if (r2 - r + 1) * T > 100 else None
            coloca(PARK[1] if len(PARK) > 1 else PARK[0], c * T + 56, r * T + 8)
        elif cat == 'logistics':
            chao(q, 'asph1')
            coloca(PARK[-1], c * T + 4, r * T + 4); coloca(PARK[-1], c * T + 56, r * T + 4)
            coloca(rng.choice(SMALL), c * T + 4, r2 * T - 28)
            for k in range(4): coloca(rng.choice(CARS), c * T + 10 + k * 18, r * T + 10)
        elif cat == 'industry':
            chao(q, 'asph')
            for k in range(3): coloca(rng.choice(GREYTOWER), c * T + 4 + k * 34, r * T + 4)
            coloca(PARK[0], c * T + 4, r2 * T - 36)
        elif cat == 'farm':
            chao(q, 'grass'); coloca(rng.choice(SMALL), c * T + 6, r * T + 6)
            for k in range(6): coloca(rng.choice(BUSH), c * T + 30 + (k % 3) * 14, r * T + 8 + (k // 3) * 14)
            for k in range(4): coloca(rng.choice(TREES), c * T + 6 + k * 20, r2 * T - 18)
        elif cat == 'mine':
            chao(q, 'asph1'); coloca(rng.choice(SMALL), c * T + 6, r * T + 6); coloca(PARK[0], c * T + 40, r * T + 6)
        etiquetas.append(((c + c2 + 1) * T // 2, r2 * T + 2, ('★ ' if meu else '') + lote['name']))
    else:
        dens = max(0.25, 1 - math.hypot(cx - 0.5, cy - 0.5) * 1.1) * min(1, POP / 1500 + 0.3)
        if rng.random() > dens:
            chao(q, 'grass')
            for _ in range(rng.randint(1, 4)): coloca(rng.choice(TREES), c * T + rng.randrange(0, max(1, (c2 - c + 1) * T - 16)), r * T + rng.randrange(0, max(1, (r2 - r + 1) * T - 16)))
            continue
        if centro:
            chao(q, rng.choice(['asph', 'asph3'])); preencher(q, lambda: rng.choice([BIG, HUGE, GREYTOWER, MED]), arvores=0.05)
        else:
            chao(q, rng.choice(['grass', 'grass', 'asph3'])); preencher(q, lambda: rng.choice([MED, SMALL, SMALL, TINY]), arvores=0.15)
for yb, im, x, y in sorted(objetos, key=lambda o: o[0]): paste(im, x, y)
for r in range(ROWS):
    for c in range(COLS):
        if grid[r][c]: paste(road_tile(r, c), c * T, r * T)
for _ in range(int(COLS * ROWS / 40)):
    r, c = rng.randrange(ROWS), rng.randrange(COLS)
    if grid[r][c]: paste(Image.open(rng.choice(CARS)).convert('RGBA'), c * T, r * T)

canvas.save(OUT + '-1x.png')
big = canvas.resize((canvas.width * 2, canvas.height * 2), Image.NEAREST)
d = ImageDraw.Draw(big); F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 12)
for x, y, t in etiquetas:
    w = d.textlength(t, font=F); X, Y = x * 2 - w / 2, y * 2
    d.rectangle((X - 4, Y - 1, X + w + 4, Y + 14), fill=(12, 14, 10, 200)); d.text((X, Y), t, font=F, fill=(243, 231, 204))
big.save(OUT + '-2x.png')
print(tam, COLS, ROWS, len(Q), 'quadras;', len(lotes), 'lotes')
