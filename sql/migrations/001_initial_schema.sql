-- ============================================================================
-- QLTTXD — initial baseline schema (migration 001)
-- ----------------------------------------------------------------------------
-- Derived from sql/schema.sql as a NON-DESTRUCTIVE, idempotent initial migration.
-- Removed all DROP TABLE ... CASCADE / DROP TYPE / DROP FUNCTION / DROP SEQUENCE
-- statements; converted CREATE TABLE -> CREATE TABLE IF NOT EXISTS and
-- CREATE SEQUENCE -> CREATE SEQUENCE IF NOT EXISTS. Indexes, constraints,
-- triggers and functions are unchanged.
-- ============================================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;

-- Extension hỗ trợ kiểu citext (chuỗi không phân biệt hoa thường) cho email/username.
CREATE EXTENSION IF NOT EXISTS citext;

-- Hàm cập nhật tự động trường updated_at (chạy trong trigger).
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------

-- Mã nghiệp vụ phải được cấp phát nguyên tử: COUNT(*) + 1 sẽ trùng khi có
-- nhiều request đồng thời. Sequence không rollback số đã cấp (có thể có gap),
-- nhưng đảm bảo mã không bị trùng; đây là hành vi chấp nhận được cho số hiệu.
CREATE SEQUENCE IF NOT EXISTS code_bao_cao_seq START WITH 1 INCREMENT BY 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS code_ho_so_seq START WITH 1 INCREMENT BY 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS code_bien_ban_seq START WITH 1 INCREMENT BY 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS code_quyet_dinh_seq START WITH 1 INCREMENT BY 1 NO CYCLE;

CREATE OR REPLACE FUNCTION next_business_code(prefix TEXT, code_sequence REGCLASS)
RETURNS TEXT AS $$
BEGIN
    RETURN prefix || '-' || to_char(CURRENT_DATE, 'YYYY') || '-' ||
           lpad(nextval(code_sequence)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql VOLATILE;

-- ---------------------------------------------------------------------------
-- 2. Bảng RBAC: phân quyền người dùng
-- ---------------------------------------------------------------------------

-- Bảng người dùng hệ thống (công dân, cán bộ, lãnh đạo, quản trị).
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        CITEXT      NOT NULL UNIQUE,          -- tên đăng nhập (không phân biệt hoa thường)
    email           CITEXT      UNIQUE,                    -- email
    phone           VARCHAR(20) UNIQUE,                    -- số điện thoại
    full_name       VARCHAR(200) NOT NULL,                 -- họ tên đầy đủ
    password_hash   TEXT        NOT NULL,                  -- băm mật khẩu (argon2id/bcrypt)
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,     -- tài khoản còn hoạt động không
    last_login_at   TIMESTAMPTZ,                           -- lần đăng nhập gần nhất
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_contact CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
-- Trigger cập nhật updated_at cho users.
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Bảng vai trò (role): công dân, cán bộ tiếp nhận, cán bộ xác minh, lãnh đạo, quản trị...
CREATE TABLE IF NOT EXISTS roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(50)  NOT NULL UNIQUE,   -- mã vai trò, ví dụ 'citizen', 'case_handler'
    name        VARCHAR(200) NOT NULL,           -- tên hiển thị vai trò
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bảng quyền hạn (permission): quyền cụ thể theo module/hành động.
CREATE TABLE IF NOT EXISTS permissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(100) NOT NULL UNIQUE,   -- mã quyền, ví dụ 'ho_so.create'
    name        VARCHAR(200) NOT NULL,           -- tên hiển thị quyền
    module      VARCHAR(100) NOT NULL,           -- module: 'report', 'case', 'gis', 'admin'...
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Liên kết người dùng - vai trò (nhiều-nhiều).
CREATE TABLE IF NOT EXISTS user_roles (
    user_id     UUID NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
    role_id     UUID NOT NULL REFERENCES roles(id)     ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

-- Liên kết vai trò - quyền hạn (nhiều-nhiều).
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id         UUID NOT NULL REFERENCES roles(id)     ON DELETE CASCADE,
    permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ---------------------------------------------------------------------------
-- 3. Bảng đơn vị hành chính (GIS) — cấp quận/huyện và phường/xã
-- ---------------------------------------------------------------------------

-- Quận/huyện. boundary là đa giác thể hiện ranh giới hành chính (SRID 4326).
CREATE TABLE IF NOT EXISTS quan_huyen (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ma          VARCHAR(20) NOT NULL UNIQUE,     -- mã đơn vị hành chính (vd '001')
    ten         VARCHAR(200) NOT NULL,           -- tên quận/huyện
    boundary    GEOMETRY(MultiPolygon, 4326),    -- ranh giới (đa giác)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Phường/xã trực thuộc quận/huyện. boundary là đa giác ranh giới.
CREATE TABLE IF NOT EXISTS phuong_xa (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ma              VARCHAR(20) NOT NULL UNIQUE, -- mã đơn vị hành chính (vd '00101')
    ten             VARCHAR(200) NOT NULL,       -- tên phường/xã
    quan_huyen_id   UUID NOT NULL REFERENCES quan_huyen(id) ON DELETE CASCADE,
    boundary        GEOMETRY(MultiPolygon, 4326),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chỉ mục không gian cho ranh giới đơn vị hành chính (GIST).
CREATE INDEX IF NOT EXISTS idx_quan_huyen_boundary ON quan_huyen USING GIST (boundary);
CREATE INDEX IF NOT EXISTS idx_phuong_xa_boundary   ON phuong_xa  USING GIST (boundary);
CREATE INDEX IF NOT EXISTS idx_phuong_xa_huyen      ON phuong_xa  (quan_huyen_id);

-- ---------------------------------------------------------------------------
-- 4. Danh mục hành vi vi phạm (Điều 16 Nghị định 16/2022/NĐ-CP)
-- ---------------------------------------------------------------------------

-- Nhóm hành vi vi phạm (phân loại cấp 1).
CREATE TABLE IF NOT EXISTS loai_vi_pham (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(30)  NOT NULL UNIQUE,    -- mã nhóm, ví dụ 'N_AT_CT' (an toàn công trường)
    ten         VARCHAR(300) NOT NULL,           -- tên nhóm hành vi
    mo_ta       TEXT,
    so_thu_tu   INT         NOT NULL DEFAULT 0,  -- thứ tự hiển thị
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hành vi vi phạm cụ thể (tương ứng khoản/điểm của Điều 16).
CREATE TABLE IF NOT EXISTS hanh_vi_vi_pham (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loai_vi_pham_id    UUID NOT NULL REFERENCES loai_vi_pham(id),
    dieu               VARCHAR(10) NOT NULL DEFAULT '16',   -- điều của nghị định
    khoan              VARCHAR(10) NOT NULL,                -- khoản (1..13)
    diem               VARCHAR(10),                         -- điểm (a/b/c) nếu có
    ten                VARCHAR(500) NOT NULL,               -- mô tả ngắn hành vi
    mo_ta              TEXT,                                -- mô tả đầy đủ
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_hanh_vi UNIQUE (dieu, khoan, diem)
);

-- Khung mức phạt tiền cho từng hành vi theo NHÓM CÔNG TRÌNH.
-- Nhóm 1: nhà ở riêng lẻ; Nhóm 2: nhà ở riêng lẻ trong khu bảo tồn/khu di tích
-- hoặc công trình khác; Nhóm 3: công trình phải lập BCNCKT hoặc BCKT-KT.
-- Lưu ý: mức phạt dưới đây là mức dành cho TỔ CHỨC; mức dành cho CÁ NHÂN = 1/2.
CREATE TABLE IF NOT EXISTS muc_phat (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hanh_vi_id       UUID NOT NULL REFERENCES hanh_vi_vi_pham(id) ON DELETE CASCADE,
    nhom_cong_trinh  INT  NOT NULL CHECK (nhom_cong_trinh IN (1,2,3)),
    muc_toi_thieu    BIGINT NOT NULL CHECK (muc_toi_thieu >= 0),   -- mức phạt tối thiểu (đồng, cho tổ chức)
    muc_toi_da       BIGINT NOT NULL CHECK (muc_toi_da >= muc_toi_thieu),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_muc_phat UNIQUE (hanh_vi_id, nhom_cong_trinh)
);

-- ---------------------------------------------------------------------------
-- 5. Báo cáo vi phạm (người dân gửi) và Hồ sơ xử lý
-- ---------------------------------------------------------------------------

-- Báo cáo vi phạm do người dân/công dân gửi lên (kèm vị trí GIS, ảnh...).
CREATE TABLE IF NOT EXISTS bao_cao_vi_pham (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ma_bao_cao       VARCHAR(30) NOT NULL UNIQUE,   -- mã báo cáo (vd BC-2026-000123)
    nguoi_gui_id     UUID REFERENCES users(id),     -- người gửi (NULL nếu gửi ẩn danh)
    nguoi_gui_ten    VARCHAR(200),                  -- họ tên người gửi (bản sao)
    nguoi_gui_sdt    VARCHAR(20),
    nguoi_gui_email  CITEXT,
    mo_ta            TEXT NOT NULL,                 -- nội dung mô tả vi phạm
    dia_chi          TEXT,                          -- địa chỉ dạng văn bản
    quan_huyen_id    UUID REFERENCES quan_huyen(id),
    phuong_xa_id     UUID REFERENCES phuong_xa(id),
    toa_do           GEOMETRY(Point, 4326),         -- vị trí chấm trên bản đồ
    thoi_gian_xay_ra TIMESTAMPTZ,                   -- thời điểm phát hiện/vi phạm
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chủ thể vi phạm (cá nhân hoặc tổ chức bị xử lý).
-- (Đặt trước ho_so vì ho_so tham chiếu nguoi_vi_pham.id)
CREATE TABLE IF NOT EXISTS nguoi_vi_pham (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loai_chu_the      VARCHAR(10) NOT NULL CHECK (loai_chu_the IN ('ca_nhan','to_chuc')),
    ten               VARCHAR(300) NOT NULL,            -- tên cá nhân / tên tổ chức
    cmnd_cccd         VARCHAR(20),                      -- CMND/CCCD (cá nhân) / MST (tổ chức)
    dia_chi           TEXT,
    sdt               VARCHAR(20),
    email             CITEXT,
    nguoi_dai_dien    VARCHAR(200),                     -- người đại diện (nếu là tổ chức)
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hồ sơ xử lý vi phạm (vụ việc) — bảng trung tâm của hệ thống.
-- Enum type is created idempotently (DO block) so the baseline is safe to re-apply.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trang_thai_ho_so') THEN
        CREATE TYPE trang_thai_ho_so AS ENUM (
            'cho_tiep_nhan',
            'cho_xac_minh',
            'dang_xac_minh',
            'cho_bo_sung',
            'cho_lap_bien_ban',
            'da_lap_bien_ban',
            'cho_ra_quyet_dinh',
            'da_ra_quyet_dinh',
            'dang_khac_phuc',
            'cho_duyet_dieu_81',
            'da_khac_phuc',
            'da_dong',
            'da_huy'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS ho_so (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ma_ho_so            VARCHAR(30) NOT NULL UNIQUE,    -- mã hồ sơ (vd HS-2026-000123)
    bao_cao_id          UUID REFERENCES bao_cao_vi_pham(id),  -- xuất phát từ báo cáo (nếu có)
    loai_vi_pham_id     UUID REFERENCES loai_vi_pham(id),     -- phân loại nhóm (sau xác minh)
    hanh_vi_id          UUID REFERENCES hanh_vi_vi_pham(id),  -- hành vi cụ thể (sau xác minh)
    nguoi_nop_id        UUID REFERENCES users(id),            -- cán bộ thụ lý hồ sơ
    nguoi_xu_ly_id      UUID REFERENCES users(id),            -- cán bộ được phân công xử lý
    trang_thai          trang_thai_ho_so NOT NULL DEFAULT 'cho_tiep_nhan',
    nguoi_vi_pham_id    UUID REFERENCES nguoi_vi_pham(id),    -- chủ thể bị xử lý (tạo trước, tham chiếu ở đây)

    -- Thông tin vị trí
    dia_chi             TEXT,
    quan_huyen_id       UUID REFERENCES quan_huyen(id),
    phuong_xa_id        UUID REFERENCES phuong_xa(id),
    toa_do              GEOMETRY(Point, 4326),          -- điểm vi phạm trên bản đồ

    -- Thông tin nghiệp vụ
    thoi_gian_xay_ra    TIMESTAMPTZ,                    -- thời điểm vi phạm
    mo_ta               TEXT,                           -- mô tả nội dung vụ việc
    muc_phat_du_kien    BIGINT CHECK (muc_phat_du_kien IS NULL OR muc_phat_du_kien >= 0),
    dang_thi_cong       BOOLEAN NOT NULL DEFAULT FALSE, -- công trình đang thi công (liên quan Điều 81)
    han_hop_phap_hoa    DATE,                           -- hạn hoàn thiện hồ sơ xin cấp phép (Điều 81: 30/90 ngày)
    ghi_chu             TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ                      -- gạch mềm (lưu trữ)
);
DROP TRIGGER IF EXISTS trg_ho_so_updated_at ON ho_so;
CREATE TRIGGER trg_ho_so_updated_at
    BEFORE UPDATE ON ho_so
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Chỉ mục hỗ trợ tra cứu, lọc theo trạng thái và GIS.
CREATE INDEX IF NOT EXISTS idx_ho_so_trang_thai  ON ho_so (trang_thai);
CREATE INDEX IF NOT EXISTS idx_ho_so_nguoi_nop   ON ho_so (nguoi_nop_id);
CREATE INDEX IF NOT EXISTS idx_ho_so_nguoi_xu_ly ON ho_so (nguoi_xu_ly_id);
CREATE INDEX IF NOT EXISTS idx_ho_so_huyen       ON ho_so (quan_huyen_id);
CREATE INDEX IF NOT EXISTS idx_ho_so_xa          ON ho_so (phuong_xa_id);
CREATE INDEX IF NOT EXISTS idx_ho_so_toa_do      ON ho_so USING GIST (toa_do);
CREATE INDEX IF NOT EXISTS idx_ho_so_created     ON ho_so (created_at);

-- ---------------------------------------------------------------------------
-- 6. Biên bản vi phạm hành chính
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bien_ban (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ma_bien_ban      VARCHAR(30) NOT NULL UNIQUE,       -- số hiệu biên bản
    ho_so_id         UUID NOT NULL REFERENCES ho_so(id) ON DELETE CASCADE,
    nguoi_lap_id     UUID NOT NULL REFERENCES users(id),        -- người lập biên bản
    nguoi_vi_pham_id UUID REFERENCES nguoi_vi_pham(id),         -- người vi phạm
    hanh_vi_id       UUID REFERENCES hanh_vi_vi_pham(id),       -- hành vi vi phạm
    thoi_gian_lap    TIMESTAMPTZ NOT NULL DEFAULT now(),
    noi_dung         TEXT,                                      -- nội dung biên bản
    hinh_thuc_xu_phat VARCHAR(50) DEFAULT 'phat_tien',          -- cảnh cáo / phạt tiền...
    muc_phat_du_kien BIGINT CHECK (muc_phat_du_kien IS NULL OR muc_phat_du_kien >= 0),
    trang_thai       VARCHAR(30) NOT NULL DEFAULT 'moi_lap'
                     CHECK (trang_thai IN ('moi_lap','cho_phe_duyet','da_ban_hanh','da_huy')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_bien_ban_updated_at ON bien_ban;
CREATE TRIGGER trg_bien_ban_updated_at
    BEFORE UPDATE ON bien_ban
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. Quyết định xử phạt
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quyet_dinh (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ma_quyet_dinh             VARCHAR(30) NOT NULL UNIQUE,   -- số hiệu quyết định
    bien_ban_id               UUID REFERENCES bien_ban(id),
    ho_so_id                  UUID NOT NULL REFERENCES ho_so(id) ON DELETE CASCADE,
    nguoi_ky_id               UUID NOT NULL REFERENCES users(id),   -- người có thẩm quyền ký
    so_tien_phat              BIGINT CHECK (so_tien_phat IS NULL OR so_tien_phat >= 0), -- mức phạt thực tế
    can_cu_phap_ly            TEXT,                          -- căn cứ pháp lý (trích dẫn điều/khoản)
    hinh_thuc_phat_bo_sung    TEXT,                          -- tước GPXD, tịch thu tang vật...
    bien_phap_khac_phuc_hau_qua TEXT,                        -- buộc che chắn / phá dỡ / điều chỉnh GPXD...
    ngay_ban_hanh             DATE,
    trang_thai                VARCHAR(30) NOT NULL DEFAULT 'draft'
                              CHECK (trang_thai IN ('draft','da_ban_hanh','da_giao','da_thi_hanh','da_huy')),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_quyet_dinh_updated_at ON quyet_dinh;
CREATE TRIGGER trg_quyet_dinh_updated_at
    BEFORE UPDATE ON quyet_dinh
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. Theo dõi khắc phục hậu quả
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS khac_phuc (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ho_so_id            UUID NOT NULL REFERENCES ho_so(id)      ON DELETE CASCADE,
    quyet_dinh_id       UUID REFERENCES quyet_dinh(id)          ON DELETE SET NULL,
    bien_phap           VARCHAR(300) NOT NULL,   -- nội dung biện pháp khắc phục (vd: buộc phá dỡ)
    mo_ta               TEXT,
    han_thuc_hien       DATE,                    -- hạn thực hiện
    trang_thai          VARCHAR(30) NOT NULL DEFAULT 'chua_thuc_hien'
                        CHECK (trang_thai IN ('chua_thuc_hien','dang_thuc_hien','da_thuc_hien',
                                              'qua_han','cuong_che','da_kiem_tra')),
    nguoi_theo_doi_id   UUID REFERENCES users(id),
    ngay_hoan_thanh     TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_khac_phuc_updated_at ON khac_phuc;
CREATE TRIGGER trg_khac_phuc_updated_at
    BEFORE UPDATE ON khac_phuc
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. Thông báo
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS thong_bao (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nguoi_nhan_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ho_so_id        UUID REFERENCES ho_so(id) ON DELETE SET NULL,
    loai            VARCHAR(50) NOT NULL,   -- 'bao_cao','xac_minh','bien_ban','quyet_dinh','khac_phuc'
    tieu_de         VARCHAR(300) NOT NULL,
    noi_dung        TEXT,
    kenh            VARCHAR(20) NOT NULL DEFAULT 'portal' CHECK (kenh IN ('portal','email','sms')),
    trang_thai      VARCHAR(20) NOT NULL DEFAULT 'cho_gui'
                    CHECK (trang_thai IN ('cho_gui','da_gui','that_bai','da_doc')),
    ngay_gui        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 10. Tệp đính kèm (ảnh chứng cứ, văn bản scan...)
-- ---------------------------------------------------------------------------
-- Thiết kế đa hình: một tệp có thể thuộc về một loại thực thể bất kỳ
-- (bao_cao / ho_so / bien_ban / quyet_dinh / khac_phuc) qua cặp entity_type + entity_id.
CREATE TABLE IF NOT EXISTS tep_dinh_kem (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type     VARCHAR(50) NOT NULL,   -- 'bao_cao','ho_so','bien_ban','quyet_dinh','khac_phuc'
    entity_id       UUID NOT NULL,
    ten_goc         VARCHAR(255) NOT NULL,  -- tên file gốc khi tải lên
    duong_dan       TEXT NOT NULL,          -- đường dẫn / object key lưu trữ
    loai_file       VARCHAR(100),           -- MIME type
    kich_thuoc      BIGINT CHECK (kich_thuoc IS NULL OR kich_thuoc >= 0), -- dung lượng (bytes)
    nguoi_tai_id    UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tep_dinh_kem_entity ON tep_dinh_kem (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- 11. Nhật ký kiểm toán (audit log)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id              BIGSERIAL PRIMARY KEY,
    nguoi_dung_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    hanh_dong       VARCHAR(100) NOT NULL,      -- hành động: create/update/delete/approve...
    bang_bi_tac_dong VARCHAR(100) NOT NULL,     -- tên bảng bị tác động
    id_ban_ghi      UUID,                        -- id bản ghi bị tác động
    chi_tiet        JSONB,                       -- dữ liệu chi tiết / before-after
    ip              VARCHAR(45),                 -- địa chỉ IP nguồn
    thoi_gian       TIMESTAMPTZ NOT NULL DEFAULT now(),
    request_id      UUID
);
CREATE INDEX IF NOT EXISTS idx_audit_entity         ON audit_log (bang_bi_tac_dong, id_ban_ghi);
CREATE INDEX IF NOT EXISTS idx_audit_time           ON audit_log (thoi_gian);
CREATE INDEX IF NOT EXISTS idx_audit_user           ON audit_log (nguoi_dung_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_created ON audit_log (nguoi_dung_id, thoi_gian);

-- ---------------------------------------------------------------------------
-- 12. Seed dữ liệu danh mục hành vi vi phạm (Điều 16 Nghị định 16/2022/NĐ-CP)
-- ---------------------------------------------------------------------------

-- 12.1 Nhóm hành vi vi phạm
INSERT INTO loai_vi_pham (code, ten, so_thu_tu) VALUES
    ('N_AT_CT', 'Vi phạm về an toàn, vệ sinh công trường', 1),
    ('N_GPXD',  'Vi phạm về thủ tục giấy phép xây dựng',    2),
    ('N_CLQH',  'Vi phạm về chất lượng, quy hoạch, lấn chiếm', 3),
    ('N_TAIPHAM','Vi phạm mang tính cố tình, tái phạm',     4)
ON CONFLICT (code) DO NOTHING;

-- 12.2 Hành vi vi phạm cụ thể (khoản 1..13 Điều 16) — mỗi khoản là một hành vi.
INSERT INTO hanh_vi_vi_pham (loai_vi_pham_id, khoan, diem, ten) VALUES
    -- Nhóm an toàn, vệ sinh công trường
    ((SELECT id FROM loai_vi_pham WHERE code='N_AT_CT'), '1', NULL,
     'Tổ chức thi công không che chắn, để rơi vãi vật liệu, để vật liệu sai nơi quy định'),
    ((SELECT id FROM loai_vi_pham WHERE code='N_AT_CT'), '2', NULL,
     'Không công khai giấy phép xây dựng tại công trường trong quá trình thi công'),
    -- Nhóm thủ tục giấy phép xây dựng
    ((SELECT id FROM loai_vi_pham WHERE code='N_GPXD'), '3', NULL,
     'Không thực hiện thủ tục điều chỉnh, gia hạn giấy phép xây dựng'),
    ((SELECT id FROM loai_vi_pham WHERE code='N_GPXD'), '4', NULL,
     'Thi công sai nội dung giấy phép (sửa chữa, cải tạo, di dời, GPXD có thời hạn)'),
    ((SELECT id FROM loai_vi_pham WHERE code='N_GPXD'), '6', NULL,
     'Thi công sai nội dung giấy phép xây dựng được cấp mới'),
    ((SELECT id FROM loai_vi_pham WHERE code='N_GPXD'), '7', NULL,
     'Thi công không có giấy phép xây dựng mà theo quy định phải có'),
    ((SELECT id FROM loai_vi_pham WHERE code='N_GPXD'), '8', NULL,
     'Xây dựng không đúng thiết kế được thẩm định (trường hợp được miễn giấy phép)'),
    -- Nhóm chất lượng, quy hoạch, lấn chiếm
    ((SELECT id FROM loai_vi_pham WHERE code='N_CLQH'), '5', NULL,
     'Thi công gây lún, nứt, hư hỏng hạ tầng/công trình lân cận hoặc nguy cơ sụp đổ (không gây thiệt hại sức khỏe, tính mạng)'),
    ((SELECT id FROM loai_vi_pham WHERE code='N_CLQH'), '9', NULL,
     'Xây dựng không đúng quy hoạch xây dựng, quy hoạch đô thị được duyệt'),
    ((SELECT id FROM loai_vi_pham WHERE code='N_CLQH'), '10', NULL,
     'Cơi nới, lấn chiếm diện tích, không gian của tổ chức, cá nhân khác hoặc khu vực công cộng'),
    -- Nhóm cố tình, tái phạm
    ((SELECT id FROM loai_vi_pham WHERE code='N_TAIPHAM'), '12', NULL,
     'Tiếp tục thực hiện hành vi vi phạm sau khi đã bị lập biên bản'),
    ((SELECT id FROM loai_vi_pham WHERE code='N_TAIPHAM'), '13', NULL,
     'Tái phạm (không bị truy cứu trách nhiệm hình sự)')
ON CONFLICT (dieu, khoan, diem) DO NOTHING;

-- 12.3 Khung mức phạt tiền (đơn vị: ĐỒNG) theo nhóm công trình.
-- Mức phạt là mức dành cho TỔ CHỨC; đối với CÁ NHÂN = 1/2 (tính khi áp dụng).
-- Dữ liệu tham chiếu Điều 16 Nghị định 16/2022/NĐ-CP.
INSERT INTO muc_phat (hanh_vi_id, nhom_cong_trinh, muc_toi_thieu, muc_toi_da) VALUES
    -- Khoản 1: nhóm 1 và 2 chung mức (3–5 triệu), nhóm 3 (15–20 triệu)
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='1'), 1, 3000000, 5000000),
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='1'), 2, 3000000, 5000000),
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='1'), 3, 15000000, 20000000),
    -- Khoản 2
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='2'), 1, 5000000, 10000000),
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='2'), 2, 10000000, 20000000),
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='2'), 3, 20000000, 30000000),
    -- Khoản 3
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='3'), 1, 15000000, 20000000),
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='3'), 2, 25000000, 30000000),
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='3'), 3, 60000000, 80000000),
    -- Khoản 4
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='4'), 1, 15000000, 20000000),
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='4'), 2, 25000000, 30000000),
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='4'), 3, 70000000, 90000000),
    -- Khoản 5
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='5'), 1, 30000000, 40000000),
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='5'), 2, 50000000, 60000000),
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='5'), 3, 80000000, 100000000),
    -- Khoản 6
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='6'), 1, 30000000, 40000000),
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='6'), 2, 50000000, 70000000),
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='6'), 3, 100000000, 120000000),
    -- Khoản 7
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='7'), 1, 60000000, 80000000),
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='7'), 2, 80000000, 100000000),
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='7'), 3, 120000000, 140000000),
    -- Khoản 8: một mức duy nhất áp dụng chung cho mọi nhóm
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='8'), 1, 80000000, 100000000),
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='8'), 2, 80000000, 100000000),
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='8'), 3, 80000000, 100000000),
    -- Khoản 9
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='9'), 1, 80000000, 100000000),
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='9'), 2, 100000000, 120000000),
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='9'), 3, 160000000, 180000000),
    -- Khoản 10
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='10'), 1, 80000000, 100000000),
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='10'), 2, 100000000, 120000000),
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='10'), 3, 180000000, 200000000),
    -- Khoản 12
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='12'), 1, 100000000, 120000000),
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='12'), 2, 120000000, 140000000),
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='12'), 3, 400000000, 500000000),
    -- Khoản 13
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='13'), 1, 120000000, 140000000),
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='13'), 2, 140000000, 160000000),
    ((SELECT id FROM hanh_vi_vi_pham WHERE khoan='13'), 3, 950000000, 1000000000)
ON CONFLICT (hanh_vi_id, nhom_cong_trinh) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 13. Seed dữ liệu vai trò, quyền hạn cơ bản
-- ---------------------------------------------------------------------------
INSERT INTO roles (code, name, description) VALUES
    ('citizen',      'Công dân',          'Người dân báo cáo vi phạm, theo dõi tiến độ hồ sơ'),
    ('case_handler', 'Cán bộ thụ lý',     'Cán bộ địa chính - xây dựng xử lý hồ sơ'),
    ('verifier',     'Cán bộ xác minh',   'Cán bộ xác minh, phân loại vi phạm'),
    ('leader',       'Lãnh đạo',          'Lãnh đạo theo dõi, thống kê, báo cáo'),
    ('admin',        'Quản trị hệ thống', 'Quản trị người dùng, RBAC, cấu hình hệ thống')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, module) VALUES
    ('report.create',      'Tạo báo cáo vi phạm',          'report'),
    ('report.view_own',    'Xem báo cáo của chính mình',   'report'),
    ('case.view',          'Xem hồ sơ xử lý',              'case'),
    ('case.update',        'Cập nhật hồ sơ',               'case'),
    ('case.assign',        'Phân công cán bộ thụ lý',      'case'),
    ('case.approve',       'Phê duyệt / ban hành quyết định', 'case'),
    ('bien_ban.create',    'Lập biên bản vi phạm',         'case'),
    ('quyet_dinh.issue',   'Ban hành quyết định xử phạt',  'case'),
    ('khac_phuc.manage',   'Quản lý khắc phục hậu quả',    'case'),
    ('gis.manage',         'Quản lý dữ liệu GIS',          'gis'),
    ('report.statistics',  'Thống kê, báo cáo',            'report'),
    ('admin.users',        'Quản trị người dùng, RBAC',    'admin'),
    ('admin.audit',        'Xem nhật ký kiểm toán',        'admin'),
    ('admin.locations',    'Quản lý địa điểm (đơn vị hành chính)', 'admin')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 14. Bảng theo dõi migration (schema_migrations)
-- ---------------------------------------------------------------------------
-- The migration runner (scripts/migrate.js) owns the schema_migrations table
-- and creates it itself as (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ) before
-- applying any migration. It is intentionally NOT defined here so the runner and
-- the baseline always agree on its shape.

-- Token blocklist for revocation
CREATE TABLE IF NOT EXISTS token_blocklist (
    jti         VARCHAR(100) PRIMARY KEY,
    expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_token_blocklist_expires ON token_blocklist(expires_at);

-- Token tracking for invalidation
CREATE TABLE IF NOT EXISTS user_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jti VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_tokens_user ON user_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tokens_jti ON user_tokens(jti);

-- Refresh tokens for token rotation
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jti VARCHAR(100) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_jti ON refresh_tokens(jti);

-- Password reset tokens (forgot-password flow)
CREATE TABLE IF NOT EXISTS reset_token (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used        BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reset_token_user ON reset_token(user_id);
CREATE INDEX IF NOT EXISTS idx_reset_token_hash ON reset_token(token_hash);

COMMIT;
