# Tiền tệ: decimal cố định, làm tròn half-up khi hiển thị, 1 loại tiền/tổ chức
- Ngày: 2026-09-14
- Feature liên quan: toàn dự án (`_project` SRS v1)
- Câu hỏi gốc: **OI-16** — Chưa có đơn vị tiền tệ, đa tiền tệ, quy tắc làm tròn.
- Quyết định: Tiền và chỉ số lưu/tính bằng **decimal cố định — cấm float**. Tính trung gian **≥ 4 chữ số thập phân** (NFR-02), **chỉ làm tròn khi hiển thị**, kiểu **half-up**. v1: **một loại tiền cho mỗi tổ chức**; đa tiền tệ để sau.
- Người quyết định: @hoanghainh1188 (chấp thuận đề xuất của Claude)

---
Nguồn ambiguity: [`srs-v1.md` §6 OI-16](../01-basic-design/_project/srs-v1.md)
