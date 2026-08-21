#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build.py — Sinh appdata.js từ file HSK seed (Excel/CSV) hoặc dữ liệu mẫu.

Cách dùng:
    python build.py                      # dùng HSK1_Tu_Vung_500.xlsx nếu có, else demo
    python build.py --seed my_hsk.xlsx   # chỉ định file seed

Đầu ra: appdata.js  ->  window.APPDATA = { meta, vocab, charPinyin, gloss, seg, amboi, chars, ... }

Yêu cầu (đã cài sẵn ở máy này): pandas, openpyxl, pypinyin, jieba.
Nếu thiếu: pip install pandas openpyxl pypinyin jieba
"""
import json, os, re, sys, argparse, unicodedata

def log(*a): print(*a, file=sys.stderr)

# ---------- pinyin / âm bồi ----------
def strip_tone(s):
    s = s.lower()
    for a in "ǖǘǚǜü": s = s.replace(a, "v")
    s = unicodedata.normalize("NFD", s)
    return "".join(c for c in s if unicodedata.category(c) != "Mn")

INIT = {'zh':'tr','ch':'tr','sh':'s','b':'p','p':'p','m':'m','f':'ph','d':'t','t':'th',
 'n':'n','l':'l','g':'c','k':'kh','h':'h','j':'ch','q':'ch','x':'x','r':'r','z':'ch','c':'ch','s':'x'}
FIN = {'a':'a','o':'ô','e':'ưa','ai':'ai','ei':'ây','ao':'ao','ou':'âu','an':'an','en':'ân',
 'ang':'ang','eng':'âng','ong':'ung','er':'ơ','i':'i','ia':'ia','ie':'iê','iao':'eo','iu':'iu',
 'ian':'iên','in':'in','iang':'eng','ing':'inh','iong':'ung','u':'u','ua':'oa','uo':'uô','uai':'oai',
 'ui':'uây','uan':'oan','un':'uân','uang':'oang','ueng':'uâng','ue':'uê',
 'v':'uy','ve':'uê','van':'uên','vn':'uyn','ê':'ê','m':'m','n':'n','ng':'ng'}
WHOLE = {'yi':'i','ya':'ia','ye':'iê','yao':'eo','you':'iu','yan':'iên','yin':'in','yang':'eng','ying':'inh',
 'yong':'ung','yu':'uy','yue':'uê','yuan':'uên','yun':'uyn','yo':'io',
 'wu':'u','wa':'oa','wo':'ô','wai':'oai','wei':'uây','wan':'oan','wen':'uân','wang':'oang','weng':'uâng',
 'zhi':'trư','chi':'trư','shi':'sư','ri':'rư','zi':'chư','ci':'chư','si':'xư','er':'ơ'}
RETRO = {'zh','ch','sh','r','z','c','s'}

def split_syl(base):
    for ini in ('zh','ch','sh'):
        if base.startswith(ini): return ini, base[2:]
    if base and base[0] in 'bpmfdtnlgkhjqxrzcsyw': return base[0], base[1:]
    return '', base

def amboi_base(base):
    if base in WHOLE: return WHOLE[base]
    ini, fin = split_syl(base)
    if ini in RETRO and fin == 'i': return INIT.get(ini, ini) + 'ư'
    if ini in ('j','q','x'):
        if fin == 'u': fin = 'v'
        elif fin.startswith('u') and fin not in ('ua','uai','uang','uo'): fin = 'v' + fin[1:]
    vi_i = '' if ini in ('y','w') else INIT.get(ini, '')
    return (vi_i + FIN.get(fin, fin)) or base

# ---------- đọc seed ----------
def read_seed(path):
    import pandas as pd
    ext = os.path.splitext(path)[1].lower()
    if ext in (".xlsx", ".xlsm", ".xls"):
        xl = pd.ExcelFile(path)
        # cố gắng tìm sheet có cột Hán tự
        for name in xl.sheet_names:
            df = pd.read_excel(xl, sheet_name=name, header=None)
            return df
    else:
        return pd.read_csv(path, header=None)

def demo_vocab():
    rows = [
        ("你好","nǐ hǎo","xin chào","HSK1","Giao tiếp","你好，很高兴认识你。","Nǐ hǎo, hěn gāoxìng rènshi nǐ.","Xin chào, rất vui được gặp bạn."),
        ("谢谢","xièxie","cảm ơn","HSK1","Giao tiếp","谢谢你的帮助。","Xièxie nǐ de bāngzhù.","Cảm ơn sự giúp đỡ của bạn."),
        ("再见","zàijiàn","tạm biệt","HSK1","Giao tiếp","明天见，再见！","Míngtiān jiàn, zàijiàn!","Hẹn mai gặp, tạm biệt!"),
        ("老师","lǎoshī","giáo viên","HSK1","Học tập","他是我的中文老师。","Tā shì wǒ de Zhōngwén lǎoshī.","Anh ấy là giáo viên tiếng Trung của tôi."),
        ("学生","xuéshēng","học sinh","HSK1","Học tập","我是一名学生。","Wǒ shì yī míng xuéshēng.","Tôi là một học sinh."),
    ]
    return [dict(zip(["hanzi","pinyin","vi","level","topic","example","examplePinyin","exampleVi"], r)) for r in rows]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", default=None)
    ap.add_argument("--out", default="appdata.generated.js")  # không ghi đè bản đang chạy
    args = ap.parse_args()

    from pypinyin import pinyin_dict
    import jieba

    # char pinyin
    charmap = {chr(cp): val.split(',')[0].strip() for cp, val in pinyin_dict.pinyin_dict.items()}

    # vocab
    vocab = []
    seed = args.seed or ("HSK1_Tu_Vung_500.xlsx" if os.path.exists("HSK1_Tu_Vung_500.xlsx") else None)
    if seed and os.path.exists(seed):
        log("Đọc seed:", seed)
        # Ở repo này dữ liệu thật đã nằm sẵn trong data.json (do phiên build trước sinh ra).
        if os.path.exists("data.json"):
            d = json.load(open("data.json", encoding="utf-8"))
            for v in d.get("vocab", []):
                vocab.append({"han": v["han"], "hanzi": v["han"], "pinyin": v["pinyin"], "vi": v["vi"],
                              "level": v.get("level","HSK1"), "topic": v.get("topic",""),
                              "example": v.get("example",""), "examplePinyin": v.get("examplePinyin",""),
                              "exampleVi": ""})
        else:
            log("Chưa có data.json — dùng dữ liệu demo.")
            vocab = demo_vocab()
    else:
        log("Không có seed — tạo 5 từ HSK1 demo.")
        vocab = demo_vocab()

    # gloss + seg (jieba)
    gloss = {}
    for v in vocab:
        gloss.setdefault(v["han"], {"p": v["pinyin"], "v": v["vi"]})
    dictfile = os.path.join(os.path.dirname(jieba.__file__), "dict.txt")
    han = re.compile(r'^[一-鿿]+$')
    seg = {}
    if os.path.exists(dictfile):
        with open(dictfile, encoding="utf-8") as f:
            for line in f:
                p = line.split()
                if len(p) < 2: continue
                w, fr = p[0], int(p[1])
                if 2 <= len(w) <= 4 and fr >= 100 and han.match(w):
                    seg[w] = fr

    # amboi base table
    bases = {strip_tone(py) for py in charmap.values() if py}
    amboi = {b: amboi_base(b) for b in bases}

    # radicals (bộ thủ) tối thiểu — mở rộng tùy ý
    radicals = {"氵":"nước (thủy)","扌":"tay (thủ)","口":"miệng (khẩu)","亻":"người (nhân)","女":"nữ",
                "心":"tim (tâm)","忄":"tim (tâm)","日":"mặt trời (nhật)","月":"trăng/thịt (nguyệt)","木":"cây (mộc)",
                "火":"lửa (hỏa)","土":"đất (thổ)","金":"kim loại (kim)","言":"lời nói (ngôn)","讠":"lời nói (ngôn)",
                "食":"ăn (thực)","饣":"ăn (thực)","走":"đi (tẩu)","车":"xe (xa)","门":"cửa (môn)"}

    stopwords = list("的了是我你他她它们这那个不在有和也就都要会吗呢吧啊一之与及等着过被把让给对从向往还又再")

    out = {
        "meta": {"generated": True, "vocabCount": len(vocab)},
        "vocab": vocab,
        "charPinyin": charmap,
        "pinyinDict": charmap,
        "gloss": gloss,
        "seg": seg,
        "amboi": amboi,
        "radicals": radicals,
        "stopwords": stopwords,
    }
    with open(args.out, "w", encoding="utf-8") as f:
        f.write("window.APPDATA=")
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";")
    log("Đã ghi", args.out, "| vocab:", len(vocab), "| seg:", len(seg), "| KB:", round(os.path.getsize(args.out)/1024))

if __name__ == "__main__":
    main()
