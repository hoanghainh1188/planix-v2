# Thành viên tổ chức giữ nhiều vai trò hệ thống, quyền là hợp
- Ngày: 2026-09-14
- Feature liên quan: `005-organization-access` (issue #5)
- Câu hỏi gốc: Một thành viên tổ chức được giữ nhiều vai trò hệ thống cùng lúc, hay chỉ đúng một vai trò? (FR-012; intake Ambiguity #8)
- Quyết định: **Nhiều vai trò cùng lúc**; quyền = **hợp (union)** quyền của các vai trò đang giữ. Gỡ một vai trò chỉ mất những quyền không còn được vai trò khác cấp. Mặc định từ chối vẫn áp dụng cho mọi hành động không vai trò nào cấp.
- Người quyết định: @hoanghainh1188 (chấp thuận khuyến nghị trong `/speckit-clarify`)

---
Nguồn ambiguity: [`spec.md`](../../specs/20260914-224646-organization-access/spec.md) (mục Clarifications) · [intake](../intake/005-organization-access.md)
