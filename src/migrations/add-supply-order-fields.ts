import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const dataSource = app.get(DataSource);
    await dataSource.query(
      'ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS supply_type varchar'
    );
    await dataSource.query(
      'ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS supplier_name varchar'
    );
    await dataSource.query(
      "UPDATE production_orders SET supply_type = 'nhap_lenh' WHERE parent_id IS NOT NULL AND supply_type IS NULL"
    );
    await dataSource.query(
      'ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS parent_ids int[]'
    );
    await dataSource.query(`
      UPDATE production_orders
      SET parent_ids = ARRAY[parent_id]
      WHERE parent_id IS NOT NULL
        AND (parent_ids IS NULL OR cardinality(parent_ids) = 0)
    `);
    console.log('Supply order fields migration completed');
  } finally {
    await app.close();
  }
}

run().catch((error: unknown) => {
  console.error('Supply order fields migration failed', error);
  process.exitCode = 1;
});
