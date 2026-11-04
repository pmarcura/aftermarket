"""Pinta o Centro-Sul real em 16-bit com os carimbos de paint.py (importados).

Dados: Natural Earth 10m (costa, rios, lagos, serras, rodovias, estados) recortado para a caixa
do jogo, e as 59 cidades do jogo (packages/world). 1 px ≈ 1 km (escala do nível mundo em 1×).
"""
import json, math, random, sys, re
sys.argv = [sys.argv[0], '/tmp/claude-0/-home-claude/4658e4cc-7ea1-53cc-8e55-3b8a0f60fa8f/scratchpad/pixel16']
import importlib.util
spec = importlib.util.spec_from_file_location('paint', '/tmp/claude-0/-home-claude/4658e4cc-7ea1-53cc-8e55-3b8a0f60fa8f/scratchpad/pixel16/paint_lib.py')
P = importlib.util.module_from_spec(spec); spec.loader.exec_module(P)
spec2 = importlib.util.spec_from_file_location('sprites', '/tmp/claude-0/-home-claude/4658e4cc-7ea1-53cc-8e55-3b8a0f60fa8f/scratchpad/pixel16/sprites.py')
SP = importlib.util.module_from_spec(spec2); spec2.loader.exec_module(SP)
from PIL import Image, ImageDraw, ImageFont

NE = json.load(open('/tmp/claude-0/-home-claude/4658e4cc-7ea1-53cc-8e55-3b8a0f60fa8f/scratchpad/ne/centro-sul.json'))
# Caixa do mundo do jogo
LON0, LON1, LAT0, LAT1 = -53.5, -40.5, -29.5, -16.0
KM = 1.0  # px por km
W = int((LON1 - LON0) * 111.32 * math.cos(math.radians(-23)) * KM)
H = int((LAT1 - LAT0) * 110.57 * KM)
P.setup(W, H, seed=5)
proj = lambda lon, lat: ((lon - LON0) * 111.32 * math.cos(math.radians(-23)) * KM, (LAT1 - lat) * 110.57 * KM)
rng = random.Random(9)

def lines(geom):
    if geom['type'] == 'LineString': yield [proj(*c[:2]) for c in geom['coordinates']]
    elif geom['type'] == 'MultiLineString':
        for l in geom['coordinates']: yield [proj(*c[:2]) for c in l]
def polys(geom):
    if geom['type'] == 'Polygon': yield [[proj(*c[:2]) for c in r] for r in geom['coordinates']]
    elif geom['type'] == 'MultiPolygon':
        for p in geom['coordinates']: yield [[proj(*c[:2]) for c in r] for r in p]

# 1 · campo base com tufos
P.campo()
# 2 · oceano: tudo a leste/sul da costa. Usamos o polígono de terra? Não baixado recortado; a
#     costa é uma linha: pintamos o oceano como "lado direito" com flood fill a partir do canto SE.
coast = [l for f in NE['ne_10m_coastline'] for l in lines(f['geometry'])]
mask = Image.new('1', (W, H), 0)
md = ImageDraw.Draw(mask)
for l in coast: md.line(l, fill=1, width=2)
from PIL import ImageDraw as _ID
sea = Image.new('1', (W, H), 0)
# flood a partir do canto sudeste (mar) limitado pela costa
import collections
seen = mask.load(); sd = sea.load()
q = collections.deque([(W - 1, H - 1), (W - 1, int(H * 0.5))])
while q:
    x, y = q.popleft()
    if x < 0 or y < 0 or x >= W or y >= H or sd[x, y] or seen[x, y]: continue
    sd[x, y] = 1
    q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
P.oceano(sea)
# 3 · serras (polígonos das cadeias) → morros ao longo do polígono, com mata ao redor
for f in NE['ne_10m_geography_regions_polys']:
    if f['properties']['featuredla' if False else 'featurecla'] != 'Range/mtn': continue
    for rings in polys(f['geometry']):
        ring = rings[0]
        xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
        x0, x1, y0, y1 = max(0, min(xs)), min(W, max(xs)), max(0, min(ys)), min(H, max(ys))
        # amostra pontos dentro do polígono
        def inside(x, y):
            c = False; n = len(ring)
            for i in range(n):
                ax, ay = ring[i]; bx, by = ring[(i + 1) % n]
                if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay + 1e-9) + ax: c = not c
            return c
        pts = []
        tries = 0
        while len(pts) < int((x1 - x0) * (y1 - y0) / 1800) and tries < 20000:
            tries += 1
            x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
            if inside(x, y) and not sd[int(x), int(y)]: pts.append((int(x), int(y)))
        pts.sort(key=lambda p: p[1])
        for x, y in pts:
            P.mata(x, y + 10, 14, 8)
        for x, y in pts:
            P.morro(x, y, rng.choice([22, 28, 34]), rng.choice([16, 20, 24]))
# 4 · matas espalhadas (mais densas perto da costa e do sul)
for _ in range(220):
    x, y = rng.randrange(W), rng.randrange(H)
    if sd[x, y]: continue
    dens = 0.35 + 0.65 * (x / W) * 0.5 + 0.4 * (y / H)
    if rng.random() < dens: P.mata(x, y, rng.choice([18, 24, 30]), rng.choice([10, 16, 24]))
# 5 · lagos e rios
for f in NE['ne_10m_lakes']:
    for rings in polys(f['geometry']):
        P.lago(rings[0])
rios = sorted(NE['ne_10m_rivers_lake_centerlines'], key=lambda f: -(f['properties'].get('strokeweig') or 0))
for f in rios:
    w = f['properties'].get('strokeweig') or 0.5
    larg = 1 if w < 0.6 else 2 if w < 1 else 3
    for l in lines(f['geometry']):
        if len(l) > 2: P.rio(l, larg=larg, suavizar=False)
# 6 · fronteiras de estado (tracejado escuro)
for f in NE['ne_10m_admin_1_states_provinces']:
    for rings in polys(f['geometry']):
        P.fronteira(rings[0])
# 7 · rodovias
for f in NE['ne_10m_roads']:
    t = f['properties'].get('type')
    if t in ('Ferry Route', 'Ferry, seasonal', 'Track', 'Unknown'): continue
    for l in lines(f['geometry']):
        if len(l) < 2: continue
        if t in ('Major Highway', 'Beltway', 'Bypass'): P.rodovia(l, suavizar=False, larg=2)
        else: P.estrada(l, larg=2, suavizar=False)
# 8 · cidades do jogo
src = open('/home/claude/aftermarket/packages/world/src/geography-v2.ts').read()
cities = re.findall(r"c\('(\d+)', '([^']+)', '([A-Z]{2})', (-?[\d.]+), (-?[\d.]+), (\d+)\)", src)
cities = [(n, uf, float(lo), float(la), int(pop)) for _, n, uf, lo, la, pop in cities]
cities.sort(key=lambda c: c[4])
for n, uf, lo, la, pop in cities:
    x, y = proj(lo, la); x, y = int(x), int(y)
    if pop >= 2000: SP.desenhar(P.put, SP.METROPOLE, x, y)
    elif pop >= 400: SP.desenhar(P.put, SP.CIDADE, x, y, [(SP.IGREJA, 0, -3)])
    else: SP.desenhar(P.put, SP.VILA, x, y)
# Rótulos: maiores primeiro; um rótulo só entra se não cobrir outro nem uma cidade.
caixas = []
for n, uf, lo, la, pop in sorted(cities, key=lambda c: -c[4]):
    x, y = proj(lo, la); x, y = int(x), int(y)
    off = 16 if pop >= 2000 else 13 if pop >= 400 else 10
    w = int(len(n) * 6.5) + 4; h = 13
    opcoes = [(x - w // 2, y + off), (x - w // 2, y - off - h), (x + off + 4, y - 6), (x - off - 4 - w, y - 6)]
    for bx, by in opcoes:
        box = (bx - 2, by - 2, bx + w + 2, by + h + 2)
        if all(box[2] < c[0] or box[0] > c[2] or box[3] < c[1] or box[1] > c[3] for c in caixas):
            P.rotulo(bx, by, n)
            caixas.append(box)
            break
    # sprite da cidade conta como caixa para rótulos vizinhos
    r = 30 if pop >= 2000 else 22 if pop >= 400 else 12
    caixas.append((x - r, y - r // 2, x + r, y + r // 2))
P.save(sys.argv[1] + '/mundo-real')
print(W, H, len(cities))
