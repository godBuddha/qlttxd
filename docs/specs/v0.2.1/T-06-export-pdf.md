# SPEC T-06: Export PDF

> Task: coder (backend) | Priority: P1 | Dependency: T-05

## Mục tiêu
Install `pdfkit` + endpoint xuất PDF báo cáo tiếng Việt.

## Files thay đổi
1. `app/backend/package.json` — thêm `pdfkit`
2. `app/backend/server.js` — thêm PDF handler trong endpoint xuat

## Chi tiết

### 1. Install
```bash
cd /workspace/ssd/qlttxd/app/backend
npm install pdfkit
```

### 2. Thêm handler `loai=pdf` trong endpoint `/api/v1/thong-ke/xuat`
```js
const PDFDocument = require('pdfkit');

if (loai === 'pdf') {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="bao-cao-${new Date().toISOString().slice(0,10)}.pdf"`);
  doc.pipe(res);

  doc.fontSize(16).text('Báo cáo thống kê hồ sơ vi phạm', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`);
  doc.moveDown(1);

  // Table header
  const cols = [50, 120, 200, 300, 400, 480];
  const headers = ['Mã HS', 'Trạng thái', 'Địa chỉ', 'Quận', 'Phường', 'Ngày tạo'];
  doc.fontSize(8).font('Helvetica-Bold');
  headers.forEach((h, i) => doc.text(h, cols[i], doc.y, { continued: i < headers.length - 1 }));
  doc.moveDown(0.5);
  doc.font('Helvetica');

  rows.forEach(row => {
    if (doc.y > 750) doc.addPage();
    const vals = [row.ma_ho_so, row.trang_thai, row.dia_chi?.slice(0, 30) || '', row.quan_huyen || '', row.phuong_xa || '', row.created_at?.slice(0, 10) || ''];
    vals.forEach((v, i) => doc.text(String(v || ''), cols[i], doc.y, { continued: i < vals.length - 1 }));
    doc.moveDown(0.3);
  });

  doc.end();
}
```

## Acceptance Criteria
- [ ] `GET /api/v1/thong-ke/xuat?loai=pdf` trả file PDF
- [ ] PDF hiển thị tiếng Việt (không lỗi font nghiêm trọng)
- [ ] PII che đúng quyền
- [ ] 70 test cũ vẫn PASS

## Lưu ý
- pdfkit mặc định dùng Helvetica — tiếng Việt có thể hiển thị không hoàn hảo. Nếu cần font Unicode, embed Noto Sans. Chấp nhận Helvetica cho v0.2.1.
