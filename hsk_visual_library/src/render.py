"""Vẽ sơ đồ chiết tự cho một từ: mỗi chữ = các bộ phận (kèm nghĩa Hán Việt)."""
from PIL import Image, ImageDraw, ImageFont

S = 2  # vẽ ở độ phân giải gấp đôi
CJK = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
CJKB = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
LAT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
LATB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
RED, NAVY, PINK, GREY = (200, 16, 46), (55, 66, 74), (252, 228, 234), (150, 156, 162)

f_big = ImageFont.truetype(CJKB, 46 * S)
f_comp = ImageFont.truetype(CJK, 28 * S)
f_hv = ImageFont.truetype(LATB, 11 * S)
f_lbl = ImageFont.truetype(LAT, 9 * S)
f_op = ImageFont.truetype(LATB, 18 * S)

H = 128 * S
BOX = 64 * S
CBOX = 44 * S
LBLW = 62 * S


def _wrap(draw, text, font, width):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if draw.textlength(t, font=font) <= width:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines[:3]


def _center(draw, cx, y, text, font, fill):
    w = draw.textlength(text, font=font)
    draw.text((cx - w / 2, y), text, font=font, fill=fill)


def render(chars, path):
    """chars: list of {'ch','hv','comps':[(c,label)]}"""
    # tính bề rộng
    seg_w = []
    for c in chars:
        n = len(c['comps'])
        w = BOX + (20 * S + n * LBLW + max(0, n - 1) * 14 * S if n else 0)
        seg_w.append(w)
    W = sum(seg_w) + 24 * S * (len(chars) - 1) + 16 * S
    img = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(img)
    x = 8 * S
    for c, sw in zip(chars, seg_w):
        # khung chữ chính
        y0 = 10 * S
        d.rounded_rectangle([x, y0, x + BOX, y0 + BOX], radius=8 * S, fill=PINK, outline=RED, width=2 * S)
        bb = d.textbbox((0, 0), c['ch'], font=f_big)
        d.text((x + (BOX - (bb[2] - bb[0])) / 2 - bb[0], y0 + (BOX - (bb[3] - bb[1])) / 2 - bb[1]), c['ch'], font=f_big, fill=RED)
        _center(d, x + BOX / 2, y0 + BOX + 6 * S, (c['hv'] or '').capitalize(), f_hv, NAVY)
        cx = x + BOX + 6 * S
        if c['comps']:
            _center(d, cx + 4 * S, y0 + BOX / 2 - 13 * S, '=', f_op, GREY)
            cx += 14 * S
            for k, (comp, lbl) in enumerate(c['comps']):
                if k:
                    _center(d, cx - 7 * S, y0 + BOX / 2 - 13 * S, '+', f_op, GREY)
                bx = cx + (LBLW - CBOX) / 2
                by = y0 + (BOX - CBOX) / 2
                d.rounded_rectangle([bx, by, bx + CBOX, by + CBOX], radius=6 * S, fill='white', outline=NAVY, width=1 * S)
                try:
                    bb = d.textbbox((0, 0), comp, font=f_comp)
                    d.text((bx + (CBOX - (bb[2] - bb[0])) / 2 - bb[0], by + (CBOX - (bb[3] - bb[1])) / 2 - bb[1]), comp, font=f_comp, fill=NAVY)
                except Exception:
                    pass
                ly = by + CBOX + 4 * S
                for line in _wrap(d, lbl or '', f_lbl, LBLW - 2 * S):
                    _center(d, cx + LBLW / 2, ly, line, f_lbl, NAVY)
                    ly += 11 * S
                cx += LBLW + 14 * S
        x += sw + 24 * S
    img = img.resize((W // S, H // S), Image.LANCZOS)
    img = img.convert('P', palette=Image.ADAPTIVE, colors=64)
    img.save(path, optimize=True)
    return img.size


if __name__ == '__main__':
    print(render([{'ch': '谢', 'hv': 'tạ', 'comps': [('讠', 'ngôn – lời nói'), ('射', 'xạ')]},
                  {'ch': '谢', 'hv': 'tạ', 'comps': [('讠', 'ngôn – lời nói'), ('射', 'xạ')]}], '/home/claude/hsk/test.png'))
