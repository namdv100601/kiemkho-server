import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import PizZip from 'pizzip';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'templates', 'stage-orders', 'xa.docx');
const out = join(root, 'templates', 'stage-orders', 'xa.template.docx');

const zip = new PizZip(readFileSync(src));
let xml = zip.file('word/document.xml').asText();

function cell(text, { center = false, bold = false } = {}) {
  const jc = center ? '<w:jc w:val="center"/>' : '';
  const b = bold ? '<w:b/>' : '';
  return (
    `<w:tc>` +
    `<w:tcPr><w:tcW w:w="5000" w:type="dxa"/></w:tcPr>` +
    `<w:p>` +
    `<w:pPr>${jc}<w:spacing w:before="40" w:after="40"/></w:pPr>` +
    `<w:r>` +
    `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>${b}<w:sz w:val="24"/></w:rPr>` +
    `<w:t xml:space="preserve">${text}</w:t>` +
    `</w:r></w:p></w:tc>`
  );
}

function row(left, right, opts) {
  return `<w:tr>${cell(left, opts)}${cell(right, opts)}</w:tr>`;
}

function borderlessTable(rowsXml) {
  return (
    `<w:tbl>` +
    `<w:tblPr>` +
    `<w:tblW w:w="10000" w:type="dxa"/>` +
    `<w:tblBorders>` +
    `<w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/>` +
    `<w:insideH w:val="nil"/><w:insideV w:val="nil"/>` +
    `</w:tblBorders>` +
    `</w:tblPr>` +
    `<w:tblGrid><w:gridCol w:w="5000"/><w:gridCol w:w="5000"/></w:tblGrid>` +
    rowsXml +
    `</w:tbl>`
  );
}

// ===== 1–8: bảng 2 cột để 2/4/6/8 thẳng hàng =====
const fieldStart = xml.lastIndexOf('<w:p ', xml.indexOf('1. Tên sản phẩm'));
const signTblStart = xml.lastIndexOf('<w:tbl>', xml.indexOf('NGƯỜI LẬP'));
if (fieldStart < 0 || signTblStart < 0) {
  throw new Error('Không tìm thấy vùng trường 1–8');
}

const fieldsTable =
  borderlessTable(
    row('1. Tên sản phẩm: {{ten_san_pham}}', '2. Kích thước xả: {{kich_thuoc_xa}}') +
      row('3. Định lượng xuất: {{dinh_luong_xuat}}', '4. Khối lượng: {{khoi_luong}}') +
      row('5. Số lệnh: {{so_lenh}}', '6. Ngày đưa lệnh: {{ngay_dua_lenh}}') +
      row('7. Ngày hoàn thành: {{ngay_hoan_thanh}}', '8. Ghi chú: {{ghi_chu}}')
  ) + `<w:p><w:pPr><w:spacing w:after="200"/></w:pPr></w:p>`;

xml = xml.slice(0, fieldStart) + fieldsTable + xml.slice(signTblStart);
console.log('OK fields 2/4/6/8 aligned');

// ===== Giữ nguyên khối chữ ký mẫu (NGƯỜI LẬP / GIÁM ĐỐC) =====
// Thêm 1 hàng tên bên dưới bảng chữ ký, trước "Kết quả sản xuất"
const signTblEnd = xml.indexOf('</w:tbl>', xml.indexOf('NGƯỜI LẬP'));
if (signTblEnd < 0) throw new Error('Không tìm thấy hết bảng chữ ký');

const namesRow =
  `<w:p><w:pPr><w:spacing w:before="200" w:after="80"/></w:pPr></w:p>` +
  borderlessTable(
    row('{{nguoi_lap}}', '{{giam_doc}}', { center: true, bold: true })
  ) +
  `<w:p><w:pPr><w:spacing w:after="200"/></w:pPr></w:p>`;

const insertAt = signTblEnd + '</w:tbl>'.length;
xml = xml.slice(0, insertAt) + namesRow + xml.slice(insertAt);
console.log('OK names row under signature');

zip.file('word/document.xml', xml);
writeFileSync(out, zip.generate({ type: 'nodebuffer' }));
console.log('Wrote', out);
