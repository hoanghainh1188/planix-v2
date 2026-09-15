# Thuật ngữ dự án (Tiếng Việt / English)

Nguồn thuật ngữ **duy nhất** của Planix (Nguyên tắc VI của constitution). Mọi agent PHẢI tra bảng này
trước khi đặt tên biến / field / API / bảng liên quan nghiệp vụ.

## Quy ước

- **English** = thuật ngữ chuẩn (theo PMBOK). **Duy nhất trong toàn file** — CI (`check-template.py`)
  báo lỗi nếu trùng.
- **Định danh code** = từ gốc để đặt tên, viết dạng `camelCase` làm quy ước trung lập. Khi đã chốt tech
  stack, *kiểu viết* (snake_case, PascalCase…) theo chuẩn của stack, nhưng **các từ không được đổi**.
- **Viết tắt** chỉ dùng trong UI, công thức và comment; **không dùng viết tắt làm định danh code** khi
  viết tắt bị trùng nghĩa (các dòng có ⚠️).
- Vietnamese UI label có thể khác cột **Tiếng Việt** khi cần ngắn gọn, nhưng nghĩa phải giữ nguyên.
- **THÊM** thuật ngữ mới → append ngay trong branch feature. **SỬA / đổi tên / xoá** thuật ngữ đã có →
  PR riêng được steward duyệt (rule 5 `CLAUDE.md`).
- Cột **Nguồn**: mã phân hệ / yêu cầu trong SRS hợp nhất `docs/01-basic-design/_project/srs-v1.md`
  hoặc decision record `OI-NN`.

## Chung

| Tiếng Việt | English | Viết tắt | Định danh code | Ghi chú | Nguồn |
|---|---|---|---|---|---|
| Tổ chức | Organization | | `organization` | Đơn vị tenant. Dùng "organization" trong code nghiệp vụ; "tenant" chỉ ở tầng hạ tầng | OI-17 |
| Người dùng | User | | `user` | | |
| Dự án | Project | | `project` | | |
| Danh mục dự án | Portfolio | | `portfolio` | | PORT |
| Thành viên dự án | Project Member | | `projectMember` | | OI-03 |
| Vai trò (hệ thống) | Role | | `role` | Vai trò RBAC cấp tổ chức; khác vai trò RACI | OI-03 |
| Giám đốc dự án | Project Manager | PM | `projectManager` | | §1.4 |
| Quản lý chức năng | Functional Manager | FM | `functionalManager` | | §1.4 |
| Điều lệ dự án | Project Charter | | `projectCharter` | | A §3 |
| Ràng buộc bộ ba | Triple Constraint | | `tripleConstraint` | Phạm vi · Thời gian · Chi phí | §1.2 |
| Đường cơ sở | Baseline | | `baseline` | Có version; chỉ đổi qua CCB → Accountable | CHG, OI-07 |
| Phiên bản đường cơ sở | Baseline Version | | `baselineVersion` | | FR-CHG-04 |

## Tổ chức, tài khoản & phân quyền

| Tiếng Việt | English | Viết tắt | Định danh code | Ghi chú | Nguồn |
|---|---|---|---|---|---|
| Người vận hành nền tảng | Platform Operator | | `platformOperator` | Vai trò cấp nền tảng, ngoài mọi tổ chức; tạo tổ chức, mời Admin đầu tiên; không đọc dữ liệu nghiệp vụ | FR-004, decision `2026-09-14-005-organization-creation` |
| Thành viên tổ chức | Organization Membership | | `organizationMembership` | Quan hệ User – Organization; một user có nhiều membership ở các tổ chức khác nhau | FR-017 |
| Gán vai trò hệ thống | Membership Role | | `membershipRole` | Một membership giữ nhiều vai trò, quyền là hợp | FR-012 |
| Lời mời tham gia tổ chức | Organization Invitation | | `organizationInvitation` | Hạn 7 ngày, dùng một lần; trạng thái `pending`/`accepted`/`revoked`/`expired` | FR-009 |
| Phiên đăng nhập | Session | | `authSession` | Phiên phía server; hết sau 8 giờ không hoạt động. Không dùng `session` trần để tránh nhầm framework | FR-007 |
| Tổ chức đang hoạt động | Active Organization | | `activeOrganization` | Tổ chức mà mọi yêu cầu hiện tại gắn vào | FR-017 |
| Mã đặt lại mật khẩu | Password Reset Token | | `passwordResetToken` | Dùng một lần, hết hạn sau 1 giờ; chỉ lưu bản băm | FR-031 |
| Bản ghi kiểm toán | Audit Entry | | `auditEntry` | Append-only | FR-027 |
| Chính sách trường nhạy cảm | Sensitive Field Policy | | `sensitiveFieldPolicy` | Đánh dấu trường cần quyền để đọc/ghi (VD `billingRate`, `budgetAtCompletion`) | FR-025 |
| Trường nhạy cảm | Sensitive Field | | `sensitiveField` | Trường chỉ đọc/ghi được khi có quyền `sensitive.*` (VD `billingRate`, `budgetAtCompletion`); khi thiếu quyền **không có khoá** trong response, danh sách, body lỗi và audit. Code: đánh dấu `sensitive()`, thực thi `stripSensitive`/`findSensitiveWrites`, áp dụng tại `SensitiveFieldInterceptor` | FR-025, FR-026, contracts/authorization.md §5 |
| Quản trị viên tổ chức | Organization Admin | | `admin` | Giá trị của `role` | FR-011, OI-03 |
| Lãnh đạo danh mục | Portfolio Lead | | `portfolioLead` | Giá trị của `role`; khác `portfolio` (thực thể) | FR-011, OI-03 |
| Thành viên (vai trò hệ thống) | Member | | `member` | Giá trị mặc định của `role` | FR-011, OI-03 |
| Tài chính (vai trò hệ thống) | Finance | | `finance` | Giá trị của `role`; được xem trường tài chính nhạy cảm | FR-011, OI-03 |
| Khoá đăng nhập tạm thời | Login Lockout | | `loginLockout` | Khoá 15 phút sau 5 lần đăng nhập sai liên tiếp; bộ đếm về 0 khi hết khoá hoặc đăng nhập đúng | FR-006 |
| Chính sách mật khẩu | Password Policy | | `passwordPolicy` | Tối thiểu 12 ký tự, chặn mật khẩu phổ biến; không bắt buộc ký tự đặc biệt | FR-006 |
| Quyền Người vận hành nền tảng | Platform Operator Grant | | `platformOperatorGrant` | Gán tư cách Platform Operator cho một user; không gắn `organizationId` | FR-004 |
| Ma trận quyền | Permission Matrix | | `permissionMatrix` | Bảng Action → vai trò được phép + điều kiện cấp dự án | FR-013, contracts/authorization.md |
| Hành động (ma trận quyền) | Action | | `action` | Mã hành động được khai báo trong ma trận quyền, VD `org.member.invite`; mọi route phải khai báo | FR-013, contracts/authorization.md |
| Chủ thể yêu cầu | Principal | | `principal` | Danh tính người gọi trong tổ chức đang hoạt động (vai trò, trạng thái membership) — đầu vào của `decide` | contracts/authorization.md |
| Đối tượng kiểm tra quyền | Target | | `target` | Đối tượng bị tác động (`organization` hoặc `project`, kèm tư cách thành viên/RACI) | contracts/authorization.md |
| Quyết định quyền | Decision | | `decision` | Kết quả của `decide`: cho phép, hoặc từ chối kèm lý do (mặc định từ chối) | FR-014, contracts/authorization.md |
| Vô hiệu hoá thành viên | Membership Deactivation | | `membershipDeactivation` | Động từ trong code: `deactivate`. Giữ lịch sử; gỡ vai trò, thành viên dự án (`removed`) và RACI; chặn nếu là Admin cuối hoặc đang là Accountable | FR-015 |
| Kích hoạt lại thành viên | Membership Reactivation | | `membershipReactivation` | Động từ trong code: `reactivate`. Vai trò về `member`, không khôi phục dự án/RACI cũ | FR-015, decision `2026-09-14-005-member-reactivation` |
| Thu hồi lời mời | Invitation Revocation | | `invitationRevocation` | Động từ trong code: `revoke`. Lời mời `pending` → `revoked`; mời lại cùng email tự thu hồi lời mời cũ | FR-009 |
| Lý do từ chối | Deny Reason | | `denyReason` | Mã lý do khi `decide` từ chối, VD `MEMBERSHIP_INACTIVE` | contracts/authorization.md |

## TASK — Tác nghiệp

| Tiếng Việt | English | Viết tắt | Định danh code | Ghi chú | Nguồn |
|---|---|---|---|---|---|
| Công việc | Task | | `task` | | TASK |
| Công việc con | Sub-task | | `subtask` | Đa cấp | FR-TASK-01 |
| Danh sách kiểm | Checklist | | `checklist` | | FR-TASK-01 |
| Mục danh sách kiểm | Checklist Item | | `checklistItem` | | FR-TASK-01 |
| Phê duyệt thực hiện công việc | Work Authorization | | `workAuthorization` | Cờ bật bởi PM/FM; thiếu thì task không vào In Progress | FR-TASK-02 |
| Phụ thuộc | Dependency | | `dependency` | | FR-TASK-03 |
| Sơ đồ mạng | Network Diagram | | `networkDiagram` | | FR-TASK-03 |
| Kết thúc – Bắt đầu | Finish-to-Start | FS | `finishToStart` | Loại phụ thuộc | FR-TASK-03 |
| Bắt đầu – Bắt đầu | Start-to-Start | SS | `startToStart` | Loại phụ thuộc | FR-TASK-03 |
| Kết thúc – Kết thúc | Finish-to-Finish | FF | `finishToFinish` | Loại phụ thuộc | FR-TASK-03 |
| Bắt đầu – Kết thúc | Start-to-Finish | SF | `startToFinish` | Loại phụ thuộc | FR-TASK-03 |
| Thời gian chờ | Lag | | `lag` | Lưu 1 trường `lag`, **lead = lag âm** | FR-TASK-04, OI-05 |
| Thời gian gối đầu | Lead | | — | Không có trường riêng; biểu diễn bằng `lag` âm | FR-TASK-04, OI-05 |
| Bảng chấm công | Timesheet | | `timesheet` | Phải được phê duyệt mới tính AC | FR-TASK-05 |
| Dòng chấm công | Timesheet Entry | | `timesheetEntry` | | FR-TASK-05 |

## RES — Nguồn lực

| Tiếng Việt | English | Viết tắt | Định danh code | Ghi chú | Nguồn |
|---|---|---|---|---|---|
| Nguồn lực | Resource | | `resource` | | RES |
| Lịch nguồn lực | Resource Calendar | | `resourceCalendar` | Dùng cho leveling và gán việc | FR-RES-01, OI-05 |
| Lịch dự án | Project Calendar | | `projectCalendar` | Căn cứ tính ngày làm việc trong CPM | OI-05 |
| Ma trận kỹ năng | Skills Matrix | | `skillsMatrix` | | FR-RES-02 |
| Gán việc thông minh | Smart Assignment | | `smartAssignment` | Gợi ý top 3, PM xác nhận | FR-RES-02, OI-13 |
| Đơn giá | Billing Rate | | `billingRate` | 🔒 Nhạy cảm — bảo vệ mức field | FR-RES-03, OI-03 |
| Quá tải nguồn lực | Over-allocation | | `overAllocation` | | FR-RES-05 |
| Biểu đồ phân bổ nguồn lực | Resource Histogram | | `resourceHistogram` | | FR-RES-05 |
| San bằng nguồn lực | Resource Leveling | | `resourceLeveling` | Chạy xong phải tính lại Đường găng | FR-RES-06 |
| Ưu tiên lập lịch | Scheduling Priority | | `schedulingPriority` | | FR-RES-07 |
| Ma trận RACI | RACI Matrix | RACI | `raciMatrix` | Vai trò cấp dự án | FR-RES-04, OI-03 |
| Người thực hiện | Responsible | R | `responsible` | Vai trò RACI | FR-RES-04 |
| Người chịu trách nhiệm giải trình | Accountable | A | `accountable` | Vai trò RACI; áp dụng cập nhật Baseline | FR-RES-04, OI-07 |
| Người được tham vấn | Consulted | C | `consulted` | Vai trò RACI | FR-RES-04 |
| Người được thông báo | Informed | I | `informed` | Vai trò RACI | FR-RES-04 |
| Gán vai trò RACI | RACI Assignment | | `raciAssignment` | Một vai trò RACI của một Project Member (bảng `raci_assignment`); tương tự `membershipRole` nhưng ở cấp dự án; mỗi dự án đúng một bản ghi `accountable` | FR-RES-04, decision `2026-09-14-005-single-accountable-per-project` |
| Đổi người chịu trách nhiệm giải trình | Accountable Change | | `accountableChange` | Động từ trong code: `change` (VD `changeAccountable`). Thay Accountable của dự án bằng một thành viên dự án đang hoạt động trong **một bước**; không bao giờ có trạng thái chưa có Accountable | FR-020, decision `2026-09-14-005-single-accountable-per-project` |

## WBS — Phạm vi

| Tiếng Việt | English | Viết tắt | Định danh code | Ghi chú | Nguồn |
|---|---|---|---|---|---|
| Cấu trúc phân rã công việc | Work Breakdown Structure | WBS | `workBreakdownStructure` | Dùng `wbs` làm tiền tố được | WBS |
| Nút WBS | WBS Element | | `wbsElement` | Mọi nút PHẢI có mục Dictionary | OI-06 |
| Từ điển WBS | WBS Dictionary | | `wbsDictionary` | | FR-WBS-01 |
| Gói công việc | Work Package | | `workPackage` | Nút lá; bắt buộc đủ 3 trường Dictionary | FR-WBS-01, OI-06 |
| Tài khoản kiểm soát | Control Account | | `controlAccount` | Nhận roll-up AC, EV | FR-WBS-03 |
| Tổng hợp lên | Roll-up | | `rollUp` | | FR-WBS-03 |
| Tiêu chuẩn nghiệm thu | Acceptance Criteria | | `acceptanceCriteria` | | FR-WBS-01 |
| Người phụ trách gói công việc | Responsible Party | | `responsibleParty` | Trường của WBS Dictionary; khác vai trò RACI `responsible` | FR-WBS-01 |
| Sản phẩm bàn giao | Deliverable | | `deliverable` | | FR-WBS-04 |
| Sản phẩm bàn giao đã kiểm định | Verified Deliverable | | `verifiedDeliverable` | | FR-WBS-04 |
| Xác nhận phạm vi | Validate Scope | | `validateScope` | | FR-WBS-04 |
| Kiểm tra nghiệm thu | Inspection | | `inspection` | | FR-WBS-04 |
| Phạm vi phình to | Scope Creep | | `scopeCreep` | Bị chặn khi chưa qua CCB | FR-CHG-03 |

## SCH — Lập lịch PERT/CPM

| Tiếng Việt | English | Viết tắt | Định danh code | Ghi chú | Nguồn |
|---|---|---|---|---|---|
| Ước tính lạc quan | Optimistic Estimate | O | `optimisticEstimate` | | FR-SCH-01 |
| Ước tính khả dĩ nhất | Most Likely Estimate | M | `mostLikelyEstimate` | | FR-SCH-01 |
| Ước tính bi quan | Pessimistic Estimate | P | `pessimisticEstimate` | | FR-SCH-01 |
| Thời gian dự kiến | Expected Duration | E | `expectedDuration` | `(P + 4M + O) / 6` | FR-SCH-01 |
| Thời lượng | Duration | D | `duration` | Ngày làm việc theo lịch dự án | OI-05 |
| Độ lệch chuẩn | Standard Deviation | σ, SD | `standardDeviation` | `(P − O) / 6` | FR-SCH-02 |
| Phương sai | Variance | V | `variance` | `((P − O) / 6)²` | OI-04 |
| Bắt đầu sớm | Early Start | ES | `earlyStart` | ⚠️ Viết tắt trùng Earned Schedule | FR-SCH-03 |
| Kết thúc sớm | Early Finish | EF | `earlyFinish` | | FR-SCH-03 |
| Bắt đầu muộn | Late Start | LS | `lateStart` | | FR-SCH-03 |
| Kết thúc muộn | Late Finish | LF | `lateFinish` | | FR-SCH-03 |
| Lượt tính xuôi | Forward Pass | | `forwardPass` | | FR-SCH-03 |
| Lượt tính ngược | Backward Pass | | `backwardPass` | | FR-SCH-03 |
| Độ phồng tổng | Total Float | TF | `totalFloat` | `LS − ES`; nguồn B gọi "Float (độ phồng)" | FR-SCH-04 |
| Đường găng | Critical Path | CP | `criticalPath` | Chuỗi task có Total Float = 0 | FR-SCH-04 |
| Hội tụ đường | Path Convergence | | `pathConvergence` | Cảnh báo khi ≥ 3 tiền nhiệm (cấu hình được) | FR-SCH-08, OI-11 |
| Công việc tiền nhiệm | Predecessor | | `predecessor` | | FR-SCH-08 |
| Công việc kế tiếp | Successor | | `successor` | | OI-05 |
| Khoảng tin cậy | Confidence Interval | | `confidenceInterval` | 1σ / 2σ / 3σ | FR-SCH-07 |

## EVM — Giá trị thu được

| Tiếng Việt | English | Viết tắt | Định danh code | Ghi chú | Nguồn |
|---|---|---|---|---|---|
| Quản lý giá trị thu được | Earned Value Management | EVM | `earnedValueManagement` | | EVM |
| Giá trị kế hoạch | Planned Value | PV | `plannedValue` | ⚠️ Viết tắt trùng Present Value — cấm dùng `pv` trong code | FR-EVM-01 |
| Giá trị thu được | Earned Value | EV | `earnedValue` | | FR-EVM-01 |
| Chi phí thực tế | Actual Cost | AC | `actualCost` | Gồm nhân công (timesheet) + ngoài nhân công (ERP); không loại Sunk Cost | OI-09, OI-10 |
| Chi phí nhân công thực tế | Labor Actual Cost | | `laborActualCost` | Timesheet đã duyệt × Billing Rate | OI-10 |
| Chi phí ngoài nhân công thực tế | Non-labor Actual Cost | | `nonLaborActualCost` | Nhập từ ERP | OI-10 |
| Ngân sách khi hoàn thành | Budget at Completion | BAC | `budgetAtCompletion` | 🔒 Ngân sách — bảo vệ mức field | FR-EVM-03, OI-03 |
| Sai lệch chi phí | Cost Variance | CV | `costVariance` | `EV − AC` | FR-EVM-01 |
| Sai lệch tiến độ | Schedule Variance | SV | `scheduleVariance` | `EV − PV` | FR-EVM-01 |
| Chỉ số hiệu suất chi phí | Cost Performance Index | CPI | `costPerformanceIndex` | `EV / AC` | FR-EVM-02 |
| Chỉ số hiệu suất tiến độ | Schedule Performance Index | SPI | `schedulePerformanceIndex` | `EV / PV` | FR-EVM-02 |
| Chỉ số hiệu suất cần đạt | To-Complete Performance Index | TCPI | `toCompletePerformanceIndex` | 2 biến thể: theo BAC, theo EAC | FR-EVM-03 |
| Ước tính khi hoàn thành | Estimate at Completion | EAC | `estimateAtCompletion` | | FR-EVM-04 |
| Ước tính để hoàn thành | Estimate to Complete | ETC | `estimateToComplete` | | FR-EVM-04 |
| Ước tính từ dưới lên | Bottom-up Estimate | | `bottomUpEstimate` | Dùng cho kịch bản Flawed | FR-EVM-05 |
| Kịch bản dự báo EAC | EAC Scenario | | `eacScenario` | Giá trị: `typical`, `atypical`, `flawedEstimate`, `deadlineOverBudget` | FR-EVM-04 |
| Lịch trình thu được | Earned Schedule | ES(t) | `earnedSchedule` | ⚠️ Viết tắt trùng Early Start. Chưa làm ở v1 | FR-EVM-07, OI-12 |

## RISK — Rủi ro

| Tiếng Việt | English | Viết tắt | Định danh code | Ghi chú | Nguồn |
|---|---|---|---|---|---|
| Rủi ro | Risk | | `risk` | | RISK |
| Sổ đăng ký rủi ro | Risk Register | | `riskRegister` | Nguồn B viết "Risk Registry"; dùng thuật ngữ PMBOK "Risk Register" | FR-RISK-01 |
| Xác suất | Probability | | `probability` | | FR-RISK-02 |
| Tác động | Impact | | `impact` | | FR-RISK-02 |
| Giá trị tiền tệ kỳ vọng | Expected Monetary Value | EMV | `expectedMonetaryValue` | `Xác suất × Tác động` | FR-RISK-02 |
| Cây quyết định | Decision Tree | | `decisionTree` | | FR-RISK-03 |

## QC — Chất lượng

| Tiếng Việt | English | Viết tắt | Định danh code | Ghi chú | Nguồn |
|---|---|---|---|---|---|
| Biểu đồ kiểm soát | Control Chart | | `controlChart` | | FR-QC-01 |
| Giới hạn kiểm soát trên | Upper Control Limit | UCL | `upperControlLimit` | Tự tính mean + 3σ, không sửa tay | FR-QC-02, OI-08 |
| Giới hạn kiểm soát dưới | Lower Control Limit | LCL | `lowerControlLimit` | Tự tính mean − 3σ, không sửa tay | FR-QC-02, OI-08 |
| Giới hạn đặc tả trên | Upper Specification Limit | USL | `upperSpecificationLimit` | Người dùng cấu hình | FR-QC-03, OI-08 |
| Giới hạn đặc tả dưới | Lower Specification Limit | LSL | `lowerSpecificationLimit` | Người dùng cấu hình | FR-QC-03, OI-08 |
| Năng lực quy trình | Process Capability | | `processCapability` | | FR-QC-03 |
| Phân tích Pareto | Pareto Analysis | | `paretoAnalysis` | | FR-QC-04 |
| Độ chính xác | Accuracy | | `accuracy` | Gần giá trị đúng. ⚠️ Dễ nhầm với Precision trong tiếng Việt — luôn dùng tên English trong code | FR-QC-05 |
| Độ chuẩn xác (độ chụm) | Precision | | `precision` | Các lần đo gần nhau. Nguồn A gọi "độ chuẩn xác" | FR-QC-05 |

## CHG — Kiểm soát thay đổi

| Tiếng Việt | English | Viết tắt | Định danh code | Ghi chú | Nguồn |
|---|---|---|---|---|---|
| Kiểm soát thay đổi tích hợp | Integrated Change Control | | `integratedChangeControl` | | CHG |
| Yêu cầu thay đổi | Change Request | CR | `changeRequest` | | FR-CHG-01 |
| Hội đồng kiểm soát thay đổi | Change Control Board | CCB | `changeControlBoard` | Mặc định = người Accountable nếu dự án không khai | FR-CHG-01, OI-07 |
| Phân tích tác động | Impact Analysis | | `impactAnalysis` | Tác động lên Triple Constraint; khác `impact` của rủi ro | FR-CHG-01 |

## PROC — Mua sắm

| Tiếng Việt | English | Viết tắt | Định danh code | Ghi chú | Nguồn |
|---|---|---|---|---|---|
| Hợp đồng giá cố định có phí khuyến khích | Fixed Price Incentive Fee | FPIF | `fixedPriceIncentiveFee` | | PROC |
| Điểm giả định tổng chi phí | Point of Total Assumption | PTA | `pointOfTotalAssumption` | | FR-PROC-01 |
| Giá trần | Ceiling Price | | `ceilingPrice` | | FR-PROC-01 |
| Giá mục tiêu | Target Price | | `targetPrice` | | FR-PROC-01 |
| Chi phí mục tiêu | Target Cost | | `targetCost` | | FR-PROC-01 |
| Tỷ lệ chia sẻ | Share Ratio | | `shareRatio` | | FR-PROC-02 |
| Tỷ lệ chia sẻ của bên mua | Buyer's Share Ratio | | `buyerShareRatio` | Dùng trong công thức PTA | FR-PROC-01 |
| Tỷ lệ chia sẻ của bên bán | Seller's Share Ratio | | `sellerShareRatio` | Nhập vào thì tự chuyển sang `buyerShareRatio` | FR-PROC-03 |

## PORT — Danh mục & tài chính

| Tiếng Việt | English | Viết tắt | Định danh code | Ghi chú | Nguồn |
|---|---|---|---|---|---|
| Giá trị hiện tại | Present Value | PV | `presentValue` | ⚠️ Viết tắt trùng Planned Value — cấm dùng `pv` trong code | FR-PORT-03 |
| Giá trị tương lai | Future Value | FV | `futureValue` | | FR-PORT-03 |
| Lãi suất chiết khấu | Discount Rate | r | `discountRate` | | FR-PORT-03 |
| Giá trị hiện tại ròng | Net Present Value | NPV | `netPresentValue` | | FR-PORT-01 |
| Tỷ suất hoàn vốn nội bộ | Internal Rate of Return | IRR | `internalRateOfReturn` | | FR-PORT-01 |
| Tỷ số lợi ích – chi phí | Benefit-Cost Ratio | BCR | `benefitCostRatio` | Chọn khi > 1 | FR-PORT-02 |
| Thời gian hoàn vốn | Payback Period | | `paybackPeriod` | | FR-PORT-01 |
| Lợi tức đầu tư | Return on Investment | ROI | `returnOnInvestment` | | FR-PORT-04 |
| Chi phí chìm | Sunk Cost | | `sunkCost` | Chỉ loại trong phân tích quyết định tương lai; không áp cho EVM | FR-PORT-04, OI-09 |
| Chi phí cơ hội | Opportunity Cost | | `opportunityCost` | | FR-PORT-05 |
| Khấu hao | Depreciation | | `depreciation` | | FR-PORT-06 |
| Giá trị cần khấu hao | Depreciable Cost | | `depreciableCost` | | FR-PORT-06 |
| Thời gian sử dụng còn lại | Remaining Life | | `remainingLife` | | FR-PORT-06 |
| Khấu hao đường thẳng | Straight-Line Depreciation | SL | `straightLine` | Giá trị của phương pháp khấu hao | FR-PORT-06 |
| Khấu hao số dư giảm dần kép | Double Declining Balance | DDB | `doubleDecliningBalance` | Giá trị của phương pháp khấu hao | FR-PORT-06 |
| Khấu hao theo tổng số năm | Sum-of-the-Years' Digits | SYD | `sumOfYearsDigits` | Giá trị của phương pháp khấu hao | FR-PORT-06 |

## AGL — Agile

| Tiếng Việt | English | Viết tắt | Định danh code | Ghi chú | Nguồn |
|---|---|---|---|---|---|
| Bảng Kanban | Kanban Board | | `kanbanBoard` | | FR-AGL-01 |
| Công việc đang thực hiện | Work in Progress | WIP | `workInProgress` | | FR-AGL-01 |
| Giai đoạn phát triển nhóm | Team Development Stage | | `teamDevelopmentStage` | Mô hình Tuckman; giá trị: `forming` (Hình thành), `storming` (Xung đột), `norming` (Chuẩn hoá), `performing` (Hiệu quả). PM tự chọn | FR-AGL-02, OI-13 |

## COM & INT — Truyền thông, tích hợp

| Tiếng Việt | English | Viết tắt | Định danh code | Ghi chú | Nguồn |
|---|---|---|---|---|---|
| Kênh truyền thông | Communication Channel | | `communicationChannel` | `n(n − 1) / 2` | FR-COM-01 |
| Hệ thống hoạch định nguồn lực doanh nghiệp | Enterprise Resource Planning | ERP | `erp` | Viết tắt phổ biến, dùng làm định danh được | FR-INT-01, OI-10 |
