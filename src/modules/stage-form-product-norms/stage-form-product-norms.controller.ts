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
  defaultPayloadFor,
  normalizeStageFormNormPayload,
  STAGE_FORM_LABELS,
  type StageFormCode,
} from '../../common/stage-form-norm-calc';
import { Process, Stage, StageFormProductNorm } from '../../entities';

const FORM_CODES: StageFormCode[] = ['in', 'kcs', 'boi', 'be'];

function isFormCode(v: string): v is StageFormCode {
  return (FORM_CODES as string[]).includes(v);
}

@ApiTags('stage-form-product-norms')
@ApiBearerAuth('JWT')
@Controller('api/stage-form-product-norms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StageFormProductNormsController {
  constructor(
    @InjectRepository(StageFormProductNorm)
    private readonly norms: Repository<StageFormProductNorm>,
    @InjectRepository(Process) private readonly processes: Repository<Process>,
    @InjectRepository(Stage) private readonly stages: Repository<Stage>
  ) {}

  private serialize(row: StageFormProductNorm) {
    const { process, stage, ...rest } = row;
    const code = (isFormCode(row.form_code) ? row.form_code : 'in') as StageFormCode;
    return {
      ...rest,
      process_name: process?.name,
      stage_name: stage?.name,
      form_label: STAGE_FORM_LABELS[code],
      payload: normalizeStageFormNormPayload(code, row.payload),
    };
  }

  private matchFormStage(s: Stage, code: StageFormCode) {
    if ((s.form_code || '').toLowerCase() === code) return true;
    const n = s.name.trim().toLowerCase();
    if (code === 'in') return n === 'in';
    if (code === 'kcs') return n === 'kcs';
    if (code === 'boi') return n === 'bồi' || n === 'boi';
    return n === 'bế' || n === 'be';
  }

  private async resolveStageId(code: StageFormCode): Promise<number | null> {
    const stages = await this.stages.find({ order: { sort_order: 'ASC', id: 'ASC' } });
    return stages.find((s) => this.matchFormStage(s, code))?.id ?? null;
  }

  @Get()
  async list(
    @Query('form_code') formCode?: string,
    @Query('process_id') processId?: string,
    @Query('stage_id') stageId?: string
  ) {
    if (!formCode || !isFormCode(formCode)) {
      throw new BadRequestException('Cần form_code: in | kcs | boi | be');
    }
    const qb = this.norms
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.process', 'p')
      .leftJoinAndSelect('n.stage', 's')
      .where('n.form_code = :formCode', { formCode })
      .orderBy('n.id', 'DESC');
    if (processId != null && processId !== '') {
      qb.andWhere('n.process_id = :processId', { processId: Number(processId) });
    }
    if (stageId != null && stageId !== '') {
      const sid = Number(stageId);
      const resolved = await this.resolveStageId(formCode);
      if (resolved != null && sid === resolved) {
        qb.andWhere('(n.stage_id = :sid OR n.stage_id IS NULL)', { sid });
      } else {
        qb.andWhere('n.stage_id = :sid', { sid });
      }
    }
    const rows = await qb.getMany();
    const resolvedId = await this.resolveStageId(formCode);
    const resolvedStage = resolvedId
      ? await this.stages.findOne({ where: { id: resolvedId } })
      : null;
    return rows.map((row) => {
      const data = this.serialize(row);
      if (!data.stage_id && resolvedStage) {
        return { ...data, stage_id: resolvedStage.id, stage_name: resolvedStage.name };
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
    if (!row) throw new NotFoundException('Không tìm thấy định mức');
    return this.serialize(row);
  }

  @Post()
  @Roles('quan_ly')
  async create(
    @Body()
    body: {
      process_id?: number;
      stage_id?: number | null;
      form_code?: string;
      name?: string;
      payload?: Record<string, unknown>;
    }
  ) {
    const formCode = body.form_code || '';
    if (!isFormCode(formCode)) {
      throw new BadRequestException('form_code phải là in | kcs | boi | be');
    }
    if (!body.process_id) throw new BadRequestException('Thiếu process_id');
    const process = await this.processes.findOne({ where: { id: Number(body.process_id) } });
    if (!process) throw new BadRequestException('Quy trình không hợp lệ');
    const name = String(body.name || '').trim();
    if (!name) throw new BadRequestException('Thiếu tên mẫu');

    let stageId =
      body.stage_id != null && body.stage_id !== ('' as unknown as number)
        ? Number(body.stage_id)
        : await this.resolveStageId(formCode);
    if (stageId != null) {
      const st = await this.stages.findOne({ where: { id: stageId } });
      if (!st) throw new BadRequestException('Khâu không hợp lệ');
    }

    const row = this.norms.create({
      process_id: process.id,
      stage_id: stageId,
      form_code: formCode,
      name,
      payload: normalizeStageFormNormPayload(
        formCode,
        body.payload ?? defaultPayloadFor(formCode)
      ) as unknown as Record<string, unknown>,
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
    if (!row) throw new NotFoundException('Không tìm thấy định mức');
    const code = (isFormCode(row.form_code) ? row.form_code : 'in') as StageFormCode;

    if (body.process_id != null) {
      const process = await this.processes.findOne({ where: { id: Number(body.process_id) } });
      if (!process) throw new BadRequestException('Quy trình không hợp lệ');
      row.process_id = process.id;
    }
    if (body.stage_id !== undefined) {
      if (body.stage_id == null) row.stage_id = null;
      else {
        const st = await this.stages.findOne({ where: { id: Number(body.stage_id) } });
        if (!st) throw new BadRequestException('Khâu không hợp lệ');
        row.stage_id = st.id;
      }
    }
    if (body.name != null) {
      const name = String(body.name).trim();
      if (!name) throw new BadRequestException('Thiếu tên mẫu');
      row.name = name;
    }
    if (body.payload !== undefined) {
      row.payload = normalizeStageFormNormPayload(code, body.payload) as unknown as Record<
        string,
        unknown
      >;
    }
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
