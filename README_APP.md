# 汉语 · App Học Tiếng Trung HSK

Web app học tiếng Trung được tạo từ dữ liệu trong `HSK1_Tu_Vung_500.xlsx` (7 sheet).

## Cách chạy
**Trên máy tính:** Nhấp đúp vào `index.html` (chạy offline). Nếu trình duyệt chặn, chạy server cục bộ:
```bash
python -m http.server 8777
```
rồi mở http://localhost:8777

**Trên điện thoại (cài như app thật, PWA):** xem hướng dẫn chi tiết trong **`DEPLOY_PHONE.md`** — nhanh nhất là kéo–thả thư mục vào https://app.netlify.com/drop để có link HTTPS, rồi "Thêm vào màn hình chính".

## Tính năng chính
App ghi nhớ & học tiếng Trung, **ưu tiên luyện nghe và từ vựng**.

| Mục | Mô tả |
|---|---|
| 🔢 **Đếm số lần học/nghe** | Mỗi từ có badge **🔊×n** (số lần nghe) và **📖×n** (số lần học). Trang Từ vựng & Nghe liên tục **sắp xếp theo tần suất** (ít nhất → nhiều) để ưu tiên từ chưa quen. |
| 📅 **Hôm nay học gì** | Trang chủ có lộ trình hằng ngày: **chuỗi streak 🔥**, mục tiêu thẻ/ngày (thanh tiến độ), việc cần làm hôm nay, và **Danh sách cố định 100 từ + 100 câu** (chọn tự động, giữ nguyên cả ngày; nút Học/Nghe/Ôn câu/Xem). |
| 📖 **Ôn câu ví dụ** | SRS lặp lại ngắt quãng trên **cả câu** (câu nguồn + câu ví dụ): nghe → hiểu → tự chấm Quên/Khó/Nhớ/Dễ. |
| 🌿 **Bộ thủ** | Tra 1 chữ → bộ thủ + âm Hán-Việt + nghĩa gốc + chữ liên quan; duyệt ~56 bộ thủ thường gặp kèm chữ ví dụ. |
| ⏰ **Nhắc ôn theo giờ** | Đặt giờ nhắc (mặc định 08:00) → thông báo trình duyệt khi đến giờ; nhắc bù khi mở app sau giờ (⚙️ Cài đặt). |
| 📊 **Biểu đồ 14 ngày** | Thống kê hiển thị cột 14 ngày: ôn tập · từ mới · ôn câu. |
| 🌐 **Tra nghĩa tự động** | Trong Room tạm: Google Translate (không cần key) → MyMemory dự phòng; hoặc AI kèm **loại từ + câu ví dụ**. |
| 🧠 **Ôn tập ghi nhớ (SRS)** | Lặp lại ngắt quãng (SM-2). **Thống kê Khó/Đang học/Dễ/Thuộc/Mới**. 3 chế độ kiểm tra: 🎧 nhận biết (nghe→đoán), ✍️ viết hán tự, 🎤 nói hán tự (chấm phát âm qua micro). Lọc ưu tiên từ Khó. |
| 🎧 **Luyện nghe** | 7 chế độ: nghe→chọn nghĩa/hán tự, nghe câu→đáp án, **🔁 nghe liên tục** (playlist rảnh tay), **📖 ghép câu chuyện** từ nhóm từ (+ nút tạo truyện bằng AI), **✍️ nghe→viết**, **🎤 nghe→nói lại**. |
| ➕ **Thêm nguồn từ** | Nạp từ **5 nguồn**: đoạn text · YouTube (xem + dán phụ đề) · Reel Facebook · **file PDF** (đọc chữ) · **hình ảnh (OCR)**. Từ được đưa vào **Room tạm** để lọc trùng + lọc cơ bản (độ dài, hư từ), bạn duyệt bằng checkbox rồi **xác nhận vào Thư viện keyword** hoặc lưu thành Room. |
| 📇 **Thư viện keyword** | Kho từ bạn tự thu thập (đã tự lọc trùng). Tìm kiếm, nghe tất cả, xóa, **xuất CSV**. Là nguồn cho ôn tập ghi nhớ. |
| 📎 **Tài liệu / Link** | Lưu link **video, Google Drive, PDF, web...** để mở nhanh. Tự nhận diện loại link (▶️📁📄), gắn nhãn, ghi chú, tìm kiếm, copy/mở nhanh. |
| ⚙️ **Cài đặt** | Nhập **OpenAI API key** (tạo truyện AI), chọn **giọng đọc tiếng Việt**, sao lưu/khôi phục toàn bộ dữ liệu. |
| 🗣️ **Âm bồi** | **Luôn hiển thị** cạnh pinyin ở mọi nơi (你好→nỉ hảo, 的→tơ, 么→mơ). Có nút **🇻🇳 Đọc âm bồi** — đọc bằng **giọng tiếng Việt** để nghe phát âm theo âm tiếng Việt. |
| 🚗 **Đọc tất cả (rảnh tay)** | Khẩu ngữ, Thương mại, Câu nguồn, Nghe liên tục, Thư viện… có **▶ Đọc tất cả** — phát tuần tự với thanh điều khiển nổi (tua, lặp). Nút **🇻🇳** đọc **kèm nghĩa tiếng Việt** sau mỗi từ tiếng Trung (bật sẵn) — vừa nghe vừa hiểu nghĩa khi lái xe. |
| 🧩 **Chiết tự** | Tra bất kỳ chữ/từ → phân tích **từng chữ**: pinyin · âm bồi · **âm Hán-Việt** · nghĩa gốc · **🌿 bộ thủ** (nhận diện cho mọi chữ, kể cả từ mới). Hiển thị trong chi tiết từ, flashcard, ôn tập. |
| 💡 **Trợ lý ghi nhớ** | Nút **💡 Cách nhớ** ở khắp nơi (chi tiết từ, thư viện, room tạm, chiết tự). Mở hướng dẫn: chiết tự offline + **AI tạo mẹo liên tưởng** (chiết tự sâu + câu chuyện dễ nhớ + ví dụ). Trong **Ôn câu**: bấm từng từ để học **cách nhớ từ trong ngữ cảnh câu**. Lưu mẹo vào ghi chú của từ. |
| 📚 Từ vựng HSK (1022) | Lọc cấp độ/chủ đề, tìm kiếm, chiết tự + ví dụ, phát âm, Youglish, đánh dấu thuộc |
| 🎴 Flashcard | Lật thẻ ôn nhanh |
| ✍️ Luyện viết | Nhìn nghĩa+pinyin, gõ hán tự, chấm điểm |
| 📝 Kiểm tra | Trắc nghiệm chọn nghĩa |
| 🎯 **Thi thử** | Bài thi tính giờ (10–50 câu, đếm ngược, tự nộp khi hết giờ), chấm %, lưu kỷ lục, **xem lại câu sai** + nghe lại từ sai. |
| 🗣️ Khẩu ngữ (500) | Theo 17 chủ đề tình huống |
| 💼 Thương mại (217) | Từ kinh doanh kèm English |
| 📄 Câu nguồn (3330) | Tra cứu, lọc theo PDF |
| 📋 Phụ đề → Pinyin | Dán chữ Hán → tách từ + pinyin (offline) + nghĩa Việt + dịch đoạn qua Google |
| 📊 Thống kê | Tiến độ, điểm nghe/kiểm tra, biểu đồ, xuất/reset |

## Youglish
Mọi từ/câu đều có nút **🌐 Youglish** — mở cửa sổ nghe **người bản xứ phát âm trong video thật**, nhúng ngay trong app (cần mạng; nếu offline sẽ có nút mở Youglish.com).

## Ghi chú
- Tiến độ học, lịch ôn SRS, từ tự thêm, điểm số → lưu trong trình duyệt (localStorage) trên máy bạn.
- Phát âm dùng giọng đọc tiếng Trung của hệ điều hành (Web Speech API) — nên cài gói giọng "Chinese (Simplified)" trong Windows để nghe hay hơn.
- Bộ tách từ dùng từ điển ~31.000 từ (jieba) + pinyin ~42.000 chữ, chạy offline.
- Module 🎬 Nhập video **bổ sung** cho các script Python có sẵn (`HA_video.py` — OCR/tự tải phụ đề YouTube cần backend). App web nhận phụ đề dán vào và xử lý từ mới ngay trên trình duyệt.

## Tệp
- `index.html`, `styles.css`, `app.js` — mã nguồn app
- `appdata.js` — toàn bộ dữ liệu đã trích xuất (nhúng sẵn) — **bản canonical đang chạy**
- `data.json` — dữ liệu dạng JSON thuần
- `build.py` — sinh lại dữ liệu từ file HSK seed (xuất `appdata.generated.js`, không ghi đè bản chạy)
- `sw.js` — service worker **network-first** (luôn lấy bản mới khi online; CDN cache-first)
- `manifest.webmanifest`, `icon-*.png` — PWA
- `netlify.toml`, `render.yaml`, `dist/_redirects` — cấu hình deploy
- `dist/` — thư mục gọn chỉ chứa file cần deploy (kéo–thả lên Netlify)

## Deploy
- **GitHub:** https://github.com/hoanganhkdd/Chinese (nhánh `main`)
- **Netlify:** kéo–thả thư mục `dist/` vào project, hoặc kết nối repo (publish `dist`).
- **GitHub Pages / Render:** dùng `render.yaml` hoặc bật Pages từ nhánh `main`.
