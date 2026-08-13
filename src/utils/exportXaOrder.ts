import { readFileSync } from 'fs';
import { join } from 'path';
import PizZip from 'pizzip';
import type { StageWorkOrder } from '../entities/stage-work-order.entity';

function dmy(iso?: string | null) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Điền dữ liệu vào đúng biểu mẫu Word HABECO Lệnh Xả giấy (xa.template.docx). */
export async function exportXaOrderDocx(row: StageWorkOrder): Promise<Buffer> {
  const templatePath = join(
    process.cwd(),
    'templates',
    'stage-orders',
    'xa.template.docx'
  );
  const zip = new PizZip(readFileSync(templatePath));
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('Không đọc được biểu mẫu Xả giấy');

  const values: Record<string, string> = {
    ten_san_pham: row.ten_san_pham || '',
    kich_thuoc_xa: row.kich_thuoc_xa || '',
    dinh_luong_xuat: row.dinh_luong_xuat || '',
    khoi_luong: row.khoi_luong || '',
    so_lenh: row.so_lenh || '',
    ngay_dua_lenh: dmy(row.ngay_dua_lenh),
    ngay_hoan_thanh: dmy(row.ngay_hoan_thanh),
    ghi_chu: row.ghi_chu || '',
    nguoi_lap: row.nguoi_lap || '',
    giam_doc: row.giam_doc || '',
  };

  let xml = file.asText();
  for (const [key, value] of Object.entries(values)) {
    xml = xml.split(`{{${key}}}`).join(escapeXml(value));
  }
  zip.file('word/document.xml', xml);

  return zip.generate({ type: 'nodebuffer' });
}
