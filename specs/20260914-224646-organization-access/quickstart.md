# Quickstart — kiểm chứng organization-access

Hướng dẫn chạy và kiểm chứng feature end-to-end. Không chứa code triển khai — xem `tasks.md` (sinh
bởi `/speckit-tasks`), [contracts/](contracts/) và [data-model.md](data-model.md).

## Điều kiện tiên quyết

- Node.js 24 LTS, npm 11
- Docker (PostgreSQL 17 và Mailpit chạy container; Testcontainers cần Docker cho integration test)

## Khởi động môi trường dev

```bash
npm install
```

```bash
docker compose up -d postgres mailpit
```

```bash
npm run db:migrate
```

```bash
npm run ops:grant-operator -- --email operator@planix.local
```

```bash
npm run dev
```

Kỳ vọng: server tại `http://localhost:3000/api/v1`, web tại `http://localhost:5173`, hộp thư Mailpit tại
`http://localhost:8025`.

## Gate tự động (Test gate — constitution Nguyên tắc IV)

```bash
npm run lint
```

```bash
npm run test -- --coverage
```

```bash
npm run build
```

Kỳ vọng: cả 3 xanh; coverage ≥ 80% (lines/branches/functions) cho `packages/core` và
`apps/server/src/features/**` — Vitest fail nếu dưới ngưỡng.

## Kịch bản kiểm chứng

Mỗi kịch bản có test tự động tương ứng (unit core / integration server trên PostgreSQL thật / E2E Playwright).
Chạy thủ công qua web hoặc HTTP client để demo.

| # | Kịch bản | Bước | Kết quả mong đợi | Truy vết |
|---|---|---|---|---|
| Q1 | Operator tạo tổ chức | Đăng nhập Operator → `POST /platform/organizations { name: "Acme", firstAdminEmail: "admin@acme.test" }` | 201; Mailpit có email lời mời; người không phải Operator gọi → 403 | US2, FR-004 |
| Q2 | Chấp nhận lời mời, tạo tài khoản | Mở link trong email → đặt mật khẩu 11 ký tự → rồi 12 ký tự hợp lệ | Lần 1: `PASSWORD_POLICY_VIOLATION MIN_LENGTH_12`; lần 2: đăng nhập, là Admin của Acme | US2, FR-005/006/010 |
| Q3 | Cô lập tổ chức | Tạo tổ chức thứ 2 "Beta" + dự án P_B. Dùng phiên Admin/PM của Acme gọi `GET /projects/{P_B}`, `POST /projects/{P_B}/members` | Cả hai 404 `RESOURCE_NOT_FOUND`, giống hệt id ngẫu nhiên | US1, FR-002/003, SC-001 |
| Q4 | Mời + nhiều vai trò | Admin mời `pm@acme.test` → chấp nhận → Admin gán `["projectManager","finance"]` | PM tạo được dự án; có `sensitive.financial.read` ở dự án mình là thành viên | US3, FR-012 |
| Q5 | Admin cuối cùng | Admin duy nhất tự gỡ vai trò `admin` hoặc tự vô hiệu hoá | 409 `LAST_ADMIN_REQUIRED` | FR-014 |
| Q6 | Tạo dự án → Accountable | PM `POST /projects { name: "Website" }` | 201; `accountable` = PM; `GET /projects/{id}` trả cùng Accountable | US4, US5, FR-018/020 |
| Q18 | Lãnh đạo danh mục tạo dự án | Gán `portfolioLead` cho `u4` → `u4` `POST /projects { name: "Roadmap" }` → `u4` `POST /projects/{id}/members { membershipId: PM }` → PM `PUT /projects/{id}/accountable` chuyển cho PM | 201 → 201 (không kẹt); `u4` gọi `PUT …/accountable` → 403 `FORBIDDEN`; PM chuyển được | US4, FR-013, decision `2026-09-15-005-portfolio-lead-manages-project-members` |
| Q7 | Quyền 2 lớp | Gán `projectManager` cho `u2` nhưng không thêm vào dự án → `u2` gọi `POST /projects/{id}/members` | 403 `FORBIDDEN` (`NOT_PROJECT_MEMBER`); thêm `u2` với vai trò `member` → vẫn 403 (`ROLE_NOT_PERMITTED`) | US6, FR-022, SC-002 |
| Q8 | Admin không ngoại lệ | Admin (không là thành viên dự án) gọi `GET /projects/{id}` | 403 `FORBIDDEN`; `GET /projects` không liệt kê dự án đó | FR-016 |
| Q9 | Thay Accountable | PM thêm `u3` vào dự án → `PUT /projects/{id}/accountable { projectMemberId: u3 }` → thử `DELETE` thành viên `u3` | Thay thành công, audit có before/after; xoá `u3` → 409 `ACCOUNTABLE_REQUIRED` | US5, FR-020 |
| Q10 | Vô hiệu hoá & kích hoạt lại | Admin vô hiệu hoá `u2` (đang có phiên) → `u2` gọi bất kỳ API tổ chức → Admin kích hoạt lại `u2` | Request kế tiếp của `u2` → 403 `MEMBERSHIP_INACTIVE`; sau kích hoạt lại: vai trò chỉ `member`, không thuộc dự án nào | FR-015, SC-004 |
| Q11 | Đa tổ chức | Mời `pm@acme.test` vào Beta → chấp nhận bằng tài khoản sẵn có → `PUT /auth/session/active-organization` sang Beta | Chỉ thấy dữ liệu Beta; vai trò ở Beta độc lập Acme | US2, FR-017 |
| Q12 | Khoá đăng nhập | Đăng nhập sai 5 lần → đăng nhập đúng ngay sau đó | Cả 6 lần 401 `AUTH_INVALID_CREDENTIALS`; sau 15 phút (test dùng đồng hồ giả) đăng nhập được | FR-006 |
| Q13 | Hết phiên | Test tiến đồng hồ giả 8 giờ 1 phút không hoạt động → gọi `GET /auth/session` | 401 `AUTH_REQUIRED` | FR-007 |
| Q14 | Quên mật khẩu | `POST /auth/password-reset/request` với email tồn tại và không tồn tại → dùng link → dùng lại link | Cả 2 request 202 như nhau, chỉ email tồn tại nhận thư; đổi xong phiên cũ mất hiệu lực; dùng lại link → 410 | FR-031, FR-008, SC-009 |
| Q15 | Field nhạy cảm | Integration test với `SampleFinancialDto` (chỉ trong test): principal có / không có `sensitive.financial.read` | Có quyền: có khoá `budgetAtCompletion`; không có quyền: **không có khoá** ở chi tiết, danh sách, body lỗi, audit | US7, FR-025/026, SC-005 |
| Q16 | Song ngữ + UTC | Đổi `locale` sang `en` → mở các màn hình feature; tạo lời mời lúc 23:30 Asia/Ho_Chi_Minh | Toàn bộ nhãn/lỗi bằng English; DB lưu `16:30Z`, web hiển thị 23:30 | US8, FR-029/030, SC-007 |
| Q17 | Audit | Sau Q1–Q14 truy vấn `audit_entry` | Mỗi hành động FR-027 có bản ghi; không có chuỗi mật khẩu, token hay giá trị nhạy cảm | FR-027/028, SC-008 |

## Kiểm tra thiếu bản dịch (FR-029)

```bash
npm run test -w apps/web -- i18n
```

Kỳ vọng: tập khoá `vi` = `en`, và mọi mã lỗi trong [contracts/api.md](contracts/api.md) có bản dịch.

## Kiểm tra hiệu năng (SC-006)

```bash
npm run perf:org-access
```

Kỳ vọng: seed 500 dự án/tổ chức, 200 người dùng ảo đồng thời thực hiện các thao tác của feature → p95 < 1 giây.
