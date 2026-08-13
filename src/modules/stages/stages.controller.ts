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
import { readFileSync } from 'fs';
import { join } from 'path';
import { Repository } from 'typeorm';
import { FORM_CODES, formCodeForStageName } from '../../common/stage-form-map';
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

  private formCatalog() {
    try {
      const manifestPath = join(process.cwd(), 'templates', 'stage-orders', 'manifest.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        stages: { code: string; name: string; title: string; source: string }[];
      };
      return manifest.stages;
    } catch {
      return [];
    }
  }

  private serialize(row: Stage) {
    const forms = this.formCatalog();
    const form = forms.find((f) => f.code === row.form_code) || null;
    return {
      ...row,
      form_title: form?.title ?? null,
      form_source: form?.source ?? null,
    };
  }

  private normalizeFormCode(value: unknown, stageName?: string): string | null {
    if (value === undefined) {
      return formCodeForStageName(stageName);
    }
    if (value === null || value === '') return null;
    const code = String(value).trim();
    if (!FORM_CODES.includes(code as (typeof FORM_CODES)[number])) {
      throw new BadRequestException('Mã biểu mẫu không hợp lệ');
    }
    return code;
  }

  @Get()
  async list() {
    const rows = await this.stages.find({ order: { sort_order: 'ASC', id: 'ASC' } });
    return rows.map((row) => this.serialize(row));
  }

  @Get('form-options')
  async formOptions() {
    return this.formCatalog();
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
      form_code?: string | null;
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
        form_code: this.normalizeFormCode(body.form_code, name),
        active: 1,
      });
      return this.serialize(await this.stages.save(row));
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
      form_code?: string | null;
    }
  ) {
    const row = await this.stages.findOne({ where: { id: Number(id) } });
    if (!row) throw new NotFoundException('Không tìm thấy');
    if (body.name != null) row.name = body.name;
    if (body.type != null) row.type = body.type;
    row.supply_mode = (body.supply_mode as Stage['supply_mode']) ?? null;
    if (body.sort_order != null) row.sort_order = body.sort_order;
    if (body.active != null) row.active = body.active;
    if (body.form_code !== undefined) {
      row.form_code = this.normalizeFormCode(body.form_code, row.name);
    } else if (!row.form_code) {
      row.form_code = formCodeForStageName(row.name);
    }
    return this.serialize(await this.stages.save(row));
  }

  @Delete(':id')
  @Roles('quan_ly')
  async remove(@Param('id') id: string) {
    await this.stages.delete(Number(id));
    return { ok: true };
  }
}
