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
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Stage } from '../../entities';

@ApiTags('stages')
@ApiBearerAuth('JWT')
@Controller('api/stages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StagesController {
  constructor(@InjectRepository(Stage) private readonly stages: Repository<Stage>) {}

  @Get()
  async list() {
    return this.stages.find({ order: { sort_order: 'ASC', id: 'ASC' } });
  }

  @Post()
  @Roles('quan_ly')
  async create(
    @Body()
    body: {
      name?: string;
      type?: 'main' | 'supply';
      supply_mode?: string | null;
      sort_order?: number;
    }
  ) {
    const { name, type, supply_mode, sort_order } = body || {};
    if (!name || !type) throw new BadRequestException('Thiếu tên hoặc loại khâu');
    try {
      const row = this.stages.create({
        name,
        type,
        supply_mode: (supply_mode as Stage['supply_mode']) || null,
        sort_order: sort_order ?? 0,
        active: 1,
      });
      return await this.stages.save(row);
    } catch (e: unknown) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Put(':id')
  @Roles('quan_ly')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      type?: 'main' | 'supply';
      supply_mode?: string | null;
      sort_order?: number;
      active?: number;
    }
  ) {
    const row = await this.stages.findOne({ where: { id: Number(id) } });
    if (!row) throw new NotFoundException('Không tìm thấy');
    if (body.name != null) row.name = body.name;
    if (body.type != null) row.type = body.type;
    row.supply_mode = (body.supply_mode as Stage['supply_mode']) ?? null;
    if (body.sort_order != null) row.sort_order = body.sort_order;
    if (body.active != null) row.active = body.active;
    return this.stages.save(row);
  }

  @Delete(':id')
  @Roles('quan_ly')
  async remove(@Param('id') id: string) {
    await this.stages.delete(Number(id));
    return { ok: true };
  }
}
