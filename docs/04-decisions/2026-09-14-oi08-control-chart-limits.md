# Control chart: sigma cố định, UCL/LCL tự tính ±3σ, USL/LSL cấu hình
- Ngày: 2026-09-14
- Feature liên quan: toàn dự án (`_project` SRS v1)
- Câu hỏi gốc: **OI-08** — B cài cứng mức sigma và cho cấu hình UCL/LCL; A đặt mặc định ±3σ.
- Quyết định: Tỷ lệ 1σ/2σ/3σ là **hằng số**. **UCL/LCL tự tính = mean ± 3σ** từ dữ liệu, **không sửa tay**. **USL/LSL do người dùng cấu hình** (yêu cầu khách hàng). Giới hạn kiểm soát phản ánh năng lực quy trình, không phải mong muốn.
- Người quyết định: @hoanghainh1188 (chấp thuận đề xuất của Claude)

---
Nguồn ambiguity: [`srs-v1.md` §6 OI-08](../01-basic-design/_project/srs-v1.md)
