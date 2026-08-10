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

type WorkerPayload = {
  full_name?: string;
  code?: string;
  job_title?: string | null;
  active?: number;
  stage_ids?: number[];
};

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

  private async validatePayload(body: WorkerPayload, excludedId?: number) {
    const fullName = typeof body?.full_name === 'string' ? body.full_name.trim() : '';
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    const jobTitle =
      typeof body?.job_title === 'string' ? body.job_title.trim() || null : null;

    if (!fullName) throw new BadRequestException('Vui lòng nhập họ tên');
    if (!code) throw new BadRequestException('Vui lòng nhập mã công nhân');
    if (!Array.isArray(body?.stage_ids) || body.stage_ids.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất một khâu phụ trách');
    }

    const stageIds = [...new Set(body.stage_ids)];
    if (
      stageIds.length !== body.stage_ids.length ||
      stageIds.some((id) => !Number.isInteger(id) || id <= 0)
    ) {
      throw new BadRequestException('Danh sách khâu phụ trách không hợp lệ');
    }

    const stageCount = await this.stages.countBy({ id: In(stageIds) });
    if (stageCount !== stageIds.length) {
      throw new BadRequestException('Có khâu phụ trách không tồn tại');
    }

    const nameQuery = this.workers
      .createQueryBuilder('worker')
      .where('LOWER(TRIM(worker.full_name)) = LOWER(:fullName)', { fullName });
    const codeQuery = this.workers
      .createQueryBuilder('worker')
      .where('LOWER(TRIM(worker.code)) = LOWER(:code)', { code });
    if (excludedId != null) {
      nameQuery.andWhere('worker.id != :excludedId', { excludedId });
      codeQuery.andWhere('worker.id != :excludedId', { excludedId });
    }

    const [sameName, sameCode] = await Promise.all([nameQuery.getOne(), codeQuery.getOne()]);
    if (sameName) throw new BadRequestException('Họ tên công nhân đã tồn tại');
    if (sameCode) throw new BadRequestException('Mã công nhân đã tồn tại');

    return { fullName, code, jobTitle, stageIds };
  }

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
  async create(@Body() body: WorkerPayload) {
    const { fullName, code, jobTitle, stageIds } = await this.validatePayload(body);
    const id = await this.dataSource.transaction(async (manager) => {
      const w = await manager.save(
        manager.create(Worker, {
          full_name: fullName,
          code,
          job_title: jobTitle,
          active: 1,
        })
      );
      for (const sid of stageIds) {
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
    @Body() body: WorkerPayload
  ) {
    const id = Number(idParam);
    const { fullName, code, jobTitle, stageIds } = await this.validatePayload(body, id);
    await this.dataSource.transaction(async (manager) => {
      const w = await manager.findOne(Worker, { where: { id } });
      if (!w) throw new NotFoundException('Không tìm thấy');
      w.full_name = fullName;
      w.code = code;
      w.job_title = jobTitle;
      if (body.active != null) w.active = body.active;
      await manager.save(w);
      await manager.delete(StageWorker, { worker_id: id });
      for (const sid of stageIds) {
        await manager.save(
          manager.create(StageWorker, { stage_id: sid, worker_id: id })
        );
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
