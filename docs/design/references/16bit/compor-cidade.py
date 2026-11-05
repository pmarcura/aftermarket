"""Monta uma cidade por regras com as peças do MODERN TOWN SET (TriariusKonstantinus).

Grade de 16 px. Malha: ruas grossas (Type 1) em avenidas, médias (Type 2) nas transversais.
Quadras: chão de grama ou asfalto com bordas (MAIN GROUND U/D/L/R/cantos), prédios por quadra
(grandes no centro, casas na borda), árvores, carros nas ruas.
"""
import os, random, sys
from PIL import Image

BASE = sys.argv[1]
OUT = sys.argv[2]
rng = random.Random(int(sys.argv[3]) if len(sys.argv) > 3 else 1)
T = 16

def img(*parts):
    return Image.open(os.path.join(BASE, *parts)).convert('RGBA')

ROADS = os.path.join('ROADS and ROAD ELEMENTS (all 16x16)')
GROUND = 'Grounds (Asphalt and grass) (all 16x16)'
def road(kind, name):
    folder = {'thick': 'Roads Type 1 (Thick)', 'medium': 'Roads Type 2 (medium)', 'thin': 'Roads Type 4 (thin)'}[kind]
    return img(ROADS, folder, name + '.png')
def ground(kind, name):
    folder = {'grass': 'Grass cover', 'asph': 'Asphalt pavement 02 (light GREY)', 'asph1': 'Asphalt pavement 01 (GREY)', 'asph3': 'Asphalt pavement 03 (Light Light GREY)'}[kind]
    return img(GROUND, folder, 'MAIN GROUND (16x16)', name + '.png')

def listar(*parts):
    p = os.path.join(BASE, *parts)
    out = []
    for root, _, fs in os.walk(p):
        for f in sorted(fs):
            if f.lower().endswith('.png'): out.append(os.path.join(root, f))
    return out

BIG = listar('Houses and Buildings', 'Buildings (all 48x48)')
HUGE = listar('Houses and Buildings', 'Buildings (all 64x64)')
MED = listar('Houses and Buildings', 'Houses (medium and big) (all 32x32)')
SMALL = listar('Houses and Buildings', 'Houses (small (all 24x24)')
TINY = listar('Houses and Buildings', 'Houses (very small (all 16x16)')
SPECIAL = listar('Houses and Buildings', 'Special buildings (all 32x32)')
TREES = listar('Trees and Bushes', 'Trees and bushes 2 (all 16x16)')
BUSH = listar('Trees and Bushes', 'Trees and bushes (all 8x8)')
CARS = listar('Cars and People', 'CARS (all 16x16)')
PARK = listar('pedestrian overpasses gates and parkings (different sizes)')

# ---- malha ----
COLS, ROWS = 44, 34
grid = [[None] * COLS for _ in range(ROWS)]  # 'thick' | 'medium' | None
avenidas_h = [5, 17, 29]
avenidas_v = [7, 21, 36]
ruas_h = [11, 23]
ruas_v = [14, 28]
for r in range(ROWS):
    for c in range(COLS):
        if r in avenidas_h or c in avenidas_v: grid[r][c] = 'thick'
        elif r in ruas_h or c in ruas_v: grid[r][c] = 'medium'

def road_tile(r, c):
    k = grid[r][c]
    U = r > 0 and grid[r - 1][c]; D = r < ROWS - 1 and grid[r + 1][c]
    L = c > 0 and grid[r][c - 1]; R = c < COLS - 1 and grid[r][c + 1]
    key = ''.join(n for n, v in (('U', U), ('D', D), ('L', L), ('R', R)) if v)
    name = {'UDLR': 'Cross', 'UD': 'Vertical', 'LR': 'Horizontal', 'UDL': 'UDL', 'UDR': 'UDR', 'ULR': 'ULR', 'DLR': 'DLR',
            'UL': 'UL', 'UR': 'UR', 'DL': 'DL', 'DR': 'DR', 'U': 'U end', 'D': 'D end', 'L': 'L end', 'R': 'R end'}.get(key, 'Cross')
    # cruzamento de médio com grosso: usa o grosso
    if k == 'medium' and (('U' in key and grid[r - 1][c] == 'thick') or ('D' in key and grid[r + 1][c] == 'thick') or ('L' in key and grid[r][c - 1] == 'thick') or ('R' in key and grid[r][c + 1] == 'thick')):
        k = 'thick'
    return road(k, name)

# ---- quadras ----
def quadras():
    """Retângulos de células não-rua."""
    seen = [[False] * COLS for _ in range(ROWS)]
    out = []
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

canvas = Image.new('RGBA', (COLS * T, ROWS * T), (0, 0, 0, 255))
def paste(im, x, y): canvas.alpha_composite(im, (x, y))

grass_fill = ground('grass', 'C1')
for r in range(ROWS):
    for c in range(COLS):
        paste(ground('grass', rng.choice(['C1', 'C2', 'C3'])), c * T, r * T)

def quadra_chao(r, c, r2, c2, kind):
    h, w = r2 - r + 1, c2 - c + 1
    for i in range(h):
        for j in range(w):
            if h == 1 and w == 1: name = 'C1'
            elif i == 0 and j == 0: name = 'UL'
            elif i == 0 and j == w - 1: name = 'UR'
            elif i == h - 1 and j == 0: name = 'DL'
            elif i == h - 1 and j == w - 1: name = 'DR'
            elif i == 0: name = rng.choice(['U1', 'U2'])
            elif i == h - 1: name = rng.choice(['D1', 'D2'])
            elif j == 0: name = rng.choice(['L1', 'L2'])
            elif j == w - 1: name = rng.choice(['R1', 'R2'])
            else: name = rng.choice(['C1', 'C2', 'C3'])
            paste(ground(kind, name), (c + j) * T, (r + i) * T)

objetos = []  # (y_base, imagem, x, y) para ordenar por profundidade
def coloca(im, x, y): objetos.append((y + im.height, im, x, y))

cx, cy = COLS * T / 2, ROWS * T / 2
for (r, c, r2, c2) in quadras():
    h, w = r2 - r + 1, c2 - c + 1
    if h < 2 or w < 2:
        continue
    dist = (((r + r2) / 2 * T - cy) ** 2 + ((c + c2) / 2 * T - cx) ** 2) ** 0.5
    centro = dist < COLS * T * 0.22
    kind = 'asph' if centro else rng.choice(['grass', 'grass', 'asph3'])
    quadra_chao(r, c, r2, c2, kind)
    x0, y0 = c * T + 3, r * T + 3
    W, H = w * T - 6, h * T - 6
    # preencher com prédios em fileiras
    y = y0
    while y < y0 + H - 16:
        x = x0
        alt = 0
        while x < x0 + W - 16:
            if centro:
                pool = rng.choice([BIG, BIG, HUGE, MED, MED, SPECIAL])
            else:
                pool = rng.choice([MED, SMALL, SMALL, TINY, MED])
            im = Image.open(rng.choice(pool)).convert('RGBA')
            if x + im.width > x0 + W or y + im.height > y0 + H:
                # tenta uma casa menor
                im = Image.open(rng.choice(TINY)).convert('RGBA')
                if x + im.width > x0 + W or y + im.height > y0 + H: break
            if rng.random() < 0.12 and not centro:
                t = Image.open(rng.choice(TREES)).convert('RGBA')
                coloca(t, x, y + 4); x += t.width + 4; continue
            coloca(im, x, y)
            alt = max(alt, im.height)
            x += im.width + rng.choice([0, 1, 2])
        y += (alt or 16) + rng.choice([1, 2, 4])
    # árvores e arbustos nas bordas da quadra
    for _ in range(int(w * h / 10)):
        t = Image.open(rng.choice(BUSH)).convert('RGBA')
        coloca(t, c * T + rng.randrange(0, w * T - 8), r * T + rng.randrange(0, h * T - 8))

for yb, im, x, y in sorted(objetos, key=lambda o: o[0]):
    paste(im, x, y)

# ruas por cima do chão (asfalto já tem borda)
for r in range(ROWS):
    for c in range(COLS):
        if grid[r][c]: paste(road_tile(r, c), c * T, r * T)
# carros nas ruas
for _ in range(60):
    r = rng.choice(avenidas_h + ruas_h) if rng.random() < 0.5 else rng.randrange(ROWS)
    c = rng.randrange(COLS) if r in avenidas_h + ruas_h else rng.choice(avenidas_v + ruas_v)
    if not grid[r][c]: continue
    car = Image.open(rng.choice(CARS)).convert('RGBA')
    paste(car, c * T, r * T)

canvas.save(OUT + '-1x.png')
canvas.resize((canvas.width * 2, canvas.height * 2), Image.NEAREST).save(OUT + '-2x.png')
print(canvas.size)
