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
import { In, IsNull, Repository } from 'typeorm';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { ProductionOrder, Stage } from '../../entities';

@ApiTags('orders')
@ApiBearerAuth('JWT')
@Controller('api/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(
    @InjectRepository(ProductionOrder) private readonly orders: Repository<ProductionOrder>,
    @InjectRepository(Stage) private readonly stages: Repository<Stage>
  ) {}

  private normalizeParentIds(row: Pick<ProductionOrder, 'parent_id' | 'parent_ids'>) {
    if (row.parent_ids?.length) {
      return Array.from(new Set(row.parent_ids.filter((id) => Number.isInteger(id))));
    }
    return row.parent_id != null ? [row.parent_id] : [];
  }

  private async parentCodes(parentIds: number[]) {
    if (!parentIds.length) return [] as string[];
    const parents = await this.orders.find({ where: { id: In(parentIds) } });
    const byId = new Map(parents.map((parent) => [parent.id, parent.code]));
    return parentIds.map((id) => byId.get(id)).filter((code): code is string => Boolean(code));
  }

  private async serializeOrder(row: ProductionOrder) {
    const { process, stage, ...rest } = row;
    const parent_ids = this.normalizeParentIds(row);
    return {
      ...rest,
      parent_ids,
      parent_codes: await this.parentCodes(parent_ids),
      process_name: process?.name,
      stage_name: stage?.name ?? null,
    };
  }

  private async getOrder(id: number) {
    const row = await this.orders
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.process', 'p')
      .leftJoinAndSelect('o.stage', 's')
      .where('o.id = :id', { id })
      .getOne();
    if (!row) return null;
    return this.serializeOrder(row);
  }

  @Get()
  async list(
    @Query('parent_only') parentOnly?: string,
    @Query('supply_only') supplyOnly?: string,
    @Query('parent_id') parentId?: string,
    @Query('status') status?: string
  ) {
    const qb = this.orders
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.process', 'p')
      .leftJoinAndSelect('o.stage', 's')
      .orderBy('o.id', 'DESC');
    if (parentOnly === '1') qb.andWhere('o.parent_id IS NULL');
    if (supplyOnly === '1') qb.andWhere('o.parent_id IS NOT NULL');
    if (parentId != null && parentId !== '') {
      const parsedParentId = Number(parentId);
      if (!Number.isInteger(parsedParentId)) {
        throw new BadRequestException('Lệnh sản xuất không hợp lệ');
      }
      qb.andWhere('(o.parent_id = :parentId OR :parentId = ANY(o.parent_ids))', {
        parentId: parsedParentId,
      });
    }
    if (status != null && status !== '') {
      if (!['active', 'inactive'].includes(status)) {
        throw new BadRequestException('Trạng thái không hợp lệ');
      }
      qb.andWhere('o.status = :status', { status });
    }
    const rows = await qb.getMany();
    return Promise.all(rows.map((row) => this.serializeOrder(row)));
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    const row = await this.getOrder(Number(id));
    if (!row) throw new NotFoundException('Không tìm thấy');
    const children = await this.orders
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.stage', 's')
      .where('(o.parent_id = :id OR :id = ANY(o.parent_ids))', { id: Number(id) })
      .getMany();
    return {
      ...row,
      children: await Promise.all(children.map((child) => this.serializeOrder(child))),
    };
  }

  @Post()
  @Roles('quan_ly')
  async create(
    @Body()
    body: {
      code?: string;
      process_id?: number;
      product_name?: string;
      quantity?: number;
      entry_date?: string;
    }
  ) {
    const { code, process_id, product_name, quantity, entry_date } = body || {};
    if (!code || !process_id || !product_name || !entry_date) {
      throw new BadRequestException('Thiếu thông tin lệnh sản xuất');
    }
    try {
      const parent = await this.orders.save(
        this.orders.create({
          code: code.trim(),
          process_id,
          product_name: product_name.trim(),
          quantity: quantity ?? 0,
          entry_date,
          parent_id: null,
          parent_ids: null,
          stage_id: null,
          supply_type: null,
          supplier_name: null,
          status: 'active',
        })
      );
      return { ...(await this.getOrder(parent.id)), children: [] };
    } catch (e: unknown) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Post('supply')
  @Roles('quan_ly')
  async createSupply(
    @Body()
    body: {
      code?: string;
      parent_id?: number;
      parent_ids?: number[];
      stage_id?: number;
      product_name?: string;
      quantity?: number;
      entry_date?: string;
      supply_type?: 'nhap_lenh' | 'mua_ngoai';
      supplier_name?: string;
    }
  ) {
    const {
      code,
      parent_id,
      parent_ids: rawParentIds,
      stage_id,
      product_name,
      quantity,
      entry_date,
      supply_type = 'nhap_lenh',
      supplier_name,
    } = body || {};
    const parentIds = Array.from(
      new Set(
        (rawParentIds?.length ? rawParentIds : parent_id != null ? [parent_id] : [])
          .map(Number)
          .filter((id) => Number.isInteger(id) && id > 0)
      )
    );
    if (!code || !parentIds.length || !stage_id || !product_name || !entry_date) {
      throw new BadRequestException('Thiếu thông tin lệnh cung cấp');
    }
    if (!['nhap_lenh', 'mua_ngoai'].includes(supply_type)) {
      throw new BadRequestException('Loại lệnh cung cấp không hợp lệ');
    }
    if (supply_type === 'mua_ngoai' && !supplier_name?.trim()) {
      throw new BadRequestException('Nhà cung cấp là bắt buộc khi mua ngoài');
    }

    const [parents, stage] = await Promise.all([
      this.orders.find({ where: { id: In(parentIds), parent_id: IsNull() } }),
      this.stages.findOne({ where: { id: stage_id } }),
    ]);
    if (parents.length !== parentIds.length) {
      throw new BadRequestException('Một hoặc nhiều lệnh sản xuất không tồn tại');
    }
    if (!stage || stage.type !== 'supply' || stage.active !== 1) {
      throw new BadRequestException('Khâu cung cấp không hợp lệ');
    }

    const primaryParent =
      parents.find((parent) => parent.id === parentIds[0]) || parents[0];

    try {
      const row = await this.orders.save(
        this.orders.create({
          code: code.trim(),
          process_id: primaryParent.process_id,
          product_name: product_name.trim(),
          quantity: quantity ?? 0,
          entry_date,
          parent_id: primaryParent.id,
          parent_ids: parentIds,
          stage_id: stage.id,
          supply_type,
          supplier_name: supply_type === 'mua_ngoai' ? supplier_name!.trim() : null,
          status: 'active',
        })
      );
      return this.getOrder(row.id);
    } catch (e: unknown) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Put(':id')
  @Roles('quan_ly')
  async update(
    @Param('id') idParam: string,
    @Body()
    body: {
      code?: string;
      process_id?: number;
      product_name?: string;
      quantity?: number;
      entry_date?: string;
      status?: 'active' | 'inactive';
      parent_id?: number;
      parent_ids?: number[];
      stage_id?: number;
      supply_type?: 'nhap_lenh' | 'mua_ngoai';
      supplier_name?: string | null;
    }
  ) {
    const id = Number(idParam);
    const row = await this.orders.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Không tìm thấy');
    const isSupply = row.parent_id != null;

    if (body.code != null) row.code = body.code.trim();
    if (body.product_name != null) row.product_name = body.product_name.trim();
    if (body.quantity != null) row.quantity = body.quantity;
    if (body.entry_date != null) row.entry_date = body.entry_date;
    if (body.status != null) {
      if (!['active', 'inactive'].includes(body.status)) {
        throw new BadRequestException('Trạng thái không hợp lệ');
      }
      row.status = body.status;
    }

    if (!isSupply) {
      if (body.process_id != null) row.process_id = body.process_id;
    } else {
      const parentIds = Array.from(
        new Set(
          (body.parent_ids?.length
            ? body.parent_ids
            : body.parent_id != null
              ? [body.parent_id]
              : this.normalizeParentIds(row)
          )
            .map(Number)
            .filter((parentId) => Number.isInteger(parentId) && parentId > 0)
        )
      );
      if (!parentIds.length) {
        throw new BadRequestException('Chọn ít nhất một lệnh sản xuất');
      }

      const parents = await this.orders.find({
        where: { id: In(parentIds), parent_id: IsNull() },
      });
      if (parents.length !== parentIds.length) {
        throw new BadRequestException('Một hoặc nhiều lệnh sản xuất không tồn tại');
      }

      const stageId = body.stage_id ?? row.stage_id;
      if (stageId == null) throw new BadRequestException('Khâu cung cấp không hợp lệ');
      const stage = await this.stages.findOne({ where: { id: stageId } });
      if (!stage || stage.type !== 'supply' || stage.active !== 1) {
        throw new BadRequestException('Khâu cung cấp không hợp lệ');
      }

      const supplyType = body.supply_type ?? row.supply_type ?? 'nhap_lenh';
      if (!['nhap_lenh', 'mua_ngoai'].includes(supplyType)) {
        throw new BadRequestException('Loại lệnh cung cấp không hợp lệ');
      }
      const supplierName =
        body.supplier_name !== undefined
          ? body.supplier_name?.trim() || null
          : row.supplier_name;
      if (supplyType === 'mua_ngoai' && !supplierName) {
        throw new BadRequestException('Nhà cung cấp là bắt buộc khi mua ngoài');
      }

      const primaryParent =
        parents.find((parent) => parent.id === parentIds[0]) || parents[0];
      row.parent_id = primaryParent.id;
      row.parent_ids = parentIds;
      row.process_id = primaryParent.process_id;
      row.stage_id = stage.id;
      row.supply_type = supplyType;
      row.supplier_name = supplyType === 'mua_ngoai' ? supplierName : null;
    }

    await this.orders.save(row);
    return this.getOrder(id);
  }

  @Delete(':id')
  @Roles('quan_ly')
  async remove(@Param('id') id: string) {
    await this.orders.delete(Number(id));
    return { ok: true };
  }
}
