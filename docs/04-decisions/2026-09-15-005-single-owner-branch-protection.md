# Branch protection của `main` khi dự án chỉ có một Code Owner
- Ngày: 2026-09-15
- Feature liên quan: `005-organization-access` (issue #5) — áp dụng cho toàn repo; ghi lại hành động đã làm ở T128 (khi merge PR #6)
- Câu hỏi gốc: constitution (mục quy trình phát triển & quality gates) yêu cầu *"Mọi thay đổi vào `main` PHẢI qua Pull
  Request + Code Owner review + CI xanh"*. Repo hiện chỉ có **một** Code Owner (@hoanghainh1188), cũng là người mở mọi
  PR; GitHub không cho tác giả tự duyệt PR của mình → không PR nào merge được khi bật "Require review from Code Owners"
  và approvals ≥ 1. Ngày 2026-09-15, lúc merge PR #6, branch protection đã được đổi (phương án A, @hoanghainh1188 chấp
  thuận) nhưng chỉ ghi trong `tasks.md` T128 — code review Phase 11 phát hiện thiếu decision record.
- Quyết định: **ngoại lệ tạm thời cho yêu cầu Code Owner review** trên `main`.
  - Branch protection của `main`: required approvals = **0**, **tắt** "Require review from Code Owners".
  - **Giữ nguyên:** bắt buộc qua Pull Request (không push thẳng `main`); required status check **`quality-gate`** phải
    xanh; `CODEOWNERS` vẫn giữ để tự gắn reviewer.
  - Thay cho review của người thứ hai: mỗi PR phải có bằng chứng review của pipeline `/design-to-code`
    (code-reviewer, glossary-steward, security-reviewer, test gate) ghi trong mô tả PR.
  - **Phạm vi / hết hiệu lực:** chỉ áp dụng khi dự án có đúng một Code Owner. Khi có Code Owner thứ hai → bật lại
    "Require review from Code Owners" và approvals = 1, rồi đánh dấu decision này là đã thay thế.
  - Constitution không bị sửa ở đây; nếu muốn đưa ngoại lệ này vào chính constitution thì làm **PR riêng** theo quy
    định gác cổng file dùng chung (`CLAUDE.md` rule 5).
- Phương án bị loại: giữ Code Owner review bắt buộc (không merge được PR nào); dùng tài khoản thứ hai chỉ để bấm
  approve (review hình thức, không có giá trị kiểm soát).
- Người quyết định: @hoanghainh1188

---
Nguồn: `.specify/memory/constitution.md` (Quy trình phát triển & quality gates) ·
[`tasks.md`](../../specs/20260914-224646-organization-access/tasks.md) T128 · `CLAUDE.md` rule 5
