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
import { Norm } from '../../entities';

@ApiTags('norms')
@ApiBearerAuth('JWT')
@Controller('api/norms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NormsController {
  constructor(@InjectRepository(Norm) private readonly norms: Repository<Norm>) {}

  @Get()
  async list(@Query('stage_id') stageId?: string) {
    const qb = this.norms
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.stage', 's')
      .orderBy('s.sort_order', 'ASC')
      .addOrderBy('n.product_name', 'ASC');
    if (stageId) qb.where('n.stage_id = :stageId', { stageId: Number(stageId) });
    const rows = await qb.getMany();
    return rows.map((n) => {
      const { stage, ...rest } = n;
      return { ...rest, stage_name: stage?.name };
    });
  }

  @Post()
  @Roles('quan_ly')
  async create(
    @Body()
    body: {
      stage_id?: number;
      product_name?: string;
      norm_value?: number;
      unit?: string;
      note?: string;
    }
  ) {
    const { stage_id, product_name, norm_value, unit, note } = body || {};
    if (!stage_id || !product_name) {
      throw new BadRequestException('Thiếu thông tin định mức');
    }
    const row = this.norms.create({
      stage_id,
      product_name,
      norm_value: norm_value ?? 0,
      unit: unit || 'SP/h',
      note: note || null,
    });
    return this.norms.save(row);
  }

  @Put(':id')
  @Roles('quan_ly')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      stage_id?: number;
      product_name?: string;
      norm_value?: number;
      unit?: string;
      note?: string;
    }
  ) {
    const row = await this.norms.findOne({ where: { id: Number(id) } });
    if (!row) throw new NotFoundException('Không tìm thấy');
    if (body.stage_id != null) row.stage_id = body.stage_id;
    if (body.product_name != null) row.product_name = body.product_name;
    if (body.norm_value != null) row.norm_value = body.norm_value;
    if (body.unit != null) row.unit = body.unit;
    if (body.note != null) row.note = body.note;
    return this.norms.save(row);
  }

  @Delete(':id')
  @Roles('quan_ly')
  async remove(@Param('id') id: string) {
    await this.norms.delete(Number(id));
    return { ok: true };
  }
}
