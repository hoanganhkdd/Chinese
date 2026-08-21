# 📱 Cài app lên điện thoại (PWA)

App đã là **PWA** (Progressive Web App): cài vào màn hình chính như app thật, chạy offline, có icon riêng. Cần đưa app lên một địa chỉ **HTTPS** rồi mở trên điện thoại và "Thêm vào màn hình chính".

Các file cần đưa lên (toàn bộ thư mục): `index.html`, `styles.css`, `app.js`, `appdata.js`, `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`.

---

## ✅ Cách 1 — Netlify Drop (nhanh nhất, miễn phí, không cần tài khoản)
1. Vào **https://app.netlify.com/drop**
2. **Kéo–thả cả thư mục** `D:\Aigravity\github\CHINESE` (hoặc chọn nội dung thư mục) vào ô trên trang.
3. Netlify tạo ngay một link HTTPS, ví dụ `https://ten-ngau-nhien.netlify.app`.
4. Mở link đó trên điện thoại → xem mục "Cài đặt" bên dưới.

> 💡 Nên tạo thư mục con chỉ chứa 8 file kể trên rồi kéo thả, để không upload nhầm các file `.py`, `.xlsx`, backup…

## ✅ Cách 2 — GitHub Pages (miễn phí, có link cố định)
1. Tạo repo mới trên GitHub, upload 8 file trên (giữ nguyên cấu trúc, `index.html` ở gốc).
2. Repo → **Settings → Pages** → Source: `Deploy from a branch` → branch `main`, folder `/root` → Save.
3. Sau ~1 phút có link `https://<tên-user>.github.io/<tên-repo>/`.
4. Mở trên điện thoại → cài đặt.

```bash
# nếu dùng git dòng lệnh
git init && git add index.html styles.css app.js appdata.js manifest.webmanifest sw.js icon-192.png icon-512.png
git commit -m "HSK learning PWA"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

## ✅ Cách 3 — Vercel (miễn phí)
1. Cài `npm i -g vercel`, vào thư mục app, chạy `vercel` và làm theo hướng dẫn.
2. Nhận link HTTPS → mở trên điện thoại.

## 🧪 Cách 4 — Thử nhanh trong mạng WiFi nhà (không cài được, chỉ để xem)
1. Trên máy tính chạy: `python -m http.server 8777`
2. Xem IP máy tính: `ipconfig` (ví dụ `192.168.1.10`).
3. Điện thoại **cùng WiFi** mở `http://192.168.1.10:8777`.
> ⚠️ Cách này dùng HTTP nên **không cài được vào màn hình chính** và không chạy offline (trình duyệt yêu cầu HTTPS cho PWA). Chỉ để xem thử.

---

## 📲 Cài vào màn hình chính (sau khi có link HTTPS)
- **Android (Chrome):** mở link → menu ⋮ → **"Cài đặt ứng dụng" / "Thêm vào Màn hình chính"**.
- **iPhone (Safari):** mở link → nút Chia sẻ (hình vuông mũi tên) → **"Thêm vào MH chính"**.

Sau khi cài: mở từ icon 汉, app chạy toàn màn hình, và **hoạt động offline** (dữ liệu từ vựng, chiết tự, âm bồi đã lưu sẵn). Chỉ **Youglish** và **video YouTube** cần mạng.

## Lưu ý
- Giọng đọc tiếng Trung trên điện thoại: Android/iOS thường có sẵn giọng "Chinese". Nếu không nghe được, vào Cài đặt → Ngôn ngữ & giọng nói (TTS) để tải giọng Trung.
- Tiến độ học lưu trên chính điện thoại (localStorage). Xóa dữ liệu trình duyệt sẽ mất tiến độ — có thể "Xuất tiến độ (JSON)" ở mục Thống kê để sao lưu.
