import { Logger, Module, type OnModuleInit } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Material, Product, Unit } from '../../entities';
import { UnitsController } from './units.controller';

export const DEFAULT_UNITS = ['tấm', 'kg', 'cái', 'tờ', 'cuộn', 'm', 'm2', 'thùng', 'bộ'];

@Module({
  imports: [TypeOrmModule.forFeature([Unit, Material, Product])],
  controllers: [UnitsController],
})
export class UnitsModule implements OnModuleInit {
  private readonly logger = new Logger(UnitsModule.name);

  constructor(
    @InjectRepository(Unit) private readonly units: Repository<Unit>,
    @InjectRepository(Material) private readonly materials: Repository<Material>
  ) {}

  async onModuleInit() {
    try {
      if ((await this.units.count()) > 0) return;
      const fromMaterials = await this.materials.find({
        where: { unit: Not('') },
        select: { unit: true },
      });
      const names = new Set<string>(DEFAULT_UNITS);
      for (const m of fromMaterials) if (m.unit?.trim()) names.add(m.unit.trim());
      await this.units.save(
        [...names].map((name, index) => this.units.create({ name, sort_order: index }))
      );
      this.logger.log(`Khởi tạo ${names.size} đơn vị tính mặc định`);
    } catch (e: unknown) {
      this.logger.warn(`Không khởi tạo được đơn vị tính mặc định: ${(e as Error).message}`);
    }
  }
}
