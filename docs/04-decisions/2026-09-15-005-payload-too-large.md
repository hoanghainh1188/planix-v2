# Body vượt giới hạn trả 413 `PAYLOAD_TOO_LARGE`
- Ngày: 2026-09-15
- Feature liên quan: `005-organization-access` (issue #5) — Phase 11, T124/T125
- Câu hỏi gốc: T124 yêu cầu "body vượt giới hạn → 413", nhưng `contracts/api.md` §Mã lỗi không có mã nào cho 413.
  Hiện tại lỗi của body parser (Express) không phải `HttpException` nên `DomainErrorFilter` trả **500
  `INTERNAL_ERROR`**. Phát hiện khi bắt đầu `/speckit-implement` Phase 11.
- Quyết định: **Phương án B1 — thêm mã lỗi mới `PAYLOAD_TOO_LARGE` (HTTP 413).**
  - Giới hạn **100 KB** cho body JSON và `application/x-www-form-urlencoded`, áp cho **mọi route** (bằng mặc định
    hiện tại của Express, nay khai báo tường minh trong `configureApp`).
  - Body lỗi theo quy ước chung: `{ "error": { "code": "PAYLOAD_TOO_LARGE", "params": {} } }`; không ghi gì, không
    log body.
  - Cập nhật: `contracts/api.md` (danh sách mã lỗi), `packages/core` error codes, `DomainErrorFilter`, bản dịch web
    vi + en.
- Bổ sung 2026-09-15 (code review Phase 11, chọn b): các lỗi 4xx khác của body parser (VD 415 `charset.unsupported`,
  `encoding.unsupported`) trả **400 `VALIDATION_FAILED`** thay vì 500 `INTERNAL_ERROR`; không thêm mã lỗi mới. JSON sai
  cú pháp đã được Nest tự chuyển thành 400.
- Bổ sung 2026-09-15 (security review Phase 11): giới hạn áp cho **mọi loại body**, không chỉ JSON/urlencoded — middleware
  đầu tiên sau `helmet` từ chối `Content-Length` > 100 KB bằng 413 `PAYLOAD_TOO_LARGE` trước mọi guard; body kiểu khác
  không bao giờ được đọc. Body chunked không khai báo độ dài chỉ bị giới hạn khi được parse (JSON/urlencoded).
- Phương án bị loại: B2 — trả 413 kèm `VALIDATION_FAILED` (không thêm mã, nhưng mã gợi ý sai rằng dữ liệu nhập không
  hợp lệ, trong khi nguyên nhân là kích thước).
- Người quyết định: @hoanghainh1188 (chọn phương án B1)

---
Nguồn: [`tasks.md`](../../specs/20260914-224646-organization-access/tasks.md) T124, T125 ·
[`contracts/api.md`](../../specs/20260914-224646-organization-access/contracts/api.md) §Mã lỗi
