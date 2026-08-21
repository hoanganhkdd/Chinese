#!/usr/bin/env python3
"""
HA_online.py — YouTube Vocabulary → Google Sheets
==================================================
Run this in Google Colab (free, works on any mobile browser).
Output goes directly into your Vocab Google Sheet — accessible
from phone, tablet, or PC without installing anything.

HOW TO START (mobile or desktop):
  1. Go to  https://colab.research.google.com
  2. File → New notebook
  3. Paste this entire file into ONE cell  (Ctrl+A → Ctrl+C → paste)
  4. Edit CONFIGURATION section (Section 2) with your YouTube URL
  5. Runtime → Run all  (or Ctrl+F9)
  6. Open Google Sheets on your phone — the words appear immediately

WHAT HAPPENS:
  • Fetches transcript from the YouTube video
  • Segments Chinese text → counts word frequency
  • Reads your Vocab (HSK 1–4 + Business) from the same Google Sheet
  • Writes TOP 100 words to tab "📹 HA Vocab" in your Vocab sheet
  • New words → inserted at TOP (most recent on top)
  • Duplicate words → NOT re-added; instead a note is appended
  • Each row records: source video name + link + date added
"""

# ══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — INSTALL DEPENDENCIES  (run once per Colab session)
# ══════════════════════════════════════════════════════════════════════════════
import subprocess, sys

def _install(pkg):
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", pkg])

REQUIRED = {
    "youtube-transcript-api": "youtube_transcript_api",
    "jieba":                  "jieba",
    "pypinyin":               "pypinyin",
    "gspread":                "gspread",
}
for pip_name, import_name in REQUIRED.items():
    try:
        __import__(import_name)
    except ImportError:
        print(f"📦 Installing {pip_name} ...")
        _install(pip_name)

# ══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — CONFIGURATION  ← Edit these values before running
# ══════════════════════════════════════════════════════════════════════════════

# Paste your YouTube video URL here
YOUTUBE_URL = "https://www.youtube.com/watch?v=VIDEO_ID"  #@param {type:"string"}

# How many top words to extract (by frequency)
TOP_N = 100  #@param {type:"integer", min:10, max:500}

# Only include words appearing this many times or more
MIN_FREQ = 1  #@param {type:"integer", min:1}

# Minimum Chinese character count per word (1 = include single chars)
MIN_CHARS = 1  #@param {type:"integer", min:1}

# Remove common particles like 的, 了, 吧 (set True for cleaner output)
REMOVE_STOPWORDS = True  #@param {type:"boolean"}

# Force transcript language (leave blank for auto-detect)
FORCE_LANG = ""  #@param {type:"string"}

# Your Vocab Google Sheet ID (from the URL: /spreadsheets/d/SHEET_ID/edit)
SPREADSHEET_ID = "1qryx7UN8qCVVv3sdk_H3Pr1btGZODuJ6nB-J4PuqysQ"  #@param {type:"string"}

# Name of the output sheet tab (created automatically if it doesn't exist)
HA_SHEET_NAME = "📹 HA Vocab"  #@param {type:"string"}

# ══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — CORE IMPORTS & CONSTANTS
# ══════════════════════════════════════════════════════════════════════════════

import re
import unicodedata
from collections import Counter
from datetime import datetime

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled
import jieba
from pypinyin import pinyin as to_pinyin, Style
import requests
import gspread

CHINESE_LANG_CODES = [
    "zh-Hans", "zh-Hant", "zh", "zh-CN", "zh-TW",
    "zh-HK", "zh-SG", "cmn", "yue",
]

VOCAB_SHEETS = ["HSK 1", "HSK 2", "HSK 3", "HSK 4", "💼 Thương mại"]

# Column indices in the Vocab Google Sheet (0-based)
VC = {"stt": 0, "english": 2, "vietnamese": 3,
      "hanzi": 8, "pinyin": 9, "example": 10, "chiettu": 13}

STOPWORDS = {
    "的", "了", "在", "和", "也", "就", "都", "着", "过",
    "吗", "呢", "啊", "吧", "嗯", "哦", "哈", "嘛", "呀",
    "哇", "哎", "嘿", "喂", "啦", "咯", "哟", "诶",
    "之", "以", "其", "而", "于", "与", "被", "把", "让",
}

# HA Vocab sheet column layout (1-indexed for gspread)
HA_COL = {
    "stt":          1,   # A
    "hanzi":        2,   # B  ← used for dedup lookup
    "pinyin":       3,   # C
    "english":      4,   # D
    "vietnamese":   5,   # E
    "level":        6,   # F
    "freq":         7,   # G
    "source_video": 8,   # H  ← video title
    "source_link":  9,   # I  ← YouTube URL
    "added_date":   10,  # J
    "note":         11,  # K  ← ⚠️ duplicate notice goes here
    "example":      12,  # L
    "chiettu":      13,  # M
    "audio":        14,  # N  🔊 (hyperlink formula)
    "youglish":     15,  # O  🎬
    "day1":         16,  # P
    "day2":         17,  # Q
    "day3":         18,  # R
    "day4":         19,  # S
    "day5":         20,  # T
    "day6":         21,  # U
    "day7":         22,  # V
}

HA_HEADERS = [
    "STT", "📖 CHỮ HÁN", "🔤 PINYIN", "ENGLISH", "TIẾNG VIỆT",
    "📚 CẤP ĐỘ", "📊 TẦN SỐ", "🎬 TÊN VIDEO", "🔗 LINK VIDEO",
    "📅 NGÀY THÊM", "⚠️ GHI CHÚ (trùng lặp)",
    "📝 VÍ DỤ", "🔍 CHIẾT TỰ",
    "🔊 NGHE", "🎬 YouGlish",
    "DAY 1", "DAY 2", "DAY 3", "DAY 4", "DAY 5", "DAY 6", "DAY 7",
]

# ══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — HELPER FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

def is_chinese_char(c):
    return '一' <= c <= '鿿' or '㐀' <= c <= '䶿'

def contains_chinese(word):
    return any(is_chinese_char(c) for c in word)

def get_pinyin_str(word):
    try:
        return ' '.join(p[0] for p in to_pinyin(word, style=Style.TONE))
    except Exception:
        return ''

def audio_url(word):
    return f"https://translate.google.com/?sl=zh-CN&tl=vi&text={word}&op=translate"

def youglish_url(word):
    return f"https://youglish.com/pronounce/{word}/chinese"

def extract_video_id(url):
    for pat in [r'(?:v=|/v/|youtu\.be/|/embed/)([A-Za-z0-9_-]{11})',
                r'^([A-Za-z0-9_-]{11})$']:
        m = re.search(pat, url.strip())
        if m:
            return m.group(1)
    raise ValueError(f"Cannot extract video ID from: {url!r}")

def get_video_title(video_id):
    try:
        url = (f"https://www.youtube.com/oembed"
               f"?url=https://www.youtube.com/watch?v={video_id}&format=json")
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            return r.json().get("title", f"Video_{video_id}")
    except Exception:
        pass
    return f"Video_{video_id}"

# ── Transcript ─────────────────────────────────────────────────────────────────

def fetch_transcript(video_id, force_lang=None):
    lang_order = ([force_lang] + CHINESE_LANG_CODES) if force_lang else CHINESE_LANG_CODES
    try:
        tlist = YouTubeTranscriptApi.list_transcripts(video_id)
    except TranscriptsDisabled:
        raise RuntimeError("Transcripts are disabled for this video.")
    except Exception as e:
        raise RuntimeError(f"Cannot list transcripts: {e}")

    for lang in lang_order:
        try:
            segs = tlist.find_manually_created_transcript([lang]).fetch()
            print(f"   ✅ Manual transcript: {lang}")
            return segs, lang
        except Exception:
            pass

    for lang in lang_order:
        try:
            segs = tlist.find_generated_transcript([lang]).fetch()
            print(f"   ✅ Auto-generated transcript: {lang}")
            return segs, lang
        except Exception:
            pass

    try:
        t = tlist.find_transcript(['en']).translate('zh-Hans')
        segs = t.fetch()
        print("   ✅ Translated from English → zh-Hans")
        return segs, 'zh-Hans (translated)'
    except Exception:
        pass

    raise RuntimeError(
        "No Chinese transcript found. Try adding a language code to FORCE_LANG "
        "(e.g. 'en' to translate from English captions)."
    )

def segments_to_text(segments):
    parts = []
    for seg in segments:
        t = seg.get('text', '')
        t = re.sub(r'<[^>]+>', '', t)
        t = re.sub(r'[\[【\(（][^\]】\)）]*[\]】\)）]', '', t)
        parts.append(t.strip())
    return ' '.join(parts)

def segment_chinese(text, min_chars=1):
    freq = Counter()
    for word in jieba.cut(text, cut_all=False):
        word = word.strip()
        if contains_chinese(word) and len(word) >= min_chars:
            freq[word] += 1
    return freq

# ── Vocab DB from Google Sheets ────────────────────────────────────────────────

def load_vocab_from_sheets(gc, spreadsheet_id):
    """Read the Vocab (HSK) tabs and return {hanzi: entry_dict}."""
    db = {}
    try:
        spreadsheet = gc.open_by_key(spreadsheet_id)
    except Exception as e:
        print(f"   ⚠️  Cannot open spreadsheet: {e}")
        return db

    for sheet_name in VOCAB_SHEETS:
        try:
            ws = spreadsheet.worksheet(sheet_name)
            all_rows = ws.get_all_values()
        except Exception:
            continue

        for row in all_rows[1:]:
            try:
                int(row[VC["stt"]])
            except (ValueError, TypeError, IndexError):
                continue
            hanzi = row[VC["hanzi"]].strip() if len(row) > VC["hanzi"] else ""
            if not hanzi or not contains_chinese(hanzi):
                continue
            db[hanzi] = {
                "level":      sheet_name,
                "english":    row[VC["english"]].strip()    if len(row) > VC["english"]    else "",
                "vietnamese": row[VC["vietnamese"]].strip() if len(row) > VC["vietnamese"] else "",
                "pinyin":     row[VC["pinyin"]].strip()     if len(row) > VC["pinyin"]     else "",
                "example":    row[VC["example"]].strip()    if len(row) > VC["example"]    else "",
                "chiettu":    row[VC["chiettu"]].strip()    if len(row) > VC["chiettu"]    else "",
            }

    print(f"   ✅ Loaded {len(db):,} words from Vocab ({len(VOCAB_SHEETS)} sheets)")
    return db

# ── Map words to Vocab ─────────────────────────────────────────────────────────

def map_to_vocab(word_freq, vocab_db, remove_sw=False):
    level_order = {n: i for i, n in enumerate(VOCAB_SHEETS)}
    in_vocab, new_words = [], []
    for word, freq in word_freq.most_common():
        if remove_sw and word in STOPWORDS:
            continue
        if word in vocab_db:
            entry = dict(vocab_db[word]); entry.update(hanzi=word, freq=freq)
            in_vocab.append(entry)
        else:
            new_words.append({
                "hanzi": word, "freq": freq, "level": "🆕 Mới",
                "english": "", "vietnamese": "",
                "pinyin": get_pinyin_str(word),
                "example": "", "chiettu": "",
            })
    in_vocab.sort(key=lambda x: (level_order.get(x["level"], 99), -x["freq"]))
    new_words.sort(key=lambda x: -x["freq"])
    return in_vocab + new_words

# ── HA Vocab Sheet management ──────────────────────────────────────────────────

def get_or_create_ha_sheet(spreadsheet, sheet_name):
    """Return the HA Vocab worksheet, creating it with headers if needed."""
    try:
        ws = spreadsheet.worksheet(sheet_name)
        print(f"   ✅ Using existing sheet: '{sheet_name}'")
        return ws, False  # False = already existed
    except gspread.WorksheetNotFound:
        ws = spreadsheet.add_worksheet(
            title=sheet_name, rows=2000, cols=len(HA_HEADERS)
        )
        ws.append_row(HA_HEADERS, value_input_option='USER_ENTERED')
        # Format header row bold (best-effort)
        try:
            ws.format("A1:W1", {
                "textFormat": {"bold": True},
                "backgroundColor": {"red": 0.10, "green": 0.24, "blue": 0.37}
            })
        except Exception:
            pass
        print(f"   ✅ Created new sheet: '{sheet_name}'")
        return ws, True   # True = just created

def load_existing_ha_words(ws_ha):
    """
    Read existing data from the HA sheet.
    Returns:
        existing_set:  {hanzi}  — for fast dedup check
        existing_map:  {hanzi: row_number(1-indexed)}  — for note updates
        row_count:     number of data rows (excluding header)
    """
    all_rows = ws_ha.get_all_values()
    existing_set = set()
    existing_map = {}
    for i, row in enumerate(all_rows[1:], start=2):   # skip header; row 2 = first data
        hanzi = row[HA_COL["hanzi"] - 1].strip() if len(row) >= HA_COL["hanzi"] else ""
        if hanzi:
            existing_set.add(hanzi)
            existing_map[hanzi] = i
    return existing_set, existing_map, max(0, len(all_rows) - 1)

def update_duplicate_note(ws_ha, row_num, video_title, today):
    """Append a duplicate note to the GHI CHÚ column of an existing row."""
    col = HA_COL["note"]
    current = ws_ha.cell(row_num, col).value or ""
    new_tag = f"⚠️ Cũng trong: {video_title} ({today})"
    if new_tag in current:
        return   # already noted
    updated = f"{current} | {new_tag}".strip(" |") if current else new_tag
    ws_ha.update_cell(row_num, col, updated)

def build_sheet_rows(words, video_title, video_url, today, start_stt=1):
    """Convert word dicts to rows ready for gspread insert_rows()."""
    rows = []
    for i, wd in enumerate(words, start=start_stt):
        hanzi = wd["hanzi"]
        row = [""] * len(HA_HEADERS)
        row[HA_COL["stt"]          - 1] = i
        row[HA_COL["hanzi"]        - 1] = hanzi
        row[HA_COL["pinyin"]       - 1] = wd.get("pinyin", "")
        row[HA_COL["english"]      - 1] = wd.get("english", "")
        row[HA_COL["vietnamese"]   - 1] = wd.get("vietnamese", "")
        row[HA_COL["level"]        - 1] = wd.get("level", "")
        row[HA_COL["freq"]         - 1] = wd.get("freq", 0)
        row[HA_COL["source_video"] - 1] = video_title
        row[HA_COL["source_link"]  - 1] = video_url
        row[HA_COL["added_date"]   - 1] = today
        row[HA_COL["note"]         - 1] = ""
        row[HA_COL["example"]      - 1] = wd.get("example", "")
        row[HA_COL["chiettu"]      - 1] = wd.get("chiettu", "")
        row[HA_COL["audio"]        - 1] = audio_url(hanzi)
        row[HA_COL["youglish"]     - 1] = youglish_url(hanzi)
        # DAY 1–7 left blank for manual tracking
        rows.append(row)
    return rows

def renumber_stt(ws_ha, inserted_count, existing_count):
    """Renumber the STT column after inserting new rows at top."""
    if existing_count == 0:
        return
    total = inserted_count + existing_count
    # Rows 2 .. total+1 (header is row 1)
    try:
        stt_col = HA_COL["stt"]
        updates = []
        for n in range(1, total + 1):
            updates.append({
                "range": gspread.utils.rowcol_to_a1(n + 1, stt_col),
                "values": [[n]]
            })
        ws_ha.batch_update(updates, value_input_option='USER_ENTERED')
    except Exception:
        pass   # non-critical; STT numbers still show correctly enough

# ══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — GOOGLE AUTH
# ══════════════════════════════════════════════════════════════════════════════

def authenticate_google():
    """Authenticate with Google.  Works in Colab and locally (service account)."""
    try:
        from google.colab import auth as colab_auth
        colab_auth.authenticate_user()
        from google.auth import default
        creds, _ = default()
        gc = gspread.authorize(creds)
        print("   ✅ Authenticated via Google Colab")
        return gc
    except ImportError:
        pass

    # Local fallback: use service account key file
    import os
    key_file = os.environ.get("GOOGLE_KEY_FILE", "service_account.json")
    if not __import__("pathlib").Path(key_file).exists():
        raise RuntimeError(
            "Not running in Colab and no service_account.json found.\n"
            "Set env var GOOGLE_KEY_FILE=path/to/key.json or run in Colab."
        )
    gc = gspread.service_account(filename=key_file)
    print(f"   ✅ Authenticated via service account: {key_file}")
    return gc

# ══════════════════════════════════════════════════════════════════════════════
# SECTION 6 — MAIN PIPELINE
# ══════════════════════════════════════════════════════════════════════════════

def run(
    youtube_url=YOUTUBE_URL,
    top_n=TOP_N,
    min_freq=MIN_FREQ,
    min_chars=MIN_CHARS,
    remove_stopwords=REMOVE_STOPWORDS,
    force_lang=FORCE_LANG or None,
    spreadsheet_id=SPREADSHEET_ID,
    ha_sheet_name=HA_SHEET_NAME,
):
    sep = "=" * 64
    print(f"\n{sep}")
    print("🎬  HA Online — YouTube Vocabulary → Google Sheets")
    print(sep)

    today = datetime.now().strftime("%Y-%m-%d")

    # ── 1. Video ID & title ───────────────────────────────────────────────────
    video_id  = extract_video_id(youtube_url)
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    print(f"📹 Video ID : {video_id}")
    print("📡 Fetching title ...")
    video_title = get_video_title(video_id)
    print(f"   📋 {video_title}")

    # ── 2. Transcript ─────────────────────────────────────────────────────────
    print("📝 Fetching transcript ...")
    segments, lang_used = fetch_transcript(video_id, force_lang=force_lang)
    print(f"   Segments : {len(segments):,}  |  Language: {lang_used}")

    # ── 3. Segment ────────────────────────────────────────────────────────────
    print("✂️  Segmenting (jieba) ...")
    raw_text  = segments_to_text(segments)
    zh_chars  = sum(1 for c in raw_text if is_chinese_char(c))
    print(f"   Chinese characters: {zh_chars:,}")
    word_freq = segment_chinese(raw_text, min_chars=min_chars)
    if min_freq > 1:
        word_freq = Counter({w: f for w, f in word_freq.items() if f >= min_freq})
    print(f"   Unique words: {len(word_freq):,}")

    # ── 4. Google auth ────────────────────────────────────────────────────────
    print("🔐 Authenticating with Google ...")
    gc = authenticate_google()

    # ── 5. Open spreadsheet ───────────────────────────────────────────────────
    print("📊 Opening spreadsheet ...")
    spreadsheet = gc.open_by_key(spreadsheet_id)
    print(f"   ✅ '{spreadsheet.title}'")

    # ── 6. Load Vocab from sheets ─────────────────────────────────────────────
    print("📚 Loading Vocab database ...")
    vocab_db = load_vocab_from_sheets(gc, spreadsheet_id)

    # ── 7. Map words ──────────────────────────────────────────────────────────
    print("🗺️  Mapping to Vocab ...")
    all_words = map_to_vocab(word_freq, vocab_db, remove_sw=remove_stopwords)

    # Apply top-N by frequency
    all_words_top = sorted(all_words, key=lambda x: -x["freq"])[:top_n]
    print(f"   Top {top_n}: {len(all_words_top)} words selected")

    # ── 8. Get/create HA sheet ────────────────────────────────────────────────
    print(f"📋 Opening sheet '{ha_sheet_name}' ...")
    ws_ha, just_created = get_or_create_ha_sheet(spreadsheet, ha_sheet_name)

    # ── 9. Load existing words ────────────────────────────────────────────────
    existing_set, existing_map, existing_count = load_existing_ha_words(ws_ha)
    print(f"   Existing rows: {existing_count}")

    # ── 10. Partition new vs duplicate ────────────────────────────────────────
    truly_new  = [w for w in all_words_top if w["hanzi"] not in existing_set]
    duplicates = [w for w in all_words_top if w["hanzi"] in existing_set]

    print(f"   🆕 New words   : {len(truly_new)}")
    print(f"   🔁 Duplicates  : {len(duplicates)} (will update notes only)")

    # ── 11. Update duplicate notes ────────────────────────────────────────────
    if duplicates:
        print("⚠️  Updating duplicate notes ...")
        for wd in duplicates:
            row_num = existing_map.get(wd["hanzi"])
            if row_num:
                update_duplicate_note(ws_ha, row_num, video_title, today)
        print(f"   ✅ Updated {len(duplicates)} notes")

    # ── 12. Insert new words at TOP ───────────────────────────────────────────
    if truly_new:
        print(f"📥 Inserting {len(truly_new)} new words at top of sheet ...")
        new_rows = build_sheet_rows(
            truly_new, video_title, video_url, today, start_stt=1
        )
        # Insert at row 2 (just below header) — pushes existing rows down
        ws_ha.insert_rows(new_rows, row=2, value_input_option='USER_ENTERED')
        # Renumber the STT column for the shifted rows
        renumber_stt(ws_ha, len(truly_new), existing_count)
        print(f"   ✅ Inserted")
    else:
        print("ℹ️  No new words to insert (all already in sheet)")

    # ── 13. Summary ───────────────────────────────────────────────────────────
    from collections import Counter as _C
    level_counts = _C(w["level"] for w in all_words_top)
    sheet_url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit"

    print(f"""
{sep}
✅  DONE!

📊 This video:
   Words extracted  : {len(all_words_top)}
   New added        : {len(truly_new)}
   Duplicates noted : {len(duplicates)}

📚 Level breakdown (this video):""")
    for lvl in list(VOCAB_SHEETS) + ["🆕 Mới"]:
        cnt = level_counts.get(lvl, 0)
        if cnt:
            print(f"   {lvl}: {cnt}")

    print(f"""
🔗 Open your sheet:
   {sheet_url}#gid=...
   (find tab '{ha_sheet_name}')

💡 Study tips:
   • Sort column G (TẦN SỐ) ↓ to start with most frequent words
   • Tick DAY 1–7 columns as you review each word
   • Words with ⚠️ in column K appeared in multiple videos
   • Tap 🔊 NGHE link to hear pronunciation
{sep}
""")

# ══════════════════════════════════════════════════════════════════════════════
# SECTION 7 — ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    run(
        youtube_url      = YOUTUBE_URL,
        top_n            = TOP_N,
        min_freq         = MIN_FREQ,
        min_chars        = MIN_CHARS,
        remove_stopwords = REMOVE_STOPWORDS,
        force_lang       = FORCE_LANG or None,
        spreadsheet_id   = SPREADSHEET_ID,
        ha_sheet_name    = HA_SHEET_NAME,
    )
