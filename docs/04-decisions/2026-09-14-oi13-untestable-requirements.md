# Tiêu chí kiểm thử cho Tuckman, 90% truyền thông, Smart Assignment
- Ngày: 2026-09-14
- Feature liên quan: toàn dự án (`_project` SRS v1)
- Câu hỏi gốc: **OI-13** — Tuckman theo dõi bằng gì; nhắc 90% thời gian truyền thông hoạt động ra sao; Smart Assignment dùng thuật toán gì?
- Quyết định:
  - **Tuckman:** PM **tự chọn** giai đoạn cho team kèm ngày + ghi chú; lưu thành timeline. Không tự phát hiện.
  - **90% truyền thông:** widget **thông tin, không chặn** — so tỷ lệ giờ timesheet loại "họp/báo cáo" với mốc 90%.
  - **Smart Assignment:** xếp hạng theo luật (đủ kỹ năng yêu cầu · còn trống lịch · phân bổ < 100%), **gợi ý top 3, PM xác nhận**, không tự gán.
- Người quyết định: @hoanghainh1188 (chấp thuận đề xuất của Claude)

---
Nguồn ambiguity: [`srs-v1.md` §6 OI-13](../01-basic-design/_project/srs-v1.md)
