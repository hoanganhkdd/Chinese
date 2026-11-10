# -*- coding: utf-8 -*-
"""Build thư viện học 2.000 từ HSK theo quy trình 7 bước "bẻ khóa chữ Hán".

Sinh ra:
  library/data.js    -> window.HSK = [ {..7-step data..} ]
  library/sprite.js  -> window.TWSPRITE = '<svg>..Twemoji symbols..</svg>'
  library/icons/*.svg (bản rời, theo PROMPT)
  report/missing.csv, report/missing_icons.csv

Chạy:  python src/build_library.py
Phụ thuộc: pypinyin (đã có). Twemoji tải qua internet (có cache ở library/icons).
"""
import os, re, json, sys, urllib.request
from collections import defaultdict
from functools import lru_cache

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from pypinyin import pinyin, Style
from visual import ICON, PICTO

LIB = os.path.join(ROOT, 'library')
ICONS = os.path.join(LIB, 'icons')
REPORT = os.path.join(ROOT, 'report')
for d in (LIB, ICONS, REPORT):
    os.makedirs(d, exist_ok=True)

TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg'

SEMANTIC = set('口亻扌木讠辶日氵宀月心忄女土纟糸刂灬目阝禾力贝彳⺮艹页隹冫石钅犭饣礻衤疒⻊足𧾷攵欠囗广厂尸冖穴耳米虫衣示车舟弓巾酉皿火水手言金食见走马鸟鱼羽雨革山田白立门户斤戈殳寸又子儿人大夕王玉矢羊牛犬角皮豕鼠自舌足页首')


# ---------------- pinyin helpers ----------------
@lru_cache(None)
def base_py(c):
    try:
        p = pinyin(c, style=Style.NORMAL, heteronym=False)[0][0]
        return '' if re.search(r'[^a-zü]', p) else p
    except Exception:
        return ''


@lru_cache(None)
def tone_py(c):
    try:
        return pinyin(c, style=Style.TONE)[0][0]
    except Exception:
        return ''


@lru_cache(None)
def tone_num(c):
    """Số thanh điệu 1-4 (0 nếu nhẹ/không rõ)."""
    try:
        p = pinyin(c, style=Style.TONE3, neutral_tone_with_five=False)[0][0]
        m = re.search(r'[1-4]', p)
        return int(m.group()) if m else 0
    except Exception:
        return 0


def sentence_pinyin(s):
    out = []
    for seg in pinyin(s, style=Style.TONE):
        out.append(seg[0])
    # ghép, bỏ khoảng trắng trước dấu câu
    txt = ' '.join(out)
    txt = re.sub(r'\s+([，。！？、；：,.!?;:])', r'\1', txt)
    return txt


def split_final(p):
    for ini in ('zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'):
        if p.startswith(ini):
            return ini, p[len(ini):]
    return '', p


def role(ch, comp):
    a, b = base_py(ch), base_py(comp)
    if a and b and a == b:
        return 'am'
    if comp in SEMANTIC:
        return 'nghia'
    if a and b:
        _, fa = split_final(a)
        _, fb = split_final(b)
        if fa and fa == fb and len(fa) >= 2:
            return 'am'
    return ''


def label_of(comp, lbl):
    e, m = ICON.get(comp, (None, None))
    if m:
        return e, m
    if lbl:
        return None, lbl.split('–')[-1].strip() if '–' in lbl else lbl
    return None, ''


# ---------------- load inputs ----------------
def load_base():
    with open(os.path.join(ROOT, 'data', 'base.json'), encoding='utf-8') as f:
        return json.load(f)


def load_content():
    d = {}
    cdir = os.path.join(ROOT, 'data', 'content')
    for fn in sorted(os.listdir(cdir)):
        if not fn.endswith('.txt'):
            continue
        for line in open(os.path.join(cdir, fn), encoding='utf-8'):
            line = line.rstrip('\n')
            if not line or '|' not in line:
                continue
            parts = line.split('|')
            if len(parts) < 4 or not parts[0].strip().isdigit():
                continue
            i = int(parts[0])
            d[i] = {'nghia': parts[1].strip(), 'vidu': parts[2].strip(), 'dich': parts[3].strip()}
    return d


def load_overrides():
    p = os.path.join(ROOT, 'data', 'overrides.json')
    try:
        raw = json.load(open(p, encoding='utf-8'))
    except Exception:
        return {}
    return {k: v for k, v in raw.items() if not k.startswith('_')}


def load_char_stories():
    p = os.path.join(ROOT, 'data', 'char_stories.json')
    try:
        raw = json.load(open(p, encoding='utf-8'))
    except Exception:
        return {}
    return {k: v for k, v in raw.items() if not k.startswith('_')}


CHAR_STORY = {}


def load_handwritten():
    """Lấy câu chuyện chiết tự viết tay + ví dụ có pinyin từ src/data.py (179 từ công sở)."""
    try:
        import data as office
    except Exception as e:
        print('  (bỏ qua data.py:', e, ')')
        return {}
    out = {}
    for row in office.WORDS:
        # (chủ đề, hsk, từ, pinyin, hánviệt, chiết tự, nghĩa, ví dụ, ví dụ pinyin, dịch)
        w = row[2]
        out[w] = {
            'story': row[5], 'nghia': row[6],
            'vidu': row[7], 'vidu_py': row[8], 'vidu_dich': row[9],
        }
    return out


def en_fallback(en):
    """Lấy nghĩa ngắn từ gloss tiếng Anh (CC-CEDICT) khi thiếu nghĩa tiếng Việt."""
    if not en:
        return ''
    s = en.split('|')[-1]            # bỏ phần tên riêng trước '|'
    s = s.split('/')[0].strip()      # nghĩa đầu tiên
    return s[:60]


# ---------------- classify + build per word ----------------
def build_families(base):
    fam = defaultdict(set)
    for r in base:
        for c in r['chars']:
            for comp, _ in c['comps']:
                if role(c['ch'], comp) == 'am':
                    fam[comp].add(c['ch'])
    return fam


EMOJI_USED = set()


def emoji_cp(e):
    """Codepoint theo quy ước Twemoji (bỏ FE0F nếu không có ZWJ)."""
    s = e if '‍' in e else e.replace('️', '')
    return '-'.join(f'{ord(c):x}' for c in s)


def reg_emoji(e):
    if e:
        EMOJI_USED.add(e)
        return emoji_cp(e)
    return None


def char_block(c, fam, ov):
    ch = c['ch']
    o = ov.get(ch, {})
    # override tách bộ
    if 'thanh_phan' in o:
        comps = [(x, ICON.get(x, (None, ''))[1]) for x in o['thanh_phan']]
    else:
        comps = list(c['comps'])
    block = {'ch': ch, 'py': tone_py(ch), 'hv': c.get('hv', ''), 'comps': []}
    if ch in CHAR_STORY:
        block['cs'] = CHAR_STORY[ch]

    if ch in PICTO:
        block['loai'] = 'tuonghinh'
        block['picto'] = PICTO[ch]
        block['ic'] = reg_emoji(ICON.get(ch, (None,))[0])
        return block
    if not comps:
        block['loai'] = 'goc'
        block['ic'] = reg_emoji(ICON.get(ch, (None,))[0])
        return block

    roles = []
    for comp, lbl in comps:
        e, m = label_of(comp, lbl)
        rl = o.get('vai_tro', {}).get(comp) or (role(ch, comp) if len(comps) >= 2 else '')
        roles.append(rl)
        block['comps'].append({
            'c': comp, 'ic': reg_emoji(e), 'nghia': m, 'hv': (lbl or '').split('–')[0].strip() if '–' in (lbl or '') else '',
            'role': rl, 'am': tone_py(comp) if rl == 'am' else '',
        })
    if 'am' in roles and 'nghia' in roles:
        block['loai'] = 'hinhthanh'
        ph = [cp for (cp, _), rl in zip(comps, roles) if rl == 'am'][0]
        block['hoam_key'] = ph
        block['hoam'] = sorted(fam.get(ph, set()) - {ch})[:8]
    else:
        block['loai'] = 'hoiy' if len(comps) >= 2 else 'goc'
    return block


def build(base, content, hand, ov, fam, missing):
    rows = []
    for r in base:
        i = r['id']
        cc = content.get(i, {})
        hw = hand.get(r['word'], {})
        nghia = cc.get('nghia', '') or hw.get('nghia', '')
        if not nghia:
            en = en_fallback(r.get('en', ''))
            if en:
                nghia = '[EN] ' + en
                missing.append((i, r['word'], 'nghia_en_fallback'))
            else:
                missing.append((i, r['word'], 'nghia'))
        vidu = hw.get('vidu') or cc.get('vidu', '')
        vidu_py = hw.get('vidu_py') or (sentence_pinyin(vidu) if vidu else '')
        vidu_dich = hw.get('vidu_dich') or cc.get('dich', '')
        chars = []
        seen = set()
        for c in r['chars']:
            if c['ch'] in seen:
                continue
            seen.add(c['ch'])
            chars.append(char_block(c, fam, ov))
        # câu chuyện: ưu tiên override, rồi viết tay, rồi auto
        story = ''
        if r['word'] in ov and ov[r['word']].get('cau_chuyen'):
            story = ov[r['word']]['cau_chuyen']
        elif hw.get('story'):
            story = hw['story']
        rows.append({
            'id': i, 'hsk': r['hsk'], 'word': r['word'], 'py': r['syl'],
            'hv': r.get('hanviet', ''), 'nghia': nghia,
            'tones': [tone_num(ch) for ch in r['word'] if '一' <= ch <= '鿿'],
            'chars': chars, 'story': story,
            'vd': vidu, 'vdp': vidu_py, 'vdd': vidu_dich,
        })
    return rows


# ---------------- Twemoji download + sprite ----------------
def fetch_icons(missing_icons):
    sprite = []
    for e in sorted(EMOJI_USED):
        cp = emoji_cp(e)
        dst = os.path.join(ICONS, cp + '.svg')
        svg = None
        if os.path.exists(dst):
            svg = open(dst, encoding='utf-8').read()
        else:
            url = f'{TWEMOJI_BASE}/{cp}.svg'
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'hsk-visual-library'})
                svg = urllib.request.urlopen(req, timeout=20).read().decode('utf-8')
                open(dst, 'w', encoding='utf-8').write(svg)
            except Exception as ex:
                missing_icons.append((e, cp, str(ex)[:60]))
                continue
        inner = re.sub(r'^<svg[^>]*>', '', svg).replace('</svg>', '').strip()
        sprite.append(f'<symbol id="tw-{cp}" viewBox="0 0 36 36">{inner}</symbol>')
    return '<svg width="0" height="0" style="position:absolute" aria-hidden="true">' + ''.join(sprite) + '</svg>'


def main():
    print('Đọc dữ liệu...')
    base = load_base()
    content = load_content()
    hand = load_handwritten()
    ov = load_overrides()
    CHAR_STORY.update(load_char_stories())
    print(f'  base={len(base)}  content={len(content)}  handwritten={len(hand)}  overrides={len(ov)}  char_stories={len(CHAR_STORY)}')
    fam = build_families(base)
    missing, missing_icons = [], []
    rows = build(base, content, hand, ov, fam, missing)

    print('Tải Twemoji (%d emoji)...' % len(EMOJI_USED))
    sprite = fetch_icons(missing_icons)

    with open(os.path.join(LIB, 'data.js'), 'w', encoding='utf-8') as f:
        f.write('window.HSK=' + json.dumps(rows, ensure_ascii=False, separators=(',', ':')) + ';')
    with open(os.path.join(LIB, 'sprite.js'), 'w', encoding='utf-8') as f:
        f.write('window.TWSPRITE=' + json.dumps(sprite, ensure_ascii=False) + ';')

    with open(os.path.join(REPORT, 'missing.csv'), 'w', encoding='utf-8') as f:
        f.write('id,word,field\n')
        for i, w, fld in missing:
            f.write(f'{i},{w},{fld}\n')
    with open(os.path.join(REPORT, 'missing_icons.csv'), 'w', encoding='utf-8') as f:
        f.write('emoji,codepoint,error\n')
        for e, cp, err in missing_icons:
            f.write(f'{e},{cp},"{err}"\n')

    # thống kê
    from collections import Counter
    loai = Counter()
    for r in rows:
        for c in r['chars']:
            loai[c.get('loai', '?')] += 1
    print('\n=== KẾT QUẢ ===')
    print(f'  Tổng từ: {len(rows)}')
    print(f'  Thiếu nghĩa: {sum(1 for m in missing if m[2]=="nghia")}')
    print(f'  Chữ theo loại: {dict(loai)}')
    print(f'  Emoji dùng: {len(EMOJI_USED)}  |  thiếu icon: {len(missing_icons)}')
    if missing_icons:
        print('   ', ', '.join(e for e, _, _ in missing_icons))
    print(f'  data.js: {os.path.getsize(os.path.join(LIB,"data.js"))//1024} KB')


if __name__ == '__main__':
    main()
