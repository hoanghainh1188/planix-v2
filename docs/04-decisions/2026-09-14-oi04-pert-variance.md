# Phương sai PERT = ((P − O)/6)²
- Ngày: 2026-09-14
- Feature liên quan: toàn dự án (`_project` SRS v1)
- Câu hỏi gốc: **OI-04** — A viết `V = (P − O)/6^2` (đọc nguyên văn = chia 36); B gọi `√Σ…` là "phương sai".
- Quyết định: `σ = (P − O)/6`, `V = σ² = ((P − O)/6)²`, `SD_project = √ΣV` trên các task thuộc Đường găng. Nếu có **nhiều Đường găng**, lấy đường có **tổng phương sai lớn nhất**. Gọi đúng tên: `√ΣV` là độ lệch chuẩn, không phải phương sai.
- Người quyết định: @hoanghainh1188 (chấp thuận đề xuất của Claude)

---
Nguồn ambiguity: [`srs-v1.md` §6 OI-04](../01-basic-design/_project/srs-v1.md)
