/**
 * Điền placeholder vào biểu mẫu Bồi gốc — giữ Ngày/tháng/năm, Xí nghiệp → Giám đốc.
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import PizZip from 'pizzip';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'stage-orders');
const src = join(dir, 'boi.docx');
const out = join(dir, 'boi.template.docx');

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

function namePara(key) {
  return (
    `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="60" w:after="60"/></w:pPr>` +
    `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="22"/></w:rPr>` +
    `<w:t>{{${key}}}</w:t></w:r></w:p>`
  );
}

const titleAt = xml.indexOf('LỆNH BỒI');
if (titleAt < 0) throw new Error('Không thấy LỆNH BỒI');

// Ngày........tháng.......năm........ → Ngày {{ngay_dua_lenh}}
{
  let r = replaceOnceFrom(xml, titleAt, 'Ngày........', 'Ngày {{ngay_dua_lenh}}');
  if (r.idx < 0) r = replaceOnceFrom(xml, titleAt, 'Ngày', 'Ngày {{ngay_dua_lenh}}');
  xml = r.xml;
  // xóa phần tháng/năm trên dòng ngày (lần đầu)
  r = replaceOnceFrom(xml, titleAt, 'tháng.......năm........', '');
  if (r.idx < 0) r = replaceOnceFrom(xml, titleAt, 'tháng.......năm', '');
  xml = r.xml;
}

// Tên sản phẩm: + dots
{
  let r = replaceOnceFrom(xml, titleAt, 'Tên sản phẩm: ', 'Tên sản phẩm: {{ten_san_pham}} ');
  if (r.idx < 0) throw new Error('Không thấy Tên sản phẩm');
  xml = r.xml;
  // gỡ chuỗi chấm dài sau tên SP (nếu còn)
  r = replaceOnceFrom(xml, titleAt, '..........................................................', '');
  xml = r.xml;
}

// Lệnh sản xuất
{
  let r = replaceOnceFrom(xml, titleAt, 'Lệnh sản xuất: …', 'Lệnh sản xuất: {{so_lenh}}');
  if (r.idx < 0) r = replaceOnceFrom(xml, titleAt, 'Lệnh sản xuất: ', 'Lệnh sản xuất: {{so_lenh}} ');
  if (r.idx < 0) throw new Error('Không thấy Lệnh sản xuất');
  xml = r.xml;
}

// Số lượng tờ in
{
  const r = replaceOnceFrom(
    xml,
    titleAt,
    'Số lượng tờ in: ..............',
    'Số lượng tờ in: {{so_luong_to_in}}'
  );
  if (r.idx < 0) throw new Error('Không thấy Số lượng tờ in');
  xml = r.xml;
}

// Loại sóng + số lượng (dòng 1)
{
  let r = replaceOnceFrom(xml, titleAt, 'Loại sóng:      ', 'Loại sóng: {{loai_song}} ');
  xml = r.xml;
  // Số lượng đầu tiên sau Loại sóng
  const songAt = xml.indexOf('Loại sóng', titleAt);
  r = replaceOnceFrom(xml, songAt, 'Số lượng: …........', 'Số lượng: {{so_luong_song}}');
  if (r.idx < 0) r = replaceOnceFrom(xml, songAt, 'Số lượng: ', 'Số lượng: {{so_luong_song}} ');
  xml = r.xml;
}

// Keo bồi + số lượng
{
  let r = replaceOnceFrom(xml, titleAt, 'Keo bồi:         ', 'Keo bồi: {{keo_boi}} ');
  if (r.idx < 0) r = replaceOnceFrom(xml, titleAt, 'Keo bồi: ', 'Keo bồi: {{keo_boi}} ');
  xml = r.xml;
  const keoAt = xml.indexOf('Keo bồi', titleAt);
  r = replaceOnceFrom(xml, keoAt, 'Số lượng: …........', 'Số lượng: {{so_luong_keo}}');
  if (r.idx < 0) {
    // nếu đã thay số lượng sóng bằng placeholder, tìm Số lượng còn lại
    r = replaceOnceFrom(xml, keoAt, 'Số lượng: ', 'Số lượng: {{so_luong_keo}} ');
  }
  xml = r.xml;
}

// Section 2 fields — thêm giá trị sau nhãn
{
  let r = replaceOnceFrom(xml, titleAt, 'TCCL sản phẩm số:', 'TCCL sản phẩm số: {{tccl_so}}');
  xml = r.xml;
  r = replaceOnceFrom(xml, titleAt, 'Hao phí cho phép:', 'Hao phí cho phép: {{hao_phi_cho_phep}}');
  xml = r.xml;
  r = replaceOnceFrom(
    xml,
    titleAt,
    'Số lượng tờ bồi yêu cầu đạt',
    'Số lượng tờ bồi yêu cầu đạt: {{sl_to_boi_dat}}'
  );
  xml = r.xml;
  // tránh nhân đôi dấu :
  xml = xml.replace('đạt: {{sl_to_boi_dat}}:', 'đạt: {{sl_to_boi_dat}}');
  r = replaceOnceFrom(
    xml,
    titleAt,
    'Thời gian dự kiến sản xuất',
    'Thời gian dự kiến sản xuất: {{ngay_du_kien_sx}}'
  );
  xml = r.xml;
  xml = xml.replace('sản xuất: {{ngay_du_kien_sx}}:  ', 'sản xuất: {{ngay_du_kien_sx}} ');
  r = replaceOnceFrom(
    xml,
    titleAt,
    'Thời gian dự kiến hoàn thành: ',
    'Thời gian dự kiến hoàn thành: {{ngay_hoan_thanh}} '
  );
  if (r.idx < 0) {
    r = replaceOnceFrom(
      xml,
      titleAt,
      'ời gian dự kiến hoàn thành: ',
      'ời gian dự kiến hoàn thành: {{ngay_hoan_thanh}} '
    );
  }
  xml = r.xml;
}

// Chữ ký: giữ Xí nghiệp → Giám đốc của mẫu; chỉ chèn tên
{
  const lapAt = xml.indexOf('lập', titleAt);
  if (lapAt < 0) throw new Error('Không thấy Người lập');
  const pEnd = xml.indexOf('</w:p>', lapAt);
  xml = xml.slice(0, pEnd + 6) + namePara('nguoi_lap') + xml.slice(pEnd + 6);

  const giamAt = xml.indexOf('đốc', titleAt);
  if (giamAt < 0) throw new Error('Không thấy Giám đốc');
  const giamPEnd = xml.indexOf('</w:p>', giamAt);
  xml = xml.slice(0, giamPEnd + 6) + namePara('giam_doc') + xml.slice(giamPEnd + 6);
}

const required = [
  'ngay_dua_lenh',
  'ten_san_pham',
  'so_lenh',
  'so_luong_to_in',
  'loai_song',
  'keo_boi',
  'nguoi_lap',
  'giam_doc',
];
for (const k of required) {
  if (!xml.includes(`{{${k}}}`)) throw new Error(`Thiếu placeholder {{${k}}}`);
}

zip.file('word/document.xml', xml);
writeFileSync(out, zip.generate({ type: 'nodebuffer' }));
console.log('OK boi.template.docx (inject into original — Xí nghiệp trên, Giám đốc dưới)');
