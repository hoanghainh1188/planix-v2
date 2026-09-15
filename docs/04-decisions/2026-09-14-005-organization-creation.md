# Chỉ Platform Operator được tạo tổ chức
- Ngày: 2026-09-14
- Feature liên quan: `005-organization-access` (issue #5)
- Câu hỏi gốc: Ai được khởi tạo tổ chức — (a) bất kỳ ai tự đăng ký, (b) chỉ người vận hành nền tảng, (c) tự đăng ký nhưng cần duyệt? (spec FR-004)
- Quyết định: **(b)** Chỉ **Platform Operator** tạo tổ chức và mời Admin đầu tiên theo email. Platform Operator là vai trò cấp nền tảng, không thuộc tổ chức nào, **không đọc dữ liệu nghiệp vụ** trong tổ chức; chỉ quản lý vòng đời tổ chức và lời mời Admin. Hệ quả: **không có tự đăng ký tự do** — tài khoản chỉ được tạo khi chấp nhận lời mời. Lý do: dữ liệu tài chính nhạy cảm, bán B2B, v1 không cần cơ chế chống spam tổ chức.
- Người quyết định: @hoanghainh1188 (chấp thuận đề xuất của Claude)

---
Nguồn ambiguity: [`spec.md`](../../specs/20260914-224646-organization-access/spec.md) (trả lời trong `/speckit-specify`) · [intake](../intake/005-organization-access.md)
