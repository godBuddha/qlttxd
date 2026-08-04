'use strict';

const express = require('express');

module.exports = function docsRoutes() {
  const router = express.Router();

  // GET /api/v1/docs — returns OpenAPI 3.0 spec (JSON)
  router.get('/api/v1/docs', (_req, res) => {
    res.json(openApiSpec);
  });

  return router;
};

// ---------------------------------------------------------------------------
// OpenAPI 3.0 specification — auto-generated from route definitions
// ---------------------------------------------------------------------------
const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'QLTTXD API',
    description: 'API quản lý trật tự xây dựng — Hệ thống Quản lý Trật tự Xây dựng (QLTTXD)',
    version: '0.2.1',
    contact: { name: 'QLTTXD Team' },
  },
  servers: [{ url: '/api/v1', description: 'API v1' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from /api/v1/auth/login',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          username: { type: 'string' },
          full_name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          is_active: { type: 'boolean' },
          roles: { type: 'array', items: { type: 'string' } },
          permissions: { type: 'array', items: { type: 'string' } },
        },
      },
      HoSo: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          ma_ho_so: { type: 'string' },
          trang_thai: { type: 'string', enum: ['moi', 'cho_lap_bien_ban', 'da_lap_bien_ban', 'cho_ra_quyet_dinh', 'da_ra_quyet_dinh', 'dang_khac_phuc', 'da_khac_phuc', 'da_dong', 'da_huy', 'cho_bo_sung', 'cho_duyet_dieu_81'] },
          dia_chi: { type: 'string' },
          mo_ta: { type: 'string' },
          thoi_gian_xay_ra: { type: 'string', format: 'date-time' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      BaoCao: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          ma_bao_cao: { type: 'string' },
          nguoi_gui_ten: { type: 'string' },
          mo_ta: { type: 'string' },
          dia_chi: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      BienBan: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          ma_bien_ban: { type: 'string' },
          ho_so_id: { type: 'string', format: 'uuid' },
          noi_dung: { type: 'string' },
          muc_phat_du_kien: { type: 'number' },
        },
      },
      QuyetDinh: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          ma_quyet_dinh: { type: 'string' },
          ho_so_id: { type: 'string', format: 'uuid' },
          so_tien_phat: { type: 'number' },
          trang_thai: { type: 'string', enum: ['draft', 'da_ban_hanh'] },
          ngay_ban_hanh: { type: 'string', format: 'date' },
        },
      },
      ThongBao: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          ho_so_id: { type: 'string', format: 'uuid' },
          loai: { type: 'string' },
          tieu_de: { type: 'string' },
          noi_dung: { type: 'string' },
          trang_thai: { type: 'string', enum: ['chua_doc', 'da_doc'] },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    // ── Health ──────────────────────────────────────────────────────────────
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        security: [],
        responses: { 200: { description: 'Server healthy', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, db: { type: 'string' }, uptime: { type: 'integer' }, version: { type: 'string' } } } } } } },
      },
    },

    // ── Auth ────────────────────────────────────────────────────────────────
    '/auth/setup-status': {
      get: {
        tags: ['Auth'],
        summary: 'Check if admin setup is needed',
        security: [],
        responses: { 200: { description: 'Setup status', content: { 'application/json': { schema: { type: 'object', properties: { needsSetup: { type: 'boolean' } } } } } } },
      },
    },
    '/auth/setup-admin': {
      post: {
        tags: ['Auth'],
        summary: 'Create initial admin account',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['username', 'password', 'full_name'], properties: { username: { type: 'string', minLength: 3, maxLength: 50 }, password: { type: 'string', minLength: 8 }, full_name: { type: 'string' }, email: { type: 'string', format: 'email' }, phone: { type: 'string' } } } } },
        },
        responses: { 201: { description: 'Admin created with token' }, 409: { description: 'Admin already exists' } },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login and obtain JWT token',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['username', 'password'], properties: { username: { type: 'string' }, password: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Login successful', content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' }, user: { '$ref': '#/components/schemas/User' } } } } } }, 401: { description: 'Invalid credentials' } },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout (revoke current token)',
        responses: { 200: { description: 'Logged out' } },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current user profile',
        responses: { 200: { description: 'Current user', content: { 'application/json': { schema: { type: 'object', properties: { user: { '$ref': '#/components/schemas/User' } } } } } } },
      },
    },
    '/auth/password': {
      patch: {
        tags: ['Auth'],
        summary: 'Change own password',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['old_password', 'new_password'], properties: { old_password: { type: 'string' }, new_password: { type: 'string', minLength: 8 } } } } },
        },
        responses: { 200: { description: 'Password changed' }, 401: { description: 'Old password incorrect' } },
      },
    },
    '/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request password reset token',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['identifier'], properties: { identifier: { type: 'string', description: 'Username or email' } } } } },
        },
        responses: { 200: { description: 'Reset instructions sent (always returns success)' } },
      },
    },
    '/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Reset password with token',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['token', 'new_password'], properties: { token: { type: 'string' }, new_password: { type: 'string', minLength: 8 } } } } },
        },
        responses: { 200: { description: 'Password reset successful' }, 400: { description: 'Invalid or expired token' } },
      },
    },

    // ── Danh mục (catalogs — public) ───────────────────────────────────────
    '/danh-muc/loai-vi-pham': {
      get: { tags: ['Danh mục'], summary: 'List loại vi phạm', security: [], responses: { 200: { description: 'OK' } } },
    },
    '/danh-muc/hanh-vi': {
      get: { tags: ['Danh mục'], summary: 'List hành vi vi phạm', security: [], parameters: [{ name: 'loai_vi_pham_id', in: 'query', schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'OK' } } },
    },
    '/danh-muc/muc-phat': {
      get: { tags: ['Danh mục'], summary: 'List mức phạt', security: [], parameters: [{ name: 'hanh_vi_id', in: 'query', schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'OK' } } },
    },
    '/danh-muc/quan-huyen': {
      get: { tags: ['Danh mục'], summary: 'List quận/huyện', security: [], responses: { 200: { description: 'OK' } } },
    },
    '/danh-muc/phuong-xa': {
      get: { tags: ['Danh mục'], summary: 'List phường/xã', security: [], parameters: [{ name: 'quan_huyen_id', in: 'query', schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'OK' } } },
    },
    '/danh-muc/can-bo': {
      get: { tags: ['Danh mục'], summary: 'List cán bộ xử lý (case_handler)', responses: { 200: { description: 'OK' } } },
    },

    // ── Báo cáo (reports) ──────────────────────────────────────────────────
    '/bao-cao': {
      post: {
        tags: ['Báo cáo'],
        summary: 'Create a new violation report (multipart/form-data)',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['mo_ta', 'lat', 'lng'],
                properties: {
                  mo_ta: { type: 'string' },
                  dia_chi: { type: 'string' },
                  lat: { type: 'number' },
                  lng: { type: 'number' },
                  thoi_gian_xay_ra: { type: 'string', format: 'date-time' },
                  nguoi_gui_ten: { type: 'string' },
                  nguoi_gui_sdt: { type: 'string' },
                  nguoi_gui_email: { type: 'string', format: 'email' },
                  anh: { type: 'array', items: { type: 'string', format: 'binary' }, maxItems: 5 },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Report created' }, 400: { description: 'Validation error' } },
      },
      get: {
        tags: ['Báo cáo'],
        summary: 'List reports (own or all if has case.view)',
        responses: { 200: { description: 'OK' } },
      },
    },
    '/bao-cao/{id}': {
      get: {
        tags: ['Báo cáo'],
        summary: 'Get report detail',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'OK' }, 404: { description: 'Not found' } },
      },
    },
    '/bao-cao/{id}/to-ho-so': {
      post: {
        tags: ['Báo cáo'],
        summary: 'Convert report to case (ho_so)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 201: { description: 'Case created from report' }, 409: { description: 'Already converted' } },
      },
    },

    // ── Hồ sơ (cases) ─────────────────────────────────────────────────────
    '/ho-so': {
      post: {
        tags: ['Hồ sơ'],
        summary: 'Create a new case',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { bao_cao_id: { type: 'string', format: 'uuid' }, loai_vi_pham_id: { type: 'string', format: 'uuid' }, hanh_vi_id: { type: 'string', format: 'uuid' }, dia_chi: { type: 'string' }, mo_ta: { type: 'string' }, lat: { type: 'number' }, lng: { type: 'number' }, thoi_gian_xay_ra: { type: 'string', format: 'date-time' }, nguoi_vi_pham: { type: 'object', properties: { loai_chu_the: { type: 'string' }, ten: { type: 'string' }, cmnd_cccd: { type: 'string' }, dia_chi: { type: 'string' }, sdt: { type: 'string' }, email: { type: 'string' }, nguoi_dai_dien: { type: 'string' } } } } } } },
        },
        responses: { 201: { description: 'Case created' } },
      },
      get: {
        tags: ['Hồ sơ'],
        summary: 'List cases (paginated, filtered)',
        parameters: [
          { name: 'trang_thai', in: 'query', schema: { type: 'string' } },
          { name: 'quan_huyen_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'tu_ngay', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'den_ngay', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Full-text search' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: { 200: { description: 'Paginated list of cases' } },
      },
    },
    '/ho-so/{id}': {
      get: {
        tags: ['Hồ sơ'],
        summary: 'Get case detail (includes biên bản, quyết định, khắc phục, ảnh)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'OK' }, 404: { description: 'Not found' } },
      },
    },
    '/ho-so/{id}/trang-thai': {
      patch: {
        tags: ['Hồ sơ'],
        summary: 'Transition case status',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['trang_thai'], properties: { trang_thai: { type: 'string', enum: ['moi', 'cho_lap_bien_ban', 'da_lap_bien_ban', 'cho_ra_quyet_dinh', 'da_ra_quyet_dinh', 'dang_khac_phuc', 'da_khac_phuc', 'da_dong', 'da_huy', 'cho_bo_sung', 'cho_duyet_dieu_81'] } } } } },
        },
        responses: { 200: { description: 'Status updated' }, 400: { description: 'Invalid transition' } },
      },
    },
    '/ho-so/{id}/phan-cong': {
      put: {
        tags: ['Hồ sơ'],
        summary: 'Assign case handler',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['can_bo_id'], properties: { can_bo_id: { type: 'string', format: 'uuid' } } } } },
        },
        responses: { 200: { description: 'Handler assigned' }, 400: { description: 'Invalid handler' } },
      },
    },
    '/ho-so/{id}/bien-ban': {
      post: {
        tags: ['Hồ sơ'],
        summary: 'Create biên bản for case (case must be in cho_lap_bien_ban)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { noi_dung: { type: 'string' }, muc_phat_du_kien: { type: 'number' } } } } },
        },
        responses: { 201: { description: 'Biên bản created' }, 400: { description: 'Case not in correct state' } },
      },
    },
    '/ho-so/{id}/quyet-dinh': {
      post: {
        tags: ['Hồ sơ'],
        summary: 'Create quyết định draft for case',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['bien_ban_id'], properties: { bien_ban_id: { type: 'string', format: 'uuid' }, nhom_cong_trinh: { type: 'integer', enum: [1, 2, 3] }, can_cu_phap_ly: { type: 'string' }, hinh_thuc_phat_bo_sung: { type: 'string' }, bien_phap_khac_phuc_hau_qua: { type: 'string' } } } } },
        },
        responses: { 201: { description: 'Quyết định created (draft)' }, 400: { description: 'Case not in correct state or missing biên bản' } },
      },
    },
    '/ho-so/{id}/quyet-dinh/ban-hanh': {
      post: {
        tags: ['Hồ sơ'],
        summary: 'Issue (publish) latest draft quyết định',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { ngay_ban_hanh: { type: 'string', format: 'date' } } } } },
        },
        responses: { 200: { description: 'Quyết định issued' }, 400: { description: 'No draft to issue' } },
      },
    },
    '/ho-so/{id}/khac-phuc': {
      post: {
        tags: ['Hồ sơ'],
        summary: 'Register remedy tracking for case',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { quyet_dinh_id: { type: 'string', format: 'uuid' }, bien_phap: { type: 'string' }, mo_ta: { type: 'string' }, han_thuc_hien: { type: 'string', format: 'date' } } } } },
        },
        responses: { 201: { description: 'Remedy registered' }, 400: { description: 'Case not in correct state' } },
      },
    },
    '/khac-phuc/{id}': {
      patch: {
        tags: ['Hồ sơ'],
        summary: 'Update remedy status',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['trang_thai'], properties: { trang_thai: { type: 'string', enum: ['chua_thuc_hien', 'dang_thuc_hien', 'da_thuc_hien', 'qua_han', 'cuong_che', 'da_kiem_tra'] } } } } },
        },
        responses: { 200: { description: 'Remedy updated' }, 400: { description: 'Invalid status' } },
      },
    },
    '/ho-so/{id}/xuat-bien-ban.docx': {
      get: {
        tags: ['Xuất'],
        summary: 'Export biên bản as DOCX',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'DOCX file', content: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { schema: { type: 'string', format: 'binary' } } } } },
      },
    },
    '/ho-so/{id}/xuat-quyet-dinh.docx': {
      get: {
        tags: ['Xuất'],
        summary: 'Export quyết định as DOCX',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'DOCX file' } },
      },
    },
    '/ho-so/{id}/xuat-bien-ban.pdf': {
      get: {
        tags: ['Xuất'],
        summary: 'Export biên bản as PDF (Vietnamese font)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'PDF file', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } } },
      },
    },
    '/ho-so/{id}/xuat-quyet-dinh.pdf': {
      get: {
        tags: ['Xuất'],
        summary: 'Export quyết định as PDF (Vietnamese font)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'PDF file' } },
      },
    },

    // ── Thống kê (statistics) ─────────────────────────────────────────────
    '/thong-ke/tong-quan': {
      get: {
        tags: ['Thống kê'],
        summary: 'Overview statistics (by status, district, month)',
        responses: { 200: { description: 'Statistics data' } },
      },
    },
    '/thong-ke/xuat': {
      get: {
        tags: ['Thống kê'],
        summary: 'Export statistics as CSV or PDF',
        parameters: [
          { name: 'loai', in: 'query', schema: { type: 'string', enum: ['csv', 'pdf'] } },
          { name: 'trang_thai', in: 'query', schema: { type: 'string' } },
          { name: 'quan_huyen_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'tu_ngay', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'den_ngay', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'CSV or PDF file' }, 400: { description: 'Invalid export type' } },
      },
    },

    // ── Bản đồ (map) ──────────────────────────────────────────────────────
    '/ban-do/vi-pham': {
      get: {
        tags: ['Bản đồ'],
        summary: 'Get violation locations for map display',
        responses: { 200: { description: 'GeoJSON-compatible list' } },
      },
    },

    // ── Thông báo (notifications) ─────────────────────────────────────────
    '/thong-bao': {
      get: {
        tags: ['Thông báo'],
        summary: 'List notifications for current user (paginated)',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Paginated notifications' } },
      },
    },
    '/thong-bao/unread-count': {
      get: {
        tags: ['Thông báo'],
        summary: 'Get unread notification count',
        responses: { 200: { description: 'Count', content: { 'application/json': { schema: { type: 'object', properties: { count: { type: 'integer' } } } } } } },
      },
    },
    '/thong-bao/{id}/mark-read': {
      post: {
        tags: ['Thông báo'],
        summary: 'Mark single notification as read',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Marked' }, 404: { description: 'Not found' } },
      },
    },
    '/thong-bao/mark-all-read': {
      post: {
        tags: ['Thông báo'],
        summary: 'Mark all notifications as read',
        responses: { 200: { description: 'All marked' } },
      },
    },

    // ── Admin: Users ─────────────────────────────────────────────────────
    '/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'List all users',
        responses: { 200: { description: 'OK' } },
      },
      post: {
        tags: ['Admin'],
        summary: 'Create a new user',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['username', 'password', 'full_name'], properties: { username: { type: 'string', minLength: 3, maxLength: 50 }, password: { type: 'string', minLength: 8 }, full_name: { type: 'string' }, email: { type: 'string', format: 'email' }, phone: { type: 'string' }, is_active: { type: 'boolean' }, roles: { type: 'array', items: { type: 'string' } } } } } },
        },
        responses: { 201: { description: 'User created' } },
      },
    },
    '/admin/users/{id}': {
      patch: {
        tags: ['Admin'],
        summary: 'Update a user',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { full_name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, is_active: { type: 'boolean' }, password: { type: 'string', minLength: 8 }, roles: { type: 'array', items: { type: 'string' } } } } } },
        },
        responses: { 200: { description: 'User updated' }, 404: { description: 'Not found' } },
      },
    },

    // ── Admin: Roles ─────────────────────────────────────────────────────
    '/admin/roles': {
      get: {
        tags: ['Admin'],
        summary: 'List all roles with permissions',
        responses: { 200: { description: 'OK' } },
      },
    },
    '/admin/roles/{id}/permissions': {
      patch: {
        tags: ['Admin'],
        summary: 'Update role permissions',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['permission_ids'], properties: { permission_ids: { type: 'array', items: { type: 'string', format: 'uuid' } } } } } },
        },
        responses: { 200: { description: 'Permissions updated' } },
      },
    },

    // ── Admin: Permissions ───────────────────────────────────────────────
    '/admin/permissions': {
      get: {
        tags: ['Admin'],
        summary: 'List all permissions grouped by module',
        responses: { 200: { description: 'OK' } },
      },
    },

    // ── Admin: Locations ─────────────────────────────────────────────────
    '/admin/quan-huyen': {
      get: {
        tags: ['Admin — Locations'],
        summary: 'List all quận/huyện with boundaries',
        responses: { 200: { description: 'OK' } },
      },
      post: {
        tags: ['Admin — Locations'],
        summary: 'Create quận/huyện',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['ma', 'ten'], properties: { ma: { type: 'string' }, ten: { type: 'string' }, boundary: { type: 'object', description: 'GeoJSON MultiPolygon' } } } } },
        },
        responses: { 201: { description: 'Created' }, 409: { description: 'Duplicate code' } },
      },
    },
    '/admin/quan-huyen/{id}': {
      patch: {
        tags: ['Admin — Locations'],
        summary: 'Update quận/huyện',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { ma: { type: 'string' }, ten: { type: 'string' }, boundary: { type: 'object' } } } } } },
        responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' } },
      },
      delete: {
        tags: ['Admin — Locations'],
        summary: 'Delete quận/huyện (must have no references)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Deleted' }, 409: { description: 'Has references' } },
      },
    },
    '/admin/phuong-xa': {
      get: {
        tags: ['Admin — Locations'],
        summary: 'List all phường/xã',
        parameters: [{ name: 'quan_huyen_id', in: 'query', schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'OK' } },
      },
      post: {
        tags: ['Admin — Locations'],
        summary: 'Create phường/xã',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['ma', 'ten', 'quan_huyen_id'], properties: { ma: { type: 'string' }, ten: { type: 'string' }, quan_huyen_id: { type: 'string', format: 'uuid' }, boundary: { type: 'object' } } } } },
        },
        responses: { 201: { description: 'Created' } },
      },
    },
    '/admin/phuong-xa/{id}': {
      patch: {
        tags: ['Admin — Locations'],
        summary: 'Update phường/xã',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { ma: { type: 'string' }, ten: { type: 'string' }, quan_huyen_id: { type: 'string', format: 'uuid' }, boundary: { type: 'object' } } } } } },
        responses: { 200: { description: 'Updated' } },
      },
      delete: {
        tags: ['Admin — Locations'],
        summary: 'Delete phường/xã',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Deleted' }, 409: { description: 'Has references' } },
      },
    },

    // ── Admin: Catalogs ─────────────────────────────────────────────────
    '/admin/loai-vi-pham': {
      get: { tags: ['Admin — Catalogs'], summary: 'List loại vi phạm', responses: { 200: { description: 'OK' } } },
      post: { tags: ['Admin — Catalogs'], summary: 'Create loại vi phạm', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['code', 'ten'], properties: { code: { type: 'string' }, ten: { type: 'string' }, mo_ta: { type: 'string' }, so_thu_tu: { type: 'integer' } } } } } }, responses: { 201: { description: 'Created' } } },
    },
    '/admin/loai-vi-pham/{id}': {
      patch: { tags: ['Admin — Catalogs'], summary: 'Update loại vi phạm', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Updated' } } },
      delete: { tags: ['Admin — Catalogs'], summary: 'Delete loại vi phạm', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Deleted' }, 409: { description: 'Has references' } } },
    },
    '/admin/hanh-vi': {
      get: { tags: ['Admin — Catalogs'], summary: 'List hành vi vi phạm', parameters: [{ name: 'loai_vi_pham_id', in: 'query', schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'OK' } } },
      post: { tags: ['Admin — Catalogs'], summary: 'Create hành vi vi phạm', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['loai_vi_pham_id', 'khoan', 'ten'], properties: { loai_vi_pham_id: { type: 'string', format: 'uuid' }, dieu: { type: 'string' }, khoan: { type: 'string' }, diem: { type: 'string' }, ten: { type: 'string' }, mo_ta: { type: 'string' }, is_active: { type: 'boolean' } } } } } }, responses: { 201: { description: 'Created' } } },
    },
    '/admin/hanh-vi/{id}': {
      patch: { tags: ['Admin — Catalogs'], summary: 'Update hành vi vi phạm', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Updated' } } },
      delete: { tags: ['Admin — Catalogs'], summary: 'Delete hành vi vi phạm', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Deleted' }, 409: { description: 'Has references' } } },
    },
    '/admin/muc-phat': {
      get: { tags: ['Admin — Catalogs'], summary: 'List mức phạt', parameters: [{ name: 'hanh_vi_id', in: 'query', schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'OK' } } },
      post: { tags: ['Admin — Catalogs'], summary: 'Create mức phạt', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['hanh_vi_id', 'nhom_cong_trinh', 'muc_toi_thieu', 'muc_toi_da'], properties: { hanh_vi_id: { type: 'string', format: 'uuid' }, nhom_cong_trinh: { type: 'integer', enum: [1, 2, 3] }, muc_toi_thieu: { type: 'number' }, muc_toi_da: { type: 'number' } } } } } }, responses: { 201: { description: 'Created' } } },
    },
    '/admin/muc-phat/{id}': {
      patch: { tags: ['Admin — Catalogs'], summary: 'Update mức phạt', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Updated' } } },
      delete: { tags: ['Admin — Catalogs'], summary: 'Delete mức phạt', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Deleted' } } },
    },

    // ── Admin: Audit Log ─────────────────────────────────────────────────
    '/admin/audit-log': {
      get: {
        tags: ['Admin'],
        summary: 'List audit log entries (paginated, filterable)',
        parameters: [
          { name: 'bang', in: 'query', schema: { type: 'string' }, description: 'Filter by table name' },
          { name: 'hanh_dong', in: 'query', schema: { type: 'string' }, description: 'Filter by action' },
          { name: 'tu_ngay', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'den_ngay', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 200 } },
        ],
        responses: { 200: { description: 'Paginated audit log' } },
      },
    },
  },
};
