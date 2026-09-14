# Research — organization-access

**Feature**: `005-organization-access` (issue #5) · **Spec**: [spec.md](spec.md) · **Date**: 2026-09-14

Mọi mục "NEEDS CLARIFICATION" của Technical Context được giải ở đây. Phiên bản package kiểm tra trên npm
registry ngày 2026-09-14.

## R1. Tech stack

- **Decision**: TypeScript full-stack monorepo (npm workspaces) — `packages/core`, `apps/server` (NestJS 12),
  `apps/web` (React 19 + Vite 8); PostgreSQL 17 + Drizzle ORM 0.45 + `pg` 8.
- **Rationale**: một ngôn ngữ cho đội nhỏ, schema zod dùng chung server–web, khớp tooling `npm` sẵn có.
  Rủi ro float khống chế bằng 4 ràng buộc Nguyên tắc I.
- **Alternatives considered**: Kotlin + Spring Boot (dự phòng), Python + Django. Chi tiết:
  `docs/04-decisions/2026-09-14-005-tech-stack.md`.

## R2. Phiên bản TypeScript

- **Decision**: pin TypeScript **6.0.x**.
- **Rationale**: `typescript-eslint` 8.70 khai báo peer `typescript >=4.8.4 <6.1.0`; TS 7.0 (latest) chưa được
  hỗ trợ bởi lint toolchain. NestJS dùng decorator + `emitDecoratorMetadata` — ổn định trên 6.0.
- **Alternatives considered**: TS 7.0 (nhanh hơn nhưng vỡ lint gate — Nguyên tắc IV); nâng khi
  `typescript-eslint` hỗ trợ (ghi `docs/05-lessons.md` nếu gặp vấn đề khi nâng).

## R3. Cô lập tổ chức (FR-001–003, FR-017; Nguyên tắc III)

- **Decision**: 2 lớp độc lập.
  1. **Ứng dụng**: mọi repository nhận `TenantContext { organizationId }` bắt buộc làm tham số đầu; không có
     hàm truy vấn dữ liệu nghiệp vụ nào không nhận nó. `TenantContext` chỉ được dựng từ phiên đăng nhập
     (tổ chức đang hoạt động đã kiểm tra membership).
  2. **Database**: PostgreSQL Row-Level Security trên mọi bảng có `organization_id`, policy
     `organization_id = current_setting('app.organization_id')::uuid`. Mỗi request chạy trong transaction
     `SET LOCAL app.organization_id`. Ứng dụng kết nối bằng role `planix_app` **không** là owner bảng và
     không có `BYPASSRLS`; migration chạy bằng role owner riêng.
- **Rationale**: lỗi quên điều kiện `WHERE` ở tầng ứng dụng vẫn bị RLS chặn; test cô lập chạy trên PostgreSQL
  thật (Testcontainers) chứng minh cả hai lớp.
- **Phản hồi "không tồn tại" (FR-003)**: truy vấn đã lọc theo tổ chức → đối tượng của tổ chức khác đơn giản
  là không tìm thấy → cùng mã `404 RESOURCE_NOT_FOUND`.
- **Lối truy cập ngoài tổ chức đang hoạt động** (bổ sung sau `/speckit-analyze` C1, C4) — mỗi lối là một cơ chế hẹp,
  có test chứng minh không đọc được gì ngoài phạm vi:
  1. **Membership của chính user** (đăng nhập, `GET /auth/session`, chọn tổ chức): `withUserTransaction(userId)` chạy
     `SET LOCAL app.user_id`; policy **chỉ SELECT** `user_id = app_current_user_id()` trên `organization_membership`,
     `membership_role` (qua membership) và `organization` (chỉ khi có membership của user). Không mở INSERT/UPDATE.
  2. **Tra lời mời theo token** (chưa có phiên): hàm `SECURITY DEFINER app_find_invitation_by_token_hash(bytea)` chỉ trả
     `id, organization_id, email, roles, status, expires_at` và tên tổ chức; mọi thao tác tiếp theo chạy trong
     `withTenantTransaction` của `organization_id` đó.
  3. **Platform Operator** (`/platform/*`): role DB riêng `planix_platform` (pool `DATABASE_URL_PLATFORM`) có quyền trên
     `organization`, `platform_operator_grant`, INSERT `organization_invitation`, và hàm `app_count_active_admins(uuid)`;
     **không** có quyền trên `project`, `project_member`, `raci_assignment`, đọc `audit_entry`.
  4. **`audit_entry` với `organization_id` NULL** (sự kiện tài khoản/nền tảng): policy INSERT
     `WITH CHECK (organization_id IS NULL OR organization_id = app_current_organization_id())`; SELECT chỉ theo tổ chức;
     bản ghi NULL chỉ đọc bằng role owner (vận hành).
- **Alternatives considered**: schema-per-tenant (vận hành nặng với 500+ tổ chức, migration phức tạp);
  database-per-tenant (quá nặng cho v1); chỉ lọc ở ứng dụng (một lỗi = lộ dữ liệu); cho `planix_app` BYPASSRLS ở các
  luồng đặc biệt (mất lớp chắn thứ hai đúng ở các luồng rủi ro nhất).

## R4. Xác thực và phiên (FR-005–008, FR-031; decision password/session)

- **Decision**:
  - Phiên **phía server** (bảng `auth_session`), cookie `HttpOnly; Secure; SameSite=Lax`, id ngẫu nhiên 256-bit,
    DB lưu **băm SHA-256** của id. Hết hạn khi `last_seen_at` quá 8 giờ; không có "ghi nhớ đăng nhập".
  - Vô hiệu hoá tài khoản/thành viên → kiểm tra trạng thái ở **mỗi** request (không cache quyền) nên có hiệu
    lực từ yêu cầu kế tiếp (SC-004). Đặt lại mật khẩu → xoá mọi `auth_session` của user.
  - Mật khẩu: argon2id (tham số mặc định OWASP), ≥ 12 ký tự, chặn danh sách mật khẩu phổ biến đóng gói sẵn
    (offline, không gọi dịch vụ ngoài).
  - Chống đoán: bộ đếm sai theo tài khoản (5 lần → khoá 15 phút) + giới hạn tần suất theo IP cho
    `/auth/*` (`@nestjs/throttler`).
  - CSRF: `SameSite=Lax` + token double-submit cho mọi request thay đổi trạng thái. Cookie CSRF cấp ở
    `GET /auth/session` kể cả khi chưa đăng nhập; route chưa đăng nhập kiểm thêm `Origin` khớp `APP_BASE_URL` (chống
    login CSRF).
  - Tổ chức đang hoạt động sau đăng nhập: 1 membership active → tự chọn; nhiều → `app_user.last_active_organization_id`
    nếu còn active, không thì để người dùng chọn.
  - Token lời mời / đặt lại mật khẩu: 256-bit ngẫu nhiên, lưu băm, hạn 7 ngày / 1 giờ, dùng một lần, chỉ bản
    mới nhất còn hiệu lực; không bao giờ ghi log.
- **Rationale**: phiên server thu hồi được ngay (FR-007, FR-015) — JWT không thu hồi được nếu không thêm
  denylist. Không lộ email tồn tại (FR-008): mọi phản hồi auth dùng thông điệp chung và thời gian xử lý tương
  đương (luôn băm mật khẩu kể cả khi không có user).
- **Alternatives considered**: JWT stateless (khó thu hồi); dịch vụ auth ngoài (Auth0/Keycloak — thêm hạ tầng,
  khó cô lập theo tổ chức, v1 chưa cần SSO).

## R5. Mô hình phân quyền (FR-011–016, FR-022–024; decisions ma trận quyền, đa vai trò)

- **Decision**: logic quyết định quyền là **hàm thuần trong `packages/core`** (không I/O):
  `decide(principal, action, target) → Allow | Deny(reason)`.
  - Ma trận quyền (FR-013) là **dữ liệu hằng** trong core: `Record<Action, readonly SystemRole[]>`.
  - `principal` = tập vai trò của membership trong tổ chức đang hoạt động (union — decision đa vai trò).
  - Action cấp dự án (`project.*`) còn yêu cầu `target.projectMembership` đang hoạt động; action nào yêu cầu
    RACI thì khai báo `requiresRaci`.
  - Action không có trong ma trận → `Deny(ACTION_NOT_DECLARED)`; không có ngoại lệ Admin.
  - Server gọi `decide` qua một guard NestJS cho **mọi** route (route không khai báo action → bị từ chối lúc
    khởi động ứng dụng — kiểm bằng test).
- **Rationale**: hàm thuần → test bảng quyết định đầy đủ nhanh (SC-002), dùng lại cho phân hệ sau; không phụ
  thuộc framework.
- **Alternatives considered**: CASL/Casbin (thêm DSL, khó truy vết với ma trận trong decision record);
  kiểm tra rải rác trong service (dễ sót — vi phạm Nguyên tắc II).

## R6. Bảo vệ field nhạy cảm (FR-025–026; Nguyên tắc III)

- **Decision**: schema phản hồi zod được đánh dấu field nhạy cảm bằng metadata
  `sensitive(permission)` trong `packages/core/src/shared/sensitive-field`. Một **response interceptor** duy
  nhất ở server lọc response theo schema: field nhạy cảm bị **xoá khoá** (không trả `null`) khi principal
  thiếu quyền; áp cho chi tiết, danh sách, export và body lỗi. Request schema đánh dấu tương tự → ghi vào
  field nhạy cảm khi thiếu quyền → `403`.
- **Chứng minh (FR-026)**: một DTO mẫu chỉ tồn tại trong test (`SampleFinancialDto.budgetAtCompletion`), không
  thêm field nghiệp vụ giả vào sản phẩm.
- **Rationale**: lọc tập trung ở một điểm, không phụ thuộc từng controller nhớ lọc.
- **Alternatives considered**: `class-transformer` groups (gắn với class, dễ quên group ở route mới);
  lọc ở web (vi phạm "ẩn trên UI là không đủ").

## R7. Accountable duy nhất (FR-020–021; decision single Accountable)

- **Decision**: ràng buộc ở 2 lớp: domain core (`RaciAssignment` bất biến: đúng 1 A) và DB
  (partial unique index `WHERE raci_role = 'accountable'` + transaction thay thế một bước). Tạo dự án tạo luôn
  bản ghi Accountable cho người tạo trong cùng transaction. Gỡ / xoá thành viên / vô hiệu hoá khi là Accountable
  → `409 ACCOUNTABLE_REQUIRED`.
- **Rationale**: race condition giữa 2 PM đổi Accountable đồng thời vẫn giữ đúng 1 nhờ unique index.

## R8. Nhật ký kiểm toán (FR-027–028)

- **Decision**: bảng `audit_entry` append-only; role `planix_app` chỉ có `INSERT`/`SELECT`, không có
  `UPDATE`/`DELETE`. Ghi trong cùng transaction với thay đổi. Giá trị trước/sau đi qua cùng bộ lọc field nhạy
  cảm + danh sách khoá cấm (`password`, `token`, `tokenHash`). Lần bị từ chối quyền trên dữ liệu dự án ghi
  với `outcome = denied`.

## R9. i18n và thời gian (FR-029–030)

- **Decision**: server không trả câu chữ hiển thị — chỉ mã lỗi ổn định (`AUTH_INVALID_CREDENTIALS`…) +
  tham số. Web có `apps/web/src/i18n/{vi,en}.json`; test Vitest so tập khoá `vi` = `en` và mọi mã lỗi của
  contract có bản dịch (FR-029 "phát hiện trước khi phát hành"). Cột thời gian `timestamptz`, server chạy
  `TZ=UTC`; web định dạng bằng `Intl.DateTimeFormat` theo `user.timeZone` (IANA). Ngôn ngữ và múi giờ lưu ở
  `app_user`.

## R10. Email

- **Decision**: cổng `MailSender` (interface) ở server; dev/test dùng **Mailpit** (container) để test đọc email
  lời mời / đặt lại mật khẩu; nhà cung cấp production chọn khi chốt mục Deploy (`CLAUDE.md`). Email đa ngôn ngữ
  theo ngôn ngữ người nhận (lời mời: ngôn ngữ của người mời).

## R11. Platform Operator (FR-004; decision organization creation)

- **Decision**: bảng `platform_operator_grant(user_id)`; route riêng `/platform/*` với guard riêng, **không**
  dựng `TenantContext`. Operator chỉ có action `platform.organization.create|list|update-status` và
  `platform.invitation.admin.create|resend|revoke`. Cấp quyền Operator bằng **CLI vận hành**
  (`npm run ops:grant-operator`), không có UI.
- **Rationale**: tách principal nền tảng khỏi principal tổ chức → không thể vô tình đọc dữ liệu tổ chức.

## R12. Hiệu năng (SC-006; OI-14)

- **Decision**: tải quyền theo request bằng 1 truy vấn gộp (membership + roles + project membership) có index
  `(organization_id, user_id)`; không cache ở v1 (cần hiệu lực ngay — SC-004). Kiểm bằng test tải k6 hoặc
  autocannon ở quickstart: 200 người dùng đồng thời, p95 < 1 giây cho các thao tác của feature.

## R13. Coverage và lint gate

- **Decision**: `vitest --coverage` với ngưỡng **80%** (lines/branches/functions) cho `packages/core` và
  `apps/server/src/features/**`; CI fail nếu dưới ngưỡng. ESLint rule tuỳ chỉnh `planix/no-number-money`
  (Nguyên tắc I ràng buộc 4) có test RuleTester — feature này chưa có tiền nhưng rule được dựng cùng nền móng.

## R14. Log ứng dụng (constitution Nguyên tắc III — bổ sung sau `/speckit-analyze` C3)

- **Decision**: log có cấu trúc JSON qua một `AppLogger` duy nhất ở `apps/server/src/shared/logging/`; request log
  **không ghi body** mặc định; danh sách che (`[REDACTED]`) gồm khoá `password`, `newPassword`, `token`, `tokenHash`,
  `passwordHash`, header `cookie`, `set-cookie`, `x-csrf-token`, path `/invitations/{token}` được che phần token, và mọi
  field đánh dấu `sensitive`. Lỗi 500 log stack nhưng không log body/params.
- **Rationale**: audit đã lọc (R8) nhưng log ứng dụng là đường rò rỉ phổ biến nhất của mật khẩu và token.
- **Alternatives considered**: tắt hẳn request log (mất khả năng điều tra sự cố).
