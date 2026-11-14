# -*- coding: utf-8 -*-
"""
update_videos.py — HỆ THỐNG QUÉT & CẬP NHẬT video cho Lộ trình (chạy hàng tuần).

Chức năng:
  - Quét các kênh nguồn (người thật, có phụ đề Trung + Việt).
  - LỌC TRÙNG: bỏ qua video đã có trong videos.js (theo id).
  - Chỉ nhận video có phụ đề Trung (zh/zh-Hans/zh-CN) + Việt (vi) dạng text (timestamp thật).
  - Tải phụ đề, dựng câu (Trung + Việt + pinyin) + từ mới, GHÉP THÊM vào videos.js (không build lại cái cũ).

Cách chạy:
    python tools/update_videos.py              # quét + thêm tối đa MAX_NEW video mới
    python tools/update_videos.py --max 5      # giới hạn số video thêm mỗi lần
    python tools/update_videos.py --no-scan    # chỉ thêm các id trong CURATED chưa có (dùng cache)
    python tools/update_videos.py --dry-run    # chỉ in ra, không ghi file

Phụ thuộc: yt-dlp, jieba, pypinyin (đã cài). Phụ đề tải về CACHE_DIR (tạm, không commit).
LƯU Ý: YouTube giới hạn tốc độ tải tự động trên máy chủ đám mây/CI — chạy trên MÁY CÁ NHÂN ổn nhất.
"""
import os, re, sys, json, argparse, tempfile, bisect
sys.stdout.reconfigure(encoding="utf-8")
try: sys.stderr.reconfigure(encoding="utf-8")
except Exception: pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "videos.js")
DIST = os.path.join(ROOT, "dist", "videos.js")
CACHE_DIR = os.environ.get("HSK_SUBCACHE", os.path.join(tempfile.gettempdir(), "hsk_subcache"))
os.makedirs(CACHE_DIR, exist_ok=True)

# ---- Kênh nguồn (người thật, có phụ đề Trung + Việt). Thêm kênh mới vào đây. ----
CHANNELS = [
    "https://www.youtube.com/@MiniTalksCN/videos",
    "https://www.youtube.com/@SayMandarin/videos",
    "https://www.youtube.com/@Langtube1min/videos",
]
SCAN_PER_CHANNEL = 25          # xét bao nhiêu video mới nhất mỗi kênh
MAX_NEW_DEFAULT = 10           # thêm tối đa bao nhiêu video mỗi lần chạy
DUR_MIN, DUR_MAX = 60, 1600    # bỏ video quá ngắn/quá dài (giây)

# ---- Tiêu đề tiếng Việt đẹp cho các id đã biết (id mới chưa có sẽ lấy tạm tên gốc) ----
CURATED = {
    "WOZ5JCGH1bc": ("Ở hiệu sách", "HSK1-2", "📚"),
    "n9ivGvkYp7w": ("Trên tàu: khi quên vé", "HSK1-2", "🚆"),
    "MqltSPJizIo": ("Ở sân bay: gửi hành lý", "HSK1-2", "🧳"),
    "aesOuq_GIy8": ("Ở trạm xăng", "HSK1-2", "⛽"),
    "4rKJLNZ-8NE": ("Thuê xe ô tô", "HSK1-2", "🚗"),
    "1IjMdEz65mY": ("Ở tiệm trang sức", "HSK1-2", "💍"),
    "WR5QmxGsaA4": ("Ở hiệu thuốc", "HSK1-2", "💊"),
    "3xx_ur4e-9c": ("15 hội thoại mua sắm", "HSK1-2", "🛍️"),
    "dligKDBMSUw": ("Hội thoại về hoa", "HSK1-2", "🌸"),
    "0zDjnmAd_6c": ("Thang máy hay thang cuốn?", "HSK1-2", "🛗"),
    "8I7TIXTYH64": ("Sưu tầm tem & công việc", "HSK1-2", "📮"),
    "K5c5nH-T7e0": ("Mua hàng miễn thuế", "HSK1-2", "🛒"),
    "3gqrfwDrbQE": ("Ở cổng ra máy bay", "HSK1-2", "🛫"),
    "kq7-s393cgo": ("Tình huống trong nhà vệ sinh", "HSK1-2", "🚻"),
}

HAN = re.compile(r"[一-鿿]")
STOP = set("的了是我你他她它们这那个不在有和也就都要会吗呢吧啊一二三之与及等着过被把让给对从向往还又再你们我们、，。！？：；“”‘’（）…—　 ")
SKIP_CUE = ("开启字幕", "[CC]", "点击")

# ================= pinyin + từ điển nghĩa =================
from pypinyin import pinyin, Style
import jieba

def tone_py(s):
    try: return " ".join(p[0] for p in pinyin(s, style=Style.TONE))
    except Exception: return ""

def load_dict():
    WORD_VI, CHAR_VI = {}, {}
    p = os.path.join(ROOT, "hsk_visual_library", "library", "data.js")
    try:
        dj = open(p, encoding="utf-8").read(); dj = dj[dj.index("["): dj.rindex("]") + 1]
        for r in json.loads(dj):
            w, ng = r.get("word", ""), (r.get("nghia", "") or "").strip()
            if w and ng and not ng.startswith("[EN]"): WORD_VI.setdefault(w, ng)
            if len(w) == 1 and ng and not ng.startswith("[EN]"): CHAR_VI.setdefault(w, ng)
            for c in r.get("chars", []):
                for comp in c.get("comps", []):
                    if comp.get("c") and comp.get("nghia"): CHAR_VI.setdefault(comp["c"], comp["nghia"])
    except Exception as e: print("  (bỏ qua data.js:", e, ")")
    try:
        sys.path.insert(0, os.path.join(ROOT, "hsk_visual_library", "src"))
        from visual import ICON
        for ch, val in ICON.items():
            if len(ch) == 1 and val and len(val) > 1 and val[1]: CHAR_VI.setdefault(ch, val[1])
    except Exception: pass
    return WORD_VI, CHAR_VI

WORD_VI, CHAR_VI = load_dict()
NAMES = {"小雨": "Tiểu Vũ (tên)", "小丽": "Tiểu Lệ (tên)", "小明": "Tiểu Minh (tên)", "小红": "Tiểu Hồng (tên)"}
for nm in NAMES: jieba.add_word(nm, freq=100000)

def meaning_of(tok):
    if tok in NAMES: return NAMES[tok]
    if tok in WORD_VI: return WORD_VI[tok]
    if len(tok) == 1: return CHAR_VI.get(tok, "")
    parts = [CHAR_VI.get(c, "") for c in tok]
    if all(parts): return " + ".join(p.split(";")[0].split(",")[0].strip() for p in parts)
    return ""

def build_vocab(zh_lines):
    seen, vocab = set(), []
    for ln in zh_lines:
        for tok in jieba.cut(ln):
            tok = tok.strip()
            if not tok or tok in seen or tok in STOP or not HAN.search(tok): continue
            vi = meaning_of(tok)
            if not vi and len(tok) == 1: continue
            seen.add(tok); vocab.append({"w": tok, "p": tone_py(tok), "vi": vi})
    return vocab

# ================= phụ đề =================
def raw_events(path):
    d = json.load(open(path, encoding="utf-8")); out = []
    for ev in d.get("events", []):
        segs = ev.get("segs")
        if not segs: continue
        txt = "".join(s.get("utf8", "") for s in segs).strip()
        if txt: out.append((round(ev.get("tStartMs", 0) / 1000.0, 2), round(ev.get("dDurationMs", 0) / 1000.0, 2), txt))
    return out

def split_zh(text):
    parts = [p.strip() for p in text.split("\n") if p.strip()]
    han = " ".join(p for p in parts if HAN.search(p)).replace("[CC]", "").strip()
    py = next((p for p in parts if not HAN.search(p)), "")
    return han, py

def last_latin(text):
    for p in reversed([p.strip() for p in text.split("\n") if p.strip()]):
        if not HAN.search(p): return p
    return ""

def zh_path(vid):
    for ext in (".zh.json3", ".zh-Hans.json3", ".zh-CN.json3"):
        p = os.path.join(CACHE_DIR, vid + ext)
        if os.path.exists(p): return p
    return None

def have_subs(vid):
    return zh_path(vid) and os.path.exists(os.path.join(CACHE_DIR, vid + ".vi.json3"))

def download_subs(vid):
    import subprocess
    subprocess.run([sys.executable, "-m", "yt_dlp", "--no-update", "--no-warnings", "--skip-download",
                    "--write-subs", "--sub-langs", "zh,zh-Hans,zh-CN,vi", "--sub-format", "json3",
                    "--sleep-requests", "2", "-o", os.path.join(CACHE_DIR, "%(id)s.%(ext)s"),
                    "https://www.youtube.com/watch?v=" + vid], capture_output=True)
    return have_subs(vid)

def build_entry(vid, title, dur):
    zp, vp = zh_path(vid), os.path.join(CACHE_DIR, vid + ".vi.json3")
    if not zp or not os.path.exists(vp): return None
    zh_ev, vi_ev = raw_events(zp), raw_events(vp)
    vi_list = sorted(((t, last_latin(x)) for (t, d, x) in vi_ev if last_latin(x)), key=lambda e: e[0])
    vi_ts = [e[0] for e in vi_list]
    def vi_at(t):
        if not vi_list: return ""
        j = bisect.bisect_left(vi_ts, t); best, bd = "", 9e9
        for k in (j - 1, j, j + 1):
            if 0 <= k < len(vi_list) and abs(vi_ts[k] - t) < bd: bd, best = abs(vi_ts[k] - t), vi_list[k][1]
        return best if bd <= 1.6 else ""
    lines = []
    for (t, d, x) in zh_ev:
        if any(k in x for k in SKIP_CUE): continue
        han, py = split_zh(x)
        if not han: continue
        if not py: py = tone_py(han)
        ln = {"t": t, "d": d, "zh": han, "vi": vi_at(t)}
        if py: ln["py"] = py
        lines.append(ln)
    if len(lines) < 5: return None
    vt, lv, emo = CURATED.get(vid, (title[:48], "HSK1-2", "🎬"))
    rdur = round(max((l["t"] + l["d"]) for l in lines))
    return {"id": vid, "vt": vt, "et": title[:70], "lv": lv, "emo": emo,
            "dur": rdur, "n": len(lines), "lines": lines, "vocab": build_vocab([l["zh"] for l in lines])}

# ================= quét kênh =================
def scan_channels(known):
    from yt_dlp import YoutubeDL
    cands = []
    seen = set(known)
    with YoutubeDL({"quiet": True, "no_warnings": True, "skip_download": True,
                    "extract_flat": True, "playlistend": SCAN_PER_CHANNEL}) as f:
        for url in CHANNELS:
            try:
                r = f.extract_info(url, download=False)
                for e in r.get("entries", []):
                    i = e and e.get("id")
                    if i and i not in seen:
                        seen.add(i); cands.append((i, int(e.get("duration") or 0), e.get("title") or ""))
            except Exception as ex: print("  lỗi quét", url[:45], str(ex)[:40])
    return cands

def probe_ok(vid):
    """True nếu video có phụ đề Trung + Việt dạng text."""
    from yt_dlp import YoutubeDL
    try:
        with YoutubeDL({"quiet": True, "no_warnings": True, "skip_download": True}) as y:
            i = y.extract_info("https://www.youtube.com/watch?v=" + vid, download=False)
    except Exception: return None
    s = i.get("subtitles") or {}
    zh = any(k.lower().startswith("zh") for k in s)
    return (i.get("title") or "", int(i.get("duration") or 0)) if (zh and "vi" in s) else None

# ================= main =================
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=MAX_NEW_DEFAULT)
    ap.add_argument("--no-scan", action="store_true", help="chỉ thêm id trong CURATED (dùng cache)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    videos = []
    if os.path.exists(OUT):
        t = open(OUT, encoding="utf-8").read(); t = t[t.index("["): t.rindex("]") + 1]
        videos = json.loads(t)
    known = {v["id"] for v in videos}
    print(f"Hiện có {len(videos)} video. Cache: {CACHE_DIR}")

    # danh sách ứng viên: CURATED chưa có (ưu tiên) + quét kênh
    todo = [(i, None, None) for i in CURATED if i not in known]
    if not args.no_scan:
        todo += [(i, d, t) for (i, d, t) in scan_channels(known) if i not in CURATED]
    print(f"Ứng viên mới (chưa trùng): {len(todo)}")

    added = 0
    for vid, dur, title in todo:
        if added >= args.max: print("  (đạt giới hạn --max)"); break
        if vid in known: continue
        # bỏ theo thời lượng nếu biết
        if dur and not (DUR_MIN <= dur <= DUR_MAX): continue
        # cần phụ đề: nếu chưa cache thì probe + tải
        if not have_subs(vid):
            info = probe_ok(vid)
            if not info: print(f"  bỏ {vid}: không có phụ đề Trung+Việt"); continue
            title, dur = info
            if not (DUR_MIN <= dur <= DUR_MAX): continue
            if not download_subs(vid): print(f"  bỏ {vid}: tải phụ đề lỗi"); continue
        if not title: title = vid
        if not dur: dur = 0
        entry = build_entry(vid, title, dur)
        if not entry: print(f"  bỏ {vid}: dựng dữ liệu lỗi"); continue
        videos.append(entry); known.add(vid); added += 1
        print(f"  + {vid} | {entry['n']} câu | {len(entry['vocab'])} từ | {entry['vt']}")

    print(f"Đã thêm {added} video mới → tổng {len(videos)}.")
    if args.dry_run: print("(dry-run: không ghi file)"); return
    if added == 0: print("Không có gì mới để ghi."); return
    payload = "/* Lộ trình video — người thật, phụ đề Trung+Việt (timestamp thật). Sinh bởi tools/update_videos.py */\nwindow.VIDEOS=" + json.dumps(videos, ensure_ascii=False, separators=(",", ":")) + ";\n"
    open(OUT, "w", encoding="utf-8").write(payload)
    if os.path.isdir(os.path.dirname(DIST)): open(DIST, "w", encoding="utf-8").write(payload)
    print(f"Đã ghi {OUT} ({round(len(payload)/1024)} KB) + dist/. Nhớ: commit & push để Render cập nhật.")

if __name__ == "__main__":
    main()
