"""Sprites de cidade v3: casas e igreja desenhadas pixel a pixel em ASCII, escala da referência
(casa ~13 px de largura), cidades maiores e mais presentes."""
LEG = {
    'k': 'contorno', 'w': 'branco', 'W': 'muro', 'r': 'terracota', 'R': 'madeira', 'L': 'alerta',
    't': 'telhado', 'T': 'serra_s', 'l': 'pedra', 'y': 'luz', 'm': 'madeira', 'g': 'areia',
    'G': 'estrada_e', 'v': 'mata_c', 'V': 'mata', 'd': 'mata_e', 'b': 'serra_s', 'B': 'serra',
    'c': 'cinza' if False else 'telhado',
}

# Casa colonial: telhado de telhas (L luz, r telha, R sombra), chaminé, parede branca, janelas, porta.
CASA_R = """
.....kk......
....kLLk.....
...kLLrrk....
..kLrrrrRk...
.kLrrrrrRRk..
kLrrrrrrRRRk.
kkkkkkkkkkkkk
.kwwwwwwwwWk.
.kwkykwkykWk.
.kwwwwwwwwWk.
.kwwwkmkwwWk.
.kwwwkmkwwWk.
.kkkkkkkkkkkk
"""
CASA_T = CASA_R.replace('L', 'l').replace('r', 't').replace('R', 'T')
CASA_P = """
....kk....
...kLLk...
..kLrrRk..
.kLrrrRRk.
kkkkkkkkkk
.kwwwwwWk.
.kwkykwWk.
.kwwkmwWk.
.kkkkkkkkk
"""
SOBRADO = """
......kk.......
.....kLLk......
....kLLrrk.....
...kLrrrrRk....
..kLrrrrrRRk...
.kLrrrrrrRRRk..
kkkkkkkkkkkkkkk
.kwwwwwwwwwwWk.
.kwkykkykkykWk.
.kwwwwwwwwwwWk.
.kwkykkykkykWk.
.kwwwwwwwwwwWk.
.kwwwwkmmkwwWk.
.kwwwwkmmkwwWk.
.kkkkkkkkkkkkkk
"""
IGREJA = """
...ky...........ky...
..kyyk.........kyyk..
...ky...........ky...
..krrk.........krrk..
..kLrk.........kLrk..
.kwwwWk.......kwwwWk.
.kwkykWk.....kwkykWk.
.kwwwwWk.....kwwwwWk.
.kwkykWkkkkkkkwkykWk.
.kwwwwWkLLLLLkwwwwWk.
.kwwwwWkLrrrrkwwwwWk.
.kwkykWkrrrrRkwkykWk.
.kwwwwWkkkkkkkwwwwWk.
.kwwwwWwwwkykwwwwwWk.
.kwwwwWwwkyykwwwwwWk.
.kwwwwWwwwwwwwwwwwWk.
.kwwwwWwwwkmkwwwwwWk.
.kwwwwWwwkmmmkwwwwWk.
.kkkkkkkkkkkkkkkkkkkk
"""
TORRE = """
.kbbbbbbk.
kbTTTTTTbk
kwkykykyWk
kwwwwwwwWk
kwkykykyWk
kwwwwwwwWk
kwkykykyWk
kwwwwwwwWk
kwkykykyWk
kwwwwwwwWk
kwkykykyWk
kwwwwwwwWk
kwkykykyWk
kwwwwwwwWk
kwkykykyWk
kwwwwwwwWk
kkkkkkkkkk
"""
TORRE_B = "\n".join(TORRE.strip('\n').split('\n')[:3] + TORRE.strip('\n').split('\n')[-8:])
ARVORE = """
..vvv..
.vvVVV.
vvVVVVV
vVVVVVV
.VVVdd.
...m...
...mk..
"""
ARV_P = """
.vVV.
vVVVV
.VVd.
..m..
"""

def blit(put, sprite, x, y):
    for j, l in enumerate(sprite.strip('\n').split('\n')):
        for i, ch in enumerate(l):
            if ch != '.': put(x + i, y + j, LEG[ch])

def caminho(put, x0, y0, x1, y1, larg=2):
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for k in range(n + 1):
        x = x0 + (x1 - x0) * k // n; y = y0 + (y1 - y0) * k // n
        for i in range(larg): put(x + i, y, LEG['G'] if (k + i) % 7 else LEG['g'])

def vila(put, cx, cy):
    caminho(put, cx - 22, cy + 6, cx + 22, cy + 6)
    blit(put, CASA_P, cx - 20, cy - 4); blit(put, CASA_R, cx - 7, cy - 8); blit(put, CASA_P, cx + 8, cy - 3)
    blit(put, ARVORE, cx + 19, cy - 6); blit(put, ARV_P, cx - 22, cy + 8)

def cidade(put, cx, cy):
    caminho(put, cx - 44, cy + 8, cx + 44, cy + 8); caminho(put, cx, cy - 26, cx, cy + 26)
    # quadra norte
    blit(put, CASA_R, cx - 42, cy - 10); blit(put, SOBRADO, cx - 27, cy - 14); blit(put, CASA_T, cx - 10, cy - 10)
    blit(put, IGREJA, cx + 4, cy - 22)
    blit(put, CASA_R, cx + 28, cy - 10); blit(put, CASA_P, cx + 42, cy - 6)
    # quadra sul
    blit(put, CASA_T, cx - 44, cy + 12); blit(put, CASA_R, cx - 29, cy + 11); blit(put, CASA_P, cx - 14, cy + 14)
    blit(put, SOBRADO, cx + 4, cy + 10); blit(put, CASA_R, cx + 22, cy + 12); blit(put, CASA_T, cx + 37, cy + 11)
    blit(put, ARVORE, cx - 6, cy + 2); blit(put, ARVORE, cx + 26, cy + 2); blit(put, ARV_P, cx - 48, cy + 4); blit(put, ARV_P, cx + 50, cy + 16)

def metropole(put, cx, cy):
    caminho(put, cx - 66, cy + 16, cx + 66, cy + 16, 3); caminho(put, cx - 30, cy - 34, cx - 30, cy + 34); caminho(put, cx + 30, cy - 34, cx + 30, cy + 34)
    # skyline de trás
    for x, sp in [(-60, TORRE_B), (-48, TORRE), (-36, TORRE_B), (-20, TORRE), (-8, TORRE), (4, TORRE), (16, TORRE_B), (36, TORRE), (48, TORRE_B), (58, TORRE_B)]:
        blit(put, sp, cx + x, cy - 34 if sp is TORRE else cy - 26)
    # igreja e casario à frente
    blit(put, IGREJA, cx - 10, cy - 14)
    for x, sp in [(-64, CASA_R), (-50, CASA_T), (-36, SOBRADO), (-20, CASA_R), (12, CASA_T), (26, SOBRADO), (42, CASA_R), (56, CASA_T)]:
        blit(put, sp, cx + x, cy + 2)
    for x, sp in [(-62, CASA_T), (-47, CASA_R), (-32, CASA_P), (-18, CASA_T), (-2, CASA_R), (14, CASA_R), (30, CASA_T), (46, SOBRADO), (62, CASA_P)]:
        blit(put, sp, cx + x, cy + 19)
    blit(put, ARVORE, cx - 70, cy + 22); blit(put, ARVORE, cx + 70, cy + 22); blit(put, ARV_P, cx + 4, cy + 20)
