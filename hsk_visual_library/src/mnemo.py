"""Tạo hướng dẫn ghi nhớ mặt chữ + ảnh trực quan (biểu tượng cho từng bộ, nhãn NGHĨA / ÂM)."""
import re
from collections import defaultdict
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont
from pypinyin import pinyin, Style
from fontTools.ttLib import TTCollection
from visual import ICON, PICTO

SEMANTIC = set('口亻扌木讠辶日氵宀月心忄女土纟糸刂灬目阝禾力贝彳⺮艹页隹冫石钅犭饣礻衤疒⻊足𧾷攵欠囗广厂尸冖穴耳米虫衣示车舟弓巾酉皿火水手言金食见走马鸟鱼羽雨革山田白立门户斤戈殳寸又子儿人大夕王玉矢羊牛犬角皮豕鼠自舌足页首')


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


def split_final(p):
    for ini in ('zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'):
        if p.startswith(ini):
            return ini, p[len(ini):]
    return '', p


def role(ch, comp):
    """'am' nếu thành phần gợi âm, 'nghia' nếu gợi nghĩa, '' nếu không rõ."""
    a, b = base_py(ch), base_py(comp)
    if a and b and a == b:
        return 'am'
    if comp in SEMANTIC:
        return 'nghia'
    if a and b:
        ia, fa = split_final(a)
        ib, fb = split_final(b)
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


def build_families(rows):
    fam = defaultdict(set)
    for r in rows:
        for c in r['chars']:
            for comp, _ in c['comps']:
                if role(c['ch'], comp) == 'am':
                    fam[comp].add(c['ch'])
    return fam


def char_hint(c, fam):
    ch, comps = c['ch'], c['comps']
    if ch in PICTO:
        e = ICON.get(ch, (None,))[0]
        return f"{ch}: chữ tượng hình {e or '🖼️'} – {PICTO[ch]}.", 'picto'
    if not comps:
        return f"{ch}: chữ gốc – nhớ theo hình dáng toàn chữ, viết 3–5 lần.", 'goc'
    parts, roles = [], []
    for comp, lbl in comps:
        e, m = label_of(comp, lbl)
        rl = role(ch, comp) if len(comps) >= 2 else ''
        roles.append(rl)
        tag = ' [gợi NGHĨA]' if rl == 'nghia' else (f' [gợi ÂM {tone_py(comp)}]' if rl == 'am' else '')
        parts.append(f"{e + ' ' if e else ''}{comp}{' (' + m + ')' if m else ''}{tag}")
    s = f"{ch} = " + ' + '.join(parts)
    if 'am' in roles and 'nghia' in roles:
        sem = [label_of(cp, l)[1] for (cp, l), rl in zip(comps, roles) if rl == 'nghia']
        ph = [cp for (cp, l), rl in zip(comps, roles) if rl == 'am'][0]
        s += f" → chữ HÌNH THANH: nghĩa liên quan '{', '.join(x for x in sem if x)}', đọc gần '{tone_py(ph)}'."
        others = sorted(fam.get(ph, set()) - {ch})[:5]
        if others:
            s += f" Cùng họ âm {ph}: {' '.join(others)}."
        kind = 'hinhthanh'
    else:
        ms = [label_of(cp, l)[1] for cp, l in comps]
        ms = [m for m in ms if m]
        if len(ms) >= 2:
            s += f" → chữ HỘI Ý: hình dung '{' + '.join(ms)}' ghép lại thành nghĩa của chữ."
        kind = 'hoiy'
    return s, kind


def mnemonic(row, fam, story=None):
    lines = []
    if story:
        lines.append('💡 ' + story)
    seen = set()
    for c in row['chars']:
        if c['ch'] in seen:
            continue
        seen.add(c['ch'])
        lines.append(char_hint(c, fam)[0])
    lines.append(f"⇒ {row['word']} = {row['nghia']}")
    return '\n'.join(lines)


# ------------------ ẢNH TRỰC QUAN ------------------
S = 2
CJKB = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
CJK = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
LAT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
LATB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
EMO = '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf'
RED, NAVY, BLUE, PINK, GREY = (200, 16, 46), (55, 66, 74), (31, 78, 121), (252, 228, 234), (150, 156, 162)
f_big = ImageFont.truetype(CJKB, 44 * S)
f_cmp = ImageFont.truetype(CJK, 16 * S)
f_hv = ImageFont.truetype(LATB, 11 * S)
f_lbl = ImageFont.truetype(LAT, 9 * S)
f_tag = ImageFont.truetype(LATB, 8 * S)
f_op = ImageFont.truetype(LATB, 18 * S)
f_mean = ImageFont.truetype(LATB, 12 * S)
f_emo = ImageFont.truetype(EMO, 109)

_cmap = set()
for font in TTCollection(CJK).fonts[:1]:
    _cmap |= set(font.getBestCmap().keys())


def has_glyph(c):
    return all(ord(x) in _cmap for x in c)


@lru_cache(None)
def emoji_img(e, size):
    im = Image.new('RGBA', (160, 160), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text((4, 4), e, font=f_emo, embedded_color=True)
    bb = im.getbbox()
    im = im.crop(bb) if bb else im
    im.thumbnail((size, size), Image.LANCZOS)
    return im


def _wrap(d, text, font, width, maxl=3):
    out, cur = [], ''
    for w in text.split():
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=font) <= width:
            cur = t
        else:
            if cur:
                out.append(cur)
            cur = w
    if cur:
        out.append(cur)
    return out[:maxl]


def _ctext(d, cx, y, t, font, fill):
    d.text((cx - d.textlength(t, font=font) / 2, y), t, font=font, fill=fill)


def render_visual(row, path):
    H = 150 * S
    BOX = 62 * S
    TW = 66 * S  # bề rộng ô thành phần
    blocks = []
    _seen = set()
    for c in row['chars']:
        if c['ch'] in _seen:
            continue
        _seen.add(c['ch'])
        comps = c['comps'] if c['comps'] else []
        is_picto = c['ch'] in PICTO
        n = 0 if is_picto else len(comps)
        w = BOX + (16 * S + n * TW + (n - 1) * 10 * S if n else (120 * S if is_picto else 0))
        blocks.append((c, comps, is_picto, w))
    meanw = 150 * S
    W = 10 * S + sum(b[3] for b in blocks) + 22 * S * (len(blocks) - 1) + 24 * S + meanw + 10 * S
    img = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(img)
    x = 10 * S
    y0 = 16 * S
    for i, (c, comps, is_picto, w) in enumerate(blocks):
        d.rounded_rectangle([x, y0, x + BOX, y0 + BOX], radius=8 * S, fill=PINK, outline=RED, width=2 * S)
        bb = d.textbbox((0, 0), c['ch'], font=f_big)
        d.text((x + (BOX - (bb[2] - bb[0])) / 2 - bb[0], y0 + (BOX - (bb[3] - bb[1])) / 2 - bb[1]), c['ch'], font=f_big, fill=RED)
        _ctext(d, x + BOX / 2, y0 + BOX + 5 * S, (c['hv'] or '').capitalize(), f_hv, NAVY)
        _ctext(d, x + BOX / 2, y0 + BOX + 19 * S, tone_py(c['ch']), f_lbl, BLUE)
        cx = x + BOX + 8 * S
        if is_picto:
            e = ICON.get(c['ch'], ('🖼️',))[0]
            em = emoji_img(e, 34 * S)
            img.paste(em, (int(cx + 4 * S), int(y0)), em)
            d.text((cx + 44 * S, y0 + 6 * S), 'TƯỢNG HÌNH', font=f_tag, fill=RED)
            ly = y0 + 40 * S
            for line in _wrap(d, PICTO[c['ch']], f_lbl, 112 * S, 4):
                d.text((cx + 2 * S, ly), line, font=f_lbl, fill=NAVY)
                ly += 11 * S
        elif comps:
            _ctext(d, cx, y0 + BOX / 2 - 13 * S, '=', f_op, GREY)
            cx += 10 * S
            for k, (comp, lbl) in enumerate(comps):
                if k:
                    _ctext(d, cx - 5 * S, y0 + BOX / 2 - 13 * S, '+', f_op, GREY)
                e, m = label_of(comp, lbl)
                rl = role(c['ch'], comp) if len(comps) >= 2 else ''
                tx = cx
                # ô thành phần
                d.rounded_rectangle([tx + 4 * S, y0 - 6 * S, tx + TW - 4 * S, y0 + BOX + 4 * S], radius=6 * S,
                                    outline=(RED if rl == 'nghia' else BLUE if rl == 'am' else (210, 214, 218)), width=1 * S, fill='white')
                if e:
                    em = emoji_img(e, 28 * S)
                    img.paste(em, (int(tx + (TW - em.width) / 2), int(y0 - 2 * S)), em)
                    cy = y0 + 30 * S
                else:
                    cy = y0 + 8 * S
                if has_glyph(comp):
                    _ctext(d, tx + TW / 2, cy, comp, f_cmp if e else ImageFont.truetype(CJK, 26 * S), NAVY)
                else:
                    _ctext(d, tx + TW / 2, cy + 8 * S, '(nét cổ)', f_lbl, GREY)
                ly = y0 + BOX + 8 * S
                for line in _wrap(d, m or '', f_lbl, TW - 4 * S, 2):
                    _ctext(d, tx + TW / 2, ly, line, f_lbl, NAVY)
                    ly += 11 * S
                if rl:
                    t = 'NGHĨA' if rl == 'nghia' else 'ÂM ' + tone_py(comp)
                    tw = d.textlength(t, font=f_tag) + 8 * S
                    d.rounded_rectangle([tx + (TW - tw) / 2, ly + 1 * S, tx + (TW + tw) / 2, ly + 13 * S], radius=5 * S,
                                        fill=RED if rl == 'nghia' else BLUE)
                    _ctext(d, tx + TW / 2, ly + 2 * S, t, f_tag, (255, 255, 255))
                cx += TW + 10 * S
        x += w + 22 * S
    # nghĩa cuối
    _ctext(d, x - 10 * S, y0 + BOX / 2 - 13 * S, '⇒', f_op, RED)
    mx = x + 6 * S
    d.rounded_rectangle([mx, y0 + 4 * S, mx + meanw, y0 + BOX - 4 * S], radius=8 * S, fill=NAVY)
    lines = _wrap(d, row['nghia'], f_mean, meanw - 12 * S, 3)
    ly = y0 + BOX / 2 - len(lines) * 8 * S
    for line in lines:
        _ctext(d, mx + meanw / 2, ly, line, f_mean, (255, 255, 255))
        ly += 16 * S
    img = img.resize((W // S, H // S), Image.LANCZOS).convert('P', palette=Image.ADAPTIVE, colors=128)
    img.save(path, optimize=True)


def render_icon_tile(comp, e, path):
    im = Image.new('RGB', (64 * S, 64 * S), 'white')
    d = ImageDraw.Draw(im)
    if e:
        em = emoji_img(e, 40 * S)
        im.paste(em, (int((64 * S - em.width) / 2), 2 * S), em)
    if has_glyph(comp):
        _ctext(d, 32 * S, 42 * S, comp, f_cmp, NAVY)
    im = im.resize((64, 64), Image.LANCZOS).convert('P', palette=Image.ADAPTIVE, colors=128)
    im.save(path, optimize=True)
