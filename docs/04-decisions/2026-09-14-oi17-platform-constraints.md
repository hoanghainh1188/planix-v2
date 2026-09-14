# Nền tảng: web, đa tổ chức, VI/EN, UTC
- Ngày: 2026-09-14
- Feature liên quan: toàn dự án (`_project` SRS v1)
- Câu hỏi gốc: **OI-17** — Nguồn chưa nêu đối tượng khách hàng, nền tảng, ngôn ngữ, múi giờ, xác thực.
- Quyết định:
  - **Web app responsive** trước.
  - **Thiết kế đa tổ chức (tenant) từ đầu** — mọi dữ liệu nghiệp vụ gắn tổ chức; kể cả khi mới có 1 khách.
  - Giao diện **Tiếng Việt + English** (i18n từ đầu).
  - **Lưu UTC, hiển thị theo múi giờ người dùng.**
  - Xác thực email/mật khẩu; SSO để giai đoạn sau.
- Người quyết định: @hoanghainh1188 (chấp thuận đề xuất của Claude)

---
Nguồn ambiguity: [`srs-v1.md` §6 OI-17](../01-basic-design/_project/srs-v1.md)
