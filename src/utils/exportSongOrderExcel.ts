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
  return String(value);
}

/** Giữ font/border mẫu; ghi value 1 dòng, không justify (tránh chữ bị đẩy xuống). */
function setValue(cell: ExcelJS.Cell, value: string | number, singleLine = false) {
  cell.value = value;
  if (singleLine) {
    cell.alignment = {
      ...(cell.alignment || {}),
      horizontal: 'left',
      vertical: cell.alignment?.vertical || 'middle',
      wrapText: false,
      shrinkToFit: false,
    };
  }
}

/** Gắn giá trị vào nhãn có sẵn trên mẫu — luôn 1 dòng, căn trái. */
function fillLabeled(cell: ExcelJS.Cell, fallbackLabel: string, value: string) {
  const current = cellText(cell.value).replace(/[\r\n]+/g, ' ').trimEnd();
  const m = current.match(/^(.*?[:：]\s*)/);
  let prefix = m?.[1] || (current.trim() ? `${current.trim()} ` : fallbackLabel);
  prefix = prefix.replace(/[\r\n]+/g, ' ');
  if (value && !/\s$/.test(prefix)) prefix += ' ';
  const text = `${prefix}${value}`.replace(/[\r\n]+/g, ' ');
  setValue(cell, text, true);
}

/**
 * Điền lệnh Sóng vào đúng file mẫu Excel HABECO (song.xlsx).
 * Không tạo workbook/sheet mới — chỉ ghi giá trị vào các ô dữ liệu.
 */
export async function exportSongOrderXlsx(row: StageWorkOrder): Promise<Buffer> {
  const templatePath = join(process.cwd(), 'templates', 'stage-orders', 'song.xlsx');
  if (!existsSync(templatePath)) {
    throw new Error('Thiếu biểu mẫu Excel song.xlsx');
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  const ws = wb.getWorksheet('Sóng') || wb.worksheets[0];
  if (!ws) throw new Error('Không đọc được sheet Sóng');

  const p = payloadOf(row);
  const supplier = s(p.nha_cung_cap).trim();
  const product = (row.ten_san_pham || '').trim();
  const tenSp = product && supplier ? `${product} - ${supplier}` : product || supplier;

  // Info header: tắt justify/wrap để không bị chữ tụt dòng
  for (const r of [4, 5, 6, 7, 8, 9]) {
    const rowObj = ws.getRow(r);
    if (rowObj.height && rowObj.height > 30) rowObj.height = 24.75;
  }

  fillLabeled(ws.getCell('B4'), 'Ngày giao lệnh: ', dmy(row.ngay_dua_lenh));
  fillLabeled(ws.getCell('B5'), 'Số lệnh:  ', row.so_lenh || '');
  fillLabeled(ws.getCell('B6'), 'Tên sản phẩm: ', tenSp);
  fillLabeled(ws.getCell('B7'), 'Số lượng yêu cầu:  ', s(p.so_luong_yeu_cau));
  fillLabeled(ws.getCell('B8'), 'Ngày dự kiến sản xuất: ', dmy(s(p.ngay_du_kien_sx)));
  fillLabeled(ws.getCell('B9'), 'Ngày dự kiến hoàn thành:    ', dmy(row.ngay_hoan_thanh));

  // Nới ô nhãn (cột B hẹp) để cả dòng nằm 1 hàng, không đụng cột "Tấm"
  const widen = (range: string) => {
    try {
      ws.mergeCells(range);
    } catch {
      /* đã merge sẵn */
    }
  };
  widen('B4:C4');
  widen('B5:C5');
  widen('B6:C6');
  widen('B7:C7');
  widen('B8:C8');
  widen('B9:C9');

  const gmsSong = s(p.kraf_song_gms);
  const mmSong = s(p.kraf_song_mm);
  const gmsMat = s(p.kraf_mat_gms);
  const mmMat = s(p.kraf_mat_mm);
  fillLabeled(
    ws.getCell('B12'),
    ' - Kraf sóng: ',
    [gmsSong && `${gmsSong} gms`, mmSong && `${mmSong} mm`].filter(Boolean).join('/')
  );
  fillLabeled(
    ws.getCell('B13'),
    '- Kraf mặt: ',
    [gmsMat && `${gmsMat} gms`, mmMat && `${mmMat} mm`].filter(Boolean).join('/')
  );

  // Hàng thông số kỹ thuật (dưới tiêu đề hàng 16)
  setValue(ws.getCell('B17'), s(p.buoc_song), true);
  setValue(ws.getCell('C17'), s(p.trong_luong), true);
  setValue(ws.getCell('E17'), s(p.do_day), true);
  setValue(ws.getCell('F17'), s(p.kich_thuoc), true);
  setValue(ws.getCell('G17'), s(p.chieu_doc), true);

  const lines = Array.isArray(p.vat_tu_lines)
    ? (p.vat_tu_lines as Record<string, unknown>[])
    : [];
  const startRow = 23;
  for (let i = 0; i < 6; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const r = startRow + i;
    setValue(ws.getCell(`A${r}`), i + 1, true);
    setValue(ws.getCell(`B${r}`), s(line.vat_tu), true);
    setValue(ws.getCell(`D${r}`), s(line.dvt), true);
    setValue(ws.getCell(`E${r}`), s(line.ton_dau), true);
    setValue(ws.getCell(`F${r}`), s(line.so_luong_dinh_muc), true);
    setValue(ws.getCell(`G${r}`), s(line.du_kien_xuat), true);
  }

  if (row.nguoi_lap) setValue(ws.getCell('B33'), row.nguoi_lap, true);
  if (row.giam_doc) setValue(ws.getCell('F35'), row.giam_doc, true);

  // Đơn vị "Tấm" giữ cột D — tắt wrap để không lệch hàng
  const unitCell = ws.getCell('D7');
  if (unitCell.value != null) {
    unitCell.alignment = {
      ...(unitCell.alignment || {}),
      horizontal: 'left',
      vertical: 'middle',
      wrapText: false,
    };
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

export function songExcelFileName(row: StageWorkOrder) {
  const code = (row.so_lenh || 'song').replace(/[^\w.-]+/g, '_');
  return `Lenh-Song-${code}.xlsx`;
}
