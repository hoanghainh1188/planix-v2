### Đặc tả Yêu cầu Phần mềm (SRS) \- Hệ thống Quản lý Dự án Thông minh (Smart PM Suite)

#### 1\. GIỚI THIỆU TỔNG QUAN (INTRODUCTION)

**1.1. Mục tiêu hệ thống**&nbsp;&nbsp;

Smart PM Suite là hệ thống quản trị dự án tiên tiến được thiết kế để số hóa toàn diện các quy trình nghiệp vụ theo tiêu chuẩn PMBOK Guide (phiên bản 4 và 6). Mục tiêu cốt lõi của hệ thống là cung cấp một nền tảng tính toán chính xác tuyệt đối, hỗ trợ Project Manager (PM) chủ động phân tích nguyên nhân gốc rễ và đưa ra các quyết định phản hồi dựa trên dữ liệu định lượng, thay vì chỉ xử lý các triệu chứng bề nổi.

**1.2. Phạm vi hệ thống**&nbsp;&nbsp;

Tài liệu SRS này đặc tả 11 phân hệ chức năng tích hợp, đảm bảo tính tuân thủ nghiêm ngặt các công thức toán học quản trị dự án từ Source Context (PrepCast & Lehmann). Hệ thống khẳng định vai trò chủ động của PM trong việc kiểm soát các ràng buộc Triple Constraint (Phạm vi, Thời gian, Chi phí).

**1.3. Cam kết tuân thủ**&nbsp;&nbsp;

Hệ thống PHẢI ưu tiên các quy tắc quản trị từ PMBOK Guide làm logic nền tảng. Mọi tính toán và quy trình xử lý thay đổi PHẢI được thực hiện dựa trên dữ liệu thực tế và các kịch bản giả định chuyên sâu, loại bỏ hoàn toàn các yếu tố cảm tính trong quản trị.

#### 2\. PHÂN HỆ CHỨC NĂNG CỐT LÕI (CORE FUNCTIONAL MODULES)

##### 2.1. Phân hệ Lập tiến độ PERT/CPM & Mô phỏng mạng lưới

Phân hệ này PHẢI thực hiện tính toán thời gian thực cho mạng lưới công việc và đưa ra các ước tính có độ tin cậy cao.

* **Tính toán PERT:**  Hệ thống PHẢI áp dụng công thức trung bình trọng số:  $E \= (P \+ 4M \+ O) / 6$ .  
* **Quản lý biến số:**  Hệ thống PHẢI tính toán phương sai task  $V \= (P \- O) / 6^2$  và độ lệch chuẩn  $\\sigma \= (P \- O) / 6$ .  
* **Logic Đường găng (CPM):**  
* Hệ thống PHẢI tự động xác định Early Start (ES), Early Finish (EF), Late Start (LS), Late Finish (LF) theo công thức:  $EF \= ES \+ Duration \- 1$  và  $LS \= LF \- Duration \+ 1$ .  
* Hệ thống PHẢI xác định Đường găng dựa trên các công việc có Total Float bằng 0 ( $Float \= LS \- ES$ ).  
* **Khoảng tin cậy (Confidence Interval):**  Hệ thống PHẢI cung cấp báo cáo độ xác thực của tiến độ dựa trên các mức Sigma. Nếu một task có thời gian  $E$  và độ lệch chuẩn  $\\sigma$ , hệ thống PHẢI hiển thị các khoảng tin cậy:  
* 1  $\\sigma$  (68.26%):  $E \\pm 1\\sigma$ .  
* 2  $\\sigma$  (95.46%):  $E \\pm 2\\sigma$  (Ví dụ: Ước tính 29 ngày với  $\\sigma \= 3$  sẽ cho khoảng 23–35 ngày).  
* 3  $\\sigma$  (99.73%):  $E \\pm 3\\sigma$ .  
* **Tác động của Resource Leveling:**  Khi áp dụng kỹ thuật san bằng nguồn lực, hệ thống PHẢI tự động tính toán lại Đường găng và Total Float vì quá trình này có thể làm thay đổi hoàn toàn cấu trúc mạng lưới (Source Context Q30).

##### 2.2. Phân hệ Quản trị giá trị thu được (EVM) & Earned Schedule

Phân hệ PHẢI thực hiện giám sát hiệu suất dự án thông qua bộ chỉ số EVM chuẩn hóa.

* **Chỉ số biến động và Hiệu suất:**  
* $CV \= EV \- AC$ ;  $SV \= EV \- PV$ .  
* $CPI \= EV / AC$ ;  $SPI \= EV / PV$ .  
* **Dự báo hoàn thành (EAC) dựa trên Từ khóa kịch bản:**  Hệ thống PHẢI cung cấp logic gate hoặc dropdown để PM chọn kịch bản dựa trên các từ khóa (Keywords) từ Source Context:  
* **Typical (Tiếp tục biến động):**   $EAC \= BAC / CPI$ .  
* **Atypical (Biến động không lặp lại):**   $EAC \= AC \+ BAC \- EV$ .  
* **Flawed (Ước tính ban đầu sai):**   $EAC \= AC \+ Bottom-up\\ ETC$ .  
* **Deadline/Over budget (Vượt ngân sách và ép tiến độ):**   $EAC \= AC \+ (BAC \- EV) / (CPI \\times SPI)$  (Source Context Q82).  
* **Chỉ số hiệu suất cần đạt (TCPI):**  
* Dựa trên BAC:  $(BAC \- EV) / (BAC \- AC)$ .  
* Dựa trên EAC:  $(BAC \- EV) / (EAC \- AC)$ .  
* **Nguyên tắc Chi phí chìm (Sunk Costs):**  Hệ thống PHẢI loại bỏ hoàn toàn các chi phí đã chi (Sunk Costs) khỏi mọi thuật toán ra quyết định tiếp tục hay dừng dự án (Source Context Q6).

##### 2.3. Phân hệ Quản lý Rủi ro (EMV & Decision Tree)

* **Định lượng rủi ro:**  Hệ thống PHẢI tính toán Giá trị tiền tệ kỳ vọng  $EMV \= Xác suất \\times Tác động$ .  
* **Cây quyết định:**  Hệ thống PHẢI hỗ trợ xây dựng Decision Tree để so sánh các phương án đầu tư, tự động tổng hợp EMV của từng nhánh để đề xuất phương án có giá trị kinh tế cao nhất.

##### 2.4. Phân hệ Agile Scrum/Kanban Hub

* **Quản lý linh hoạt:**  Hệ thống PHẢI cung cấp bảng Kanban để theo dõi Work in Progress (WIP).  
* **Phát triển đội ngũ:**  Theo dõi vòng đời team theo mô hình Tuckman (Forming, Storming, Norming, Performing). PM đóng vai trò là "facilitator" \- đưa ra hướng dẫn mà không can thiệp vào quyền tự chủ của team.

##### 2.5. Phân hệ Báo cáo & Kênh truyền thông

* **Tính toán số lượng kênh:**  Hệ thống PHẢI áp dụng công thức  $n(n \- 1\) / 2$ .  
* **Phân tích Delta (**  **$\\Delta**$  **):**  Khi có sự thay đổi nhân sự, hệ thống PHẢI báo cáo số lượng kênh tăng thêm hoặc giảm đi.  
* Ví dụ: Nếu quy mô team tăng từ 11 lên 12 người, hệ thống PHẢI cảnh báo sự gia tăng thêm 11 kênh truyền thông mới (Source Context Q28).  
* **Phân bổ thời gian:**  Mặc định thiết lập các dashboard nhắc nhở PM dành 90% thời gian cho truyền thông.

##### 2.6. Phân hệ Quản lý Phạm vi & WBS Engine

* **Ràng buộc WBS Dictionary:**  Hệ thống PHẢI cưỡng chế rằng mọi thành phần trong WBS (Work Breakdown Structure) đều PHẢI có một mục tương ứng trong WBS Dictionary bao gồm mô tả chi tiết gói công việc (Source Context Q23).  
* **Validate Scope:**  Quy trình chấp nhận chính thức PHẢI thông qua hoạt động Inspection để xác nhận các Verified Deliverables.

##### 2.7. Phân hệ Quản lý & Cân bằng Nguồn lực

* **Ma trận RACI:**  Hệ thống PHẢI phân quyền dựa trên RACI. Chỉ vai trò "Accountable" mới được phê duyệt thay đổi Baseline.  
* **Cảnh báo Over-allocation:**  Hệ thống PHẢI tự động phát hiện và cảnh báo khi nguồn lực bị quá tải thông qua biểu đồ Resource Histogram.

##### 2.8. Phân hệ Kiểm soát Thay đổi Tích hợp (Integrated Change Control)

* **Luồng xử lý:**  Tiếp nhận Request \-\> Phân tích tác động đến Triple Constraint \-\> CCB phê duyệt \-\> Cập nhật Baseline & Versioning.  
* **Kiểm soát Scope Creep:**  Hệ thống PHẢI ngăn chặn mọi thay đổi chưa qua phê duyệt chính thức của CCB.

##### 2.9. Phân hệ Quản lý Mua sắm (PTA Logic)

* **Tính toán Point of Total Assumption (PTA):**   $PTA \= (Ceiling Price \- Target Price) / Buyer's Share Ratio \+ Target Cost$ .  
* **Ràng buộc xác thực Share Ratio:**  Hệ thống PHẢI kiểm tra giá trị đầu vào của Share Ratio. Nếu người dùng nhập Seller's Share (ví dụ 30%), hệ thống PHẢI tự động chuyển đổi thành Buyer's Share (70%) trước khi thực hiện công thức PTA (Source Context Q74).

##### 2.10. Phân hệ Quản lý Chất lượng (Precision & Accuracy)

* **Control Charts:**  Giới hạn kiểm soát (Control Limits) PHẢI được thiết lập mặc định là  $\\pm 3\\sigma$  quanh giá trị trung bình (Source Context Q65).  
* **Quy tắc Pareto:**  Ưu tiên xử lý 20% nguyên nhân gây ra 80% lỗi sản phẩm.  
* **Cảnh báo Accuracy vs Precision:**  Dựa trên logic Source Context Q9, hệ thống PHẢI trực quan hóa và đưa ra cảnh báo nếu quy trình có "Độ chuẩn xác cao nhưng Độ chính xác thấp" (Highly Precise but Low Accuracy) \- tức là quy trình đang tạo ra kết quả sai lệch một cách nhất quán.

##### 2.11. Phân hệ Quản lý Danh mục & Khấu hao

1. **Chỉ số lựa chọn:**  NPV cao nhất, IRR cao nhất, Payback Period ngắn nhất, BCR \> 1\.  
2. **Quản lý Khấu hao:**  Hệ thống PHẢI hỗ trợ 03 phương pháp khấu hao (Source Context Q15, Q22, Q27, Q94):  
3. **Straight-Line:**  Khấu hao đều hàng năm.  
4. **Double Declining Balance (DDB):**  Khấu hao theo tỷ lệ gấp đôi Straight-line trên giá trị sổ sách còn lại.  
5. **Sum-of-the-Years' Digits:**  Khấu hao theo tổng chữ số các năm của vòng đời tài sản.

#### 3\. YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL REQUIREMENTS)

* **Tính toàn vẹn dữ liệu:**  Hệ thống PHẢI lưu trữ toàn bộ lịch sử chi phí, nhưng PHẢI đảm bảo các "Chi phí chìm" (Sunk Costs) không được tham gia vào các hàm logic tính toán hiệu quả dự án trong tương lai.  
* **Độ chính xác tính toán:**  Các kết quả số học PHẢI đạt độ chính xác tối thiểu 4 chữ số thập phân trước khi làm tròn.  
* **Bảo mật:**  Phân quyền truy cập theo ma trận RACI và vai trò trong Project Charter.

#### 4\. PHỤ LỤC KỸ THUẬT (TECHNICAL APPENDIX)

##### 4.1. Bảng tra cứu công thức cho Lập trình viên

Lĩnh vực,Tên công thức,Công thức chi tiết

Tiến độ,PERT Weighted Average,$(P \+ 4M \+ O) / 6$

,Task Variance,$(P \- O) / 6^2$

,Standard Deviation ( $\\sigma$ ),$(P \- O) / 6$

Giá trị (EVM),CPI / SPI,$EV / AC$  \\|  $EV / PV$

,CV / SV,$EV \- AC$  \\|  $EV \- PV$

,EAC (Deadline),$AC \+ (BAC \- EV) / (CPI \\times SPI)$

,Inverted PV,$EV / SPI$  (Từ SPI và EV để tìm PV \- Q50)

Mua sắm,Point of Total Assumption,$(Ceiling \- Target Price) / Buyer Share Ratio \+ Target Cost$

,Inverted Target Cost,$PTA \- (Ceiling \- Target Price) / Buyer Share$  (Q104)

Tài chính,Present Value (PV),$FV / (1 \+ r)^n$

,Sum-of-the-Years' Digits,$Depreciable Cost \\times (Remaining Life / Sum of Digits)$

Giao tiếp,Communication Channels,$n(n \- 1\) / 2$

##### 4.2. Bảng tỷ lệ Sigma và Xác suất (Normal Distribution)

* 1  $\\sigma$ : 68.26%  
* 2  $\\sigma$ : 95.46%  
* 3  $\\sigma$ : 99.73%  
* 6  $\\sigma$ : 99.99%**TÀI LIỆU KẾT THÚC.**

&nbsp;