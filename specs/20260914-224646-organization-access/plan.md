# Implementation Plan: Quản lý tổ chức và phân quyền truy cập (organization-access)

**Branch**: `005-organization-access` (issue #5) | **Date**: 2026-09-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/20260914-224646-organization-access/spec.md`

## Summary

Dựng nền móng đa tổ chức và phân quyền cho Planix: Platform Operator tạo tổ chức; người dùng vào tổ chức qua
lời mời (email + mật khẩu, không tự đăng ký); vai trò hệ thống nhiều-giá-trị theo ma trận quyền giai đoạn 1;
dự án tối thiểu với thành viên dự án và RACI (luôn đúng một Accountable); quyết định quyền 2 lớp mặc định từ
chối; cơ chế dùng chung ẩn field nhạy cảm; song ngữ VI/EN, lưu UTC.

Cách tiếp cận (research): monorepo TypeScript — logic quyết định quyền, ma trận quyền và bất biến RACI là
**hàm thuần trong `packages/core`**; `apps/server` (NestJS) cưỡng chế qua guard bắt buộc cho mọi route +
interceptor lọc field nhạy cảm; cô lập tổ chức 2 lớp (repository nhận `TenantContext` + PostgreSQL RLS);
phiên phía server để thu hồi tức thì; `apps/web` (React) chỉ phản ánh quyền, không quyết định quyền.

## Technical Context

**Language/Version**: TypeScript 6.0.x (pin `<6.1`), Node.js 24 LTS — research R1, R2

**Primary Dependencies**: NestJS 12 (Express), Drizzle ORM 0.45 + `pg` 8, zod 4, argon2, `@nestjs/throttler` 6,
decimal.js 10; React 19, Vite 8, React Router 7, TanStack Query 5, i18next 26 + react-i18next 17

**Storage**: PostgreSQL 17 (RLS, `citext`, `timestamptz`, `NUMERIC`); migration drizzle-kit — research R3

**Testing**: Vitest 5 + `@vitest/coverage-v8` (ngưỡng 80%); `@nestjs/testing` + Supertest; Testcontainers
(PostgreSQL, Mailpit); Playwright 1.63 cho E2E luồng chính; ESLint RuleTester cho rule tiền tệ — research R13

**Target Platform**: Server Linux container (Node 24, `TZ=UTC`); web app responsive trên trình duyệt hiện đại
(Chrome, Firefox, Safari, Edge — 2 phiên bản gần nhất), desktop và mobile

**Project Type**: Web application (monorepo: domain core + API server + SPA)

**Performance Goals**: p95 < 1 giây cho thao tác của feature với ~200 người dùng đồng thời, 500 dự án/tổ chức
(SC-006, OI-14); quyết định quyền là hàm thuần O(1) theo số vai trò

**Constraints**: cô lập tổ chức tuyệt đối (phản hồi 404 giống không tồn tại); thay đổi quyền có hiệu lực từ
request kế tiếp (không cache quyền); phiên hết sau 8 giờ không hoạt động; không float cho tiền; không câu chữ
hiển thị từ server; audit append-only

**Scale/Scope**: v1 ~200 người dùng đồng thời, 500 dự án/tổ chức; feature gồm ~30 endpoint
([contracts/api.md](contracts/api.md)), 11 bảng ([data-model.md](data-model.md)), ~10 màn hình web
(đăng nhập, chấp nhận lời mời, quên/đặt lại mật khẩu, chọn tổ chức, thành viên & vai trò, lời mời, dự án,
thành viên dự án & RACI, cài đặt cá nhân, Operator: tổ chức)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Yêu cầu áp dụng cho feature | Trước Phase 0 | Sau Phase 1 (thiết kế) |
|---|---|---|---|
| **I. Chính xác tính toán** | Decimal cấm float; tính trung gian ≥ 4 chữ số; test công thức | ✅ PASS — feature không có công thức tài chính. Tech stack A chỉ được chấp nhận kèm 4 ràng buộc Decimal | ✅ PASS — kiểu `Decimal`, `NUMERIC` dạng chuỗi, ESLint rule `planix/no-number-money` có RuleTester được dựng làm nền (R13, decision tech-stack) |
| **II. Quy trình là ràng buộc cứng** | Cưỡng chế ở domain/server, test gọi thẳng API, audit trail | ✅ PASS — spec yêu cầu kiểm tra phía hệ thống (FR-024) và audit (FR-027) | ✅ PASS — guard bắt buộc mọi route (route thiếu Action → không khởi động, có test); bất biến Admin cuối/Accountable ở core **và** DB (partial unique index, `FOR UPDATE`); audit append-only cùng transaction (R5, R7, R8) |
| **III. Bảo mật mặc định từ chối** | RBAC ∧ RACI; field-level API; cô lập tenant có test; không log dữ liệu nhạy cảm | ✅ PASS — FR-001–003, 016, 022–025, 028 | ✅ PASS — `decide` không nhánh Admin, action lạ → Deny; RLS + `TenantContext` (không nhận `organizationId` từ client); interceptor xoá khoá field nhạy cảm cả ở lỗi/audit; token/mật khẩu băm, không log (R3–R6, [authorization.md](contracts/authorization.md)) |
| **IV. Test-first & coverage** | TDD; coverage ≥ 80% business logic; test deterministic | ✅ PASS — spec có tiêu chí test cụ thể | ✅ PASS — Vitest ngưỡng 80% cho core + `server/src/features/**`; đồng hồ giả cho khoá/hết phiên (Q12, Q13); integration trên PostgreSQL thật; không phụ thuộc TZ máy (`TZ=UTC`) |
| **V. Nguồn sự thật & truy vết** | Qua design-intake; ambiguity → decision records | ✅ PASS — intake `docs/intake/005-organization-access.md`; 8 decision `005-*` | ✅ PASS — mọi quyết định thiết kế có mã R* hoặc decision; tech stack ghi `2026-09-14-005-tech-stack.md` |
| **VI. Thuật ngữ nhất quán** | Tra glossary; tách khái niệm trùng | ✅ PASS — định danh theo glossary (`organization`, `projectMember`, `accountable`…) | ⚠️ PASS có việc — thuật ngữ mới cần append glossary trong branch: `platformOperator`, `organizationMembership`, `organizationInvitation`, `authSession`, `activeOrganization`, `passwordResetToken`, `auditEntry`, `portfolioLead`/`member`/`finance`/`admin` (giá trị role). Theo dõi ở `glossary-steward` (bước 12) |
| **VII. Đơn giản & theo lộ trình** | Chỉ giai đoạn 1; không abstraction thừa | ✅ PASS — phân quyền là hạng mục giai đoạn 1 (OI-18) | ✅ PASS có giải trình — xem Complexity Tracking (3 package, RLS 2 lớp, ESLint rule tiền tệ trước khi có field tiền) |
| **Ràng buộc nền tảng** | Web responsive, multi-tenant, VI/EN, UTC, stack qua decision | ❌→✅ Stack chưa chốt khi bắt đầu → đã giải bằng decision `2026-09-14-005-tech-stack` (người dùng chọn A) | ✅ PASS |

**Kết luận gate**: PASS. Không có vi phạm chưa giải trình.

## Project Structure

### Documentation (this feature)

```text
specs/20260914-224646-organization-access/
├── spec.md
├── plan.md              # file này
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── api.md           # HTTP API
│   └── authorization.md # ma trận action, decide(), tra cứu Accountable, field nhạy cảm
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — chưa tạo)
```

### Source Code (repository root)

```text
package.json                         # npm workspaces, script lint/test/build/dev/db:migrate/ops:*/perf:*
tsconfig.base.json
eslint.config.js                     # gồm plugin nội bộ planix (no-number-money)
vitest.workspace.ts                  # ngưỡng coverage 80%
docker-compose.yml                   # postgres 17, mailpit (dev)
tools/
└── eslint-plugin-planix/            # rule no-number-money + RuleTester

packages/core/                       # domain thuần — KHÔNG import NestJS/DB/React
└── src/
    ├── shared/
    │   ├── decimal/                 # kiểu Decimal (Nguyên tắc I)
    │   ├── tenant-context.ts
    │   └── sensitive-field/         # sensitive(permission) cho schema zod
    └── features/organization-access/
        ├── roles.ts                 # SystemRole, RaciRole
        ├── permission-matrix.ts     # ma trận FR-013 (dữ liệu hằng)
        ├── decide.ts                # decide(principal, action, target)
        ├── raci-invariants.ts       # đúng 1 Accountable
        ├── membership-invariants.ts # ≥ 1 Admin, kích hoạt lại
        ├── password-policy.ts       # ≥ 12, danh sách mật khẩu phổ biến
        ├── schemas/                 # zod request/response dùng chung server–web
        └── *.test.ts                # test cạnh code

apps/server/                         # NestJS
└── src/
    ├── shared/
    │   ├── db/                      # Drizzle client, transaction + SET LOCAL app.organization_id
    │   ├── auth/                    # session guard, CSRF, throttler
    │   ├── authorization/           # guard gọi core.decide, decorator @RequireAction
    │   ├── sensitive-field/         # response interceptor
    │   ├── audit/                   # AuditWriter
    │   ├── mail/                    # MailSender port + adapter Mailpit/SMTP
    │   └── errors/                  # mã lỗi → HTTP
    ├── features/organization-access/
    │   ├── auth/                    # login, logout, session, password reset, active organization
    │   ├── invitations/
    │   ├── members/                 # roles, deactivate, reactivate
    │   ├── projects/                # project, project members, RACI, accountable
    │   ├── platform/                # /platform/* (Operator)
    │   └── db/                      # schema bảng + RLS policy + repository của feature
    ├── ops/                         # CLI grant-operator
    └── test/                        # helper Testcontainers, fixture 2 tổ chức, đồng hồ giả, SampleFinancialDto
apps/server/drizzle/                 # migration SQL (bảng, RLS, grant role planix_app)
apps/server/perf/                    # kịch bản tải SC-006

apps/web/                            # React SPA
└── src/
    ├── shared/                      # api client (CSRF), i18n setup, format thời gian theo timeZone
    ├── i18n/{vi,en}.json
    └── features/organization-access/
        ├── login/  accept-invitation/  password-reset/  organization-switcher/
        ├── members/  invitations/  projects/  project-members/  settings/
        └── platform/
apps/web/e2e/                        # Playwright: Q2, Q3, Q7, Q10, Q14, Q16
```

**Structure Decision**: monorepo 3 package theo decision tech-stack; mỗi package tách `src/features/<slug>/`
(code riêng feature) và `src/shared/` (vùng dùng chung — blast radius lớn, cần review kỹ khi đổi) đúng quy ước
`CLAUDE.md`. Thư mục `src/` và `tests/` rỗng ở root template bị xoá ở task setup. Test đặt cạnh code
(`*.test.ts`); integration server dùng Testcontainers; E2E trong `apps/web/e2e/`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 3 package (core / server / web) thay vì 1 app | Nguyên tắc II yêu cầu quy tắc ở domain; tách `core` thuần giúp test bảng quyết định đầy đủ (SC-002) và dùng lại schema zod ở web | 1 app: logic quyền dính NestJS → khó test thuần, web phải lặp lại validation |
| Cô lập tổ chức 2 lớp (ứng dụng + RLS) | Nguyên tắc III "cô lập tuyệt đối"; một điều kiện `WHERE` bị quên không được phép thành lộ dữ liệu | Chỉ lọc ở ứng dụng: một lỗi = lộ dữ liệu khách hàng; schema-per-tenant: vận hành nặng với 500+ tổ chức |
| ESLint rule `no-number-money` + kiểu `Decimal` khi feature chưa có field tiền | Là **điều kiện chấp nhận** tech stack A (decision tech-stack); dựng cùng nền móng để feature RES/EVM không bắt đầu sai | Để tới feature EVM: code tiền đầu tiên có thể viết bằng `number` trước khi gate tồn tại |
| Guard bắt buộc khai báo Action cho mọi route (fail khi khởi động) | Nguyên tắc II/III — không route nào lọt kiểm tra quyền | Kiểm tra trong từng controller: dễ sót ở route mới |
