# Feature Specification: Quản lý tổ chức và phân quyền truy cập (organization-access)

**Feature Branch**: `005-organization-access` (GitHub issue #5) · spec dir `specs/20260914-224646-organization-access`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "Feature 'Quản lý tổ chức và phân quyền truy cập' (organization-access) — nền tảng đa tổ chức và kiểm soát truy cập 2 lớp (RBAC tổ chức + RACI dự án), bảo vệ field nhạy cảm, i18n VI/EN. Nguồn truy vết: `docs/intake/005-organization-access.md`."

**Truy vết nguồn**: SRS `docs/01-basic-design/_project/srs-v1.md` (§1.4, FR-RES-04, NFR-01) · decisions OI-03, OI-07, OI-14, OI-17, OI-18 · constitution Nguyên tắc III, IV, VII.

## Clarifications

### Session 2026-09-14 (trong `/speckit-specify`)

- Q: Ai được khởi tạo tổ chức? → A: Chỉ **người vận hành nền tảng** (Platform Operator) tạo tổ chức và mời
  Admin đầu tiên (decision `2026-09-14-005-organization-creation`).
- Q: Ma trận quyền giai đoạn 1? → A: Dùng ma trận đề xuất, ghi ở FR-013 (decision
  `2026-09-14-005-phase1-permission-matrix`).
- Q: Một tài khoản thuộc nhiều tổ chức? → A: **Có** — mỗi tổ chức có vai trò riêng, người dùng chọn tổ chức
  đang làm việc (decision `2026-09-14-005-multi-organization-membership`).

### Session 2026-09-14 (`/speckit-clarify`)

- Q: Một thành viên tổ chức được giữ nhiều vai trò hệ thống cùng lúc, hay chỉ đúng một vai trò? → A:
  Nhiều vai trò cùng lúc; quyền = hợp (union) quyền của các vai trò đang giữ.
- Q: Có chấp nhận chính sách mật khẩu/phiên (≥ 12 ký tự + chặn mật khẩu phổ biến, khoá 15 phút sau 5 lần
  sai, hết phiên sau 8 giờ không hoạt động) và có cần "ghi nhớ đăng nhập" không? → A: Chấp nhận chính
  sách; không có "ghi nhớ đăng nhập".
- Q: Mỗi dự án tối đa một Accountable và được phép chưa có, hay luôn đúng một Accountable? → A: Luôn
  đúng một Accountable — người tạo dự án mặc định là Accountable; chỉ được thay bằng thành viên dự án
  khác, không được gỡ để trống.
- Q: Admin có kích hoạt lại được thành viên đã bị vô hiệu hoá không? → A: Có; người đó quay về với vai trò
  mặc định Thành viên, không tự khôi phục vai trò cũ và tư cách thành viên dự án/RACI.
- Q: v1 có bắt buộc chức năng "quên mật khẩu" không? → A: Có — liên kết đặt lại qua email, dùng một lần,
  hết hạn sau 1 giờ; đặt lại xong huỷ mọi phiên đang mở; phản hồi không tiết lộ email có tồn tại hay không.
  Không cần bước xác minh email riêng (email được xác minh khi chấp nhận lời mời).

### Session 2026-09-15 (sửa sau `/speckit-analyze`)

- Q: Dự án do Lãnh đạo danh mục tạo không thêm được thành viên (deadlock) — xử lý thế nào? → A: Lãnh đạo danh mục
  được quản lý thành viên dự án; RACI vẫn chỉ PM (decision `2026-09-15-005-portfolio-lead-manages-project-members`).
- Q: Đăng nhập tự chọn tổ chức đang hoạt động nào? → A: đúng 1 membership active → tự chọn; nhiều → tổ chức dùng gần
  nhất nếu còn active, không thì người dùng chọn; không có membership active → chưa có tổ chức đang hoạt động.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cô lập dữ liệu giữa các tổ chức (Priority: P1)

Một tổ chức (organization) được tạo ra và mọi dữ liệu nghiệp vụ của nó (thành viên, vai trò, dự án,
RACI) chỉ tồn tại trong phạm vi tổ chức đó. Người dùng của tổ chức A không thể đọc hay ghi bất kỳ dữ
liệu nào của tổ chức B, kể cả khi gửi yêu cầu trực tiếp tới hệ thống mà không qua giao diện.

**Why this priority**: Là điều kiện an toàn tối thiểu của một hệ thống đa tổ chức (constitution Nguyên
tắc III, OI-17). Mọi phân hệ khác xây trên nền này; lỗi ở đây là lộ dữ liệu khách hàng.

**Independent Test**: Tạo 2 tổ chức A và B, mỗi tổ chức có người dùng và dự án; dùng danh tính người
dùng A thực hiện mọi thao tác đọc/ghi nhắm vào định danh dữ liệu của B → tất cả bị từ chối và không
tiết lộ sự tồn tại của dữ liệu B.

**Acceptance Scenarios**:

1. **Given** người dùng X là thành viên tổ chức A, **When** X yêu cầu xem danh sách dự án, **Then** chỉ
   dự án của A được trả về.
2. **Given** dự án P thuộc tổ chức B, **When** X (thuộc A) gửi yêu cầu trực tiếp đọc, sửa hoặc xoá P
   theo định danh của P, **Then** hệ thống từ chối và phản hồi giống hệt trường hợp P không tồn tại.
3. **Given** X thuộc A, **When** X cố thêm thành viên, gán vai trò hoặc gán RACI cho đối tượng thuộc B,
   **Then** hệ thống từ chối và không có thay đổi nào ở B.

---

### User Story 2 - Khởi tạo tổ chức, tạo tài khoản và đăng nhập (Priority: P1)

Người vận hành nền tảng (Platform Operator) tạo tổ chức và mời Admin đầu tiên theo email. Người được mời
tạo tài khoản bằng email + mật khẩu khi chấp nhận lời mời (hoặc dùng tài khoản sẵn có), rồi đăng nhập.
Người dùng thuộc nhiều tổ chức chọn tổ chức đang làm việc.

**Why this priority**: Không có danh tính và tổ chức thì không có gì để phân quyền (OI-17: email/mật
khẩu, SSO để sau).

**Independent Test**: Operator tạo tổ chức A và mời email X làm Admin → X tạo tài khoản qua lời mời, đăng
nhập và thấy mình là Admin của A; đăng xuất rồi đăng nhập sai mật khẩu → bị từ chối.

**Acceptance Scenarios**:

1. **Given** Platform Operator, **When** tạo tổ chức A và mời email X làm Admin, **Then** A được tạo và
   có lời mời Admin chờ cho X.
2. **Given** người dùng không phải Platform Operator (kể cả Admin của tổ chức khác), **When** tạo tổ
   chức, **Then** bị từ chối.
3. **Given** X chưa có tài khoản và có lời mời hợp lệ, **When** X chấp nhận lời mời và đặt mật khẩu hợp
   lệ, **Then** tài khoản được tạo, X đăng nhập được và là Admin của A.
4. **Given** tài khoản đã tồn tại, **When** đăng nhập với mật khẩu sai, **Then** bị từ chối với thông
   báo chung, không tiết lộ email có tồn tại hay không.
5. **Given** không có lời mời, **When** một người tự tạo tài khoản, **Then** bị từ chối (tài khoản chỉ
   được tạo qua lời mời).
6. **Given** X quên mật khẩu, **When** X yêu cầu đặt lại và dùng liên kết trong email trong vòng 1 giờ để
   đặt mật khẩu mới hợp lệ, **Then** X đăng nhập được bằng mật khẩu mới, mọi phiên cũ bị huỷ, và liên kết
   không dùng lại được.
7. **Given** X là thành viên của tổ chức A và B, **When** X đăng nhập, **Then** X chọn tổ chức đang làm
   việc và chỉ thấy dữ liệu của tổ chức đó; chuyển sang B thì chỉ thấy dữ liệu của B.

---

### User Story 3 - Mời thành viên và gán vai trò hệ thống (Priority: P1)

Admin mời người dùng (theo email) vào tổ chức. Sau khi người được mời chấp nhận, họ trở thành thành viên
tổ chức; Admin gán vai trò hệ thống (role) cho họ. Vai trò quyết định họ được truy cập phân hệ nào.

**Why this priority**: Lớp 1 của mô hình phân quyền (OI-03); không có thành viên và vai trò thì không
kiểm tra được quyền ở các story sau.

**Independent Test**: Admin mời email Y; Y chấp nhận; Admin gán vai trò PM cho Y → Y truy cập được phân
hệ PM được phép và bị từ chối ở phân hệ không được phép theo ma trận quyền.

**Acceptance Scenarios**:

1. **Given** Admin của tổ chức A, **When** mời email Y, **Then** một lời mời ở trạng thái chờ được tạo
   cho Y trong tổ chức A.
2. **Given** lời mời hợp lệ cho Y, **When** Y chấp nhận (đăng ký mới hoặc đăng nhập tài khoản sẵn có),
   **Then** Y trở thành thành viên của A với vai trò ghi trong lời mời (mặc định Thành viên — Member; lời
   mời Admin đầu tiên do Operator tạo mang vai trò Admin).
3. **Given** lời mời đã hết hạn hoặc đã bị thu hồi, **When** Y chấp nhận, **Then** bị từ chối.
4. **Given** Y là thành viên A, **When** Admin gán vai trò hệ thống cho Y, **Then** quyền truy cập phân
   hệ của Y thay đổi đúng theo ma trận quyền, có hiệu lực ở yêu cầu kế tiếp của Y.
5. **Given** người dùng không phải Admin, **When** mời thành viên hoặc gán vai trò, **Then** bị từ chối.
6. **Given** A chỉ còn đúng một Admin, **When** gỡ vai trò Admin của người đó hoặc vô hiệu hoá họ,
   **Then** bị từ chối (tổ chức luôn có ít nhất một Admin).
7. **Given** Y từng là PM rồi bị vô hiệu hoá, **When** Admin kích hoạt lại Y, **Then** Y hoạt động trở lại
   chỉ với vai trò Thành viên, không là thành viên dự án nào, và lịch sử cũ của Y vẫn còn.

---

### User Story 4 - Dự án và thành viên dự án (Priority: P2)

Người có quyền tạo dự án tạo dự án trong tổ chức; PM hoặc Lãnh đạo danh mục là thành viên dự án thêm/xoá
thành viên dự án (project member) từ các thành viên tổ chức.

**Why this priority**: Lớp 2 của mô hình phân quyền cần có dự án và thành viên dự án; ở feature này dự án
chỉ ở mức tối thiểu (tên, mô tả) để làm phạm vi phân quyền.

**Independent Test**: PM tạo dự án P, thêm thành viên Z → Z xuất hiện trong danh sách thành viên P; xoá
Z → Z mất quyền truy cập cấp dự án của P ngay yêu cầu kế tiếp.

**Acceptance Scenarios**:

1. **Given** người dùng có quyền tạo dự án theo ma trận quyền, **When** tạo dự án P, **Then** P thuộc
   tổ chức của người đó, người tạo là thành viên của P và là Accountable của P.
2. **Given** người dùng không có quyền tạo dự án, **When** tạo dự án, **Then** bị từ chối.
3. **Given** Z là thành viên tổ chức A, **When** người quản lý thành viên dự án (PM hoặc Lãnh đạo danh mục là thành
   viên P, thuộc A) thêm Z vào P, **Then** Z là thành viên của P.
4. **Given** người dùng W không thuộc tổ chức A, **When** thêm W vào P, **Then** bị từ chối.
5. **Given** Z là thành viên của P, **When** xoá Z khỏi P, **Then** Z không còn truy cập cấp dự án vào P,
   và các bản ghi lịch sử liên quan tới Z vẫn được giữ.

---

### User Story 5 - Gán RACI và tra cứu Accountable (Priority: P2)

PM gán vai trò RACI (Responsible, Accountable, Consulted, Informed) cho thành viên dự án. Các phân hệ sau
(ví dụ Change Control) hỏi hệ thống "người dùng X có phải Accountable của dự án Y không" và nhận câu trả
lời đáng tin cậy.

**Why this priority**: OI-07 cần xác định người Accountable để áp dụng Baseline; FR-RES-04 yêu cầu
ma trận RACI. Chưa có phân hệ tiêu thụ trong feature này nên đứng sau P1.

**Independent Test**: Tạo dự án P → người tạo là Accountable; chuyển Accountable cho Z → tra cứu (Z, P)
trả "có", (người tạo, P) trả "không"; thử gỡ Accountable để trống → bị từ chối.

**Acceptance Scenarios**:

1. **Given** dự án P vừa được tạo bởi U, **When** tra cứu Accountable của P, **Then** kết quả là U.
2. **Given** P có Accountable là Z và T là thành viên của P, **When** PM gán Accountable cho T, **Then** T
   thay thế Z làm Accountable (luôn đúng một Accountable) và việc thay thế được ghi lại.
3. **Given** P có Accountable là Z, **When** gỡ vai trò Accountable của Z mà không chỉ định người thay,
   **Then** bị từ chối.
4. **Given** W không phải thành viên của P, **When** gán bất kỳ vai trò RACI nào cho W trong P, **Then**
   bị từ chối.
5. **Given** Z (không phải Accountable) bị xoá khỏi P, **When** tra cứu RACI của Z trong P, **Then** Z không
   còn giữ vai trò RACI nào trong P.
6. **Given** Z đang là Accountable của P, **When** xoá Z khỏi P, **Then** bị từ chối cho tới khi
   Accountable được chuyển cho thành viên khác.

---

### User Story 6 - Quyết định quyền 2 lớp, mặc định từ chối (Priority: P1)

Mọi hành động cấp dự án chỉ được phép khi người dùng có vai trò hệ thống cho phép hành động đó **và** là
thành viên dự án (hoặc giữ vai trò RACI mà hành động đó yêu cầu). Mọi trường hợp không được cho phép
tường minh đều bị từ chối.

**Why this priority**: Là quy tắc cốt lõi của OI-03 và constitution Nguyên tắc III; mọi phân hệ sau dùng
lại.

**Independent Test**: Chuẩn bị 4 tổ hợp (có/không vai trò hệ thống phù hợp × có/không là thành viên dự
án) cho cùng một hành động cấp dự án → chỉ tổ hợp "có × có" được phép.

**Acceptance Scenarios**:

1. **Given** Y có vai trò hệ thống cho phép hành động H nhưng không là thành viên dự án P, **When** Y thực
   hiện H trên P, **Then** bị từ chối.
2. **Given** Y là thành viên dự án P nhưng vai trò hệ thống không cho phép H, **When** Y thực hiện H trên
   P, **Then** bị từ chối.
3. **Given** Y có vai trò cho phép H và là thành viên P, **When** Y thực hiện H trên P, **Then** được phép.
4. **Given** một hành động chưa được khai báo trong ma trận quyền, **When** bất kỳ ai thực hiện, **Then**
   bị từ chối.
5. **Given** Y vừa bị gỡ vai trò hoặc bị xoá khỏi dự án, **When** Y thực hiện H ở yêu cầu kế tiếp,
   **Then** quyết định quyền phản ánh trạng thái mới.

---

### User Story 7 - Bảo vệ field nhạy cảm dùng chung (Priority: P2)

Hệ thống cung cấp cơ chế dùng chung để đánh dấu một trường dữ liệu là nhạy cảm (như đơn giá, ngân sách),
kèm quyền cần có để xem nó. Khi người yêu cầu không đủ quyền, trường đó hoàn toàn không có trong dữ liệu
trả về — không phải chỉ bị ẩn trên giao diện.

**Why this priority**: Constitution Nguyên tắc III và NFR-01 bắt buộc; phân hệ RES/EVM sẽ áp dụng thật.
Feature này chỉ dựng cơ chế và chứng minh bằng một trường mẫu.

**Independent Test**: Với một trường mẫu được đánh dấu nhạy cảm, cùng một yêu cầu đọc từ người có quyền
và người không có quyền → người có quyền nhận trường đó, người không có quyền nhận dữ liệu không chứa
trường đó (không có khoá, không có giá trị rỗng thay thế).

**Acceptance Scenarios**:

1. **Given** trường S được đánh dấu nhạy cảm yêu cầu quyền "xem dữ liệu tài chính", **When** người có
   quyền đó đọc bản ghi, **Then** S có trong kết quả.
2. **Given** như trên, **When** người không có quyền đọc bản ghi (kể cả trong danh sách, xuất dữ liệu hay
   thông báo lỗi), **Then** S không xuất hiện ở bất kỳ dạng nào.
3. **Given** người không có quyền, **When** cố ghi giá trị cho S, **Then** bị từ chối.

---

### User Story 8 - Song ngữ và thời gian UTC (Priority: P3)

Mọi màn hình và thông báo của feature hiển thị được bằng Tiếng Việt và English theo lựa chọn của người
dùng; mọi thời điểm (tạo tài khoản, lời mời, thay đổi vai trò) được lưu theo UTC và hiển thị theo múi
giờ người dùng.

**Why this priority**: Ràng buộc nền tảng (OI-17) nhưng không chặn giá trị của các story trên.

**Independent Test**: Đổi ngôn ngữ người dùng VI ↔ EN → mọi nhãn, thông báo lỗi của feature đổi theo, không
còn chuỗi cố định ngôn ngữ; tạo lời mời lúc 23:30 giờ Việt Nam → thời điểm lưu là 16:30 UTC cùng ngày.

**Acceptance Scenarios**:

1. **Given** người dùng chọn English, **When** mở bất kỳ màn hình nào của feature, **Then** mọi nhãn và
   thông báo bằng English.
2. **Given** một chuỗi hiển thị thiếu bản dịch, **When** kiểm tra, **Then** việc thiếu được phát hiện
   trước khi phát hành.
3. **Given** người dùng ở múi giờ UTC+7, **When** xem thời điểm tạo lời mời, **Then** hiển thị theo UTC+7
   trong khi giá trị lưu là UTC.

---

### Edge Cases

- Người dùng thuộc nhiều tổ chức: sau đăng nhập tự vào tổ chức dùng gần nhất nếu membership còn active, không
  thì người dùng chọn; chỉ có 1 membership active thì tự chọn; mọi yêu cầu chỉ trong tổ chức đang hoạt động; bị vô hiệu hoá ở A không ảnh hưởng tư cách ở B.
- Mời email đã có tài khoản và đang thuộc tổ chức khác → lời mời hợp lệ; chấp nhận thêm tư cách thành
  viên, không tạo tài khoản mới.
- Tổ chức vừa tạo mà lời mời Admin đầu tiên hết hạn → Operator gửi lại lời mời; tổ chức chưa có Admin
  hoạt động thì không ai trong tổ chức thao tác được.
- Lời mời gửi tới email đã là thành viên của tổ chức → không tạo lời mời trùng, báo đã là thành viên.
- Mời cùng một email nhiều lần khi lời mời cũ còn hiệu lực → lời mời cũ bị thay thế, chỉ một lời mời có
  hiệu lực.
- Admin cuối cùng tự gỡ vai trò Admin, tự rời tổ chức hoặc bị vô hiệu hoá → bị chặn.
- Xoá thành viên dự án đang là Accountable → bị từ chối cho tới khi chuyển Accountable cho người khác.
- Vô hiệu hoá thành viên tổ chức đang là Accountable của bất kỳ dự án nào → bị từ chối cho tới khi các dự
  án đó chuyển Accountable (tương tự quy tắc Admin cuối cùng).
- Người tạo dự án có vai trò Lãnh đạo danh mục (không có quyền quản lý RACI) → vẫn là Accountable mặc định;
  Lãnh đạo danh mục thêm PM vào dự án, rồi PM chuyển Accountable nếu cần.
- Vô hiệu hoá tài khoản người dùng đang có phiên đăng nhập → phiên mất hiệu lực ở yêu cầu kế tiếp.
- Yêu cầu đặt lại mật khẩu cho email không tồn tại → phản hồi giống hệt email có tồn tại; không gửi email.
- Dùng liên kết đặt lại đã hết hạn, đã dùng, hoặc không phải liên kết mới nhất → bị từ chối.
- Đăng nhập sai 5 lần liên tiếp → khoá đăng nhập 15 phút; đăng nhập đúng trong thời gian khoá vẫn bị từ
  chối; hết thời gian khoá thì bộ đếm về 0 (FR-006).
- Định danh dữ liệu thuộc tổ chức khác hoặc không tồn tại → phản hồi giống nhau (không lộ tồn tại).
- Người dùng bị xoá khỏi tổ chức → đồng thời mất tư cách thành viên mọi dự án và vai trò RACI trong tổ
  chức đó; lịch sử vẫn giữ.

## Requirements *(mandatory)*

### Functional Requirements

**Tổ chức & cô lập dữ liệu**

- **FR-001**: Hệ thống MUST gắn mọi dữ liệu nghiệp vụ (thành viên, vai trò, lời mời, dự án, thành viên dự
  án, RACI) với đúng một tổ chức.
- **FR-002**: Hệ thống MUST chỉ trả về và cho phép thay đổi dữ liệu thuộc tổ chức mà người yêu cầu đang
  hoạt động trong đó, ở mọi đường truy cập (giao diện, yêu cầu trực tiếp, danh sách, tìm kiếm, xuất dữ
  liệu).
- **FR-003**: Hệ thống MUST phản hồi yêu cầu nhắm vào dữ liệu của tổ chức khác giống hệt yêu cầu nhắm vào
  dữ liệu không tồn tại.
- **FR-004**: Chỉ **Platform Operator** MUST được tạo tổ chức; khi tạo, Operator mời Admin đầu tiên theo
  email. Platform Operator là vai trò cấp nền tảng, **không** thuộc tổ chức nào và **không** có quyền đọc
  dữ liệu nghiệp vụ bên trong tổ chức (dự án, thành viên dự án, RACI); chỉ quản lý vòng đời tổ chức và
  lời mời Admin.

**Tài khoản & xác thực**

- **FR-005**: Người dùng MUST đăng nhập được bằng email + mật khẩu; tài khoản chỉ được tạo khi chấp nhận
  lời mời (không có tự đăng ký tự do); email là duy nhất trên toàn hệ thống, không phân biệt hoa thường.
- **FR-006**: Hệ thống MUST áp dụng chính sách mật khẩu và chống đoán mật khẩu: mật khẩu tối thiểu 12 ký
  tự, từ chối mật khẩu nằm trong danh sách phổ biến/đã lộ; khoá đăng nhập tạm thời 15 phút sau 5 lần sai
  liên tiếp.
- **FR-007**: Hệ thống MUST kết thúc phiên đăng nhập sau 8 giờ không hoạt động và cho phép người dùng
  đăng xuất; phiên của tài khoản bị vô hiệu hoá mất hiệu lực ở yêu cầu kế tiếp. Hệ thống MUST NOT cung
  cấp tuỳ chọn "ghi nhớ đăng nhập" (phiên không kéo dài quá giới hạn không hoạt động).
- **FR-008**: Thông báo lỗi đăng nhập, chấp nhận lời mời và đặt lại mật khẩu MUST NOT tiết lộ một email đã
  có tài khoản hay chưa.
- **FR-031**: Người dùng MUST đặt lại được mật khẩu qua email: yêu cầu đặt lại gửi một liên kết dùng một
  lần, hết hạn sau 1 giờ, chỉ liên kết mới nhất còn hiệu lực; mật khẩu mới tuân theo FR-006; đặt lại thành
  công thì mọi phiên đang mở của tài khoản bị huỷ; tài khoản bị vô hiệu hoá ở mọi tổ chức vẫn đặt lại được
  nhưng không truy cập được tổ chức nào. Email coi như đã xác minh khi chấp nhận lời mời — không có bước
  xác minh email riêng.

**Thành viên tổ chức, lời mời & vai trò hệ thống**

- **FR-009**: Admin MUST mời được người dùng theo email vào tổ chức; lời mời có hạn 7 ngày, có thể thu hồi,
  chỉ dùng được một lần, và tối đa một lời mời còn hiệu lực cho mỗi email trong một tổ chức.
- **FR-010**: Người được mời MUST chấp nhận được lời mời bằng tài khoản sẵn có hoặc tài khoản đăng ký mới
  với đúng email được mời; khi chấp nhận, họ thành thành viên tổ chức với vai trò ghi trong lời mời
  (mặc định Thành viên).
- **FR-011**: Hệ thống MUST hỗ trợ tập vai trò hệ thống ban đầu: Admin, Lãnh đạo danh mục, Giám đốc dự án
  (PM), Quản lý chức năng, Thành viên, Tài chính (OI-03).
- **FR-012**: Admin MUST gán và gỡ được vai trò hệ thống cho thành viên tổ chức; mỗi thành viên có thể giữ
  nhiều vai trò cùng lúc và quyền của họ là hợp (union) của quyền các vai trò đang giữ; gỡ một vai trò chỉ
  làm mất những quyền không còn được vai trò khác cấp.
- **FR-013**: Quyền truy cập theo vai trò hệ thống MUST tuân theo ma trận quyền giai đoạn 1 dưới đây
  (✓ = vai trò cho phép; hành động cấp dự án còn phải thoả FR-022). Mọi ô trống là **từ chối**:

  | Hành động | Admin | Lãnh đạo danh mục | PM | Functional Manager | Thành viên | Tài chính |
  |---|---|---|---|---|---|---|
  | Mời thành viên, gán/gỡ vai trò, vô hiệu hoá/kích hoạt lại thành viên tổ chức | ✓ | | | | | |
  | Xem danh sách thành viên tổ chức | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
  | Tạo dự án | | ✓ | ✓ | | | |
  | Quản lý thành viên dự án (thêm/xoá) | | ✓ | ✓ | | | |
  | Quản lý RACI (gán R/C/I, chuyển Accountable) | | | ✓ | | | |
  | Xem dự án, thành viên dự án, RACI | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
  | Truy cập phân hệ TASK, WBS, SCH | | ✓ | ✓ | ✓ | ✓ | |
  | Truy cập phân hệ RES (lịch, kỹ năng) | | ✓ | ✓ | ✓ | | |
  | Xem trường tài chính nhạy cảm | | ✓ | ✓ | | | ✓ |
  | Sửa trường tài chính nhạy cảm | | ✓ | ✓ | | | ✓ |

  Các hàng TASK/WBS/SCH/RES chỉ khai báo quyền vào phân hệ; hành động chi tiết bên trong mỗi phân hệ do
  feature tương ứng bổ sung vào ma trận.
- **FR-014**: Tổ chức MUST luôn có ít nhất một Admin đang hoạt động; thao tác làm mất Admin cuối cùng bị
  từ chối.
- **FR-015**: Admin MUST vô hiệu hoá được thành viên tổ chức; thành viên bị vô hiệu hoá mất mọi quyền trong
  tổ chức, mất tư cách thành viên dự án và vai trò RACI tương ứng, nhưng dữ liệu lịch sử gắn với họ vẫn
  được giữ. Vô hiệu hoá bị từ chối nếu người đó là Admin cuối cùng (FR-014) hoặc đang là Accountable của
  dự án nào (FR-020). Admin MUST kích hoạt lại được thành viên đã bị vô hiệu hoá: người đó quay về trạng
  thái hoạt động với vai trò mặc định Thành viên, không tự khôi phục vai trò hệ thống cũ, tư cách thành
  viên dự án hay vai trò RACI; lịch sử trước khi vô hiệu hoá vẫn gắn với cùng tài khoản.
- **FR-016**: Admin tổ chức MUST NOT có quyền ngầm định trên dữ liệu dự án; muốn thao tác cấp dự án, Admin
  cũng phải thoả quy tắc 2 lớp (FR-022).
- **FR-017**: Một tài khoản MAY là thành viên của nhiều tổ chức, với vai trò và trạng thái riêng ở từng
  tổ chức. Mỗi yêu cầu MUST gắn với đúng một **tổ chức đang hoạt động**, người dùng chỉ chọn được tổ chức
  mà họ là thành viên đang hoạt động; FR-002 áp dụng theo tổ chức đang hoạt động.

**Dự án & thành viên dự án**

- **FR-018**: Người có quyền tạo dự án (theo FR-013) MUST tạo được dự án trong tổ chức với tên (bắt buộc)
  và mô tả (tuỳ chọn); người tạo tự động là thành viên dự án và là Accountable của dự án.
- **FR-019**: Người có quyền quản lý thành viên dự án MUST thêm/xoá được thành viên dự án, chỉ chọn từ
  thành viên đang hoạt động của cùng tổ chức.

**RACI**

- **FR-020**: Người có quyền quản lý RACI MUST gán/gỡ được vai trò RACI (Responsible, Accountable,
  Consulted, Informed) cho thành viên dự án ở cấp dự án; một thành viên có thể giữ nhiều vai trò RACI;
  mỗi dự án MUST luôn có **đúng một** Accountable là thành viên đang hoạt động của dự án. Thay Accountable
  là thao tác thay thế một bước (người mới nhận, người cũ mất vai trò Accountable); mọi thao tác làm dự án
  không còn Accountable (gỡ vai trò, xoá khỏi dự án, vô hiệu hoá trong tổ chức) bị từ chối.
- **FR-021**: Hệ thống MUST cung cấp một phép tra cứu dùng chung trả lời "người dùng X có phải Accountable
  của dự án Y" và "Accountable hiện tại của dự án Y là ai", để các phân hệ sau dùng lại.

**Quyết định quyền**

- **FR-022**: Hệ thống MUST cho phép một hành động cấp dự án chỉ khi người yêu cầu có vai trò hệ thống cho
  phép hành động đó **và** là thành viên đang hoạt động của dự án (và giữ vai trò RACI nếu hành động yêu
  cầu); mọi trường hợp khác bị từ chối.
- **FR-023**: Hệ thống MUST từ chối mọi hành động chưa được khai báo trong ma trận quyền (mặc định từ chối).
- **FR-024**: Mọi kiểm tra quyền MUST thực hiện ở phía hệ thống cho mọi yêu cầu, không dựa vào việc giao
  diện ẩn chức năng; thay đổi vai trò/thành viên có hiệu lực từ yêu cầu kế tiếp.

**Field nhạy cảm**

- **FR-025**: Hệ thống MUST cung cấp cơ chế dùng chung để đánh dấu trường dữ liệu là nhạy cảm kèm quyền
  cần có; trường đó bị loại khỏi mọi dữ liệu trả về (chi tiết, danh sách, xuất dữ liệu, thông báo lỗi)
  khi người yêu cầu thiếu quyền, và mọi thao tác ghi vào trường đó bị từ chối.
- **FR-026**: Cơ chế ở FR-025 MUST được chứng minh bằng ít nhất một trường mẫu có kiểm thử cho cả người
  có quyền và không có quyền.

**Audit, i18n & thời gian**

- **FR-027**: Hệ thống MUST ghi nhật ký kiểm toán (ai, khi nào, đối tượng, giá trị trước/sau) cho: khởi
  tạo tổ chức và thao tác của Platform Operator, chuyển tổ chức đang hoạt động, mời/thu hồi/chấp nhận lời mời, gán/gỡ vai trò hệ thống, vô hiệu hoá thành viên, thêm/xoá
  thành viên dự án, gán/gỡ RACI, kích hoạt lại thành viên, yêu cầu và hoàn tất đặt lại mật khẩu, và các lần bị từ chối vì thiếu quyền trên dữ liệu dự án.
- **FR-028**: Nhật ký kiểm toán và thông tin nhật ký MUST NOT chứa mật khẩu, liên kết/mã đặt lại mật khẩu,
  mã lời mời hay giá trị của trường nhạy cảm.
- **FR-029**: Mọi chuỗi hiển thị của feature MUST có bản Tiếng Việt và English; người dùng chọn được ngôn
  ngữ; thiếu bản dịch phải phát hiện được trước khi phát hành.
- **FR-030**: Mọi thời điểm MUST được lưu theo UTC và hiển thị theo múi giờ của người dùng.

### Key Entities *(include if feature involves data)*

- **Organization (Tổ chức)**: đơn vị cô lập dữ liệu; tên, trạng thái, thời điểm tạo. Chứa thành viên, lời
  mời, dự án.
- **Platform Operator (Người vận hành nền tảng)**: vai trò cấp nền tảng, ngoài mọi tổ chức; tạo tổ chức và
  mời Admin đầu tiên; không đọc dữ liệu nghiệp vụ trong tổ chức.
- **User (Người dùng)**: tài khoản đăng nhập; email duy nhất, thông tin xác thực, ngôn ngữ và múi giờ ưa
  thích, trạng thái (hoạt động/vô hiệu hoá).
- **Organization Membership (Thành viên tổ chức)**: quan hệ User – Organization (một User có thể có nhiều
  membership); trạng thái, tập vai trò hệ thống đang giữ trong tổ chức đó.
- **Role (Vai trò hệ thống)**: một trong 6 vai trò ban đầu; ánh xạ tới tập hành động được phép qua ma trận
  quyền.
- **Organization Invitation (Lời mời)**: email được mời, tổ chức, người mời, vai trò khi chấp nhận, trạng thái (chờ/đã chấp nhận/
  hết hạn/thu hồi), hạn dùng.
- **Project (Dự án)**: thuộc một tổ chức; tên, mô tả, trạng thái — mức tối thiểu cho phân quyền.
- **Project Member (Thành viên dự án)**: quan hệ Organization Membership – Project; trạng thái.
- **RACI Assignment (Gán RACI)**: Project Member giữ một vai trò RACI (R/A/C/I) trong dự án; ràng buộc
  đúng một Accountable mỗi dự án.
- **Sensitive Field Policy (Chính sách field nhạy cảm)**: trường được đánh dấu nhạy cảm và quyền cần có để
  đọc/ghi.
- **Audit Entry (Bản ghi kiểm toán)**: người thực hiện, thời điểm UTC, hành động, đối tượng, giá trị
  trước/sau (đã loại dữ liệu nhạy cảm).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% kịch bản kiểm thử truy cập chéo tổ chức (đọc, sửa, xoá, liệt kê, gán thành viên/vai
  trò/RACI) bị từ chối, và phản hồi không phân biệt được với trường hợp dữ liệu không tồn tại.
- **SC-002**: 100% tổ hợp của bảng quyết định 2 lớp (vai trò hệ thống × thành viên dự án × RACI) cho mọi
  hành động trong ma trận quyền cho kết quả đúng như ma trận khai báo; mọi hành động không khai báo bị
  từ chối.
- **SC-003**: Platform Operator tạo tổ chức và gửi lời mời Admin đầu tiên trong dưới 2 phút; người được
  mời hoàn tất chấp nhận lời mời (kể cả tạo tài khoản) trong dưới 2 phút; người thuộc nhiều tổ chức chuyển
  tổ chức đang hoạt động trong dưới 5 giây.
- **SC-004**: Thay đổi vai trò, thành viên dự án hoặc vô hiệu hoá có hiệu lực ngay ở yêu cầu kế tiếp của
  người bị ảnh hưởng (0 yêu cầu được phép sau thay đổi mà lẽ ra phải bị từ chối).
- **SC-005**: Trường nhạy cảm mẫu không xuất hiện trong 100% phản hồi gửi tới người không đủ quyền trên mọi
  đường trả dữ liệu (chi tiết, danh sách, xuất dữ liệu, lỗi).
- **SC-006**: Với quy mô mục tiêu v1 (~200 người dùng đồng thời, 500 dự án/tổ chức — OI-14), quyết định
  quyền không làm các thao tác của feature chậm tới mức người dùng nhận thấy: 95% thao tác hoàn tất dưới
  1 giây.
- **SC-007**: 100% chuỗi hiển thị của feature có bản VI và EN; 100% thời điểm lưu theo UTC.
- **SC-008**: 100% hành động quản trị liệt kê ở FR-027 có bản ghi kiểm toán đầy đủ, và 0 bản ghi chứa mật
  khẩu hoặc giá trị nhạy cảm.
- **SC-009**: Người quên mật khẩu tự lấy lại quyền truy cập trong dưới 5 phút mà không cần Admin hay đội
  vận hành can thiệp; 100% liên kết đặt lại đã dùng hoặc quá 1 giờ bị từ chối.

## Assumptions

- **Vô hiệu hoá (FR-015):** vô hiệu hoá thay vì xoá cứng để giữ lịch sử và nhật ký kiểm toán; kích hoạt
  lại theo Clarifications. Xoá cứng dữ liệu cá nhân (nếu có yêu cầu pháp lý) nằm ngoài phạm vi feature.
- **Admin không có ngoại lệ (FR-016):** áp nguyên văn OI-03 và constitution Nguyên tắc III ("thiếu một lớp =
  không có quyền"); đã chốt cùng ma trận quyền (decision `2026-09-14-005-phase1-permission-matrix`).
- **Operator kiêm thành viên (FR-004):** một tài khoản có thể vừa có quyền Platform Operator vừa là thành viên
  tổ chức; hai tư cách tách biệt theo đường truy cập (`/platform/*` không bao giờ dùng tổ chức đang hoạt động).
- **Tài khoản chỉ qua lời mời (FR-005):** hệ quả của quyết định "chỉ Operator tạo tổ chức" — không có tổ
  chức nào để tự đăng ký vào, nên tài khoản được tạo khi chấp nhận lời mời.
- **Platform Operator (FR-004):** do đội vận hành Planix nắm giữ; cách cấp/quản lý tài khoản Operator là việc
  vận hành, không có màn hình tự phục vụ trong feature này.
- **Lời mời (FR-009, FR-010):** hạn 7 ngày, gửi qua email; nội dung/kênh gửi email chi tiết do plan quyết
  định. Vai trò mặc định khi chấp nhận là Thành viên.
- **Dự án tối thiểu:** chỉ tên, mô tả, trạng thái; các thuộc tính quản trị dự án khác thuộc feature sau
  (OI-18).
- **Trường nhạy cảm mẫu (FR-026):** chưa có trường nghiệp vụ nhạy cảm thật trong feature này; dùng một
  trường mẫu phục vụ kiểm thử, áp dụng thật ở phân hệ RES/EVM.
- **Ngoài phạm vi:** SSO, xác thực nhiều lớp (MFA), bước xác minh email riêng, billing rate/resource calendar,
  WBS, lập lịch, luồng CCB đầy đủ.
- **Phụ thuộc:** cần một kênh gửi email cho lời mời và đặt lại mật khẩu; tech stack chưa chốt và sẽ được chốt ở `/speckit-plan`
  bằng decision record (constitution — Ràng buộc nền tảng).
