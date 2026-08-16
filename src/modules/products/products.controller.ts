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
import { IsNull, Repository } from 'typeorm';
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

  private serialize(p: Product) {
    const { stage, ...rest } = p;
    return {
      ...rest,
      stage_name: stage?.name ?? null,
    };
  }

  private parseStageId(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const stageId = Number(value);
    if (!Number.isInteger(stageId) || stageId <= 0) {
      throw new BadRequestException('Khâu không hợp lệ');
    }
    return stageId;
  }

  private normalizeCode(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    const code = String(value).trim();
    return code || null;
  }

  private async assertUniqueName(name: string, stageId: number | null, excludeId?: number) {
    const existing = await this.products.findOne({
      where: stageId == null ? { name, stage_id: IsNull() } : { name, stage_id: stageId },
    });
    if (existing && existing.id !== excludeId) {
      throw new BadRequestException(
        stageId == null
          ? 'Sản phẩm (toàn bộ khâu) đã tồn tại'
          : 'Sản phẩm đã tồn tại trong khâu này'
      );
    }
  }

  @Get()
  async list(@Query('stage_id') stageId?: string) {
    const qb = this.products
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.stage', 's')
      .orderBy('s.sort_order', 'ASC')
      .addOrderBy('p.name', 'ASC');
    if (stageId) {
      qb.where('p.stage_id = :stageId OR p.stage_id IS NULL', { stageId: Number(stageId) });
    }
    const rows = await qb.getMany();
    return rows.map((p) => this.serialize(p));
  }

  @Post()
  @Roles('quan_ly')
  async create(
    @Body() body: { stage_id?: number | null; code?: string; name?: string; unit?: string }
  ) {
    const name = body?.name?.trim();
    if (!name) throw new BadRequestException('Thiếu tên sản phẩm');
    const stageId = this.parseStageId(body?.stage_id);
    await this.assertUniqueName(name, stageId);
    try {
      const row = await this.products.save(
        this.products.create({
          stage_id: stageId,
          code: this.normalizeCode(body?.code),
          name,
          unit: body.unit?.trim() || null,
        })
      );
      const full = await this.products.findOne({
        where: { id: row.id },
        relations: { stage: true },
      });
      return this.serialize(full!);
    } catch (e: unknown) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Put(':id')
  @Roles('quan_ly')
  async update(
    @Param('id') id: string,
    @Body() body: { stage_id?: number | null; code?: string; name?: string; unit?: string }
  ) {
    const row = await this.products.findOne({ where: { id: Number(id) } });
    if (!row) throw new NotFoundException('Không tìm thấy');

    if (body.stage_id !== undefined) row.stage_id = this.parseStageId(body.stage_id);
    if (body.code !== undefined) row.code = this.normalizeCode(body.code);
    if (body.name != null) {
      const name = body.name.trim();
      if (!name) throw new BadRequestException('Thiếu tên sản phẩm');
      row.name = name;
    }
    if (body.unit != null) row.unit = body.unit.trim() || null;

    await this.assertUniqueName(row.name, row.stage_id, row.id);

    try {
      await this.products.save(row);
      const full = await this.products.findOne({
        where: { id: row.id },
        relations: { stage: true },
      });
      return this.serialize(full!);
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
