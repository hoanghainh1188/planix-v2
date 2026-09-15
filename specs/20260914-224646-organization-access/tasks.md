---

description: "Task list for organization-access (issue #5)"
---

# Tasks: Quản lý tổ chức và phân quyền truy cập (organization-access)

**Input**: Design documents from `specs/20260914-224646-organization-access/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md),
[contracts/api.md](contracts/api.md), [contracts/authorization.md](contracts/authorization.md), [quickstart.md](quickstart.md)

**Tests**: BẮT BUỘC — constitution Nguyên tắc IV (TDD). Mỗi nhóm chức năng có task **RED** (viết test, chạy
thấy FAIL) đứng trước task **GREEN** (cài đặt tối thiểu cho test xanh). Không được bắt đầu task GREEN khi test
RED tương ứng chưa tồn tại và chưa fail.

**Organization**: Nhóm theo user story. Thứ tự phase theo **phụ thuộc dữ liệu** trong cùng mức ưu tiên (xem
§Dependencies): US2 → US3 → US1 → US4 → US6 → US5 → US7 → US8.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: chạy song song được (khác file, không phụ thuộc task chưa xong)
- **[Story]**: user story trong spec (US1…US8)
- Truy vết: `FR-xxx` / `SC-xxx` (spec) · `Qn` (quickstart) · `Rn` (research)

## Path Conventions (plan.md → Project Structure)

- `packages/core/src/{shared,features/organization-access}/` — domain thuần, không import NestJS/DB/React
- `apps/server/src/{shared,features/organization-access,ops,test}/`, migration `apps/server/drizzle/`
- `apps/web/src/{shared,i18n,features/organization-access}/`, E2E `apps/web/e2e/`
- Test đặt cạnh code: `*.test.ts` (unit), `*.integration.test.ts` (PostgreSQL thật qua Testcontainers)
- Viết tắt: `FEAT_CORE` = `packages/core/src/features/organization-access`,
  `FEAT_SRV` = `apps/server/src/features/organization-access`, `FEAT_WEB` = `apps/web/src/features/organization-access`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dựng monorepo, toolchain, gate chất lượng

- [X] T001 Xoá thư mục rỗng của template: `git rm src/.gitkeep tests/.gitkeep` (thư mục `src/`, `tests/` ở root không còn dùng — plan.md Structure Decision)
- [X] T002 Tạo `package.json` root: npm workspaces `["packages/*","apps/*","tools/*"]`, `"engines": {"node": ">=24"}`, devDependency `typescript` **`~6.0.3`** (pin `<6.1` — R2), scripts `lint`, `test`, `build`, `dev`, `db:migrate`, `ops:grant-operator`, `perf:org-access`
- [X] T003 [P] Tạo `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `module`/`moduleResolution` `NodeNext`, `target` `ES2024`
- [X] T004 [P] Scaffold `packages/core/{package.json,tsconfig.json,src/index.ts}` — dependency `zod@^4`, `decimal.js@^10`; **không** có dependency NestJS/pg/React
- [X] T005 [P] Scaffold `apps/server/{package.json,tsconfig.json,src/main.ts,src/app.module.ts}` — NestJS 12 (Express), `drizzle-orm@^0.45`, `pg@^8`, `argon2`, `express-rate-limit@^8`, `helmet`; `tsconfig` bật `experimentalDecorators` + `emitDecoratorMetadata`; `main.ts` dừng khởi động nếu `process.env.TZ !== 'UTC'`
- [X] T006 [P] Scaffold `apps/web/{package.json,tsconfig.json,vite.config.ts,index.html,src/main.tsx}` — React 19, Vite 8, React Router 7, TanStack Query 5, i18next 26, react-i18next 17; dev proxy `/api` → `http://localhost:3000`
- [X] T007 Tạo `vitest.config.ts` với `test.projects` (core, server, web — Vitest ≥ 4 bỏ file workspace) + `@vitest/coverage-v8`: ngưỡng **80%** lines/branches/functions/statements, `include` = `packages/core/src/**`, `apps/server/src/features/**`, `apps/server/src/shared/**`; `exclude` = `**/*.test.ts`, `apps/server/src/test/**`, `apps/server/src/ops/**`; `npm run test` fail khi dưới ngưỡng (Nguyên tắc IV, R13)
- [X] T008 [P] **RED** RuleTester cho rule `planix/no-number-money` trong `tools/eslint-plugin-planix/src/rules/no-number-money.test.ts`: *invalid* — khai báo kiểu `number` cho biến/thuộc tính có tên thuộc option `moneyIdentifiers` (mặc định: `billingRate`, `budgetAtCompletion`, `actualCost`, `laborActualCost`, `nonLaborActualCost`, `plannedValue`, `earnedValue`, `estimateAtCompletion`, `estimateToComplete`, `costVariance`, `scheduleVariance`, `presentValue`, `futureValue`, `netPresentValue`, `ceilingPrice`, `targetPrice`, `targetCost`, `expectedMonetaryValue`, `amount`, `price`, `cost`); gọi `parseFloat`/`Number()`/unary `+` trong file khớp option `financialFileGlobs`; toán tử `+ - * /` khi một vế là identifier tiền; *valid* — cùng tên nhưng kiểu `Decimal`, thao tác qua method `Decimal` (Nguyên tắc I ràng buộc 4)
- [X] T009 **GREEN** Cài rule `tools/eslint-plugin-planix/src/rules/no-number-money.ts` + `tools/eslint-plugin-planix/{package.json,src/index.ts}` cho T008 xanh
- [X] T010 Tạo `eslint.config.js` (ESLint 10 flat config + typescript-eslint 8 type-checked + plugin `planix` với `no-number-money: error` + `eslint-plugin-react-hooks`) và `.prettierrc.json` (Prettier 3)
- [X] T011 [P] Tạo `docker-compose.yml`: `postgres:17` (db `planix`, role owner `planix_owner`), `axllent/mailpit` (SMTP 1025, UI 8025); tạo `.env.example` chỉ chứa **tên** biến (`DATABASE_URL_APP`, `DATABASE_URL_OWNER`, `DATABASE_URL_PLATFORM`, `SMTP_URL`, `APP_BASE_URL`) — không có giá trị bí mật
- [X] T012 [P] Bật format-on-save trong `.claude/hooks/format.sh`: đọc `.tool_input.file_path` từ STDIN (jq), với đuôi `ts|tsx|js|json|md|css|yaml|yml` chạy `npx --no-install prettier --write "$FILE"`; bỏ `exit 0` mặc định; file không khớp → thoát 0
- [X] T013 [P] Tạo `.github/workflows/ci.yml` job `quality-gate`: Node 24, `npm ci`, `npm run lint`, `npm run test -- --coverage` (Docker có sẵn cho Testcontainers), `npm run build`, env `TZ=UTC`

**Checkpoint**: `npm run lint`, `npm run test`, `npm run build` chạy được trên monorepo rỗng; RuleTester xanh.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: phần dùng chung mà mọi story phụ thuộc — glossary (trước khi đặt tên), Decimal, mã lỗi, ma trận quyền + `decide()`, TenantContext
+ RLS + lối truy cập vượt tổ chức, log che dữ liệu nhạy cảm, schema định danh/dự án, phiên đăng nhập, guard Action, interceptor field nhạy cảm, audit, mail, i18n web.

**⚠️ CRITICAL**: Không bắt đầu user story nào trước khi phase này xong.

### Thuật ngữ (Nguyên tắc VI — làm trước mọi task đặt tên)

- [X] T014 Append thuật ngữ mới vào `docs/00-glossary.md` **trước mọi task đặt tên trong code** (Nguyên tắc VI — sửa sau `/speckit-analyze` D1), mỗi dòng đủ cột Tiếng Việt / English / Viết tắt / Định danh code / Ghi chú / Nguồn: Platform Operator `platformOperator`; Organization Membership `organizationMembership`; Membership Role `membershipRole`; Organization Invitation `organizationInvitation`; Session `authSession`; Active Organization `activeOrganization`; Password Reset Token `passwordResetToken`; Audit Entry `auditEntry`; Sensitive Field Policy `sensitiveFieldPolicy`; giá trị role `admin`, `portfolioLead`, `member`, `finance`; chạy `python3 .github/scripts/check-template.py` xanh

### Core (domain thuần)

- [X] T015 [P] **RED** `packages/core/src/shared/decimal/decimal.test.ts`: `Decimal.of(string)` nhận chuỗi thập phân, **từ chối `number`** ở type-level (`// @ts-expect-error`) và runtime; cộng/trừ/nhân/chia giữ ≥ 4 chữ số thập phân; `toString()` không làm tròn; `roundHalfUp(scale)` chỉ dùng cho hiển thị (Nguyên tắc I, decision tech-stack ràng buộc 1)
- [X] T016 **GREEN** `packages/core/src/shared/decimal/decimal.ts` bọc `decimal.js`
- [X] T017 [P] **RED** `packages/core/src/shared/errors/error-codes.test.ts`: tập mã lỗi bằng đúng danh sách trong `contracts/api.md` §Mã lỗi **cộng** `INTERNAL_ERROR`; mỗi mã có HTTP status theo `contracts/authorization.md` §3 và bảng API
- [X] T018 **GREEN** `packages/core/src/shared/errors/error-codes.ts` (const + `httpStatusOf(code)`); đồng thời thêm `INTERNAL_ERROR` (500) vào danh sách mã lỗi trong `specs/20260914-224646-organization-access/contracts/api.md`
- [X] T019 [P] **RED** `FEAT_CORE/permission-matrix.test.ts`: ma trận bằng **đúng** bảng `contracts/authorization.md` §1 — 16 action, cấp `org`/`project`, tập vai trò được phép cho 6 vai trò `admin|portfolioLead|projectManager|functionalManager|member|finance` ; `project.member.manage` = `portfolioLead` + `projectManager`, `project.raci.manage` = chỉ `projectManager` (decision `2026-09-15-005-portfolio-lead-manages-project-members`) (FR-011, FR-013)
- [X] T020 **GREEN** `FEAT_CORE/roles.ts` (`SystemRole`, `RaciRole`) và `FEAT_CORE/permission-matrix.ts` (dữ liệu hằng `Record<Action, {scope, roles, requiresRaci?}>`)
- [X] T021 [P] **RED** `FEAT_CORE/decide.test.ts`: bảng quyết định **đầy đủ** — mọi action × mọi tập con vai trò (hợp — FR-012) × `membershipStatus` × `projectMembership` × `raciRoles`; kiểm thứ tự đánh giá 1→6 và `DenyReason` đúng; không có nhánh riêng cho `admin` (FR-016); action không khai báo → `ACTION_NOT_DECLARED` (FR-022, FR-023, SC-002)
- [X] T022 **GREEN** `FEAT_CORE/decide.ts` — hàm thuần theo `contracts/authorization.md` §2
- [X] T023 [P] **RED** `packages/core/src/shared/sensitive-field/sensitive-field.test.ts`: `sensitive('sensitive.financial.read','sensitive.financial.write')` gắn metadata lên field zod; `stripSensitive(schema, value, can)` **xoá khoá** (không đặt `null`) ở object lồng và mảng; `findSensitiveWrites(schema, input, can)` trả danh sách field bị ghi trái phép (FR-025)
- [X] T024 **GREEN** `packages/core/src/shared/sensitive-field/sensitive-field.ts`
- [X] T025 [P] Tạo `packages/core/src/shared/tenant-context.ts` (`TenantContext { organizationId }` — kiểu brand, chỉ tạo qua hàm `tenantFromVerifiedSession`) và `FEAT_CORE/principal.ts` (`Principal`, `Target`, `Decision` theo `contracts/authorization.md` §2)

### Database, RLS, audit (server)

- [X] T026 Tạo `apps/server/drizzle.config.ts` và `apps/server/src/shared/db/client.ts`: 3 pool — `DATABASE_URL_OWNER` (chỉ migration), `DATABASE_URL_APP` (role `planix_app`) và `DATABASE_URL_PLATFORM` (role `planix_platform`); **không** override type parser `NUMERIC` (1700) để giữ chuỗi (decision tech-stack ràng buộc 3); `withTenantTransaction(tenant, fn)` chạy `SET LOCAL app.organization_id = $1` trong transaction; `withUserTransaction(userId, fn)` chạy `SET LOCAL app.user_id` (R3 lối 1)
- [X] T027 [P] Tạo helper test `apps/server/src/test/postgres.ts` (Testcontainers `postgres:17`, chạy migration bằng owner, trả client `planix_app`), `apps/server/src/test/mailpit.ts` (container + đọc thư qua API Mailpit), `apps/server/src/shared/clock/clock.ts` (`ClockPort` inject được) + `apps/server/src/test/fake-clock.ts`
- [X] T028 Migration `apps/server/drizzle/0001_roles_extensions.sql`: `CREATE EXTENSION citext`; role `planix_app` `NOSUPERUSER NOBYPASSRLS`, không phải owner bảng; function `app_current_organization_id()` đọc `current_setting('app.organization_id', true)::uuid`; function `app_current_user_id()` đọc `app.user_id`; role `planix_platform` `NOSUPERUSER NOBYPASSRLS`
- [X] T029 **RED** `apps/server/src/shared/db/rls.integration.test.ts`: với bảng test có `organization_id` + policy mẫu — `planix_app` không `SET LOCAL` thấy 0 dòng; context org A chỉ thấy dòng A; `INSERT` dòng org B bị `WITH CHECK` từ chối; `numeric` đọc về là `string` (R3)
- [X] T030 **GREEN** Migration `apps/server/drizzle/0002_rls_policy_template.sql` (policy chuẩn `USING/WITH CHECK organization_id = app_current_organization_id()`, áp cho bảng test) và làm T029 xanh
- [X] T031 Migration `apps/server/drizzle/0003_identity_projects.sql` + Drizzle schema `FEAT_SRV/db/schema.ts` theo `data-model.md`, bật RLS cho mọi bảng **(T)**, grant `SELECT/INSERT/UPDATE` (không `DELETE` trừ `membership_role`, `raci_assignment`) cho `planix_app`:
  - `app_user`: `email citext NOT NULL UNIQUE`, `password_hash text NOT NULL`, `locale` "`vi` \| `en`, mặc định `vi`", `time_zone` "IANA tz, mặc định `Asia/Ho_Chi_Minh`", `failed_login_count int NOT NULL DEFAULT 0`, `locked_until timestamptz NULL`, `last_active_organization_id uuid NULL`
  - `platform_operator_grant(user_id PK, granted_at, granted_by text NOT NULL)`
  - `organization`: `name` "NOT NULL, 1–200 ký tự", `status` "`active` \| `suspended`, mặc định `active`", `created_by_operator_id NOT NULL`
  - `organization_membership`: `status` "`active` \| `deactivated`", `deactivated_at NULL`, `UNIQUE (organization_id, user_id)`
  - `membership_role`: `PRIMARY KEY (membership_id, role)`, `role` ∈ 6 vai trò
  - `project`: `name` "NOT NULL, 1–200 ký tự", `description` "NULL, ≤ 5.000 ký tự", `status` "`active` \| `archived`"
  - `project_member`: `status` "`active` \| `removed`", partial `UNIQUE (project_id, membership_id) WHERE status = 'active'`, FK tổ hợp `(organization_id, project_id)` và `(organization_id, membership_id)`
  - `raci_assignment`: `PRIMARY KEY (project_member_id, raci_role)`, `raci_role` ∈ `responsible|accountable|consulted|informed`, partial `UNIQUE (project_id) WHERE raci_role = 'accountable'`
  - `auth_session(id_hash bytea PK, user_id, active_organization_id NULL, csrf_token_hash bytea NOT NULL, created_at, last_seen_at)`
- [X] T032 **RED** `apps/server/src/shared/db/cross-tenant-paths.integration.test.ts`: (lối 1) `withUserTransaction(userA)` SELECT được membership, vai trò, tên tổ chức của chính userA ở **mọi** tổ chức, **không** thấy membership của userB cùng tổ chức, INSERT/UPDATE bị từ chối; (lối 3) `planix_platform` SELECT/INSERT `organization` và gọi `app_count_active_admins(uuid)` được; INSERT `audit_entry` với `actor_kind = 'platformOperator'` được, với `actor_kind` khác bị từ chối; UPDATE `organization` chỉ đổi được cột `status`; SELECT `project`, `project_member`, `raci_assignment`, `audit_entry` bị từ chối; `planix_platform` **không** có `BYPASSRLS` (FR-002, FR-004, R3 — sửa sau `/speckit-analyze` C1, M1)
- [X] T033 **GREEN** Migration `apps/server/drizzle/0005_user_and_platform_access.sql`: policy **chỉ SELECT** theo `app_current_user_id()` cho `organization_membership`, `membership_role`, `organization`; grant + **policy RLS `TO planix_platform`**: `organization` (SELECT, INSERT, UPDATE chỉ cột `status`), `audit_entry` (chỉ INSERT `WITH CHECK (actor_kind = 'platformOperator')`); hàm `SECURITY DEFINER app_count_active_admins(uuid)` chỉ trả số đếm; không cấp `BYPASSRLS` — làm T032 xanh
- [X] T034 [P] **RED** `apps/server/src/shared/audit/audit-writer.integration.test.ts`: ghi trong cùng transaction (rollback → không còn bản ghi); `planix_app` `UPDATE`/`DELETE` `audit_entry` bị từ chối; `before/after` đã xoá field nhạy cảm và khoá cấm `password`, `passwordHash`, `token`, `tokenHash`; `outcome` `succeeded|denied` ; bản ghi `organization_id` NULL (sự kiện đăng nhập) INSERT thành công nhưng `planix_app` không SELECT được (FR-027, FR-028, SC-008, R8, R3 lối 4)
- [X] T035 **GREEN** Migration `apps/server/drizzle/0004_audit_entry.sql` (cột theo `data-model.md` §audit_entry; `organization_id` NULL cho sự kiện tài khoản/nền tảng; chỉ grant `INSERT, SELECT`; policy INSERT `WITH CHECK (organization_id IS NULL OR organization_id = app_current_organization_id())`, SELECT chỉ theo tổ chức) + `apps/server/src/shared/audit/audit-writer.ts`

### HTTP nền tảng (server)

- [X] T036 [P] **RED** `apps/server/src/shared/errors/domain-error.filter.test.ts`: `DomainError(code, params)` → HTTP theo `httpStatusOf`, body **chỉ** `{ "error": { "code", "params" } }` (không `message`); lỗi không xác định → 500 `INTERNAL_ERROR`, không lộ stack
- [X] T037 **GREEN** `apps/server/src/shared/errors/{domain-error.ts,domain-error.filter.ts}`
- [X] T038 [P] **RED** `apps/server/src/shared/logging/redaction.test.ts`: request log của `POST /auth/login`, `POST /auth/password-reset/confirm`, `POST /invitations/{token}/accept` không chứa mật khẩu, token, cookie, `x-csrf-token` (thay bằng `[REDACTED]`, phần token trong path bị che); mặc định không log body; lỗi 500 có stack nhưng không có body/params; field `sensitive` bị che (constitution III, FR-028, R14 — sửa sau `/speckit-analyze` C3)
- [X] T039 **GREEN** `apps/server/src/shared/logging/{app-logger.ts,redaction.ts}` đăng ký làm logger NestJS trong `apps/server/src/main.ts` — làm T038 xanh
- [X] T040 [P] **RED** `apps/server/src/shared/auth/session.guard.integration.test.ts`: không cookie → 401 `AUTH_REQUIRED`; `last_seen_at` quá **8 giờ** (fake clock) → 401 và phiên bị xoá (FR-007, Q13); membership của tổ chức đang hoạt động `deactivated` → 403 `MEMBERSHIP_INACTIVE` và `active_organization_id` bị xoá (SC-004); route tổ chức khi chưa chọn tổ chức → 409 `ACTIVE_ORGANIZATION_REQUIRED`; principal (membership + roles hợp) nạp bằng **1 truy vấn**; request tổ chức chạy trong `withTenantTransaction`; thiếu/sai `X-CSRF-Token` → 403 `CSRF_INVALID`; `GET /auth/session` khi chưa đăng nhập vẫn đặt cookie CSRF; `Origin` lạ trên `POST /auth/login` → 403 `CSRF_INVALID`
- [X] T041 **GREEN** `apps/server/src/shared/auth/{session.guard.ts,principal.loader.ts,session-cookie.ts,csrf.guard.ts}`: cookie `HttpOnly; Secure; SameSite=Lax`, session id 256-bit lưu SHA-256; CSRF double-submit `X-CSRF-Token` cho method thay đổi trạng thái → 403 `CSRF_INVALID`; cookie CSRF cấp ở `GET /auth/session` kể cả khi chưa đăng nhập; route chưa đăng nhập kiểm `Origin` khớp `APP_BASE_URL` (R4)
- [X] T042 [P] `apps/server/src/shared/auth/rate-limit.middleware.ts`: `express-rate-limit` giới hạn theo IP cho `/api/v1/auth/*` và `/api/v1/invitations/*` → 429 `RATE_LIMITED`
- [X] T043 [P] **RED** `apps/server/src/shared/authorization/authorization.guard.test.ts`: controller có route **thiếu** `@RequireAction` → ứng dụng **không khởi động** (lỗi liệt kê route); guard gọi `decide` với principal + target (`organization` hoặc `project` do resolver nạp `projectMembership`, `raciRoles`); `Deny` ánh xạ HTTP đúng `contracts/authorization.md` §3; route `/platform/*` khai báo `@PlatformAction` thay cho `@RequireAction` (FR-022, FR-024)
- [X] T044 **GREEN** `apps/server/src/shared/authorization/{require-action.decorator.ts,platform-action.decorator.ts,authorization.guard.ts,route-action-coverage.ts,project-target.resolver.ts}`
- [X] T045 [P] **RED** `apps/server/src/shared/sensitive-field/sensitive-field.interceptor.test.ts` với `apps/server/src/test/sample-financial.dto.ts` (`SampleFinancialDto.budgetAtCompletion` đánh dấu `sensitive`, **chỉ tồn tại trong test**): có quyền → có khoá; không quyền → không có khoá ở response chi tiết, danh sách, body lỗi; request ghi field nhạy cảm khi thiếu quyền → 403 `FORBIDDEN`, không ghi (FR-025, FR-026)
- [X] T046 **GREEN** `apps/server/src/shared/sensitive-field/{sensitive-field.interceptor.ts,sensitive-write.check.ts,sensitive-field.decorators.ts,sensitive-field.module.ts}` đăng ký global (kiểm tra ghi nằm trong interceptor vì pipe không truy cập được principal)
- [ ] T047 [P] `apps/server/src/shared/mail/{mail-sender.ts,smtp-mail-sender.ts,templates/{vi,en}/*.ts}`: cổng `MailSender`, adapter SMTP (Mailpit ở dev/test); template lời mời, đặt lại mật khẩu theo locale (R10)
- [X] T048 [P] **RED** `apps/server/src/shared/auth/{secure-token.test.ts,password-hasher.test.ts}`: token 256-bit ngẫu nhiên, lưu SHA-256, so sánh constant-time; argon2id; `verifyOrDummy()` băm giả khi không có user để thời gian phản hồi tương đương (FR-008, R4)
- [X] T049 **GREEN** `apps/server/src/shared/auth/{secure-token.ts,password-hasher.ts}` — làm T048 xanh

### Web nền tảng

- [ ] T050 [P] **RED** `apps/web/src/i18n/i18n-completeness.test.ts`: tập khoá `vi.json` = `en.json`; mọi mã trong `packages/core/src/shared/errors/error-codes.ts` có `errors.<CODE>` ở cả hai (FR-029, Q16)
- [ ] T051 **GREEN** `apps/web/src/i18n/{index.ts,vi.json,en.json}` (i18next + react-i18next, ngôn ngữ từ `user.locale`) với bản dịch mọi mã lỗi
- [ ] T052 [P] **RED** `apps/web/src/shared/time/format-date-time.test.ts`: `"2026-09-14T16:30:00Z"` + `Asia/Ho_Chi_Minh` → 23:30 ngày 14/09/2026; không phụ thuộc TZ máy chạy test (FR-030, Q16)
- [ ] T053 **GREEN** `apps/web/src/shared/time/format-date-time.ts` (`Intl.DateTimeFormat`) — làm T052 xanh
- [ ] T054 [P] **RED** `apps/web/src/shared/api/client.test.ts`: gửi `credentials: 'include'` + `X-CSRF-Token`; lỗi server → `ApiError { code, params }`
- [ ] T055 **GREEN** `apps/web/src/shared/api/client.ts` — làm T054 xanh
- [ ] T056 `apps/web/src/app/{App.tsx,router.tsx,session-context.tsx}`: nạp `GET /auth/session`, route bảo vệ, layout có chỗ cho bộ chọn tổ chức

**Checkpoint**: core + nền server + web shell xanh, coverage ≥ 80% cho phần đã có — sẵn sàng làm user story.

---

## Phase 3: User Story 2 — Khởi tạo tổ chức, tạo tài khoản và đăng nhập (Priority: P1) 🎯 MVP

**Goal**: Operator tạo tổ chức + mời Admin đầu tiên; người được mời tạo tài khoản qua lời mời; đăng nhập, khoá
đăng nhập, hết phiên, chọn tổ chức đang hoạt động, quên mật khẩu.

**Independent Test**: Q1 → Q2 (tạo tổ chức, chấp nhận lời mời, đăng nhập là Admin), Q11, Q12, Q13, Q14.

### Tests for User Story 2 (RED — viết trước, phải FAIL) ⚠️

- [ ] T057 [P] [US2] **RED** `FEAT_CORE/password-policy/password-policy.test.ts`: < 12 ký tự → `MIN_LENGTH_12`; có trong danh sách phổ biến → `COMMON_PASSWORD`; 12 ký tự không phổ biến → hợp lệ; không bắt ký tự đặc biệt (FR-006, decision password-and-session-policy)
- [ ] T058 [P] [US2] **RED** `FEAT_CORE/login-lockout.test.ts`: sai lần thứ 5 liên tiếp → `lockedUntil = now + 15 phút`, bộ đếm về 0; đăng nhập đúng khi còn khoá → vẫn từ chối; đăng nhập đúng khi không khoá → bộ đếm về 0 (FR-006, Q12)
- [ ] T059 [P] [US2] **RED** `FEAT_SRV/platform/platform.integration.test.ts`: Operator `POST /api/v1/platform/organizations { name, firstAdminEmail }` → 201 `{ organization, invitation }`, lời mời `roles = ["admin"]`, Mailpit nhận thư; người không phải Operator (kể cả Admin tổ chức khác) → 403; `GET /platform/organizations` chỉ trả `id, name, status, createdAt, activeAdminCount`; `POST /platform/organizations/{id}/admin-invitations` gửi lại; audit `actor_kind = platformOperator`; ở tầng DB, `planix_platform` INSERT lời mời có `roles` khác `{admin}` bị policy từ chối (FR-004, Q1, R3 lối 3)
- [ ] T060 [P] [US2] **RED** `FEAT_SRV/invitations/accept-invitation.integration.test.ts`: `GET /invitations/{token}` → `{ organizationName, email, requiresAccountCreation }`; chấp nhận khi chưa có tài khoản + mật khẩu 11 ký tự → 400 `PASSWORD_POLICY_VIOLATION {rule: MIN_LENGTH_12}`, 12 ký tự hợp lệ → 200 + cookie, tài khoản + membership + roles từ lời mời trong **1 transaction**, tổ chức đang hoạt động = tổ chức mời; token hết hạn **7 ngày** (fake clock) / đã thu hồi / đã dùng → 410 `TOKEN_INVALID_OR_EXPIRED`; tài khoản sẵn có phải đăng nhập đúng email, sai → 403 `INVITATION_EMAIL_MISMATCH`; **không tồn tại** route tự đăng ký ; tra lời mời chỉ qua `app_find_invitation_by_token_hash` — `planix_app` SELECT trực tiếp `organization_invitation` khi không có ngữ cảnh tổ chức trả 0 dòng (R3 lối 2) (FR-005, FR-010, Q2)
- [ ] T061 [P] [US2] **RED** `FEAT_SRV/auth/login.integration.test.ts`: đăng nhập đúng → 200 `{ user, memberships[], activeOrganizationId }` + cookie; sai mật khẩu, email không tồn tại, tài khoản đang khoá → **cùng** 401 `AUTH_INVALID_CREDENTIALS`; 5 lần sai → khoá 15 phút (fake clock) rồi mở; `POST /auth/logout` → 204 phiên bị huỷ; không có tuỳ chọn "ghi nhớ đăng nhập"; audit đăng nhập thành công/thất bại không chứa mật khẩu (FR-006–008, Q12, Q13)
- [ ] T062 [P] [US2] **RED** `FEAT_SRV/auth/active-organization.integration.test.ts`: user thuộc Acme và Beta (Operator tạo Beta với `firstAdminEmail` = email user sẵn có, chấp nhận bằng tài khoản sẵn có) → `PUT /auth/session/active-organization` sang Beta chỉ thấy dữ liệu Beta, vai trò Beta độc lập; tổ chức không phải membership active → 404 `RESOURCE_NOT_FOUND`; audit chuyển tổ chức ; đăng nhập: 1 membership active → tự chọn, nhiều → `last_active_organization_id` nếu còn active, không thì `null`, không có membership active → `null`; chuyển tổ chức cập nhật `last_active_organization_id`; `memberships[]` đọc qua `withUserTransaction` (FR-017, FR-027, Q11)
- [ ] T063 [P] [US2] **RED** `FEAT_SRV/auth/password-reset.integration.test.ts`: `request` với email tồn tại và không tồn tại → **cùng** 202, chỉ email tồn tại có thư; link hết hạn sau **1 giờ** (fake clock); dùng lại → 410; yêu cầu mới làm link cũ vô hiệu (`superseded_at`); `confirm` thành công → 204, **mọi phiên** của user bị huỷ; mật khẩu mới theo FR-006; token không xuất hiện trong log/audit (FR-008, FR-028, FR-031, SC-009, Q14)

### Implementation for User Story 2 (GREEN)

- [ ] T064 [US2] Migration `apps/server/drizzle/0006_invitation_password_reset.sql` + cập nhật `FEAT_SRV/db/schema.ts`:
  - `organization_invitation` **(T)**: `email citext NOT NULL`, `roles text[]` "NOT NULL, ⊆ tập vai trò; mặc định `{member}`", `token_hash bytea NOT NULL UNIQUE`, `status` "`pending` \| `accepted` \| `revoked` \| `expired`", `expires_at` "`created_at + 7 ngày`", `invited_by_user_id NOT NULL`, `invited_by_kind` "`organizationAdmin` \| `platformOperator`", `accepted_at NULL`, partial `UNIQUE (organization_id, email) WHERE status = 'pending'`, RLS; hàm `SECURITY DEFINER app_find_invitation_by_token_hash(bytea)` chỉ trả `id, organization_id, email, roles, status, expires_at, organization_name`; policy RLS `TO planix_platform` chỉ INSERT `organization_invitation` `WITH CHECK (invited_by_kind = 'platformOperator' AND roles = '{admin}')` và UPDATE `status` sang `revoked` cho lời mời Admin
  - `password_reset_token`: `token_hash bytea UNIQUE`, `expires_at` "`created_at + 1 giờ`", `used_at NULL`, `superseded_at NULL`
- [ ] T065 [P] [US2] **GREEN** `FEAT_CORE/password-policy/{password-policy.ts,common-passwords.ts}` (danh sách mật khẩu phổ biến đóng gói offline) cho T057
- [ ] T066 [P] [US2] **GREEN** `FEAT_CORE/login-lockout.ts` cho T058
- [ ] T067 [US2] **GREEN** `FEAT_SRV/platform/{platform.module.ts,platform.controller.ts,platform.service.ts,platform-operator.guard.ts}` theo `contracts/api.md` §Platform — dùng pool `planix_platform`, không dựng `TenantContext`, không đọc bảng dự án/thành viên dự án (R11) cho T059
- [ ] T068 [US2] **GREEN** `FEAT_SRV/invitations/{invitation.repository.ts,invitation.service.ts,accept-invitation.controller.ts}` cho T060 (email gửi qua `MailSender`, token qua `secure-token`)
- [ ] T069 [US2] **GREEN** `FEAT_SRV/auth/{auth.module.ts,auth.controller.ts,auth.service.ts}`: `POST /auth/login`, `POST /auth/logout`, `GET /auth/session`, `PUT /auth/session/active-organization` theo `contracts/api.md` §Xác thực cho T061, T062
- [ ] T070 [US2] **GREEN** `FEAT_SRV/auth/{password-reset.controller.ts,password-reset.service.ts}` cho T063
- [ ] T071 [US2] CLI `apps/server/src/ops/grant-operator.ts` + script `npm run ops:grant-operator -- --email <email>` (tạo `platform_operator_grant`, `granted_by` = user OS, audit `actor_kind = system`) (R11)
- [ ] T072 [P] [US2] Web `FEAT_WEB/login/LoginPage.tsx` + khoá i18n `login.*` (vi, en); lỗi hiển thị qua `errors.<CODE>`
- [ ] T073 [P] [US2] Web `FEAT_WEB/accept-invitation/AcceptInvitationPage.tsx` (tạo mật khẩu hoặc yêu cầu đăng nhập đúng email) + khoá i18n
- [ ] T074 [P] [US2] Web `FEAT_WEB/password-reset/{RequestResetPage.tsx,ConfirmResetPage.tsx}` + khoá i18n
- [ ] T075 [P] [US2] Web `FEAT_WEB/organization-switcher/OrganizationSwitcher.tsx` (chọn tổ chức sau đăng nhập, chuyển tổ chức, xoá cache TanStack Query khi chuyển)
- [ ] T076 [P] [US2] Web `FEAT_WEB/platform/PlatformOrganizationsPage.tsx` (tạo tổ chức, gửi lại lời mời Admin)
- [ ] T077 [US2] E2E Playwright `apps/web/e2e/onboarding.spec.ts` (Q1 → Q2, Q11) và `apps/web/e2e/password-reset.spec.ts` (Q14) dùng Mailpit; đo thời gian bằng thao tác tự động và fail nếu Operator tạo tổ chức + gửi lời mời > 2 phút, chấp nhận lời mời (kể cả tạo tài khoản) > 2 phút, chuyển tổ chức > 5 giây (SC-003 — sửa sau `/speckit-analyze` G1)

**Checkpoint**: US2 chạy độc lập — có tổ chức, Admin đăng nhập được; Q1, Q2, Q11–Q14 xanh.

---

## Phase 4: User Story 3 — Mời thành viên và gán vai trò hệ thống (Priority: P1)

**Goal**: Admin mời thành viên, gán nhiều vai trò, vô hiệu hoá/kích hoạt lại; luôn ≥ 1 Admin.

**Independent Test**: Q4, Q5, Q10.

### Tests for User Story 3 (RED) ⚠️

- [ ] T078 [P] [US3] **RED** `FEAT_CORE/membership-invariants.test.ts`: gỡ `admin` hoặc vô hiệu hoá Admin active cuối cùng → `LAST_ADMIN_REQUIRED`; tập vai trò rỗng → lỗi; kích hoạt lại → roles = `{member}`, không project member, không RACI; đang là Accountable → `ACCOUNTABLE_REQUIRED` (FR-012, FR-014, FR-015)
- [ ] T079 [P] [US3] **RED** `FEAT_SRV/invitations/org-invitations.integration.test.ts`: `POST /org/invitations` → 201, roles mặc định `["member"]`, mời lại cùng email thu hồi lời mời pending cũ; email là member active → 409 `ALREADY_MEMBER`; member `deactivated` → 409 `MEMBER_DEACTIVATED_USE_REACTIVATE`; `GET ?status=`; `DELETE` → revoked, lời mời không pending → 409 `INVITATION_NOT_PENDING`; response không bao giờ có token; người không có `org.member.invite` → 403 (FR-009, Q4)
- [ ] T080 [P] [US3] **RED** `FEAT_SRV/members/roles.integration.test.ts`: `PUT /org/members/{id}/roles ["projectManager","finance"]` → quyền là hợp, hiệu lực ngay request kế tiếp (SC-004); gỡ `admin` của Admin cuối → 409 `LAST_ADMIN_REQUIRED`; **2 Admin gỡ nhau đồng thời** → đúng một thành công, tổ chức vẫn còn Admin; audit before/after (FR-012, FR-014, Q4, Q5)
- [ ] T081 [P] [US3] **RED** `FEAT_SRV/members/deactivate-reactivate.integration.test.ts`: vô hiệu hoá member đang có phiên → request kế tiếp 403 `MEMBERSHIP_INACTIVE`; `project_member` → `removed`, RACI bị gỡ (fixture chèn trực tiếp dự án), lịch sử giữ; đang là Accountable → 409 `ACCOUNTABLE_REQUIRED {projectIds}`; kích hoạt lại → roles `["member"]`, không thuộc dự án nào; membership chưa vô hiệu hoá → 409 `MEMBERSHIP_NOT_DEACTIVATED`; vô hiệu hoá ở Acme không ảnh hưởng Beta (FR-015, FR-017, SC-004, Q10)

### Implementation for User Story 3 (GREEN)

- [ ] T082 [US3] **GREEN** `FEAT_CORE/membership-invariants.ts` cho T078
- [ ] T083 [US3] **GREEN** `FEAT_SRV/invitations/org-invitations.controller.ts` + mở rộng `invitation.service.ts` (email theo locale người mời) cho T079
- [ ] T084 [US3] **GREEN** `FEAT_SRV/members/{members.module.ts,members.controller.ts,members.service.ts,members.repository.ts}`: `GET /org/members`, `PUT /org/members/{id}/roles`, `POST .../deactivate`, `POST .../reactivate`; khoá hàng Admin `FOR UPDATE` trong transaction (data-model §membership_role) cho T080, T081
- [ ] T085 [P] [US3] Web `FEAT_WEB/members/MembersPage.tsx` (danh sách, chọn nhiều vai trò, vô hiệu hoá/kích hoạt lại, hiển thị lỗi theo mã) + khoá i18n
- [ ] T086 [P] [US3] Web `FEAT_WEB/invitations/InvitationsPage.tsx` (mời, chọn vai trò, thu hồi) + khoá i18n
- [ ] T087 [US3] E2E `apps/web/e2e/members.spec.ts` (Q4, Q5, Q10)

**Checkpoint**: US2 + US3 xanh độc lập.

---

## Phase 5: User Story 1 — Cô lập dữ liệu giữa các tổ chức (Priority: P1)

**Goal**: chứng minh không đọc/ghi chéo tổ chức trên **mọi** route tổ chức, ở cả lớp ứng dụng lẫn RLS.

**Independent Test**: Q3 và bộ test cô lập tự liệt kê route.

- [ ] T088 [US1] Fixture `apps/server/src/test/fixtures/two-organizations.ts` (Acme, Beta; mỗi tổ chức: Admin, PM, member, lời mời pending, dự án + thành viên dự án + Accountable chèn trực tiếp) và bảng ánh xạ `apps/server/src/test/fixtures/route-targets.ts` (route → id đối tượng của Beta)
- [ ] T089 [US1] **RED** `FEAT_SRV/isolation.integration.test.ts`: **tự liệt kê** mọi route có `@RequireAction` từ NestJS `DiscoveryService`; với principal Acme nhắm id Beta → 404 `RESOURCE_NOT_FOUND`, body **giống hệt** khi dùng UUID ngẫu nhiên; endpoint danh sách không chứa dòng Beta; số dòng bảng của Beta không đổi; route mới chưa có trong `route-targets.ts` → test **fail** (FR-001–003, SC-001, Q3)
- [ ] T090 [US1] **RED** `FEAT_SRV/db/rls-policies.integration.test.ts`: với **mọi** bảng có cột `organization_id` (đọc từ `information_schema`), `planix_app` trong context Acme không `SELECT`/`INSERT`/`UPDATE` được dòng Beta; bảng có `organization_id` mà chưa bật RLS → fail; policy SELECT theo `app_current_user_id()` (R3 lối 1) và policy INSERT NULL của `audit_entry` (R3 lối 4) là ngoại lệ liệt kê tường minh trong test (FR-002, R3)
- [ ] T091 [US1] **GREEN** Sửa policy RLS còn thiếu mà T090 phát hiện (migration mới `apps/server/drizzle/0007_rls_fixes.sql` chỉ khi có thiếu sót — không tạo lại policy đã có từ T031) và sửa repository thiếu điều kiện tổ chức để T089, T090 xanh
- [ ] T092 [US1] E2E `apps/web/e2e/isolation.spec.ts`: URL trực tiếp tới đối tượng tổ chức khác → trang "không tìm thấy", danh sách không lộ dữ liệu (Q3)

**Checkpoint**: mọi route hiện có đã chứng minh cô lập; route thêm ở phase sau bắt buộc thêm ánh xạ.

---

## Phase 6: User Story 4 — Dự án và thành viên dự án (Priority: P2)

> Làm trước US6 (P1) vì quyết định quyền cấp dự án cần có dự án thật (xem §Dependencies).

**Goal**: tạo dự án (người tạo là thành viên + Accountable), thêm/xoá thành viên dự án.

**Independent Test**: Q6, phần xoá thành viên của Q9.

### Tests for User Story 4 (RED) ⚠️

- [ ] T093 [P] [US4] **RED** `FEAT_SRV/projects/projects.integration.test.ts`: `POST /projects` với `name` "NOT NULL, 1–200 ký tự", `description` "NULL, ≤ 5.000 ký tự" (vượt → 400 `VALIDATION_FAILED`); `portfolioLead`/`projectManager` → 201 `{ project, accountable }`, người tạo là thành viên **và** Accountable trong **1 transaction** (lỗi giữa chừng → không còn gì); vai trò khác → 403; `GET /projects` chỉ trả dự án mình là thành viên active — Admin không phải thành viên không thấy (FR-016, Q8); `GET /projects/{id}` trả Accountable ; `portfolioLead` tạo dự án rồi `POST /projects/{id}/members` thêm một PM → 201 (không deadlock — decision `2026-09-15-005-portfolio-lead-manages-project-members`) (FR-018, Q6)
- [ ] T094 [P] [US4] **RED** `FEAT_SRV/projects/project-members.integration.test.ts`: `POST /projects/{id}/members { membershipId }` với membership active cùng tổ chức → 201; membership tổ chức khác hoặc deactivated → 404; đã là thành viên → 409 `ALREADY_PROJECT_MEMBER`; `DELETE` → `status = removed`, RACI bị gỡ, lịch sử giữ; xoá Accountable → 409 `ACCOUNTABLE_REQUIRED`; `GET /projects/{id}/members` trả `raciRoles[]` ; `portfolioLead` là thành viên dự án thêm/xoá được thành viên; `functionalManager` là thành viên → 403 (FR-013, FR-019, FR-020, Q9)

### Implementation for User Story 4 (GREEN)

- [ ] T095 [US4] **GREEN** `FEAT_SRV/projects/{projects.module.ts,projects.controller.ts,projects.service.ts,projects.repository.ts}` cho T093
- [ ] T096 [US4] **GREEN** `FEAT_SRV/projects/{project-members.controller.ts,project-members.service.ts}` cho T094
- [ ] T097 [US4] Thêm các route dự án vào `apps/server/src/test/fixtures/route-targets.ts` để T089 bao phủ (SC-001)
- [ ] T098 [P] [US4] Web `FEAT_WEB/projects/ProjectsPage.tsx` (danh sách, tạo dự án) + khoá i18n
- [ ] T099 [P] [US4] Web `FEAT_WEB/project-members/ProjectMembersPage.tsx` (thêm/xoá thành viên từ thành viên tổ chức) + khoá i18n

**Checkpoint**: US4 xanh; test cô lập T089 bao phủ route dự án.

---

## Phase 7: User Story 6 — Quyết định quyền 2 lớp, mặc định từ chối (Priority: P1)

**Goal**: chứng minh ở mức API rằng chỉ tổ hợp "vai trò cho phép ∧ thành viên dự án" được phép; thay đổi quyền có
hiệu lực ngay; từ chối được ghi audit.

**Independent Test**: Q7, Q8.

- [ ] T100 [US6] **RED** `FEAT_SRV/authorization.integration.test.ts`: với mỗi action cấp dự án có route (`project.read`, `project.member.manage`, `project.raci.manage`) chạy 4 tổ hợp (có/không vai trò × có/không thành viên dự án) → chỉ "có × có" được phép; Admin không là thành viên → 403; từ chối trên dữ liệu dự án ghi `audit_entry.outcome = denied` (FR-016, FR-022–024, FR-027, SC-002, Q7, Q8)
- [ ] T101 [US6] **RED** `FEAT_SRV/permission-change-immediacy.integration.test.ts`: gỡ vai trò / xoá khỏi dự án / vô hiệu hoá rồi gửi ngay request kế tiếp → 0 request lẽ ra bị từ chối lại được phép (SC-004)
- [ ] T102 [US6] **GREEN** Ghi audit từ chối trong `apps/server/src/shared/authorization/authorization.guard.ts` và hoàn thiện `project-target.resolver.ts` (không cache) cho T100, T101
- [ ] T103 [P] [US6] **RED** `apps/web/src/shared/authorization/useCan.test.ts`: kết quả khớp ma trận `packages/core` cho các tổ hợp vai trò × thành viên dự án
- [ ] T104 [US6] **GREEN** `apps/web/src/shared/authorization/useCan.ts`: dùng ma trận từ `packages/core` để **ẩn** thao tác không được phép; server vẫn là nơi quyết định — làm T103 xanh

**Checkpoint**: SC-002 và SC-004 được chứng minh ở mức API.

---

## Phase 8: User Story 5 — Gán RACI và tra cứu Accountable (Priority: P2)

**Goal**: gán R/C/I, thay Accountable một bước, luôn đúng một Accountable; tra cứu dùng chung cho feature sau.

**Independent Test**: Q9 (thay Accountable), T107.

### Tests for User Story 5 (RED) ⚠️

- [ ] T105 [P] [US5] **RED** `FEAT_CORE/raci-invariants.test.ts`: dự án luôn đúng 1 Accountable; thay thế là 1 bước; gỡ Accountable không kèm người thay → `ACCOUNTABLE_REQUIRED`; một thành viên giữ nhiều vai trò RACI (FR-020, decision single-accountable)
- [ ] T106 [P] [US5] **RED** `FEAT_SRV/projects/raci.integration.test.ts`: `PUT /projects/{id}/members/{pmId}/raci { raciRoles }` không nhận `accountable` (có → 400 `VALIDATION_FAILED`); `PUT /projects/{id}/accountable { projectMemberId }` → 200 `{ previous, current }` + audit; người không phải thành viên → 409 `NOT_PROJECT_MEMBER`; **2 yêu cầu đổi Accountable đồng thời** → vẫn đúng 1 Accountable (partial unique index); PUT `raciRoles: ["responsible"]` cho Accountable hiện tại → vẫn là Accountable và có thêm R (FR-020, Q9)
- [ ] T107 [P] [US5] **RED** `FEAT_SRV/projects/accountable.query.integration.test.ts`: `getAccountable(tenant, projectId)` luôn trả đúng 1 kết quả; `isAccountable` đúng/sai; dự án tổ chức khác hoặc không tồn tại → `RESOURCE_NOT_FOUND` (FR-021, `contracts/authorization.md` §4)

### Implementation for User Story 5 (GREEN)

- [ ] T108 [US5] **GREEN** `FEAT_CORE/raci-invariants.ts` cho T105
- [ ] T109 [US5] **GREEN** `FEAT_SRV/projects/{raci.controller.ts,raci.service.ts}` cho T106 và thêm route vào `apps/server/src/test/fixtures/route-targets.ts`
- [ ] T110 [US5] **GREEN** `FEAT_SRV/projects/accountable.query.ts` export từ `projects.module.ts` làm provider công khai cho feature sau (Change Control — OI-07) cho T107
- [ ] T111 [P] [US5] Web `FEAT_WEB/project-members/{RaciEditor.tsx,ChangeAccountableDialog.tsx}` + khoá i18n
- [ ] T112 [US5] E2E `apps/web/e2e/raci.spec.ts` (Q6, Q9)

**Checkpoint**: US5 xanh; `AccountableQuery` sẵn sàng cho feature CHG.

---

## Phase 9: User Story 7 — Bảo vệ field nhạy cảm dùng chung (Priority: P2)

**Goal**: chứng minh end-to-end (HTTP thật + audit) cơ chế field nhạy cảm bằng DTO mẫu.

**Independent Test**: Q15.

- [ ] T113 [US7] **RED** `FEAT_SRV/sensitive-field.integration.test.ts` với module chỉ dành cho test `apps/server/src/test/sample-financial.module.ts` (route `@RequireAction('project.read')` trả `SampleFinancialDto`): principal `finance` + thành viên dự án → có khoá `budgetAtCompletion` (giá trị **chuỗi** thập phân); principal `member` → **không có khoá** ở chi tiết, danh sách, body lỗi và `audit_entry.before/after`; ghi field khi thiếu `sensitive.financial.write` → 403, dữ liệu không đổi (FR-025, FR-026, FR-028, SC-005, Q15)
- [ ] T114 [US7] **GREEN** Mở rộng `apps/server/src/shared/sensitive-field/sensitive-field.interceptor.ts` cho body lỗi và nối `audit-writer.ts` qua `stripSensitive` để T113 xanh; module test không được import vào `app.module.ts` production

**Checkpoint**: cơ chế field nhạy cảm sẵn sàng cho RES (`billingRate`) và EVM (`budgetAtCompletion`).

---

## Phase 10: User Story 8 — Song ngữ và thời gian UTC (Priority: P3)

**Goal**: người dùng chọn ngôn ngữ và múi giờ; không còn chuỗi cứng; thời điểm lưu UTC.

**Independent Test**: Q16.

- [ ] T115 [P] [US8] **RED** `FEAT_SRV/auth/me.integration.test.ts`: `PATCH /me` `locale` chỉ `vi|en`, `timeZone` phải là IANA hợp lệ, sai → 400 `VALIDATION_FAILED`; mọi thời điểm trong response là ISO 8601 kết thúc `Z` (FR-030)
- [ ] T116 [P] [US8] **RED** `FEAT_WEB/settings/SettingsPage.test.tsx`: đổi sang `en` → nhãn đổi ngay; đổi múi giờ → gọi `PATCH /me` và thời gian hiển thị theo múi giờ mới (FR-029, FR-030)
- [ ] T117 [US8] **GREEN** `PATCH /me` trong `FEAT_SRV/auth/auth.controller.ts` + `FEAT_WEB/settings/SettingsPage.tsx` cho T115, T116
- [ ] T118 [US8] Bật rule `i18next/no-literal-string` cho `apps/web/src/features/**` trong `eslint.config.js` và sửa mọi chuỗi cứng còn sót ở màn hình US2–US6 (FR-029, SC-007)
- [ ] T119 [US8] E2E `apps/web/e2e/i18n-timezone.spec.ts` (Q16: đổi `en`; tạo lời mời 23:30 `Asia/Ho_Chi_Minh` → DB `16:30Z`, web hiển thị 23:30)

**Checkpoint**: tất cả user story xanh độc lập.

---

## Phase 11: Polish & Cross-Cutting Concerns

- [ ] T120 [P] Chạy subagent `glossary-steward` trên code + spec của feature; append thuật ngữ **mới phát sinh** trong lúc code vào `docs/00-glossary.md` (Nguyên tắc VI)
- [ ] T121 [P] **RED** `FEAT_SRV/audit-coverage.integration.test.ts`: mỗi hành động liệt kê ở FR-027 sinh đúng 1 bản ghi; quét toàn bảng `audit_entry` không có mật khẩu thô, token thô hay giá trị field nhạy cảm (SC-008, Q17)
- [ ] T122 **GREEN** Bổ sung ghi audit còn thiếu mà T121 phát hiện trong service tương ứng dưới `FEAT_SRV/` — làm T121 xanh
- [ ] T123 [P] Kịch bản tải `apps/server/perf/org-access.ts` (autocannon) + script `npm run perf:org-access`: seed 500 dự án/tổ chức, 200 kết nối đồng thời trên các endpoint của feature, **fail nếu p95 ≥ 1 giây** (SC-006, R12)
- [ ] T124 **RED** `apps/server/src/security-headers.integration.test.ts`: response có CSP, HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`; không có `x-powered-by`; body vượt giới hạn → 413
- [ ] T125 **GREEN** Security hardening trong `apps/server/src/main.ts`: `helmet` (CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`), tắt `x-powered-by`, giới hạn kích thước body — làm T124 xanh
- [ ] T126 Chạy `npm run lint`, `npm run test -- --coverage` (≥ 80%), `npm run build`; thiếu coverage → bổ sung test cho nhánh chưa phủ (Nguyên tắc IV)
- [ ] T127 Chạy toàn bộ `quickstart.md` Q1–Q18 trên môi trường dev; gotcha phát hiện → append `docs/05-lessons.md`; phần cảm nhận người dùng thật của SC-003 kiểm thủ công
- [ ] T128 Ghi chú cho steward trong mô tả PR: thêm required status check `quality-gate` (job CI T013) vào branch protection của `main` (thao tác trên GitHub, cần quyền admin)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → user stories. Không story nào bắt đầu trước khi Phase 2 xong.
- **Polish (Phase 11)** sau khi các story mong muốn hoàn tất.

### User Story Dependencies

Thứ tự phase lệch khỏi thứ tự ưu tiên thuần vì phụ thuộc dữ liệu:

| Story | Ưu tiên | Phụ thuộc | Lý do |
|---|---|---|---|
| US2 | P1 | Foundational | Không có tổ chức + danh tính thì không test được gì khác |
| US3 | P1 | US2 | Cần Admin đăng nhập để mời/gán vai trò |
| US1 | P1 | US2, US3 | Test cô lập cần 2 tổ chức có thành viên, lời mời; tự mở rộng khi thêm route |
| US4 | P2 | US3 | Tạo dự án cần vai trò PM/portfolioLead |
| US6 | P1 | US4 | Quyết định quyền cấp dự án cần dự án thật (logic `decide()` đã có ở Foundational) |
| US5 | P2 | US4 | RACI gắn thành viên dự án |
| US7 | P2 | Foundational, US4 | Route mẫu dùng `project.read` |
| US8 | P3 | US2–US6 | Rà chuỗi cứng trên các màn hình đã có |

### Within Each User Story

- Test RED viết trước và **phải fail** → GREEN tối thiểu → refactor
- Migration/schema → repository/service → controller → web → E2E
- Mỗi route mới phải thêm vào `route-targets.ts` (T089 fail nếu thiếu)

### Parallel Opportunities

- Setup: T003–T006, T008, T011–T013
- Foundational: các task RED core T015, T017, T019, T021, T023 cùng lúc; T034, T036, T040, T043, T045 (khác file) sau T031; web T050, T052, T054
- Mỗi story: toàn bộ task RED gắn [P] cùng lúc; màn hình web gắn [P] song song với nhau

---

## Parallel Example: User Story 2

```bash
# RED — cùng lúc:
Task: "T057 password-policy.test.ts"
Task: "T058 login-lockout.test.ts"
Task: "T059 platform.integration.test.ts"
Task: "T060 accept-invitation.integration.test.ts"
Task: "T061 login.integration.test.ts"
Task: "T062 active-organization.integration.test.ts"
Task: "T063 password-reset.integration.test.ts"

# GREEN core — cùng lúc:
Task: "T065 password-policy.ts"
Task: "T066 login-lockout.ts"

# Web — cùng lúc sau khi API xanh:
Task: "T072 LoginPage.tsx"  Task: "T073 AcceptInvitationPage.tsx"
Task: "T074 password-reset pages"  Task: "T075 OrganizationSwitcher.tsx"  Task: "T076 PlatformOrganizationsPage.tsx"
```

---

## Implementation Strategy

### MVP First

1. Phase 1 Setup → Phase 2 Foundational
2. Phase 3 **US2** → dừng, kiểm Q1, Q2, Q11–Q14 → demo: Operator tạo tổ chức, Admin đăng nhập
3. Phase 4 US3 + Phase 5 US1 → **MVP an toàn**: nhiều người trong tổ chức, cô lập được chứng minh

### Incremental Delivery

US2 → US3 → US1 → US4 → US6 → US5 → US7 → US8 → Polish. Sau mỗi phase: lint/test/coverage xanh, commit, cập nhật
checkbox trong file này.

---

## Notes

- [P] = khác file, không phụ thuộc task chưa xong; [USn] = truy vết story
- Không bỏ qua RED; commit sau mỗi cặp RED/GREEN hoặc nhóm logic
- Không dùng `number` cho tiền (ESLint `planix/no-number-money`); không nhận `organizationId` từ client
- Gotcha kỹ thuật → `docs/05-lessons.md`
