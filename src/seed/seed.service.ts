import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import {
  EntryTemplate,
  Handover,
  Material,
  Process,
  ProcessStage,
  Product,
  ProductionOrder,
  ShiftReport,
  ShiftReportLine,
  Stage,
  StageWorker,
  User,
  Worker,
} from '../entities';

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Stage) private readonly stages: Repository<Stage>,
    @InjectRepository(Process) private readonly processes: Repository<Process>,
    @InjectRepository(ProcessStage) private readonly processStages: Repository<ProcessStage>,
    @InjectRepository(Worker) private readonly workers: Repository<Worker>,
    @InjectRepository(StageWorker) private readonly stageWorkers: Repository<StageWorker>,
    @InjectRepository(Material) private readonly materials: Repository<Material>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(ProductionOrder) private readonly orders: Repository<ProductionOrder>,
    @InjectRepository(EntryTemplate) private readonly templates: Repository<EntryTemplate>,
    @InjectRepository(ShiftReport) private readonly reports: Repository<ShiftReport>,
    @InjectRepository(ShiftReportLine) private readonly lines: Repository<ShiftReportLine>,
    @InjectRepository(Handover) private readonly handovers: Repository<Handover>
  ) {}

  private async stageId(name: string) {
    const row = await this.stages.findOne({ where: { name } });
    if (!row) throw new Error(`Khâu không tồn tại: ${name}`);
    return row.id;
  }

  private async workerId(fullName: string) {
    const row = await this.workers.findOne({ where: { full_name: fullName } });
    if (!row) throw new Error(`Công nhân không tồn tại: ${fullName}`);
    return row.id;
  }

  private async userId(username: string) {
    const row = await this.users.findOne({ where: { username } });
    if (!row) throw new Error(`User không tồn tại: ${username}`);
    return row.id;
  }

  async run() {
    const hash = bcrypt.hashSync('123456', 10);
    const baseUsers: [string, string, User['role']][] = [
      ['congnhan', 'Công nhân mẫu', 'cong_nhan'],
      ['quanly', 'Quản lý mẫu', 'quan_ly'],
      ['giamdoc', 'Giám đốc mẫu', 'giam_doc'],
      ['thongke', 'Thống kê mẫu', 'thong_ke'],
    ];
    const stageUsers: [string, string][] = [
      ['in', 'Nhân viên khâu In'],
      ['kcs', 'Nhân viên khâu KCS'],
      ['boi', 'Nhân viên khâu Bồi'],
      ['be', 'Nhân viên khâu Bế'],
      ['xa', 'Nhân viên khâu Xả'],
      ['song', 'Nhân viên khâu Sóng'],
    ];

    for (const [username, full_name, role] of baseUsers) {
      const exists = await this.users.findOne({ where: { username } });
      if (!exists) {
        await this.users.save(
          this.users.create({ username, password_hash: hash, full_name, role })
        );
      }
    }
    for (const [username, full_name] of stageUsers) {
      const exists = await this.users.findOne({ where: { username } });
      if (!exists) {
        await this.users.save(
          this.users.create({
            username,
            password_hash: hash,
            full_name,
            role: 'cong_nhan',
          })
        );
      }
    }
    this.logger.log(
      'Users ready: congnhan, quanly, giamdoc, thongke, in, kcs, boi, be, xa, song (password: 123456)'
    );

    if ((await this.stages.count()) === 0) {
      const defaults: Partial<Stage>[] = [
        { name: 'In', type: 'main', supply_mode: null, sort_order: 1, form_code: 'in' },
        { name: 'KCS', type: 'main', supply_mode: null, sort_order: 2, form_code: 'kcs' },
        { name: 'Bồi', type: 'main', supply_mode: null, sort_order: 3, form_code: 'boi' },
        { name: 'Bế', type: 'main', supply_mode: null, sort_order: 4, form_code: 'be' },
        {
          name: 'Xả',
          type: 'supply',
          supply_mode: 'tu_san_xuat',
          sort_order: 10,
          form_code: 'xa',
        },
        {
          name: 'Sóng',
          type: 'supply',
          supply_mode: 'tu_san_xuat',
          sort_order: 11,
          form_code: 'song',
        },
      ];
      await this.stages.save(defaults.map((d) => this.stages.create(d)));
      this.logger.log('Seeded default stages');
    }

    if ((await this.processes.count()) === 0) {
      const process = await this.processes.save(
        this.processes.create({
          name: 'Quản lý sản xuất hộp bia',
          description: 'Quy trình mặc định',
        })
      );
      const stageOrder = ['In', 'KCS', 'Bồi', 'Bế', 'Xả', 'Sóng'];
      for (let i = 0; i < stageOrder.length; i++) {
        await this.processStages.save(
          this.processStages.create({
            process_id: process.id,
            stage_id: await this.stageId(stageOrder[i]),
            sort_order: i + 1,
          })
        );
      }
      this.logger.log('Seeded default process');
    }

    if ((await this.workers.count()) === 0) {
      const names: [string, string][] = [
        ['Nguyễn Văn A', 'CN001'],
        ['Trần Thị B', 'CN002'],
        ['Lê Văn C', 'CN003'],
        ['Phạm Thị D', 'CN004'],
        ['Hoàng Văn E', 'CN005'],
        ['Lộc 1', 'CN006'],
        ['Lộc 2', 'CN007'],
      ];
      for (const [full_name, code] of names) {
        await this.workers.save(this.workers.create({ full_name, code, active: 1 }));
      }
      const links: [string, string[]][] = [
        ['In', ['Nguyễn Văn A', 'Trần Thị B', 'Lê Văn C', 'Hoàng Văn E']],
        ['KCS', ['Nguyễn Văn A', 'Trần Thị B', 'Phạm Thị D']],
        ['Bồi', ['Nguyễn Văn A', 'Trần Thị B', 'Phạm Thị D']],
        ['Bế', ['Nguyễn Văn A', 'Trần Thị B', 'Lê Văn C', 'Hoàng Văn E']],
        ['Xả', ['Nguyễn Văn A', 'Trần Thị B', 'Phạm Thị D', 'Lộc 1', 'Lộc 2']],
        ['Sóng', ['Nguyễn Văn A', 'Trần Thị B', 'Lê Văn C', 'Hoàng Văn E']],
      ];
      for (const [stageName, workerNames] of links) {
        const sid = await this.stageId(stageName);
        for (const wn of workerNames) {
          await this.stageWorkers.save(
            this.stageWorkers.create({
              stage_id: sid,
              worker_id: await this.workerId(wn),
            })
          );
        }
      }
      this.logger.log('Seeded workers');
    }

    if ((await this.materials.count()) === 0) {
      const mats: [string, string, string][] = [
        ['In', 'Mực in', 'kg'],
        ['In', 'Giấy in', 'tấm'],
        ['KCS', 'NVL KCS 1', 'tấm'],
        ['KCS', 'NVL KCS 2', 'tấm'],
        ['Bồi', 'NVL Bồi 1', 'tấm'],
        ['Bồi', 'NVL Bồi 2', 'tấm'],
        ['Bế', 'NVL Bế 1', 'tấm'],
        ['Bế', 'NVL Bế 2', 'tấm'],
        ['Xả', 'Giấy cuộn', 'kg'],
        ['Xả', 'Giấy tấm', 'tấm'],
        ['Sóng', 'Giấy mặt', 'kg'],
        ['Sóng', 'Giấy sóng', 'kg'],
      ];
      for (const [stageName, name, unit] of mats) {
        await this.materials.save(
          this.materials.create({
            stage_id: await this.stageId(stageName),
            name,
            unit,
          })
        );
      }
      this.logger.log('Seeded materials');
    }

    if ((await this.products.count()) === 0) {
      const items: [string | null, string, string][] = [
        [null, 'Hop bia', 'cái'],
        [null, 'Hop bia A', 'cái'],
        ['Bế', 'Duplex 230/825', 'tấm'],
      ];
      for (const [stageName, name, unit] of items) {
        await this.products.save(
          this.products.create({
            stage_id: stageName ? await this.stageId(stageName) : null,
            name,
            unit,
          })
        );
      }
      this.logger.log('Seeded products');
    }

    if ((await this.orders.count()) === 0) {
      const process = await this.processes.find({ order: { id: 'ASC' }, take: 1 });
      const processId = process[0].id;
      const entryDate = todayLocal();

      const createWithChildren = async (code: string, product_name: string) => {
        const parent = await this.orders.save(
          this.orders.create({
            code,
            process_id: processId,
            product_name,
            quantity: 1000,
            entry_date: entryDate,
            parent_id: null,
            stage_id: null,
            status: 'active',
          })
        );
        for (const stageName of ['Xả', 'Sóng']) {
          await this.orders.save(
            this.orders.create({
              code: `${code}-${stageName}`,
              process_id: processId,
              product_name,
              quantity: 1000,
              entry_date: entryDate,
              parent_id: parent.id,
              parent_ids: [parent.id],
              stage_id: await this.stageId(stageName),
              supply_type: 'nhap_lenh',
              supplier_name: null,
              status: 'active',
            })
          );
        }
      };

      await createWithChildren('LSX-TEST-01', 'Hop bia A');
      await createWithChildren('LSX-01', 'Hop bia');
      this.logger.log('Seeded production orders: LSX-TEST-01, LSX-01 (+ lệnh phụ Xả/Sóng)');
    }

    if ((await this.templates.count()) === 0) {
      const payload = {
        lines: [
          {
            line_type: 'lenh',
            order_id: null,
            order2_id: null,
            order_code: 'LSX-01',
            order2_code: '',
            material_id: null,
            material_name: 'Vật liệu 1',
            product_name: 'Hop bia',
            entry_date: todayLocal(),
            ton_dau: 0,
            nhap: 100,
            ton_cuoi: 20,
            dat: 200,
            hong_sx: 2,
            hong_khac: 0,
            workers: [
              { id: await this.workerId('Lộc 1'), full_name: 'Lộc 1' },
              { id: await this.workerId('Lộc 2'), full_name: 'Lộc 2' },
              { id: await this.workerId('Nguyễn Văn A'), full_name: 'Nguyễn Văn A' },
            ],
          },
        ],
        handovers: [
          { handover_type: 'next_stage', loai: 'Vật liệu 1', order_code: 'LSX-01', quantity: 200 },
          { handover_type: 'next_shift', loai: '', order_code: '', quantity: 0 },
        ],
        checklist_thiet_bi: true,
        checklist_ve_sinh: true,
        checklist_pccc: true,
        note: 'Oke',
      };
      await this.templates.save(
        this.templates.create({
          name: 'Khâu xả 1',
          stage_id: await this.stageId('Xả'),
          shift: 'C1',
          payload_json: payload,
          created_by: await this.userId('congnhan'),
        })
      );
      this.logger.log('Seeded entry template: Khâu xả 1');
    }

    if ((await this.reports.count()) === 0) {
      const reportDate = todayLocal();
      const order = await this.orders.findOne({ where: { code: 'LSX-01' } });
      const giayCuon = await this.materials.findOne({
        where: { stage_id: await this.stageId('Xả'), name: 'Giấy cuộn' },
      });

      const report = await this.reports.save(
        this.reports.create({
          stage_id: await this.stageId('Xả'),
          shift: 'C1',
          report_date: reportDate,
          checklist_thiet_bi: 1,
          checklist_ve_sinh: 1,
          checklist_pccc: 1,
          note: 'Oke',
          created_by: await this.userId('xa'),
        })
      );

      await this.lines.save(
        this.lines.create({
          report_id: report.id,
          line_type: 'lenh',
          order_id: order?.id ?? null,
          order2_id: null,
          material_id: null,
          material_name: 'Vật liệu 1',
          product_name: 'Hop bia',
          entry_date: reportDate,
          ton_dau: 0,
          nhap: 100,
          ton_cuoi: 20,
          dat: 200,
          hong_sx: 2,
          hong_khac: 0,
          workers_json: [
            { id: await this.workerId('Lộc 1'), full_name: 'Lộc 1' },
            { id: await this.workerId('Lộc 2'), full_name: 'Lộc 2' },
            { id: await this.workerId('Nguyễn Văn A'), full_name: 'Nguyễn Văn A' },
          ],
          sort_order: 0,
          order_code_text: 'LSX-01',
          order2_code_text: null,
        })
      );

      await this.lines.save(
        this.lines.create({
          report_id: report.id,
          line_type: 'nvl',
          order_id: null,
          order2_id: null,
          material_id: giayCuon!.id,
          material_name: 'Giấy cuộn',
          product_name: null,
          entry_date: reportDate,
          ton_dau: 0,
          nhap: 100,
          ton_cuoi: 0,
          dat: 0,
          hong_sx: 0,
          hong_khac: 0,
          workers_json: [
            { id: await this.workerId('Nguyễn Văn A'), full_name: 'Nguyễn Văn A' },
            { id: await this.workerId('Phạm Thị D'), full_name: 'Phạm Thị D' },
          ],
          sort_order: 1,
          order_code_text: null,
          order2_code_text: null,
        })
      );

      await this.handovers.save([
        this.handovers.create({
          report_id: report.id,
          handover_type: 'next_stage',
          loai: 'Vật liệu 1',
          order_code: 'LSX-01',
          quantity: 200,
        }),
        this.handovers.create({
          report_id: report.id,
          handover_type: 'next_shift',
          loai: null,
          order_code: null,
          quantity: 0,
        }),
      ]);

      this.logger.log(`Seeded 1 sample shift report: Xả / C1 / ${reportDate}`);
    }

    this.logger.log('Seed complete.');
  }
}
