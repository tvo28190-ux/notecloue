# NoteCloud — ghi chú đa thiết bị, mở bằng Admin Key

NoteCloud là web app ghi chú responsive cho máy tính và điện thoại. Phiên bản này **bỏ đăng ký/đăng nhập email**: người quản trị mở ứng dụng bằng một Admin Key dùng chung. Cùng Admin Key có thể mở cùng kho ghi chú trên nhiều thiết bị.

## Tính năng

- Mở khóa bằng Admin Key, không cần tài khoản người dùng.
- Tạo, sửa và tự động lưu ghi chú.
- Tìm kiếm, ghim, lưu trữ, chuyển vào thùng rác, khôi phục và xóa vĩnh viễn.
- Giao diện tiếng Việt, tương thích điện thoại/máy tính và cài được như PWA.
- Ghi chú lưu trên Supabase; thiết bị đang mở tự làm mới dữ liệu khoảng 10 giây/lần.

## Bảo mật quan trọng

Admin Key **không được nhúng vào mã frontend**. Key được lưu trong Supabase Edge Function secret `NOTE_ADMIN_KEY`; Edge Function kiểm tra key rồi mới thao tác database bằng Secret API Key ở phía máy chủ. Trình duyệt chỉ có Supabase anon/publishable key.

Ai có Admin Key đều có thể đọc, sửa và xóa toàn bộ ghi chú. Hãy dùng key dài, ngẫu nhiên (ít nhất 32 ký tự), không chia sẻ và không gửi key trong ảnh chụp màn hình/chat. Nút khóa ở thanh bên chỉ xóa key đã lưu trên thiết bị hiện tại; muốn thay key trên mọi thiết bị, đổi secret `NOTE_ADMIN_KEY` ở Supabase.

## 1. Cấu hình Supabase

### A. Cập nhật bảng ghi chú

1. Mở project Supabase → **SQL Editor** → **New query**.
2. Mở file `supabase-schema.sql` trong gói này, sao chép toàn bộ và dán vào SQL Editor.
3. Nhấn **Run**. File tương thích cả trường hợp bạn đã chạy schema cũ có `user_id NOT NULL`; nó sẽ cho phép `user_id` rỗng và gỡ quyền truy cập trực tiếp của anon/authenticated, để chỉ Edge Function truy cập dữ liệu.

### B. Tạo Admin Key bí mật

Tạo một chuỗi ngẫu nhiên dài ít nhất 32 ký tự bằng trình quản lý mật khẩu hoặc công cụ tạo mật khẩu. Không dùng database password, anon/publishable key hay Secret/service-role key làm Admin Key.

### C. Lưu Admin Key vào Supabase Secrets

1. Trong Dashboard của project, mở **Edge Functions → Secrets** (trang Edge Function Secrets).
2. Thêm một secret với:
   - **Key:** `NOTE_ADMIN_KEY`
   - **Value:** chuỗi Admin Key ngẫu nhiên bạn vừa tạo.
3. Nhấn **Save**. Supabase cung cấp sẵn `SUPABASE_URL` và Secret API Key cho Edge Function; không cần tự chép Secret/service-role key vào code.

### D. Tạo và deploy Edge Function

1. Trong thanh bên project, chọn **Edge Functions**.
2. Nhấn **Deploy a new function → Via Editor**.
3. Đặt tên function là `note-api`.
4. Mở file `supabase/functions/note-api/index.ts` trong gói mã nguồn, sao chép toàn bộ nội dung và thay mã mẫu trong trình soạn thảo Supabase.
5. Nhấn **Deploy function**.
6. Sau khi deploy, mở function `note-api` → tab **Details** và tắt **Enforce JWT Verification / Verify JWT**. Function đã tự kiểm tra header `x-admin-key`; nếu bật thêm JWT cũ, trình duyệt có thể bị chặn trước khi code chạy.

Tài liệu Supabase về tạo function trên Dashboard: https://supabase.com/docs/guides/functions/quickstart-dashboard

## 2. Chạy ứng dụng trên máy tính

Cài Node.js LTS. Trong thư mục dự án:

```bash
npm install
```

Sao chép `.env.example` thành `.env`, rồi điền Project URL và anon/publishable key trong Supabase → Project Settings → API Keys:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Khởi động:

```bash
npm run dev
```

Mở địa chỉ Vite hiển thị (thường là `http://localhost:5173`). Khi màn hình mở khóa xuất hiện, nhập Admin Key đã lưu ở bước C.

## 3. Đưa lên Internet để dùng cả máy tính và điện thoại

1. Đẩy mã nguồn lên repository GitHub riêng. Không đẩy file `.env` hoặc Admin Key.
2. Import repository vào Vercel.
3. Build Command: `npm run build`; Output Directory: `dist`.
4. Thêm hai biến môi trường `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` trong Vercel.
5. Deploy. Mở domain vừa có trên cả máy tính và điện thoại.
6. Nhập cùng Admin Key trên mỗi thiết bị. Có thể chọn “Add to Home Screen / Thêm vào màn hình chính” để cài như app.

## Cấu trúc dự án

```text
notecloud-app/
├── public/                         # PWA manifest, icon, service worker
├── src/                             # React app và giao diện
├── supabase/
│   ├── config.toml
│   └── functions/note-api/index.ts  # API kiểm tra Admin Key
├── supabase-schema.sql
├── .env.example
├── .gitignore
├── index.html
├── package.json
└── vite.config.js
```
