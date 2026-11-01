# Remodel mockups (docs/briefs/remodel-screens.md): static HTML/CSS + inline SVG, screenshotted with
# Python Playwright at a 390x844 viewport (@2x). Run from anywhere:  python docs/design/remodel/src/gen.py
# Fonts come from node_modules/@expo-google-fonts (found by walking up from this file) and are copied into
# src/fonts/, which is git-ignored.
import os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)  # docs/design/remodel

# ---------------------------------------------------------------- tokens
# Existing theme.ts values, plus the proposed line tokens (marked NEW).
LIGHT = dict(bg='#F3F4F7', surface='#FFFFFF', ink='#14161F', muted='#5D6272', unread='#A5AAB8', line='#DDE0E8',
             signal='#2F49F5', button='#2F49F5', signalSoft='#E4E8FF', good='#12936B', ember='#C27A00',
             stumble='#D23B3B', card='#14161F', cardInk='#F3F4F7', cardMuted='#9298AA',
             # NEW: one colour per train line, a soft tint for the track ahead and chip fills, and the colour
             # drawn on top of a filled line colour (the check in a done stop).
             sharp='#C2185B', sharpSoft='#F2C9D9', clear='#00788A', clearSoft='#C4E3E7', onLine='#FFFFFF',
             dropEye='#FFFFFF')
DARK = dict(bg='#0E1017', surface='#171A24', ink='#ECEEF5', muted='#9298AA', unread='#5A6072', line='#2A2E3C',
            signal='#7B8CFF', button='#3D52F0', signalSoft='#232A55', good='#3CC79A', ember='#E3A33A',
            stumble='#FF6B6B', card='#1E2230', cardInk='#ECEEF5', cardMuted='#9298AA',
            sharp='#F06292', sharpSoft='#4A2235', clear='#3BB8C4', clearSoft='#173C43', onLine='#0E1017',
            dropEye='#FFFFFF')

# ---------------------------------------------------------------- fonts
FONT_FILES = [('literata/500Medium', 'Literata_500Medium.ttf'), ('literata/700Bold', 'Literata_700Bold.ttf'),
              ('bricolage-grotesque/700Bold', 'BricolageGrotesque_700Bold.ttf'),
              ('bricolage-grotesque/800ExtraBold', 'BricolageGrotesque_800ExtraBold.ttf')]

def ensure_fonts():
    dst = os.path.join(HERE, 'fonts')
    os.makedirs(dst, exist_ok=True)
    d = HERE
    while True:
        base = os.path.join(d, 'node_modules', '@expo-google-fonts')
        if os.path.isdir(base):
            break
        nd = os.path.dirname(d)
        if nd == d:
            sys.exit('node_modules/@expo-google-fonts not found above ' + HERE)
        d = nd
    for sub, f in FONT_FILES:
        if not os.path.exists(os.path.join(dst, f)):
            shutil.copy(os.path.join(base, sub, f), os.path.join(dst, f))

# ---------------------------------------------------------------- css
def css(t):
    v = ';'.join(f'--{k}:{c}' for k, c in t.items())
    return f"""
@font-face{{font-family:Literata;font-weight:500;src:url('fonts/Literata_500Medium.ttf')}}
@font-face{{font-family:Literata;font-weight:700;src:url('fonts/Literata_700Bold.ttf')}}
@font-face{{font-family:Bricolage;font-weight:700;src:url('fonts/BricolageGrotesque_700Bold.ttf')}}
@font-face{{font-family:Bricolage;font-weight:800;src:url('fonts/BricolageGrotesque_800ExtraBold.ttf')}}
:root{{{v}}}
*{{box-sizing:border-box;margin:0;padding:0}}
html,body{{width:390px;height:844px;overflow:hidden;background:var(--bg)}}
.scr{{width:390px;height:844px;background:var(--bg);color:var(--ink);font-family:-apple-system,'SF Pro Text','Segoe UI',system-ui,sans-serif;
  position:relative;overflow:hidden;display:flex;flex-direction:column;-webkit-font-smoothing:antialiased}}
.sb{{height:54px;display:flex;justify-content:space-between;align-items:center;padding:0 30px 0 36px;font-size:16px;font-weight:600;flex:none}}
.island{{position:absolute;top:11px;left:50%;margin-left:-62px;width:124px;height:36px;border-radius:20px;background:#000}}
.homebar{{position:absolute;bottom:8px;left:50%;margin-left:-67px;width:134px;height:5px;border-radius:3px;background:var(--ink);opacity:.85;z-index:9}}
.pad{{padding:0 24px;flex:1;display:flex;flex-direction:column;gap:20px;padding-bottom:42px;min-height:0}}
.top{{display:flex;align-items:center;height:44px;position:relative;flex:none}}
.dots{{position:absolute;left:0;right:0;display:flex;gap:6px;justify-content:center;pointer-events:none}}
.dot{{width:24px;height:4px;border-radius:2px;background:var(--line)}} .dot.on{{background:var(--ink)}}
.back{{width:44px;height:44px;display:flex;align-items:center;margin-left:-10px}}
.grow{{flex:1}}
.brand{{font-family:Bricolage;font-weight:800;font-size:22px;letter-spacing:-.3px}}
.hook{{font-family:Literata;font-weight:700;font-size:34px;line-height:46px}}
.h1{{font-family:Bricolage;font-weight:700;font-size:28px;line-height:34px;letter-spacing:-.2px}}
.h2{{font-size:20px;font-weight:700}}
.lead{{font-size:17px;line-height:25px;color:var(--muted)}}
.body{{font-size:17px;line-height:25px}}
.small{{font-size:13px;line-height:18px;color:var(--muted)}}
.center{{text-align:center}}
.btn{{height:54px;border-radius:14px;background:var(--button);color:#fff;font-size:17px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;flex:none}}
.btn2{{height:50px;border-radius:14px;border:1.5px solid var(--line);background:var(--surface);color:var(--ink);font-size:17px;font-weight:600;display:flex;align-items:center;justify-content:center;flex:none}}
.link{{text-align:center;font-size:15px;font-weight:600;color:var(--muted);height:44px;line-height:44px;flex:none}}
.eyebrow{{font-size:12px;font-weight:700;letter-spacing:1.1px;color:var(--muted)}}
.box{{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px 16px;display:flex;gap:12px;align-items:center}}
.sw{{width:51px;height:31px;border-radius:16px;background:var(--line);position:relative;flex:none}}
.sw::after{{content:'';position:absolute;top:2px;left:2px;width:27px;height:27px;border-radius:50%;background:#fff}}
.note{{display:flex;gap:10px;align-items:flex-start;font-size:15px;line-height:21px;color:var(--muted)}}
.chips{{display:flex;flex-wrap:wrap;gap:8px}}
.chip{{border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:0 15px;height:44px;line-height:42px;font-size:15px;font-weight:500}}
.chip.on{{border:1.5px solid var(--signal);background:var(--signalSoft)}}
.num{{font-family:Bricolage;font-weight:800;font-variant-numeric:tabular-nums}}
.tab{{position:absolute;left:0;right:0;bottom:0;height:83px;border-top:1px solid var(--line);background:var(--surface);display:flex;padding:7px 8px 0;z-index:5}}
.tab div{{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10px;font-weight:600;color:var(--muted)}}
.tab div.on{{color:var(--signal)}}
.tile{{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:11px 13px 12px;display:flex;flex-direction:column;gap:1px;min-width:0}}
.tile.c{{padding:8px 12px 9px}}
.tl{{font-size:13px;font-weight:500;color:var(--muted)}}
.tv{{font-size:26px;font-weight:600;font-variant-numeric:tabular-nums;line-height:32px;white-space:nowrap}}
.tv small{{font-size:13px;font-weight:400;color:var(--muted)}}
.tn{{font-size:13px;line-height:17px;color:var(--muted)}}
.say{{font-family:Literata;font-weight:700}}
.gtop{{display:flex;align-items:center;gap:14px;padding:0 24px;height:48px;font-size:15px;font-weight:600;color:var(--muted);flex:none}}
.track{{height:4px;background:var(--line);margin:0 24px;flex:none;border-radius:2px}} .fill{{height:4px;background:var(--signal);border-radius:2px}}
.foot{{position:absolute;left:0;right:0;bottom:0;height:128px;padding:0 24px 34px;display:flex;align-items:center;gap:14px;background:var(--bg);border-top:1px solid var(--line)}}
.bars{{min-width:0;overflow:hidden;display:flex;gap:3px;align-items:center;height:36px;flex:1}}
.bar{{width:4px;border-radius:2px;background:var(--signal);opacity:.55;flex:none}}
.seg{{display:flex;background:var(--line);border-radius:14px;padding:3px;gap:3px;flex:none}}
.seg div{{flex:1;height:42px;border-radius:11px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:16px;font-weight:600;color:var(--muted)}}
.seg div.on{{background:var(--surface);color:var(--ink)}}
.ldot{{width:12px;height:12px;border-radius:6px;flex:none}}
"""

# ---------------------------------------------------------------- icons (stroke = currentColor)
def ico(name, size=22, color='var(--ink)', sw=2):
    p = {
        'back': '<path d="M15 5l-7 7 7 7"/>',
        'x': '<path d="M6 6l12 12M18 6L6 18"/>',
        'mic': '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
        'micoff': '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M4 4l16 16"/>',
        'phone': '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
        'talk': '<path d="M4 5.5h16v10.5H10l-5 4v-4H4z"/><path d="M8.5 10.5h7"/>',
        'book': '<path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v14"/>',
        'eye': '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
        'glide': '<path d="M4 7h16M4 12h10M4 17h13"/><path d="M17.5 10v4"/>',
        'check': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
        'chev': '<path d="M9 5l7 7-7 7"/>',
        'chevd': '<path d="M6 9l6 6 6-6"/>',
        'map': '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6H13a4 4 0 0 1 0 8h-2a4 4 0 0 0 0 8"/><path d="M15.5 18H11"/>',
        'library': '<path d="M5 4v16M10 4v16"/><path d="M14.5 4.5l4.5 15"/>',
        'chart': '<path d="M5 20V11M12 20V5M19 20v-6"/>',
        'user': '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>',
        'clock': '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
        'speaker': '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
        'cal': '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/>',
        'up': '<path d="M12 19V5M6 11l6-6 6 6"/>',
        'down': '<path d="M12 5v14M6 13l6 6 6-6"/>',
        'swap': '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
    }[name]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" style="color:{color};flex:none;display:block">{p}</svg>')

KIND_ICON = {'talk': 'talk', 'pack': 'book', 'cold': 'eye', 'glide': 'glide'}

# ---------------------------------------------------------------- the Drop (flat: body + two eyes, no mouth, no shine)
DROP_PATH = 'M0,-78 C22,-46 52,-18 52,18 A52,52 0 0 1 -52,18 C-52,-18 -22,-46 0,-78 Z'

def drop_g(state='rest', body='var(--button)', eye='var(--dropEye)'):
    if state == 'happy':
        eyes = (f'<path d="M-23,14 q7.5,-11 15,0" stroke="{eye}" stroke-width="6" fill="none" stroke-linecap="round"/>'
                f'<path d="M8,14 q7.5,-11 15,0" stroke="{eye}" stroke-width="6" fill="none" stroke-linecap="round"/>')
    else:
        dx, dy = {'rest': (0, 0), 'up': (2, -9), 'right': (6, -2), 'left': (-6, -2), 'down': (-3, 6)}[state]
        eyes = (f'<rect x="{-20 + dx}" y="{4 + dy}" width="11" height="22" rx="5.5" fill="{eye}"/>'
                f'<rect x="{9 + dx}" y="{4 + dy}" width="11" height="22" rx="5.5" fill="{eye}"/>')
    return f'<path d="{DROP_PATH}" fill="{body}"/>{eyes}'

def drop_svg(h=80, state='rest', tilt=0, body='var(--button)'):
    w = h * 112 / 156
    t = f' transform="rotate({tilt})"' if tilt else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w:.1f}" height="{h}" viewBox="-56 -82 112 156" style="display:block;flex:none;overflow:visible">'
            f'<g{t}>{drop_g(state, body)}</g></svg>')

# ---------------------------------------------------------------- chrome
def status_bar(time='9:41'):
    return (f'<div class="sb"><span>{time}</span><span style="display:flex;gap:6px;align-items:center">'
            '<svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor"/>'
            '<rect x="5" y="5" width="3" height="7" rx="1" fill="currentColor"/><rect x="10" y="2" width="3" height="10" rx="1" fill="currentColor"/>'
            '<rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor"/></svg>'
            '<svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/>'
            '<rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor"/><rect x="24.5" y="4" width="2" height="5" rx="1" fill="currentColor" opacity=".4"/></svg>'
            '</span></div><div class="island"></div>')

def obar(n_on, total=4, back=True):
    b = f'<div class="back">{ico("back", 26, "var(--ink)", 2.2)}</div>' if back else ''
    d = '<div class="dots">' + ''.join(f'<div class="dot{" on" if i == n_on else ""}"></div>' for i in range(total)) + '</div>'
    return f'<div class="top">{b}{d}</div>'

def tabbar(active='Home'):
    items = [('Home', 'map'), ('Library', 'library'), ('Progress', 'chart'), ('You', 'user')]
    return '<div class="tab">' + ''.join(
        f'<div class="{"on" if n == active else ""}">{ico(i, 25, "currentColor", 2 if n == active else 1.7)}{n}</div>' for n, i in items) + '</div>'

HOME = '<div class="homebar"></div>'

def ribbon(heights):
    return '<div class="bars">' + ''.join(f'<div class="bar" style="height:{h}px"></div>' for h in heights) + '</div>'

RIB = [6, 10, 18, 26, 14, 8, 20, 30, 16, 10, 6, 12, 22, 32, 18, 9, 14, 24, 12, 7, 5, 9, 16, 22, 12, 6, 10, 18, 8, 5, 4, 4, 4, 4, 4, 4]
RIB_QUIET = [4] * 36

# ---------------------------------------------------------------- the map
def stop_node(x, y, kind, state, col, soft, big=False):
    """A stop on the line. done: filled with a check. current: big ring with the kind icon. ahead: white with a soft ring."""
    if state == 'done':
        r = 15
        return (f'<circle cx="{x}" cy="{y}" r="{r}" fill="var(--{col})"/>'
                f'<g transform="translate({x - 9},{y - 9})"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--onLine)" '
                f'stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></g>')
    if state == 'current':
        r = 30
        return (f'<circle cx="{x}" cy="{y}" r="{r}" fill="var(--surface)" stroke="var(--{col})" stroke-width="7"/>'
                f'<g transform="translate({x - 13},{y - 13})"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--{col})" '
                f'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">{ICON_INNER[KIND_ICON[kind]]}</svg></g>')
    r = 19
    return (f'<circle cx="{x}" cy="{y}" r="{r}" fill="var(--surface)" stroke="var(--{soft})" stroke-width="5"/>'
            f'<g transform="translate({x - 10},{y - 10})"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" '
            f'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{ICON_INNER[KIND_ICON[kind]]}</svg></g>')

ICON_INNER = {
    'talk': '<path d="M4 5.5h16v10.5H10l-5 4v-4H4z"/><path d="M8.5 10.5h7"/>',
    'book': '<path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v14"/>',
    'eye': '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    'glide': '<path d="M4 7h16M4 12h10M4 17h13"/><path d="M17.5 10v4"/>',
}

def label(x, y, title, sub, anchor='start', strong=True, sub_col='var(--muted)'):
    tc = 'var(--ink)' if strong else 'var(--muted)'
    return (f'<text x="{x}" y="{y - 3}" text-anchor="{anchor}" font-size="15" font-weight="600" fill="{tc}">{title}</text>'
            f'<text x="{x}" y="{y + 15}" text-anchor="{anchor}" font-size="13" fill="{sub_col}">{sub}</text>')

def home_map(col, soft, stops, h=448, drop_at=None, extra=''):
    """stops: list of (x, y, kind, state, title, sub, label_side). Path drawn through stops with smooth bends.
    The part up to the current stop is solid line colour; the part after is the soft tint."""
    pts = [(s[0], s[1]) for s in stops]
    cur = next((i for i, s in enumerate(stops) if s[3] == 'current'), len(stops) - 1)

    def seg(a, b):
        (x1, y1), (x2, y2) = a, b
        if x1 == x2:
            return f'M{x1},{y1} L{x2},{y2}'
        my = (y1 + y2) / 2
        return f'M{x1},{y1} C{x1},{my} {x2},{my} {x2},{y2}'
    done_d = ' '.join(seg(pts[i], pts[i + 1]) for i in range(cur))
    ahead_d = ' '.join(seg(pts[i], pts[i + 1]) for i in range(cur, len(pts) - 1))
    lead_in = f'M{pts[0][0]},-20 L{pts[0][0]},{pts[0][1]}' if stops[0][3] != 'station' else ''
    tail = f'M{pts[-1][0]},{pts[-1][1]} L{pts[-1][0]},{h + 20}'
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="390" height="{h}" viewBox="0 0 390 {h}" style="display:block;font-family:-apple-system,Segoe UI,system-ui,sans-serif;overflow:hidden">']
    svg.append(extra)
    first_state = stops[0][3]
    lead_col = col if first_state in ('done', 'current', 'station') else soft
    if lead_in:
        svg.append(f'<path d="{lead_in}" stroke="var(--{lead_col})" stroke-width="10" fill="none" stroke-linecap="round"/>')
    svg.append(f'<path d="{ahead_d} {tail}" stroke="var(--{soft})" stroke-width="10" fill="none" stroke-linecap="round"/>')
    if done_d:
        svg.append(f'<path d="{done_d}" stroke="var(--{col})" stroke-width="10" fill="none" stroke-linecap="round"/>')
    for (x, y, kind, state, title, sub, side) in stops:
        if state == 'station':
            continue
        svg.append(stop_node(x, y, kind, state, col, soft))
        if title:
            off = 30 if state != 'current' else 46
            lx = x + off if side == 'r' else x - off
            svg.append(label(lx, y, title, sub, 'start' if side == 'r' else 'end', strong=state != 'ahead'))
    if drop_at:
        dx, dy, st = drop_at
        svg.append(f'<g transform="translate({dx},{dy}) scale(0.42)">{drop_g(st)}</g>')
    svg.append('</svg>')
    return ''.join(svg)

def today_card(eyebrow, title, sub, left=140, top=0, width=226):
    return (f'<div style="position:absolute;left:{left}px;top:{top}px;width:{width}px;background:var(--surface);border:1px solid var(--line);'
            f'border-radius:16px;padding:12px 14px 13px">'
            f'<div class="eyebrow" style="font-size:11px">{eyebrow}</div>'
            f'<div style="font-size:16px;font-weight:600;margin-top:4px;line-height:21px">{title}</div>'
            f'<div class="small" style="margin-top:3px">{sub}</div></div>')

def week_strip(done=6, today=6):
    days = 'MTWTFSS'
    out = []
    for i, d in enumerate(days):
        if i < done:
            c = '<div style="width:20px;height:20px;border-radius:10px;background:var(--ink);display:flex;align-items:center;justify-content:center">' + ico('check', 12, 'var(--bg)', 3.4) + '</div>'
        elif i == today:
            c = '<div style="width:20px;height:20px;border-radius:10px;border:2px solid var(--ink)"></div>'
        else:
            c = '<div style="width:20px;height:20px;border-radius:10px;border:1.5px solid var(--line)"></div>'
        out.append(f'<div style="display:flex;flex-direction:column;align-items:center;gap:3px">{c}<span style="font-size:10px;font-weight:600;color:var(--muted)">{d}</span></div>')
    return '<div style="display:flex;gap:5px">' + ''.join(out) + '</div>'

def home_header(date, streak_text, done, today, line='sharp'):
    on_s = ' class="on"' if line == 'sharp' else ''
    on_c = ' class="on"' if line == 'clear' else ''
    return f'''<div style="padding:4px 24px 0;display:flex;align-items:flex-end;justify-content:space-between;flex:none">
<div><div style="font-size:15px;color:var(--muted)">{date}</div>
<div style="font-family:Bricolage;font-weight:700;font-size:21px;margin-top:2px;white-space:nowrap">{streak_text}</div></div>
{week_strip(done, today)}</div>
<div style="padding:16px 24px 0;flex:none"><div class="seg">
<div{on_s}><span class="ldot" style="background:var(--sharp)"></span>Sharp Talk</div>
<div{on_c}><span class="ldot" style="background:var(--clear)"></span>Clear English</div></div></div>'''

def home_bottom(btn, sub_link=True, btn_class='btn'):
    link = (f'<div style="display:flex;align-items:center;justify-content:center;gap:6px;height:40px;font-size:15px;color:var(--muted);margin-top:6px">'
            f'{ico("cal", 17, "var(--muted)", 1.8)}<span>Got something coming up?</span>'
            f'<span style="font-weight:600;color:var(--ink)">Plan for it</span>{ico("chev", 15, "var(--ink)", 2.2)}</div>') if sub_link else ''
    return (f'<div style="position:absolute;left:0;right:0;bottom:83px;padding:12px 24px 4px;background:var(--bg);border-top:1px solid var(--line);z-index:4">'
            f'<div class="{btn_class}">{btn}</div>{link}</div>')

def s_home():
    stops = [
        (92, 34, 'talk', 'done', 'Topic talk · Rain', 'Flow 71', 'r'),
        (92, 112, 'pack', 'done', 'Word pack · Make your point', '8 words, then a talk', 'r'),
        (92, 250, 'talk', 'current', '', '', 'r'),
        (282, 370, 'cold', 'ahead', 'Cold read', 'Tomorrow', 'l'),
        (282, 520, 'talk', 'ahead', 'Topic talk', 'Tuesday', 'l'),
    ]
    m = home_map('sharp', 'sharpSoft', stops, h=470, drop_at=(92, 186, 'right'))
    card = today_card('TODAY · STOP 6', 'Topic talk: <span class="say">Coffee</span>', '1 minute. Your best is 76.', left=148, top=218 + 0, width=218)
    return f'''{status_bar()}{home_header('Sunday, Nov 1', '6 days in a row', 6, 6)}
<div style="position:relative;flex:none;margin-top:10px;height:470px">{m}{card}</div>
{home_bottom("Start today’s stop")}{tabbar('Home')}{HOME}'''

def s_home_done():
    stops = [
        (92, 34, 'pack', 'done', 'Word pack · Make your point', '8 words, then a talk', 'r'),
        (92, 112, 'talk', 'done', 'Topic talk · Coffee', 'Flow 78 · your best', 'r'),
        (92, 250, 'cold', 'current', '', '', 'r'),
        (282, 370, 'talk', 'ahead', 'Topic talk', 'Tuesday', 'l'),
        (282, 520, 'glide', 'ahead', 'Glide rehearsal', 'Wednesday', 'l'),
    ]
    m = home_map('sharp', 'sharpSoft', stops, h=470, drop_at=(92, 186, 'happy'))
    card = today_card('TOMORROW · STOP 7', 'Cold read: <span class="say">Signal and Noise</span>', 'Then a short topic talk.', left=148, top=218, width=218)
    return f'''{status_bar()}{home_header('Sunday, Nov 1', '7 days in a row', 7, 7)}
<div style="position:relative;flex:none;margin-top:10px;height:470px">{m}{card}</div>
<div style="position:absolute;left:0;right:0;bottom:83px;padding:12px 24px 4px;background:var(--bg);border-top:1px solid var(--line);z-index:4">
<div style="display:flex;align-items:center;gap:10px;height:44px;font-size:16px;font-weight:600">{ico('check', 20, 'var(--good)', 2.6)}<span>Today’s stop is done. See you tomorrow.</span></div>
<div class="btn2" style="margin-top:4px">Do the next stop now</div>
</div>{tabbar('Home')}{HOME}'''

def s_home_first():
    # Day 1 on Clear English: the station is in view, Sharp Talk branches off to the right.
    # Sharp Talk leaves the same station and runs off the right edge; its tag switches lines.
    extra = ('<path d="M92,40 C92,92 200,70 260,70 L420,70" stroke="var(--sharpSoft)" stroke-width="10" fill="none"/>')
    stops = [
        (92, 40, 'talk', 'station', '', '', 'r'),
        (92, 150, 'talk', 'done', 'Your first talk · Coffee', 'Flow 74 · your starting point', 'r'),
        (92, 290, 'pack', 'current', '', '', 'r'),
        (92, 420, 'talk', 'ahead', 'Topic talk', 'Tuesday', 'r'),
    ]
    station = ('<rect x="44" y="20" width="96" height="40" rx="20" fill="var(--surface)" stroke="var(--ink)" stroke-width="3"/>'
               '<text x="92" y="45" text-anchor="middle" font-size="15" font-weight="700" fill="var(--ink)">Start</text>')
    branch_tag = ('<g transform="translate(228,86)"><rect width="138" height="40" rx="20" fill="var(--surface)" stroke="var(--line)" stroke-width="1.5"/>'
                  '<circle cx="20" cy="20" r="6" fill="var(--sharp)"/>'
                  '<text x="34" y="25" font-size="14" font-weight="600" fill="var(--ink)">Sharp Talk</text>'
                  '<path d="M118 15l5 5-5 5" stroke="var(--ink)" stroke-width="2" fill="none" stroke-linecap="round"/></g>')
    m = home_map('clear', 'clearSoft', stops, h=470, drop_at=(92, 226, 'right'), extra=extra)
    m = m.replace('</svg>', station + branch_tag + '</svg>')
    card = today_card('TODAY · STOP 2', 'Word pack: <span class="say">Everyday words</span>', 'Hear 6 words, then a short talk.', left=148, top=258, width=218)
    return f'''{status_bar()}{home_header('Monday, Nov 2', 'Day 2', 1, 1, line='clear')}
<div style="position:relative;flex:none;margin-top:10px;height:470px">{m}{card}</div>
{home_bottom("Start today’s stop")}{tabbar('Home')}{HOME}'''

# ---------------------------------------------------------------- onboarding
def s_hook():
    lines = ('<svg width="390" height="250" viewBox="0 0 390 250" style="display:block">'
             '<path d="M195,170 C195,222 90,214 -20,236" stroke="var(--sharp)" stroke-width="10" fill="none"/>'
             '<path d="M195,170 C195,222 300,214 410,236" stroke="var(--clear)" stroke-width="10" fill="none"/>'
             '<circle cx="195" cy="170" r="17" fill="var(--surface)" stroke="var(--ink)" stroke-width="5"/>'
             f'<g transform="translate(195,96) scale(0.82)">{drop_g("rest")}</g></svg>')
    hook = ('<span>Find the words.</span> <span style="color:var(--unread)">Say them clearly.</span>')
    return f'''{status_bar()}<div class="pad" style="gap:18px">{obar(0, back=False)}
<div style="margin:8px -24px 0">{lines}</div>
<div class="brand" style="margin-top:2px">SaidClearly</div>
<div class="hook" style="margin-top:-10px">{hook}</div>
<div class="lead" style="margin-top:-4px">Talk for one minute a day. Get a little sharper every week.</div>
<div class="grow"></div>
<div class="btn">Get started</div>
<div class="small center" style="margin-top:-8px">No account needed.</div>
</div>{HOME}'''

def line_card(col, soft, name, who, stops, on):
    mini = (f'<svg width="62" height="400" viewBox="0 0 62 400" style="position:absolute;left:4px;top:0;display:block">'
            f'<path d="M31,0 L31,400" stroke="var(--{col})" stroke-width="8"/>'
            f'<circle cx="31" cy="34" r="10" fill="var(--{col})"/><circle cx="31" cy="78" r="10" fill="var(--surface)" stroke="var(--{col})" stroke-width="5"/>'
            f'<circle cx="31" cy="122" r="10" fill="var(--surface)" stroke="var(--{col})" stroke-width="5"/></svg>')
    border = f'2px solid var(--{col})' if on else '1.5px solid var(--line)'
    check = (f'<div style="width:26px;height:26px;border-radius:13px;background:var(--{col});display:flex;align-items:center;justify-content:center;flex:none">{ico("check", 16, "var(--onLine)", 3)}</div>'
             if on else '<div style="width:26px;height:26px;border-radius:13px;border:2px solid var(--line);flex:none"></div>')
    st = ''.join(f'<div style="font-size:13px;color:var(--muted);line-height:19px">{s}</div>' for s in stops)
    return f'''<div style="position:relative;background:var(--surface);border:{border};border-radius:20px;padding:14px 16px 14px 72px;overflow:hidden">
{mini}<div style="min-width:0"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
<div style="font-family:Bricolage;font-weight:800;font-size:23px;letter-spacing:-.2px">{name}</div>{check}</div>
<div style="font-size:15px;line-height:21px;margin:4px 0 6px">{who}</div>{st}</div></div>'''

def s_pick():
    a = line_card('sharp', 'sharpSoft', 'Sharp Talk', 'For anyone who wants to sound sharp and think on their feet.',
                  ['Precise words', 'Fewer fillers and repeats', 'A steady pace'], True)
    b = line_card('clear', 'clearSoft', 'Clear English', 'For people who speak English as another language and want to be understood the first time.',
                  ['Everyday words, said clearly', 'Say this, not that', 'Talk with more ease'], False)
    return f'''{status_bar()}<div class="pad" style="gap:16px">{obar(1)}
<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-top:4px">
<div class="h1">Which train are you getting on?</div><div style="margin-bottom:2px">{drop_svg(64, 'down', tilt=-6)}</div></div>
<div class="lead" style="margin-top:-8px">Both lines practise the same thing: talking clearly. You can switch any time.</div>
{a}{b}
<div class="grow"></div>
<div class="btn">Get on Sharp Talk</div>
</div>{HOME}'''

def s_first_talk():
    return f'''{status_bar()}<div class="pad" style="gap:18px">{obar(2)}
<div class="eyebrow" style="margin-top:18px">YOUR FIRST TOPIC TALK · 30 SECONDS</div>
<div class="say" style="font-size:52px;line-height:60px;margin-top:-8px">Coffee</div>
<div class="body">Talk about it for 30 seconds. Anything you like is fine.</div>
<div class="box" style="display:block;padding:12px 16px">
<div class="small" style="font-weight:600;color:var(--ink);font-size:14px">If you are not sure where to start</div>
<div style="font-size:15px;line-height:23px;color:var(--muted);margin-top:4px">How you take it<br/>A café you like<br/>Why so many people drink it</div></div>
<div class="note">{ico('phone', 20, 'var(--muted)')}<span>It listens only while you talk. Your speech is turned into text on this phone.</span></div>
<div class="box"><div style="flex:1"><div style="font-size:16px;font-weight:600">Keep a recording of this talk</div>
<div class="small" style="margin-top:2px">Off unless you turn it on. Saved on this phone.</div></div><div class="sw"></div></div>
<div class="grow"></div>
<div class="small center">Your phone will ask to use the microphone.</div>
<div class="btn" style="margin-top:-8px">Start talking</div>
</div>{HOME}'''

def s_denied():
    return f'''{status_bar()}<div class="pad">{obar(2)}
<div class="grow"></div>
<div style="display:flex;justify-content:center">{drop_svg(96, 'up')}</div>
<div class="h1 center">SaidClearly can’t hear you yet</div>
<div class="lead center" style="margin-top:-6px">It needs the microphone to hear your talk. Turn on Microphone and Speech Recognition in Settings.</div>
<div class="small center">Your line is saved. You can do your first talk later from Home.</div>
<div class="grow"></div>
<div class="btn">Open Settings</div>
<div class="link" style="margin-top:-12px">Skip for now</div>
</div>{HOME}'''

def talk_screen(title, clock, frac, eyebrow, topic, hint, ideas, foot_state='live', rib=RIB, finish='Finish'):
    ideas_html = ''
    if ideas:
        ideas_html = ('<div style="margin-top:6px"><div class="small" style="font-weight:600">If you get stuck</div>'
                      f'<div style="font-size:15px;line-height:23px;color:var(--muted);margin-top:2px">{"<br/>".join(ideas)}</div></div>')
    if foot_state == 'live':
        foot = (f'<div class="foot">{drop_svg(52, "up")}{ribbon(rib)}'
                f'<span style="font-size:15px;font-weight:600;color:var(--muted);margin-left:6px">{finish}</span></div>')
    else:
        foot = (f'<div class="foot" style="flex-direction:column;align-items:stretch;justify-content:center;height:150px;gap:6px">'
                f'<div class="btn">Start talking</div><div class="link" style="height:36px;line-height:36px">Different topic</div></div>')
    return f'''{status_bar()}
<div class="gtop">{ico('x', 20, 'var(--muted)')}<span style="flex:1">{title}</span><span class="num" style="font-family:-apple-system,Segoe UI,sans-serif;font-weight:600;font-size:17px;color:var(--ink)">{clock}</span></div>
<div class="track"><div class="fill" style="width:{frac}%"></div></div>
<div style="padding:120px 24px 0;display:flex;flex-direction:column;gap:14px">
<div class="eyebrow">{eyebrow}</div>
<div class="say" style="font-size:52px;line-height:60px">{topic}</div>
<div class="body" style="color:var(--muted)">{hint}</div>{ideas_html}</div>
{foot}{HOME}'''

def s_first_live():
    return talk_screen('Your first talk', '0:19', 63, 'TALK FOR 30 SECONDS', 'Coffee',
                       'Keep going. If you get stuck, say the word again.', ['How you take it', 'A café you like', 'Why so many people drink it'])

def s_topic_ready():
    return talk_screen('Topic talk · stop 6', '1:00', 0, 'TODAY’S TOPIC', 'Coffee',
                       'Talk about it for one minute. Take a moment to think: the first 8 seconds don’t count against you.',
                       ['How you take it', 'A café you like', 'Why so many people drink it'], foot_state='ready')

def s_topic_live():
    return talk_screen('Topic talk · stop 6', '0:38', 37, 'TODAY’S TOPIC', 'Coffee',
                       'Keep going. If you get stuck, say the word again.', ['How you take it', 'A café you like', 'Why so many people drink it'])

def s_start_point():
    rows = [('Talked for', '29 of 30 s'), ('Different words', '52'), ('Long pauses', 'None'), ('um/uh the phone heard', '1')]
    stat = ''.join(f'<div style="display:flex;justify-content:space-between;align-items:baseline;padding:11px 0;{"border-bottom:1px solid var(--line);" if i < len(rows) - 1 else ""}font-size:16px">'
                   f'<span>{l}</span><b style="font-variant-numeric:tabular-nums">{v}</b></div>' for i, (l, v) in enumerate(rows))
    chips = ''.join(f'<div class="chip{" on" if c == "8:00 am" else ""}">{c}</div>' for c in ['8:00 am', '12:30 pm', '6:00 pm', 'No reminder'])
    return f'''{status_bar()}<div class="pad" style="gap:14px">{obar(3)}
<div class="eyebrow" style="margin-top:6px">YOUR STARTING POINT</div>
<div style="display:flex;align-items:flex-end;gap:6px;margin-top:-10px"><span class="num" style="font-size:88px;line-height:88px">74</span><span style="font-size:20px;font-weight:600;color:var(--muted);margin-bottom:12px">Flow</span></div>
<div class="small" style="color:var(--ink);margin-top:-6px">Flow is whether you kept talking. It isn’t a grade of your accent or your English.</div>
<div class="box" style="display:block;padding:2px 16px">{stat}</div>
<div class="small" style="margin-top:-6px">Phones miss some um and uh, so that count runs low.</div>
<div style="display:flex;gap:12px;align-items:center">{drop_svg(50, 'happy')}<div class="body">Tomorrow: a new topic and a full minute. Try to beat 74.</div></div>
<div class="h2" style="font-size:17px;margin-top:2px">Remind me each day</div>
<div class="chips">{chips}</div>
<div class="grow"></div>
<div class="btn">See my line</div>
</div>{HOME}'''

# ---------------------------------------------------------------- results
def s_results():
    tiles = [
        ('Fillers (um, uh)', '2', '', 'Phones miss some.', ''),
        ('Repeated words', '<span class="say" style="font-size:22px">really</span>', '×9', 'Your most used word', ''),
        ('Different words', '96', '', '3 precise: nuance, premise, candid', ''),
        ('Kept going', '58', 's', '1 long pause, 3.1 s', ''),
        ('First word', '2.4', 's', 'Your usual: 4.1 s', ''),
        ('Pace', '142', 'wpm', 'In the 120–170 range', 'good'),
    ]
    th = ''.join(
        f'<div class="tile c"><div class="tl">{l}</div><div class="tv">{v}{f" <small>{u}</small>" if u else ""}</div>'
        f'<div class="tn" style="{"color:var(--good);font-weight:600" if tone == "good" else ""}">{n}</div></div>'
        for l, v, u, n, tone in tiles)
    strip = line_strip()
    return results_body('Coffee', '78', f'<div style="display:flex;align-items:center;gap:4px;font-size:15px;font-weight:700;color:var(--good)">{ico("up", 15, "var(--good)", 2.6)}6 on your usual 72</div>',
                        th, drop_svg(46, 'right'), 'You said “really” 9 times. Tomorrow, try a different word, or leave it out.',
                        strip, 'Stop 7 tomorrow: beat 78', '<div class="btn" style="margin-top:2px">Back to the map</div>')

def results_body(topic, flow, trend, tiles_html, drop, line, strip, next_text, buttons):
    return f'''{status_bar()}<div class="pad" style="gap:11px;padding-bottom:30px">
<div class="top" style="justify-content:space-between"><div class="eyebrow">TOPIC TALK · <span class="say" style="letter-spacing:0;font-size:14px;color:var(--ink)">{topic}</span></div>{ico('x', 22, 'var(--muted)')}</div>
<div style="display:flex;align-items:flex-end;gap:8px;margin-top:-6px">
<span class="num" style="font-size:88px;line-height:86px">{flow}</span>
<div style="margin-bottom:10px"><div style="font-size:20px;font-weight:600;color:var(--muted)">Flow</div>{trend}</div></div>
<div class="small" style="color:var(--ink);margin-top:-4px">Flow is whether you kept talking. It isn’t a grade of your accent or your English.</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">{tiles_html}</div>
<div style="display:flex;gap:12px;align-items:center;margin-top:2px">{drop}
<div style="font-size:16px;line-height:22px">{line}</div></div>
<div style="background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:6px 14px 10px">
{strip}<div style="display:flex;justify-content:space-between;font-size:14px;margin-top:-2px"><span style="font-weight:600">Stop 6 done</span><span style="color:var(--muted)">{next_text}</span></div></div>
{buttons}
</div>{HOME}'''

def line_strip(state="happy"):
    return ('<svg width="312" height="62" viewBox="0 0 312 62" style="display:block">'
             '<path d="M0,46 L312,46" stroke="var(--sharpSoft)" stroke-width="8"/>'
             '<path d="M0,46 L232,46" stroke="var(--sharp)" stroke-width="8"/>'
             + ''.join(f'<circle cx="{x}" cy="46" r="11" fill="var(--sharp)"/>'
                       f'<path d="M{x - 5},46.5l3.5,3.5 7-7.5" stroke="var(--onLine)" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
                       for x in (40, 98, 156)) +
             '<circle cx="232" cy="46" r="11" fill="var(--surface)" stroke="var(--sharp)" stroke-width="5"/>'
             '<circle cx="300" cy="46" r="9" fill="var(--surface)" stroke="var(--sharpSoft)" stroke-width="4"/>'
             f'<g transform="translate(232,19) scale(0.2)">{drop_g(state)}</g></svg>')

def s_results_early():
    # A minute stopped early (34 s): encouragement, no celebration, no up arrow.
    tiles = [
        ('Fillers (um, uh)', '1', '', 'Phones miss some.', ''),
        ('Repeated words', '<span class="say" style="font-size:22px">good</span>', '×4', 'Your most used word', ''),
        ('Different words', '48', '', 'in 34 seconds', ''),
        ('Kept going', '34', 's', 'of 60', ''),
        ('First word', '6.1', 's', 'The first 8 s are free', ''),
        ('Pace', '128', 'wpm', 'In the 120–170 range', 'good'),
    ]
    th = ''.join(
        f'<div class="tile c"><div class="tl">{l}</div><div class="tv">{v}{f" <small>{u}</small>" if u else ""}</div>'
        f'<div class="tn" style="{"color:var(--good);font-weight:600" if tone == "good" else ""}">{n}</div></div>'
        for l, v, u, n, tone in tiles)
    # The stop still counts (15+ words): no failure screen. Talk again is offered, quietly.
    return results_body('Trust', '55', '<div style="font-size:15px;font-weight:600;color:var(--muted)">Your usual is 64</div>',
                        th, drop_svg(46, 'rest', tilt=-8),
                        'You stopped at 34 s. When you have nothing more to say, say what you would add with more time.',
                        line_strip("rest"), 'Stop 7 tomorrow',
                        '<div class="btn" style="margin-top:0">Back to the map</div><div class="link" style="margin-top:-12px;height:34px;line-height:34px">Talk about it again</div>')

# ---------------------------------------------------------------- progress
def spark(vals, lo, hi, w=96, h=38, band=None, better='up'):
    n = len(vals)
    xs = [4 + i * (w - 8) / (n - 1) for i in range(n)]
    ys = [h - 5 - (v - lo) / (hi - lo) * (h - 10) for v in vals]
    pts = ' '.join(f'{x:.1f},{y:.1f}' for x, y in zip(xs, ys))
    b = ''
    if band:
        y1 = h - 5 - (band[1] - lo) / (hi - lo) * (h - 10)
        y2 = h - 5 - (band[0] - lo) / (hi - lo) * (h - 10)
        b = f'<rect x="0" y="{y1:.1f}" width="{w}" height="{y2 - y1:.1f}" rx="3" fill="var(--signalSoft)"/>'
    return (f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" style="display:block;flex:none">{b}'
            f'<polyline points="{pts}" fill="none" stroke="var(--signal)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>'
            f'<circle cx="{xs[-1]:.1f}" cy="{ys[-1]:.1f}" r="4" fill="var(--signal)"/></svg>')

def skill_row(name, explain, value, unit, change, vals, lo, hi, band=None, tone='good'):
    col = 'var(--good)' if tone == 'good' else 'var(--muted)'
    return f'''<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)">
<div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:600">{name}</div>
<div class="small" style="white-space:nowrap">{explain}</div>
<div style="font-size:13px;font-weight:600;color:{col};margin-top:2px;white-space:nowrap">{change}</div></div>
{spark(vals, lo, hi, band=band)}
<div style="width:58px;text-align:right"><span class="num" style="font-size:24px">{value}</span><div class="small" style="margin-top:-2px">{unit}</div></div></div>'''

def s_progress():
    rows = ''.join([
        skill_row('Flow', 'Kept talking, few long pauses', '78', 'this week', '▲ Up from 61 in week 1', [61, 63, 62, 67, 70, 69, 74, 78], 55, 85),
        skill_row('Fillers', 'um and uh heard', '1.4', 'per min', '▼ Down from 3.8', [3.8, 3.5, 3.6, 2.9, 2.4, 2.2, 1.8, 1.4], 0, 4.2),
        skill_row('Repeated words', 'Your most used word', '5', 'times', '▼ Down from 11', [11, 10, 9, 9, 7, 7, 6, 5], 3, 12),
        skill_row('Different words', 'In one talk', '94', 'words', '▲ Up from 71', [71, 74, 73, 80, 84, 86, 90, 94], 65, 98),
        skill_row('First word', 'Time before you start', '2.6', 'seconds', '▼ Down from 6.4 s', [6.4, 6.0, 5.1, 4.8, 4.0, 3.6, 3.1, 2.6], 1.5, 7),
        skill_row('Pace', 'Shaded: the 120–170 range', '141', 'wpm', 'In range: 6 of 7 talks', [168, 175, 160, 152, 149, 146, 143, 141], 110, 185, band=(120, 170), tone='muted'),
    ])
    return f'''{status_bar()}<div style="padding:4px 24px 0;flex:none">
<div class="h1">Progress</div>
<div class="lead" style="font-size:15px;margin-top:2px">31 talks in 8 weeks · best Flow 84 (<span class="say">Trust</span>)</div>
<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:16px"><div class="eyebrow">YOUR SKILLS · WEEK BY WEEK</div><div class="small">weeks 1–8</div></div>
<div style="margin-top:2px">{rows}</div>
<div class="small" style="margin-top:10px">Each line is the middle of your talks that week. Phones miss some um and uh, so that count runs low.</div></div>{tabbar('Progress')}{HOME}'''

def s_progress_early():
    return f'''{status_bar()}<div style="padding:4px 24px 0;flex:1;display:flex;flex-direction:column">
<div class="h1">Progress</div>
<div class="lead" style="font-size:15px;margin-top:2px">Your topic talks, week by week. Only you are compared to you.</div>
<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding-bottom:120px">
{drop_svg(96, 'up')}
<div class="h1 center" style="font-size:24px;line-height:30px">Two talks so far</div>
<div class="lead center">After your third talk, each skill gets its own line here: Flow, fillers, repeated words, different words, first word and pace.</div>
<div class="box" style="align-self:stretch;display:block;padding:4px 16px">
<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line);font-size:16px"><span>Your first talk · <span class="say">Coffee</span></span><b>74</b></div>
<div style="display:flex;justify-content:space-between;padding:10px 0;font-size:16px"><span>Yesterday · <span class="say">Rain</span></span><b>69</b></div></div>
</div></div>{tabbar('Progress')}{HOME}'''

# ---------------------------------------------------------------- render
SCREENS = [
    ('01-onboarding-hook', s_hook, ('light',)),
    ('02-onboarding-pick-line', s_pick, ('light',)),
    ('03-onboarding-first-talk', s_first_talk, ('light',)),
    ('03b-onboarding-mic-denied', s_denied, ('light',)),
    ('04-onboarding-first-talk-live', s_first_live, ('light',)),
    ('05-onboarding-starting-point', s_start_point, ('light',)),
    ('06-home-map', s_home, ('light', 'dark')),
    ('06b-home-first-day-clear-english', s_home_first, ('light',)),
    ('06c-home-stop-done', s_home_done, ('light',)),
    ('07-topic-talk-ready', s_topic_ready, ('light',)),
    ('08-topic-talk-live', s_topic_live, ('light',)),
    ('09-results', s_results, ('light', 'dark')),
    ('09b-results-stopped-early', s_results_early, ('light',)),
    ('10-progress', s_progress, ('light',)),
    ('10b-progress-early', s_progress_early, ('light',)),
]

def page(body, theme):
    return (f'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=390">'
            f'<style>{css(theme)}</style></head><body><div class="scr">{body}</div></body></html>')

def sheet_html(items):
    cells = ''.join(f'<figure><img src="../{fn}"><figcaption>{cap}</figcaption></figure>' for fn, cap in items)
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{{font-family:Bricolage;font-weight:800;src:url('fonts/BricolageGrotesque_800ExtraBold.ttf')}}
body{{margin:0;background:#E6E8EE;font-family:-apple-system,'Segoe UI',system-ui,sans-serif;color:#14161F;padding:36px 40px 40px;width:{6 * 300 + 40 * 2 + 5 * 24}px}}
h1{{font-family:Bricolage;font-weight:800;font-size:34px;margin:0 0 4px}} p{{margin:0 0 26px;color:#5D6272;font-size:17px}}
.g{{display:grid;grid-template-columns:repeat(6,300px);gap:28px 24px}}
figure{{margin:0}} img{{width:300px;height:649px;border-radius:30px;display:block;border:1px solid #CDD1DB}}
figcaption{{font-size:15px;font-weight:600;margin-top:10px;line-height:20px}}
</style></head><body><h1>SaidClearly remodel · screens for approval</h1>
<p>Onboarding (which train?), the two-line home map, topic talk, results scorecard, progress. Light, plus dark for the map and results. 2026-11-01, design-ux.</p>
<div class="g">{cells}</div></body></html>'''

SHEET = [
    ('01-onboarding-hook-light.png', '1 · Hook'), ('02-onboarding-pick-line-light.png', '2 · Which train?'),
    ('03-onboarding-first-talk-light.png', '3 · First topic talk'), ('04-onboarding-first-talk-live-light.png', '3 · Talking (30 s)'),
    ('05-onboarding-starting-point-light.png', '4 · Your starting point'), ('03b-onboarding-mic-denied-light.png', '3b · Mic denied'),
    ('06-home-map-light.png', 'Home · the map'), ('06-home-map-dark.png', 'Home · dark'),
    ('06b-home-first-day-clear-english-light.png', 'Home · day 2, Clear English'), ('06c-home-stop-done-light.png', 'Home · today done'),
    ('07-topic-talk-ready-light.png', 'Topic talk · ready'), ('08-topic-talk-live-light.png', 'Topic talk · talking'),
    ('09-results-light.png', 'Results'), ('09-results-dark.png', 'Results · dark'),
    ('09b-results-stopped-early-light.png', 'Results · stopped early'), ('10-progress-light.png', 'Progress'),
    ('10b-progress-early-light.png', 'Progress · 2 talks'),
]

if __name__ == '__main__':
    from playwright.sync_api import sync_playwright
    ensure_fonts()
    only = sys.argv[1] if len(sys.argv) > 1 else ''
    with sync_playwright() as p:
        br = p.chromium.launch()
        try:
            ctx = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
            pg = ctx.new_page()
            for name, fn, modes in SCREENS:
                if only and only not in name and only != 'sheet':
                    continue
                for mode in modes:
                    hp = os.path.join(HERE, f'{name}-{mode}.html')
                    with open(hp, 'w', encoding='utf-8') as f:
                        f.write(page(fn(), LIGHT if mode == 'light' else DARK))
                    pg.goto('file:///' + hp.replace('\\', '/'))
                    pg.wait_for_timeout(120)
                    pg.screenshot(path=os.path.join(OUT, f'{name}-{mode}.png'))
            if not only or only == 'sheet':
                sp = os.path.join(HERE, 'sheet.html')
                with open(sp, 'w', encoding='utf-8') as f:
                    f.write(sheet_html(SHEET))
                sctx = br.new_context(viewport={'width': 6 * 300 + 80 + 120, 'height': 800}, device_scale_factor=1)
                spg = sctx.new_page()
                spg.goto('file:///' + sp.replace('\\', '/'))
                spg.wait_for_timeout(300)
                spg.screenshot(path=os.path.join(OUT, 'sheet.png'), full_page=True)
        finally:
            br.close()
    print('done')
