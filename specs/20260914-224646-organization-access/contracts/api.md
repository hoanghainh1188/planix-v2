# Contract — HTTP API (organization-access)

**Nguồn**: [spec.md](../spec.md) · [authorization.md](authorization.md) · [data-model.md](../data-model.md)

Quy ước chung:
- JSON, prefix `/api/v1`. Cookie phiên `HttpOnly; Secure; SameSite=Lax`; mọi request thay đổi trạng thái gửi
  header `X-CSRF-Token` khớp cookie CSRF. Cookie CSRF được cấp ở `GET /auth/session` **kể cả khi chưa đăng nhập**
  (trả 401 nhưng vẫn đặt cookie); route chưa đăng nhập (`/auth/login`, `/auth/password-reset/*`,
  `/invitations/*/accept`) kiểm thêm header `Origin` khớp `APP_BASE_URL` (research R4).
- Thời điểm: chuỗi ISO 8601 UTC (`2026-09-14T16:30:00Z`). Tiền/chỉ số (feature sau): chuỗi thập phân.
- Lỗi: `{ "error": { "code": "<MÃ>", "params": { ... } } }` — **không có câu chữ hiển thị** (web dịch theo mã).
- Mọi route tổ chức dùng **tổ chức đang hoạt động** trong phiên; không nhận `organizationId` từ client.
- Cột "Action" = mã trong [authorization.md](authorization.md); `—` = không cần phiên tổ chức.

## Xác thực và phiên

| Method | Path | Action | Body | Thành công | Lỗi chính |
|---|---|---|---|---|---|
| POST | `/auth/login` | — | `{ email, password }` | 200 `{ user, memberships[], activeOrganizationId }` + cookie | 401 `AUTH_INVALID_CREDENTIALS` (chung cho sai email/mật khẩu/đang khoá — FR-008), 429 `RATE_LIMITED` |
| POST | `/auth/logout` | — | — | 204, huỷ phiên | 401 |
| GET | `/auth/session` | — | — | 200 `{ user, memberships[], activeOrganizationId }` | 401 `AUTH_REQUIRED` |
| PUT | `/auth/session/active-organization` | — | `{ organizationId }` | 200; ghi audit | 404 `RESOURCE_NOT_FOUND` (không là membership active) |
| POST | `/auth/password-reset/request` | — | `{ email }` | **202 luôn** (email có hay không — FR-008) | 429 |
| POST | `/auth/password-reset/confirm` | — | `{ token, newPassword }` | 204; huỷ mọi phiên | 400 `PASSWORD_POLICY_VIOLATION { rule }`, 410 `TOKEN_INVALID_OR_EXPIRED` |
| PATCH | `/me` | — | `{ locale?, timeZone? }` | 200 | 400 `VALIDATION_FAILED` |

- `memberships[]`: `{ organizationId, organizationName, status, roles[] }` — chỉ tổ chức của chính user.
- `activeOrganizationId` sau đăng nhập: đúng 1 membership active → tổ chức đó; nhiều → `app_user.last_active_organization_id`
  nếu còn active, không thì `null` (web hiển thị bộ chọn); không có membership active → `null`. Chuyển tổ chức cập
  nhật `last_active_organization_id`.
- `PASSWORD_POLICY_VIOLATION.rule`: `MIN_LENGTH_12` \| `COMMON_PASSWORD`.
- Đăng nhập khi `locked_until` còn hiệu lực → vẫn 401 `AUTH_INVALID_CREDENTIALS` (không tiết lộ khoá).

## Lời mời

| Method | Path | Action | Body | Thành công | Lỗi chính |
|---|---|---|---|---|---|
| POST | `/org/invitations` | `org.member.invite` | `{ email, roles?: SystemRole[] }` | 201 `{ invitation }`; gửi email; lời mời pending cũ cùng email bị thu hồi | 409 `ALREADY_MEMBER`, 409 `MEMBER_DEACTIVATED_USE_REACTIVATE` |
| GET | `/org/invitations?status=` | `org.member.invite` | — | 200 `{ items[] }` | |
| DELETE | `/org/invitations/{id}` | `org.member.invite` | — | 204 (revoked) | 404, 409 `INVITATION_NOT_PENDING` |
| GET | `/invitations/{token}` | — | — | 200 `{ organizationName, email, requiresAccountCreation }` | 410 `TOKEN_INVALID_OR_EXPIRED` |
| POST | `/invitations/{token}/accept` | — | Chưa có tài khoản: `{ password }`; đã có: cần phiên đăng nhập đúng email | 200 + cookie phiên, active org = tổ chức mời | 400 `PASSWORD_POLICY_VIOLATION`, 403 `INVITATION_EMAIL_MISMATCH`, 410 `TOKEN_INVALID_OR_EXPIRED` |

- `roles` mặc định `["member"]`. `invitation`: `{ id, email, roles[], status, expiresAt, invitedBy }` —
  **không bao giờ** trả token.

## Thành viên tổ chức và vai trò

| Method | Path | Action | Body | Thành công | Lỗi chính |
|---|---|---|---|---|---|
| GET | `/org/members?status=` | `org.member.read` | — | 200 `{ items: [{ membershipId, userId, email, status, roles[] }] }` | |
| PUT | `/org/members/{membershipId}/roles` | `org.member.role.assign` | `{ roles: SystemRole[] }` (≥ 1) | 200; audit before/after | 409 `LAST_ADMIN_REQUIRED` (FR-014), 404 |
| POST | `/org/members/{membershipId}/deactivate` | `org.member.deactivate` | — | 200; gỡ project member + RACI | 409 `LAST_ADMIN_REQUIRED`, 409 `ACCOUNTABLE_REQUIRED { projectIds[] }` |
| POST | `/org/members/{membershipId}/reactivate` | `org.member.reactivate` | — | 200; `roles = ["member"]`, không project member | 409 `MEMBERSHIP_NOT_DEACTIVATED` |

## Dự án, thành viên dự án, RACI

| Method | Path | Action | Body | Thành công | Lỗi chính |
|---|---|---|---|---|---|
| POST | `/projects` | `project.create` | `{ name, description? }` | 201 `{ project, accountable }` (người tạo là member + Accountable) | 400 `VALIDATION_FAILED` |
| GET | `/projects` | `project.list` | — | 200 `{ items[] }` — chỉ dự án mình là thành viên active | |
| GET | `/projects/{projectId}` | `project.read` | — | 200 `{ project, accountable }` | 404, 403 `FORBIDDEN` |
| GET | `/projects/{projectId}/members` | `project.read` | — | 200 `{ items: [{ projectMemberId, membershipId, email, raciRoles[] }] }` | |
| POST | `/projects/{projectId}/members` | `project.member.manage` | `{ membershipId }` | 201 | 404 (membership không thuộc tổ chức / không active), 409 `ALREADY_PROJECT_MEMBER` |
| DELETE | `/projects/{projectId}/members/{projectMemberId}` | `project.member.manage` | — | 204 (removed, gỡ RACI) | 409 `ACCOUNTABLE_REQUIRED` |
| PUT | `/projects/{projectId}/members/{projectMemberId}/raci` | `project.raci.manage` | `{ raciRoles: ("responsible"\|"consulted"\|"informed")[] }` | 200 — chỉ thay R/C/I, **giữ nguyên** Accountable nếu người đó đang giữ | 400 `VALIDATION_FAILED` (có `accountable`) |
| PUT | `/projects/{projectId}/accountable` | `project.raci.manage` | `{ projectMemberId }` | 200 `{ previous, current }`; thay thế 1 bước; audit | 404, 409 `NOT_PROJECT_MEMBER` |

- Accountable chỉ đổi qua `PUT /accountable` (thay thế); endpoint `/raci` không nhận `accountable` để không thể
  gỡ trống.

## Platform Operator (`/platform/*` — guard riêng, không có tổ chức đang hoạt động)

| Method | Path | Body | Thành công | Lỗi chính |
|---|---|---|---|---|
| POST | `/platform/organizations` | `{ name, firstAdminEmail }` | 201 `{ organization, invitation }` (lời mời `roles=["admin"]`) | 403 `FORBIDDEN` (không phải Operator) |
| GET | `/platform/organizations` | — | 200 `{ items: [{ id, name, status, createdAt, activeAdminCount }] }` — **không** trả dữ liệu dự án/thành viên | |
| POST | `/platform/organizations/{id}/admin-invitations` | `{ email }` | 201 (gửi lại lời mời Admin) | 404 |

## Mã lỗi (web phải có bản dịch vi + en cho toàn bộ)

`AUTH_REQUIRED`, `AUTH_INVALID_CREDENTIALS`, `RATE_LIMITED`, `CSRF_INVALID`, `ACTIVE_ORGANIZATION_REQUIRED`,
`MEMBERSHIP_INACTIVE`, `FORBIDDEN`, `RESOURCE_NOT_FOUND`, `VALIDATION_FAILED`, `PASSWORD_POLICY_VIOLATION`,
`TOKEN_INVALID_OR_EXPIRED`, `INVITATION_EMAIL_MISMATCH`, `INVITATION_NOT_PENDING`, `ALREADY_MEMBER`,
`MEMBER_DEACTIVATED_USE_REACTIVATE`, `MEMBERSHIP_NOT_DEACTIVATED`, `LAST_ADMIN_REQUIRED`,
`ACCOUNTABLE_REQUIRED`, `ALREADY_PROJECT_MEMBER`, `NOT_PROJECT_MEMBER`.
