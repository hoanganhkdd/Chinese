import json, glob, os, re, csv, sys
from collections import Counter
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.drawing.image import Image as XLImage
from openpyxl.utils import get_column_letter
from ambo import ambo, display
from py_util import sentence_pinyin
from render import render
from data import WORDS as OFFICE
from mnemo import mnemonic, build_families, render_visual, render_icon_tile, role, tone_py
from visual import ICON

OUT = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/hsk/out.xlsx'
base = json.load(open('/home/claude/hsk/base.json', encoding='utf-8'))
office = {w[2]: w for w in OFFICE}

content = {}
for f in sorted(glob.glob('/home/claude/hsk/c*.txt')):
    for line in open(f, encoding='utf-8'):
        line = line.strip()
        if not line or '|' not in line:
            continue
        p = line.split('|')
        if len(p) != 4:
            print('BAD LINE', f, line); continue
        content[int(p[0])] = p[1:]

rows = []
for b in base:
    w = b['word']
    if w in office:
        o = office[w]
        nghia, vd, vdpy, vdvi, ct = o[6], o[7], o[8], o[9], o[5]
    elif b['id'] in content:
        nghia, vd, vdvi = content[b['id']]
        vdpy, ct = None, None
    else:
        continue
    if ct is None:
        parts = []
        for c in b['chars']:
            if c['comps']:
                parts.append(f"{c['ch']} = " + ' + '.join(f"{x}({l})" if l else x for x, l in c['comps']))
            else:
                parts.append(f"{c['ch']}: chữ gốc, không tách nhỏ")
        ct = '; '.join(parts)
    rows.append(dict(b, nghia=nghia, vd=vd, vdpy=vdpy, vdvi=vdvi, ct=ct, story=(o[5] if w in office else None)))

if os.environ.get('LIMIT'): rows = rows[int(os.environ['LIMIT'].split(':')[0]):int(os.environ['LIMIT'].split(':')[1])]
print(len(rows), 'rows with content')
IMG = '/home/claude/hsk/img'
VIS = '/home/claude/hsk/vis'
os.makedirs(VIS, exist_ok=True)
fam = build_families(rows)
os.makedirs(IMG, exist_ok=True)

NAVY, RED, PINK = "37424A", "C8102E", "FCE4EA"
F, CJK = "Arial", "Microsoft YaHei"
thin = Side(style="thin", color="D0D4D8")
B = Border(left=thin, right=thin, top=thin, bottom=thin)
wrap = Alignment(wrap_text=True, vertical="center")
center = Alignment(horizontal="center", vertical="center", wrap_text=True)

wb = Workbook()
guide = wb.active
guide.title = "Cách học"

ws = wb.create_sheet("2000 từ")
headers = ["STT", "HSK", "Từ vựng", "Pinyin", "Âm bồi", "Hán Việt", "Chiết tự", "Nghĩa tiếng Việt",
           "Ví dụ (tiếng Trung)", "Pinyin câu ví dụ", "Giải thích tiếng Việt", "Ảnh chiết tự",
           "Cách nhớ mặt chữ", "Hình ảnh ghi nhớ (thư viện trực quan)"]
widths = [6, 7, 11, 13, 15, 16, 36, 26, 30, 36, 34, 70, 60, 110]
for i, (h, wd) in enumerate(zip(headers, widths), 1):
    c = ws.cell(1, i, h)
    c.font = Font(name=F, bold=True, color="FFFFFF", size=10)
    c.fill = PatternFill("solid", fgColor=RED)
    c.alignment = center
    c.border = B
    ws.column_dimensions[get_column_letter(i)].width = wd
ws.row_dimensions[1].height = 28

maxw = 0
anki = []
for n, r in enumerate(rows, 2):
    syl = r['syl']
    py = display(syl.replace(' ', '/')) if False else ''.join(syl.split())
    am = ambo(syl)
    vdpy = r['vdpy'] or sentence_pinyin(r['vd'])
    vals = [r['id'], f"HSK {r['hsk']}", r['word'], py, am, r['hanviet'], r['ct'], r['nghia'], r['vd'], vdpy, r['vdvi']]
    band = PatternFill("solid", fgColor=PINK) if r['hsk'] % 2 == 0 else None
    for i, v in enumerate(vals, 1):
        c = ws.cell(n, i, v)
        c.border = B
        c.alignment = center if i in (1, 2, 3) else wrap
        if i == 3:
            c.font = Font(name=CJK, size=16, bold=True, color=RED)
        elif i == 9:
            c.font = Font(name=CJK, size=11, color=NAVY)
        elif i == 7:
            c.font = Font(name=CJK, size=9, color=NAVY)
        elif i in (4, 10):
            c.font = Font(name=F, size=10, color="1F4E79")
        elif i == 5:
            c.font = Font(name=F, size=10, italic=True, color="7F7F7F")
        elif i in (6, 8):
            c.font = Font(name=F, size=10, bold=(i == 8), color=NAVY)
        else:
            c.font = Font(name=F, size=9, color=NAVY)
        if band:
            c.fill = band
    ws.cell(n, 12).border = B
    p = f"{IMG}/{r['id']:04d}.png"
    if not os.path.exists(p):
        render(r['chars'], p)
    img = XLImage(p)
    maxw = max(maxw, img.width)
    ws.add_image(img, f"L{n}")
    mn = mnemonic(r, fam, r.get('story'))
    r['mn'] = mn
    c = ws.cell(n, 13, mn)
    c.alignment = Alignment(wrap_text=True, vertical='center')
    c.font = Font(name=CJK, size=9, color=NAVY)
    c.border = B
    if band:
        c.fill = band
    ws.cell(n, 14).border = B
    pv = f"{VIS}/{r['id']:04d}.png"
    if not os.path.exists(pv):
        render_visual(r, pv)
    ws.add_image(XLImage(pv), f"N{n}")
    ws.row_dimensions[n].height = 118
    anki.append([r['word'], py, am, r['hanviet'], r['nghia'], r['ct'], r['vd'], vdpy, r['vdvi'], f"HSK{r['hsk']}",
                 f"{r['id']:04d}.png"])
ws.column_dimensions['L'].width = max(70, maxw / 7)
ws.column_dimensions['N'].width = 120
ws.freeze_panes = "D2"
ws.auto_filter.ref = f"A1:K{len(rows) + 1}"

# ---- Bộ thủ thường gặp ----
cnt, lbl, ex = Counter(), {}, {}
for r in rows:
    for c in r['chars']:
        for comp, l in c['comps']:
            cnt[comp] += 1
            lbl.setdefault(comp, l)
            ex.setdefault(comp, [])
            if c['ch'] not in ex[comp] and len(ex[comp]) < 8:
                ex[comp].append(c['ch'])
bt = wb.create_sheet("Bộ thủ hay gặp")
for i, (h, wd) in enumerate(zip(["Hạng", "Bộ / thành phần", "Tên Hán Việt – nghĩa", "Số chữ có bộ này (trong danh sách)", "Chữ ví dụ"],
                               [7, 16, 30, 18, 40]), 1):
    c = bt.cell(1, i, h)
    c.font = Font(name=F, bold=True, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor=NAVY)
    c.alignment = center
    c.border = B
    bt.column_dimensions[get_column_letter(i)].width = wd
for k, (comp, nn) in enumerate(cnt.most_common(100), 2):
    vals = [k - 1, comp, lbl.get(comp) or '', nn, ' '.join(ex[comp])]
    for i, v in enumerate(vals, 1):
        c = bt.cell(k, i, v)
        c.border = B
        c.alignment = center if i in (1, 2, 4) else wrap
        c.font = Font(name=CJK if i in (2, 5) else F, size=16 if i == 2 else 11, bold=(i == 2),
                      color=RED if i == 2 else NAVY)
    bt.row_dimensions[k].height = 26
bt.freeze_panes = "A2"

# ---- Thư viện hình ảnh ----
TIL = '/home/claude/hsk/tiles'
os.makedirs(TIL, exist_ok=True)
lib = wb.create_sheet("Thư viện hình ảnh", 2)
hdr = ["Hạng", "Biểu tượng", "Bộ / thành phần", "Nghĩa (hình ảnh)", "Tên Hán Việt", "Số chữ có bộ này",
       "Vai trò hay gặp", "Chữ ví dụ trong 2.000 từ"]
for i, (h, wd) in enumerate(zip(hdr, [6, 11, 12, 22, 24, 12, 26, 44]), 1):
    c = lib.cell(1, i, h)
    c.font = Font(name=F, bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor=RED)
    c.alignment = center; c.border = B
    lib.column_dimensions[get_column_letter(i)].width = wd
roles = {}
for r in rows:
    for ch in r['chars']:
        if len(ch['comps']) >= 2:
            for comp, _ in ch['comps']:
                roles.setdefault(comp, Counter())[role(ch['ch'], comp) or 'khac'] += 1
k = 1
for comp, nn in cnt.most_common():
    if comp not in ICON:
        continue
    k += 1
    e, m = ICON[comp]
    tp = f"{TIL}/t_{ord(comp):x}.png"
    if not os.path.exists(tp):
        render_icon_tile(comp, e, tp)
    rc = roles.get(comp, Counter())
    vt = ', '.join(f"{'gợi NGHĨA' if a == 'nghia' else 'gợi ÂM' if a == 'am' else 'khác'} {b_}" for a, b_ in rc.most_common())
    vals = [k - 1, None, comp, m, lbl.get(comp) or '', nn, vt, ' '.join(ex[comp])]
    for i, v in enumerate(vals, 1):
        c = lib.cell(k, i, v)
        c.border = B
        c.alignment = center if i in (1, 3, 6) else wrap
        c.font = Font(name=CJK if i in (3, 8) else F, size=18 if i == 3 else 11, bold=i in (3, 4), color=RED if i == 3 else NAVY)
    lib.add_image(XLImage(tp), f"B{k}")
    lib.row_dimensions[k].height = 52
lib.freeze_panes = "A2"

# ---- Họ âm (hình thanh) ----
ha = wb.create_sheet("Họ âm hình thanh", 3)
for i, (h, wd) in enumerate(zip(["Phần gợi âm", "Đọc là", "Số chữ", "Các chữ cùng họ âm (trong 2.000 từ)", "Mẹo"],
                               [14, 12, 9, 50, 60]), 1):
    c = ha.cell(1, i, h)
    c.font = Font(name=F, bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor=NAVY)
    c.alignment = center; c.border = B
    ha.column_dimensions[get_column_letter(i)].width = wd
k = 1
for comp, chs in sorted(fam.items(), key=lambda kv: -len(kv[1])):
    if len(chs) < 2:
        continue
    k += 1
    chs = sorted(chs)
    tip = f"Thấy {comp} trong chữ → đoán âm gần '{tone_py(comp)}'; nhìn phần còn lại (bộ thủ) để đoán nghĩa."
    for i, v in enumerate([comp, tone_py(comp), len(chs), '  '.join(f"{c}({tone_py(c)})" for c in chs), tip], 1):
        c = ha.cell(k, i, v)
        c.border = B
        c.alignment = center if i in (1, 2, 3) else wrap
        c.font = Font(name=CJK if i in (1, 4) else F, size=20 if i == 1 else 11, bold=i == 1, color=RED if i == 1 else NAVY)
    ha.row_dimensions[k].height = 34
ha.freeze_panes = "A2"

# ---- Cách học ----
g = guide
g.sheet_view.showGridLines = False
g.column_dimensions["A"].width = 3
g.column_dimensions["B"].width = 30
g.column_dimensions["C"].width = 110
g["B2"] = "CÁCH HỌC 2.000 TỪ DỄ NHỚ NHẤT"
g["B2"].font = Font(name=F, size=16, bold=True, color=RED)
g["B3"] = f"Đã có nội dung: {len(rows)} / 2.000 từ (HSK 1–4 + 804 từ đầu HSK 5 theo danh sách bạn gửi)."
g["B3"].font = Font(name=F, size=10, italic=True, color=NAVY)
steps = [
    ("1. Học 50 bộ thủ trước", "Mở sheet 'Bộ thủ hay gặp'. 50 bộ đầu xuất hiện trong phần lớn chữ của 2.000 từ. Thuộc tên Hán Việt + nghĩa của bộ (氵 thủy = nước, 扌 thủ = tay, 讠 ngôn = lời nói…) thì gặp chữ mới bạn đoán được nghĩa gần đúng ngay."),
    ("★ Cột 'Cách nhớ mặt chữ' & 'Hình ảnh ghi nhớ'", "Mỗi chữ được tách thành bộ, mỗi bộ có một biểu tượng hình ảnh (💧 nước, 🌳 cây, 💬 lời nói…). Viền ĐỎ + nhãn NGHĨA = phần gợi nghĩa; viền XANH + nhãn ÂM = phần gợi cách đọc. Chữ HÌNH THANH = 1 phần nghĩa + 1 phần âm (khoảng 80% chữ Hán). Chữ HỘI Ý = ghép nghĩa các phần. Chữ TƯỢNG HÌNH = vẽ lại hình vật thật. Tra toàn bộ biểu tượng ở sheet 'Thư viện hình ảnh', học các chữ cùng âm ở sheet 'Họ âm hình thanh'."),
    ("2. Nhớ chữ bằng câu chuyện", "Nhìn cột 'Ảnh chiết tự': chữ = bộ A + bộ B. Tự bịa 1 câu chuyện ngắn, càng hài càng nhớ lâu. Ví dụ 休 = 亻người + 木 cây → người dựa gốc cây = NGHỈ. 忙 = 忄lòng + 亡 mất → mất cả tâm trí = BẬN. Viết câu chuyện của bạn vào cột trống bên cạnh."),
    ("3. Dùng Hán Việt làm cầu nối", "Người Việt có lợi thế lớn: khoảng 60% từ ở đây có âm Hán Việt gần nghĩa tiếng Việt (准备 chuẩn bị,问题 vấn đề,经济 kinh tế, 合同 hợp đồng). Đọc Hán Việt trước, đoán nghĩa, rồi mới xem nghĩa tiếng Việt."),
    ("4. Học cả cụm, không học chữ rời", "Luôn đọc to cả câu ví dụ (cột Ví dụ + Pinyin câu ví dụ). Não nhớ câu dễ hơn nhớ từ rời, và bạn dùng được ngay khi nói chuyện với A."),
    ("5. Lặp lại ngắt quãng (quan trọng nhất)", "Ôn lại đúng lúc sắp quên: sau 1 ngày → 3 ngày → 7 ngày → 14 ngày → 30 ngày. Cách dễ nhất: nhập file 'anki_2000_tu.csv' (đi kèm) vào app Anki, mỗi ngày học 15 từ mới + ôn các thẻ đến hạn, khoảng 20–30 phút."),
    ("6. Nhịp học đề xuất", "15 từ mới/ngày × 6 ngày/tuần ≈ 22 tuần cho 2.000 từ (khớp mục tiêu 6 tháng). Thứ tự: HSK 1 → 2 → 3 → 4 → 5 (dùng nút lọc cột HSK). Ngày thứ 7: không học mới, chỉ ôn và luyện nói."),
    ("7. Mỗi từ học theo 5 bước (2 phút)", "① Nghe & đọc pinyin to 3 lần (đúng thanh điệu) → ② Xem ảnh chiết tự, tạo câu chuyện → ③ Đọc Hán Việt, đoán nghĩa → ④ Đọc to câu ví dụ → ⑤ Tự đặt 1 câu mới về công việc của bạn với A."),
    ("8. Viết tay chữ khó", "Chỉ cần viết tay các chữ bạn hay quên (không cần viết hết 2.000 từ). Viết 5 lần, vừa viết vừa đọc tên các bộ: 'ngôn + xạ = tạ'."),
    ("9. Nói ra mỗi ngày", "Mỗi tối nhắn cho A (hoặc cho Claude đóng vai A) 3 câu dùng từ mới học. Từ được dùng trong giao tiếp thật sẽ nhớ lâu gấp nhiều lần từ chỉ đọc."),
    ("10. Lưu ý về âm bồi & thanh điệu", "Âm bồi chỉ để nhớ nhanh, không chính xác 100% — luôn lấy Pinyin làm chuẩn và nghe phát âm thật (Pleco, Google Translate). Thanh 1 = không dấu (cao đều), 2 = sắc (đi lên), 3 = hỏi (xuống rồi lên), 4 = huyền nhưng đọc dứt khoát từ cao xuống. Pinyin đã ghi biến điệu của 一 và 不 (一下 yíxià, 不客气 bú kèqi)."),
    ("Nguồn dữ liệu", "Danh sách từ: file HSK bạn gửi. Pinyin: từ điển CC-CEDICT (có chỉnh tay chữ đa âm). Hán Việt: bộ dữ liệu hanviet-pinyin-wordlist (GitHub ph0ngp). Tách bộ: dữ liệu hanzipy. Ảnh chiết tự do Claude tự vẽ từ dữ liệu tách bộ. Nghĩa, câu ví dụ: Claude soạn — nên đối chiếu thêm khi gặp từ khó."),
]
r = 5
for k, v in steps:
    a = g.cell(r, 2, k)
    a.font = Font(name=F, size=10, bold=True, color="FFFFFF")
    a.fill = PatternFill("solid", fgColor=NAVY if not k.startswith('5') else RED)
    a.alignment = wrap
    c = g.cell(r, 3, v)
    c.font = Font(name=F, size=10, color=NAVY)
    c.alignment = wrap
    for col in (2, 3):
        g.cell(r, col).border = B
    g.row_dimensions[r].height = 48
    r += 1

wb.save(OUT)
with open(os.path.splitext(OUT)[0] + '_anki.csv', 'w', encoding='utf-8-sig', newline='') as f:
    csv.writer(f).writerows(anki)
print('saved', OUT)
