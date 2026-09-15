# Một tài khoản được thuộc nhiều tổ chức
- Ngày: 2026-09-14
- Feature liên quan: `005-organization-access` (issue #5)
- Câu hỏi gốc: Một tài khoản có được là thành viên của nhiều tổ chức không? (spec FR-017)
- Quyết định: **Có.** Mỗi tài khoản có thể có nhiều thành viên tổ chức (organization membership), vai trò và trạng thái riêng ở từng tổ chức. Mỗi yêu cầu gắn với đúng **một tổ chức đang hoạt động**, chỉ chọn được tổ chức mà người dùng là thành viên đang hoạt động; cô lập dữ liệu áp dụng theo tổ chức đang hoạt động. Bị vô hiệu hoá ở tổ chức A không ảnh hưởng tổ chức B. Lý do: đổi từ "1 tổ chức" sang "nhiều tổ chức" về sau phải làm lại mô hình membership và mọi kiểm tra cô lập.
- Người quyết định: @hoanghainh1188 (chấp thuận đề xuất của Claude)

---
Nguồn ambiguity: [`spec.md`](../../specs/20260914-224646-organization-access/spec.md) (trả lời trong `/speckit-specify`) · [intake](../intake/005-organization-access.md)
