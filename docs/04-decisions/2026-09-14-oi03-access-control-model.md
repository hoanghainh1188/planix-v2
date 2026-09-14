# Phân quyền 2 lớp: RBAC tổ chức + RACI dự án
- Ngày: 2026-09-14
- Feature liên quan: toàn dự án (`_project` SRS v1)
- Câu hỏi gốc: **OI-03** — B dùng RBAC, A dùng RACI + vai trò trong Project Charter — lớp nào quyết định quyền?
- Quyết định: Hai lớp kết hợp:
  - **RBAC cấp tổ chức** quyết định được truy cập phân hệ nào (VD: Admin, Lãnh đạo danh mục, PM, Functional Manager, Thành viên, Tài chính).
  - **RACI cấp dự án** quyết định được phê duyệt gì trong dự án đó.
  - Quyền thực tế = RBAC **VÀ** là thành viên dự án / có vai trò RACI tương ứng. **Mặc định từ chối.**
  - **Billing rate và ngân sách bảo vệ ở mức field**: không có quyền Tài chính/PM thì API không trả về field đó (không chỉ ẩn trên UI).
- Người quyết định: @hoanghainh1188 (chấp thuận đề xuất của Claude)

---
Nguồn ambiguity: [`srs-v1.md` §6 OI-03](../01-basic-design/_project/srs-v1.md)
