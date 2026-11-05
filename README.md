# NoteCloud — ứng dụng ghi chú đa thiết bị

NoteCloud là web app ghi chú responsive, dùng được trên máy tính và điện thoại. Người dùng đăng ký/đăng nhập bằng email và mật khẩu; ghi chú được lưu trên Supabase nên có thể đăng nhập cùng tài khoản ở nhiều thiết bị để xem và sửa cùng một dữ liệu.

## Tính năng

- Đăng ký, đăng nhập và đăng xuất bằng email/mật khẩu.
- Tạo, sửa và tự động lưu ghi chú.
- Tìm kiếm theo tiêu đề và nội dung.
- Ghim ghi chú, lưu trữ, chuyển vào thùng rác, khôi phục hoặc xóa vĩnh viễn.
- Giao diện tiếng Việt, tự thích ứng với máy tính và điện thoại.
- Có manifest và service worker để hỗ trợ cài app (PWA) từ trình duyệt.
- Phân quyền dữ liệu theo tài khoản bằng Row Level Security (RLS) của Supabase.

> Đồng bộ ghi chú cần kết nối Internet. Service worker chỉ lưu bộ khung giao diện; bản này chưa hỗ trợ sửa ghi chú ngoại tuyến rồi tự đồng bộ trở lại.

## 1. Tạo backend miễn phí với Supabase

1. Tạo project tại [https://supabase.com](https://supabase.com).
2. Mở **Project Settings → API** (hoặc **Data API / API Keys**, tùy giao diện) và sao chép Project URL cùng anon/public key.
3. Trong thư mục dự án, sao chép `.env.example` thành `.env` rồi điền hai giá trị:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

4. Mở **SQL Editor** trong Supabase, chạy toàn bộ nội dung file `supabase-schema.sql` để tạo bảng và chính sách bảo mật.
5. Trong **Authentication → URL Configuration**, đặt Site URL thành địa chỉ app sau khi deploy. Thêm `http://localhost:5173` vào Redirect URLs để thử ở máy cá nhân.
6. Nếu muốn người dùng xác nhận email trước khi đăng nhập, giữ Email Confirmations bật. Khi đó sau khi đăng ký, người dùng cần mở thư xác nhận.

**An toàn:** chỉ đưa anon/publishable key vào biến `VITE_SUPABASE_ANON_KEY`. Tuyệt đối không đưa `service_role` key vào frontend hoặc commit file `.env` lên GitHub.

## 2. Chạy ở máy tính

Cần cài Node.js bản LTS. Mở terminal tại thư mục dự án và chạy:

```bash
npm install
npm run dev
```

Mở địa chỉ Vite in ra (thường là `http://localhost:5173`). Để kiểm tra bản production:

```bash
npm run build
npm run preview
```

## 3. Đưa lên Internet để dùng trên máy tính và điện thoại

Cách dễ nhất là deploy bằng Vercel:

1. Đẩy thư mục dự án lên một GitHub repository riêng (không đẩy file `.env`).
2. Vào [https://vercel.com](https://vercel.com), import repository.
3. Giữ Build Command là `npm run build`, Output Directory là `dist`.
4. Thêm hai Environment Variables `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` trong phần cài đặt project của Vercel.
5. Deploy. Sau khi có domain, quay lại Supabase → Authentication → URL Configuration để cập nhật Site URL và thêm domain vào Redirect URLs.

Từ máy tính hoặc điện thoại, mở cùng địa chỉ website và đăng nhập cùng một tài khoản. Trên điện thoại, có thể chọn **Add to Home Screen / Thêm vào màn hình chính** trong menu trình duyệt. Trên một số trình duyệt máy tính, có thể chọn biểu tượng cài đặt ứng dụng ở thanh địa chỉ.

## Cấu trúc dự án

```text
notecloud-app/
├── public/
│   ├── manifest.webmanifest
│   ├── note-icon.svg
│   └── sw.js
├── src/
│   ├── main.jsx
│   ├── style.css
│   └── supabase.js
├── .env.example
├── index.html
├── supabase-schema.sql
├── package.json
└── vite.config.js
```

## Ghi chú kỹ thuật

- Frontend: React + Vite.
- Đăng nhập và lưu trữ: Supabase Auth + Postgres.
- Mỗi bản ghi được gắn `user_id`; RLS giới hạn SELECT/INSERT/UPDATE/DELETE theo `auth.uid()`.
- Supabase Realtime phát thay đổi tới các thiết bị đang mở cùng tài khoản; cột `updated_at` được cập nhật tự động ở database.
- Nội dung ghi chú được lưu dạng văn bản thuần. Không có chia sẻ ghi chú giữa các tài khoản trong phiên bản này.
