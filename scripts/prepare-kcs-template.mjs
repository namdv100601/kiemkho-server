/**
 * Điền placeholder vào đúng biểu mẫu KCS gốc (không cắt/ghép),
 * để giữ căn lề tiêu đề, dòng Ngày tháng năm, chữ ký Xí nghiệp/Giám đốc.
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import PizZip from 'pizzip';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'stage-orders');
const src = join(dir, 'kcs.docx');
const out = join(dir, 'kcs.template.docx');

const zip = new PizZip(readFileSync(src));
let xml = zip.file('word/document.xml').asText();

function replaceOnceFrom(haystack, fromIdx, search, replacement) {
  const i = haystack.indexOf(search, fromIdx);
  if (i < 0) return { xml: haystack, idx: -1 };
  return {
    xml: haystack.slice(0, i) + replacement + haystack.slice(i + search.length),
    idx: i,
  };
}

const titleAt = xml.indexOf('LỆNH KCS');
if (titleAt < 0) throw new Error('Không thấy tiêu đề LỆNH KCS');

// 1) Dòng ngày (ngay dưới tiêu đề): "Ngày … tháng … năm" → "Ngày {{ngay_dua_lenh}}"
{
  const ngayAt = xml.indexOf('Ngày', titleAt);
  if (ngayAt < 0) throw new Error('Không thấy dòng Ngày');
  // Chỉ sửa lần đầu sau tiêu đề
  let r = replaceOnceFrom(xml, titleAt, 'Ngày', 'Ngày {{ngay_dua_lenh}}');
  xml = r.xml;
  // Xóa nhãn tháng/năm trên cùng dòng ngày (lần xuất hiện đầu sau tiêu đề)
  r = replaceOnceFrom(xml, titleAt, 'tháng', '');
  xml = r.xml;
  r = replaceOnceFrom(xml, titleAt, 'năm', '');
  xml = r.xml;
}

// 2) Tên sản phẩm: run <w:t>:</w:t> ngay sau "hẩm" (không được đụng dấu : trong </w:t>)
{
  const hamAt = xml.indexOf('hẩm', titleAt);
  if (hamAt < 0) throw new Error('Không thấy Tên sản phẩm');
  const r = replaceOnceFrom(xml, hamAt, '<w:t>:</w:t>', '<w:t>: {{ten_san_pham}}</w:t>');
  if (r.idx < 0) throw new Error('Không chèn được ten_san_pham');
  xml = r.xml;
}

// 3) Lệnh sản xuất
{
  const r = replaceOnceFrom(xml, titleAt, 'Lệnh sản xuất: ', 'Lệnh sản xuất: {{so_lenh}}');
  if (r.idx < 0) throw new Error('Không chèn được so_lenh');
  xml = r.xml;
}

// 4) Nội dung, màu sắc + TCCL — thêm gạch đầu dòng cho giống mẫu
{
  const r1 = replaceOnceFrom(xml, titleAt, 'Nội dung', '- Nội dung');
  xml = r1.xml;
  const dots =
    '..................................; TCCL số: ...............................................';
  const r2 = replaceOnceFrom(xml, titleAt, dots, ' {{noi_dung_mau_sac}}; TCCL số: {{tccl_so}}');
  if (r2.idx < 0) {
    // fallback nếu số dấu chấm khác
    const m = xml.slice(titleAt).match(/; TCCL số: \.+/);
    if (!m) throw new Error('Không thấy dòng Nội dung/TCCL');
    const r3 = replaceOnceFrom(
      xml,
      titleAt,
      m[0],
      '; TCCL số: {{tccl_so}}'
    );
    xml = r3.xml;
    // chèn noi_dung trước dấu ;
    const nd = xml.indexOf('- Nội dung', titleAt);
    const colon = xml.indexOf(':', nd);
    xml = xml.slice(0, colon + 1) + ' {{noi_dung_mau_sac}}' + xml.slice(colon + 1);
  } else {
    xml = r2.xml;
  }
}

// 5) Tổng số lượng yêu cầu kiểm soát
{
  // bản gốc: ": ………………" sau "soát"
  let r = replaceOnceFrom(xml, titleAt, ': ………………', ': {{tong_sl_kiem_soat}}');
  if (r.idx < 0) {
    r = replaceOnceFrom(xml, titleAt, ': ………', ': {{tong_sl_kiem_soat}}');
  }
  if (r.idx < 0) {
    // ellipsis unicode variants
    const soAt = xml.indexOf('soát', titleAt);
    const m = xml.slice(soAt, soAt + 80).match(/: ([…\.]{2,})/);
    if (!m) throw new Error('Không thấy chỗ tổng SL kiểm soát');
    r = replaceOnceFrom(xml, soAt, m[0], ': {{tong_sl_kiem_soat}}');
  }
  xml = r.xml;
}

// 6) Tên người lập / giám đốc — chèn dưới đúng cột chữ ký gốc
{
  // Sau "Người" "lập" → thêm paragraph tên (căn giữa như mẫu)
  const lapAt = xml.indexOf('lập', titleAt);
  if (lapAt < 0) throw new Error('Không thấy Người lập');
  const pEnd = xml.indexOf('</w:p>', lapAt);
  if (pEnd < 0) throw new Error('Không thấy hết đoạn Người lập');
  const nameP = (key, center = true) =>
    `<w:p><w:pPr>${center ? '<w:jc w:val="center"/>' : ''}<w:spacing w:before="60" w:after="60"/></w:pPr>` +
    `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="22"/></w:rPr>` +
    `<w:t>{{${key}}}</w:t></w:r></w:p>`;

  // Chèn {{nguoi_lap}} ngay sau paragraph Người lập
  xml = xml.slice(0, pEnd + '</w:p>'.length) + nameP('nguoi_lap') + xml.slice(pEnd + '</w:p>'.length);

  // Chèn {{giam_doc}} sau paragraph Giám đốc (trước Báo cáo)
  const giamAt = xml.indexOf('đốc', titleAt);
  if (giamAt < 0) throw new Error('Không thấy Giám đốc');
  const giamPEnd = xml.indexOf('</w:p>', giamAt);
  xml =
    xml.slice(0, giamPEnd + '</w:p>'.length) +
    nameP('giam_doc') +
    xml.slice(giamPEnd + '</w:p>'.length);
}

if (!xml.includes('{{ten_san_pham}}') || !xml.includes('{{so_lenh}}') || !xml.includes('{{ngay_dua_lenh}}')) {
  throw new Error('Thiếu placeholder bắt buộc sau khi chuẩn bị KCS');
}

zip.file('word/document.xml', xml);
writeFileSync(out, zip.generate({ type: 'nodebuffer' }));
console.log('OK kcs.template.docx (inject into original HABECO layout)');
