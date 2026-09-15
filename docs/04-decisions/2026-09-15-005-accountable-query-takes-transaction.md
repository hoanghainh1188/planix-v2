# Tra cứu Accountable nhận transaction của người gọi
- Ngày: 2026-09-15
- Feature liên quan: `005-organization-access` (issue #5) — giao diện dùng chung cho Change Control (OI-07)
- Câu hỏi gốc: `contracts/authorization.md` §4 định nghĩa `getAccountable(tenant, projectId)` /
  `isAccountable(tenant, projectId, userId)` chỉ nhận `TenantContext`, nên hàm phải tự mở transaction (connection)
  riêng. Người gọi dự kiến (Change Control) gọi trong một HTTP request đang giữ transaction của request → giữ 2
  connection cùng lúc (đã gây **pool deadlock** — security review Phase 6–7, bài học 2026-09-15) và không thấy thay đổi
  chưa commit của chính request. Phát hiện khi bắt đầu `/speckit-implement` Phase 8 (T107/T110).
- Quyết định: **Phương án A — hàm nhận transaction của người gọi.**

  ```text
  getAccountable(tx: Tx, tenant: TenantContext, projectId) -> { projectMemberId, userId }
  isAccountable(tx: Tx, tenant: TenantContext, projectId, userId) -> boolean
  ```

  - `tx` là transaction đang dùng (trong request: transaction dùng chung của request) — không mở connection mới,
    thấy thay đổi chưa commit trong cùng transaction.
  - `tenant` vẫn bắt buộc: truy vấn lọc tường minh theo tổ chức (lớp 2 bên cạnh RLS); dự án không tồn tại hoặc thuộc
    tổ chức khác → `RESOURCE_NOT_FOUND`.
  - Ngữ nghĩa giữ nguyên: luôn đúng một kết quả cho dự án tồn tại (decision single-accountable-per-project).
- Phương án bị loại: B — giữ chữ ký cũ và thêm biến thể `…InTransaction(tx, …)` (hai cách làm cùng một việc, feature
  sau dễ chọn nhầm bản mở connection); C — giữ chữ ký, tìm transaction ngầm qua AsyncLocalStorage (hành vi ẩn, khó
  test, dễ dùng sai ngoài request).
- Người quyết định: @hoanghainh1188 (chọn phương án A)

---
Nguồn: [`contracts/authorization.md`](../../specs/20260914-224646-organization-access/contracts/authorization.md) §4 ·
[`tasks.md`](../../specs/20260914-224646-organization-access/tasks.md) T107, T110 · [`docs/05-lessons.md`](../05-lessons.md) (pool deadlock)
