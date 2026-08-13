import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { entities } from './entities';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { StagesModule } from './modules/stages/stages.module';
import { ProcessesModule } from './modules/processes/processes.module';
import { OrdersModule } from './modules/orders/orders.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { ProductsModule } from './modules/products/products.module';
import { UnitsModule } from './modules/units/units.module';
import { WorkersModule } from './modules/workers/workers.module';
import { NormsModule } from './modules/norms/norms.module';
import { ReportsModule } from './modules/reports/reports.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { StageWorkOrdersModule } from './modules/stage-work-orders/stage-work-orders.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SeedModule } from './seed/seed.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Ưu tiên TYPEORM_SYNCHRONIZE, fallback DATABASE_SYNC
        const syncRaw =
          config.get<string>('TYPEORM_SYNCHRONIZE') ?? config.get<string>('DATABASE_SYNC');
        const synchronize =
          syncRaw == null || syncRaw === ''
            ? true
            : ['1', 'true', 'yes', 'on'].includes(String(syncRaw).trim().toLowerCase());

        return {
          type: 'postgres' as const,
          host: config.get<string>('DATABASE_HOST') || 'localhost',
          port: Number(config.get<string>('DATABASE_PORT') || 5432),
          username: config.get<string>('DATABASE_USER') || 'pmkiemke',
          password: config.get<string>('DATABASE_PASSWORD') || 'pmkiemke',
          database: config.get<string>('DATABASE_NAME') || 'pmkiemke',
          entities,
          synchronize,
          logging: false,
        };
      },
    }),
    AuthModule,
    UsersModule,
    StagesModule,
    ProcessesModule,
    OrdersModule,
    MaterialsModule,
    ProductsModule,
    UnitsModule,
    WorkersModule,
    NormsModule,
    ReportsModule,
    TemplatesModule,
    StageWorkOrdersModule,
    DashboardModule,
    SeedModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
