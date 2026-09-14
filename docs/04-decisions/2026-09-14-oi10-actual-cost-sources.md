# AC = nhân công (timesheet) + ngoài nhân công (ERP), cộng theo loại
- Ngày: 2026-09-14
- Feature liên quan: toàn dự án (`_project` SRS v1)
- Câu hỏi gốc: **OI-10** — AC lấy từ timesheet × billing rate (B §2) hay ERP cập nhật tự động (B §9)?
- Quyết định: **Cộng 2 nguồn theo loại chi phí, không ghi đè**: AC nhân công = timesheet đã duyệt × billing rate; AC ngoài nhân công (vật tư, hoá đơn nhà thầu…) từ ERP. v1: đồng bộ **một chiều ERP → Planix** qua import CSV / API chung; kết nối ERP cụ thể để giai đoạn sau.
- Người quyết định: @hoanghainh1188 (chấp thuận đề xuất của Claude)

---
Nguồn ambiguity: [`srs-v1.md` §6 OI-10](../01-basic-design/_project/srs-v1.md)
