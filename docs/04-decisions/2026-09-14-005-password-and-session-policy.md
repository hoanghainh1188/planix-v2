# Chính sách mật khẩu và phiên đăng nhập
- Ngày: 2026-09-14
- Feature liên quan: `005-organization-access` (issue #5)
- Câu hỏi gốc: Chấp nhận chính sách mật khẩu/phiên mặc định không, có cần "ghi nhớ đăng nhập"? (FR-006, FR-007; intake Ambiguity #4)
- Quyết định: Mật khẩu **≥ 12 ký tự**, chặn mật khẩu phổ biến/đã lộ (theo NIST 800-63B, không bắt ký tự đặc biệt); **khoá đăng nhập 15 phút sau 5 lần sai liên tiếp**; **hết phiên sau 8 giờ không hoạt động**; **không có "ghi nhớ đăng nhập"**; phiên của tài khoản bị vô hiệu hoá mất hiệu lực ở yêu cầu kế tiếp.
- Người quyết định: @hoanghainh1188 (chấp thuận khuyến nghị trong `/speckit-clarify`)

---
Nguồn ambiguity: [`spec.md`](../../specs/20260914-224646-organization-access/spec.md) (mục Clarifications) · [intake](../intake/005-organization-access.md)
