"""Dựng dữ liệu nền cho 2.000 từ: danh sách, pinyin, âm bồi, Hán Việt, tách bộ."""
import re, csv, ast, json, logging
logging.disable(logging.CRITICAL)
from pypinyin import pinyin, Style
from hanzipy.decomposer import HanziDecomposer
from hanzipy.dictionary import HanziDictionary
from ambo import ambo
from py_util import word_pinyin, word_numeric

SRC = '/mnt/user-data/uploads/487144d4-attachment.txt'
HV_CSV = '/home/claude/dl/hv/hanviet.csv'

# ---- danh sách 2000 từ ----
src = open(SRC, encoding='utf-8').read()
parts = re.split(r'𝑯𝑺𝑲 (\d):', src)
levels = {}
for k in range(1, len(parts), 2):
    levels[int(parts[k])] = [w.strip() for w in parts[k + 1].strip().split('，') if w.strip()]
words = []
seen = set()
for lv in (1, 2, 3, 4):
    for w in levels[lv]:
        if w not in seen:
            seen.add(w); words.append((lv, w))
for w in levels[5]:
    if len(words) >= 2000:
        break
    if w not in seen:
        seen.add(w); words.append((5, w))

# ---- Hán Việt theo (chữ, pinyin số) ----
hv = {}
hv_any = {}
with open(HV_CSV, encoding='utf-8') as f:
    for row in csv.DictReader(f):
        try:
            vals = ast.literal_eval(row['hanviet'])
        except Exception:
            vals = []
        if not vals:
            continue
        hv[(row['char'], row['pinyin'])] = vals[0]
        hv_any.setdefault(row['char'], vals[0])

from opencc import OpenCC
_cc = OpenCC('s2t')
HV_FIX = {'着': 'trước', '儿': 'nhi'}
def hv_char(ch, py_num):
    if ch in HV_FIX: return HV_FIX[ch]
    for c in (ch, _cc.convert(ch)):
        v = hv.get((c, py_num)) or hv.get((c, re.sub(r'\d', '5', py_num)))
        if v:
            return v
    return hv_any.get(ch) or hv_any.get(_cc.convert(ch), '')

# Tên Hán Việt của bộ thủ dạng biến thể
RADICAL_VN = {
    '讠': 'ngôn – lời nói', '言': 'ngôn – lời nói', '氵': 'thủy – nước', '扌': 'thủ – tay', '亻': 'nhân – người',
    '忄': 'tâm – lòng', '心': 'tâm – tim', '艹': 'thảo – cỏ', '辶': 'sước – bước đi', '宀': 'miên – mái nhà',
    '钅': 'kim – kim loại', '饣': 'thực – ăn', '纟': 'mịch – sợi tơ', '糸': 'mịch – sợi tơ', '阝': 'ấp/phụ – gò đất',
    '刂': 'đao – dao', '灬': 'hỏa – lửa', '火': 'hỏa – lửa', '攵': 'phộc – đánh nhẹ', '冫': 'băng – nước đá',
    '礻': 'thị – thần, lễ', '衤': 'y – áo', '犭': 'khuyển – chó', '月': 'nguyệt/nhục – trăng, thịt', '疒': 'nạch – bệnh',
    '彳': 'xích – bước chân', '廴': 'dẫn – bước dài', '冖': 'mịch – trùm lên', '亠': 'đầu – nắp', '丷': 'bát – tám',
    '罒': 'võng – lưới', '覀': 'á – che', '⺮': 'trúc – tre', '𧾷': 'túc – chân', '王': 'ngọc/vương – ngọc', '口': 'khẩu – miệng',
    '女': 'nữ – phụ nữ', '子': 'tử – con', '木': 'mộc – cây', '日': 'nhật – mặt trời', '土': 'thổ – đất', '人': 'nhân – người',
    '贝': 'bối – vỏ sò, tiền', '目': 'mục – mắt', '耳': 'nhĩ – tai', '手': 'thủ – tay', '力': 'lực – sức', '门': 'môn – cửa',
    '车': 'xa – xe', '马': 'mã – ngựa', '鸟': 'điểu – chim', '鱼': 'ngư – cá', '雨': 'vũ – mưa', '页': 'hiệt – đầu',
    '见': 'kiến – thấy', '石': 'thạch – đá', '禾': 'hòa – lúa', '米': 'mễ – gạo', '田': 'điền – ruộng', '山': 'sơn – núi',
    '水': 'thủy – nước', '寸': 'thốn – tấc, bàn tay', '又': 'hựu – tay phải', '大': 'đại – to', '小': 'tiểu – nhỏ',
    '十': 'thập – mười', '八': 'bát – tám', '儿': 'nhân – chân người', '几': 'kỷ – ghế nhỏ', '刀': 'đao – dao', '厂': 'hán – sườn núi',
    '广': 'nghiễm – mái hiên', '尸': 'thi – thây, thân', '巾': 'cân – khăn', '弓': 'cung – cái cung', '戈': 'qua – giáo mác',
    '方': 'phương – phương hướng', '欠': 'khiếm – há miệng, thiếu', '止': 'chỉ – dừng', '白': 'bạch – trắng', '立': 'lập – đứng',
    '穴': 'huyệt – hang', '虫': 'trùng – sâu bọ', '舌': 'thiệt – lưỡi', '自': 'tự – mũi, tự mình', '羊': 'dương – dê',
    '走': 'tẩu – chạy', '足': 'túc – chân', '身': 'thân – thân mình', '食': 'thực – ăn', '金': 'kim – vàng, kim loại',
    '夕': 'tịch – buổi tối', '工': 'công – thợ', '元': 'nguyên – đầu', '牛': 'ngưu – trâu', '犬': 'khuyển – chó', '衣': 'y – áo',
    '皿': 'mãnh – bát đĩa', '矢': 'thỉ – mũi tên', '斤': 'cân – cái rìu', '欠': 'khiếm – thiếu', '殳': 'thù – binh khí',
    '又': 'hựu – lại, tay', '丶': 'chủ – chấm', '一': 'nhất – một', '丨': 'cổn – nét sổ', '丿': 'phiệt – nét phẩy',
    '乙': 'ất', '亅': 'quyết – nét móc', '冂': 'quynh – vùng biên', '凵': 'khảm – há miệng', '勹': 'bao – bọc', '匚': 'phương – đồ chứa',
    '卩': 'tiết – đốt tre', '厶': 'khư/tư – riêng', '囗': 'vi – vây quanh', '夂': 'tri – đi chậm', '尢': 'uông – yếu',
    '彡': 'sam – lông tóc', '彐': 'kệ – đầu heo', '户': 'hộ – cửa', '支': 'chi – cành', '文': 'văn – chữ', '斗': 'đẩu – cái đấu',
    '无': 'vô – không', '比': 'tỉ – so sánh', '毛': 'mao – lông', '气': 'khí – hơi', '父': 'phụ – cha', '片': 'phiến – mảnh',
    '牙': 'nha – răng', '瓦': 'ngõa – ngói', '甘': 'cam – ngọt', '生': 'sinh – sinh ra', '用': 'dụng – dùng', '疋': 'sơ – đơn vị vải',
    '癶': 'bát – gạt ra', '皮': 'bì – da', '矛': 'mâu – giáo', '示': 'thị – chỉ bảo', '竹': 'trúc – tre', '缶': 'phẫu – đồ sành',
    '网': 'võng – lưới', '羽': 'vũ – lông vũ', '老': 'lão – già', '而': 'nhi – mà', '耒': 'lỗi – cái cày', '肉': 'nhục – thịt',
    '臣': 'thần – bề tôi', '至': 'chí – đến', '臼': 'cữu – cối giã', '舟': 'chu – thuyền', '色': 'sắc – màu', '血': 'huyết – máu',
    '行': 'hành – đi', '角': 'giác – sừng', '谷': 'cốc – thung lũng', '豆': 'đậu – hạt đậu', '豕': 'thỉ – lợn', '赤': 'xích – đỏ',
    '辛': 'tân – cay', '辰': 'thần – sáng sớm', '酉': 'dậu – rượu', '里': 'lý – làng, dặm', '长': 'trường – dài', '隹': 'chuy – chim đuôi ngắn',
    '青': 'thanh – xanh', '非': 'phi – không phải', '面': 'diện – mặt', '革': 'cách – da thuộc', '音': 'âm – âm thanh', '风': 'phong – gió',
    '飞': 'phi – bay', '首': 'thủ – đầu', '香': 'hương – thơm', '高': 'cao – cao', '黑': 'hắc – đen', '龙': 'long – rồng', '亡': 'vong – mất',
    '尔': 'nhĩ – ngươi', '也': 'dã – cũng', '乍': 'sạ – chợt', '召': 'triệu – gọi', '包': 'bao – bọc', '交': 'giao – giao nhau',
    '各': 'các – mỗi', '古': 'cổ – xưa', '己': 'kỷ – mình', '士': 'sĩ – học trò', '巴': 'ba', '丁': 'đinh', '个': 'cá – cái',
    '令': 'lệnh – ra lệnh', '主': 'chủ – chủ', '乎': 'hồ', '中': 'trung – giữa', '东': 'đông', '亚': 'á', '可': 'khả – có thể',
    '台': 'đài', '司': 'ti – coi sóc', '合': 'hợp – hợp lại', '同': 'đồng – cùng', '吉': 'cát – tốt lành', '因': 'nhân – nguyên nhân',
}

dec = HanziDecomposer()
dct = HanziDictionary()

IDS = {}
for _l in open('/home/claude/dl/ids/ids.txt', encoding='utf-8'):
    _p = _l.rstrip('\n').split('\t')
    if len(_p) >= 3 and not _l.startswith('#'):
        IDS[_p[1]] = re.sub(r'\[.*?\]', '', _p[2])
OPS = {c: 2 for c in '⿰⿱⿴⿵⿶⿷⿸⿹⿺⿻'}
OPS.update({'⿲': 3, '⿳': 3})
STROKY = set('丨丿丶乚亅乛一𠃌⺀')

def _parse(s, i=0):
    c = s[i]
    if c in OPS:
        kids, j = [], i + 1
        for _ in range(OPS[c]):
            k, j = _parse(s, j)
            kids.append(k)
        return kids, j
    return c, i + 1

def _leaves(t):
    return [t] if isinstance(t, str) else [x for k in t for x in _leaves(k)]

def ids_components(ch):
    s = IDS.get(ch) or IDS.get(_cc.convert(ch))
    if not s or len(s) < 2 or s[0] not in OPS:
        return []
    try:
        tree, _ = _parse(s)
    except Exception:
        return []
    top = [k if isinstance(k, str) else None for k in tree]
    comps = []
    for k in tree:
        if isinstance(k, str):
            comps.append(k)
        else:
            sub = ''.join(_leaves(k))
            # nếu cụm con là 1 chữ có sẵn trong IDS ngược thì dùng chữ đó
            comps.extend(x for x in _leaves(k))
    comps = [c for c in comps if '\u4e00' <= c <= '\u9fff' or '\u2e80' <= c <= '\u2fdf' or '\u3400' <= c <= '\u4dbf' or ord(c) >= 0x20000 or c in 'ユ']
    if len(comps) > 2:
        comps = [c for c in comps if c not in STROKY] or comps
    comps = [c for c in comps if c != 'ユ']
    return comps if len(comps) >= 2 else []

def components(ch):
    c = _components(ch)
    return c if c else ids_components(ch)

def _components(ch):
    try:
        d = dec.decompose(ch)
        comps = [c for c in d.get('once', []) if c and c != ch and c != 'No glyph available'
                 and not ('\u31c0' <= c <= '\u31ef') and c not in ('㇒', '㇏', '乚', '𠃌', '⺀')]
        if len(comps) < 2:
            comps = []
    except Exception:
        comps = []
    return comps

def comp_label(c):
    if c in RADICAL_VN:
        return RADICAL_VN[c]
    return hv_char(c, '') if (hv_any.get(c) or hv_any.get(_cc.convert(c))) else ''

def english(word):
    try:
        defs = dct.definition_lookup(word)
        return ' | '.join(sorted({d['definition'] for d in defs}))[:200]
    except Exception:
        return ''

rows = []
for i, (lv, w) in enumerate(words, 1):
    syl = word_pinyin(w).split()
    num = [p[0] for p in pinyin(w, style=Style.TONE3, neutral_tone_with_five=True)]
    wn = list(word_numeric(w)); num = [x.replace('v', 'u:') for x in num]
    if len(wn) == len(w):
        num = [a if not a.endswith('5') else b for a, b in zip(wn, num)]
    hvs = [hv_char(ch, n).capitalize() if j == 0 else hv_char(ch, n) for j, (ch, n) in enumerate(zip(w, num))]
    chars = []
    for ch, n in zip(w, num):
        comps = components(ch)
        chars.append({'ch': ch, 'hv': hv_char(ch, n), 'comps': [(c, comp_label(c)) for c in comps]})
    rows.append({'id': i, 'hsk': lv, 'word': w, 'syl': ' '.join(syl), 'hanviet': ' '.join(h for h in hvs if h),
                 'chars': chars, 'en': english(w)})

json.dump(rows, open('/home/claude/hsk/base.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(len(rows), 'words;', sum(1 for r in rows if r['hsk'] == 5), 'from HSK5')
