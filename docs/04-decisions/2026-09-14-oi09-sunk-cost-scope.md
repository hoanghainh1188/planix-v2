# Sunk Cost chỉ loại trong phân tích quyết định tương lai, không áp cho EVM
- Ngày: 2026-09-14
- Feature liên quan: toàn dự án (`_project` SRS v1)
- Câu hỏi gốc: **OI-09** — A §3 loại Sunk Cost khỏi "hàm tính hiệu quả dự án tương lai" — áp nguyên văn thì AC bị loại khỏi EVM.
- Quyết định: Chỉ loại Sunk Cost trong **phân tích ra quyết định hướng tương lai**: lựa chọn dự án (NPV/ROI/IRR/BCR/Payback) và quyết định **tiếp tục/dừng** dự án. **EVM (CV, CPI, EAC, TCPI…) dùng đầy đủ AC.** Toàn bộ lịch sử chi phí vẫn lưu; chi phí đã phát sinh tính tới **ngày ra quyết định** được coi là Sunk Cost cho phân tích đó.
- Người quyết định: @hoanghainh1188 (chấp thuận đề xuất của Claude)

---
Nguồn ambiguity: [`srs-v1.md` §6 OI-09](../01-basic-design/_project/srs-v1.md)
