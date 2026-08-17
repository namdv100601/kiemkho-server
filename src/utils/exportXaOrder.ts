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

function readPayload(row: StageWorkOrder) {
  const raw = row.payload;
  if (!raw || typeof raw !== 'object') {
    return {
      nha_cung_cap: '',
      so_qua: '',
      trong_luong_qua: '',
      so_luong_tuong_ung: '',
    };
  }
  const p = raw as Record<string, unknown>;
  const soQua = p.so_qua != null && p.so_qua !== '' ? String(p.so_qua) : '';
  const tlq =
    p.trong_luong_qua != null && p.trong_luong_qua !== ''
      ? String(p.trong_luong_qua)
      : '';
  const sltt =
    p.so_luong_tuong_ung != null && p.so_luong_tuong_ung !== ''
      ? String(p.so_luong_tuong_ung)
      : '';
  return {
    nha_cung_cap: String(p.nha_cung_cap || '').trim(),
    so_qua: soQua,
    trong_luong_qua: tlq,
    so_luong_tuong_ung: sltt,
  };
}

/** Điền dữ liệu vào biểu mẫu Word Lệnh Xả giấy (xa.template.docx). */
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

  const payload = readPayload(row);
  const product = (row.ten_san_pham || '').trim();
  const supplier = payload.nha_cung_cap;
  const tenWithSupplier = product && supplier ? `${product} - ${supplier}` : product || supplier;

  const values: Record<string, string> = {
    ten_san_pham: tenWithSupplier,
    kich_thuoc_xa: row.kich_thuoc_xa || '',
    dinh_luong_xuat: row.dinh_luong_xuat || '',
    khoi_luong: row.khoi_luong || '',
    so_qua: payload.so_qua,
    trong_luong_qua: payload.trong_luong_qua,
    so_luong_tuong_ung: payload.so_luong_tuong_ung,
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
