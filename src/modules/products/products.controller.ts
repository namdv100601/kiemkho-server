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
import { Product } from '../../entities';

@ApiTags('products')
@ApiBearerAuth('JWT')
@Controller('api/products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(@InjectRepository(Product) private readonly products: Repository<Product>) {}

  @Get()
  async list(@Query('stage_id') stageId?: string) {
    const qb = this.products
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.stage', 's')
      .orderBy('s.sort_order', 'ASC')
      .addOrderBy('p.name', 'ASC');
    if (stageId) qb.where('p.stage_id = :stageId', { stageId: Number(stageId) });
    const rows = await qb.getMany();
    return rows.map((p) => {
      const { stage, ...rest } = p;
      return { ...rest, stage_name: stage?.name };
    });
  }

  @Post()
  @Roles('quan_ly')
  async create(@Body() body: { stage_id?: number; name?: string; unit?: string }) {
    const { stage_id, name, unit } = body || {};
    if (!stage_id || !name) throw new BadRequestException('Thiếu khâu hoặc tên sản phẩm');
    try {
      const row = this.products.create({
        stage_id,
        name: name.trim(),
        unit: unit?.trim() || null,
      });
      return await this.products.save(row);
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
    const row = await this.products.findOne({ where: { id: Number(id) } });
    if (!row) throw new NotFoundException('Không tìm thấy');
    if (body.stage_id != null) row.stage_id = body.stage_id;
    if (body.name != null) row.name = body.name.trim();
    if (body.unit != null) row.unit = body.unit.trim() || null;
    try {
      return await this.products.save(row);
    } catch (e: unknown) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Delete(':id')
  @Roles('quan_ly')
  async remove(@Param('id') id: string) {
    await this.products.delete(Number(id));
    return { ok: true };
  }
}
