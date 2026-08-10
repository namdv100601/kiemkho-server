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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Process, ProcessStage, Stage } from '../../entities';

@ApiTags('processes')
@ApiBearerAuth('JWT')
@Controller('api/processes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProcessesController {
  constructor(
    @InjectRepository(Process) private readonly processes: Repository<Process>,
    @InjectRepository(ProcessStage) private readonly processStages: Repository<ProcessStage>,
    @InjectRepository(Stage) private readonly stages: Repository<Stage>,
    private readonly dataSource: DataSource
  ) {}

  private async getDetail(id: number) {
    const process = await this.processes.findOne({ where: { id } });
    if (!process) return null;
    const links = await this.processStages.find({
      where: { process_id: id },
      order: { sort_order: 'ASC' },
    });
    const stageIds = links.map((l) => l.stage_id);
    const stages =
      stageIds.length > 0
        ? await this.stages.find({ where: { id: In(stageIds) } })
        : [];
    const stageMap = Object.fromEntries(stages.map((s) => [s.id, s]));
    return {
      ...process,
      stages: links.map((l) => ({
        ...stageMap[l.stage_id],
        process_sort: l.sort_order,
      })),
    };
  }

  @Get()
  async list() {
    const rows = await this.processes.find({ order: { id: 'DESC' } });
    return Promise.all(rows.map((p) => this.getDetail(p.id)));
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    const row = await this.getDetail(Number(id));
    if (!row) throw new NotFoundException('Không tìm thấy');
    return row;
  }

  @Post()
  @Roles('quan_ly')
  async create(
    @Body() body: { name?: string; description?: string; stage_ids?: number[] }
  ) {
    const { name, description, stage_ids } = body || {};
    if (!name) throw new BadRequestException('Thiếu tên quy trình');
    try {
      const id = await this.dataSource.transaction(async (manager) => {
        const process = await manager.save(
          manager.create(Process, { name, description: description || null })
        );
        for (let i = 0; i < (stage_ids || []).length; i++) {
          await manager.save(
            manager.create(ProcessStage, {
              process_id: process.id,
              stage_id: stage_ids![i],
              sort_order: i + 1,
            })
          );
        }
        return process.id;
      });
      return this.getDetail(id);
    } catch (e: unknown) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Put(':id')
  @Roles('quan_ly')
  async update(
    @Param('id') idParam: string,
    @Body() body: { name?: string; description?: string; stage_ids?: number[] }
  ) {
    const id = Number(idParam);
    try {
      await this.dataSource.transaction(async (manager) => {
        const process = await manager.findOne(Process, { where: { id } });
        if (!process) throw new NotFoundException('Không tìm thấy');
        if (body.name != null) process.name = body.name;
        if (body.description != null) process.description = body.description;
        await manager.save(process);
        if (Array.isArray(body.stage_ids)) {
          await manager.delete(ProcessStage, { process_id: id });
          for (let i = 0; i < body.stage_ids.length; i++) {
            await manager.save(
              manager.create(ProcessStage, {
                process_id: id,
                stage_id: body.stage_ids[i],
                sort_order: i + 1,
              })
            );
          }
        }
      });
      const row = await this.getDetail(id);
      if (!row) throw new NotFoundException('Không tìm thấy');
      return row;
    } catch (e: unknown) {
      if (e instanceof NotFoundException) throw e;
      throw new BadRequestException((e as Error).message);
    }
  }

  @Delete(':id')
  @Roles('quan_ly')
  async remove(@Param('id') id: string) {
    await this.processes.delete(Number(id));
    return { ok: true };
  }
}
