# Contract — Authorization (dùng chung cho mọi phân hệ)

**Nguồn**: FR-011–016, FR-020–025 · decisions `2026-09-14-005-phase1-permission-matrix`,
`2026-09-14-005-multiple-system-roles`, `2026-09-14-005-single-accountable-per-project` · research R5–R7.

Đây là **giao diện ổn định** mà các feature sau (TASK, RES, WBS, SCH, CHG…) dùng lại. Thay đổi chữ ký hoặc
ngữ nghĩa ở đây = thay đổi phá vỡ, phải cập nhật decision record.

## 1. Mã action giai đoạn 1

Ma trận là dữ liệu hằng trong `packages/core`. Cột "Cấp" = `org` (chỉ cần vai trò) hoặc `project` (vai trò
**và** là thành viên dự án đang hoạt động — FR-022).

| Action | Cấp | admin | portfolioLead | projectManager | functionalManager | member | finance |
|---|---|---|---|---|---|---|---|
| `org.member.invite` | org | ✓ | | | | | |
| `org.member.role.assign` | org | ✓ | | | | | |
| `org.member.deactivate` | org | ✓ | | | | | |
| `org.member.reactivate` | org | ✓ | | | | | |
| `org.member.read` | org | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `project.create` | org | | ✓ | ✓ | | | |
| `project.list` | org | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `project.read` | project | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `project.member.manage` | project | | | ✓ | | | |
| `project.raci.manage` | project | | | ✓ | | | |
| `module.task.access` | project | | ✓ | ✓ | ✓ | ✓ | |
| `module.wbs.access` | project | | ✓ | ✓ | ✓ | ✓ | |
| `module.schedule.access` | project | | ✓ | ✓ | ✓ | ✓ | |
| `module.resource.access` | project | | ✓ | ✓ | ✓ | | |
| `sensitive.financial.read` | project | | ✓ | ✓ | | | ✓ |
| `sensitive.financial.write` | project | | ✓ | ✓ | | | ✓ |

- `project.list` chỉ trả **dự án mà principal là thành viên đang hoạt động** (Admin không có ngoại lệ — FR-016).
- `org.member.read`: danh sách thành viên tổ chức cần cho việc chọn thành viên dự án; không kèm dữ liệu dự án.
- `module.*` được khai báo sẵn cho feature sau; feature sau thêm action chi tiết (VD `task.update`) vào ma trận
  qua decision record, không sửa ngữ nghĩa action đã có.
- Action của Platform Operator (`platform.*`) tách riêng, xem [api.md](api.md) §Platform — không đi qua hàm
  `decide` của tổ chức.

## 2. Hàm quyết định

```text
decide(principal: Principal, action: Action, target: Target) -> Decision

Principal = { userId, organizationId, membershipStatus: 'active' | 'deactivated',
              roles: ReadonlySet<SystemRole> }
Target    = { kind: 'organization' }
          | { kind: 'project', projectId, projectMembership: 'active' | 'none',
              raciRoles: ReadonlySet<RaciRole> }
Decision  = { allowed: true }
          | { allowed: false, reason: DenyReason }
DenyReason = 'MEMBERSHIP_INACTIVE' | 'ACTION_NOT_DECLARED' | 'ROLE_NOT_PERMITTED'
           | 'NOT_PROJECT_MEMBER' | 'RACI_ROLE_REQUIRED'
```

**Thứ tự đánh giá** (dừng ở điều kiện đầu tiên sai):
1. `membershipStatus !== 'active'` → `MEMBERSHIP_INACTIVE`
2. `action` không có trong ma trận → `ACTION_NOT_DECLARED`
3. `roles ∩ allowedRoles(action) = ∅` → `ROLE_NOT_PERMITTED` (roles là hợp — nhiều vai trò)
4. action cấp `project` và `projectMembership !== 'active'` → `NOT_PROJECT_MEMBER`
5. action khai báo `requiresRaci` và `raciRoles ∩ requiredRaci = ∅` → `RACI_ROLE_REQUIRED`
6. → `allowed: true`

**Bất biến** (có test bảng quyết định đầy đủ — SC-002):
- Hàm thuần, không I/O, không phụ thuộc thời gian.
- Không có nhánh đặc biệt cho `admin`.
- Mọi tổ hợp không được ma trận cho phép → `allowed: false`.

## 3. Ánh xạ HTTP

| Kết quả | HTTP | Mã lỗi |
|---|---|---|
| Không có phiên | 401 | `AUTH_REQUIRED` |
| Chưa chọn tổ chức đang hoạt động | 409 | `ACTIVE_ORGANIZATION_REQUIRED` |
| `MEMBERSHIP_INACTIVE` | 403 | `MEMBERSHIP_INACTIVE` |
| `ROLE_NOT_PERMITTED`, `ACTION_NOT_DECLARED`, `RACI_ROLE_REQUIRED` | 403 | `FORBIDDEN` |
| `NOT_PROJECT_MEMBER` trên dự án cùng tổ chức | 403 | `FORBIDDEN` |
| Đối tượng thuộc tổ chức khác hoặc không tồn tại | 404 | `RESOURCE_NOT_FOUND` (FR-003) |

- Mọi route server **phải** khai báo đúng một `Action`; route thiếu khai báo làm ứng dụng không khởi động được
  (test bắt buộc).
- Lần từ chối trên dữ liệu dự án ghi `audit_entry` với `outcome = denied` (FR-027).

## 4. Tra cứu Accountable (FR-021)

```text
getAccountable(tenant: TenantContext, projectId) -> { projectMemberId, userId }
isAccountable(tenant: TenantContext, projectId, userId) -> boolean
```

- Luôn có đúng một kết quả cho dự án tồn tại trong tổ chức (decision single Accountable); dự án không tồn tại /
  khác tổ chức → lỗi `RESOURCE_NOT_FOUND`, không trả "chưa có".
- Phân hệ Change Control (sau) dùng `isAccountable` để kiểm tra người áp dụng Baseline (OI-07).

## 5. Field nhạy cảm (FR-025)

```text
sensitive(permission: 'sensitive.financial.read', writePermission?: 'sensitive.financial.write')
  -> đánh dấu 1 field trong schema response/request
```

- Response: field bị **xoá khoá** khi `decide(principal, permission, target).allowed === false`; áp cho chi tiết,
  danh sách, export, body lỗi và `audit_entry.before/after`.
- Request: có giá trị cho field nhạy cảm mà thiếu `writePermission` → `403 FORBIDDEN`, không ghi gì.
- Field nhạy cảm dự kiến ở feature sau: `billingRate` (RES), `budgetAtCompletion` (EVM) — theo glossary 🔒.
