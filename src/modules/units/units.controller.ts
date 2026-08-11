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
import { Material, Product, Unit } from '../../entities';

@ApiTags('units')
@ApiBearerAuth('JWT')
@Controller('api/units')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UnitsController {
  constructor(
    @InjectRepository(Unit) private readonly units: Repository<Unit>,
    @InjectRepository(Material) private readonly materials: Repository<Material>,
    @InjectRepository(Product) private readonly products: Repository<Product>
  ) {}

  @Get()
  async list() {
    return this.units.find({ order: { sort_order: 'ASC', name: 'ASC' } });
  }

  @Post()
  @Roles('quan_ly')
  async create(@Body() body: { name?: string; sort_order?: number }) {
    const name = body?.name?.trim();
    if (!name) throw new BadRequestException('Thiếu tên đơn vị');
    const exists = await this.units.findOne({ where: { name } });
    if (exists) throw new BadRequestException('Đơn vị đã tồn tại');
    return this.units.save(this.units.create({ name, sort_order: body.sort_order ?? 0 }));
  }

  @Put(':id')
  @Roles('quan_ly')
  async update(@Param('id') id: string, @Body() body: { name?: string; sort_order?: number }) {
    const row = await this.units.findOne({ where: { id: Number(id) } });
    if (!row) throw new NotFoundException('Không tìm thấy');
    const oldName = row.name;
    if (body.name != null) {
      const name = body.name.trim();
      if (!name) throw new BadRequestException('Thiếu tên đơn vị');
      const other = await this.units.findOne({ where: { name } });
      if (other && other.id !== row.id) throw new BadRequestException('Đơn vị đã tồn tại');
      row.name = name;
    }
    if (body.sort_order != null) row.sort_order = body.sort_order;
    const saved = await this.units.save(row);
    // Đơn vị được lưu dạng text ở NVL / sản phẩm nên phải đổi tên theo
    if (saved.name !== oldName) {
      await this.materials.update({ unit: oldName }, { unit: saved.name });
      await this.products.update({ unit: oldName }, { unit: saved.name });
    }
    return saved;
  }

  @Delete(':id')
  @Roles('quan_ly')
  async remove(@Param('id') id: string) {
    const row = await this.units.findOne({ where: { id: Number(id) } });
    if (!row) return { ok: true };
    const used =
      (await this.materials.count({ where: { unit: row.name } })) +
      (await this.products.count({ where: { unit: row.name } }));
    if (used > 0)
      throw new BadRequestException(
        `Đơn vị "${row.name}" đang được dùng ở ${used} dòng NVL/sản phẩm`
      );
    await this.units.delete(row.id);
    return { ok: true };
  }
}
