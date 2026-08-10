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
import { Material } from '../../entities';

@ApiTags('materials')
@ApiBearerAuth('JWT')
@Controller('api/materials')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaterialsController {
  constructor(@InjectRepository(Material) private readonly materials: Repository<Material>) {}

  @Get()
  async list(@Query('stage_id') stageId?: string) {
    const qb = this.materials
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.stage', 's')
      .orderBy('s.sort_order', 'ASC')
      .addOrderBy('m.name', 'ASC');
    if (stageId) qb.where('m.stage_id = :stageId', { stageId: Number(stageId) });
    const rows = await qb.getMany();
    return rows.map((m) => {
      const { stage, ...rest } = m;
      return { ...rest, stage_name: stage?.name };
    });
  }

  @Post()
  @Roles('quan_ly')
  async create(@Body() body: { stage_id?: number; name?: string; unit?: string }) {
    const { stage_id, name, unit } = body || {};
    if (!stage_id || !name) throw new BadRequestException('Thiếu khâu hoặc tên NVL');
    try {
      const row = this.materials.create({
        stage_id,
        name,
        unit: unit || 'tấm',
      });
      return await this.materials.save(row);
    } catch (e: unknown) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Put(':id')
  @Roles('quan_ly')
  async update(
    @Param('id') id: string,
    @Body() body: { stage_id?: number; name?: string; unit?: string }
  ) {
    const row = await this.materials.findOne({ where: { id: Number(id) } });
    if (!row) throw new NotFoundException('Không tìm thấy');
    if (body.stage_id != null) row.stage_id = body.stage_id;
    if (body.name != null) row.name = body.name;
    if (body.unit != null) row.unit = body.unit;
    return this.materials.save(row);
  }

  @Delete(':id')
  @Roles('quan_ly')
  async remove(@Param('id') id: string) {
    await this.materials.delete(Number(id));
    return { ok: true };
  }
}
