import path from 'path';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

const templatePath = path.join(__dirname, '../../templates/bao-cao-be.xlsx');

export type ExportLine = {
  order_code?: string | null;
  material_name?: string | null;
  product_name?: string | null;
  order_product?: string | null;
  ton_dau?: number;
  nhap?: number;
  ton_cuoi?: number;
  dat?: number;
  hong_sx?: number;
  hong_khac?: number;
  workers?: { full_name: string }[];
};

export type ExportReport = {
  report_date: string;
  shift: string;
  created_by_name?: string | null;
  lines: ExportLine[];
};

/** Xuất Excel theo mẫu khâu Bế (header 3 dòng). */
export function buildMonthlyWorkbook(stageName: string, reports: ExportReport[]): Buffer {
  let wb: XLSX.WorkBook;
  if (fs.existsSync(templatePath)) {
    wb = XLSX.read(fs.readFileSync(templatePath));
  } else {
    wb = XLSX.utils.book_new();
    const blank = XLSX.utils.aoa_to_sheet([
      [
        'Ngày sản xuất',
        'Thời gian sản xuất',
        'Người phụ trách',
        'Lệnh sản xuất',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'Bong keo',
        '',
      ],
      [
        '',
        'Ca',
        '',
        '',
        'Tên và thông số kỹ thuật',
        'Số lượng nhập',
        '',
        '',
        'ĐVT',
        'Tên sản phẩm thực hiện',
        'Đạt (bước 1)',
        'Hỏng',
        '',
        '',
        'Hao phí(%)',
      ],
      [
        '',
        '',
        '',
        '',
        '',
        'Tồn đầu',
        'Nhập mới',
        'Tồn cuối',
        '',
        '',
        '',
        'Do sản xuất',
        'Do khâu trước',
        '',
        '',
      ],
    ]);
    XLSX.utils.book_append_sheet(wb, blank, stageName.slice(0, 31) || 'Bao cao');
  }

  const oldName = wb.SheetNames[0];
  const oldWs = wb.Sheets[oldName];

  const headerRows = XLSX.utils.sheet_to_json<unknown[]>(oldWs, {
    header: 1,
    defval: '',
  }).slice(0, 3) as unknown[][];

  const dataRows: unknown[][] = [];
  let lastDate = '';
  let lastShift = '';

  const sorted = [...reports].sort((a, b) => {
    if (a.report_date !== b.report_date) return a.report_date.localeCompare(b.report_date);
    return a.shift.localeCompare(b.shift);
  });

  for (const report of sorted) {
    const lines = report.lines.length ? report.lines : [{} as ExportLine];
    const person =
      [
        ...new Set(
          report.lines
            .filter((l) => String(l.order_code || '').trim())
            .flatMap((l) => l.workers || [])
            .map((w) => w.full_name)
            .filter(Boolean)
        ),
      ].join(', ') ||
      report.created_by_name ||
      '';

    let personWritten = false;
    for (const line of lines) {
      const dat = Number(line.dat || 0);
      const hongSx = Number(line.hong_sx || 0);
      const hongKhac = Number(line.hong_khac || 0);
      const totalHong = hongSx + hongKhac;
      const haoPhi = dat + totalHong > 0 ? totalHong / (dat + totalHong) : 0;

      const showDate = report.report_date !== lastDate;
      const showShift = showDate || report.shift !== lastShift;
      if (showShift) personWritten = false;

      const hasOrder = Boolean(String(line.order_code || '').trim());
      const showPerson = hasOrder && !personWritten;
      if (showPerson) personWritten = true;

      dataRows.push([
        showDate ? report.report_date : '',
        showShift ? report.shift : '',
        showPerson ? person : '',
        line.order_code || '',
        line.material_name || '',
        Number(line.ton_dau || 0) || '',
        Number(line.nhap || 0) || '',
        Number(line.ton_cuoi || 0) || '',
        '',
        line.product_name || line.order_product || '',
        dat || '',
        hongSx || '',
        hongKhac || '',
        '',
        haoPhi ? Number((haoPhi * 100).toFixed(4)) : '',
      ]);

      lastDate = report.report_date;
      lastShift = report.shift;
    }
  }

  const sheetName = (stageName || 'Bao cao').slice(0, 31);
  const newWs = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]);

  const headerMerges = (oldWs['!merges'] || []).filter((m) => m.e.r <= 2);
  newWs['!merges'] = headerMerges;
  if (oldWs['!cols']) newWs['!cols'] = oldWs['!cols'].slice(0, 15);

  delete wb.Sheets[oldName];
  wb.SheetNames = [sheetName];
  wb.Sheets[sheetName] = newWs;

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
