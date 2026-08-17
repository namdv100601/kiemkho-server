import { existsSync } from 'fs';
import { join } from 'path';
import ExcelJS from 'exceljs';
import type { StageWorkOrder } from '../entities/stage-work-order.entity';

function dmy(iso?: string | null) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return String(iso || '');
  return `${d}/${m}/${y}`;
}

function s(v: unknown) {
  return v == null ? '' : String(v);
}

function payloadOf(row: StageWorkOrder): Record<string, unknown> {
  return row.payload && typeof row.payload === 'object'
    ? (row.payload as Record<string, unknown>)
    : {};
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object' && 'richText' in value && Array.isArray(value.richText)) {
    return value.richText.map((t) => t.text || '').join('');
  }
  if (typeof value === 'object' && 'text' in value && value.text != null) {
    return String(value.text);
  }
  if (typeof value === 'object' && 'formula' in value) {
    return '';
  }
  return String(value);
}

/** Ghi 1 dòng, căn trái/giữa — tắt wrap để không cắt/đẩy chữ. */
function setValue(
  cell: ExcelJS.Cell,
  value: string | number,
  opts?: { horizontal?: 'left' | 'center' | 'right'; vertical?: 'top' | 'middle' | 'bottom' }
) {
  cell.value = value;
  cell.alignment = {
    horizontal: opts?.horizontal || 'left',
    vertical: opts?.vertical || 'middle',
    wrapText: false,
    shrinkToFit: false,
  };
}

/** Chỉ giữ nhãn mẫu (phần đến dấu ':'), không nhét value dài vào ô hẹp. */
function keepLabelOnly(cell: ExcelJS.Cell, fallbackLabel: string) {
  const current = cellText(cell.value).replace(/[\r\n]+/g, ' ').trimEnd();
  const m = current.match(/^(.*?[:：]\s*)/);
  const label = (m?.[1] || fallbackLabel).replace(/[\r\n]+/g, ' ');
  setValue(cell, label);
}

function fillLabeled(cell: ExcelJS.Cell, fallbackLabel: string, value: string) {
  const current = cellText(cell.value).replace(/[\r\n]+/g, ' ').trimEnd();
  const m = current.match(/^(.*?[:：]\s*)/);
  let prefix = m?.[1] || (current.trim() ? `${current.trim()} ` : fallbackLabel);
  prefix = prefix.replace(/[\r\n]+/g, ' ');
  if (value && !/\s$/.test(prefix)) prefix += ' ';
  setValue(cell, `${prefix}${value}`.replace(/[\r\n]+/g, ' '));
}

function tryMerge(ws: ExcelJS.Worksheet, range: string) {
  try {
    ws.mergeCells(range);
  } catch {
    /* already merged / conflict */
  }
}

function hnDateLine(iso?: string | null) {
  if (!iso) return 'HN, ngày        tháng       năm 2026';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return `HN, ngày        tháng       năm ${y || 2026}`;
  return `HN, ngày ${Number(d)} tháng ${Number(m)} năm ${y}`;
}

type KetQuaLine = {
  ngay_san_xuat?: string;
  ngay_nhap?: string;
  kiem_tra_ngoai_quan?: string;
  dinh_luong_dau_vao?: string;
  khoi_luong_tren_qua?: string;
  khoi_luong_can_lai?: string;
  rach_san_xuat?: string;
  rach_truoc?: string;
  vo_loi?: string;
  thanh_pham_thuc_te?: string;
  dinh_luong_kiem_tra?: string;
};

/**
 * Điền lệnh Xả vào mẫu Excel HABECO (xa.xlsx — sheet Xả).
 * Nhãn giữ nguyên ô mẫu; giá trị dài ghi ô cạnh để không bị cắt/đẩy dòng.
 */
export async function exportXaOrderXlsx(row: StageWorkOrder): Promise<Buffer> {
  const templatePath = join(process.cwd(), 'templates', 'stage-orders', 'xa.xlsx');
  if (!existsSync(templatePath)) {
    throw new Error('Thiếu biểu mẫu Excel xa.xlsx');
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  const ws = wb.getWorksheet('Xả') || wb.worksheets[0];
  if (!ws) throw new Error('Không đọc được sheet Xả');

  const p = payloadOf(row);
  const supplier = s(p.nha_cung_cap).trim();
  const product = (row.ten_san_pham || '').trim();
  const tenSp = product && supplier ? `${product} - ${supplier}` : product || supplier;

  const soQua = s(p.so_qua).trim();
  const trongLuongQua = s(p.trong_luong_qua).trim();
  const khoiLuong = (row.khoi_luong || '').trim();
  // Giá trị khối lượng ngắn — số quả để cạnh, không nhét vào ô I5:J5 hẹp
  const khoiLuongValue =
    khoiLuong && soQua ? `${khoiLuong} (${soQua} quả)` : khoiLuong || (soQua ? `${soQua} quả` : '');

  // Trái: nới B→G, điền nhãn+giá trị (cột rộng đủ)
  tryMerge(ws, 'B4:G4');
  tryMerge(ws, 'B5:G5');
  tryMerge(ws, 'B6:G6');
  tryMerge(ws, 'B7:G7');
  tryMerge(ws, 'B8:G8');
  fillLabeled(ws.getCell('B4'), '1. Tên sản phẩm: ', tenSp);
  fillLabeled(ws.getCell('B5'), '2. Kích thước xả: ', row.kich_thuoc_xa || '');
  fillLabeled(ws.getCell('B6'), '3. Định lượng xuất: ', row.dinh_luong_xuat || '');
  fillLabeled(ws.getCell('B7'), '4. Ngày đưa lệnh: ', dmy(row.ngay_dua_lenh));
  fillLabeled(ws.getCell('B8'), '5. Số lệnh: ', row.so_lenh || '');

  // Phải: nhãn giữ I:J (đã merge sẵn), giá trị ghi K — tránh cắt bởi L (trọng lượng / Tờ)
  keepLabelOnly(ws.getCell('I5'), '6. Khối lượng : ');
  setValue(ws.getCell('K5'), khoiLuongValue);
  if (trongLuongQua) {
    fillLabeled(ws.getCell('L5'), '- Trọng lượng / quả: ', trongLuongQua);
  }

  keepLabelOnly(ws.getCell('I6'), '7. Số lượng tương ứng: ');
  setValue(ws.getCell('J6'), s(p.so_luong_tuong_ung));
  ws.getCell('K6').value = null; // bỏ công thức rác mẫu
  setValue(ws.getCell('L6'), 'Tờ'); // giữ đơn vị, tắt wrap

  keepLabelOnly(ws.getCell('I7'), '8. Ngày hoàn thành: ');
  setValue(ws.getCell('K7'), dmy(row.ngay_hoan_thanh));

  // Ghi chú: nới I→K (I8:J8 sẵn), giá trị đủ chỗ
  try {
    ws.unMergeCells('I8:J8');
  } catch {
    /* */
  }
  tryMerge(ws, 'I8:K8');
  fillLabeled(ws.getCell('I8'), '9. Ghi chú: ', row.ghi_chu || '');

  // Chữ ký: tên in ở dòng cuối vùng ký (C15 / I15), không ghi giữa khoảng trống
  if (row.nguoi_lap) {
    setValue(ws.getCell('C15'), row.nguoi_lap, {
      horizontal: 'center',
      vertical: 'middle',
    });
  }
  if (row.giam_doc) {
    setValue(ws.getCell('I15'), row.giam_doc, {
      horizontal: 'center',
      vertical: 'middle',
    });
  }

  // Kết quả SX — tối đa 11 dòng (A21–A31)
  const lines = Array.isArray(p.ket_qua_lines) ? (p.ket_qua_lines as KetQuaLine[]) : [];
  const startRow = 21;
  const maxRows = 11;
  for (let i = 0; i < maxRows; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const r = startRow + i;
    setValue(ws.getCell(`B${r}`), dmy(line.ngay_san_xuat) || s(line.ngay_san_xuat));
    setValue(ws.getCell(`C${r}`), dmy(line.ngay_nhap) || s(line.ngay_nhap));
    setValue(ws.getCell(`D${r}`), s(line.kiem_tra_ngoai_quan));
    setValue(ws.getCell(`E${r}`), s(line.dinh_luong_dau_vao));
    setValue(ws.getCell(`F${r}`), s(line.khoi_luong_tren_qua));
    setValue(ws.getCell(`G${r}`), s(line.khoi_luong_can_lai));
    setValue(ws.getCell(`H${r}`), s(line.rach_san_xuat));
    setValue(ws.getCell(`I${r}`), s(line.rach_truoc));
    setValue(ws.getCell(`J${r}`), s(line.vo_loi));
    setValue(ws.getCell(`K${r}`), s(line.thanh_pham_thuc_te));
    setValue(ws.getCell(`L${r}`), s(line.dinh_luong_kiem_tra));
  }

  setValue(ws.getCell('I32'), hnDateLine(row.ngay_hoan_thanh || row.ngay_dua_lenh), {
    horizontal: 'center',
    vertical: 'middle',
  });

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

export function xaExcelFileName(row: StageWorkOrder) {
  const code = (row.so_lenh || 'xa').replace(/[^\w.-]+/g, '_');
  return `Lenh-Xa-${code}.xlsx`;
}
