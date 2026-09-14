# Mục tiêu quy mô & hiệu năng v1
- Ngày: 2026-09-14
- Feature liên quan: toàn dự án (`_project` SRS v1)
- Câu hỏi gốc: **OI-14** — Chưa có con số cho "khối lượng lớn" và "thời gian thực".
- Quyết định: Mục tiêu v1: ~**200 người dùng đồng thời**, **500 dự án/tổ chức**, **10.000 task/dự án**. Tính lại CPM **≤ 2 giây** với 10.000 task; dashboard **p95 < 1 giây**; chỉ số EVM cập nhật **≤ 1 phút** sau khi duyệt timesheet. "Thời gian thực" = tính lại ngay khi có sự kiện (event-driven), không yêu cầu streaming mili-giây.
- Người quyết định: @hoanghainh1188 (chấp thuận đề xuất của Claude)

---
Nguồn ambiguity: [`srs-v1.md` §6 OI-14](../01-basic-design/_project/srs-v1.md)
