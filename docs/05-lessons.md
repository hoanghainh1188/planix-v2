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
