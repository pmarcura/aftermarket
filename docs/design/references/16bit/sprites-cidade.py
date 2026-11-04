"""Sprites de cidade, segunda versão: maiores, montados por peças (casa, igreja, torre, árvore)
posicionadas à mão, com acabamento de pixel art (luz no telhado, sombra na base, contorno)."""

COR = dict(chao='areia', chao_e='estrada_e', rua='estrada_e', borda='contorno', muro='muro',
           parede='branco', parede_s='muro', telha='terracota', telha_l='alerta', telha_e='madeira',
           cinza='telhado', cinza_l='pedra', cinza_e='serra_s', janela='luz', arv='mata_c',
           arv_e='mata', tronco='madeira', torre='branco', torre_s='muro', azul='serra_s')

def casa(put, x, y, w=7, h=5, telha=('telha', 'telha_l', 'telha_e'), dir=1):
    """Casa vista de frente/cima: telhado em duas águas com luz, parede clara, porta e janela."""
    t, tl, te = telha
    th = 3
    for j in range(th):
        for i in range(-1 + j, w + 1 - j):
            put(x + i, y - th + j, COR[tl] if j == 0 else COR[t] if i < w // 2 + 1 else COR[te])
    for i in range(w): put(x + i, y - th - 1, COR['borda'])
    for j in range(h):
        for i in range(w):
            put(x + i, y + j, COR['parede'] if i < w - 1 else COR['parede_s'])
    put(x + 1, y + 1, COR['janela']); put(x + w - 3, y + 1, COR['janela'])
    put(x + w // 2, y + h - 1, COR['tronco']); put(x + w // 2, y + h - 2, COR['tronco'])
    for i in range(-1, w + 1): put(x + i, y + h, COR['borda'])
    put(x + w, y + h - 1, COR['borda']); put(x - 1, y + h - 1, COR['parede_s'])

def igreja(put, x, y):
    """Igreja colonial de duas torres com frontão e porta em arco (14 × 16)."""
    for tx in (x, x + 10):
        for j in range(10):
            for i in range(4): put(tx + i, y - 4 - j, COR['torre'] if i < 3 else COR['torre_s'])
        for i in range(-1, 5): put(tx + i, y - 14, COR['borda'])
        put(tx + 1, y - 15, COR['telha']); put(tx + 2, y - 15, COR['telha']); put(tx + 1, y - 16, COR['borda']); put(tx + 2, y - 16, COR['borda'])
        put(tx + 1, y - 10, COR['janela']); put(tx + 1, y - 7, COR['janela'])
    for j in range(8):
        for i in range(4, 10): put(x + i, y - j, COR['torre'])
    for i in range(3, 11): put(x + i, y - 8, COR['telha_l']); put(x + i, y - 9, COR['borda'])
    put(x + 6, y - 10, COR['borda']); put(x + 7, y - 10, COR['borda']); put(x + 6, y - 11, COR['janela'])
    put(x + 6, y - 1, COR['tronco']); put(x + 7, y - 1, COR['tronco']); put(x + 6, y - 2, COR['tronco']); put(x + 7, y - 2, COR['tronco']); put(x + 6, y - 3, COR['borda']); put(x + 7, y - 3, COR['borda'])
    for i in range(-1, 15): put(x + i, y + 1, COR['borda'])

def torre(put, x, y, w, h, cor=('torre', 'torre_s')):
    for j in range(h):
        for i in range(w):
            c = COR[cor[0]] if i < w - 1 else COR[cor[1]]
            if i % 2 == 0 and j % 2 == 1 and i < w - 1: c = COR['janela'] if (i + j) % 3 else COR['azul']
            put(x + i, y - j, c)
    for i in range(-1, w + 1): put(x + i, y - h, COR['borda'])
    for i in range(w): put(x + i, y - h - 1, COR['cinza_e'] if i % 3 else COR['borda'])
    put(x + w, y - 1, COR['borda'])
    for i in range(-1, w + 1): put(x + i, y + 1, COR['borda'])

def arvore(put, x, y, r=3):
    for j in range(-r, r + 1):
        for i in range(-r, r + 1):
            if i * i + j * j <= r * r:
                put(x + i, y + j, COR['arv'] if (i < 0 and j < 0) or (i + j) % 3 == 0 else COR['arv_e'])
    put(x, y + r + 1, COR['tronco']); put(x + 1, y + r + 1, COR['borda'])

def chao(put, cx, cy, rx, ry, muro=True):
    for dy in range(-ry - 1, ry + 2):
        for dx in range(-rx - 1, rx + 2):
            q = (dx / rx) ** 2 + (dy / ry) ** 2
            if q <= 1.0:
                c = COR['chao'] if (dx * 3 + dy * 7) % 11 else COR['chao_e']
                put(cx + dx, cy + dy, c)
            elif q <= 1.12 and muro:
                put(cx + dx, cy + dy, COR['muro'] if dy < ry * 0.6 else COR['borda'])
            elif q <= 1.2 and muro and dy > 0:
                put(cx + dx, cy + dy, COR['borda'])

def rua(put, x0, y0, x1, y1):
    n = max(abs(x1 - x0), abs(y1 - y0))
    for k in range(n + 1):
        x = x0 + (x1 - x0) * k // n; y = y0 + (y1 - y0) * k // n
        put(x, y, COR['rua']); put(x + 1, y, COR['rua'])

def vila(put, cx, cy):
    chao(put, cx, cy, 14, 8, muro=False)
    rua(put, cx - 14, cy + 2, cx + 14, cy + 2)
    casa(put, cx - 11, cy - 4, 6, 4); casa(put, cx - 2, cy - 5, 7, 5); casa(put, cx + 6, cy - 3, 6, 4, ('cinza', 'cinza_l', 'cinza_e'))
    arvore(put, cx + 13, cy - 6, 3); arvore(put, cx - 14, cy + 7, 2)

def cidade(put, cx, cy):
    chao(put, cx, cy, 30, 17)
    rua(put, cx - 30, cy + 3, cx + 30, cy + 3); rua(put, cx, cy - 16, cx, cy + 16)
    # fileira de cima
    casa(put, cx - 26, cy - 9, 6, 4); casa(put, cx - 18, cy - 10, 7, 5); casa(put, cx - 9, cy - 9, 6, 4, ('cinza', 'cinza_l', 'cinza_e'))
    igreja(put, cx + 2, cy - 2)
    casa(put, cx + 18, cy - 10, 7, 5); casa(put, cx + 26, cy - 8, 5, 4)
    # fileira de baixo
    casa(put, cx - 24, cy + 7, 7, 5, ('cinza', 'cinza_l', 'cinza_e')); casa(put, cx - 14, cy + 8, 6, 4); casa(put, cx - 6, cy + 7, 5, 4)
    casa(put, cx + 4, cy + 8, 7, 5); casa(put, cx + 13, cy + 7, 6, 4, ('cinza', 'cinza_l', 'cinza_e')); casa(put, cx + 22, cy + 8, 6, 4)
    arvore(put, cx - 4, cy - 1, 2); arvore(put, cx + 20, cy - 1, 2); arvore(put, cx - 29, cy + 1, 2); arvore(put, cx + 29, cy + 10, 2)

def metropole(put, cx, cy):
    chao(put, cx, cy, 46, 24)
    rua(put, cx - 46, cy + 6, cx + 46, cy + 6); rua(put, cx - 20, cy - 23, cx - 20, cy + 23); rua(put, cx + 20, cy - 23, cx + 20, cy + 23)
    # skyline (fundo → frente)
    for x, h, w in [(-40, 10, 5), (-33, 16, 6), (-26, 12, 5), (-15, 20, 7), (-7, 26, 8), (2, 18, 6), (9, 22, 7), (24, 14, 6), (31, 18, 6), (38, 9, 5)]:
        torre(put, cx + x, cy - 2, w, h)
    # casario na frente
    for x, w, h, t in [(-42, 6, 4, 'telha'), (-34, 7, 5, 'cinza'), (-26, 6, 4, 'telha'), (-14, 7, 5, 'telha'), (-6, 6, 4, 'cinza'), (2, 7, 5, 'telha'), (12, 6, 4, 'telha'), (26, 7, 5, 'cinza'), (35, 6, 4, 'telha')]:
        casa(put, cx + x, cy + 11, w, h, ('cinza', 'cinza_l', 'cinza_e') if t == 'cinza' else ('telha', 'telha_l', 'telha_e'))
    igreja(put, cx + 14, cy + 4)
    arvore(put, cx - 44, cy + 14, 2); arvore(put, cx + 44, cy + 14, 2); arvore(put, cx + 20, cy + 16, 2); arvore(put, cx - 20, cy + 16, 2)
