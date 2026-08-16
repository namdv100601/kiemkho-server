import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import PizZip from 'pizzip';
import type { StageWorkOrder } from '../entities/stage-work-order.entity';
import { exportXaOrderDocx } from './exportXaOrder';

function dmy(iso?: string | null) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return String(iso);
  return `${d}/${m}/${y}`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function s(v: unknown) {
  return v == null ? '' : String(v);
}

function payloadOf(row: StageWorkOrder): Record<string, unknown> {
  return row.payload && typeof row.payload === 'object'
    ? (row.payload as Record<string, unknown>)
    : {};
}

function fillTemplate(templateFile: string, values: Record<string, string>): Buffer {
  const templatePath = join(process.cwd(), 'templates', 'stage-orders', templateFile);
  if (!existsSync(templatePath)) {
    throw new Error(`Thiếu biểu mẫu ${templateFile}. Chạy: npm run templates:prepare-stages`);
  }
  const zip = new PizZip(readFileSync(templatePath));
  const file = zip.file('word/document.xml');
  if (!file) throw new Error(`Không đọc được ${templateFile}`);

  let xml = file.asText();
  for (const [key, value] of Object.entries(values)) {
    xml = xml.split(`{{${key}}}`).join(escapeXml(value ?? ''));
  }
  // xóa placeholder còn thừa (dòng vật tư trống)
  xml = xml.replace(/\{\{[a-z0-9_]+\}\}/gi, '');
  zip.file('word/document.xml', xml);
  return zip.generate({ type: 'nodebuffer' });
}

function commonValues(row: StageWorkOrder): Record<string, string> {
  return {
    ten_san_pham: row.ten_san_pham || '',
    so_lenh: row.so_lenh || '',
    ngay_dua_lenh: dmy(row.ngay_dua_lenh),
    ngay_hoan_thanh: dmy(row.ngay_hoan_thanh),
    nguoi_lap: row.nguoi_lap || '',
    giam_doc: row.giam_doc || '',
  };
}

function songValues(row: StageWorkOrder): Record<string, string> {
  const p = payloadOf(row);
  const lines = Array.isArray(p.vat_tu_lines) ? (p.vat_tu_lines as Record<string, string>[]) : [];
  const values: Record<string, string> = {
    ...commonValues(row),
    nha_cung_cap: s(p.nha_cung_cap),
    so_luong_yeu_cau: s(p.so_luong_yeu_cau),
    ngay_du_kien_sx: dmy(s(p.ngay_du_kien_sx)),
    kraf_song_gms: s(p.kraf_song_gms),
    kraf_song_mm: s(p.kraf_song_mm),
    kraf_mat_gms: s(p.kraf_mat_gms),
    kraf_mat_mm: s(p.kraf_mat_mm),
    buoc_song: s(p.buoc_song),
    trong_luong: s(p.trong_luong),
    do_day: s(p.do_day),
    kich_thuoc: s(p.kich_thuoc),
  };
  for (let i = 1; i <= 6; i++) {
    const line = lines[i - 1] || {};
    values[`vt${i}_vat_tu`] = s(line.vat_tu);
    values[`vt${i}_dvt`] = s(line.dvt);
    values[`vt${i}_ton_dau`] = s(line.ton_dau);
    values[`vt${i}_dinh_muc`] = s(line.so_luong_dinh_muc);
    values[`vt${i}_du_kien`] = s(line.du_kien_xuat);
  }
  return values;
}

function inValues(row: StageWorkOrder): Record<string, string> {
  const p = payloadOf(row);
  const lines = Array.isArray(p.vat_tu_lines) ? (p.vat_tu_lines as Record<string, string>[]) : [];
  const values: Record<string, string> = {
    ...commonValues(row),
    so_mau_in: s(p.so_mau_in),
    thu_tu_in: s(p.thu_tu_in),
    mau_so: s(p.mau_so),
    tccl_so: s(p.tccl_so),
    tong_sl_giay_xuat: s(p.tong_sl_giay_xuat),
    hao_phi_cho_phep: s(p.hao_phi_cho_phep),
    sl_yeu_cau_dat: s(p.sl_yeu_cau_dat),
    ngay_du_kien_sx: dmy(s(p.ngay_du_kien_sx)),
  };
  for (let i = 1; i <= 6; i++) {
    const line = lines[i - 1] || {};
    values[`vt${i}_ten`] = s(line.ten_vat_tu);
    values[`vt${i}_dvt`] = s(line.don_vi);
    values[`vt${i}_sl`] = s(line.so_luong);
    values[`vt${i}_gc`] = s(line.ghi_chu);
  }
  return values;
}

function kcsValues(row: StageWorkOrder): Record<string, string> {
  const p = payloadOf(row);
  return {
    ...commonValues(row),
    noi_dung_mau_sac: s(p.noi_dung_mau_sac),
    tccl_so: s(p.tccl_so),
    tong_sl_kiem_soat: s(p.tong_sl_kiem_soat),
  };
}

function boiValues(row: StageWorkOrder): Record<string, string> {
  const p = payloadOf(row);
  return {
    ...commonValues(row),
    so_luong_to_in: s(p.so_luong_to_in),
    loai_song: s(p.loai_song),
    so_luong_song: s(p.so_luong_song),
    keo_boi: s(p.keo_boi),
    so_luong_keo: s(p.so_luong_keo),
    tccl_so: s(p.tccl_so),
    hao_phi_cho_phep: s(p.hao_phi_cho_phep),
    sl_to_boi_dat: s(p.sl_to_boi_dat),
    ngay_du_kien_sx: dmy(s(p.ngay_du_kien_sx)),
  };
}

function beValues(row: StageWorkOrder): Record<string, string> {
  const p = payloadOf(row);
  return {
    ...commonValues(row),
    so_sp_lan_be: s(p.so_sp_lan_be) || '1/1',
    kich_thuoc_sp: s(p.kich_thuoc_sp),
    mau_so: s(p.mau_so),
    tccl_so: s(p.tccl_so),
    sl_to_boi_du_kien: s(p.sl_to_boi_du_kien),
    hao_phi_cho_phep: s(p.hao_phi_cho_phep),
    sl_thanh_pham_dat: s(p.sl_thanh_pham_dat),
    ngay_du_kien_sx: dmy(s(p.ngay_du_kien_sx)),
  };
}

const FILE_PREFIX: Record<string, string> = {
  xa: 'Lenh-Xa',
  song: 'Lenh-Song',
  in: 'Lenh-In',
  kcs: 'Lenh-KCS',
  boi: 'Lenh-Boi',
  be: 'Lenh-Be',
};

const TEMPLATE_FILE: Record<string, string> = {
  song: 'song.template.docx',
  in: 'in.template.docx',
  kcs: 'kcs.template.docx',
  boi: 'boi.template.docx',
  be: 'be.template.docx',
};

export function exportFileName(row: StageWorkOrder) {
  const prefix = FILE_PREFIX[row.stage_code] || `Lenh-${row.stage_code}`;
  const code = (row.so_lenh || String(row.id)).replace(/[^\w.-]+/g, '_');
  return `${prefix}-${code}.docx`;
}

/** Điền dữ liệu vào đúng biểu mẫu HABECO (giống Xả). */
export async function exportStageOrderDocx(row: StageWorkOrder): Promise<Buffer> {
  if (row.stage_code === 'xa') return exportXaOrderDocx(row);

  const template = TEMPLATE_FILE[row.stage_code];
  if (!template) throw new Error(`Chưa hỗ trợ xuất Word cho mã ${row.stage_code}`);

  let values: Record<string, string>;
  switch (row.stage_code) {
    case 'song':
      values = songValues(row);
      break;
    case 'in':
      values = inValues(row);
      break;
    case 'kcs':
      values = kcsValues(row);
      break;
    case 'boi':
      values = boiValues(row);
      break;
    case 'be':
      values = beValues(row);
      break;
    default:
      throw new Error(`Chưa hỗ trợ xuất Word cho mã ${row.stage_code}`);
  }
  return fillTemplate(template, values);
}

export function sampleStageOrder(stageCode: string): StageWorkOrder {
  const today = new Date().toISOString().slice(0, 10);
  const base = {
    id: 0,
    stage_code: stageCode,
    ten_san_pham: 'Sản phẩm demo',
    kich_thuoc_xa: null as string | null,
    dinh_luong_xuat: null as string | null,
    khoi_luong: null as string | null,
    so_lenh: `${stageCode.toUpperCase()}-DEMO`,
    ngay_dua_lenh: today,
    ngay_hoan_thanh: today,
    ghi_chu: null as string | null,
    nguoi_lap: 'Phạm Thị Thu Hương',
    giam_doc: 'Nguyễn Khánh Vi',
    payload: null as Record<string, unknown> | null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  if (stageCode === 'xa') {
    return {
      ...base,
      ten_san_pham: 'Duplex 250/825 – Hansol',
      kich_thuoc_xa: '825*541 (±1) mm',
      dinh_luong_xuat: '230gms',
      khoi_luong: '7.362 kg',
      so_lenh: 'XH-DEMO',
      ghi_chu: 'Mẫu xem trước',
    } as StageWorkOrder;
  }
  if (stageCode === 'song') {
    return {
      ...base,
      so_lenh: 'SH-DEMO',
      payload: {
        so_luong_yeu_cau: '1000',
        ngay_du_kien_sx: today,
        kraf_song_gms: '120',
        kraf_song_mm: '1050',
        kraf_mat_gms: '175',
        kraf_mat_mm: '1050',
        buoc_song: '5',
        trong_luong: '250',
        do_day: '3',
        kich_thuoc: '825x541',
        vat_tu_lines: [
          {
            vat_tu: 'Giấy Kraft sóng',
            dvt: 'kg',
            ton_dau: '0',
            so_luong_dinh_muc: '100',
            du_kien_xuat: '100',
          },
        ],
      },
    } as StageWorkOrder;
  }
  if (stageCode === 'in') {
    return {
      ...base,
      payload: {
        so_mau_in: '4',
        thu_tu_in: 'CMYK',
        mau_so: 'M1',
        tccl_so: 'T1',
        tong_sl_giay_xuat: '1000',
        hao_phi_cho_phep: '20',
        sl_yeu_cau_dat: '980',
        ngay_du_kien_sx: today,
        vat_tu_lines: [
          { ten_vat_tu: 'Giấy duplex', don_vi: 'tờ', so_luong: '1000', ghi_chu: '' },
        ],
      },
    } as StageWorkOrder;
  }
  if (stageCode === 'kcs') {
    return {
      ...base,
      payload: {
        noi_dung_mau_sac: 'Đúng mẫu',
        tccl_so: 'T2',
        tong_sl_kiem_soat: '500',
      },
    } as StageWorkOrder;
  }
  if (stageCode === 'boi') {
    return {
      ...base,
      payload: {
        so_luong_to_in: '900',
        loai_song: 'B',
        so_luong_song: '900',
        keo_boi: 'Keo A',
        so_luong_keo: '5',
        tccl_so: 'T3',
        hao_phi_cho_phep: '10',
        sl_to_boi_dat: '890',
        ngay_du_kien_sx: today,
      },
    } as StageWorkOrder;
  }
  return {
    ...base,
    payload: {
      so_sp_lan_be: '1/1',
      kich_thuoc_sp: '200x100',
      mau_so: 'M2',
      tccl_so: 'T4',
      sl_to_boi_du_kien: '880',
      hao_phi_cho_phep: '5',
      sl_thanh_pham_dat: '875',
      ngay_du_kien_sx: today,
    },
  } as StageWorkOrder;
}
