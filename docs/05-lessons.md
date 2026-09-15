# Bài học dự án (lessons / gotchas)

Bộ nhớ cho **những điều học được trong lúc code** mà KHÔNG thuộc về các file memory khác. Đây là loại
memory duy nhất trước đây không có nhà — nay có. Mọi agent đọc file này ở đầu `/design-to-code` (bước
"Nạp memory") để **không lặp lại lỗi cũ**.

## File này chứa gì (và KHÔNG chứa gì)

| Nếu là… | Ghi vào | KHÔNG ghi vào đây |
|---|---|---|
| Thuật ngữ nghiệp vụ (Nhật-Việt-Anh) | `docs/00-glossary.md` | ✗ |
| Nguyên tắc bất biến của dự án | `.specify/memory/constitution.md` | ✗ |
| Câu trả lời cho 1 ambiguity của `/speckit-clarify` | `docs/04-decisions/` + `INDEX.md` | ✗ |
| **Gotcha kỹ thuật / cạm bẫy / mẹo đặc thù dự án** phát hiện khi implement | **file này** | — |

Ví dụ thuộc về đây: "API khách trả `date` dạng `YYYY/MM/DD` không phải ISO", "field `status` thực ra
nullable dù detail design không nói", "môi trường staging của khách rate-limit 10 req/s", "thư viện X
version Y có bug Z, dùng workaround W". Đây là *tri thức vận hành*, không phải thuật ngữ hay nguyên tắc.

## Quy tắc

- **Append-only, 1 dòng/bài học** (ít đụng nhau khi nhiều người làm — như glossary). Mới nhất xuống dưới.
- Được **append ngay trong branch feature** (không cần PR riêng) — đây là THÊM tri thức, blast radius nhỏ.
- Nếu một bài học tiến hoá thành **nguyên tắc chung** → nâng cấp nó lên `constitution.md` (qua PR steward),
  rồi ghi chú "đã lên constitution" ở cột Ghi chú. Nếu là **thuật ngữ** → chuyển sang glossary.
- Trước khi thêm dòng mới, quét bảng xem đã có chưa (tránh trùng).

## Bảng bài học

| Ngày | Bài học (gotcha) | Nơi phát hiện (feature / file) | Ghi chú / cách áp dụng |
|---|---|---|---|
| 2026-09-15 | `@nestjs/throttler` 6.5 (bản mới nhất) chỉ khai báo peer NestJS ≤ 11 — không cài được với NestJS 12 | `005-organization-access` · T005 | Dùng `express-rate-limit` 8 làm middleware; đã ghi sửa đổi vào decision tech-stack |
| 2026-09-15 | Vitest ≥ 4 đã bỏ `vitest.workspace.ts` (lỗi "workspace option was removed") | `005-organization-access` · T007 | Dùng `vitest.config.ts` với `test.projects` |
| 2026-09-15 | Hook chặn bỏ qua git hook hiểu cờ `-n` của lệnh khác (VD `grep`) hoặc chữ trong nội dung là cờ bỏ qua hook nếu nằm cùng lệnh Bash với `git commit` | commit sau `/speckit-analyze` | Luôn chạy `git commit` trong một lệnh Bash riêng |
| 2026-09-15 | Package workspace không có script `build` thì lỗi kiểu không bị gate `npm run build` bắt | `005-organization-access` · T009 | Mọi workspace (kể cả `tools/*`) phải có script `build` chạy `tsc --noEmit` |
| 2026-09-15 | `tsx` chạy từ thư mục gốc repo không đọc `apps/server/tsconfig.json` → decorator tham số NestJS lỗi "Parameter decorators only work when experimental decorators are enabled"; test Vitest không phát hiện vì dựng app qua `@nestjs/testing` | `005-organization-access` · T077 (lần đầu boot `main.ts`) | Đặt `TSX_TSCONFIG_PATH=apps/server/tsconfig.json` hoặc chạy từ `apps/server`; E2E là nơi duy nhất kiểm được `main.ts` |
| 2026-09-15 | Spawn `vite` với `cwd` là gốc repo phục vụ nhầm thư mục gốc (không có `index.html` của web) → trang trắng, test chờ tới timeout | `005-organization-access` · T077 | Spawn `vite` với `cwd = apps/web`; global setup kiểm `id="root"` trước khi chạy test |
| 2026-09-15 | `z.email()` (zod 4) từ chối TLD có chữ số như `@planix.e2e` → 400 VALIDATION_FAILED trong E2E | `005-organization-access` · T077 | Dữ liệu test dùng đuôi dành riêng `.test` (RFC 2606) |
| 2026-09-15 | E2E: click link điều hướng client-side rồi `fill` ngay có thể điền vào trang cũ | `005-organization-access` · T077 | Chờ heading của trang đích hiển thị trước khi thao tác |
| 2026-09-15 | Endpoint "không lộ email tồn tại" chỉ so body/status là chưa đủ: `await` gửi SMTP (và ghi DB) trong request làm lộ qua thời gian phản hồi | `005-organization-access` · security review (password reset) | Chạy phần việc phụ thuộc tài khoản sau khi đã trả lời; đợi xong ở `beforeApplicationShutdown`; test chờ email bằng polling (`waitForMessagesTo`) |
| 2026-09-15 | Rate limit theo prefix `/auth/*` đếm cả `GET /auth/session` (web gọi mỗi lần tải trang) → người dùng bình thường bị 429 sau ~30 lần tải; test tích hợp không lộ vì nâng giới hạn, chỉ E2E (giới hạn thật) mới lộ | `005-organization-access` · T087 | Rate limit chỉ đếm request thay đổi trạng thái; E2E dùng giới hạn production để bắt loại lỗi này. Heading Playwright khớp chuỗi con — dùng `exact: true` |
| 2026-09-15 | Tác dụng phụ (gửi email…) trong handler route tổ chức chạy **trước** commit của transaction dùng chung → giữ connection suốt round-trip SMTP và có thể gửi email cho dữ liệu bị rollback; `RecordingMailSender` đồng bộ nên test không lộ | `005-organization-access` · code review sau Phase 4 | Dùng `onRequestCommit(req, …)` (chỉ chạy sau COMMIT, không chạy khi rollback/ngắt kết nối) và gửi nền; test bằng mail sender chặn được |
| 2026-09-15 | Bật `idle_in_transaction_session_timeout` thì PostgreSQL chủ động đóng kết nối → `pg` phát sự kiện `error` trên client/pool; không có listener là process Node sập | `005-organization-access` · security review sau Phase 5 | Gắn listener `error` cho pool và cho client đang mượn; kết nối lỗi phải `release(error)` để không quay lại pool |
| 2026-09-15 | Supertest với app Nest **chưa listen** tự `listen(0)` rồi đóng cho từng request → khi nhiều file test chạy song song, request có thể trúng cổng vừa được listener khác (VD docker-proxy của Mailpit SMTP) dùng lại: lỗi ngẫu nhiên "socket hang up", HTTP 421, timeout | `005-organization-access` · Phase 7 (flake lặp lại 3 lần) | Test app luôn `await app.listen(0, '127.0.0.1')`; helper `api()` từ chối server chưa listen |
| 2026-09-15 | Code đang giữ transaction của request mà mở thêm connection (ghi audit, cập nhật phiên) → dưới tải đồng thời, mọi request giữ 1 và chờ 1 → **pool deadlock** toàn instance; `pg.Pool` mặc định chờ connection vô hạn, `statement_timeout` không áp dụng | `005-organization-access` · security review Phase 6–7 | Rollback transaction của request trước khi lấy connection khác; đặt `connectionTimeoutMillis`; test bằng pool nhỏ (max 2) + nhiều request đồng thời |
