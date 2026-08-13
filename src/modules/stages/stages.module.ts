import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { formCodeForStageName } from '../../common/stage-form-map';
import { Stage } from '../../entities';
import { StagesController } from './stages.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Stage])],
  controllers: [StagesController],
})
export class StagesModule implements OnModuleInit {
  private readonly logger = new Logger(StagesModule.name);

  constructor(@InjectRepository(Stage) private readonly stages: Repository<Stage>) {}

  async onModuleInit() {
    try {
      const rows = await this.stages.find({ where: { form_code: IsNull() } });
      let updated = 0;
      for (const row of rows) {
        const code = formCodeForStageName(row.name);
        if (!code) continue;
        row.form_code = code;
        await this.stages.save(row);
        updated += 1;
      }
      if (updated) this.logger.log(`Gắn biểu mẫu lệnh cho ${updated} khâu`);
    } catch (e) {
      this.logger.warn(`Không gắn được biểu mẫu lệnh: ${(e as Error).message}`);
    }
  }
}
