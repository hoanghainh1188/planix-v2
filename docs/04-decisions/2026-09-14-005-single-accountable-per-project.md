# Mỗi dự án luôn có đúng một Accountable
- Ngày: 2026-09-14
- Feature liên quan: `005-organization-access` (issue #5)
- Câu hỏi gốc: Mỗi dự án tối đa một Accountable và được phép chưa có, hay luôn đúng một? (FR-020; intake Ambiguity #5)
- Quyết định: **Luôn đúng một Accountable** là thành viên đang hoạt động của dự án. Người tạo dự án mặc định là Accountable. Thay Accountable là thao tác thay thế một bước. Mọi thao tác làm dự án mất Accountable (gỡ vai trò, xoá khỏi dự án, vô hiệu hoá trong tổ chức) **bị từ chối** cho tới khi chuyển cho người khác. Hệ quả cho OI-07: feature Change Control không cần xử lý trường hợp "chưa có Accountable".
- Người quyết định: @hoanghainh1188 (chấp thuận khuyến nghị trong `/speckit-clarify`)

---
Nguồn ambiguity: [`spec.md`](../../specs/20260914-224646-organization-access/spec.md) (mục Clarifications) · [intake](../intake/005-organization-access.md)
