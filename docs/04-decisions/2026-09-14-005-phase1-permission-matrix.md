# Ma trận quyền vai trò hệ thống giai đoạn 1
- Ngày: 2026-09-14
- Feature liên quan: `005-organization-access` (issue #5)
- Câu hỏi gốc: Vai trò hệ thống nào được làm gì ở giai đoạn 1? (spec FR-013; intake Ambiguity #1)
- Quyết định: Dùng ma trận sau (✓ = vai trò cho phép; hành động cấp dự án còn phải là thành viên dự án — FR-022; ô trống = từ chối):

  | Hành động | Admin | Lãnh đạo danh mục | PM | Functional Manager | Thành viên | Tài chính |
  |---|---|---|---|---|---|---|
  | Mời thành viên, gán/gỡ vai trò, vô hiệu hoá/kích hoạt lại thành viên tổ chức | ✓ | | | | | |
  | Xem danh sách thành viên tổ chức | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
  | Tạo dự án | | ✓ | ✓ | | | |
  | Quản lý thành viên dự án (thêm/xoá) | | ✓ | ✓ | | | |
  | Quản lý RACI (gán R/C/I, chuyển Accountable) | | | ✓ | | | |
  | Xem dự án, thành viên dự án, RACI | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
  | Truy cập phân hệ TASK, WBS, SCH | | ✓ | ✓ | ✓ | ✓ | |
  | Truy cập phân hệ RES (lịch, kỹ năng) | | ✓ | ✓ | ✓ | | |
  | Xem trường tài chính nhạy cảm | | ✓ | ✓ | | | ✓ |
  | Sửa trường tài chính nhạy cảm | | ✓ | ✓ | | | ✓ |

  Hàng TASK/WBS/SCH/RES chỉ là quyền vào phân hệ; hành động chi tiết do feature tương ứng bổ sung. Admin không có ngoại lệ trên dữ liệu dự án (vẫn phải là thành viên dự án).
  > Sửa đổi 2026-09-15 bởi [`2026-09-15-005-portfolio-lead-manages-project-members`](2026-09-15-005-portfolio-lead-manages-project-members.md): tách dòng thành viên dự án / RACI, thêm `portfolioLead` quản lý thành viên dự án, thêm 2 dòng xem thành viên tổ chức và sửa trường nhạy cảm.
- Người quyết định: @hoanghainh1188 (chấp thuận đề xuất của Claude)

---
Nguồn ambiguity: [`spec.md`](../../specs/20260914-224646-organization-access/spec.md) (trả lời trong `/speckit-specify`) · [intake](../intake/005-organization-access.md)
