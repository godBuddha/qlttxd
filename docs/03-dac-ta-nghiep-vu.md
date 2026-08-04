# Độc tả nghiệp vụ Hệ thống QLTTXD

Mục tiêu của tài liệu này là mô tả đầy đủ các yếu tố nghiệp vụ cho Hệ thống Quản lý Thông tin Trật tự Xây dựng (QLTTXD) nhằm hỗ trợ phân tích, thiết kế và triển khai self-hosted. Tài liệu được viết dành cho nhóm chức năng nghiệp vụ, quản trị viên hệ thống và đội ngũ kỹ thuật biết rõ phạm vi, vai trò, luồng sự kiện và các yêu cầu phi chức năng của hệ thống. Nội dung được tổ chức thành các phần sau: phạm vi và mục tiêu, Actors và vai trò, Use cases chính, yêu cầu chức năng (FR), yêu cầu phi chức năng (NFR), ràng buộc pháp lý và tuân thủ, kiến trúc và triển khai, dữ liệu và mô hình dữ liệu, luồng xử lý và phụ lục thuật ngữ.

## 1. Phạm vi và mục tiêu

### 1.1 Phạm vi

- Hệ thống QLTTXD là nền tảng quản lý các hoạt động liên quan đến việc thu thập, xử lý và quản lý thông tin liên quan đến vi phạm trật tự xây dựng, thực thi quyết định xử phạt, quản trị hồ sơ và thống kê, báo cáo và kiểm tra xem xét lại. 
- Hệ thống được self-host trên hạ tầng của người dùng và có thể tích hợp với các nguồn dữ liệu địa lý, GIS, và các hệ thống nội bộ của cơ quan quản lý.
- Phần mềm hỗ trợ người dùng với vai trò khác nhau: người phân tích nghiệp vụ (business analyst), quản trị hệ thống, cán bộ thụ lý hồ sơ và người quản trị cơ sở dữ liệu. 
- Tài liệu này tập trung vào các yếu tố nghiệp vụ và cách chúng được diễn giải thành các use case, FR và NFR. Các chi tiết triển khai kỹ thuật và kiến trúc dữ liệu được mô tả ở phần sau.

### 1.2 Mục tiêu

- Cung cấp một khuôn khổ nghiệp vụ đầy đủ cho việc phân tích, thiết kế và kiểm chứng hệ thống. 
- Đảm bảo tính nhất quán giữa các use case và các FR/NFR. 
- Cụ thể hóa các yêu cầu thay đổi chính sách, quy trình nghiệp vụ và tiêu chuẩn hoạt động liên quan đến hình sự phạt, khắc phục hậu quả và quản lý hồ sơ.
- Hỗ trợ tài liệu tham chiếu cho các giai đoạn triển khai, kiểm thử và đóng gói hệ thống.

## 2. Actors (vai trò) và mô tả chi tiết

Các actors là các nhóm người và hệ thống tham gia vào việc thực thi nghiệp vụ của hệ thống. Mỗi actor có các mục tiêu, quyền hạn và tương tác với các use case.

- Người phân tích nghiệp vụ (Business Analyst – BA): chịu trách nhiệm thu thập, phân tích và viết các tài liệu yêu cầu, mô tả FR/NFR và theo dõi sự đồng thuận giữa các bên.
- Người quản trị hệ thống (System Administrator – Admin): quản trị người dùng, RBAC, phân quyền, bảo mật và tuân thủ. 
- Người khiếu kiện / Người dân (Citizens) và Người bị xử phạt: tương tác với hệ thống để nộp đơn khiếu nại, theo dõi tiến trình hồ sơ và nhận thông báo. 
- Cán bộ thụ lý hồ sơ (Case Handler) – đơn vị xử lý vi phạm: nhận thông tin, lập biên bản, cập nhật tình trạng hồ sơ, theo dõi khắc phục và quyết định xử phạt. 
- Người quản trị dữ liệu / Chuyên viên GIS: quản trị dữ liệu liên quan đến địa lý, bản đồ, điểm vi phạm, tuyến đường và phân tích dữ liệu. 
- Phối hợp quản lý (Manager) và Giám sát (Supervisor): theo dõi hiệu quả, thống kê và báo cáo theo yêu cầu quản trị cấp cao.

> Bảng sau tóm lượt các vai trò, quyền hạn và tác động chính với hệ thống:
>
> - BA: viết FR/NFR, xác nhận Use Case, tham gia verification.
> - Admin: quản trị người dùng và nhóm RBAC, bảo mật sự kiện.
> - Citizen: gửi hồ sơ, xem tiến độ, nhận thông báo.
> - Case Handler: xử lý hồ sơ, cập nhật trạng thái, lập biên bản, ra quyết định.
> - GIS Specialist: quản trị dữ liệu địa lý, GIS, tích hợp bản đồ.
> - Manager/Supervisor: tổng hợp báo cáo, phân tích hiệu suất.

## 3. Use cases chính (Use Case danh sách và mô tả tổng quan)

Dưới đây là danh sách các use case chính và liên kết với FR/NFR. Mỗi use case có mô tả mục tiêu, điều kiện tiên quyết, luồng chính và các luồng mở rộng.

- UC-01 Báo cáo vi phạm (Vi phạm trật tự xây dựng nói chung)
- UC-02 Tiếp nhận báo cáo và kiểm tra tính hợp lệ ban đầu
- UC-03 Xác minh tính có căn cứ và phân loại vi phạm
- UC-04 Lập biên bản và biên bản xử phạt (nếu đủ điều kiện)
- UC-05 Ra quyết định xử phạt và thông báo cho người vi phạm
- UC-06 Theo dõi khắc phục và đóng hồ sơ
- UC-07 Quản trị hồ sơ và sắp xếp lưu trữ dữ liệu
- UC-08 Thống kê và báo cáo nghiệp vụ (kết quả xử phạt, số vụ, khu vực, thời gian)
- UC-09 Quản trị người dùng và quyền hạn (RBAC)
- UC-10 Quản lý bản đồ và dữ liệu GIS, định vị vị trí vi phạm

Mô tả chi tiết cho từng use case được nêu ở phần dưới: các mô tả này tập trung vào các bước chính và các điều kiện thành công.

### 3.1 UC-01 Báo cáo vi phạm
Mục tiêu: Cho phép người dùng gửi báo cáo vi phạm trật tự xây dựng, kèm thông tin và bằng chứng phù hợp.
- Tiền điều kiện: Người dùng đã có tài khoản hợp lệ và quyền đọc/ghi vào mô-đun báo cáo.
- Luồng chính: (1) Người dùng điền mẫu báo cáo hoặc tải tệp đính kèm; (2) Hệ thống xác nhận nhận báo cáo và gán mã hồ sơ; (3) Hồ sơ được đẩy sang quy trình thụ lý.
- Các luồng thay thế: thiếu thông tin bắt buộc sẽ thông báo và yêu cầu bổ sung.
- Điều kiện hoàn tất: Hồ sơ báo cáo được lưu trữ và có thể theo dõi từ màn hình trạng thái.

### 3.2 UC-02 Tiếp nhận báo cáo và kiểm tra tính hợp lệ ban đầu
Mục tiêu: Kiểm tra tính đầy đủ và hợp lệ của báo cáo trước khi chuyển sang giai đoạn xác minh.
- Tiền điều kiện: Báo cáo đã được gửi vào hệ thống.
- Luồng chính: (1) Hệ thống kiểm tra các trường bắt buộc; (2) Gán trạng thái ban đầu (Chưa xác minh) và chỉ định người xử lý; (3) Thông báo tới người gửi báo cáo về trạng thái.
- Luồng thay thế: báo cáo thiếu thông tin phải yêu cầu bổ sung.
- Kết quả: Báo cáo được xếp hàng cho bước xác minh.

### 3.3 UC-03 Xác minh tính có căn cứ và phân loại vi phạm
Mục tiêu: Xác minh hành vi vi phạm và phân loại theo mức độ, tính chất và địa bàn.
- Tiền điều kiện: Báo cáo đã ở trạng thái chờ xác minh.
- Luồng chính: (1) Cán bộ thụ lý xem xét dữ liệu, tài liệu đính kèm, và khai thác hệ thống GIS; (2) Phân loại vi phạm theo chuẩn: ví dụ vi phạm xây dựng trái phép, vi phạm thiết kế, vi phạm an toàn, v.v.; (3) Cập nhật hồ sơ với nhận định và kết luận.
- Các luồng mở rộng: cần xác minh bổ sung, phỏng vấn người liên quan, hoặc yêu cầu giám định.
- Kết quả: Hồ sơ được phân loại và chuyển sang giai đoạn Lập biên bản hoặc quay lại giai đoạn báo cáo tùy thuộc kết luận.

### 3.4 UC-04 Lập biên bản và biên bản xử phạt
Mục tiêu: Lập biên bản vi phạm và áp dụng biên bản xử phạt nếu điều kiện cho phép.
- Tiền điều kiện: Xác minh có căn cứ và phân loại.
- Luồng chính: (1) Lập biên bản vi phạm (mẫu có sẵn, đính kèm bằng chứng); (2) Quyết định mức phạt và mức xử phạt được ghi trong biên bản; (3) Chuyển hồ sơ sang cấp có thẩm quyền phê duyệt và gửi thông báo cho người vi phạm.
- Luồng mở rộng: từ chối hoặc yêu cầu bổ sung thông tin; điều chỉnh theo quyết định giám định.
- Kết quả: Biên bản được ban hành và xử phạt được áp dụng, hồ sơ cập nhật trạng thái.

### 3.5 UC-05 Ra quyết định xử phạt và thông báo cho người vi phạm
Mục tiêu: Cấp quyền và gửi thông báo xử phạt cho người vi phạm.
- Tiền điều kiện: Biên bản có hiệu lực và nội dung phạt được phê duyệt.
- Luồng chính: (1) Hệ thống tạo quyết định xử phạt và thông báo tới người vi phạm; (2) Ghi nhận thời điểm, phương thức thông báo và trạng thái xem xét.
- Luồng mở rộng: người vi phạm có quyền khiếu nại và hệ thống phải ghi nhận và theo dõi.
- Kết quả: Người vi phạm nhận thông báo; hồ sơ cập nhật lịch sử xử phạt.

### 3.6 UC-06 Theo dõi khắc phục và đóng hồ sơ
Mục tiêu: Theo dõi hành vi khắc phục và đóng hồ sơ khi công tác được hoàn tất.
- Tiền điều kiện: Vi phạm đã bị phạt và có kế hoạch khắc phục
- Luồng chính: (1) Cán bộ theo dõi xem xét tình trạng khắc phục; (2) Ghi nhận bằng chứng khắc phục; (3) Đóng hồ sơ khi tất cả điều kiện được đáp ứng và xem xét lại.
- Kết quả: Hồ sơ đóng hoặc tiếp tục theo dõi.

### 3.7 UC-07 Quản trị hồ sơ và sắp xếp lưu trữ dữ liệu
Mục tiêu: Quản lý hồ sơ liên quan, sắp xếp, phân quyền truy cập và lưu trữ dữ liệu.
- Luồng chính: (1) Tổ chức hồ sơ theo danh mục, gắn thẻ và vị trí lưu trữ; (2) Cấp quyền truy cập hồ sơ dựa trên RBAC; (3) Bảo đảm sao lưu và phục hồi dữ liệu.
- Kết quả: Hồ sơ được tổ chức, dễ tra cứu, có hệ thống sao lưu và log truy cập.

### 3.8 UC-08 Thống kê và báo cáo nghiệp vụ
Mục tiêu: Cung cấp báo cáo thống kê theo các tiêu chí địa lý, thời gian và loại vi phạm.
- Luồng chính: (1) Hệ thống tổng hợp dữ liệu hồ sơ và kết quả xử lý; (2) Tạo báo cáo theo mẫu thiết lập; (3) Phân phối báo cáo tới quản trị viên cấp cao và các đối tác.
- Kết quả: Các báo cáo có định dạng thống nhất và có thể xuất khẩu (CSV, PDF, GIS map layers).

### 3.9 UC-09 Quản trị người dùng và quyền hạn
Mục tiêu: Quản trị người dùng, nhóm, vai trò và quyền hạn RBAC.
- Luồng chính: (1) Thêm/sửa/xóa người dùng, gán vai trò và nhóm; (2) Ghi lại các sự kiện bảo mật (audits); (3) Đảm bảo tuân thủ các chuẩn bảo mật và sao lưu.
- Kết quả: Quản trị người dùng được thực thi và日志 bảo mật được ghi nhận.

### 3.10 UC-10 Quản lý bản đồ và dữ liệu GIS
Mục tiêu: Quản lý dữ liệu không gian, vị trí vi phạm, và tích hợp GIS cho phân tích.
- Luồng chính: (1) Nhập và cập nhật dữ liệu địa lý; (2) Kết nối với dữ liệu nguồn GIS; (3) Hiển thị vị trí và hỗ trợ phân tích không gian.
- Kết quả: Dữ liệu GIS được đồng bộ và có sẵn cho các báo cáo và quyết định.

> Ghi chú: Các UC ở trên là bản mô tả tổng quan nhằm hỗ trợ phân tích nghiệp vụ và thiết kế. Trong quá trình triển khai, có thể cần điều chỉnh, bổ sung hoặc gộp các use case tùy theo nguồn lực và yêu cầu thực tế.

## 4. Yêu cầu chức năng (FR) – chức năng hệ thống

FR-01: Tạo và gửi báo cáo vi phạm
- Mô tả: Hệ thống cho phép người dùng tạo báo cáo vi phạm, đính kèm tài liệu, hình ảnh và địa điểm liên quan. Mẫu báo cáo phải có các trường bắt buộc như mô tả, địa điểm, thời gian, hình ảnh và thông tin người gửi.
- Điều kiện tiền đề: Người dùng có tài khoản hợp lệ, quyền ghi dữ liệu vào mô-đun báo cáo.
- Tiêu chí chấp nhận: Báo cáo được lưu thành hồ sơ, có mã hồ sơ duy nhất và có trạng thái Chờ xác minh.

FR-02: Xác nhận hồ sơ và phân luồng công việc
- Mô tả: Hệ thống tự động kiểm tra tính đầy đủ và gán hồ sơ vào dòng công việc phù hợp (xác minh, thụ lý, hoặc tham chiếu).
- Tiêu chí chấp nhận: Hồ sơ có trạng thái được gán đúng và người xử lý được thông báo.

FR-03: Phân loại và đánh dấu loại vi phạm
- Mô tả: Cho phép cán bộ xem xét và gắn nhãn loại vi phạm theo chuẩn quy định, với chứng cứ và metadata.
- Tiêu chí chấp nhận: Vi phạm được phân loại đúng và hiển thị trên bảng điều khiển cho các bước tiếp theo.

FR-04: Lập biên bản và biên bản xử phạt
- Mô tả: Hệ thống cho phép tạo biên bản vi phạm, đính kèm bằng chứng, và tạo quyết định xử phạt.
- Tiêu chí chấp nhận: Biên bản có thông tin đầy đủ, chữ ký số/chuẩn phê duyệt và có trạng thái chờ thông báo.

FR-05: Thông báo xử phạt và gửi đến người vi phạm
- Mô tả: Sau khi quyết định xử phạt được phê duyệt, hệ thống tự động gửi thông báo cho người vi phạm (qua email, tin nhắn hoặc cổng thông báo nội bộ).
- Tiêu chí chấp nhận: Người vi phạm nhận được thông báo và hệ thống ghi nhận trạng thái thông báo.

FR-06: Theo dõi khắc phục và đóng hồ sơ
- Mô tả: Hệ thống cho phép theo dõi tiến độ khắc phục, đính kèm chứng cứ và đóng hồ sơ khi hoàn tất.
- Tiêu chí chấp nhận: Hồ sơ đóng và có báo cáo hoàn tất.

FR-07: Quản trị hồ sơ và lưu trữ dữ liệu
- Mô tả: Quản trị hồ sơ, phân loại, ủy quyền truy cập và lưu trữ lâu dài với sẵn sàng sao lưu.
- Tiêu chí chấp nhận: Hồ sơ được tổ chức và có lịch sử truy cập đầy đủ.

FR-08: Thống kê và báo cáo nghiệp vụ
- Mô tả: Hệ thống hỗ trợ báo cáo và thống kê theo thời gian, khu vực, loại vi phạm, và kết quả xử phạt.
- Tiêu chí chấp nhận: Các báo cáo có định dạng chuẩn, có thể xuất CSV/PDF và tích hợp GIS khi cần.

FR-09: Quản trị người dùng và RBAC
- Mô tả: Quản trị người dùng, nhóm và vai trò, đảm bảo RBAC phân quyền chính xác và có audit trail.
- Tiêu chí chấp nhận: Có quản trị người dùng và log bảo mật đầy đủ.

FR-10: Quản lý dữ liệu GIS và bản đồ
- Mô tả: Hệ thống có cơ chế quản lý dữ liệu địa lý, liên kết với GIS và hiển thị vị trí vi phạm.
- Tiêu chí chấp nhận: Dữ liệu GIS được đồng bộ và hiển thị đúng trên bản đồ.

> Lưu ý: FR ở đây mang tính tham chiếu cho giai đoạn phân tích và thiết kế. Trong quá trình triển khai, từng FR có thể được chi tiết hóa bằng các yêu cầu phụ, tiêu chí kiểm thử và dữ liệu mẫu để đảm bảo sự đồng nhất với các UC và NFR.

## 5. Yêu cầu phi chức năng (NFR)

NFR mô tả các tiêu chí phi chức năng quan trọng cho hệ thống, không trực tiếp gắn với các thao tác người dùng nhưng ảnh hưởng đến độ tin cậy, an toàn và hiệu suất.

- NFR-01 Bảo mật và quản lý truy cập (RBAC): Hệ thống phải cung cấp mô hình RBAC rõ ràng, cho phép quản trị viên gán vai trò và cấp quyền theo nguyên tắc ít quyền (least privilege). Audit log toàn bộ hoạt động người dùng và quản trị hệ thống, lưu trữ không bị sửa đổi và có thể trích xuất.
- NFR-02 Hiệu năng và khả năng mở rộng: Hệ thống phải đáp ứng ít nhất 200 đồng hồ xử lý song song cho các hồ sơ ở quy mô vừa; thời gian phản hồi cho các thao tác phổ biến (tạo báo cáo, xem hồ sơ, tra cứu) không vượt quá 2 giây ở trên môi trường sản phẩm. Hệ thống phải có khả năng mở rộng theo cấp số nhân với gia tăng người dùng và hồ sơ.
- NFR-03 Khả dụng và phục hồi lỗi: Mức availability tối thiểu 99.9% trong giờ làm việc chuẩn; có cơ chế sao lưu và phục hồi dữ liệu nhanh chóng, thời gian khôi phục dưới 1 giờ (RPO/RTO phù hợp). 
- NFR-04 Audit log và traceability: Mọi thao tác quan trọng phải được ghi nhận theo chuẩn time-stamp, người dùng, và hành động, có khả năng truy vấn và sao lưu riêng.
- NFR-05 Tự lưu trữ và self-host: Hệ thống được thiết kế để tự lưu trữ và vận hành độc lập mà không phụ thuộc vào nền tảng đám mây công khai; có các cơ chế sao lưu và phục hồi dữ liệu và cấu hình.
- NFR-06 Bản quyền và thu thập dữ liệu: Đảm bảo tuân thủ quyền sở hữu trí tuệ và quy định pháp lý liên quan đến dữ liệu công vụ, dữ liệu cá nhân và dữ liệu GIS.
- NFR-07 Khả năng bảo trì và mở rộng: Kiến trúc phần mềm phải cho phép bổ sung các mô-đun mới, cập nhật cho các yếu tố nghiệp vụ mà không làm gián đoạn hoạt động.
- NFR-08 Hiệu quả dữ liệu GIS: Dữ liệu GIS phải được tối ưu hóa cho tra cứu và hiển thị, bao gồm tối ưu hoá không gian lưu trữ và thời gian truy xuất.

## 6. Ràng buộc pháp lý, chuẩn mực và tuân thủ

- Hệ thống phải tuân thủ các yêu cầu pháp lý liên quan đến quy hoạch, quản lý trật tự xây dựng và xử phạt vi phạm. Các chính sách về an toàn dữ liệu và quyền riêng tư cần được thực thi; các hồ sơ và dữ liệu nhạy cảm phải được bảo vệ và chỉ có người có quyền mới truy cập. 
- Ghi nhận và lưu trữ chứng cứ theo quy định pháp lý (bằng chứng, chữ ký, thời gian). 
- Hồ sơ và báo cáo phải có tính xác thực và có chu trình phê duyệt phù hợp với quy trình quản lý.
- Nhật ký hệ thống (audit) phải có khả năng xuất ra và phục vụ cho thanh tra, kiểm toán, hoặc yêu cầu từ cơ quan có thẩm quyền.

## 7. Kiến trúc và triển khai (khái quát)

- Kiến trúc tổng quan: Hệ thống được triển khai trên hạ tầng tự quản. Các module nghiệp vụ được thiết kế độc lập hoặc loosely coupled để dễ mở rộng và bảo trì. Dữ liệu có thể được đồng bộ với GIS và các nguồn dữ liệu có sẵn. 
- Triển khai self-host: Người dùng sẽ cung cấp môi trường và các dịch vụ cần thiết, cài đặt và cấu hình hệ thống, đảm bảo an toàn và sao lưu. 
- Bảo mật: RBAC, kiểm soát truy cập, log và audit. 
- Dữ liệu và sao lưu: Dữ liệu quan trọng được sao lưu và có cơ chế phục hồi. 
- Tích hợp: Hệ thống có thể tích hợp với các hệ thống quản lý dữ liệu và GIS hiện có.

## 8. Dữ liệu và mô hình dữ liệu – Tổng quan

Hệ thống lưu trữ thông tin dưới dạng hồ sơ vi phạm, biên bản, quyết định xử phạt và các thuộc tính liên quan đến địa điểm, thời gian, người vi phạm và người xử lý. Dữ liệu GIS đóng vai trò trọng yếu trong việc xác định vị trí và phạm vi ảnh hưởng. Dưới đây là các khái niệm chính và quan hệ dữ liệu ở mức khung:

- Vi phạmViPham: Hồ sơ đại diện cho một vụ vi phạm, có trường như mã hồ sơ, mô tả, địa điểm (tọa độ GIS), thời gian xảy ra, trạng thái hiện tại, tag loại vi phạm, và liên kết tới tài liệu bằng chứng. 
- BienBan: Biên bản vi phạm được lập khi đủ điều kiện; liên kết tới Vi phạmViPham và có trường dữ liệu về hình thức xử phạt, mức phạt, chữ ký và quyết định xử phạt.
- QuyetDinhXuPhat: Quyết định xử phạt được phát hành sau biên bản và phê duyệt. Liên kết tới BienBan và ViPham.
- NguoiDung: Thông tin người dùng hệ thống, bao gồm danh tính, tài khoản, vai trò và nhóm RBAC.
- NguoiXuLy: Vai trò đặc thù, liên kết tới hồ sơ và trạng thái hiện tại của công việc.
- DiaLy: Thông tin vị trí địa lý của hồ sơ vi phạm, bao gồm đường phố, khu vực, toạ độ GIS, và bản đồ liên quan.
- BaoCaoThongKe: Định dạng và bảng thống kê được tạo ra cho báo cáo nghiệp vụ, có thể xuất dưới dạng CSV, PDF hoặc bản đồ GIS.

> Lưu ý: Đây là mô hình ở mức khung để sử dụng trong phân tích nghiệp vụ. Trong giai đoạn thiết kế chi tiết, cần xác định đúng lược đồ dữ liệu, quy tắc khóa, ràng buộc, và các bảng tham chiếu theo nền tảng công nghệ được chọn.

## 9. Sơ đồ luồng và quy trình nghiệp vụ

Dưới đây là mô tả luồng nghiệp vụ ở mức tổng quan, phù hợp với các use case đã liệt kê ở trên. Các bước có thể được triển khai qua các mô-đun hoặc microservice riêng biệt, tùy thuộc kiến trúc hệ thống:

1) Gửi báo cáo: Người dùng gửi báo cáo với đầy đủ thông tin và chứng cứ. Hồ sơ nhận được sẽ được lưu và đánh dấu chế độ Chờ xác minh.
2) Tiếp nhận và xác minh ban đầu: Hệ thống kiểm tra tính đầy đủ, gán người xử lý và trạng thái lên hàng để xác minh chi tiết.
3) Xác minh và phân loại: Cán bộ xem xét, gắn nhãn loại vi phạm, xác minh bằng chứng và quyết định có đủ cơ sở cho biên bản hay không.
4) Lập biên bản/Quyết định xử phạt: Nếu đủ điều kiện, lập biên bản và ra quyết định xử phạt trong khuôn khổ thẩm quyền.
5) Thông báo: Gửi thông báo xử phạt cho người vi phạm và cập nhật hồ sơ với trạng thái thông báo.
6) Khắc phục và đóng hồ sơ: Theo dõi khắc phục, xác nhận hoàn tất và đóng hồ sơ, hoặc quay lại quy trình khi cần.
7) Quản trị hệ thống: RBAC, quản trị người dùng, sao lưu, audit và bảo trì.

## 10. Phụ lục – Từ vựng và tham khảo

- Vi phạm: hành vi vi phạm trật tự xây dựng được xem xét theo quy định pháp luật và các chuẩn mực của cơ quan có thẩm quyền.
- Biên bản: văn bản xác nhận sự vi phạm và thông tin liên quan đến hành vi vi phạm và bằng chứng.
- Quyết định xử phạt: văn bản công nhận mức phạt và biện pháp xử lý.
- RBAC: Role-Based Access Control – kiểm soát truy cập dựa trên vai trò.
- GIS: Hệ thống thông tin địa lý – quản lý dữ liệu không gian và bản đồ.

## Phụ lục – Cách sử dụng và tham chiếu

- Tệp BRIEF.md: /workspace/ssd/qlttxd/BRIEF.md
- Tệp pháp lý: /workspace/ssd/qlttxd/docs/01-phan-tich-phap-ly.md
- Tệp quy trình nghiệp vụ: /workspace/ssd/qlttxd/docs/02-quy-trinh-nghiep-vu.md
- Tệp phụ lục ngôn ngữ: /workspace/ssd/qlttxd/docs/03-dac-ta-nghiep-vu.md

> Ghi chú: Các trường hợp sử dụng, hệ thống và nội dung ở trên nhằm phục vụ cho giai đoạn phân tích và thiết kế. Trong thực tế, có thể cần bổ sung hoặc điều chỉnh để phù hợp với yêu cầu và nguồn lực.
