Quy trình nghiệp vụ và tham khảo OSS cho hệ Quản lý trật tự xây dựng (QLTTXD)

Mục đích

- Mô tả quy trình nghiệp vụ end-to-end từ khi người dân báo cáo vi phạm đến khi hồ sơ được đóng và kết thúc. - Ghi nhận vai trò, quyền hạn và trách nhiệm của các bên liên quan. - Cung cấp tham khảo OSS tương tự để người dùng có thể áp dụng kiến trúc và mẫu làm việc thực tế.

1. Mô tả tổng quan

- Hệ thống cho QLTTXD self-host, mở cho người dân báo cáo vi phạm, điện tích vị trí và ảnh kèm. - Quy trình nghiệp vụ: nhận báo cáo -> xác minh hiện trường -> lập biên bản -> quyết định xử phạt -> thực thi -> theo dõi thi hành -> lưu hồ sơ.
- Các tài liệu tham khảo: ND15-2021 (Nghị định 15/2021/NĐ-CP) và phụ lục kèm; tham khảo OSS tương tự từ FixMyStreet, Ushahidi, OpenStreetMap, QGIS, PostGIS, MapLibre/Leaflet.

2. Quy trình end-to-end (mô tả các bước chính)

- Bước 0: Người dân báo cáo vi phạm qua nền tảng công khai (web/mobile) và gửi ảnh/kênh bản đồ địa điểm.
- Bước 1: Tiếp nhận báo cáo bởi nhân viên (ứng dụng quản trị). Kiểm tra tính đầy đủ thông tin: mô tả, vị trí, thời gian, ảnh/video.
- Bước 2: Xác minh hiện trường và chứng cứ: cán bộ xác minh thực địa hoặc kiểm tra hồ sơ; xác nhận sự tồn tại của vi phạm và phạm vi.
- Bước 3: Lập biên bản vi phạm, ghi nhận đầy đủ thông tin: nguyên nhân, phạm vi, biện pháp khắc phục, thời hạn thi hành; đính kèm bằng chứng (hình ảnh, bản đồ).
- Bước 4: Xác nhận vai trò và thẩm quyền: người ra quyết định (lãnh đạo) phê duyệt biên bản và các quyết định xử phạt (nếu có);
- Bước 5: Giao quyết định xử phạt và chuyển hồ sơ cho thi hành: nộp phạt, cưỡng chế (nếu có) hoặc các biện pháp khắc phục;
- Bước 6: Theo dõi thi hành và đóng hồ sơ: kiểm tra kết quả thực thi, cập nhật trạng thái, lưu trữ hồ sơ đầy đủ.
- Bước 7: Bế mạc vụ việc và tổng hợp thống kê, báo cáo định kỳ.

3. Vai trò (actors) và quyền hạn (authorities)

- Actors (vai trò):
  - Công dân (Citizen/reporting user)
  - Nhân viên tiếp nhận báo cáo (Intake staff)
  - Cán bộ xác minh (Verifier/Field officer)
  - Lãnh đạo/Quản trị cấp cao (Leaders/Administrators)
  - Quản trị hệ thống (System administrator)
- Quyền hạn và phạm vi trách nhiệm (RBAC cơ bản):
  - Nhân viên tiếp nhận: ghi nhận, xác thực thông tin tối thiểu, tạo hồ sơ ban đầu.
  - Cán bộ xác minh: xác nhận tính đúng đắn của báo cáo, thu thập chứng cứ, điền vào biên bản.
  - Lãnh đạo: phê duyệt biên bản, quyết định xử phạt (nếu có); quản trị cấp cao có quyền xem/điều chỉnh workflow.
  - Quản trị hệ thống: quản trị người dùng, định danh, phân quyền, bảo mật hệ thống.

4. Tham khảo OSS tương tự và liên kết (OSS references)

- Ushahidi: nền tảng báo cáo sự cố và báo cáo trên GIS, open-source. https://www.ushahidi.com/ ; docs: https://docs.ushahidi.io/docs/
- FixMyStreet: hệ thống báo cáo và xử lý sự cố đường phố. GitHub: https://github.com/mysociety/fixmystreet ; trang: https://www.fixmystreet.com/
- OpenStreetMap: dữ liệu bản đồ mở. https://www.openstreetmap.org/
- QGIS: phần mềm GIS mã nguồn mở. https://www.qgis.org/
- PostGIS: phần mở rộng GIS cho PostgreSQL. https://postgis.net/
- MapLibre GL / Leaflet: thư viện bản đồ cho trình duyệt. https://maplibre.org/ ; https://leafletjs.com/
- Ghi chú: ND15-2021-phuluc.md trong repo này liệt kê một số mô hình tham khảo và mẫu văn bản liên quan đến hồ sơ pháp lý và thủ tục hành chính.

5. Kiến trúc tham khảo và đề xuất triển khai

- Backend: Node.js (Express/Fastify) hoặc Python FastAPI như đề xuất trong ND15-2021.
- Cơ sở dữ liệu: PostgreSQL + PostGIS (để lưu trữ địa điểm/geospatial data)
- Frontend: React/Next.js hoặc Vue + MapLibre GL/Leaflet để hiển thị bản đồ và báo cáo.
- RBAC: Keycloak hoặc các giải pháp tự triển khai để quản lý người dùng và quyền hạn.
- Lưu trữ ảnh: filesystem hoặc object storage (MinIO hoặc S3-compatible).
- Dữ liệu mẫu: bảng hồ sơ vi phạm, bảng chứng cứ (ảnh, video), bảng quyết định xử phạt, bảng theo dõi thi hành.

6. Ghi chú và hướng dùng

- Mọi tài liệu viết bằng tiếng Việt, rõ ràng, có cấu trúc.
- Đầu ra: outputs/biên bản, quyết định xử phạt, hồ sơ công trình; lưu trữ đầy đủ ở hệ thống.
- OSS references ở mục 4 có thể làm cơ sở tham khảo để triển khai hệ thống thực tế.

7. Ghi nhận nguồn tham khảo và liên kết

- ND15-2021/Nghị định 15-2021 NĐ-CP: quy định quản lý dự án đầu tư xây dựng và xử phạt hành chính trong lĩnh vực xây dựng. (Nguồn: ND15-2021, phụ lục và mẫu văn bản)
- OSS references: Ushahidi, FixMyStreet, OpenStreetMap, QGIS, PostGIS, MapLibre, Leaflet.

Lưu ý: tôi có tham khảo nội dung từ BRIEF.md và ND15-2021-phuluc.md trong repository/qLTTXD (vị trí /workspace/ssd/qlttxd/ BRIEF.md, taplieu/ND15-2021-phuluc.md). Tài liệu ND15-2021.md ở repo có phần cứng, chúng ta có thể tham khảo khi cần.

Kết quả: Đã tạo bản ghi 02-quy-trinh-nghiep-vu.md ở /workspace/ssd/qlttxd/docs/02-quy-trinh-nghiep-vu.md để dùng làm nguồn tham khảo cho quy trình nghiệp vụ งาน QLTTXD.
