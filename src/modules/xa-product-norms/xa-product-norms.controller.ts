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
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import {
  defaultXaNormPayload,
  normalizeXaNormPayload,
} from '../../common/xa-norm-calc';
import { Process, Stage, XaProductNorm } from '../../entities';

@ApiTags('xa-product-norms')
@ApiBearerAuth('JWT')
@Controller('api/xa-product-norms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class XaProductNormsController {
  constructor(
    @InjectRepository(XaProductNorm) private readonly norms: Repository<XaProductNorm>,
    @InjectRepository(Process) private readonly processes: Repository<Process>,
    @InjectRepository(Stage) private readonly stages: Repository<Stage>
  ) {}

  private serialize(row: XaProductNorm) {
    const { process, stage, ...rest } = row;
    return {
      ...rest,
      process_name: process?.name,
      stage_name: stage?.name,
      payload: normalizeXaNormPayload(row.payload),
    };
  }

  private isXaStage(s: Stage) {
    return (
      s.form_code === 'xa' ||
      s.name.trim().toLowerCase() === 'xả' ||
      s.name.includes('Xả')
    );
  }

  private async resolveXaStageId(): Promise<number | null> {
    const stages = await this.stages.find({ order: { sort_order: 'ASC', id: 'ASC' } });
    return stages.find((s) => this.isXaStage(s))?.id ?? null;
  }

  @Get()
  async list(
    @Query('process_id') processId?: string,
    @Query('stage_id') stageId?: string
  ) {
    const qb = this.norms
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.process', 'p')
      .leftJoinAndSelect('n.stage', 's')
      .orderBy('n.id', 'DESC');
    if (processId != null && processId !== '') {
      qb.andWhere('n.process_id = :processId', { processId: Number(processId) });
    }
    if (stageId != null && stageId !== '') {
      const sid = Number(stageId);
      const xaId = await this.resolveXaStageId();
      if (xaId != null && sid === xaId) {
        qb.andWhere('(n.stage_id = :sid OR n.stage_id IS NULL)', { sid });
      } else {
        qb.andWhere('n.stage_id = :sid', { sid });
      }
    }
    const rows = await qb.getMany();
    const xaId = await this.resolveXaStageId();
    const xaStage = xaId ? await this.stages.findOne({ where: { id: xaId } }) : null;
    return rows.map((row) => {
      const data = this.serialize(row);
      if (!data.stage_id && xaStage) {
        return { ...data, stage_id: xaStage.id, stage_name: xaStage.name };
      }
      return data;
    });
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    const row = await this.norms
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.process', 'p')
      .leftJoinAndSelect('n.stage', 's')
      .where('n.id = :id', { id: Number(id) })
      .getOne();
    if (!row) throw new NotFoundException('Không tìm thấy định mức xả');
    const data = this.serialize(row);
    if (!data.stage_id) {
      const xaId = await this.resolveXaStageId();
      if (xaId) {
        const xaStage = await this.stages.findOne({ where: { id: xaId } });
        if (xaStage) {
          return { ...data, stage_id: xaStage.id, stage_name: xaStage.name };
        }
      }
    }
    return data;
  }

  @Post()
  @Roles('quan_ly')
  async create(
    @Body()
    body: {
      process_id?: number;
      stage_id?: number | null;
      name?: string;
      payload?: Record<string, unknown>;
    }
  ) {
    const process_id = Number(body?.process_id);
    const name = body?.name?.trim();
    if (!process_id || !name) {
      throw new BadRequestException('Thiếu quy trình hoặc tên mẫu');
    }
    const process = await this.processes.findOne({ where: { id: process_id } });
    if (!process) throw new BadRequestException('Quy trình không tồn tại');

    let stage_id = body.stage_id != null ? Number(body.stage_id) : null;
    if (!stage_id) stage_id = await this.resolveXaStageId();
    if (stage_id) {
      const stage = await this.stages.findOne({ where: { id: stage_id } });
      if (!stage) throw new BadRequestException('Khâu không tồn tại');
    }

    const row = this.norms.create({
      process_id,
      stage_id,
      name,
      payload: normalizeXaNormPayload(body.payload ?? defaultXaNormPayload()),
    });
    const saved = await this.norms.save(row);
    return this.one(String(saved.id));
  }

  @Put(':id')
  @Roles('quan_ly')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      process_id?: number;
      stage_id?: number | null;
      name?: string;
      payload?: Record<string, unknown>;
    }
  ) {
    const row = await this.norms.findOne({ where: { id: Number(id) } });
    if (!row) throw new NotFoundException('Không tìm thấy định mức xả');

    if (body.process_id != null) {
      const process = await this.processes.findOne({ where: { id: Number(body.process_id) } });
      if (!process) throw new BadRequestException('Quy trình không tồn tại');
      row.process_id = Number(body.process_id);
    }
    if (body.stage_id !== undefined) {
      if (body.stage_id == null || body.stage_id === 0) {
        row.stage_id = await this.resolveXaStageId();
      } else {
        const stage = await this.stages.findOne({ where: { id: Number(body.stage_id) } });
        if (!stage) throw new BadRequestException('Khâu không tồn tại');
        row.stage_id = Number(body.stage_id);
      }
    }
    if (body.name != null) {
      const name = body.name.trim();
      if (!name) throw new BadRequestException('Tên mẫu không hợp lệ');
      row.name = name;
    }
    if (body.payload !== undefined) row.payload = normalizeXaNormPayload(body.payload);

    await this.norms.save(row);
    return this.one(id);
  }

  @Delete(':id')
  @Roles('quan_ly')
  async remove(@Param('id') id: string) {
    await this.norms.delete(Number(id));
    return { ok: true };
  }
}
