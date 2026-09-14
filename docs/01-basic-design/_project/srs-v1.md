# SRS hợp nhất — Planix V2 (Smart PM Suite) · v1

> **Loại tài liệu:** bản hợp nhất (derived) từ 2 nguồn gốc, lập ngày 2026-09-14. Tài liệu này KHÔNG thay
> thế nguồn gốc — khi có mâu thuẫn giữa bản này và nguồn, **nguồn gốc thắng** và phải sửa bản này.
>
> | Mã | Nguồn gốc (không sửa) |
> |---|---|
> | **A** | [`sources/srs-source-a-v1.md`](sources/srs-source-a-v1.md) — "Đặc tả Yêu cầu Phần mềm (SRS)", 11 phân hệ + phụ lục công thức |
> | **B** | [`sources/srs-source-b-v1.md`](sources/srs-source-b-v1.md) — "Tài liệu Đặc tả Yêu cầu Phần mềm (SRS)", 9 mục + "So What?" |
>
> **Quy ước:**
> - Mỗi yêu cầu có mã `FR-<PHÂN HỆ>-NN` / `NFR-NN` và cột **Nguồn** (`A §2.1`, `B §4`, `A+B` = cả hai).
> - Từ khoá **PHẢI** = bắt buộc (MUST). Nguyên văn nguồn dùng "PHẢI"/"phải" đều quy về PHẢI.
> - Chỗ 2 nguồn **mâu thuẫn / mơ hồ / thiếu** KHÔNG được tự chọn → ghi ở [§6 Vấn đề mở](#6-vấn-đề-mở-open-issues)
>   với mã `OI-NN`, xử lý qua `/speckit-clarify` và lưu quyết định vào `docs/04-decisions/`.
> - Công thức viết dạng code để tránh lỗi render; bảng tra đầy đủ ở [§5](#5-phụ-lục-bảng-công-thức-chuẩn-hoá).

---

## 1. Giới thiệu

### 1.1. Tầm nhìn & bài toán (B §1, A §1.1)
Planix V2 (tên trong nguồn: **Smart PM Suite** — xem OI-01) là một hệ thống quản trị dự án hợp nhất
**tầng tác nghiệp** (công việc, thời gian, nguồn lực hằng ngày) và **tầng quản trị chiến lược** (EVM,
rủi ro, danh mục). Bài toán cốt lõi: **sai lệch dữ liệu giữa báo cáo tiến độ và thực trạng tài chính**.

Hệ thống chuyển tương tác hằng ngày của đội ngũ thành **chỉ số sức khoẻ dự án theo thời gian thực**,
dựa trên thuật toán chuẩn PMBOK (EVM, CPM, PERT), để PM và lãnh đạo ra quyết định dựa trên dữ liệu định
lượng, phân tích nguyên nhân gốc rễ thay vì xử lý triệu chứng.

### 1.2. Phạm vi (A §1.2, B toàn văn)
13 phân hệ chức năng (hợp nhất 11 phân hệ của A và 8 mục chức năng của B) + yêu cầu phi chức năng +
tích hợp. Kiểm soát **Triple Constraint**: Phạm vi · Thời gian · Chi phí.

### 1.3. Cam kết tuân thủ (A §1.3, B §1)
- Quy tắc quản trị PMBOK Guide là **logic nền tảng**; nguồn A nêu phiên bản 4 và 6 (xem OI-02).
- Mọi tính toán và quy trình thay đổi PHẢI dựa trên dữ liệu thực tế và kịch bản giả định; loại bỏ yếu
  tố cảm tính.
- Hệ thống **cưỡng ép quy trình PMP vào tính năng** (B kết luận) — tức là quy trình là ràng buộc cứng
  của phần mềm, không phải khuyến nghị.

### 1.4. Vai trò được nhắc tới trong nguồn
Chỉ liệt kê vai trò **có trong nguồn** (chưa phải mô hình phân quyền cuối cùng — xem OI-03):

| Vai trò | Nguồn | Hành động được nhắc tới |
|---|---|---|
| Project Manager (PM) | A+B | Bật Work Authorization, chọn kịch bản EAC, nhập bottom-up ETC, đàm phán nguồn lực |
| Functional Manager (Quản lý chức năng) | B §2, §3 | Bật Work Authorization, thống nhất ưu tiên lập lịch với PM |
| Change Control Board (CCB) | A §2.8, B §7 | Phê duyệt Change Request trước khi cập nhật Baseline |
| RACI — Accountable | A §2.7 | Phê duyệt thay đổi Baseline |
| Junior Engineer / thành viên nhóm | B §5 | Nhập bottom-up ETC; ghi timesheet (suy ra từ B §2) |
| Lãnh đạo / quản lý danh mục | B §1, §8 | Xem dashboard lãnh đạo, lựa chọn dự án |

---

## 2. Yêu cầu chức năng

### 2.1. TASK — Quản trị tác nghiệp
Vai trò: "điểm chạm" dữ liệu đầu vào; độ kỷ luật tại đây quyết định độ tin cậy của mọi báo cáo phía sau.

| Mã | Yêu cầu | Nguồn |
|---|---|---|
| FR-TASK-01 | Hỗ trợ Checklist và Sub-task **đa cấp**. | B §2 |
| FR-TASK-02 | **Work Authorization:** task KHÔNG được chuyển sang "In Progress" hoặc ghi nhận tiến độ khi chưa có cờ Work Authorization do **PM hoặc Functional Manager** bật. | B §2 |
| FR-TASK-03 | Hỗ trợ đủ 4 loại phụ thuộc: **FS**, **SS**, **FF**, **SF**. | B §2 |
| FR-TASK-04 | Cấu hình **Lead** (gối đầu) và **Lag** (thời gian chờ) trên từng liên kết phụ thuộc. | B §2 |
| FR-TASK-05 | **Timesheet hằng ngày** PHẢI được phê duyệt mới trở thành dữ liệu thô tính chi phí. | B §2 |

> **So What? (B §2):** timesheet đã duyệt × đơn giá (FR-RES-03) cấu thành **Actual Cost (AC)** → đối chiếu
> với EV để ra CV, phát hiện "chảy máu" ngân sách ngay từ tầng tác nghiệp.

### 2.2. RES — Nguồn lực & năng lực

| Mã | Yêu cầu | Nguồn |
|---|---|---|
| FR-RES-01 | **Resource Calendar:** lịch làm việc, ca kíp, ngày lễ/nghỉ phép riêng cho từng tài nguyên. | B §3 |
| FR-RES-02 | **Skills Matrix & Smart Assignment:** ma trận kỹ năng; gợi ý gán việc theo trình độ chuyên môn. | B §3 |
| FR-RES-03 | **Billing Rate** theo giờ/ngày cho từng tài nguyên, dùng tính ngân sách và AC. | B §3 |
| FR-RES-04 | **Ma trận RACI** cho công việc/dự án; phân quyền dựa trên RACI. | A §2.7 |
| FR-RES-05 | Tự động phát hiện và cảnh báo **Over-allocation** qua **Resource Histogram**. | A §2.7, B §3 |
| FR-RES-06 | Khi áp dụng **Resource Leveling**, PHẢI tự động tính lại Đường găng và Total Float. | A §2.1 |
| FR-RES-07 | Hỗ trợ PM và Functional Manager thiết lập **ưu tiên lập lịch** giữa các dự án, để dự án ưu tiên cao có đủ nguồn lực. | B §3 |

### 2.3. WBS — Phạm vi & WBS

| Mã | Yêu cầu | Nguồn |
|---|---|---|
| FR-WBS-01 | **WBS Dictionary** gồm: mô tả chi tiết công việc, tiêu chuẩn nghiệm thu, người chịu trách nhiệm. | A §2.6, B §4 |
| FR-WBS-02 | Cưỡng chế mục WBS Dictionary bắt buộc — phạm vi áp dụng (mọi phần tử hay chỉ Work Package) xem **OI-06**. | A §2.6, B §4 |
| FR-WBS-03 | **AC và EV** PHẢI roll-up từ Work Package (nút lá) lên **Control Account**. | B §4 |
| FR-WBS-04 | **Validate Scope:** chấp nhận chính thức PHẢI qua hoạt động **Inspection** xác nhận Verified Deliverables. | A §2.6 |

### 2.4. SCH — Lập lịch PERT/CPM & mô phỏng mạng lưới
"Trái tim" tính toán để lập **Baseline** tiến độ; tính theo thời gian thực.

| Mã | Yêu cầu | Nguồn |
|---|---|---|
| FR-SCH-01 | **PERT:** `E = (P + 4M + O) / 6` (P = bi quan, M = khả dĩ nhất, O = lạc quan). | A §2.1, B §4 |
| FR-SCH-02 | Độ lệch chuẩn task `σ = (P − O) / 6`; phương sai task — cách viết công thức xem **OI-04**. | A §2.1 |
| FR-SCH-03 | **CPM:** tự động forward pass / backward pass tính ES, EF, LS, LF với `EF = ES + Duration − 1`, `LS = LF − Duration + 1` (quy ước ngày — xem **OI-05**). | A §2.1, B §4 |
| FR-SCH-04 | `Total Float = LS − ES`; **Đường găng** = chuỗi task có Total Float = 0. | A §2.1, B §4 |
| FR-SCH-05 | Task có Float = 0 PHẢI được **ưu tiên hiển thị**. | B §4 |
| FR-SCH-06 | Độ lệch chuẩn tiến độ cấp dự án: `SD_project = √Σ((P − O) / 6)²` trên các task thuộc Đường găng. | B §4 |
| FR-SCH-07 | Báo cáo **khoảng tin cậy** theo sigma: `E ± 1σ` (68.26%), `E ± 2σ` (95.46%), `E ± 3σ` (99.73%). Ví dụ: E = 29 ngày, σ = 3 → 2σ = 23–35 ngày. | A §2.1 |
| FR-SCH-08 | **Path Convergence:** tự động cảnh báo **rủi ro cao** tại nút có nhiều task tiền nhiệm hội tụ (ngưỡng — xem **OI-11**). | B §4 |

### 2.5. EVM — Earned Value Management & dashboard
EVM là **ngôn ngữ chung** đánh giá sức khoẻ dự án.

| Mã | Yêu cầu | Nguồn |
|---|---|---|
| FR-EVM-01 | Tự động tính `CV = EV − AC`, `SV = EV − PV` (dương = tốt). | A §2.2, B §5 |
| FR-EVM-02 | Tự động tính `CPI = EV / AC`, `SPI = EV / PV` (< 1 = vượt ngân sách / trễ hạn). | A §2.2, B §5 |
| FR-EVM-03 | **TCPI** 2 biến thể: theo BAC `(BAC − EV) / (BAC − AC)`; theo EAC `(BAC − EV) / (EAC − AC)`. | A §2.2, B §5 |
| FR-EVM-04 | **EAC** — PM chọn kịch bản qua logic gate / dropdown; hỗ trợ đủ 4 kịch bản ở bảng dưới. | A §2.2, B §5 |
| FR-EVM-05 | Kịch bản **Flawed** có **workflow** cho PM và Junior Engineer nhập lại dự toán bottom-up (ETC). | B §5 |
| FR-EVM-06 | Phép tính ngược **PV từ EV và SPI**: `PV = EV / SPI`. | A §4.1 |
| FR-EVM-07 | Phân hệ mang tên "EVM & **Earned Schedule**" nhưng nguồn chưa đặc tả chỉ số Earned Schedule — xem **OI-12**. | A §2.2 |

| Kịch bản EAC | Khi nào | Công thức | Nguồn |
|---|---|---|---|
| Typical | Biến động hiện tại **sẽ tiếp tục** | `EAC = BAC / CPI` | A+B |
| Atypical | Biến động **không lặp lại** | `EAC = AC + BAC − EV` | A+B |
| Flawed | Ước tính ban đầu **sai** | `EAC = AC + Bottom-up ETC` | A+B |
| Deadline / Over budget | Vượt ngân sách **và** bị ép tiến độ | `EAC = AC + (BAC − EV) / (CPI × SPI)` | A |

> **So What? (B §5):** CPI < 1 → dự án tiêu tiền nhanh hơn giá trị tạo ra. TCPI > 1 → đội ngũ phải làm
> hiệu quả hơn bình thường để về đích đúng mục tiêu tài chính.

### 2.6. RISK — Quản lý rủi ro

| Mã | Yêu cầu | Nguồn |
|---|---|---|
| FR-RISK-01 | **Risk Registry** (sổ đăng ký rủi ro). | B §6 |
| FR-RISK-02 | `EMV = Xác suất × Tác động`. | A §2.3, B §6 |
| FR-RISK-03 | **Decision Tree:** dựng cây quyết định so sánh phương án đầu tư, tự tổng hợp EMV từng nhánh và **đề xuất** phương án có giá trị kinh tế cao nhất. | A §2.3 |

### 2.7. QC — Quản lý chất lượng

| Mã | Yêu cầu | Nguồn |
|---|---|---|
| FR-QC-01 | **Control Chart** với các vùng sigma **cố định**: 1σ (68.26%), 2σ (95.46%), 3σ (99.73%). | B §6 |
| FR-QC-02 | Giới hạn kiểm soát mặc định **±3σ** quanh giá trị trung bình (quan hệ với FR-QC-03 — xem **OI-08**). | A §2.10 |
| FR-QC-03 | **Process Capability:** cấu hình song song **UCL/LCL** (giới hạn kiểm soát — năng lực nội bộ) và **USL/LSL** (giới hạn đặc tả — yêu cầu khách hàng). | B §6 |
| FR-QC-04 | **Pareto:** ưu tiên xử lý 20% nguyên nhân gây ra 80% lỗi. | A §2.10 |
| FR-QC-05 | Trực quan hoá và **cảnh báo** khi quy trình "độ chụm cao nhưng độ chuẩn thấp" (Highly Precise but Low Accuracy) — sai lệch một cách nhất quán. | A §2.10 |

> **Triết lý (B §6):** Prevention over Inspection — phòng ngừa hơn kiểm tra.

### 2.8. CHG — Kiểm soát thay đổi tích hợp

| Mã | Yêu cầu | Nguồn |
|---|---|---|
| FR-CHG-01 | Luồng: **Tiếp nhận CR → Phân tích tác động Triple Constraint → CCB phê duyệt → Cập nhật Baseline & versioning**. | A §2.8, B §7 |
| FR-CHG-02 | Baseline mới CHỈ được cập nhật sau phê duyệt (thẩm quyền CCB vs RACI Accountable — xem **OI-07**). | A §2.7, §2.8, B §7 |
| FR-CHG-03 | **Chống Scope Creep:** chặn mọi thay đổi chưa qua phê duyệt chính thức. | A §2.8 |
| FR-CHG-04 | Baseline có **versioning** (giữ lịch sử các phiên bản). | A §2.8 |

### 2.9. PROC — Mua sắm (hợp đồng FPIF)

| Mã | Yêu cầu | Nguồn |
|---|---|---|
| FR-PROC-01 | **PTA Tracker:** `PTA = (Ceiling Price − Target Price) / Buyer's Share Ratio + Target Cost`. | A §2.9, B §7 |
| FR-PROC-02 | UI PHẢI **phân biệt rõ** Share Ratio của Buyer và Seller. | B §7 |
| FR-PROC-03 | Nếu người dùng nhập **Seller's Share** (VD 30%), hệ thống PHẢI tự chuyển thành **Buyer's Share** (70%) trước khi tính PTA. | A §2.9 |
| FR-PROC-04 | Phép tính ngược Target Cost: `Target Cost = PTA − (Ceiling Price − Target Price) / Buyer's Share Ratio`. | A §4.1 |

> **So What? (B §7):** PTA báo thời điểm nhà thầu bắt đầu chịu toàn bộ chi phí vượt mức.

### 2.10. PORT — Danh mục, tài chính & dashboard lãnh đạo

| Mã | Yêu cầu | Nguồn |
|---|---|---|
| FR-PORT-01 | Chỉ số tài chính: **NPV, IRR, BCR, Payback Period**. | A §2.11, B §8 |
| FR-PORT-02 | Tiêu chí lựa chọn: NPV cao nhất, IRR cao nhất, Payback ngắn nhất, **BCR > 1**. | A §2.11 |
| FR-PORT-03 | Present Value: `PV = FV / (1 + r)^n`. | A §4.1 |
| FR-PORT-04 | **Loại trừ Sunk Cost** khỏi mọi thuật toán lựa chọn dự án (ROI, NPV) và quyết định **tiếp tục/dừng** dự án; chỉ dùng chi phí và lợi ích **tương lai** (phạm vi — xem **OI-09**). | A §2.2, §3, B §8 |
| FR-PORT-05 | **Opportunity Cost:** so sánh dự án được chọn với dự án có NPV cao nhất **không** được chọn. | B §8 |
| FR-PORT-06 | Khấu hao 3 phương pháp: **Straight-Line**, **Double Declining Balance**, **Sum-of-the-Years' Digits** (`Depreciable Cost × Remaining Life / Sum of Digits`). | A §2.11, §4.1 |
| FR-PORT-07 | **Dashboard lãnh đạo** cấp danh mục. | B §8 |

### 2.11. AGL — Agile Scrum/Kanban Hub

| Mã | Yêu cầu | Nguồn |
|---|---|---|
| FR-AGL-01 | Bảng **Kanban** theo dõi Work in Progress (WIP). | A §2.4 |
| FR-AGL-02 | Theo dõi vòng đời team theo **Tuckman**: Forming → Storming → Norming → Performing; PM đóng vai trò facilitator (cách đo — xem **OI-13**). | A §2.4 |

### 2.12. COM — Báo cáo & kênh truyền thông

| Mã | Yêu cầu | Nguồn |
|---|---|---|
| FR-COM-01 | Số kênh truyền thông: `n(n − 1) / 2`. | A §2.5 |
| FR-COM-02 | Khi quy mô team đổi, báo cáo **Δ số kênh**. VD 11 → 12 người: cảnh báo **+11 kênh** (55 → 66). | A §2.5 |
| FR-COM-03 | Dashboard mặc định nhắc PM dành **90% thời gian cho truyền thông** (tiêu chí kiểm thử — xem **OI-13**). | A §2.5 |

### 2.13. INT — Tích hợp

| Mã | Yêu cầu | Nguồn |
|---|---|---|
| FR-INT-01 | API kết nối hệ thống **kế toán/ERP** để cập nhật **Actual Cost** tự động (quan hệ với AC từ timesheet — xem **OI-10**). | B §9 |

---

## 3. Yêu cầu phi chức năng

| Mã | Yêu cầu | Nguồn |
|---|---|---|
| NFR-01 | **Phân quyền nghiêm ngặt**; đặc biệt bảo vệ dữ liệu nhạy cảm: **đơn giá tài nguyên** và **ngân sách dự án**. Mô hình phân quyền (RBAC / RACI / Project Charter) — xem **OI-03**. | A §3, B §9 |
| NFR-02 | **Độ chính xác số học:** tối thiểu **4 chữ số thập phân** trước khi làm tròn. | A §3 |
| NFR-03 | **Toàn vẹn tính toán:** các phép toán phức tạp KHÔNG sai lệch khi xử lý khối lượng tác vụ lớn (quy mô — xem **OI-14**). | B §9 |
| NFR-04 | **Lưu trữ toàn bộ lịch sử chi phí**; nhưng Sunk Cost không tham gia hàm tính hiệu quả tương lai (xem FR-PORT-04, **OI-09**). | A §3 |
| NFR-05 | **Tính toán thời gian thực** cho mạng lưới công việc và chỉ số sức khoẻ dự án. | A §2.1, B §1 |

---

## 4. Truy vết nguồn → yêu cầu

| Mục nguồn | Yêu cầu hợp nhất |
|---|---|
| A §1 | §1.1, §1.2, §1.3 |
| A §2.1 PERT/CPM | FR-SCH-01..04, 07 · FR-RES-06 |
| A §2.2 EVM | FR-EVM-01..04, 07 · FR-PORT-04 |
| A §2.3 Rủi ro | FR-RISK-02, 03 |
| A §2.4 Agile | FR-AGL-01, 02 |
| A §2.5 Truyền thông | FR-COM-01..03 |
| A §2.6 WBS | FR-WBS-01, 02, 04 |
| A §2.7 Nguồn lực | FR-RES-04, 05 · FR-CHG-02 |
| A §2.8 Thay đổi | FR-CHG-01..04 |
| A §2.9 Mua sắm | FR-PROC-01, 03 |
| A §2.10 Chất lượng | FR-QC-02, 04, 05 |
| A §2.11 Danh mục | FR-PORT-01, 02, 06 |
| A §3 NFR | NFR-01, 02, 04 · FR-PORT-04 |
| A §4 Phụ lục | §5 · FR-EVM-06 · FR-PROC-04 · FR-PORT-03, 06 |
| B §1 | §1.1, §1.3 · NFR-05 |
| B §2 Tác nghiệp | FR-TASK-01..05 |
| B §3 Nguồn lực | FR-RES-01..03, 05, 07 |
| B §4 WBS/PERT/CPM | FR-WBS-01..03 · FR-SCH-01, 03..06, 08 |
| B §5 EVM | FR-EVM-01..05 |
| B §6 Rủi ro & QC | FR-RISK-01, 02 · FR-QC-01, 03 |
| B §7 Thay đổi & Mua sắm | FR-CHG-01, 02 · FR-PROC-01, 02 |
| B §8 Danh mục | FR-PORT-01, 04, 05, 07 |
| B §9 NFR & tích hợp | NFR-01, 03 · FR-INT-01 |

---

## 5. Phụ lục: bảng công thức chuẩn hoá

Ký hiệu: P = pessimistic, M = most likely, O = optimistic; PV (EVM) = Planned Value, PV (tài chính) =
Present Value — **hai khái niệm khác nhau, cần tách tên trong code/glossary**.

| Lĩnh vực | Tên | Công thức | Mã |
|---|---|---|---|
| Tiến độ | PERT Expected Duration | `E = (P + 4M + O) / 6` | FR-SCH-01 |
| Tiến độ | Standard Deviation (task) | `σ = (P − O) / 6` | FR-SCH-02 |
| Tiến độ | Variance (task) | `V = σ²` — *đang chờ OI-04* | FR-SCH-02 |
| Tiến độ | Early Finish / Late Start | `EF = ES + D − 1` · `LS = LF − D + 1` | FR-SCH-03 |
| Tiến độ | Total Float | `LS − ES` | FR-SCH-04 |
| Tiến độ | SD dự án (Đường găng) | `√Σ σᵢ²` | FR-SCH-06 |
| EVM | CV / SV | `EV − AC` · `EV − PV` | FR-EVM-01 |
| EVM | CPI / SPI | `EV / AC` · `EV / PV` | FR-EVM-02 |
| EVM | TCPI (BAC) / TCPI (EAC) | `(BAC − EV)/(BAC − AC)` · `(BAC − EV)/(EAC − AC)` | FR-EVM-03 |
| EVM | EAC Typical / Atypical | `BAC / CPI` · `AC + BAC − EV` | FR-EVM-04 |
| EVM | EAC Flawed / Deadline | `AC + Bottom-up ETC` · `AC + (BAC − EV)/(CPI × SPI)` | FR-EVM-04 |
| EVM | Inverted PV | `PV = EV / SPI` | FR-EVM-06 |
| Rủi ro | EMV | `Xác suất × Tác động` | FR-RISK-02 |
| Mua sắm | PTA | `(Ceiling − Target Price) / Buyer's Share + Target Cost` | FR-PROC-01 |
| Mua sắm | Inverted Target Cost | `PTA − (Ceiling − Target Price) / Buyer's Share` | FR-PROC-04 |
| Tài chính | Present Value | `FV / (1 + r)^n` | FR-PORT-03 |
| Tài chính | Sum-of-the-Years' Digits | `Depreciable Cost × Remaining Life / Sum of Digits` | FR-PORT-06 |
| Truyền thông | Communication Channels | `n(n − 1) / 2` | FR-COM-01 |

**Bảng sigma (phân phối chuẩn, A §4.2, B §6):** 1σ = 68.26% · 2σ = 95.46% · 3σ = 99.73% ·
6σ = *xem OI-15*.

---

## 6. Vấn đề mở (Open Issues)

Mỗi mục được trả lời bằng 1 decision record trong `docs/04-decisions/` (cột **Quyết định**). **Trạng thái 2026-09-14: 18/18 đã chốt.** Khi đọc yêu cầu có ghi "xem OI-NN", áp dụng quyết định tương ứng.
**Loại:** ⚔️ mâu thuẫn giữa A và B · ❓ mơ hồ/thiếu · ⚠️ nghi sai về toán học.

| Mã | Loại | Vấn đề | Liên quan | Câu hỏi cần trả lời | Quyết định |
|---|---|---|---|---|---|
| OI-01 | ❓ | Tên sản phẩm: nguồn gọi "Smart PM Suite", repo là "Planix V2". | §1 | Tên chính thức hiển thị cho người dùng? | ✅ [Tên sản phẩm: Planix](../../04-decisions/2026-09-14-oi01-product-name.md) |
| OI-02 | ❓ | A nêu PMBOK **4 và 6**; B chỉ nói "PMBOK/PMP"; phân hệ Agile (A §2.4) gần PMBOK 7 hơn. | §1.3 | Chuẩn tham chiếu khi các phiên bản PMBOK khác nhau? | ✅ [Chuẩn tham chiếu PMBOK](../../04-decisions/2026-09-14-oi02-pmbok-baseline.md) |
| OI-03 | ⚔️ | Mô hình phân quyền: B = **RBAC** theo vai trò; A = theo **ma trận RACI** và **vai trò trong Project Charter**. | NFR-01, FR-RES-04 | RBAC hệ thống + RACI cấp dự án cùng tồn tại? Lớp nào quyết định quyền truy cập dữ liệu? | ✅ [Phân quyền 2 lớp: RBAC tổ chức + RACI dự án](../../04-decisions/2026-09-14-oi03-access-control-model.md) |
| OI-04 | ⚠️ | A viết phương sai task `V = (P − O) / 6^2`, đọc nguyên văn = `(P − O)/36`; chuẩn PMBOK và công thức B §4 dùng `((P − O)/6)²`. B §4 cũng gọi `√Σ…` là "phương sai" trong khi đó là **độ lệch chuẩn**. | FR-SCH-02, 06 | Xác nhận `V = ((P − O)/6)²` và `SD_project = √ΣV`? | ✅ [Phương sai PERT = ((P − O)/6)²](../../04-decisions/2026-09-14-oi04-pert-variance.md) |
| OI-05 | ❓ | Quy ước ngày CPM của A (`EF = ES + D − 1`, ngày bắt đầu từ 1) chưa định nghĩa: ES của task đầu, ES của successor (`EF + 1`?), cách áp **4 loại phụ thuộc + lead/lag** (B) theo quy ước này, và ngày = **ngày làm việc theo Resource Calendar** hay ngày lịch. | FR-SCH-03, FR-TASK-03/04, FR-RES-01 | Chốt quy ước thời gian và cách tính cho FS/SS/FF/SF có lead/lag. | ✅ [Quy ước ngày CPM và phụ thuộc có lead/lag](../../04-decisions/2026-09-14-oi05-cpm-day-convention.md) |
| OI-06 | ⚔️ | WBS Dictionary: A = **mọi phần tử** WBS PHẢI có mục Dictionary; B = metadata tại **Work Package** (nút lá). | FR-WBS-01, 02 | Bắt buộc cho mọi nút hay chỉ Work Package? Trường nào bắt buộc ở từng cấp? | ✅ [WBS Dictionary: mọi nút có mô tả, Work Package đủ 3 trường](../../04-decisions/2026-09-14-oi06-wbs-dictionary-scope.md) |
| OI-07 | ⚔️ | Thẩm quyền đổi Baseline: A §2.8 + B §7 = **CCB** phê duyệt; A §2.7 = **chỉ RACI Accountable** được phê duyệt. | FR-CHG-01, 02 | Cần cả hai (CCB duyệt → Accountable áp dụng) hay một trong hai? Dự án không có CCB thì sao? | ✅ [Đổi Baseline: CCB duyệt → Accountable áp dụng](../../04-decisions/2026-09-14-oi07-baseline-approval-authority.md) |
| OI-08 | ❓ | Control chart: B "cài đặt **cứng**" các mức sigma; A "**mặc định** ±3σ"; B cho **cấu hình** UCL/LCL. | FR-QC-01..03 | UCL/LCL có được đặt khác ±3σ không? Cái gì cố định, cái gì cấu hình? | ✅ [Control chart: sigma cố định, UCL/LCL tự tính ±3σ, USL/LSL cấu hình](../../04-decisions/2026-09-14-oi08-control-chart-limits.md) |
| OI-09 | ⚠️ | Phạm vi loại trừ Sunk Cost: A §3 nói Sunk Cost không tham gia "các hàm logic tính toán **hiệu quả dự án** trong tương lai". Nếu áp nguyên văn cho EVM thì **AC (chi phí đã chi) bị loại → CPI/CV/EAC sai**. B chỉ áp cho **ROI/NPV lựa chọn dự án**. | FR-PORT-04, NFR-04, FR-EVM-* | Xác nhận chỉ loại Sunk Cost trong phân tích **quyết định hướng tới tương lai** (chọn dự án, tiếp tục/dừng), KHÔNG áp cho EVM? | ✅ [Sunk Cost chỉ loại trong phân tích quyết định tương lai, không áp cho EVM](../../04-decisions/2026-09-14-oi09-sunk-cost-scope.md) |
| OI-10 | ❓ | Nguồn AC: B §2 = timesheet đã duyệt × billing rate; B §9 = ERP cập nhật AC tự động. | FR-TASK-05, FR-INT-01 | Hai nguồn cộng dồn (nhân công + chi phí khác) hay ERP ghi đè? ERP nào, chiều đồng bộ, tần suất? | ✅ [AC = nhân công (timesheet) + ngoài nhân công (ERP), cộng theo loại](../../04-decisions/2026-09-14-oi10-actual-cost-sources.md) |
| OI-11 | ❓ | Path Convergence: không có ngưỡng "nhiều task tiền nhiệm". | FR-SCH-08 | Từ bao nhiêu predecessor thì cảnh báo? Cấu hình được không? | ✅ [Path Convergence: mặc định ≥ 3 tiền nhiệm, cấu hình được](../../04-decisions/2026-09-14-oi11-path-convergence-threshold.md) |
| OI-12 | ❓ | "Earned Schedule" có trong tên phân hệ A §2.2 nhưng không có chỉ số/công thức. | FR-EVM-07 | Có làm Earned Schedule (ES, SV(t), SPI(t)) trong v1 không? | ✅ [Earned Schedule để sau v1](../../04-decisions/2026-09-14-oi12-earned-schedule-deferred.md) |
| OI-13 | ❓ | Yêu cầu khó kiểm thử: Tuckman "theo dõi" bằng dữ liệu gì; "nhắc PM dành 90% thời gian truyền thông" hoạt động thế nào; "Smart Assignment" dùng thuật toán gì. | FR-AGL-02, FR-COM-03, FR-RES-02 | Tiêu chí chấp nhận cụ thể cho từng mục? | ✅ [Tiêu chí kiểm thử cho Tuckman, 90% truyền thông, Smart Assignment](../../04-decisions/2026-09-14-oi13-untestable-requirements.md) |
| OI-14 | ❓ | Chưa có con số quy mô/hiệu năng: "khối lượng lớn", "thời gian thực". | NFR-03, NFR-05 | Số dự án / task / người dùng đồng thời mục tiêu? Độ trễ chấp nhận được? | ✅ [Mục tiêu quy mô & hiệu năng v1](../../04-decisions/2026-09-14-oi14-scale-targets.md) |
| OI-15 | ⚠️ | A §4.2 ghi **6σ = 99.99%**. Với phân phối chuẩn, ±6σ ≈ 99.9999998%; chuẩn Six Sigma (dịch 1.5σ) = 99.99966%. | §5 | Có cần hiển thị 6σ không? Nếu có, dùng giá trị nào? | ✅ [Không hiển thị 6σ trong v1](../../04-decisions/2026-09-14-oi15-six-sigma-display.md) |
| OI-16 | ❓ | Tiền tệ & làm tròn: có 4 chữ số thập phân (NFR-02) nhưng chưa có đơn vị tiền tệ, đa tiền tệ, quy tắc làm tròn khi hiển thị. | NFR-02, FR-RES-03, PORT | Một hay nhiều loại tiền? Quy tắc làm tròn (half-up / banker's)? | ✅ [Tiền tệ: decimal cố định, làm tròn half-up khi hiển thị, 1 loại tiền/tổ chức](../../04-decisions/2026-09-14-oi16-money-and-rounding.md) |
| OI-17 | ❓ | Nguồn chưa nêu: đối tượng khách hàng (nội bộ / SaaS đa tổ chức), nền tảng (web / mobile), ngôn ngữ giao diện, múi giờ, xác thực đăng nhập. | toàn hệ thống | Chốt các ràng buộc nền tảng trước khi chọn tech stack. | ✅ [Nền tảng: web, đa tổ chức, VI/EN, UTC](../../04-decisions/2026-09-14-oi17-platform-constraints.md) |
| OI-18 | ❓ | Phạm vi v1: 13 phân hệ là rất lớn; nguồn không có thứ tự ưu tiên / MVP. | toàn hệ thống | Phân hệ nào làm trước? (gợi ý thứ tự phụ thuộc dữ liệu: TASK/RES/WBS → SCH → EVM → CHG → phần còn lại) | ✅ [Lộ trình phân hệ theo phụ thuộc dữ liệu](../../04-decisions/2026-09-14-oi18-release-phasing.md) |
