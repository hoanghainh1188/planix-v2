# Tạo Platform Operator đầu tiên bằng `ops:grant-operator --create`
- Ngày: 2026-09-15
- Feature liên quan: `005-organization-access` (issue #5) — Phase 11, T127; sửa đổi research R11
- Câu hỏi gốc: chạy quickstart trên môi trường dev mới, bước `npm run ops:grant-operator -- --email
  operator@planix.local` lỗi "No account with email …; the operator must accept an invitation first". Tài khoản chỉ
  được tạo khi chấp nhận lời mời (decision `2026-09-14-005-organization-creation`), lời mời thuộc một tổ chức, và chỉ
  Operator tạo được tổ chức → cài đặt mới (dev **và production**) **không có đường nào** tạo Operator đầu tiên.
  Integration test, E2E và script tải đều seed tài khoản Operator bằng SQL nên không lộ lỗ hổng này.
- Quyết định: **Phương án A — thêm cờ `--create` cho `npm run ops:grant-operator`.**
  - `npm run ops:grant-operator -- --email <email> --create [--locale vi|en]`: nếu email chưa có tài khoản, CLI
    (role owner, như hiện nay) tạo `app_user` với mật khẩu **không dùng được** (hash argon2 của một bí mật ngẫu nhiên
    không lưu ở đâu), cấp `platform_operator_grant`, và phát hành **liên kết đặt lại mật khẩu** (bảng
    `password_reset_token`, cùng thời hạn 1 giờ như FR-031) gửi tới email đó. Operator tự đặt mật khẩu qua trang đặt
    lại mật khẩu; hết hạn thì dùng "quên mật khẩu" bình thường.
  - Không nhận mật khẩu qua tham số dòng lệnh; CLI **không in** liên kết/token ra stdout hay log.
  - Tạo tài khoản, cấp quyền và token nằm trong **một transaction**; email gửi **sau khi commit**. Audit
    `platform.operator.grant` (`actor_kind = system`) ghi thêm `accountCreated: true` — không có token hay hash.
  - Email đã có tài khoản: `--create` chỉ cấp quyền như trước, không tạo gì, không gửi email.
  - Không có `--create` mà email chưa có tài khoản: vẫn lỗi, thông báo gợi ý dùng `--create`.
- Phương án bị loại: B — script riêng `ops:create-operator` (hai CLI chồng chức năng); C — hướng dẫn tạo tài khoản bằng
  SQL tay trong quickstart (tự tính hash mật khẩu, dễ sai, không audit).
- Người quyết định: @hoanghainh1188 (chọn phương án A)

---
Nguồn: [`research.md`](../../specs/20260914-224646-organization-access/research.md) R11 ·
[`quickstart.md`](../../specs/20260914-224646-organization-access/quickstart.md) ·
[`tasks.md`](../../specs/20260914-224646-organization-access/tasks.md) T071, T127
