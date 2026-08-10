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
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/auth.types';
import { EntryTemplate } from '../../entities';

@ApiTags('templates')
@ApiBearerAuth('JWT')
@Controller('api/templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TemplatesController {
  constructor(
    @InjectRepository(EntryTemplate) private readonly templates: Repository<EntryTemplate>
  ) {}

  private mapRow(row: EntryTemplate & { stage?: { name: string } }) {
    const { stage, payload_json, creator, ...rest } = row as EntryTemplate & {
      stage?: { name: string };
      creator?: unknown;
    };
    return {
      ...rest,
      stage_name: stage?.name,
      payload: payload_json || {},
    };
  }

  @Get()
  async list(@Query('stage_id') stageId?: string) {
    const qb = this.templates
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.stage', 's')
      .orderBy('t.created_at', 'DESC');
    if (stageId) qb.where('t.stage_id = :stageId', { stageId: Number(stageId) });
    const rows = await qb.getMany();
    return rows.map((r) => this.mapRow(r));
  }

  @Post()
  @Roles('cong_nhan', 'quan_ly')
  async create(
    @Body()
    body: { name?: string; stage_id?: number; shift?: string; payload?: Record<string, unknown> },
    @CurrentUser() user: AuthUser
  ) {
    const { name, stage_id, shift, payload } = body || {};
    if (!name || !stage_id || !payload) {
      throw new BadRequestException('Thiếu tên mẫu / khâu / dữ liệu');
    }
    const row = this.templates.create({
      name,
      stage_id,
      shift: shift || null,
      payload_json: payload,
      created_by: user.id,
    });
    const saved = await this.templates.save(row);
    return this.mapRow(saved);
  }

  @Put(':id')
  @Roles('cong_nhan', 'quan_ly')
  async update(@Param('id') id: string, @Body() body: { name?: string }) {
    const { name } = body || {};
    if (!name || !String(name).trim()) {
      throw new BadRequestException('Thiếu tên mẫu');
    }
    const row = await this.templates.findOne({
      where: { id: Number(id) },
      relations: ['stage'],
    });
    if (!row) throw new NotFoundException('Không tìm thấy mẫu');
    row.name = String(name).trim();
    const saved = await this.templates.save(row);
    return this.mapRow(saved);
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    const row = await this.templates.findOne({
      where: { id: Number(id) },
      relations: ['stage'],
    });
    if (!row) throw new NotFoundException('Không tìm thấy mẫu');
    return this.mapRow(row);
  }

  @Delete(':id')
  @Roles('cong_nhan', 'quan_ly')
  async remove(@Param('id') id: string) {
    await this.templates.delete(Number(id));
    return { ok: true };
  }
}
