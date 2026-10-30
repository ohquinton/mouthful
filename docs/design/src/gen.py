# Low-fi mockups for SaidClearly onboarding + App Store slides.
# Each mockup is an SVG with a foreignObject (XHTML + CSS using the theme.ts tokens), rendered by headless Chrome.
import os, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
DESIGN = os.path.dirname(HERE)
OUT_ON = os.path.join(DESIGN, 'onboarding')
OUT_ST = os.path.join(DESIGN, 'store')
os.makedirs(OUT_ON, exist_ok=True)
os.makedirs(OUT_ST, exist_ok=True)
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'

LIGHT = dict(bg='#F3F4F7', surface='#FFFFFF', ink='#14161F', muted='#5D6272', unread='#A5AAB8', line='#DDE0E8',
             signal='#2F49F5', button='#2F49F5', signalSoft='#E4E8FF', good='#12936B', ember='#C27A00',
             stumble='#D23B3B', card='#14161F', cardInk='#F3F4F7', cardMuted='#9298AA')
DARK = dict(bg='#0E1017', surface='#171A24', ink='#ECEEF5', muted='#9298AA', unread='#5A6072', line='#2A2E3C',
            signal='#7B8CFF', button='#3D52F0', signalSoft='#232A55', good='#3CC79A', ember='#E3A33A',
            stumble='#FF6B6B', card='#1E2230', cardInk='#ECEEF5', cardMuted='#9298AA')

def css(theme):
    v = ';'.join(f'--{k}:{c}' for k, c in theme.items())
    return f"""
@font-face{{font-family:Literata;font-weight:500;src:url('../fonts/Literata_500Medium.ttf')}}
@font-face{{font-family:Literata;font-weight:700;src:url('../fonts/Literata_700Bold.ttf')}}
@font-face{{font-family:Bricolage;font-weight:700;src:url('../fonts/BricolageGrotesque_700Bold.ttf')}}
@font-face{{font-family:Bricolage;font-weight:800;src:url('../fonts/BricolageGrotesque_800ExtraBold.ttf')}}
.root{{{v}}}
*{{box-sizing:border-box;margin:0;padding:0}}
.scr{{width:390px;height:844px;background:var(--bg);color:var(--ink);font-family:-apple-system,'SF Pro Text','Segoe UI',system-ui,sans-serif;
  position:relative;overflow:hidden;display:flex;flex-direction:column}}
.sb{{height:54px;display:flex;justify-content:space-between;align-items:center;padding:0 30px 0 36px;font-size:16px;font-weight:600;flex:none}}
.island{{position:absolute;top:11px;left:50%;margin-left:-62px;width:124px;height:36px;border-radius:20px;background:#000}}
.home{{position:absolute;bottom:8px;left:50%;margin-left:-67px;width:134px;height:5px;border-radius:3px;background:var(--ink);opacity:.85}}
.pad{{padding:0 24px;flex:1;display:flex;flex-direction:column;gap:20px;padding-bottom:42px}}
.top{{display:flex;align-items:center;height:44px;position:relative;flex:none}}
.dots{{position:absolute;left:0;right:0;display:flex;gap:6px;justify-content:center;pointer-events:none}}
.dot{{width:24px;height:4px;border-radius:2px;background:var(--line)}} .dot.on{{background:var(--ink)}}
.back{{width:44px;height:44px;display:flex;align-items:center;margin-left:-10px}}
.grow{{flex:1}}
.brand{{font-family:Bricolage;font-weight:800;font-size:22px;letter-spacing:-.3px;color:var(--ink)}}
.hook{{font-family:Literata;font-weight:700;font-size:34px;line-height:48px}}
.h1{{font-family:Bricolage;font-weight:700;font-size:28px;line-height:34px}}
.h2{{font-size:20px;font-weight:700}}
.lead{{font-size:17px;line-height:25px;color:var(--muted)}}
.small{{font-size:13px;line-height:18px;color:var(--muted)}}
.center{{text-align:center}}
.btn{{height:54px;border-radius:14px;background:var(--button);color:#fff;font-size:17px;font-weight:600;display:flex;align-items:center;justify-content:center;flex:none}}
.link{{text-align:center;font-size:15px;font-weight:600;color:var(--muted);height:44px;line-height:44px;flex:none}}
.tile{{display:flex;align-items:center;gap:12px;border:1.5px solid var(--line);background:var(--surface);border-radius:16px;padding:11px 14px;min-height:60px}}
.tile.on{{border-color:var(--signal);background:var(--signalSoft)}}
.tt{{font-size:16px;font-weight:600}} .ts{{font-size:13px;color:var(--muted);margin-top:2px}}
.chips{{display:flex;flex-wrap:wrap;gap:8px}}
.chip{{border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:0 15px;height:44px;line-height:42px;font-size:15px;font-weight:500}}
.chip.on{{border:1.5px solid var(--signal);background:var(--signalSoft)}}
.card{{background:var(--card);color:var(--cardInk);border-radius:20px;padding:18px 20px;display:flex;flex-direction:column;gap:6px}}
.eyebrow{{font-size:12px;font-weight:700;letter-spacing:1.1px;color:var(--muted)}}
.card .eyebrow{{color:var(--cardMuted)}}
.ctitle{{font-family:Literata;font-weight:700;font-size:24px;line-height:30px}}
.csub{{font-size:15px;line-height:21px;color:var(--cardMuted)}}
.box{{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px 16px;display:flex;gap:12px;align-items:center}}
.sw{{width:51px;height:31px;border-radius:16px;background:var(--line);position:relative;flex:none}}
.sw::after{{content:'';position:absolute;top:2px;left:2px;width:27px;height:27px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25)}}
.note{{display:flex;gap:10px;align-items:flex-start;font-size:15px;line-height:21px;color:var(--muted)}}
.passage{{font-family:Literata;font-weight:500;font-size:25px;line-height:40px}}
.w-read{{color:var(--ink)}} .w-un{{color:var(--unread)}}
.w-cur{{background:var(--signalSoft);border-radius:6px;box-shadow:0 0 0 3px var(--signalSoft);color:var(--ink)}}
.w-miss{{color:var(--stumble);text-decoration:underline dotted;text-decoration-thickness:2px;text-underline-offset:6px}}
.gtop{{display:flex;align-items:center;gap:16px;padding:0 24px;height:48px;font-size:15px;font-weight:600;color:var(--muted);flex:none}}
.track{{height:3px;background:var(--line);margin:0 24px;flex:none;border-radius:2px}} .fill{{height:3px;background:var(--signal);border-radius:2px}}
.foot{{position:absolute;left:0;right:0;bottom:0;height:120px;padding:0 24px 34px;display:flex;align-items:center;gap:14px;background:var(--bg);border-top:1px solid var(--line)}}
.bars{{min-width:0;overflow:hidden;display:flex;gap:3px;align-items:center;height:32px;flex:1}}
.bar{{width:4px;border-radius:2px;background:var(--signal);opacity:.55}}
.paceline{{position:absolute;left:0;right:0;bottom:0;height:4px;background:var(--good)}}
.big{{font-family:Bricolage;font-weight:800;font-size:72px;line-height:72px}}
.stat{{display:flex;justify-content:space-between;align-items:baseline;padding:12px 0;border-bottom:1px solid var(--line);font-size:17px}}
.stat:last-child{{border-bottom:0}}
.step{{display:flex;align-items:center;gap:12px;min-height:30px}}
.sdot{{width:26px;height:26px;border-radius:13px;border:1.5px solid var(--cardMuted);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--cardMuted);flex:none}}
.sdot.next{{border-color:var(--cardInk);color:var(--cardInk)}}
.sdot.done{{background:var(--good);border-color:var(--good)}}
.stt{{font-size:16px;font-weight:600}} .stt.done{{color:var(--cardMuted);text-decoration:line-through}}
.ssub{{font-size:13px;color:var(--cardMuted);margin-top:2px}}
.cbtn{{height:52px;border-radius:16px;background:var(--button);color:#fff;font-size:17px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:6px}}
.pro{{font-size:11px;font-weight:800;letter-spacing:.6px;color:var(--signal);background:var(--signalSoft);border-radius:6px;padding:3px 6px}}
.row3{{display:flex;gap:10px}}
.t3{{flex:1;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:12px;min-height:110px;display:flex;flex-direction:column;gap:4px}}
.t3 b{{font-size:15px}} .t3 span{{font-size:13px;color:var(--muted);line-height:17px}}
.pill{{display:inline-block;border:1px solid var(--cardMuted);border-radius:999px;padding:6px 12px;font-size:13px;font-weight:600;color:var(--cardInk)}}
"""

# --- tiny inline icons (stroke = currentColor) ---
def ico(name, size=22, color='var(--signal)', sw=2):
    p = {
        'back': '<path d="M15 5l-7 7 7 7"/>',
        'mic': '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
        'micoff': '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M4 4l16 16"/>',
        'lock': '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
        'phone': '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
        'case': '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/>',
        'easel': '<rect x="3" y="4" width="18" height="11" rx="1.5"/><path d="M12 15v5M8 21l4-6 4 6"/>',
        'cash': '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
        'people': '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M15 14.5c3 0 6 2 6 5"/>',
        'radio': '<circle cx="12" cy="12" r="9"/>',
        'check': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
        'checkc': '<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="M7 12.5l3.5 3.5L17 9" stroke="var(--surface)"/>',
        'x': '<path d="M6 6l12 12M18 6L6 18"/>',
        'doc': '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
        'chat': '<path d="M4 5h16v11H9l-5 4z"/>',
        'eye': '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/>',
        'book': '<path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v14"/>',
        'speaker': '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
    }[name]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" style="color:{color};flex:none">{p}</svg>')

def status_bar(time='9:41'):
    return (f'<div class="sb"><span>{time}</span><span style="display:flex;gap:6px;align-items:center">'
            '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor"/>'
            '<rect x="5" y="5" width="3" height="7" rx="1" fill="currentColor"/><rect x="10" y="2" width="3" height="10" rx="1" fill="currentColor"/>'
            '<rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor"/></svg>'
            '<svg xmlns="http://www.w3.org/2000/svg" width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/>'
            '<rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor"/><rect x="24.5" y="4" width="2" height="5" rx="1" fill="currentColor" opacity=".4"/></svg>'
            '</span></div><div class="island"></div>')

def dots(n_on, total=3):
    return '<div class="dots">' + ''.join(f'<div class="dot{" on" if i == n_on else ""}"></div>' for i in range(total)) + '</div>'

def top(n_on, back=True):
    b = f'<div class="back">{ico("back", 26, "var(--ink)", 2.2)}</div>' if back else ''
    return f'<div class="top">{b}{dots(n_on)}</div>'

def words_html(text, statuses):
    """statuses: dict index->cls; default by position handled by caller."""
    out = []
    for i, w in enumerate(text.split(' ')):
        out.append(f'<span class="{statuses(i)}">{w}</span>')
    return ' '.join(out)

# ---------------- onboarding screens ----------------
HOOK = 'Find the words. Say them clearly.'
BASELINE = ('Every morning, the café on the corner opens before the sun is fully up. The owner unlocks the door, '
            'switches on the espresso machine, and writes the specials on a small chalkboard. Regulars arrive one by one.')

def s_hook():
    ws = words_html(HOOK, lambda i: 'w-read' if i < 3 else ('w-cur' if i == 3 else 'w-un'))
    return f'''{status_bar()}<div class="pad">{top(0, back=False)}
<div class="grow"></div>
<div class="brand">SaidClearly</div>
<div class="hook">{ws}</div>
<div class="lead">Learn the words you need, then say them out loud. They ink in as you say them.</div>
<div class="grow"></div>
<div class="btn">Get started</div>
<div class="small center" style="margin-top:-8px">No account needed.</div>
</div><div class="home"></div>'''

def s_moment():
    tiles = [('case', 'Job interview', 'Practise your answers out loud', True),
             ('easel', 'Presentation', 'Practise your talk out loud', False),
             ('cash', 'Ask for a raise', 'Make your case calmly', False),
             ('people', 'Big meeting', 'Give your update without rushing', False)]
    th = ''.join(f'''<div class="tile{' on' if on else ''}">{ico(i)}<div style="flex:1"><div class="tt">{t}</div><div class="ts">{s}</div></div>
{ico('checkc', 22, 'var(--signal)') if on else ico('radio', 22, 'var(--line)', 1.6)}</div>''' for i, t, s, on in tiles)
    chips = ''.join(f'<div class="chip{" on" if c == "In 3 days" else ""}">{c}</div>' for c in
                    ['Today', 'Tomorrow', 'In 3 days', 'Next week', 'In 2 weeks', 'Not sure'])
    return f'''{status_bar()}<div class="pad" style="gap:16px">{top(1)}
<div class="h1">What are you preparing for?</div>
<div style="display:flex;flex-direction:column;gap:8px">{th}</div>
<div class="h2" style="margin-top:4px">When is it?</div>
<div class="chips">{chips}</div>
<div class="grow"></div>
<div class="btn">Make my plan</div>
<div class="link" style="margin-top:-12px">Nothing planned? Just practise</div>
</div><div class="home"></div>'''

def s_firstread(offline=True):
    priv = ('It listens only while you read. Your speech is turned into text on this phone.' if offline else
            'It listens only while you read. If this phone can’t turn speech into text by itself, we’ll ask before using a speech service.')
    return f'''{status_bar()}<div class="pad" style="gap:18px">{top(2)}
<div class="card"><div class="eyebrow">JOB INTERVIEW PLAN</div><div class="ctitle">Your interview is in 3 days</div>
<div class="csub">5 short steps. The first one takes 30 seconds.</div></div>
<div class="grow" style="max-height:24px"></div>
<div class="h1">First, a 30-second read</div>
<div class="lead" style="margin-top:-8px">Read a short passage out loud at your normal pace. This is your starting point.</div>
<div class="note">{ico('phone', 20, 'var(--muted)')}<span>{priv}</span></div>
<div class="box"><div style="flex:1"><div class="tt">Keep a recording of this read</div>
<div class="ts" style="line-height:18px">Off unless you turn it on. Saved on this phone (and its backup).</div></div><div class="sw"></div></div>
<div class="grow"></div>
<div class="small center">Your phone will ask to use the microphone.</div>
<div class="btn" style="margin-top:-8px">Start reading</div>
</div><div class="home"></div>'''

def s_denied():
    return f'''{status_bar()}<div class="pad">{top(2)}
<div class="grow"></div>
<div style="display:flex;justify-content:center">{ico('micoff', 44, 'var(--muted)', 1.8)}</div>
<div class="h1 center">SaidClearly can’t hear you yet</div>
<div class="lead center">It needs the microphone to follow your reading. Turn on Microphone and Speech Recognition in Settings.</div>
<div class="small center">Your plan is saved. You can do this read later from Today.</div>
<div class="grow"></div>
<div class="btn">Open Settings</div>
<div class="link" style="margin-top:-12px">Skip for now</div>
</div><div class="home"></div>'''

def glide(title, count, frac, text, status, hint=None, wpm='–', red_tip=False):
    ws = words_html(text, status)
    h = f'<div class="small" style="padding:14px 24px 0;font-size:15px;line-height:21px">{hint}</div>' if hint else ''
    bars = ''.join(f'<div class="bar" style="height:{hgt}px"></div>' for hgt in
                   ([4] * 34 if wpm == '–' else [6, 10, 18, 26, 14, 8, 20, 28, 16, 10, 6, 12, 22, 30, 18, 9, 14, 24, 12, 7, 5, 9, 16, 22, 12, 6, 10, 18, 8, 5, 4, 4, 4, 4]))
    return f'''{status_bar()}
<div class="gtop">{ico('x', 20, 'var(--muted)')}<span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{title}</span><span>{count}</span></div>
<div class="track"><div class="fill" style="width:{frac}%"></div></div>{h}
<div class="passage" style="padding:{'40' if hint else '70'}px 24px 0">{ws}</div>
<div class="foot"><div class="bars">{bars}</div><div style="display:flex;align-items:baseline;gap:4px">
<span style="font-family:Bricolage;font-weight:800;font-size:28px">{wpm}</span><span class="small">wpm</span></div>
<span style="font-size:15px;font-weight:600;color:var(--muted);margin-left:10px">Finish</span></div>
<div class="paceline" style="{'' if wpm != '–' else 'background:var(--line)'}"></div><div class="home"></div>'''

def s_glide():
    return glide('Your first read', '0 / 78', 0, BASELINE,
                 lambda i: 'w-cur' if i == 0 else 'w-un',
                 hint='Read out loud at your normal pace. The words turn dark as you say them.')

def s_result():
    chips = ''.join(f'<div class="chip{" on" if c == "6:00 pm" else ""}">{c}</div>' for c in
                    ['8:00 am', '12:30 pm', '6:00 pm', '9:00 pm', 'No reminder'])
    return f'''{status_bar()}<div class="pad" style="gap:16px"><div style="height:16px"></div>
<div class="eyebrow">YOUR STARTING POINT</div>
<div style="display:flex;align-items:baseline;gap:10px"><span class="big">142</span><span class="lead">words a minute</span></div>
<div style="font-size:17px;line-height:25px">That’s inside 130–165, a comfortable range for reading aloud.</div>
<div class="box" style="display:block;padding:2px 16px">
<div class="stat"><span>Heard clearly</span><b>71 of 78 words</b></div>
<div class="stat"><span>Time</span><b>0:34</b></div></div>
<div class="small" style="margin-top:-6px">Phones miss some words, especially with accents. On any read, tap a red word you said.</div>
<div class="h2" style="margin-top:6px">Remind me to practise</div>
<div class="chips">{chips}</div>
<div class="grow"></div>
<div class="btn">See my plan</div>
<div class="link" style="margin-top:-12px">Read it again</div>
</div><div class="home"></div>'''

def plan_card(done=0, next_sub='8 words, how to say them', btn='Learn the words', btn_icon='book'):
    steps = ['Learn the words', 'Say them in context', 'Add your real words', 'Rehearse it', 'Final run-through']
    rows = []
    for i, t in enumerate(steps):
        isdone, isnext = i < done, i == done
        d = f'<div class="sdot done">{ico("check", 14, "var(--card)", 3)}</div>' if isdone else f'<div class="sdot{" next" if isnext else ""}">{i + 1}</div>'
        sub = ''
        if i == 3:
            sub = '<div class="ssub" style="color:var(--good);font-weight:600">Your first run is free</div>'
        elif isnext:
            sub = f'<div class="ssub">{next_sub}</div>'
        rows.append(f'<div class="step">{d}<div style="flex:1"><div class="stt{" done" if isdone else ""}">{t}</div>{sub}</div></div>')
    return f'''<div class="card" style="border-radius:24px;padding:20px;gap:10px">
<div style="display:flex;justify-content:space-between"><div class="eyebrow">JOB INTERVIEW PLAN</div><span style="font-size:13px;font-weight:600;color:var(--cardMuted)">Change</span></div>
<div class="ctitle">Your interview is in 3 days</div>
<div style="display:flex;flex-direction:column;gap:10px;margin-top:4px">{''.join(rows)}</div>
<div class="cbtn">{ico(btn_icon, 18, '#fff')}{btn}</div></div>'''

def s_today():
    return f'''{status_bar()}<div class="pad" style="gap:16px;padding-top:8px">
<div><div style="font-size:15px;color:var(--muted)">Thursday, Oct 30</div><div style="font-family:Bricolage;font-weight:700;font-size:32px">Evening.</div></div>
{plan_card()}
<div class="box" style="border-radius:18px">{ico('mic', 20, 'var(--muted)')}<div style="flex:1"><div class="eyebrow" style="font-size:11px">DAILY WARM-UP · 1 MIN</div>
<div style="font-family:Literata;font-weight:700;font-size:18px">Night shift</div></div><span style="font-size:15px;font-weight:700;color:var(--ink)">Read</span></div>
<div class="row3"><div class="t3">{ico('doc', 22, 'var(--muted)')}<b>Your scripts</b><span>Paste it, rehearse it</span></div>
<div class="t3">{ico('chat', 22, 'var(--muted)')}<b>Free talk</b><span>60 seconds, no script</span></div>
<div class="t3">{ico('eye', 22, 'var(--muted)')}<b>Cold read</b><span>Unseen passage</span></div></div>
</div><div class="home"></div>'''

SCREENS = [('01-hook', s_hook), ('02-moment-date', s_moment), ('03-first-read', s_firstread),
           ('03b-mic-denied', s_denied), ('04-glide-first-read', s_glide), ('05-starting-point', s_result),
           ('06-today-plan', s_today)]

# ---------------- store slides ----------------
SCRIPT = ('Tell me about yourself? I’m a data analyst with three years in retail forecasting. In my last role I built '
          'a weekly sales model that cut stock waste by twelve percent. I like turning messy numbers into clear decisions.')
SCRIPT = SCRIPT.replace('Tell me about yourself? ', '')

def st_glide():
    return glide('Tell me about yourself · part 1 of 2', '27 / 41', 66, SCRIPT,
                 lambda i: 'w-read' if i < 27 else ('w-cur' if i == 27 else 'w-un'), wpm='138')

def st_overrule():
    # word 8 is "forecasting." -> missed; others read up to 18
    def s(i):
        if i == 9: return 'w-miss'
        return 'w-read' if i < 18 else ('w-cur' if i == 18 else 'w-un')
    return glide('Tell me about yourself · part 1 of 2', '18 / 41', 44, SCRIPT, s, wpm='134')

def st_plan():
    return f'''{status_bar()}<div class="pad" style="gap:16px;padding-top:8px">
<div><div style="font-size:15px;color:var(--muted)">Monday, Nov 2</div><div style="font-family:Bricolage;font-weight:700;font-size:32px">Morning.</div></div>
{plan_card(done=2, next_sub='Paste your answer to the question you’re dreading.', btn='Add your real words', btn_icon='doc')}
<div class="box" style="border-radius:18px">{ico('mic', 20, 'var(--muted)')}<div style="flex:1"><div class="eyebrow" style="font-size:11px">DAILY WARM-UP · 1 MIN</div>
<div style="font-family:Literata;font-weight:700;font-size:18px">Night shift</div></div><span style="font-size:15px;font-weight:700">Read</span></div>
</div><div class="home"></div>'''

def st_tape():
    return f'''{status_bar()}<div class="pad" style="gap:16px;padding-top:12px">
<div class="eyebrow">TELL ME ABOUT YOURSELF · PART 1</div>
<div style="display:flex;gap:10px">
<div class="box" style="flex:1;display:block"><div class="small">Pace</div><div style="font-family:Bricolage;font-weight:800;font-size:34px">138 <span class="small">wpm</span></div><div class="small" style="color:var(--good)">In 120–170 for talking</div></div>
<div class="box" style="flex:1;display:block"><div class="small">Heard clearly</div><div style="font-family:Bricolage;font-weight:800;font-size:34px">39 <span class="small">of 41</span></div><div class="small">words</div></div></div>
<div style="font-size:17px;line-height:25px">Steady all the way through. Two words didn’t come through. Practise them, then read it once more.</div>
<div class="card" style="gap:12px"><div class="eyebrow">WORDS TO PRACTISE</div>
<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-family:Literata;font-weight:700;font-size:22px">forecasting</span><span class="pill">I said it</span></div>
<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-family:Literata;font-weight:700;font-size:22px">decisions</span><span class="pill">I said it</span></div>
<div class="small" style="color:var(--cardMuted)">Speech recognition gets some words wrong. Tap any you said.</div>
<div class="cbtn">Practise them · 1 min</div></div>
</div><div class="home"></div>'''


def st_pack():
    words = [('fiduciary', 'fi·DOO·shee·air·y', 'Legally bound to act in someone else’s best interest.', 'Comfortable'),
             ('amortization', 'am·or·ti·ZA·tion', 'Spreading a cost or loan out over time.', 'In context'),
             ('reconciliation', 'rec·on·cil·i·A·tion', 'Checking that two sets of records match.', 'Heard'),
             ('liquidity', 'li·QUID·i·ty', 'How quickly something turns into cash.', 'New')]
    rows = ''.join(f"""<div class="box" style="display:block;padding:14px 16px">
<div style="display:flex;align-items:center;gap:10px"><div style="flex:1"><span style="font-family:Literata;font-weight:700;font-size:22px">{w}</span>
<div style="font-size:14px;color:var(--muted);margin-top:2px">{sy}</div></div>
<div style="width:40px;height:40px;border-radius:20px;border:1px solid var(--line);display:flex;align-items:center;justify-content:center">{ico('speaker', 20, 'var(--ink)')}</div></div>
<div style="font-size:15px;line-height:21px;margin-top:8px">{m}</div>
<div class="small" style="margin-top:6px;font-weight:600">{st}</div></div>""" for w, sy, m, st in words)
    return f"""{status_bar()}<div class="pad" style="gap:12px;padding-top:8px">
<div class="eyebrow">WORD PACK · 8 WORDS</div>
<div class="h1" style="margin-top:-6px">Finance floor</div>
<div class="lead" style="margin-top:-4px">Words you’ll say in a morning update or a client call.</div>
<div class="btn">Learn these words · 2 min</div>
{rows}
</div><div class="home"></div>"""

def st_minute():
    bars = ''.join(f'<div class="bar" style="height:{h}px"></div>' for h in [6,10,18,26,14,8,20,28,16,10,6,12,22,30,18,9,14,24,12,7,5,9,16,22,12,6,10,18,8,5,4,4,4,4])
    return f"""{status_bar()}
<div class="gtop">{ico('x', 20, 'var(--muted)')}<span style="flex:1">One minute</span><span>0:38</span></div>
<div class="track"><div class="fill" style="width:37%"></div></div>
<div style="padding:90px 24px 0;display:flex;flex-direction:column;gap:18px">
<div class="eyebrow">TALK ABOUT THIS</div>
<div style="font-family:Literata;font-weight:700;font-size:30px;line-height:42px">Describe a project you’re proud of, and what you’d do differently.</div>
<div class="lead">No script. Just keep going. A pause is fine.</div></div>
<div class="foot"><div class="bars">{bars}</div><div style="display:flex;align-items:baseline;gap:4px">
<span style="font-family:Bricolage;font-weight:800;font-size:28px">128</span><span class="small">wpm</span></div>
<span style="font-size:15px;font-weight:600;color:var(--muted);margin-left:10px">Finish</span></div>
<div class="paceline"></div><div class="home"></div>"""

def st_privacy():
    return s_firstread(offline=True)

SLIDES = [
    ('slide1-rehearse', 'Rehearse what you’ll say', 'Your interview answer inks in, word by word, as you say it.', st_glide),
    ('slide2-words', 'Find the words for any subject', 'Word packs for your field. Hear each word, then say it in a sentence.', st_pack),
    ('slide3-overrule', 'Said it? Tap it.', 'If the phone misses a word you said, tap it. You decide, not the phone.', st_overrule),
    ('slide4-plan', 'Ready by the day it counts', 'Five short steps, counted down to your date.', st_plan),
    ('slide5-one-minute', 'Say it clearly, no script', 'One minute on a prompt. See your pace and your pauses.', st_minute),
    ('slide6-privacy', 'Asks before your voice leaves', 'It listens on your phone when your phone can. Recordings only if you turn them on. No account.', st_privacy),
    ('alt-practise', 'Then practise the hard words', 'See your pace and the words that didn’t come through. Practise them alone, then in a sentence.', st_tape),
]

def svg_screen(body, theme):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844">
<style>{css(theme)}</style>
<foreignObject x="0" y="0" width="390" height="844"><div xmlns="http://www.w3.org/1999/xhtml" class="root"><div class="scr">{body}</div></div></foreignObject></svg>'''

def svg_slide(head, sub, body, theme, callout=None):
    W, H = 1320, 2868
    scale = 2.5
    pw, ph = 390 * scale, 844 * scale  # 975 x 2110
    px = (W - pw) / 2
    py = 700
    bez = 22
    call = ''
    if callout:
        call = callout
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
<style>{css(theme)}</style>
<rect width="{W}" height="{H}" fill="{theme['bg']}"/>
<foreignObject x="0" y="0" width="{W}" height="{H}"><div xmlns="http://www.w3.org/1999/xhtml" class="root" style="width:{W}px;height:{H}px;position:relative">
<div style="position:absolute;left:110px;right:110px;top:190px;text-align:center;font-family:Bricolage;font-weight:800;font-size:104px;line-height:112px;letter-spacing:-1.5px;color:var(--ink)">{head}</div>
<div style="position:absolute;left:150px;right:150px;top:{190 + (112 if len(head) <= 18 else 224) + 40}px;text-align:center;font-family:-apple-system,'Segoe UI',sans-serif;font-size:46px;line-height:62px;color:var(--muted)">{sub}</div>
<div style="position:absolute;left:{px - bez}px;top:{py - bez}px;width:{pw + 2 * bez}px;height:{ph + 2 * bez}px;border-radius:{58 * scale / 2 + bez}px;background:{'#0B0C10' if theme is LIGHT else '#2A2E3C'};"></div>
<div style="position:absolute;left:{px}px;top:{py}px;width:390px;height:844px;transform:scale({scale});transform-origin:0 0;border-radius:46px;overflow:hidden"><div class="scr">{body}</div></div>
{call}
</div></foreignObject></svg>'''

OVERRULE_CALLOUT = '''<div style="position:absolute;left:170px;top:2010px;width:680px;background:var(--card);color:var(--cardInk);border-radius:36px;padding:36px 40px;
font-family:-apple-system,'Segoe UI',sans-serif;font-size:40px;line-height:54px;font-weight:600">“forecasting, marked as missed. Tap if you said it.”
<div style="font-weight:400;font-size:34px;line-height:46px;color:var(--cardMuted);margin-top:12px">One tap and it turns dark. Your score updates.</div></div>'''

def render(svg_path, png_path, w, h):
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
                    f'--window-size={w},{h}', '--force-device-scale-factor=1', f'--screenshot={png_path}',
                    'file:///' + svg_path.replace('\\', '/')], check=True, capture_output=True)

if __name__ == '__main__':
    import sys
    only = sys.argv[1] if len(sys.argv) > 1 else ''
    for name, fn in SCREENS:
        if only and only not in name: continue
        for tname, theme in (('light', LIGHT), ('dark', DARK)):
            sp = os.path.join(HERE, f'{name}-{tname}.svg')
            open(sp, 'w', encoding='utf-8').write(svg_screen(fn(), theme))
            render(sp, os.path.join(OUT_ON, f'{name}-{tname}.png'), 390, 844)
    for name, head, sub, fn in SLIDES:
        if only and only not in name: continue
        sp = os.path.join(HERE, f'{name}.svg')
        open(sp, 'w', encoding='utf-8').write(svg_slide(head, sub, fn(), LIGHT, OVERRULE_CALLOUT if 'overrule' in name else None))
        render(sp, os.path.join(OUT_ST, f'{name}.png'), 1320, 2868)
    print('done')
