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
  defaultSongNormPayload,
  normalizeSongNormPayload,
} from '../../common/song-norm-calc';
import { Process, SongProductNorm, Stage } from '../../entities';

@ApiTags('song-product-norms')
@ApiBearerAuth('JWT')
@Controller('api/song-product-norms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SongProductNormsController {
  constructor(
    @InjectRepository(SongProductNorm) private readonly norms: Repository<SongProductNorm>,
    @InjectRepository(Process) private readonly processes: Repository<Process>,
    @InjectRepository(Stage) private readonly stages: Repository<Stage>
  ) {}

  private serialize(row: SongProductNorm) {
    const { process, stage, ...rest } = row;
    return {
      ...rest,
      process_name: process?.name,
      stage_name: stage?.name,
      payload: normalizeSongNormPayload(row.payload),
    };
  }

  private isSongStage(s: Stage) {
    return (
      s.form_code === 'song' ||
      s.name.trim().toLowerCase() === 'sóng' ||
      s.name.includes('Sóng')
    );
  }

  private async resolveSongStageId(): Promise<number | null> {
    const stages = await this.stages.find({ order: { sort_order: 'ASC', id: 'ASC' } });
    return stages.find((s) => this.isSongStage(s))?.id ?? null;
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
      const songId = await this.resolveSongStageId();
      if (songId != null && sid === songId) {
        // Bản ghi cũ chưa có stage_id coi như khâu Sóng
        qb.andWhere('(n.stage_id = :sid OR n.stage_id IS NULL)', { sid });
      } else {
        qb.andWhere('n.stage_id = :sid', { sid });
      }
    }
    const rows = await qb.getMany();
    const songId = await this.resolveSongStageId();
    const songStage = songId
      ? await this.stages.findOne({ where: { id: songId } })
      : null;
    return rows.map((row) => {
      const data = this.serialize(row);
      if (!data.stage_id && songStage) {
        return { ...data, stage_id: songStage.id, stage_name: songStage.name };
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
    if (!row) throw new NotFoundException('Không tìm thấy định mức sóng');
    const data = this.serialize(row);
    if (!data.stage_id) {
      const songId = await this.resolveSongStageId();
      if (songId) {
        const songStage = await this.stages.findOne({ where: { id: songId } });
        if (songStage) {
          return { ...data, stage_id: songStage.id, stage_name: songStage.name };
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
      song_type?: string;
      name?: string | null;
      payload?: Record<string, unknown>;
    }
  ) {
    const process_id = Number(body?.process_id);
    const song_type = body?.song_type?.trim();
    if (!process_id || !song_type) {
      throw new BadRequestException('Thiếu quy trình hoặc loại sóng');
    }
    const process = await this.processes.findOne({ where: { id: process_id } });
    if (!process) throw new BadRequestException('Quy trình không tồn tại');

    let stage_id = body.stage_id != null ? Number(body.stage_id) : null;
    if (!stage_id) stage_id = await this.resolveSongStageId();
    if (stage_id) {
      const stage = await this.stages.findOne({ where: { id: stage_id } });
      if (!stage) throw new BadRequestException('Khâu không tồn tại');
    }

    const row = this.norms.create({
      process_id,
      stage_id,
      song_type,
      name: body.name?.trim() || 'Hộp bia thường, xanh, Phú lâm',
      payload: normalizeSongNormPayload(body.payload ?? defaultSongNormPayload()),
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
      song_type?: string;
      name?: string | null;
      payload?: Record<string, unknown>;
    }
  ) {
    const row = await this.norms.findOne({ where: { id: Number(id) } });
    if (!row) throw new NotFoundException('Không tìm thấy định mức sóng');

    if (body.process_id != null) {
      const process = await this.processes.findOne({ where: { id: Number(body.process_id) } });
      if (!process) throw new BadRequestException('Quy trình không tồn tại');
      row.process_id = Number(body.process_id);
    }
    if (body.stage_id !== undefined) {
      if (body.stage_id == null || body.stage_id === 0) {
        row.stage_id = await this.resolveSongStageId();
      } else {
        const stage = await this.stages.findOne({ where: { id: Number(body.stage_id) } });
        if (!stage) throw new BadRequestException('Khâu không tồn tại');
        row.stage_id = Number(body.stage_id);
      }
    }
    if (body.song_type != null) {
      const song_type = body.song_type.trim();
      if (!song_type) throw new BadRequestException('Loại sóng không hợp lệ');
      row.song_type = song_type;
    }
    if (body.name !== undefined) row.name = body.name?.trim() || null;
    if (body.payload !== undefined) row.payload = normalizeSongNormPayload(body.payload);

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
