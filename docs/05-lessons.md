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
| 2026-09-15 | Khoá ngầm của khoá ngoại (`FOR KEY SHARE` khi INSERT dòng tham chiếu) có thể che mất việc thiếu khoá hàng tường minh: test race chỉ chạy một thứ tự vẫn xanh khi bỏ `FOR SHARE` | `005-organization-access` · code review Phase 8 | Viết race test cho **cả hai thứ tự** và kiểm bằng mutation (bỏ khoá → test phải đỏ) trước khi tin khoá là nguyên nhân chặn |
| 2026-09-15 | `<dialog open>` không phải modal (không bẫy focus, nền vẫn thao tác được, Esc không đóng); và Playwright `getByRole` vẫn đếm phần tử bị `inert` phía sau modal | `005-organization-access` · code review Phase 8 | Mở bằng `showModal()` + xử lý `cancel`; test bằng `toBeFocused()` và `page.locator('dialog:modal')` thay vì đếm nút phía sau |
| 2026-09-15 | `Decimal#toString()` giữ đủ độ chính xác nhưng **không có scale cố định** (bỏ số 0 cuối: `'2500.5000'` → `'2500.5'`), nên cùng một số tiền có thể là chuỗi khác nhau tuỳ đường ghi | `005-organization-access` · code review Phase 9 | So sánh tiền bằng `Decimal.of(a).equals(Decimal.of(b))`, không so chuỗi; cần scale cố định thì chỉ dùng `roundHalfUp(scale)` ở tầng hiển thị (RES `billingRate`, EVM `budgetAtCompletion`) |
| 2026-09-15 | Route vừa `@RequireAction` cấp dự án vừa có `ResponseSchema`/`RequestSchema` nhạy cảm resolve dự án **2 lần** (AuthorizationGuard + SensitiveFieldInterceptor), mỗi lần 1 truy vấn, cố ý không cache giữa request | `005-organization-access` · code review Phase 9 | Khi RES/EVM đo p95 (OI-14) mà thấy chậm: memo kết quả resolve trong chính request (không cache qua request — SC-004) |
| 2026-09-15 | Trên route có `ResponseSchema` nhạy cảm, body lỗi chỉ giữ tham số nguyên thuỷ/mảng chuỗi và bỏ khoá nhạy cảm theo **tên** trong schema — một khoá khác tên (VD `currentBudget`) mang giá trị nguyên thuỷ vẫn lọt | `005-organization-access` · security review Phase 9 (phương án A) | Không bao giờ đặt giá trị tài chính vào `DomainError` params; response chỉ trả khoá schema khai báo (`undeclaredKeys: 'drop'`); schema nhạy cảm không dùng `lazy`/`intersection`/`tuple`/`map` (app không khởi động) |
| 2026-09-15 | `eslint-plugin-i18next` 6.1.5 nạp được trên ESLint 10 nhưng rule `no-literal-string` **không báo chữ trong JSX** ở mọi mode (cả espree lẫn parser TypeScript) — cài vào sẽ cho cảm giác an toàn giả | `005-organization-access` · Phase 10 T118 | Dùng rule tự viết `planix/no-literal-string` (RuleTester + test cấu hình thật); plugin bên thứ ba cho lint phải có test chứng minh bắt được vi phạm |
| 2026-09-15 | `i18next.changeLanguage` hoàn tất sau vài tick (ngoài `act()`); đồng thời đồng bộ ngôn ngữ đã lưu trong effect mà so `i18n.language !== saved` sẽ **đảo ngược** lựa chọn của người dùng khi lưu chưa xong | `005-organization-access` · Phase 10 T117 | Test chờ bằng `findBy…`; chỉ áp ngôn ngữ đã lưu khi giá trị lưu thay đổi (`useRef`); test với request lưu không bao giờ xong |
| 2026-09-15 | Playwright `getByLabel` khớp **toàn bộ chữ trong `<label>`**, gồm cả các `<option>` của `<select>` bên trong → regex `^…$` không khớp | `005-organization-access` · Phase 10 E2E | Dùng `getByRole('combobox', { name })` (tên truy cập được) |
| 2026-09-15 | Chuẩn hoá múi giờ bằng `Intl…resolvedOptions().timeZone` **đổi tên theo phiên bản ICU**: `Asia/Ho_Chi_Minh` → `Asia/Saigon`, `Europe/Kyiv` → `Europe/Kiev`; `Intl.supportedValuesOf('timeZone')` cũng dùng tên cũ và không có `UTC` | `005-organization-access` · code review Phase 10 | Lưu tên IANA đúng như người dùng gửi; chỉ kiểm dạng `Area/Location` đúng hoa/thường (hoặc `UTC`) + `Intl` chấp nhận; picker thêm múi giờ hiện tại nếu không có trong danh sách |
