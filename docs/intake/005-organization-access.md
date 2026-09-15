# Intake — 005-organization-access (issue #5)

> Output của design-intake. Nguồn là tiếng Việt (SRS hợp nhất cấp dự án + decision records đã chốt),
> **không có** detail design riêng và **không có** Figma cho feature này — bỏ qua các bước dành cho
> tài liệu Nhật/Figma theo hướng dẫn.

## Input sources

- `docs/01-basic-design/_project/srs-v1.md` — §1.4 (vai trò được nhắc tới), FR-RES-04 (RACI), NFR-01
  (phân quyền, dữ liệu nhạy cảm), §6 (Vấn đề mở, đã 18/18 chốt quyết định).
- Nguồn gốc (không sửa): `docs/01-basic-design/_project/sources/srs-source-a-v1.md`,
  `docs/01-basic-design/_project/sources/srs-source-b-v1.md`.
- Decision records đã chốt (áp dụng thẳng, không hỏi lại):
  - `docs/04-decisions/2026-09-14-oi03-access-control-model.md` — mô hình RBAC 2 lớp + RACI.
  - `docs/04-decisions/2026-09-14-oi07-baseline-approval-authority.md` — CCB duyệt → Accountable áp
    dụng (ngoài phạm vi trực tiếp của feature này nhưng ràng buộc thiết kế truy vấn "Accountable").
  - `docs/04-decisions/2026-09-14-oi14-scale-targets.md` — mục tiêu quy mô (200 CCU, 500 dự án/tổ
    chức) — ảnh hưởng thiết kế truy vấn phân quyền không được là điểm nghẽn hiệu năng.
  - `docs/04-decisions/2026-09-14-oi17-platform-constraints.md` — web, đa tổ chức từ đầu, VI/EN, UTC,
    email/mật khẩu (SSO để sau).
  - `docs/04-decisions/2026-09-14-oi18-release-phasing.md` — phân quyền là hạng mục giai đoạn 1, đi
    cùng TASK/RES/WBS/SCH.
  - Đã quét `docs/04-decisions/INDEX.md` (18/18 quyết định) — không còn OI nào liên quan chưa chốt.
- `.specify/memory/constitution.md` — Nguyên tắc III (phân quyền mặc định từ chối, bảo vệ field nhạy
  cảm, cô lập tenant tuyệt đối), Nguyên tắc IV (test-first, coverage ≥ 80%), Nguyên tắc VII + Ràng
  buộc nền tảng (đa tổ chức, i18n, UTC, lộ trình 4 giai đoạn).
- `docs/00-glossary.md` — đối chiếu định danh: `organization`, `user`, `project`, `projectMember`,
  `role`, `projectManager`, `functionalManager`, `raciMatrix`, `responsible`, `accountable`,
  `consulted`, `informed`, `billingRate` 🔒, `budgetAtCompletion` 🔒.
- `docs/05-lessons.md` — đã đọc, hiện chưa có gotcha nào ghi nhận (bảng bài học rỗng).
- Phạm vi feature: mô tả trong issue GitHub #5 (dán nguyên văn trong yêu cầu chạy subagent này).

## Traceability — yêu cầu trong phạm vi → nguồn

| # | Yêu cầu (tóm tắt) | Nguồn | Loại |
|---|---|---|---|
| 1 | Tổ chức là tenant; mọi dữ liệu nghiệp vụ gắn tổ chức; không đọc/ghi chéo tổ chức, kể cả gọi thẳng API | OI-17; Constitution Nguyên tắc III "Cô lập tenant tuyệt đối" | Có nguồn trực tiếp |
| 2 | Đăng ký/đăng nhập email + mật khẩu | OI-17 ("Xác thực email/mật khẩu; SSO để giai đoạn sau") | Có nguồn trực tiếp |
| 2b | Mời người dùng vào tổ chức | Suy luận từ phạm vi issue #5 — **không có** câu chữ tương ứng trong SRS/OI. Cơ chế mời là tiền đề bắt buộc để RBAC hoạt động (phải có người trong org trước khi gán role) | **Giả định**, cần cơ chế cụ thể → xem Ambiguities #3 |
| 3 | RBAC cấp tổ chức, tập vai trò ban đầu: Admin, Lãnh đạo danh mục, PM, Functional Manager, Thành viên, Tài chính | OI-03; §1.4 (PM, Functional Manager, lãnh đạo/quản lý danh mục có nhắc tới); NFR-01 | Có nguồn trực tiếp (tên vai trò), ma trận quyền chi tiết theo phân hệ **chưa có nguồn** → Ambiguities #1 |
| 4 | Tạo dự án trong tổ chức; thêm/xoá thành viên dự án | Glossary `project`, `projectMember` (nguồn OI-03); tiền đề của FR-RES-04 (RACI cần có project member). "PM là người tạo dự án" **không có nguồn** | Có nguồn gián tiếp; vai trò được tạo dự án là **giả định** → Ambiguities #1 |
| 5 | RACI cấp dự án: gán R/A/C/I; truy vấn "Accountable của dự án" cho feature sau | FR-RES-04; OI-07 (Accountable là người áp dụng Baseline — cần biết ai là Accountable) | Có nguồn trực tiếp |
| 6 | Quyền thực tế = RBAC VÀ (project member / RACI); mặc định từ chối | OI-03; Constitution Nguyên tắc III | Có nguồn trực tiếp |
| 7 | Cơ chế dùng chung bảo vệ field nhạy cảm (billing rate, budget) ở tầng API | Constitution Nguyên tắc III ("bảo vệ ở mức field trong API… ẩn trên UI là không đủ"); glossary `billingRate` 🔒, `budgetAtCompletion` 🔒 (áp dụng thật ở RES/EVM, ngoài phạm vi feature này) | Có nguồn trực tiếp |
| 8 | i18n VI + EN cho màn hình feature; thời gian lưu UTC | OI-17; Ràng buộc nền tảng của constitution | Có nguồn trực tiếp |
| 9 | TDD, coverage ≥ 80% business logic | Constitution Nguyên tắc IV | Có nguồn trực tiếp |
| — | Ngoài phạm vi: billing rate/resource calendar (RES), WBS, lập lịch, CCB, SSO | OI-18 (lộ trình theo giai đoạn — các hạng mục này thuộc giai đoạn khác hoặc feature khác); OI-17 (SSO để sau) | Có nguồn trực tiếp |

---

## Prompt for /speckit-specify

Feature "Quản lý tổ chức và phân quyền truy cập" (organization-access). Xây dựng nền tảng đa tổ
chức (multi-tenant) và kiểm soát truy cập 2 lớp cho Planix, làm tiền đề cho mọi phân hệ nghiệp vụ sau
này (Task, Resource, WBS, Schedule…).

**Vì sao (why):** Planix phục vụ nhiều tổ chức (organization) trên cùng một hệ thống; dữ liệu của tổ
chức này tuyệt đối không được lộ sang tổ chức khác. Đồng thời, quyền của một người dùng trong hệ thống
phải được quyết định bởi hai lớp độc lập: (1) vai trò hệ thống (role) mà tổ chức gán cho họ — quyết
định họ được vào những phân hệ nào; và (2) việc họ có phải thành viên của một dự án cụ thể và giữ vai
trò gì trong ma trận RACI (Responsible/Accountable/Consulted/Informed) của dự án đó — quyết định họ
được làm gì trong dự án đó. Thiếu một trong hai lớp thì mặc định bị từ chối truy cập. Dữ liệu đơn giá
(billing rate) và ngân sách (budget) là thông tin nhạy cảm, phải được bảo vệ ngay ở tầng API (không
đủ nếu chỉ ẩn trên giao diện).

**User story chính:**

1. Là người khởi tạo tổ chức (ai được phép khởi tạo — tự đăng ký hay qua người vận hành nền tảng —
   chờ làm rõ ở clarify), tôi muốn tạo một tổ chức (organization) mới, để toàn bộ dữ liệu
   nghiệp vụ sau này (dự án, thành viên, vai trò...) được cô lập hoàn toàn trong phạm vi tổ chức đó —
   không có bất kỳ thao tác đọc hay ghi nào (kể cả gọi thẳng API, bỏ qua giao diện) chạm được vào dữ
   liệu của tổ chức khác.
2. Là người dùng, tôi muốn đăng ký tài khoản và đăng nhập bằng email + mật khẩu, để truy cập hệ
   thống. (SSO chưa làm ở feature này.)
3. Là Admin của một tổ chức, tôi muốn mời một người dùng (theo email) vào tổ chức của mình, để họ trở
   thành thành viên tổ chức (organization membership) và có thể được gán vai trò.
4. Là Admin, tôi muốn gán cho mỗi thành viên tổ chức vai trò hệ thống (role) — một hay nhiều vai trò
   cùng lúc chờ làm rõ ở clarify — thuộc tập ban đầu: Admin, Lãnh đạo danh mục (Portfolio Lead), Giám đốc dự án (Project Manager), Quản lý chức
   năng (Functional Manager), Thành viên (Member), Tài chính (Finance) — để vai trò đó quyết định họ
   được truy cập những phân hệ nào của hệ thống.
5. Là người có quyền tạo dự án (giả định: Giám đốc dự án — PM; vai trò nào được tạo dự án chờ làm rõ
   trong ma trận quyền ở clarify), tôi muốn tạo một dự án (project) mới trong tổ chức của mình.
6. Là PM, tôi muốn thêm hoặc xoá thành viên dự án (project member) khỏi một dự án cụ thể, để xác định
   ai đang tham gia dự án đó.
7. Là PM, tôi muốn gán vai trò RACI (Responsible, Accountable, Consulted, Informed) cho từng thành
   viên của dự án, để về sau hệ thống biết ai được phê duyệt gì trong dự án (ví dụ: phê duyệt cập
   nhật Baseline — sẽ được dùng ở feature Change Control sau này).
8. Là một phân hệ khác của hệ thống (được xây ở feature sau, ví dụ Change Control), tôi cần một cách
   tra cứu đáng tin cậy: "người dùng X có đang giữ vai trò Accountable của dự án Y hay không?" — để
   feature đó dùng lại mà không phải tự suy luận từ dữ liệu RACI.
9. Là hệ thống, quyền thực tế của một người dùng đối với một hành động trong một dự án PHẢI được tính
   bằng: có vai trò RBAC phù hợp với hành động đó VÀ (là thành viên của dự án đó VÀ/HOẶC giữ vai trò
   RACI phù hợp trong dự án đó). Nếu thiếu bất kỳ điều kiện nào ở trên, hệ thống PHẢI từ chối truy cập
   theo mặc định (default deny) — không có ngoại lệ ngầm định.
10. Là người xây các phân hệ nghiệp vụ sau (Resource, EVM), tôi cần Feature này cung cấp sẵn một cơ
    chế dùng chung để đánh dấu một field API là "nhạy cảm" (ví dụ billing rate, budget), sao cho khi
    người gọi API không có quyền phù hợp, field đó hoàn toàn không xuất hiện trong response (không
    phải chỉ bị ẩn/disable trên giao diện). Bản thân feature này không có field nhạy cảm nào để bảo
    vệ, chỉ cần dựng cơ chế và chứng minh nó hoạt động qua ít nhất một field mẫu hoặc test giả lập.
11. Toàn bộ màn hình của feature này hỗ trợ song ngữ Tiếng Việt và English (không hardcode chuỗi hiển
    thị); mọi thời điểm được lưu theo UTC.

**Tiêu chí chấp nhận cần kiểm thử được (không chỉ mô tả UI):**
- Có test chứng minh: gọi API trực tiếp (bỏ qua UI) từ user của tổ chức A không đọc/ghi được dữ liệu
  của tổ chức B.
- Có test chứng minh: user có role RBAC đúng nhưng KHÔNG phải thành viên dự án → bị từ chối các hành
  động cấp dự án; và ngược lại, là thành viên dự án nhưng role RBAC không cho phép truy cập phân hệ →
  cũng bị từ chối.
- Có test cho truy vấn "Accountable của dự án" trả đúng kết quả, bao gồm trường hợp dự án chưa gán
  Accountable.
- Có test chứng minh field được đánh dấu nhạy cảm không xuất hiện trong response API khi người gọi
  không đủ quyền.
- Coverage business logic ≥ 80%, viết test trước khi cài đặt (TDD).

**Ngoài phạm vi (không làm ở feature này):** đơn giá/lịch nguồn lực (billing rate, resource
calendar), WBS, lập lịch PERT/CPM, luồng Change Control Board (CCB) đầy đủ, đăng nhập SSO. Feature
này chỉ cần dựng đủ nền tảng để các phân hệ đó dùng lại sau.

---

## Ambiguities to raise in /speckit-clarify

Đã loại bỏ mọi điểm đã có quyết định trong `docs/04-decisions/INDEX.md` (OI-01 → OI-18). 8 điểm dưới
đây **chưa** có câu trả lời trong bất kỳ nguồn nào:

1. **Ma trận quyền cụ thể theo vai trò × phân hệ cho giai đoạn 1.** OI-03 chỉ chốt tên 6 vai trò
   (Admin, Lãnh đạo danh mục, PM, Functional Manager, Thành viên, Tài chính) và nguyên tắc "role
   quyết định truy cập phân hệ nào", nhưng không có bảng ánh xạ vai trò → phân hệ/hành động cụ thể
   nào được phép ở giai đoạn 1 (Phân quyền + TASK + RES + WBS + SCH theo OI-18). Ví dụ: Thành viên có
   được xem dashboard EVM không? Tài chính có được sửa task không?
2. **Một user có thể thuộc nhiều tổ chức đồng thời không?** Nếu có, họ có thể giữ role khác nhau ở
   mỗi tổ chức không, và trải nghiệm chuyển đổi tổ chức (switch organization) hoạt động thế nào?
3. **Ai được tạo tổ chức mới?** Cho phép tự đăng ký (self-signup) tạo tổ chức mới hoàn toàn, hay chỉ
   được tạo qua lời mời/invitation từ một tổ chức đã tồn tại (hoặc chỉ do super-admin vận hành nền
   tảng tạo)? OI-17 chỉ chốt "web, đa tổ chức từ đầu, email/mật khẩu" chứ không nói ai khởi tạo
   tenant.
4. **Chính sách mật khẩu, khoá tài khoản, phiên đăng nhập.** Chưa có nguồn nào quy định độ dài/độ
   phức tạp mật khẩu tối thiểu, số lần đăng nhập sai trước khi khoá tài khoản, thời hạn phiên đăng
   nhập (session/token) hay có "remember me"/refresh token không.
5. **Ai được phép gán vai trò RACI cho thành viên dự án, và có ràng buộc số lượng Accountable mỗi dự
   án không?** FR-RES-04 chỉ nói "RACI Matrix cho công việc/dự án; phân quyền dựa trên RACI"; OI-07
   ngầm định có "người Accountable" (số ít) làm người áp dụng Baseline, nhưng không nói rõ hệ thống
   có ràng buộc **đúng một** Accountable/dự án (chuẩn RACI cổ điển) hay cho phép nhiều/không ai.
6. **Xoá/vô hiệu hoá thành viên tổ chức hoặc dự án xử lý dữ liệu lịch sử ra sao?** Khi xoá một
   project member hoặc vô hiệu hoá một user, các bản ghi RACI/audit trail liên quan tới họ trong quá
   khứ có bị xoá theo không, hay giữ lại (soft-delete) để không phá vỡ lịch sử/audit trail (constitution
   yêu cầu audit trail cho các quyết định quan trọng, dù đó là ở phạm vi Baseline/CHG chứ không trực
   tiếp nói về xoá thành viên)?
7. **Quyền của Admin tổ chức đối với dữ liệu dự án.** OI-03 nói "Quyền thực tế = RBAC **VÀ** thành
   viên dự án/RACI — thiếu một lớp = không có quyền", áp dụng nguyên văn thì Admin tổ chức cũng phải
   là thành viên dự án mới truy cập được dữ liệu dự án đó. Cần xác nhận: Admin có được một ngoại lệ
   ngầm định (toàn quyền trên mọi dự án trong tổ chức của mình) hay phải tuân thủ đúng quy tắc 2 lớp
   như mọi vai trò khác?

8. **Mỗi thành viên tổ chức giữ 1 hay nhiều vai trò hệ thống (role) cùng lúc?** Ví dụ một người vừa là
   PM vừa là Tài chính. OI-03 chỉ liệt kê tập vai trò, không nói cardinality. Nếu nhiều vai trò: quyền
   hợp nhất theo phép hợp (union) các vai trò? Câu trả lời ảnh hưởng trực tiếp mô hình dữ liệu RBAC
   (`organizationMembership` giữ 1 `role` hay danh sách `role`). *(Bổ sung khi review intake.)*

## Thuật ngữ mới (append vào glossary)

Chưa có trong `docs/00-glossary.md`; đề xuất để người phụ trách append trong branch feature này (rule
5 `CLAUDE.md`). Cột "Nguồn" ghi rõ item nào là suy luận (giả định) thay vì trích nguyên văn nguồn.

| Tiếng Việt | English | Định danh code gợi ý | Ghi chú | Nguồn |
|---|---|---|---|---|
| Quản trị viên tổ chức | Organization Admin | `admin` | Giá trị của `role` (đã có trong glossary); toàn quyền quản trị tổ chức | OI-03 |
| Lãnh đạo danh mục | Portfolio Lead | `portfolioLead` | Giá trị của `role`; khác `portfolio` (thực thể danh mục dự án, đã có trong glossary) | OI-03, §1.4 |
| Thành viên (vai trò hệ thống) | Member | `member` | Giá trị mặc định/thấp nhất của `role` | OI-03 |
| Tài chính (vai trò hệ thống) | Finance | `finance` | Giá trị của `role`; ứng viên chính được xem field nhạy cảm `billingRate`/`budgetAtCompletion` ở phân hệ sau | OI-03, NFR-01 |
| Thành viên tổ chức | Organization Membership | `organizationMembership` | Bản ghi quan hệ user–organization kèm `role`; khác `projectMember` (quan hệ user–project) đã có trong glossary | OI-03, OI-17 (định danh — **giả định**, suy luận từ nhu cầu triển khai RBAC, không có câu chữ trực tiếp trong SRS) |
| Lời mời tham gia tổ chức | Organization Invitation | `organizationInvitation` | Luồng mời user (theo email) vào tổ chức; trạng thái pending/accepted/expired | **Giả định** — phạm vi issue #5, không có nguồn SRS/OI trực tiếp; xem Ambiguities #3 |
| Phiên đăng nhập | Session | `authSession` | Vòng đời đăng nhập sau khi xác thực email/mật khẩu | OI-17 (chỉ chốt "email/mật khẩu", không định nghĩa session) — **giả định** cần cho auth; chính sách cụ thể xem Ambiguities #4 |

## Suggested constitution amendments

- **Đề xuất bổ sung nhỏ vào Nguyên tắc II hoặc III:** hiện constitution chốt nguyên tắc "RBAC + RACI,
  mặc định từ chối" nhưng không yêu cầu **tài liệu hoá tường minh ma trận vai trò × phân hệ/quyền**
  trước khi implement. Vì SRS không có ma trận này (xem Ambiguities #1) và các phân hệ tương lai sẽ
  tiếp tục thêm role/permission mới, nên cân nhắc thêm câu: *"Mọi vai trò RBAC mới hoặc thay đổi tập
  quyền của vai trò hiện có PHẢI có bảng ánh xạ vai trò × phân hệ/hành động tường minh trong spec/plan
  trước khi implement; cấm suy diễn quyền ngầm định trong code."* Điều này giúp tránh việc mỗi feature
  sau tự "đoán" quyền của Admin/Finance/Member theo cách khác nhau.
- Không có đề xuất khác — Nguyên tắc III (phân quyền 2 lớp, bảo vệ field nhạy cảm, cô lập tenant),
  Nguyên tắc IV (TDD, coverage 80%) và Ràng buộc nền tảng (i18n, UTC) đã bao phủ đủ các yêu cầu còn
  lại của feature này.
