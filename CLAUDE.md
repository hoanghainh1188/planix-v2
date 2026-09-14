# Quy ước dự án cho AI agent

## Tổng quan
**Planix V2** — phần mềm quản trị dự án (project management).

- Khách hàng / người dùng cuối: _chưa chốt — bổ sung khi có basic design_
- Ngôn ngữ tài liệu thiết kế gốc: **Tiếng Việt** (SRS); giao diện VI + EN

## Tech stack
**Đã chốt** — decision `docs/04-decisions/2026-09-14-005-tech-stack.md` (đọc bản đầy đủ trước khi code).

- **Monorepo npm workspaces:** `packages/core` (domain thuần, không I/O) · `apps/server` (NestJS 12) ·
  `apps/web` (React 19 + Vite 8). Mỗi package: `src/features/<slug>/` + `src/shared/`.
- **Ngôn ngữ:** TypeScript **6.0.x** (pin `<6.1`), Node.js 24 LTS.
- **Dữ liệu:** PostgreSQL 17 + Drizzle ORM; cô lập tổ chức 2 lớp (ứng dụng + Row-Level Security).
- **Test:** Vitest 5 + coverage v8 (≥ 80% business logic), Supertest + Testcontainers, Playwright E2E.
- **Tiền/chỉ số (Nguyên tắc I):** kiểu `Decimal` (decimal.js) trong core · chuỗi trên API · `NUMERIC` trong DB ·
  ESLint cấm `number` cho giá trị tài chính. **Không bao giờ** dùng `number`/`parseFloat` cho tiền.
- **i18n:** i18next + react-i18next (vi, en); server trả **mã lỗi**, web dịch.

> Khi đã chốt stack: điền lệnh formatter vào `.claude/hooks/format.sh` để bật format-on-save
> (PostToolUse hook chạy sau mỗi Edit/Write). Thứ tự chuẩn: format → lint → type check → build
> (lint/test/build chạy ở Test gate của `/design-to-code`).
>
> ⚠️ **`.claude/settings.json` allow-list mặc định giả định `npm`** (`Bash(npm run lint|test|build)`,
> `Bash(npm install *)`) — vì JSON không chứa comment được. Nếu stack KHÁC JS/TS, đổi các dòng này
> sang lệnh tương đương (VD `go test ./...`, `pytest`, `./gradlew test|build`, `cargo test`). Không đổi
> cũng không sao — chỉ mất tiện auto-approve, các lệnh lạ sẽ rơi vào chế độ hỏi (`ask`), không bị chặn.

## Cấu trúc và ý nghĩa từng phần

- **`docs/01-basic-design/`, `docs/02-detail-design/`, `docs/03-ui/`** — nguồn sự thật GỐC từ khách hàng.
  Đây là source of truth duy nhất. Agent KHÔNG BAO GIỜ sửa nội dung ở đây. Khi có bản mới, thêm file mới +
  CHANGELOG.md, không ghi đè.

- **`docs/00-glossary.md`** — thuật ngữ Việt-Anh (kèm định danh code chuẩn). Mọi agent PHẢI tra file
  này trước khi đặt tên biến/field liên quan nghiệp vụ. Gặp thuật ngữ mới → **append** vào đây trước khi đặt tên (được làm ngay trong branch
  feature, xem rule 5), không tự dịch rồi bỏ qua.

- **`docs/04-decisions/`** — nơi lưu câu trả lời cho mọi ambiguity mà `/speckit-clarify` từng giải quyết
  (`INDEX.md` = mục lục tra nhanh). Trước khi hỏi lại 1 câu đã có trong đây, agent phải tra cứu trước.

- **`docs/05-lessons.md`** — bài học / gotcha kỹ thuật đặc thù dự án phát hiện khi code (KHÔNG phải
  thuật ngữ, KHÔNG phải nguyên tắc, KHÔNG phải trả lời ambiguity). Append 1 dòng, đọc ở đầu pipeline
  để không lặp lỗi cũ.

- **`docs/intake/`** — output của subagent `design-intake`. Đây là cầu nối giữa tài liệu Nhật/Figma và Spec Kit.

- **`specs/<feature>/`** — do Spec Kit sinh (spec.md, plan.md, tasks.md). CÓ THỂ tái sinh, không chỉnh tay.
  Nếu sai, sửa docs/ gốc hoặc bổ sung docs/04-decisions/ rồi chạy lại pipeline.

- **`.specify/memory/constitution.md`** — nguyên tắc bất di bất dịch của dự án. Thắng mọi thứ khác trong workflow Spec Kit.

- **`src/`** — code thật. Agent bám theo pattern đã có, không tự đổi kiến trúc. **Cô lập theo feature:**
  code riêng của 1 feature nằm trong `src/features/<slug>/` (`<slug>` = phần slug của branch `NNN-<slug>`)
  → 2 feature chạy song song hiếm khi đụng cùng file. Chỉ chạm vùng dùng chung (`src/shared/`, config,
  router, DI container…) khi thật cần, và tách commit nhỏ để giảm merge conflict.
  Xem `docs/TEAM-WORKFLOW.md`.

## Memory (bộ nhớ dự án)

Agent trong pipeline là **stateless** — mỗi `/speckit-*` và mỗi subagent là lần gọi mới, không nhớ lần
trước. Nên memory phải **externalize thành file commit vào Git**. Có 5 nguồn, mỗi loại một nhà:

| Nguồn | Loại memory | Ai ghi |
|---|---|---|
| `.specify/memory/constitution.md` | Nguyên tắc bất biến | `/speckit-constitution` + PR steward |
| `docs/00-glossary.md` | Thuật ngữ (semantic) | append trong branch; SỬA → PR steward |
| `docs/04-decisions/` + `INDEX.md` | Quyết định ambiguity | `/speckit-clarify` → runbook ghi |
| `docs/05-lessons.md` | Gotcha kỹ thuật | append trong branch khi gặp |
| `CLAUDE.md` | Quy ước dự án (auto-load) | PR |

**Recall là bắt buộc, không tự nguyện:** bước 1 của `/design-to-code` ("Nạp memory") đọc + tóm tắt các
nguồn trên trước khi làm gì khác → chống *context drift*.

**Vì sao file, không phải database:** memory ở đây low-volume, human-authored, cần **versioned lock-step
với code** (checkout commit cũ ra đúng ngữ cảnh cũ), cần **review qua PR diff** (gác cổng CODEOWNERS), và
cần **zero-infra** (clone là chạy). DB phá cả 3 thuộc tính đó và không sửa được vấn đề thật (kỷ luật đọc).
Chỉ cân nhắc lớp index/RAG *đọc-thẳng-từ file git* khi corpus lớn tới mức `grep` thất bại — khi đó git
vẫn là source of truth, DB chỉ là cache dẫn xuất.

## Cách chạy pipeline sinh code từ design
Gõ `/design-to-code` trong Claude Code, cung cấp đường dẫn tài liệu và link Figma khi được hỏi.

**Mô hình chạy:** `/design-to-code` là một *runbook điều phối*, KHÔNG tự gọi được các slash command
`/speckit-*` (Claude Code không cho command gọi command). Vì vậy:
- Bước dùng **subagent** (`design-intake`, `code-reviewer`) → command tự gọi qua Task tool.
- Bước dùng **Spec Kit** (`/speckit-specify|clarify|plan|tasks|analyze|implement`) → command in ra
  lệnh chính xác để **bạn tự dán và chạy**, rồi dừng chờ bạn báo xong.

Trình tự: **nạp memory** → design-intake → [handoff] specify → clarify → plan → tasks → analyze →
implement → code-reviewer → glossary-steward → security-reviewer → **test gate** → **deploy**.
Dừng xin xác nhận ở mọi checkpoint.

## Deploy
**CHƯA CHỐT** — phụ thuộc tech stack. Cho đến khi điền, `/design-to-code` bước 15 phải dừng và hỏi
trước khi deploy.

## Quy tắc bắt buộc
1. Mọi mâu thuẫn giữa basic design / detail design / Figma phải được nêu vào `/speckit-clarify`,
   không được tự chọn 1 bên và im lặng.
2. Mọi câu trả lời cho clarify phải được ghi vào `docs/04-decisions/`, không chỉ trả lời miệng trong chat.
3. `docs/intake/` và `specs/` được commit vào Git — bằng chứng agent đã hiểu đúng design tại thời điểm code được viết.
4. **Feature ID = số issue GitHub.** Branch đặt tên `NNN-<slug>` với `NNN` = số issue zero-pad tối thiểu
   3 chữ số (VD issue #42 → `042-user-reservation`). Không tự chọn số → tránh trùng khi nhiều người làm.
   (Thư mục `specs/` do Spec Kit sinh dùng tiền tố **timestamp** — bootstrap cấu hình sẵn; 2 lớp số
   không cần khớp, xem `docs/TEAM-WORKFLOW.md` mục 2.)
5. **Gác cổng file dùng chung** — phân biệt THÊM và SỬA để không kẹt giữa chừng:
   - **SỬA/đổi tên/xoá thuật ngữ đã có** trong `docs/00-glossary.md`, và **mọi thay đổi**
     `.specify/memory/constitution.md` → phải qua **PR riêng** được steward (code-owner) duyệt (blast
     radius lớn, đụng toàn dự án).
   - **THÊM thuật ngữ mới** (append 1 dòng) vào `docs/00-glossary.md` → **được làm ngay trong branch
     feature**; CODEOWNERS sẽ tự kéo steward review phần glossary khi mở PR. Không bị chặn giữa dòng.
6. **Chống lệch ngữ cảnh:** sync `main` trước khi bắt đầu feature; khi constitution/glossary vừa đổi trên
   `main`, rebase và **chạy lại `/speckit-analyze`** để bắt drift.

> Làm việc nhóm (nhiều người/1 dự án): xem đầy đủ ở [`docs/TEAM-WORKFLOW.md`](docs/TEAM-WORKFLOW.md).
