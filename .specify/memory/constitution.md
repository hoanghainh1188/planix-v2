# Planix Constitution

## Core Principles

### I. Chính xác tính toán (NON-NEGOTIABLE)

Planix là hệ thống ra quyết định dựa trên số liệu; một công thức sai làm hỏng mọi báo cáo phía sau.

- Thứ tự chuẩn khi tính toán: **bảng công thức §5 của `docs/01-basic-design/_project/srs-v1.md`**
  > PMBOK 6 > PMBOK 7 / Agile Practice Guide (chỉ cho phân hệ Agile). Công thức trong code PHẢI khớp
  §5 và các decision record liên quan (VD phương sai PERT `((P − O)/6)²`).
- Tiền tệ và mọi chỉ số tài chính/EVM PHẢI dùng kiểu **decimal cố định**. **CẤM** float/double cho
  tiền và chỉ số.
- Tính trung gian giữ **≥ 4 chữ số thập phân**; **chỉ làm tròn ở tầng hiển thị**, kiểu **half-up**.
  Không được làm tròn giá trị trung gian rồi dùng tiếp.
- Mỗi công thức PHẢI có unit test dùng ví dụ tham chiếu (ví dụ trong SRS hoặc tính tay có ghi nguồn),
  gồm cả biên (chia cho 0, CPI/SPI = 0, danh sách rỗng).
- **Sunk Cost** chỉ bị loại trong phân tích quyết định hướng tương lai (lựa chọn dự án, tiếp tục/dừng).
  **EVM PHẢI dùng đầy đủ AC.** Lịch sử chi phí KHÔNG được xoá.

### II. Quy trình PMP là ràng buộc cứng

Giá trị của Planix là cưỡng ép kỷ luật quy trình; ràng buộc chỉ nằm ở UI thì bị vượt qua bằng API.

- Các quy tắc sau PHẢI được cưỡng chế ở **tầng domain/server**, UI chỉ phản ánh lại:
  - Task không vào "In Progress" hay ghi nhận tiến độ khi chưa có **Work Authorization**.
  - **Baseline** chỉ đổi qua luồng: Change Request → **CCB phê duyệt** → **RACI Accountable** áp dụng,
    tạo version mới; dự án không khai CCB thì CCB = Accountable.
  - Mọi thay đổi phạm vi chưa được phê duyệt bị chặn (chống scope creep).
  - Không chốt Baseline khi còn Work Package thiếu mô tả, tiêu chuẩn nghiệm thu hoặc người chịu
    trách nhiệm trong WBS Dictionary.
  - Timesheet chỉ thành dữ liệu tính AC sau khi được phê duyệt.
- Mỗi quy tắc cưỡng chế PHẢI có test chứng minh bị chặn khi gọi thẳng API.
- Mọi thay đổi Baseline và phê duyệt PHẢI để lại audit trail (ai, khi nào, trước/sau).

### III. Bảo mật & phân quyền mặc định từ chối

Dữ liệu đơn giá và ngân sách là thông tin nhạy cảm; hệ thống phục vụ nhiều tổ chức.

- Mặc định **từ chối**; quyền chỉ phát sinh khi được cấp rõ ràng.
- Phân quyền **2 lớp**: RBAC cấp tổ chức (được truy cập phân hệ nào) **VÀ** thành viên dự án / vai
  trò RACI (được phê duyệt gì trong dự án). Thiếu một lớp = không có quyền.
- **Billing rate và ngân sách** PHẢI bảo vệ ở **mức field trong API**: người không có quyền không
  nhận được field đó trong response — ẩn trên UI là không đủ.
- **Cô lập tenant tuyệt đối**: mọi dữ liệu nghiệp vụ gắn tổ chức; mọi truy vấn PHẢI lọc theo tổ chức
  của người gọi; PHẢI có test chứng minh không đọc/ghi chéo tổ chức.
- Không hardcode secret; không log dữ liệu nhạy cảm (đơn giá, ngân sách, thông tin cá nhân).

### IV. Test-first & coverage

- TDD bắt buộc cho business logic: viết test trước (RED) → cài đặt tối thiểu (GREEN) → refactor.
- Coverage **≥ 80%** trên business logic (không tính scaffolding, code sinh tự động, cấu hình).
- Test gate chỉ đạt khi **cả** lint/test/build xanh **và** đạt ngưỡng coverage; thiếu một điều kiện
  thì không merge, không deploy.
- Test PHẢI deterministic: không phụ thuộc thời gian thực, múi giờ máy chạy hay thứ tự chạy.

### V. Nguồn sự thật & truy vết

- Tài liệu trong `docs/01-basic-design/`, `docs/02-detail-design/`, `docs/03-ui/` (kể cả
  `_project/sources/`) là nguồn gốc: **không sửa nội dung**; bản mới → file version mới + `CHANGELOG.md`.
- Mâu thuẫn hoặc mơ hồ giữa các nguồn **không được tự chọn một bên**: nêu qua `/speckit-clarify`, ghi
  câu trả lời vào `docs/04-decisions/` và append `INDEX.md`. Trước khi hỏi, PHẢI tra `INDEX.md`.
- Feature có tài liệu thiết kế PHẢI đi qua subagent `design-intake` để có file trong `docs/intake/`
  trước khi `/speckit-specify`.
- `docs/intake/`, `docs/04-decisions/`, `specs/` được commit làm bằng chứng truy vết.

### VI. Thuật ngữ nhất quán

- Trước khi đặt tên biến, field, API hay bảng liên quan nghiệp vụ PHẢI tra `docs/00-glossary.md`
  (thuật ngữ **Tiếng Việt – English**). Thuật ngữ mới → append glossary trước khi dùng.
- Khái niệm trùng viết tắt PHẢI có tên tách bạch trong code và glossary (VD `plannedValue` ≠
  `presentValue`; `earlyStart` ≠ Earned Schedule).
- Cấm tự dịch sang tiếng Anh chung chung khi glossary đã có thuật ngữ.

### VII. Đơn giản & theo lộ trình

- Chỉ xây tính năng thuộc **giai đoạn hiện tại** của lộ trình 4 giai đoạn (decision OI-18):
  (1) phân quyền + TASK + RES + WBS + SCH → (2) timesheet/AC + EVM + CHG → (3) RISK + QC + PROC →
  (4) PORT + AGL + COM + INT. Làm sớm hạng mục giai đoạn sau PHẢI có decision record.
- Không thêm abstraction, cấu hình hay điểm mở rộng khi chưa có yêu cầu cụ thể trong spec.
- Độ phức tạp vượt mức cần thiết PHẢI được giải trình trong `plan.md` (mục Complexity Tracking).

## Ràng buộc nền tảng & phi chức năng

- **Nền tảng:** web app responsive; kiến trúc **đa tổ chức (multi-tenant) từ ngày đầu**.
- **Ngôn ngữ giao diện:** i18n **Tiếng Việt + English** từ đầu; không hardcode chuỗi hiển thị.
- **Thời gian:** lưu **UTC**, hiển thị theo múi giờ người dùng. Lịch tiến độ tính theo ngày làm việc
  của lịch dự án (decision OI-05).
- **Tiền tệ:** một loại tiền cho mỗi tổ chức ở v1.
- **Mục tiêu hiệu năng v1** (decision OI-14): ~200 người dùng đồng thời, 500 dự án/tổ chức,
  10.000 task/dự án; tính lại CPM ≤ 2 giây với 10.000 task; dashboard p95 < 1 giây; chỉ số EVM cập
  nhật ≤ 1 phút sau khi duyệt timesheet.
- **Tech stack: CHƯA CHỐT.** Việc chọn ngôn ngữ, framework, database PHẢI được ghi thành decision record
  trong `docs/04-decisions/` và cập nhật `CLAUDE.md` **trước khi** sinh code trong `src/`. Agent không
  được tự giả định stack.

## Quy trình phát triển & quality gates

- **Feature ID = số issue GitHub**; branch `NNN-<slug>` (NNN zero-pad ≥ 3); code riêng của feature nằm
  trong `src/features/<slug>/`, chỉ chạm vùng dùng chung khi thật cần và tách commit nhỏ.
- Mọi thay đổi vào `main` PHẢI qua **Pull Request** + **Code Owner review** + CI xanh.
- Sau `/speckit-implement`: `code-reviewer` PHẢI hết mục **Blocking**; `glossary-steward` đối chiếu
  thuật ngữ; `security-reviewer` PHẢI hết mục **Blocking** khi feature đụng data, auth hoặc API.
- Test gate theo Nguyên tắc IV trước khi merge/deploy.
- Gotcha kỹ thuật phát hiện khi làm PHẢI append vào `docs/05-lessons.md`.
- Khi constitution hoặc glossary đổi trên `main`: rebase và chạy lại `/speckit-analyze` cho feature
  đang làm.

## Governance

- Constitution này **thắng** mọi tài liệu và thực hành khác trong workflow Spec Kit. `CLAUDE.md` là
  hướng dẫn runtime cho agent và PHẢI không mâu thuẫn với constitution.
- **Sửa đổi:** mọi thay đổi constitution qua **PR riêng**, được steward (`@hoanghainh1188`, theo
  `.github/CODEOWNERS`) duyệt; PR nêu lý do và tác động tới spec/plan đang có.
- **Versioning (semver):** MAJOR = bỏ hoặc định nghĩa lại nguyên tắc; MINOR = thêm nguyên tắc/mục hoặc
  mở rộng đáng kể; PATCH = làm rõ câu chữ, không đổi ngữ nghĩa.
- **Tuân thủ:** mọi PR review PHẢI kiểm tra tuân thủ constitution; `/speckit-analyze` coi vi phạm
  constitution là lỗi CRITICAL. Sau khi constitution đổi, các feature đang chạy PHẢI chạy lại
  `/speckit-analyze`.

**Version**: 1.0.0 | **Ratified**: 2026-09-14 | **Last Amended**: 2026-09-14
