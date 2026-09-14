# Quy ước ngày CPM và phụ thuộc có lead/lag
- Ngày: 2026-09-14
- Feature liên quan: toàn dự án (`_project` SRS v1)
- Câu hỏi gốc: **OI-05** — Quy ước `EF = ES + D − 1` của A chưa định nghĩa cách áp FS/SS/FF/SF + lead/lag và loại ngày.
- Quyết định:
  - **Nội bộ tính theo mốc 0**: `EF = ES + D`; **hiển thị theo quy ước A** (bắt đầu ngày 1, `EF = ES + D − 1`, `LS = LF − D + 1`). Test phải kiểm công thức A ở tầng hiển thị.
  - Phụ thuộc (mốc 0, lag ≥ 0, **lead = lag âm**): FS `ES_s = EF_p + lag` · SS `ES_s = ES_p + lag` · FF `EF_s = EF_p + lag` · SF `EF_s = ES_p + lag`.
  - Đơn vị: **ngày làm việc theo lịch dự án**. Resource Calendar dùng cho leveling và gán việc; ở v1 không tham gia tính CPM gốc.
- Người quyết định: @hoanghainh1188 (chấp thuận đề xuất của Claude)

---
Nguồn ambiguity: [`srs-v1.md` §6 OI-05](../01-basic-design/_project/srs-v1.md)
