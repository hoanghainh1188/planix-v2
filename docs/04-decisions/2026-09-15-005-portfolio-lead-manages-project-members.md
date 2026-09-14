# Lãnh đạo danh mục được quản lý thành viên dự án; bổ sung 2 dòng ma trận quyền
- Ngày: 2026-09-15
- Feature liên quan: `005-organization-access` (issue #5)
- Câu hỏi gốc: `/speckit-analyze` phát hiện deadlock (C2) — `portfolioLead` tạo được dự án và trở thành thành viên duy
  nhất, nhưng chỉ `projectManager` là thành viên dự án mới có `project.member.manage` → dự án không thêm được ai.
  Đồng thời contract có 2 action chưa có trong decision ma trận quyền (I1).
- Quyết định:
  1. **Phương án A:** thêm `portfolioLead` vào `project.member.manage` (vẫn phải là thành viên dự án — FR-022).
     Quản lý RACI và chuyển Accountable (`project.raci.manage`) **vẫn chỉ** `projectManager`. Luồng chuẩn: Lãnh đạo
     danh mục tạo dự án → thêm PM → PM chuyển Accountable nếu cần.
  2. Bổ sung vào ma trận quyền giai đoạn 1 (sửa đổi `2026-09-14-005-phase1-permission-matrix`):
     - "Xem danh sách thành viên tổ chức" (`org.member.read`): tất cả 6 vai trò.
     - "Sửa trường tài chính nhạy cảm" (`sensitive.financial.write`): Lãnh đạo danh mục, PM, Tài chính.
- Phương án bị loại: B — bắt buộc chỉ định PM khi tạo dự án (thêm ràng buộc form, không giải được trường hợp PM rời
  dự án về sau).
- Người quyết định: @hoanghainh1188 (chọn phương án A sau `/speckit-analyze`)

---
Nguồn: báo cáo `/speckit-analyze` (C2, I1) · [`spec.md`](../../specs/20260914-224646-organization-access/spec.md) FR-013 ·
[decision ma trận quyền gốc](2026-09-14-005-phase1-permission-matrix.md)
