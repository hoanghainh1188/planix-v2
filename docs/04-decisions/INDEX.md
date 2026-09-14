# INDEX — mục lục quyết định (long-term memory)

Bảng này liệt kê **mọi quyết định** đã chốt trong `docs/04-decisions/`, để tra nhanh **trước khi hỏi
lại** một ambiguity (rule 2 + rule 6 `CLAUDE.md`). `design-intake` và `/speckit-clarify` PHẢI quét
bảng này trước — nếu câu hỏi đã có ở đây, dùng lại quyết định cũ thay vì hỏi lần nữa.

> **Quy ước:** mỗi khi thêm 1 file `docs/04-decisions/<YYYY-MM-DD>-<slug>.md`, **append 1 dòng** vào
> bảng dưới (append ít đụng nhau — hiếm khi gây git conflict). Sắp theo ngày giảm dần (mới nhất trên cùng).

| Ngày | Quyết định | Feature | Thuật ngữ / chủ đề |
|---|---|---|---|
| 2026-09-14 | [Thành viên tổ chức giữ nhiều vai trò hệ thống, quyền là hợp](2026-09-14-005-multiple-system-roles.md) | `005-organization-access` | role / organization membership |
| 2026-09-14 | [Chính sách mật khẩu và phiên đăng nhập](2026-09-14-005-password-and-session-policy.md) | `005-organization-access` | authentication / session |
| 2026-09-14 | [Mỗi dự án luôn có đúng một Accountable](2026-09-14-005-single-accountable-per-project.md) | `005-organization-access` | RACI / Accountable |
| 2026-09-14 | [Kích hoạt lại thành viên: về vai trò Thành viên, không khôi phục quyền cũ](2026-09-14-005-member-reactivation.md) | `005-organization-access` | organization membership / vô hiệu hoá |
| 2026-09-14 | [Có chức năng đặt lại mật khẩu qua email trong v1](2026-09-14-005-password-reset.md) | `005-organization-access` | authentication / password reset |
| 2026-09-14 | [Chỉ Platform Operator được tạo tổ chức](2026-09-14-005-organization-creation.md) | `005-organization-access` | Platform Operator / organization |
| 2026-09-14 | [Ma trận quyền vai trò hệ thống giai đoạn 1](2026-09-14-005-phase1-permission-matrix.md) | `005-organization-access` | role / RBAC / ma trận quyền |
| 2026-09-14 | [Một tài khoản được thuộc nhiều tổ chức](2026-09-14-005-multi-organization-membership.md) | `005-organization-access` | organization membership / tổ chức đang hoạt động |
| 2026-09-14 | [OI-01 · Tên sản phẩm: Planix](2026-09-14-oi01-product-name.md) | `_project` SRS v1 | tên sản phẩm |
| 2026-09-14 | [OI-02 · Chuẩn tham chiếu PMBOK](2026-09-14-oi02-pmbok-baseline.md) | `_project` SRS v1 | PMBOK |
| 2026-09-14 | [OI-03 · Phân quyền 2 lớp: RBAC tổ chức + RACI dự án](2026-09-14-oi03-access-control-model.md) | `_project` SRS v1 | RBAC / RACI / phân quyền |
| 2026-09-14 | [OI-04 · Phương sai PERT = ((P − O)/6)²](2026-09-14-oi04-pert-variance.md) | `_project` SRS v1 | PERT / variance |
| 2026-09-14 | [OI-05 · Quy ước ngày CPM và phụ thuộc có lead/lag](2026-09-14-oi05-cpm-day-convention.md) | `_project` SRS v1 | CPM / ES-EF-LS-LF / lead-lag |
| 2026-09-14 | [OI-06 · WBS Dictionary: mọi nút có mô tả, Work Package đủ 3 trường](2026-09-14-oi06-wbs-dictionary-scope.md) | `_project` SRS v1 | WBS Dictionary / Work Package |
| 2026-09-14 | [OI-07 · Đổi Baseline: CCB duyệt → Accountable áp dụng](2026-09-14-oi07-baseline-approval-authority.md) | `_project` SRS v1 | CCB / Baseline / RACI Accountable |
| 2026-09-14 | [OI-08 · Control chart: sigma cố định, UCL/LCL tự tính ±3σ, USL/LSL cấu hình](2026-09-14-oi08-control-chart-limits.md) | `_project` SRS v1 | control chart / UCL-LCL / USL-LSL |
| 2026-09-14 | [OI-09 · Sunk Cost chỉ loại trong phân tích quyết định tương lai, không áp cho EVM](2026-09-14-oi09-sunk-cost-scope.md) | `_project` SRS v1 | sunk cost / EVM / NPV |
| 2026-09-14 | [OI-10 · AC = nhân công (timesheet) + ngoài nhân công (ERP), cộng theo loại](2026-09-14-oi10-actual-cost-sources.md) | `_project` SRS v1 | Actual Cost / timesheet / ERP |
| 2026-09-14 | [OI-11 · Path Convergence: mặc định ≥ 3 tiền nhiệm, cấu hình được](2026-09-14-oi11-path-convergence-threshold.md) | `_project` SRS v1 | path convergence |
| 2026-09-14 | [OI-12 · Earned Schedule để sau v1](2026-09-14-oi12-earned-schedule-deferred.md) | `_project` SRS v1 | Earned Schedule / SPI(t) |
| 2026-09-14 | [OI-13 · Tiêu chí kiểm thử cho Tuckman, 90% truyền thông, Smart Assignment](2026-09-14-oi13-untestable-requirements.md) | `_project` SRS v1 | Tuckman / Smart Assignment |
| 2026-09-14 | [OI-14 · Mục tiêu quy mô & hiệu năng v1](2026-09-14-oi14-scale-targets.md) | `_project` SRS v1 | hiệu năng / quy mô |
| 2026-09-14 | [OI-15 · Không hiển thị 6σ trong v1](2026-09-14-oi15-six-sigma-display.md) | `_project` SRS v1 | sigma / control chart |
| 2026-09-14 | [OI-16 · Tiền tệ: decimal cố định, làm tròn half-up khi hiển thị, 1 loại tiền/tổ chức](2026-09-14-oi16-money-and-rounding.md) | `_project` SRS v1 | tiền tệ / làm tròn |
| 2026-09-14 | [OI-17 · Nền tảng: web, đa tổ chức, VI/EN, UTC](2026-09-14-oi17-platform-constraints.md) | `_project` SRS v1 | nền tảng / multi-tenant / i18n |
| 2026-09-14 | [OI-18 · Lộ trình phân hệ theo phụ thuộc dữ liệu](2026-09-14-oi18-release-phasing.md) | `_project` SRS v1 | roadmap / MVP |

<!--
Ví dụ 1 dòng thật:
| 2026-07-10 | Kênh gửi thông báo sau approval → file 2026-07-10-notify-channel.md | `042-user-reservation` | 通知 / notification |
-->
