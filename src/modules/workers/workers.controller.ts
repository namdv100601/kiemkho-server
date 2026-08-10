import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Stage, StageWorker, Worker } from '../../entities';

@ApiTags('workers')
@ApiBearerAuth('JWT')
@Controller('api/workers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkersController {
  constructor(
    @InjectRepository(Worker) private readonly workers: Repository<Worker>,
    @InjectRepository(StageWorker) private readonly stageWorkers: Repository<StageWorker>,
    @InjectRepository(Stage) private readonly stages: Repository<Stage>,
    private readonly dataSource: DataSource
  ) {}

  private async getWorker(id: number) {
    const w = await this.workers.findOne({ where: { id } });
    if (!w) return null;
    const links = await this.stageWorkers.find({ where: { worker_id: id } });
    const stageIds = links.map((l) => l.stage_id);
    const stages =
      stageIds.length > 0
        ? await this.stages.find({
            where: { id: In(stageIds) },
            order: { sort_order: 'ASC' },
          })
        : [];
    return { ...w, stages, stage_ids: stages.map((s) => s.id) };
  }

  @Get()
  async list(@Query('stage_id') stageId?: string) {
    if (stageId) {
      return this.workers
        .createQueryBuilder('w')
        .innerJoin(StageWorker, 'sw', 'sw.worker_id = w.id')
        .where('sw.stage_id = :stageId', { stageId: Number(stageId) })
        .andWhere('w.active = 1')
        .orderBy('w.full_name', 'ASC')
        .getMany();
    }
    const rows = await this.workers.find({ order: { full_name: 'ASC' } });
    return Promise.all(rows.map((w) => this.getWorker(w.id)));
  }

  @Post()
  @Roles('quan_ly')
  async create(
    @Body() body: { full_name?: string; code?: string; stage_ids?: number[] }
  ) {
    const { full_name, code, stage_ids } = body || {};
    if (!full_name) throw new BadRequestException('Thiếu họ tên');
    const id = await this.dataSource.transaction(async (manager) => {
      const w = await manager.save(
        manager.create(Worker, {
          full_name,
          code: code || null,
          active: 1,
        })
      );
      for (const sid of stage_ids || []) {
        await manager.save(
          manager.create(StageWorker, { stage_id: sid, worker_id: w.id })
        );
      }
      return w.id;
    });
    return this.getWorker(id);
  }

  @Put(':id')
  @Roles('quan_ly')
  async update(
    @Param('id') idParam: string,
    @Body()
    body: { full_name?: string; code?: string; active?: number; stage_ids?: number[] }
  ) {
    const id = Number(idParam);
    await this.dataSource.transaction(async (manager) => {
      const w = await manager.findOne(Worker, { where: { id } });
      if (!w) throw new NotFoundException('Không tìm thấy');
      if (body.full_name != null) w.full_name = body.full_name;
      if (body.code != null) w.code = body.code;
      if (body.active != null) w.active = body.active;
      await manager.save(w);
      if (Array.isArray(body.stage_ids)) {
        await manager.delete(StageWorker, { worker_id: id });
        for (const sid of body.stage_ids) {
          await manager.save(
            manager.create(StageWorker, { stage_id: sid, worker_id: id })
          );
        }
      }
    });
    const row = await this.getWorker(id);
    if (!row) throw new NotFoundException('Không tìm thấy');
    return row;
  }

  @Delete(':id')
  @Roles('quan_ly')
  async remove(@Param('id') id: string) {
    await this.workers.delete(Number(id));
    return { ok: true };
  }
}
