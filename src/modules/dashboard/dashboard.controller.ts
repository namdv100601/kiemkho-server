import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Process, ProductionOrder, ShiftReport, Stage } from '../../entities';

@ApiTags('dashboard')
@ApiBearerAuth('JWT')
@Controller('api/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('quan_ly', 'giam_doc')
export class DashboardController {
  constructor(
    @InjectRepository(Stage) private readonly stages: Repository<Stage>,
    @InjectRepository(Process) private readonly processes: Repository<Process>,
    @InjectRepository(ProductionOrder) private readonly orders: Repository<ProductionOrder>,
    @InjectRepository(ShiftReport) private readonly reports: Repository<ShiftReport>
  ) {}

  @Get('stats')
  async stats(@Query('date') dateQuery?: string) {
    const date = String(dateQuery || new Date().toISOString().slice(0, 10));

    const counts = {
      stages: await this.stages.count({ where: { active: 1 } }),
      processes: await this.processes.count(),
      orders: await this.orders
        .createQueryBuilder('o')
        .where('o.parent_id IS NULL')
        .getCount(),
      reports_today: await this.reports.count({ where: { report_date: date } }),
    };

    const stages = await this.stages.find({
      where: { active: 1 },
      order: { sort_order: 'ASC', id: 'ASC' },
      select: ['id', 'name'],
    });

    const byStage = await this.reports
      .createQueryBuilder('r')
      .leftJoin('r.lines', 'l')
      .select('r.stage_id', 'stage_id')
      .addSelect('COALESCE(SUM(l.dat), 0)', 'dat')
      .addSelect('COALESCE(SUM(l.hong_sx + l.hong_khac), 0)', 'hong')
      .where('r.report_date = :date', { date })
      .groupBy('r.stage_id')
      .getRawMany<{ stage_id: number; dat: string; hong: string }>();

    const map = Object.fromEntries(byStage.map((r) => [Number(r.stage_id), r]));

    const chart = stages.map((s) => ({
      stage_id: s.id,
      stage_name: s.name,
      dat: Number(map[s.id]?.dat || 0),
      hong: Number(map[s.id]?.hong || 0),
    }));

    const totals = chart.reduce(
      (acc, row) => {
        acc.dat += row.dat;
        acc.hong += row.hong;
        return acc;
      },
      { dat: 0, hong: 0 }
    );

    return { date, counts, chart, totals };
  }
}
