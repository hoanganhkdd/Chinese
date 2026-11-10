# PROMPT CHO CLAUDE CODE – Thư viện hình ảnh trực quan gợi nhớ 2.000 từ HSK

> Cách dùng: mở Claude Code trong thư mục `D:\Aigravity\github\CHINESE\hsk_visual_library`, rồi dán toàn bộ phần **"PROMPT"** bên dưới vào.

---

## PROMPT

Bạn là kỹ sư Python + front-end. Hãy xây dựng **thư viện hình ảnh trực quan gợi nhớ mặt chữ Hán** cho 2.000 từ HSK của tôi (người Việt, học tiếng Trung để giao tiếp xuất nhập khẩu). Mục tiêu: mở trên **máy tính và điện thoại (iPhone, Safari)** đều xem được, mỗi từ có một **thẻ hình ảnh** giải thích chữ theo bộ thủ, biểu tượng, phần gợi NGHĨA và phần gợi ÂM.

### 1. Đầu vào đã có sẵn trong thư mục này (KHÔNG soạn lại, KHÔNG bịa thêm)
| File | Nội dung |
|---|---|
| `data/hsk_list_1-6.txt` | Danh sách HSK 1–6 gốc của tôi. 2.000 từ = HSK1–4 + 804 từ đầu HSK5 theo thứ tự file |
| `data/base.json` | 2.000 từ đã xử lý: `id, hsk, word, syl (pinyin có dấu, tách âm tiết), hanviet, chars[{ch, hv, comps[[thành_phần, nhãn]]}], en` |
| `data/content/c01.txt … c08.txt` | Nghĩa tiếng Việt + câu ví dụ + dịch, định dạng `id|nghĩa|câu ví dụ|dịch` |
| `src/data.py` | 179 từ công sở viết tay (có chiết tự kể chuyện) – ưu tiên dùng cho các từ trùng |
| `data/external/hanviet.csv` | Âm Hán Việt theo pinyin (nguồn: github.com/ph0ngp/hanviet-pinyin-wordlist) |
| `src/visual.py` | `ICON` (bộ thủ → emoji + nghĩa ngắn, ~240 mục) và `PICTO` (mô tả chữ tượng hình, ~110 chữ) |
| `src/mnemo.py` | Logic phân loại HÌNH THANH / HỘI Ý / TƯỢNG HÌNH, gán vai trò NGHĨA/ÂM, "họ âm", và hàm vẽ PNG |
| `src/ambo.py`, `src/py_util.py` | Âm bồi tiếng Việt; pinyin chuẩn (CC-CEDICT, biến điệu 一/不) |
| `src/build2.py`, `src/make_apkg.py` | Bản build cũ ra Excel + Anki (.apkg) |

Dữ liệu tách bộ bổ sung: tải `https://raw.githubusercontent.com/cjkvi/cjkvi-ids/master/ids.txt` vào `data/external/ids.txt`.

### 2. Việc cần làm
**Bước 0 – Dọn mã:** chuyển mọi đường dẫn tuyệt đối (`/home/claude/...`, `/mnt/user-data/...`) sang đường dẫn tương đối theo thư mục dự án; tạo `requirements.txt` (pypinyin, hanzipy, opencc-python-reimplemented, jieba, pillow, openpyxl, genanki, fonttools). Chạy được trên **Windows**.

**Bước 1 – Thư viện biểu tượng (dùng ảnh mở, không phụ thuộc font emoji của máy):**
- Tải bộ **Twemoji** (giấy phép CC-BY 4.0, repo `jdecked/twemoji`, thư mục `assets/svg`) chỉ cho các emoji đang dùng trong `ICON` → lưu `library/icons/<codepoint>.svg`.
- Ghi công Twemoji ở chân trang.
- Nếu emoji nào không có SVG: ghi log, dùng chữ bộ thủ thay thế. Không được để ô trống.

**Bước 2 – Dữ liệu thư viện `library/data.json`:** mỗi từ gồm: `id, hsk, word, pinyin, ambo, hanviet, nghia, vidu, vidu_pinyin, vidu_dich, chars[]`. Mỗi `char`: `ch, pinyin, hv, loai (hinhthanh|hoiy|tuonghinh|goc), picto_mota, comps[{c, icon_svg, nghia_ngan, ten_hv, vai_tro (nghia|am|""), am_doc}]`, `ho_am` (các chữ cùng phần gợi âm trong 2.000 từ), `cau_nho` (câu hướng dẫn ghi nhớ). Lấy logic từ `src/mnemo.py`; với 179 từ công sở thì đặt câu chuyện viết tay ở đầu `cau_nho`.

**Bước 3 – Trang web tĩnh `library/index.html`** (một file HTML + `data.json` + thư mục `icons/`, mở trực tiếp bằng trình duyệt, không cần server; nếu `fetch` file cục bộ bị chặn thì nhúng data vào `data.js`):
- **Thẻ hình ảnh mỗi từ** (vẽ bằng HTML/CSS/SVG, không phải ảnh PNG): chữ Hán lớn → dấu "=" → các ô thành phần, mỗi ô có **biểu tượng Twemoji to**, chữ bộ thủ, nghĩa ngắn, nhãn **NGHĨA** (viền đỏ #C8102E) hoặc **ÂM + pinyin** (viền xanh #1F4E79) → ô nghĩa tiếng Việt (nền navy #37424A). Chữ tượng hình: hiện biểu tượng + mô tả hình gốc.
- Dưới thẻ: pinyin, âm bồi, Hán Việt, câu hướng dẫn ghi nhớ, câu ví dụ (pinyin + dịch), nút 🔊 đọc bằng `speechSynthesis` (lang `zh-CN`), dòng "Cùng họ âm: …" (bấm vào chữ để nhảy tới từ đó).
- **Thanh công cụ:** ô tìm kiếm (chữ Hán / pinyin không dấu / Hán Việt / tiếng Việt), lọc HSK 1–5, lọc loại chữ (hình thanh / hội ý / tượng hình), lọc theo bộ thủ.
- **3 chế độ xem:** (a) *Danh sách thẻ*; (b) *Thư viện bộ thủ*: lưới các bộ, mỗi bộ có biểu tượng, nghĩa, số chữ, bấm vào thì liệt kê các chữ chứa bộ đó; (c) *Họ âm*: các nhóm chữ chung phần gợi âm (ví dụ 青 → 请 清 情 晴 睛 精 静).
- **Chế độ Flashcard:** mặt trước chỉ có chữ Hán, chạm để lật ra thẻ hình ảnh; nút "Nhớ / Chưa nhớ"; lưu tiến độ vào `localStorage` (bọc try/catch); học 15 từ mới mỗi ngày theo thứ tự id.
- **Giao diện:** nền trắng, đỏ #C8102E, navy #37424A, hồng nhạt #FCE4EA; font chữ Hán "Noto Sans SC", "PingFang SC", "Microsoft YaHei"; responsive. Trên iPhone màn hình 375px thẻ phải xuống dòng gọn, không cuộn ngang.
- Hiển thị theo trang/cuộn ảo (≤ 50 thẻ mỗi lần render) để mượt với 2.000 từ.

**Bước 4 – Xuất kèm (tùy chọn, làm sau khi web xong):**
- `export/vis/<id>.png`: chụp từng thẻ thành PNG bằng Playwright (hoặc giữ hàm Pillow trong `mnemo.py`).
- Cập nhật Excel (`build2.py`) và Anki (`make_apkg.py`) để dùng ảnh mới; Anki thêm `{{tts zh_CN:Hanzi}}`.

### 3. Lỗi đã biết, cần sửa
1. Một số thành phần là **chữ cổ thuộc Unicode Ext-B** (ví dụ 𢀖 trong 经/轻), font không có glyph → hiển thị dạng "(nét cổ)" + tooltip mã IDS; không để ô trống.
2. **Vai trò NGHĨA/ÂM gán tự động** (so pinyin thành phần với cả chữ) → có chỗ sai (ví dụ 谢: 射 thực ra gợi âm theo âm cổ). Tạo file `data/overrides.json` để tôi sửa tay `{chữ: {thành_phần: "am"|"nghia"}}`, và áp file này khi build.
3. Hai chấm trong 办 bị tách thành 八 → cho phép override thành phần trong `overrides.json`.
4. Câu "hội ý" hiện đang theo khuôn chung → thêm trường `cau_chuyen` trong `overrides.json` để tôi tự viết câu chuyện; nếu có thì ưu tiên hiện câu đó.
5. File Excel nặng (~26 MB) → web là sản phẩm chính; Excel chỉ giữ link/tên ảnh nếu cần nhẹ.

### 4. Quy tắc
- **Không bịa dữ liệu:** nghĩa, ví dụ, Hán Việt, tách bộ chỉ lấy từ các file đầu vào. Thiếu thì để trống và ghi vào `report/missing.csv`.
- Không sửa nội dung `c01–c08.txt`, chỉ đọc.
- Mỗi bước xong thì chạy kiểm tra và báo cáo ngắn.

### 5. Tiêu chí nghiệm thu
- [ ] `python src/build_library.py` chạy sạch trên Windows, tạo `library/index.html`, `library/data.json` (hoặc `data.js`), `library/icons/`.
- [ ] Đủ **2.000 từ**; 0 từ thiếu nghĩa / ví dụ; báo cáo số chữ theo loại (hình thanh / hội ý / tượng hình / gốc) và số biểu tượng thiếu.
- [ ] Mở `index.html` bằng Chrome trên máy tính và Safari trên iPhone (ví dụ chép qua iCloud Drive hoặc đưa lên GitHub Pages): tìm "qing" ra 请 清 情…; bấm 🔊 đọc được; flashcard lưu được tiến độ.
- [ ] Chụp màn hình 5 thẻ mẫu (请, 休息, 水, 经理, 公共汽车) ở khổ 375px và 1280px để tôi duyệt.
- [ ] (Tùy chọn) Hướng dẫn đưa `library/` lên **GitHub Pages** từ repo `D:\Aigravity\github\CHINESE` để mở trên iPhone bằng link.

Bắt đầu bằng việc đọc `src/mnemo.py`, `src/visual.py`, một mẫu trong `data/base.json`, rồi đề xuất cấu trúc thư mục và kế hoạch ngắn trước khi code.
