import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import {
  Handover,
  Norm,
  ProductionOrder,
  ShiftReport,
  ShiftReportLine,
  Stage,
  Worker,
} from '../../entities';
import { buildMonthlyWorkbook } from '../../utils/exportMonthly';
import { buildDailyWorkbook } from '../../utils/exportDaily';

export type ReportLineInput = {
  line_type: 'lenh' | 'nvl';
  order_id?: number | null;
  order2_id?: number | null;
  order_code?: string | null;
  order2_code?: string | null;
  material_id?: number | null;
  material_name?: string | null;
  product_name?: string | null;
  entry_date?: string | null;
  ton_dau?: number;
  nhap?: number;
  ton_cuoi?: number;
  dat?: number;
  hong_sx?: number;
  hong_khac?: number;
  workers?: { id: number; full_name: string }[];
};

type ExportableLine = {
  line_type?: 'lenh' | 'nvl';
  order_code?: string | null;
  material_name?: string | null;
  product_name?: string | null;
  order_product?: string | null;
  order2_product?: string | null;
  ton_dau?: number;
  nhap?: number;
  ton_cuoi?: number;
  dat?: number;
  hong_sx?: number;
  hong_khac?: number;
  workers?: { full_name: string }[];
};

type MonthlyQuery = {
  stage_id?: string;
  month?: string;
  date?: string;
  from?: string;
  to?: string;
  shift?: string;
  product?: string;
  material?: string;
};

function resolveTonCuoi(line: ReportLineInput): number {
  if (line.ton_cuoi != null) return Number(line.ton_cuoi);
  const tonDau = Number(line.ton_dau || 0);
  const nhap = Number(line.nhap || 0);
  const dat = Number(line.dat || 0);
  const hong = Number(line.hong_sx || 0) + Number(line.hong_khac || 0);
  return tonDau + nhap - dat - hong;
}

function normalizedName(value: unknown): string {
  return String(value || '').trim().toLocaleLowerCase('vi');
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(ShiftReport) private readonly reports: Repository<ShiftReport>,
    @InjectRepository(ShiftReportLine) private readonly lines: Repository<ShiftReportLine>,
    @InjectRepository(Handover) private readonly handovers: Repository<Handover>,
    @InjectRepository(Stage) private readonly stages: Repository<Stage>,
    @InjectRepository(Norm) private readonly norms: Repository<Norm>,
    @InjectRepository(ProductionOrder) private readonly orders: Repository<ProductionOrder>,
    @InjectRepository(Worker) private readonly workers: Repository<Worker>,
    private readonly dataSource: DataSource
  ) {}

  async getReportDetail(id: number) {
    const report = await this.reports
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.stage', 's')
      .leftJoinAndSelect('r.creator', 'u')
      .where('r.id = :id', { id })
      .getOne();
    if (!report) return null;

    const lines = await this.lines
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.order', 'o1')
      .leftJoinAndSelect('l.order2', 'o2')
      .where('l.report_id = :id', { id })
      .orderBy('l.sort_order', 'ASC')
      .addOrderBy('l.id', 'ASC')
      .getMany();

    const handovers = await this.handovers.find({
      where: { report_id: id },
      order: { id: 'ASC' },
    });

    const { stage, creator, ...reportRest } = report;
    return {
      ...reportRest,
      stage_name: stage?.name,
      created_by_name: creator?.full_name,
      lines: lines.map((l) => {
        const { order, order2, material: _m, report: _r, ...lineRest } = l;
        return {
          ...lineRest,
          order_code: l.order_code_text || order?.code || null,
          order_product: order?.product_name || null,
          order2_code: l.order2_code_text || order2?.code || null,
          order2_product: order2?.product_name || null,
          workers: l.workers_json || [],
          hong: Number(l.hong_sx || 0) + Number(l.hong_khac || 0),
          tieu_hao: Number(l.dat || 0) + Number(l.hong_sx || 0) + Number(l.hong_khac || 0),
        };
      }),
      handovers,
    };
  }

  private async savePayload(
    manager: EntityManager,
    reportId: number,
    lines: ReportLineInput[],
    handovers: { handover_type: string; loai?: string; order_code?: string; quantity?: number }[]
  ) {
    await manager.delete(ShiftReportLine, { report_id: reportId });
    await manager.delete(Handover, { report_id: reportId });

    for (let i = 0; i < (lines || []).length; i++) {
      const line = lines[i];
      await manager.save(
        manager.create(ShiftReportLine, {
          report_id: reportId,
          line_type: line.line_type,
          order_id: line.order_id || null,
          order2_id: line.order2_id || null,
          order_code_text: line.order_code || null,
          order2_code_text: line.order2_code || null,
          material_id: line.material_id || null,
          material_name: line.material_name || null,
          product_name: line.product_name || null,
          entry_date: line.entry_date || null,
          ton_dau: line.ton_dau || 0,
          nhap: line.nhap || 0,
          ton_cuoi: resolveTonCuoi(line),
          dat: line.dat || 0,
          hong_sx: line.hong_sx || 0,
          hong_khac: line.hong_khac || 0,
          workers_json: line.workers || [],
          sort_order: i,
        })
      );
    }

    for (const h of handovers || []) {
      await manager.save(
        manager.create(Handover, {
          report_id: reportId,
          handover_type: h.handover_type as 'next_stage' | 'next_shift',
          loai: h.loai || null,
          order_code: h.order_code || null,
          quantity: h.quantity || 0,
        })
      );
    }
  }

  async list(query: { stage_id?: string; date?: string; from?: string; to?: string }) {
    const qb = this.reports
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.stage', 's')
      .leftJoinAndSelect('r.creator', 'u')
      .orderBy('r.report_date', 'DESC')
      .addOrderBy('r.shift', 'ASC')
      .addOrderBy('r.id', 'DESC');
    if (query.stage_id) qb.andWhere('r.stage_id = :stageId', { stageId: Number(query.stage_id) });
    if (query.date) qb.andWhere('r.report_date = :date', { date: query.date });
    if (query.from) qb.andWhere('r.report_date >= :from', { from: query.from });
    if (query.to) qb.andWhere('r.report_date <= :to', { to: query.to });
    const rows = await qb.getMany();
    return rows.map((r) => {
      const { stage, creator, ...rest } = r;
      return {
        ...rest,
        stage_name: stage?.name,
        created_by_name: creator?.full_name,
      };
    });
  }

  private filterMonthlyLines<T extends ExportableLine>(lines: T[], query: MonthlyQuery): T[] {
    const product = String(query.product || '').trim().toLocaleLowerCase('vi');
    const material = String(query.material || '').trim().toLocaleLowerCase('vi');
    return lines.filter((line) => {
      const isOrderLine =
        line.line_type !== 'nvl' && Boolean(String(line.order_code || '').trim());
      if (!isOrderLine) return false;
      const productName = String(line.product_name || line.order2_product || line.order_product || '')
        .trim()
        .toLocaleLowerCase('vi');
      const materialName = String(line.material_name || '').trim().toLocaleLowerCase('vi');
      return (!product || productName.includes(product)) && (!material || materialName.includes(material));
    });
  }

  private applyMonthlyReportFilters(
    qb: ReturnType<Repository<ShiftReport>['createQueryBuilder']>,
    query: MonthlyQuery
  ) {
    if (query.month) {
      qb.andWhere(`to_char(r.report_date::date, 'YYYY-MM') = :month`, { month: query.month });
    }
    if (query.date) qb.andWhere('r.report_date = :date', { date: query.date });
    if (query.from) qb.andWhere('r.report_date >= :from', { from: query.from });
    if (query.to) qb.andWhere('r.report_date <= :to', { to: query.to });
    if (query.stage_id) qb.andWhere('r.stage_id = :stageId', { stageId: Number(query.stage_id) });
    if (query.shift) qb.andWhere('r.shift = :shift', { shift: query.shift });
    return qb;
  }

  async monthly(query: MonthlyQuery) {
    if (!query.month && !query.date && !query.from && !query.to) {
      throw new BadRequestException('Cần chọn khoảng thời gian');
    }
    const qb = this.reports
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.stage', 's')
      .leftJoinAndSelect('r.creator', 'u')
      .orderBy('r.report_date', 'ASC')
      .addOrderBy('r.shift', 'ASC')
      .addOrderBy('r.id', 'ASC');
    this.applyMonthlyReportFilters(qb, query);

    const reports = await qb.getMany();
    const groups: Record<
      string,
      { key: string; report_date: string; shift: string; reports: unknown[] }
    > = {};
    for (const r of reports) {
      const detail = await this.getReportDetail(r.id);
      if (!detail) continue;
      const filteredLines = this.filterMonthlyLines(detail.lines || [], query);
      if (!filteredLines.length) continue;
      const filteredDetail = { ...detail, lines: filteredLines };
      const key = `${detail.report_date}|${detail.shift}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          report_date: detail.report_date,
          shift: detail.shift,
          reports: [],
        };
      }
      groups[key].reports.push(filteredDetail);
    }
    return { groups: Object.values(groups) };
  }

  async exportMonthly(query: MonthlyQuery) {
    if (!query.stage_id || (!query.month && !query.date && !query.from && !query.to)) {
      throw new BadRequestException('Cần chọn Khâu và khoảng thời gian để xuất Excel');
    }
    const stage = await this.stages.findOne({ where: { id: Number(query.stage_id) } });
    if (!stage) throw new NotFoundException('Không tìm thấy khâu');

    const qb = this.reports
      .createQueryBuilder('r')
      .orderBy('r.report_date', 'ASC')
      .addOrderBy('r.shift', 'ASC')
      .addOrderBy('r.id', 'ASC');
    this.applyMonthlyReportFilters(qb, query);
    const reports = await qb.getMany();

    const details: {
      report_date: string;
      shift: string;
      created_by_name: string;
      lines: ExportableLine[];
    }[] = [];
    for (const r of reports) {
      const d = await this.getReportDetail(r.id);
      if (!d) continue;
      const filteredLines = this.filterMonthlyLines((d.lines || []) as ExportableLine[], query);
      if (!filteredLines.length) continue;
      details.push({
        report_date: d.report_date,
        shift: d.shift,
        created_by_name: d.created_by_name || '',
        lines: filteredLines,
      });
    }

    const buf = buildMonthlyWorkbook(stage.name, details);
    const safeName = stage.name.replace(/[^\w\-]+/g, '_');
    const rangeKey = query.date || (query.from && query.to ? `${query.from}_${query.to}` : query.month) || 'bao-cao';
    return {
      buf,
      filename: `bao-cao-${safeName}-${rangeKey}.xlsx`,
    };
  }

  async exportDaily(query: { month?: string; stage_id?: string; date?: string }) {
    if (!query.month && !query.date) {
      throw new BadRequestException('Cần chọn Tháng hoặc Ngày để xuất');
    }

    // Khi xuất theo ngày: lấy tháng từ ngày (tránh lệch tháng trên form)
    const dateKey = query.date ? String(query.date).slice(0, 10) : undefined;
    const monthKey = String(
      dateKey ? dateKey.slice(0, 7) : query.month || ''
    );
    if (!monthKey) {
      throw new BadRequestException('Cần chọn Tháng hoặc Ngày để xuất');
    }

    const qb = this.reports
      .createQueryBuilder('r')
      .orderBy('r.report_date', 'ASC')
      .addOrderBy('r.stage_id', 'ASC')
      .addOrderBy('r.shift', 'ASC')
      .addOrderBy('r.id', 'ASC');

    if (dateKey) {
      qb.where('r.report_date = :date', { date: dateKey });
    } else {
      qb.where(`to_char(r.report_date::date, 'YYYY-MM') = :month`, { month: monthKey });
    }
    if (query.stage_id) qb.andWhere('r.stage_id = :stageId', { stageId: Number(query.stage_id) });

    const reportIds = await qb.getMany();
    const lines: Parameters<typeof buildDailyWorkbook>[1] = [];
    const normRows = await this.norms.find();
    const normByStageAndProduct = new Map(
      normRows.map((norm) => [
        `${norm.stage_id}|${normalizedName(norm.product_name)}`,
        Number(norm.norm_value),
      ])
    );

    for (const r of reportIds) {
      const detail = await this.getReportDetail(r.id);
      if (!detail) continue;
      for (const line of detail.lines || []) {
        const products = [
          line.product_name,
          line.order2_product,
          line.order_product,
        ]
          .map((value) => String(value || '').trim())
          .filter((value, index, all) => value && all.indexOf(value) === index);
        let normValue: number | null = null;
        for (const product of products) {
          const found = normByStageAndProduct.get(
            `${detail.stage_id}|${normalizedName(product)}`
          );
          if (found !== undefined) {
            normValue = found;
            break;
          }
        }
        lines.push({
          stage_name: detail.stage_name as string,
          shift: detail.shift,
          report_date: detail.report_date,
          note: detail.note || '',
          order_code: line.order_code,
          product_name: line.product_name || line.order2_product,
          order_product: line.order_product,
          material_name: line.material_name,
          ton_dau: line.ton_dau,
          nhap: line.nhap,
          ton_cuoi: line.ton_cuoi,
          dat: line.dat,
          hong_sx: line.hong_sx,
          hong_khac: line.hong_khac,
          workers: line.workers,
          norm_value: normValue,
        });
      }
    }

    const fileKey = dateKey || monthKey;
    return {
      buf: buildDailyWorkbook(monthKey, lines),
      filename: `bao-cao-hang-ngay-${fileKey}.xlsx`,
    };
  }

  entryTemplateBuffer() {
    const rows = [
      [
        'Loại dòng (lenh/nvl)',
        'Mã lệnh',
        'Mã lệnh 2',
        'Loại NVL',
        'Tên sản phẩm',
        'Ngày nhập',
        'Tồn đầu',
        'Nhập',
        'Tồn cuối',
        'Đạt',
        'Hỏng SX',
        'Hỏng khác',
        'Nhân công (cách nhau ;)',
      ],
      [
        'lenh',
        'LSX001',
        '',
        '',
        'Hộp bia A',
        '2026-08-09',
        100,
        50,
        '',
        120,
        5,
        2,
        'Nguyễn Văn A;Trần Thị B',
      ],
      ['nvl', '', '', 'Giấy cuộn', '', '', 10, 5, 12, '', '', '', 'Nguyễn Văn A'],
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Mau nhap');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  async create(
    body: {
      stage_id?: number;
      shift?: string;
      report_date?: string;
      checklist_thiet_bi?: boolean;
      checklist_ve_sinh?: boolean;
      checklist_pccc?: boolean;
      note?: string;
      lines?: ReportLineInput[];
      handovers?: { handover_type: string; loai?: string; order_code?: string; quantity?: number }[];
    },
    userId: number
  ) {
    const {
      stage_id,
      shift,
      report_date,
      checklist_thiet_bi,
      checklist_ve_sinh,
      checklist_pccc,
      note,
      lines,
      handovers,
    } = body || {};
    if (!stage_id || !shift || !report_date) {
      throw new BadRequestException('Thiếu Khâu / Ca / Ngày');
    }
    const id = await this.dataSource.transaction(async (manager) => {
      const report = await manager.save(
        manager.create(ShiftReport, {
          stage_id,
          shift: shift as 'C1' | 'C2',
          report_date,
          checklist_thiet_bi: checklist_thiet_bi ? 1 : 0,
          checklist_ve_sinh: checklist_ve_sinh ? 1 : 0,
          checklist_pccc: checklist_pccc ? 1 : 0,
          note: note || null,
          created_by: userId,
        })
      );
      await this.savePayload(manager, report.id, lines || [], handovers || []);
      return report.id;
    });
    return this.getReportDetail(id);
  }

  async update(
    id: number,
    body: {
      stage_id?: number;
      shift?: string;
      report_date?: string;
      checklist_thiet_bi?: boolean;
      checklist_ve_sinh?: boolean;
      checklist_pccc?: boolean;
      note?: string;
      lines?: ReportLineInput[];
      handovers?: { handover_type: string; loai?: string; order_code?: string; quantity?: number }[];
    }
  ) {
    const existing = await this.reports.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy');

    await this.dataSource.transaction(async (manager) => {
      if (body.stage_id != null) existing.stage_id = body.stage_id;
      if (body.shift != null) existing.shift = body.shift as 'C1' | 'C2';
      if (body.report_date != null) existing.report_date = body.report_date;
      if (body.checklist_thiet_bi != null) {
        existing.checklist_thiet_bi = body.checklist_thiet_bi ? 1 : 0;
      }
      if (body.checklist_ve_sinh != null) {
        existing.checklist_ve_sinh = body.checklist_ve_sinh ? 1 : 0;
      }
      if (body.checklist_pccc != null) {
        existing.checklist_pccc = body.checklist_pccc ? 1 : 0;
      }
      if (body.note !== undefined) existing.note = body.note || null;
      await manager.save(existing);
      if (Array.isArray(body.lines)) {
        await this.savePayload(manager, id, body.lines, body.handovers || []);
      }
    });
    return this.getReportDetail(id);
  }

  async remove(id: number) {
    await this.reports.delete(id);
    return { ok: true };
  }

  async importExcel(base64?: string) {
    if (!base64) throw new BadRequestException('Thiếu file');
    try {
      const buf = Buffer.from(base64, 'base64');
      const wb = XLSX.read(buf, { type: 'buffer' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      const orders = await this.orders.find({ select: ['id', 'code'] });
      const orderMap = Object.fromEntries(orders.map((o) => [o.code, o.id]));
      const workersAll = await this.workers.find({ select: ['id', 'full_name'] });

      const lines = data.map((row) => {
        const typeRaw = String(
          row['Loại dòng (lenh/nvl)'] || row['line_type'] || 'lenh'
        ).toLowerCase();
        const line_type = typeRaw.includes('nvl') ? 'nvl' : 'lenh';
        const orderCode = String(row['Mã lệnh'] || '');
        const order2Code = String(row['Mã lệnh 2'] || '');
        const workerNames = String(row['Nhân công (cách nhau ;)'] || '')
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean);
        const workers = workerNames
          .map((name) => workersAll.find((w) => w.full_name === name))
          .filter(Boolean);
        return {
          line_type,
          order_id: orderMap[orderCode] || null,
          order2_id: orderMap[order2Code] || null,
          material_name: String(row['Loại NVL'] || '') || null,
          product_name: String(row['Tên sản phẩm'] || '') || null,
          entry_date: String(row['Ngày nhập'] || '') || null,
          ton_dau: Number(row['Tồn đầu'] || 0),
          nhap: Number(row['Nhập'] || 0),
          ton_cuoi: Number(row['Tồn cuối'] || 0),
          dat: Number(row['Đạt'] || 0),
          hong_sx: Number(row['Hỏng SX'] || 0),
          hong_khac: Number(row['Hỏng khác'] || 0),
          workers,
        };
      });
      return { lines };
    } catch (e: unknown) {
      throw new BadRequestException('Không đọc được file Excel: ' + (e as Error).message);
    }
  }
}
