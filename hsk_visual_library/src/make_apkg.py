import genanki, openpyxl, os

SRC = '/home/claude/hsk/final.xlsx'
IMG = '/home/claude/hsk/img'
OUT = '/mnt/user-data/outputs/HSK_2000_tu_chiet_tu.apkg'

CSS = """
.card { font-family: Arial, sans-serif; text-align: center; color: #37424A; background: #fff; font-size: 18px; padding: 8px; }
.night_mode .card, .nightMode .card { background: #1e1e1e; color: #e6e6e6; }
.hz { font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 72px; color: #C8102E; font-weight: bold; line-height: 1.2; }
.py { font-size: 26px; color: #1F4E79; margin-top: 6px; }
.night_mode .py, .nightMode .py { color: #8cc4ff; }
.ab { font-size: 16px; color: #888; font-style: italic; }
.hv { font-size: 18px; margin-top: 4px; }
.vn { font-size: 24px; font-weight: bold; margin: 10px 0; }
.box { background: #FCE4EA; border-radius: 10px; padding: 8px; margin: 10px auto; max-width: 560px; text-align: left; color: #37424A; }
.ex-hz { font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 22px; color: #C8102E; }
.small { font-size: 14px; }
img { max-width: 100%; height: auto; border-radius: 6px; background: #fff; }
.tag { display: inline-block; background: #37424A; color: #fff; border-radius: 6px; padding: 1px 8px; font-size: 12px; }
.hint { font-size: 14px; color: #888; margin-top: 10px; }
"""

BACK_COMMON = """
<div class="py">{{Pinyin}}</div>
<div class="ab">Âm bồi: {{AmBoi}}</div>
<div class="hv">Hán Việt: <b>{{HanViet}}</b></div>
<div class="vn">{{NghiaVN}}</div>
<div>{{AnhNho}}</div>
<div class="box small">{{CachNho}}</div>
<details><summary class="small">Sơ đồ chiết tự gốc</summary><div>{{Anh}}</div><div class="box small">{{ChietTu}}</div></details>
<div class="box"><div class="ex-hz">{{ViDu}}</div><div class="small">{{ViDuPinyin}}</div><div class="small">{{ViDuNghia}}</div></div>
{{tts zh_CN:ViDu}}
<div><span class="tag">{{HSK}}</span> <span class="tag">#{{STT}}</span></div>
"""

model = genanki.Model(
    1607392319, 'HSK 2000 – Chiết tự (Việt)',
    fields=[{'name': n} for n in ['Hanzi', 'Pinyin', 'AmBoi', 'HanViet', 'NghiaVN', 'ChietTu', 'Anh',
                                   'ViDu', 'ViDuPinyin', 'ViDuNghia', 'HSK', 'STT', 'CachNho', 'AnhNho']],
    templates=[
        {'name': '1. Nhìn chữ → nhớ nghĩa',
         'qfmt': '<div class="hz">{{Hanzi}}</div><div class="hint">Đọc to, đoán âm Hán Việt và nghĩa</div>',
         'afmt': '<div class="hz">{{Hanzi}}</div>{{tts zh_CN:Hanzi}}' + BACK_COMMON},
        {'name': '2. Nghĩa → viết lại chữ',
         'qfmt': '<div class="vn">{{NghiaVN}}</div><div class="hv">Hán Việt: {{HanViet}}</div>'
                 '<div class="hint">Viết chữ ra giấy hoặc tưởng tượng từng bộ, rồi lật thẻ</div>',
         'afmt': '<div class="vn">{{NghiaVN}}</div><hr><div class="hz">{{Hanzi}}</div>{{tts zh_CN:Hanzi}}' + BACK_COMMON},
    ],
    css=CSS)

deck = genanki.Deck(2059400110, 'HSK 2000 từ – Chiết tự')
ws = openpyxl.load_workbook(SRC)['2000 từ']
media = []
for r in range(2, ws.max_row + 1):
    v = [ws.cell(r, c).value for c in range(1, 12)]
    mn = ws.cell(r, 13).value or ''
    stt, hsk, hz, py, ab, hv, ct, vn, vd, vdpy, vdvn = v
    fn = f'hsk_{stt:04d}.png'
    src = os.path.join(IMG, f'{stt:04d}.png')
    dst = os.path.join('/home/claude/hsk/media', fn)
    os.makedirs('/home/claude/hsk/media', exist_ok=True)
    if not os.path.exists(dst):
        os.link(src, dst) if not os.path.exists(dst) else None
    media.append(dst)
    fv = f'hskv_{stt:04d}.png'
    dv = os.path.join('/home/claude/hsk/media', fv)
    if os.path.exists(dv):
        os.remove(dv)
    os.link(os.path.join('/home/claude/hsk/vis', f'{stt:04d}.png'), dv)
    media.append(dv)
    note = genanki.Note(model=model,
                        fields=[hz, py, ab, hv, vn, ct, f'<img src="{fn}">', vd, vdpy, vdvn, hsk, str(stt), mn.replace(chr(10), '<br>'), f'<img src="{fv}">'],
                        tags=[hsk.replace(' ', '')], guid=genanki.guid_for('hsk2000', hz))
    deck.add_note(note)

pkg = genanki.Package(deck)
pkg.media_files = media
pkg.write_to_file(OUT)
print('notes', len(deck.notes), '->', OUT, os.path.getsize(OUT) // 1024, 'KB')
