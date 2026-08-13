/**
 * Tạo *.template.docx từ *.docx HABECO gốc:
 * - Giữ phần đầu (tiêu đề/logo) + phần Báo cáo sản xuất (công nhân)
 * - Thay vùng nhập liệu bằng bảng/đoạn có {{placeholder}} để điền tự động
 */
import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import PizZip from 'pizzip';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'templates', 'stage-orders');

function cell(text, { w = 2500, center = false, bold = false, italic = false, borders = true } = {}) {
  const jc = center ? '<w:jc w:val="center"/>' : '';
  const b = bold ? '<w:b/>' : '';
  const i = italic ? '<w:i/>' : '';
  const borderXml = borders
    ? `<w:tcBorders>
        <w:top w:val="single" w:sz="4" w:color="000000"/>
        <w:left w:val="single" w:sz="4" w:color="000000"/>
        <w:bottom w:val="single" w:sz="4" w:color="000000"/>
        <w:right w:val="single" w:sz="4" w:color="000000"/>
      </w:tcBorders>`
    : `<w:tcBorders>
        <w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/>
      </w:tcBorders>`;
  return (
    `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${borderXml}</w:tcPr>` +
    `<w:p><w:pPr>${jc}<w:spacing w:before="40" w:after="40"/></w:pPr>` +
    `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>${b}${i}<w:sz w:val="20"/></w:rPr>` +
    `<w:t xml:space="preserve">${text}</w:t></w:r></w:p></w:tc>`
  );
}

function row(cells) {
  return `<w:tr>${cells.join('')}</w:tr>`;
}

function table(colWidths, rowsXml) {
  const grid = colWidths.map((w) => `<w:gridCol w:w="${w}"/>`).join('');
  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${colWidths.reduce((a, b) => a + b, 0)}" w:type="dxa"/>` +
    `<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/>` +
    `<w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr>` +
    `<w:tblGrid>${grid}</w:tblGrid>${rowsXml}</w:tbl>`
  );
}

function p(text, { bold = false, center = false, after = 80 } = {}) {
  const jc = center ? '<w:jc w:val="center"/>' : '';
  const b = bold ? '<w:b/>' : '';
  return (
    `<w:p><w:pPr>${jc}<w:spacing w:after="${after}"/></w:pPr>` +
    `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>${b}<w:sz w:val="22"/></w:rPr>` +
    `<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`
  );
}

function field(label, key) {
  return p(`${label}: {{${key}}}`);
}

function twoCol(left, right) {
  return table(
    [5000, 5000],
    row([
      cell(left, { w: 5000, borders: false }),
      cell(right, { w: 5000, borders: false }),
    ])
  );
}

function signature({ xnghiep = false } = {}) {
  // Mẫu HABECO: phải là Xí nghiệp (trên) → Giám đốc (dưới), không đảo ngược
  if (xnghiep) {
    return (
      p('') +
      table(
        [5000, 5000],
        row([
          cell('Người lập', { w: 5000, center: true, bold: true, borders: false }),
          cell('Xí nghiệp ....................', { w: 5000, center: true, bold: true, borders: false }),
        ]) +
          row([
            cell('', { w: 5000, borders: false }),
            cell('Giám đốc', { w: 5000, center: true, italic: true, borders: false }),
          ]) +
          row([
            cell('{{nguoi_lap}}', { w: 5000, center: true, bold: true, borders: false }),
            cell('{{giam_doc}}', { w: 5000, center: true, bold: true, borders: false }),
          ])
      ) +
      p('')
    );
  }
  return (
    p('') +
    table(
      [5000, 5000],
      row([
        cell('NGƯỜI LẬP', { w: 5000, center: true, bold: true, borders: false }),
        cell('GIÁM ĐỐC', { w: 5000, center: true, bold: true, borders: false }),
      ]) +
        row([
          cell('{{nguoi_lap}}', { w: 5000, center: true, bold: true, borders: false }),
          cell('{{giam_doc}}', { w: 5000, center: true, bold: true, borders: false }),
        ])
    ) +
    p('')
  );
}

function vatTuSongRows(n = 6) {
  const cols = [700, 2800, 1000, 1400, 1800, 1800];
  let xml = row([
    cell('TT', { w: cols[0], bold: true, center: true }),
    cell('Vật tư', { w: cols[1], bold: true, center: true }),
    cell('ĐVT', { w: cols[2], bold: true, center: true }),
    cell('Tồn đầu', { w: cols[3], bold: true, center: true }),
    cell('SL định mức', { w: cols[4], bold: true, center: true }),
    cell('Dự kiến xuất', { w: cols[5], bold: true, center: true }),
  ]);
  for (let i = 1; i <= n; i++) {
    xml += row([
      cell(String(i), { w: cols[0], center: true }),
      cell(`{{vt${i}_vat_tu}}`, { w: cols[1] }),
      cell(`{{vt${i}_dvt}}`, { w: cols[2], center: true }),
      cell(`{{vt${i}_ton_dau}}`, { w: cols[3], center: true }),
      cell(`{{vt${i}_dinh_muc}}`, { w: cols[4], center: true }),
      cell(`{{vt${i}_du_kien}}`, { w: cols[5], center: true }),
    ]);
  }
  return table(cols, xml);
}

function vatTuInRows(n = 6) {
  const cols = [700, 3200, 1200, 1600, 2800];
  let xml = row([
    cell('STT', { w: cols[0], bold: true, center: true }),
    cell('Tên vật tư', { w: cols[1], bold: true, center: true }),
    cell('Đơn vị', { w: cols[2], bold: true, center: true }),
    cell('Số lượng', { w: cols[3], bold: true, center: true }),
    cell('Ghi chú', { w: cols[4], bold: true, center: true }),
  ]);
  for (let i = 1; i <= n; i++) {
    xml += row([
      cell(String(i), { w: cols[0], center: true }),
      cell(`{{vt${i}_ten}}`, { w: cols[1] }),
      cell(`{{vt${i}_dvt}}`, { w: cols[2], center: true }),
      cell(`{{vt${i}_sl}}`, { w: cols[3], center: true }),
      cell(`{{vt${i}_gc}}`, { w: cols[4] }),
    ]);
  }
  return table(cols, xml);
}

const BLOCKS = {
  song: () =>
    field('Ngày giao lệnh', 'ngay_dua_lenh') +
    field('Số lệnh', 'so_lenh') +
    field('Tên sản phẩm', 'ten_san_pham') +
    p('Số lượng yêu cầu:  {{so_luong_yeu_cau}} tấm') +
    field('Ngày dự kiến sản xuất', 'ngay_du_kien_sx') +
    field('Ngày dự kiến hoàn thành', 'ngay_hoan_thanh') +
    p('I - Phương án sản xuất', { bold: true }) +
    // Giống mẫu gốc: 1. Loại giấy + 2 dòng Kraf sóng / Kraf mặt dạng gms/mm
    p('1. Loại giấy:  - Kraf sóng: {{kraf_song_gms}}gms/{{kraf_song_mm}}mm') +
    p('                             - Kraf mặt:  {{kraf_mat_gms}}gms/{{kraf_mat_mm}}mm.') +
    p('2. Thông số kỹ thuật:', { bold: true }) +
    table(
      [2500, 2500, 2500, 2500],
      row([
        cell('Bước sóng', { w: 2500, bold: true, center: true }),
        cell('Trọng lượng', { w: 2500, bold: true, center: true }),
        cell('Độ dày', { w: 2500, bold: true, center: true }),
        cell('Kích thước', { w: 2500, bold: true, center: true }),
      ]) +
        row([
          cell('{{buoc_song}} mm', { w: 2500, center: true }),
          cell('{{trong_luong}} g', { w: 2500, center: true }),
          cell('{{do_day}} mm', { w: 2500, center: true }),
          cell('{{kich_thuoc}} mm', { w: 2500, center: true }),
        ])
    ) +
    p('II - Kế hoạch vật tư:', { bold: true }) +
    vatTuSongRows(6) +
    signature(),

  // Khối điền bám sát bố cục mẫu HABECO (giữ logo/tiêu đề + báo cáo phía dưới)
  in: () =>
    p('Ngày {{ngay_dua_lenh}}') +
    field('Tên sản phẩm', 'ten_san_pham') +
    field('Lệnh sản xuất', 'so_lenh') +
    p('') +
    p('Nguyên vật liệu sử dụng:', { bold: true }) +
    vatTuInRows(6) +
    p('II. Yêu cầu sản xuất', { bold: true }) +
    twoCol('Số màu in: {{so_mau_in}}', 'Thứ tự in: {{thu_tu_in}}') +
    twoCol('Duyệt sản phẩm theo mẫu số {{mau_so}}', 'TCCL số {{tccl_so}}') +
    p('Tổng số lượng giấy xuất: {{tong_sl_giay_xuat}} tờ') +
    p('Hao phí in cho phép: {{hao_phi_cho_phep}} tờ') +
    p('Số lượng yêu cầu in đạt: {{sl_yeu_cau_dat}} tờ') +
    field('Ngày dự kiến sản xuất', 'ngay_du_kien_sx') +
    field('Ngày dự kiến hoàn thành', 'ngay_hoan_thanh') +
    signature(),

  kcs: () =>
    p('Ngày {{ngay_dua_lenh}}') +
    field('Tên sản phẩm', 'ten_san_pham') +
    field('Lệnh sản xuất', 'so_lenh') +
    p('Yêu cầu sản xuất', { bold: true }) +
    p('Kiểm tra chất lượng sản phẩm theo các tiêu chí sau:') +
    p('Nội dung, màu sắc: {{noi_dung_mau_sac}}; TCCL số: {{tccl_so}}') +
    p('   -  Tổng số lượng yêu cầu kiểm soát: {{tong_sl_kiem_soat}} (Chi tiết có trong Phiếu Y/c kiểm soát)') +
    signature({ xnghiep: true }),

  boi: () =>
    p('Ngày {{ngay_dua_lenh}}') +
    field('Tên sản phẩm', 'ten_san_pham') +
    field('Lệnh sản xuất', 'so_lenh') +
    p('Yêu cầu sản xuất', { bold: true }) +
    p('1. Vật tư, nguyên vật liệu:', { bold: true }) +
    p('   -    Số lượng tờ in: {{so_luong_to_in}}') +
    twoCol('Loại sóng: {{loai_song}}', 'Số lượng: {{so_luong_song}}') +
    twoCol('Keo bồi: {{keo_boi}}', 'Số lượng: {{so_luong_keo}}') +
    p('2. Yêu cầu về chất lượng, số lượng và tiến độ:', { bold: true }) +
    p('- TCCL sản phẩm số: {{tccl_so}}') +
    p('-  Hao phí cho phép: {{hao_phi_cho_phep}}') +
    p('-  Số lượng tờ bồi yêu cầu đạt: {{sl_to_boi_dat}}') +
    field('Thời gian dự kiến sản xuất', 'ngay_du_kien_sx') +
    field('Thời gian dự kiến hoàn thành', 'ngay_hoan_thanh') +
    signature({ xnghiep: true }),

  be: () =>
    p('Ngày {{ngay_dua_lenh}}') +
    field('Tên sản phẩm', 'ten_san_pham') +
    field('Lệnh sản xuất', 'so_lenh') +
    p('I. Yêu cầu sản xuất:', { bold: true }) +
    p('Thông số kỹ thuật:', { bold: true }) +
    p('Số sản phẩm/lần bế: {{so_sp_lan_be}}') +
    field('Kích thước sản phẩm', 'kich_thuoc_sp') +
    p('Duyệt sản phẩm: Theo mẫu số: {{mau_so}} ; TCCL số: {{tccl_so}}') +
    p('2. Yêu cầu về số lượng và tiến độ:', { bold: true }) +
    p('   -  Số lượng tờ bồi (dự kiến): {{sl_to_boi_du_kien}}') +
    field('Hao phí cho phép', 'hao_phi_cho_phep') +
    field('Số lượng thành phẩm yêu cầu đạt', 'sl_thanh_pham_dat') +
    field('Thời gian dự kiến sản xuất', 'ngay_du_kien_sx') +
    field('Thời gian dự kiến hoàn thành', 'ngay_hoan_thanh') +
    signature({ xnghiep: true }),
};

/** Chỉ khớp thẻ <w:p> / <w:p ...>, không khớp <w:pPr>, <w:pict>, ... */
function findParaStart(xml, pos) {
  let i = pos;
  while (i >= 0) {
    i = xml.lastIndexOf('<w:p', i);
    if (i < 0) return -1;
    if (/^<w:p[\s>]/.test(xml.slice(i, i + 10))) return i;
    i -= 1;
  }
  return -1;
}

function findTblStart(xml, pos) {
  let i = pos;
  while (i >= 0) {
    i = xml.lastIndexOf('<w:tbl', i);
    if (i < 0) return -1;
    if (/^<w:tbl[\s>]/.test(xml.slice(i, i + 10))) return i;
    i -= 1;
  }
  return -1;
}

function findCutStart(xml, code) {
  // Sóng: cắt từ "Ngày giao lệnh"
  if (code === 'song') {
    for (const n of ['Ngày giao lệnh', 'giao lệnh']) {
      const i = xml.indexOf(n);
      if (i >= 0) {
        const pStart = findParaStart(xml, i);
        if (pStart >= 0) return pStart;
      }
    }
  }

  // In/KCS/Bồi/Bế: cắt NGAY SAU tiêu đề LỆNH... để không giữ dòng "Ngày tháng năm" trống của mẫu
  const titleNeedles = {
    in: ['LỆNH IN'],
    kcs: ['LỆNH KCS'],
    boi: ['LỆNH BỒI', 'LỆNH BỒI'],
    be: ['LỆNH BẾ'],
  };
  for (const n of titleNeedles[code] || ['LỆNH']) {
    const title = xml.indexOf(n);
    if (title >= 0) {
      const pEnd = xml.indexOf('</w:p>', title);
      if (pEnd >= 0) return pEnd + '</w:p>'.length;
    }
  }
  const title = xml.indexOf('LỆNH');
  if (title >= 0) {
    const pEnd = xml.indexOf('</w:p>', title);
    if (pEnd >= 0) return pEnd + '</w:p>'.length;
  }
  throw new Error(`[${code}] Không tìm thấy điểm bắt đầu vùng điền`);
}

function findReportStart(xml) {
  // Phần báo cáo công nhân — cắt từ đoạn/bảng chứa "Báo cáo..."
  const signCandidates = ['NGƯỜI LẬP', 'Người lập', 'Nguời lập'];
  let from = 0;
  for (const s of signCandidates) {
    const i = xml.indexOf(s);
    if (i >= 0) {
      from = i;
      break;
    }
  }
  const needles = ['Báo cáo', 'Báo', 'III'];
  let bao = -1;
  for (const n of needles) {
    const i = xml.indexOf(n, from);
    if (i >= 0) {
      bao = i;
      break;
    }
  }
  if (bao < 0) {
    const alt = xml.indexOf('áo cáo', from);
    if (alt < 0) throw new Error('Không tìm thấy phần Báo cáo');
    bao = alt;
  }
  const pStart = findParaStart(xml, bao);
  const tblStart = findTblStart(xml, bao);
  if (tblStart >= 0 && pStart >= 0 && tblStart > pStart && bao - tblStart < 800) {
    return tblStart;
  }
  if (pStart >= 0) return pStart;
  if (tblStart >= 0) return tblStart;
  return bao;
}

function prepare(code) {
  // KCS / Bồi: inject vào file gốc (giữ Ngày tháng năm + Xí nghiệp → Giám đốc)
  if (code === 'kcs' || code === 'boi') {
    return;
  }

  const src = join(dir, `${code}.docx`);
  const out = join(dir, `${code}.template.docx`);
  const zip = new PizZip(readFileSync(src));
  let xml = zip.file('word/document.xml').asText();

  const start = findCutStart(xml, code);
  const report = findReportStart(xml);
  if (report <= start) throw new Error(`[${code}] Điểm cắt không hợp lệ start=${start} report=${report}`);

  const block = BLOCKS[code]();
  xml = xml.slice(0, start) + block + xml.slice(report);

  zip.file('word/document.xml', xml);
  writeFileSync(out, zip.generate({ type: 'nodebuffer' }));
  console.log(`OK ${code}.template.docx (kept HABECO shell + báo cáo)`);
}

for (const code of Object.keys(BLOCKS)) {
  prepare(code);
}

for (const script of ['prepare-kcs-template.mjs', 'prepare-boi-template.mjs']) {
  const r = spawnSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), script)], {
    stdio: 'inherit',
  });
  if (r.status !== 0) process.exit(r.status || 1);
}

// cập nhật manifest
const manifestPath = join(dir, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
for (const stage of manifest.stages) {
  if (stage.code !== 'xa' && BLOCKS[stage.code]) {
    stage.template = `${stage.code}.template.docx`;
  }
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('Updated manifest.json');
