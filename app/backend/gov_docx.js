'use strict';

/**
 * gov_docx.js — Tạo file DOCX cho Biên bản vi phạm và Quyết định xử phạt
 * theo thể thức NĐ 30/2020/NĐ-CP.
 *
 * Sử dụng thư viện docx (https://docx.js.org/) để sinh file DOCX thuần Node.js.
 */

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  convertInchesToTwip,
} = require('docx');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Dòng trống */
function emptyLine() {
  return new Paragraph({ children: [] });
}

/** Text bold căn giữa */
function centeredBold(text, size = 28) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, bold: true, size, font: 'Times New Roman' })],
  });
}

/** Text thường căn giữa */
function centered(text, size = 24) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, size, font: 'Times New Roman' })],
  });
}

/** Text thường căn trái */
function bodyText(text, size = 24, options = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: options.indent ? { firstLine: convertInchesToTwip(0.5) } : undefined,
    spacing: { after: 120 },
    children: [new TextRun({ text, size, font: 'Times New Roman', ...options })],
  });
}

/** Dòng có label bold + value thường */
function labelValue(label, value, size = 24) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120 },
    children: [
      new TextRun({ text: label, bold: true, size, font: 'Times New Roman' }),
      new TextRun({ text: value || '………', size, font: 'Times New Roman' }),
    ],
  });
}

/** Format ngày tiếng Việt */
function formatDate(dateStr) {
  if (!dateStr) return '………';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '………';
  return `ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
}

/** Format số tiền */
function formatMoney(value) {
  if (value === null || value === undefined) return '………';
  return `${Number(value).toLocaleString('vi-VN')} đồng`;
}

/** Header chung cho văn bản hành chính */
function govHeader() {
  return [
    centeredBold('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 26),
    centered('Độc lập - Tự do - Hạnh phúc', 24),
    centered('—————————', 24),
    emptyLine(),
  ];
}

/** Chữ ký cuối văn bản */
function signatureBlock(nguoiKy) {
  return [
    emptyLine(),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: 'Người có thẩm quyền',
          bold: true,
          size: 24,
          font: 'Times New Roman',
          italics: true,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: '(Ký, đóng dấu)', size: 22, font: 'Times New Roman', italics: true }),
      ],
    }),
    emptyLine(),
    emptyLine(),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({ text: nguoiKy || '……………………', bold: true, size: 24, font: 'Times New Roman' }),
      ],
    }),
  ];
}

// ---------------------------------------------------------------------------
// Biên bản vi phạm
// ---------------------------------------------------------------------------

/**
 * Tạo DOCX Biên bản vi phạm hành chính
 * @param {Object} data - { ho_so, bien_ban, nguoi_vi_pham, hanh_vi, loai_vi_pham, quan_huyen, phuong_xa, nguoi_lap }
 * @returns {Buffer} - nội dung file .docx
 */
async function generateBienBan(data) {
  const {
    ho_so,
    bien_ban,
    nguoi_vi_pham,
    hanh_vi,
    loai_vi_pham,
    quan_huyen,
    phuong_xa,
    nguoi_lap,
  } = data;

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.25),
              right: convertInchesToTwip(1),
            },
          },
        },
        children: [
          ...govHeader(),

          // Tiêu đề
          centeredBold('BIÊN BẢN VI PHẠM HÀNH CHÍNH', 32),
          emptyLine(),
          centered(`Số: ${bien_ban.ma_bien_ban || '………'}`, 24),
          emptyLine(),

          // Thời gian, địa điểm lập biên bản
          bodyText(
            `Vào hồi …… giờ …… phút, ${formatDate(bien_ban.thoi_gian_lap || bien_ban.created_at)}, tại ${ho_so.dia_chi || '………'}${phuong_xa ? `, ${phuong_xa.ten}` : ''}${quan_huyen ? `, ${quan_huyen.ten}` : ''}, chúng tôi gồm:`,
            true
          ),

          emptyLine(),
          labelValue('1. Người lập biên bản: ', nguoi_lap?.full_name || '………'),
          labelValue('   Chức vụ: ', 'Cán bộ Thanh tra Xây dựng'),
          emptyLine(),
          labelValue('2. Người vi phạm: ', nguoi_vi_pham?.ten || '………'),
          labelValue(
            '   Loại chủ thể: ',
            nguoi_vi_pham?.loai_chu_the === 'ca_nhan'
              ? 'Cá nhân'
              : nguoi_vi_pham?.loai_chu_the === 'to_chuc'
                ? 'Tổ chức'
                : '………'
          ),
          labelValue('   CMND/CCCD/MST: ', nguoi_vi_pham?.cmnd_cccd || '………'),
          labelValue('   Địa chỉ: ', nguoi_vi_pham?.dia_chi || '………'),
          labelValue('   Số điện thoại: ', nguoi_vi_pham?.sdt || '………'),
          emptyLine(),

          // Nội dung vi phạm
          centeredBold('NỘI DUNG VI PHẠM', 26),
          emptyLine(),
          labelValue('Hành vi vi phạm: ', hanh_vi?.ten || '………'),
          labelValue('Nhóm vi phạm: ', loai_vi_pham?.ten || '………'),
          labelValue(
            'Điều/Khoản: ',
            hanh_vi
              ? `Điều ${hanh_vi.dieu || '16'}, Khoản ${hanh_vi.khoan || '…'}${hanh_vi.diem ? `, Điểm ${hanh_vi.diem}` : ''}`
              : '………'
          ),
          labelValue('Mô tả chi tiết: ', ho_so.mo_ta || bien_ban.noi_dung || '………'),
          labelValue('Địa chỉ vi phạm: ', ho_so.dia_chi || '………'),
          labelValue('Thời gian xảy ra: ', formatDate(ho_so.thoi_gian_xay_ra)),
          emptyLine(),

          // Mức phạt dự kiến
          labelValue(
            'Mức phạt dự kiến: ',
            formatMoney(bien_ban.muc_phat_du_kien || ho_so.muc_phat_du_kien)
          ),
          labelValue(
            'Hình thức xử lý: ',
            bien_ban.hinh_thuc_xu_phat === 'phat_tien'
              ? 'Phạt tiền'
              : bien_ban.hinh_thuc_xu_phat || 'Phạt tiền'
          ),
          emptyLine(),

          // Ghi chú
          bien_ban.noi_dung ? labelValue('Ghi chú: ', bien_ban.noi_dung) : emptyLine(),
          emptyLine(),

          bodyText(
            'Biên bản này được lập để ghi nhận hành vi vi phạm hành chính trong lĩnh vực hoạt động xây dựng theo quy định tại Nghị định 16/2022/NĐ-CP.',
            true
          ),
          emptyLine(),
          bodyText(
            'Biên bản được lập thành 02 bản, 01 bản giao cho người vi phạm, 01 bản lưu tại cơ quan.',
            true
          ),

          // Chữ ký
          ...signatureBlock(nguoi_lap?.full_name),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

// ---------------------------------------------------------------------------
// Quyết định xử phạt
// ---------------------------------------------------------------------------

/**
 * Tạo DOCX Quyết định xử phạt vi phạm hành chính
 * @param {Object} data - { ho_so, quyet_dinh, bien_ban, nguoi_vi_pham, hanh_vi, loai_vi_pham, quan_huyen, phuong_xa, nguoi_ky }
 * @returns {Buffer} - nội dung file .docx
 */
async function generateQuyetDinh(data) {
  const {
    ho_so,
    quyet_dinh,
    bien_ban,
    nguoi_vi_pham,
    hanh_vi,
    quan_huyen,
    phuong_xa,
    nguoi_ky,
  } = data;

  const diaChiVP =
    [ho_so.dia_chi, phuong_xa?.ten, quan_huyen?.ten].filter(Boolean).join(', ') || '………';

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.25),
              right: convertInchesToTwip(1),
            },
          },
        },
        children: [
          ...govHeader(),

          // Header cơ quan
          centeredBold('CHỦ TỊCH UỶ BAN NHÂN DÂN', 26),
          centeredBold(quan_huyen?.ten?.toUpperCase() || '………', 28),
          centered('—————————', 24),
          emptyLine(),

          // Số hiệu + Ngày ban hành
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: `Số: ${quyet_dinh.ma_quyet_dinh || '………'}`,
                bold: true,
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),
          emptyLine(),

          // Tiêu đề
          centeredBold('QUYẾT ĐỊNH', 32),
          centeredBold('XỬ PHẠT VI PHẠM HÀNH CHÍNH', 28),
          emptyLine(),
          centered(`V/v: Xử phạt vi phạm hành chính trong lĩnh vực hoạt động xây dựng`, 24),
          emptyLine(),

          // Căn cứ pháp lý
          centeredBold('CHỦ TỊCH ỦY BAN NHÂN DÂN ……………', 24),
          emptyLine(),
          bodyText(`Căn cứ Luật Xử lý vi phạm hành chính ngày 20 tháng 6 năm 2012;`, true),
          bodyText(
            `Căn cứ Nghị định 16/2022/NĐ-CP ngày 28 tháng 01 năm 2022 của Chính phủ quy định xử phạt vi phạm hành chính về xây dựng;`,
            true
          ),
          bodyText(
            `Căn cứ Nghị định 30/2020/NĐ-CP ngày 05 tháng 3 năm 2020 của Chính phủ về tổ chức và hoạt động của Thanh tra xây dựng;`,
            true
          ),
          quyet_dinh.can_cu_phap_ly
            ? bodyText(`Căn cứ ${quyet_dinh.can_cu_phap_ly};`, true)
            : emptyLine(),
          bodyText(
            `Xét biên bản vi phạm hành chính số ${bien_ban?.ma_bien_ban || '………'} ${formatDate(bien_ban?.thoi_gian_lap || bien_ban?.created_at)};`,
            true
          ),
          emptyLine(),

          centeredBold('QUYẾT ĐỊNH:', 26),
          emptyLine(),

          // Điều 1: Thông tin người vi phạm
          centeredBold('Điều 1. Xử phạt vi phạm hành chính', 24),
          emptyLine(),
          bodyText(`Xử phạt vi phạm hành chính đối với:`, true),
          emptyLine(),
          labelValue('Tên người vi phạm: ', nguoi_vi_pham?.ten || '………'),
          labelValue(
            'Loại chủ thể: ',
            nguoi_vi_pham?.loai_chu_the === 'ca_nhan'
              ? 'Cá nhân'
              : nguoi_vi_pham?.loai_chu_the === 'to_chuc'
                ? 'Tổ chức'
                : '………'
          ),
          labelValue('CMND/CCCD/MST: ', nguoi_vi_pham?.cmnd_cccd || '………'),
          labelValue('Địa chỉ: ', nguoi_vi_pham?.dia_chi || '………'),
          emptyLine(),

          bodyText(`Vì đã có hành vi vi phạm: ${hanh_vi?.ten || '………'}`, true),
          bodyText(
            `Điều ${hanh_vi?.dieu || '16'}, Khoản ${hanh_vi?.khoan || '…'}${hanh_vi?.diem ? `, Điểm ${hanh_vi.diem}` : ''} Nghị định 16/2022/NĐ-CP ngày 28 tháng 01 năm 2022 của Chính phủ quy định xử phạt vi phạm hành chính về xây dựng.`,
            true
          ),
          emptyLine(),

          labelValue('Địa chỉ vi phạm: ', diaChiVP),
          labelValue('Thời gian xảy ra: ', formatDate(ho_so.thoi_gian_xay_ra)),
          emptyLine(),

          // Hình thức xử phạt
          centeredBold('Hình thức xử phạt:', 24),
          emptyLine(),
          labelValue('Phạt tiền: ', formatMoney(quyet_dinh.so_tien_phat)),
          emptyLine(),

          // Hình thức phạt bổ sung
          ...(quyet_dinh.hinh_thuc_phat_bo_sung
            ? [
                centeredBold('Hình thức phạt bổ sung:', 24),
                emptyLine(),
                bodyText(quyet_dinh.hinh_thuc_phat_bo_sung, true),
                emptyLine(),
              ]
            : []),

          // Biện pháp khắc phục hậu quả
          ...(quyet_dinh.bien_phap_khac_phuc_hau_qua
            ? [
                centeredBold('Biện pháp khắc phục hậu quả:', 24),
                emptyLine(),
                bodyText(quyet_dinh.bien_phap_khac_phuc_hau_qua, true),
                emptyLine(),
              ]
            : []),

          // Điều 2: Thi hành
          centeredBold('Điều 2. Thi hành quyết định', 24),
          emptyLine(),
          bodyText(
            'Quyết định này có hiệu lực kể từ ngày ký. Người vi phạm phải chấp hành quyết định trong thời hạn 10 ngày kể từ ngày nhận quyết định.',
            true
          ),
          bodyText(
            'Trường hợp người vi phạm không tự nguyện chấp hành thì bị cưỡng chế thi hành theo quy định của pháp luật.',
            true
          ),
          emptyLine(),

          // Điều 3: Khiếu nại
          centeredBold('Điều 3. Khiếu nại, khởi kiện', 24),
          emptyLine(),
          bodyText(
            'Người bị xử phạt có quyền khiếu nại đến Chủ tịch Ủy ban nhân dân hoặc khởi kiện tại Tòa án theo quy định của pháp luật.',
            true
          ),
          emptyLine(),

          bodyText(`Quyết định này được lập thành …… bản.`, true),
          emptyLine(),

          // Chữ ký
          ...signatureBlock(nguoi_ky?.full_name),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

module.exports = { generateBienBan, generateQuyetDinh };
