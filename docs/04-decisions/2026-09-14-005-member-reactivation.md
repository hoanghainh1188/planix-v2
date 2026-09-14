# Kích hoạt lại thành viên: về vai trò Thành viên, không khôi phục quyền cũ
- Ngày: 2026-09-14
- Feature liên quan: `005-organization-access` (issue #5)
- Câu hỏi gốc: Admin có kích hoạt lại được thành viên đã bị vô hiệu hoá không? (FR-015; intake Ambiguity #6)
- Quyết định: **Có.** Vô hiệu hoá (không xoá cứng) giữ lịch sử và nhật ký kiểm toán. Kích hoạt lại đưa người đó về trạng thái hoạt động với **vai trò mặc định Thành viên**; **không tự khôi phục** vai trò hệ thống cũ, tư cách thành viên dự án hay RACI — Admin/PM cấp lại có chủ đích (mặc định từ chối). Lịch sử cũ vẫn gắn với cùng tài khoản.
- Người quyết định: @hoanghainh1188 (chấp thuận khuyến nghị trong `/speckit-clarify`)

---
Nguồn ambiguity: [`spec.md`](../../specs/20260914-224646-organization-access/spec.md) (mục Clarifications) · [intake](../intake/005-organization-access.md)
