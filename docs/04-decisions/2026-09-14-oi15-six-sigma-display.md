# Không hiển thị 6σ trong v1
- Ngày: 2026-09-14
- Feature liên quan: toàn dự án (`_project` SRS v1)
- Câu hỏi gốc: **OI-15** — A §4.2 ghi 6σ = 99.99% (không đúng với phân phối chuẩn).
- Quyết định: **Bỏ 6σ** khỏi control chart v1 (B chỉ cần tới 3σ). Nếu sau này hiển thị: dùng **99.99966%** (3.4 DPMO, chuẩn Six Sigma có dịch 1.5σ) và chú thích rõ.
- Người quyết định: @hoanghainh1188 (chấp thuận đề xuất của Claude)

---
Nguồn ambiguity: [`srs-v1.md` §6 OI-15](../01-basic-design/_project/srs-v1.md)
