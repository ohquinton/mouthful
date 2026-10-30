import os, sys
OUT = sys.argv[1]

L = dict(bg='#F3F4F7', surface='#FFFFFF', ink='#14161F', muted='#5D6272', line='#DDE0E8',
         body='#2F49F5', amber='#E3A33A', soft='#E4E8FF', eye='#FFFFFF')
D = dict(bg='#0E1017', surface='#171A24', ink='#ECEEF5', muted='#9298AA', line='#2A2E3C',
         body='#3D52F0', amber='#E3A33A', soft='#232A55', eye='#FFFFFF')

DROP = 'M0,-78 C22,-46 52,-18 52,18 A52,52 0 0 1 -52,18 C-52,-18 -22,-46 0,-78 Z'

def eyes_open(c, dx=0, dy=0):
    return (f'<rect x="{-20+dx}" y="{4+dy}" width="11" height="22" rx="5.5" fill="{c["eye"]}"/>'
            f'<rect x="{9+dx}" y="{4+dy}" width="11" height="22" rx="5.5" fill="{c["eye"]}"/>')

def eyes_happy(c, y=16):
    return (f'<path d="M-22,{y} q7.5,-10 15,0" stroke="{c["eye"]}" stroke-width="5" fill="none" stroke-linecap="round"/>'
            f'<path d="M7,{y} q7.5,-10 15,0" stroke="{c["eye"]}" stroke-width="5" fill="none" stroke-linecap="round"/>')

def eyes_closed(c, y=16):
    return (f'<path d="M-22,{y} h14" stroke="{c["eye"]}" stroke-width="5" stroke-linecap="round"/>'
            f'<path d="M8,{y} h14" stroke="{c["eye"]}" stroke-width="5" stroke-linecap="round"/>')

# ---------- Concept A: Drop (an ink drop) ----------
def drop(c, state):
    s = ''
    if state == 'rest':
        s += f'<path d="{DROP}" fill="{c["body"]}"/>' + eyes_open(c)
        s += f'<ellipse cx="-22" cy="-14" rx="6" ry="10" fill="#FFFFFF" fill-opacity="0.22" transform="rotate(25 -22 -14)"/>'
    elif state == 'listen':
        for r, o in ((96, .18), (80, .32)):
            s += f'<ellipse cx="0" cy="78" rx="{r}" ry="{r*0.16}" fill="none" stroke="{c["body"]}" stroke-opacity="{o}" stroke-width="3"/>'
        s += f'<path d="{DROP}" fill="{c["body"]}"/>' + eyes_open(c, dx=4, dy=-6)
    elif state == 'steady':
        s += f'<path d="{DROP}" fill="{c["body"]}"/>' + eyes_happy(c)
        s += f'<rect x="-64" y="88" width="128" height="8" rx="4" fill="{c["amber"]}"/>'
    elif state == 'hard':  # after a rough run: same calm face, a small nod, no frown
        s += f'<g transform="rotate(-8)"><path d="{DROP}" fill="{c["body"]}"/>' + eyes_open(c, dy=4) + '</g>'
    return s

# ---------- Concept B: Bubble (a speech bubble made of the icon's word bars) ----------
def bubble(c, state):
    body = c['body']
    s = (f'<path d="M-72,-58 h144 a26,26 0 0 1 26,26 v62 a26,26 0 0 1 -26,26 h-78 l-30,26 v-26 h-36 '
         f'a26,26 0 0 1 -26,-26 v-62 a26,26 0 0 1 26,-26 z" fill="{body}"/>')
    W, F = '#FFFFFF', '#FFFFFF'
    if state == 'rest':
        s += f'<rect x="-46" y="-30" width="20" height="20" rx="10" fill="{W}"/><rect x="26" y="-30" width="20" height="20" rx="10" fill="{W}"/>'
        s += f'<rect x="-30" y="10" width="60" height="14" rx="7" fill="{F}" fill-opacity="0.35"/>'
    elif state == 'listen':
        s += f'<rect x="-46" y="-34" width="20" height="24" rx="10" fill="{W}"/><rect x="26" y="-34" width="20" height="24" rx="10" fill="{W}"/>'
        s += f'<rect x="-48" y="8" width="38" height="14" rx="7" fill="{W}"/><rect x="-2" y="8" width="50" height="14" rx="7" fill="{F}" fill-opacity="0.35"/>'
    elif state == 'steady':
        s += (f'<path d="M-48,-18 q11,-14 22,0" stroke="{W}" stroke-width="6" fill="none" stroke-linecap="round"/>'
              f'<path d="M26,-18 q11,-14 22,0" stroke="{W}" stroke-width="6" fill="none" stroke-linecap="round"/>')
        s += f'<rect x="-48" y="6" width="96" height="20" rx="10" fill="{c["amber"]}"/>'
    elif state == 'hard':
        s += f'<rect x="-46" y="-26" width="20" height="16" rx="8" fill="{W}"/><rect x="26" y="-26" width="20" height="16" rx="8" fill="{W}"/>'
        s += f'<rect x="-30" y="10" width="60" height="14" rx="7" fill="{W}"/>'
    return s

# ---------- Concept C: Pebble (a breathing stone for timers and pauses) ----------
def pebble(c, state):
    P = 'M-70,10 C-70,-40 -30,-62 6,-62 C46,-62 72,-34 72,6 C72,46 40,62 0,62 C-44,62 -70,46 -70,10 Z'
    s = ''
    if state == 'rest':
        s += f'<path d="{P}" fill="{c["body"]}"/>' + eyes_open(c, dy=-8)
    elif state == 'listen':  # breathing in: ring = One Minute timer
        s += f'<circle r="100" fill="none" stroke="{c["line"]}" stroke-width="8"/>'
        s += f'<circle r="100" fill="none" stroke="{c["amber"]}" stroke-width="8" stroke-linecap="round" stroke-dasharray="{2*3.1416*100*0.62} 999" transform="rotate(-90)"/>'
        s += f'<g transform="scale(1.06)"><path d="{P}" fill="{c["body"]}"/>' + eyes_open(c, dy=-8) + '</g>'
    elif state == 'steady':
        s += f'<path d="{P}" fill="{c["body"]}"/>' + eyes_happy(c, y=4)
        s += f'<circle cx="54" cy="-58" r="10" fill="{c["amber"]}"/>'
    elif state == 'hard':  # paused: eyes closed, resting, waiting for you
        s += f'<g transform="scale(1,0.94) translate(0,6)"><path d="{P}" fill="{c["body"]}"/>' + eyes_closed(c, y=4) + '</g>'
    return s

CONCEPTS = [
    ('a-drop', 'Drop', 'An ink drop. It is the ink that fills your words.', drop,
     [('rest', 'Resting'), ('listen', 'Listening (onboarding, mic)'), ('steady', 'Steadier than last time'), ('hard', 'After a hard run: a nod, no frown')]),
    ('b-bubble', 'Bubble', 'A speech bubble built from the icon’s word bars.', bubble,
     [('rest', 'Resting'), ('listen', 'Words inking in (Tape)'), ('steady', 'Finished'), ('hard', 'Too short: ready again')]),
    ('c-pebble', 'Pebble', 'A smooth stone that breathes. For waiting and timing.', pebble,
     [('rest', 'Resting'), ('listen', 'One Minute ring'), ('steady', 'Day done (heat strip)'), ('hard', 'Paused card')]),
]

def panel(c, fn, states, label):
    cells = ''
    for i, (st, cap) in enumerate(states):
        x = 150 + i * 260
        cells += f'<g transform="translate({x},150)">{fn(c, st)}</g>'
        cells += f'<text x="{x}" y="285" text-anchor="middle" font-size="15" fill="{c["muted"]}">{cap}</text>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="320" viewBox="0 0 1100 320">'
            f'<rect width="1100" height="320" fill="{c["bg"]}"/>'
            f'<text x="24" y="34" font-size="14" fill="{c["muted"]}">{label}</text>{cells}</svg>')

for key, name, blurb, fn, states in CONCEPTS:
    for mode, c in (('light', L), ('dark', D)):
        svg = panel(c, fn, states, f'{name} · {mode}')
        open(os.path.join(OUT, f'mascot-{key}-{mode}.svg'), 'w', encoding='utf-8').write(svg)
    html = (f'<!doctype html><meta charset="utf-8"><style>body{{margin:0;font-family:-apple-system,Segoe UI,sans-serif;background:#F3F4F7}}'
            f'h1{{font:700 26px Segoe UI;margin:0;padding:20px 24px 2px;color:#14161F}}p{{margin:0;padding:0 24px 12px;color:#5D6272;font-size:15px}}img{{display:block}}</style>'
            f'<h1>{name}</h1><p>{blurb}</p><img src="mascot-{key}-light.svg"><img src="mascot-{key}-dark.svg">')
    open(os.path.join(OUT, f'mascot-{key}.html'), 'w', encoding='utf-8').write(html)
print('ok')
