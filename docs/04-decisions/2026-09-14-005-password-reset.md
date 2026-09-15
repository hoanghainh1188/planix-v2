# Có chức năng đặt lại mật khẩu qua email trong v1
- Ngày: 2026-09-14
- Feature liên quan: `005-organization-access` (issue #5)
- Câu hỏi gốc: v1 có bắt buộc chức năng "quên mật khẩu" không? (FR-031)
- Quyết định: **Có trong v1.** Liên kết đặt lại qua email, **dùng một lần**, **hết hạn sau 1 giờ**, chỉ liên kết mới nhất còn hiệu lực; đặt lại thành công **huỷ mọi phiên đang mở**; phản hồi không tiết lộ email có tồn tại hay không; liên kết/mã không được ghi vào log. **Không có bước xác minh email riêng** — email coi như đã xác minh khi chấp nhận lời mời. MFA ngoài phạm vi.
- Người quyết định: @hoanghainh1188 (chấp thuận khuyến nghị trong `/speckit-clarify`)

---
Nguồn ambiguity: [`spec.md`](../../specs/20260914-224646-organization-access/spec.md) (mục Clarifications) · [intake](../intake/005-organization-access.md)
