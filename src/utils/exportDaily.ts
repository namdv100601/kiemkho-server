import path from 'path';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

const templatePath = path.join(__dirname, '../../templates/bao-cao-ngay.xls');

export type DailyExportLine = {
  stage_name: string;
  shift: string;
  report_date: string;
  note?: string | null;
  order_code?: string | null;
  product_name?: string | null;
  order_product?: string | null;
  material_name?: string | null;
  ton_dau?: number;
  nhap?: number;
  ton_cuoi?: number;
  dat?: number;
  hong_sx?: number;
  hong_khac?: number;
  workers?: { full_name: string }[];
  norm_value?: number | null;
};

function weekLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const week = Math.ceil(d.getDate() / 7);
  return `Tuần ${week}`;
}

function monthTitle(month: string): string {
  const [y, m] = month.split('-');
  return `${Number(m)}/${y}`;
}

/** Xuất theo mẫu sheet BÁO CÁO HÀNG NGÀY */
export function buildDailyWorkbook(month: string, lines: DailyExportLine[]): Buffer {
  let headerRows: unknown[][] = [
    ['CÔNG TY CỔ PHẦN BAO BÌ HABECO'],
    ['Xí nghiệp IN'],
    ['', '', '', '', '', '', `BẢNG THEO DÕI SẢN LƯỢNG HẰNG NGÀY THÁNG ${monthTitle(month)}`],
    [],
    [
      '',
      'STT',
      'Tổ/Bộ phận',
      'Lệnh Sản xuất',
      'Tuần',
      'Ngày SX',
      'Loại sản phẩm',
      'Đơn vị',
      'Tiêu chuẩn KT',
      'Máy móc',
      'Nhân sự',
      '',
      'Định mức Sản phẩm/…h',
      'Năng suất LĐ(sp/ng/s)',
      'Thời gian dừng máy',
      '',
      'Thời gian thay khuôn(h)',
      '',
      'Thời gian bắt đầu',
      '',
      'Thời gian kết thúc',
      '',
      'Thời gian SX',
      '',
      'Sản lượng KH',
      'Đầu vào',
      'Sản lượng',
      'Sp hỏng',
      '',
      '% HTKH',
      'Sản lượng thực tế theo định mức',
      'Năng suất LĐ',
      'Hao phí',
      'Ghi chú',
    ],
    [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'KH',
      'Thực tế',
      '',
      '',
      'KH',
      'Thực tế',
      'KH',
      'Thực tế',
      'KH',
      'Thực tế',
      'KH',
      'Thực tế',
      'KH',
      'Thực tế',
      '',
      '',
      '',
      'Hỏng SX',
      'hỏng khác',
      '',
      '',
      '',
      '',
      '',
    ],
  ];

  let merges: XLSX.Range[] = [];
  let cols: XLSX.ColInfo[] | undefined;

  if (fs.existsSync(templatePath)) {
    const wbTpl = XLSX.read(fs.readFileSync(templatePath));
    const sheetName =
      wbTpl.SheetNames.find((n) => n.toUpperCase().includes('BÁO CÁO HÀNG NGÀY')) ||
      wbTpl.SheetNames.find((n) => n.toUpperCase().includes('BAO CAO')) ||
      wbTpl.SheetNames[0];
    const ws = wbTpl.Sheets[sheetName];
    const all = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][];
    headerRows = all.slice(0, 6);
    headerRows[2] = [
      '',
      '',
      '',
      '',
      '',
      '',
      `BẢNG THEO DÕI SẢN LƯỢNG HẰNG NGÀY THÁNG ${monthTitle(month)}`,
    ];
    merges = (ws['!merges'] || []).filter((m) => m.e.r <= 5);
    cols = ws['!cols'];
  }

  const dataRows = lines.map((line, idx) => {
    const workers = line.workers || [];
    const workerCount = workers.length || '';
    const dat = Number(line.dat || 0);
    const hongSx = Number(line.hong_sx || 0);
    const hongKhac = Number(line.hong_khac || 0);
    const totalHong = hongSx + hongKhac;
    const haoPhi = dat + totalHong > 0 ? totalHong / (dat + totalHong) : '';
    const dauVao = Number(line.nhap || 0) || Number(line.ton_dau || 0) || '';
    const norm = line.norm_value != null ? Number(line.norm_value) : '';

    return [
      `${line.product_name || line.order_product || ''}${line.stage_name || ''}`,
      idx + 1,
      line.stage_name || '',
      line.order_code || '',
      weekLabel(line.report_date),
      line.report_date,
      line.product_name || line.order_product || '',
      '',
      line.material_name || '',
      line.stage_name || '',
      workerCount,
      workerCount,
      norm,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      dauVao,
      dat || '',
      hongSx || '',
      hongKhac || '',
      '',
      '',
      '',
      haoPhi === '' ? '' : Number((Number(haoPhi) * 100).toFixed(4)),
      line.note || '',
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]);
  if (merges.length) ws['!merges'] = merges;
  if (cols) ws['!cols'] = cols.slice(0, 34);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BÁO CÁO HÀNG NGÀY');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
