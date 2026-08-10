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
      'ALTER TABLE workers ADD COLUMN IF NOT EXISTS job_title varchar'
    );
    console.log('Worker job_title migration completed');
  } finally {
    await app.close();
  }
}

run().catch((error: unknown) => {
  console.error('Worker job_title migration failed', error);
  process.exitCode = 1;
});
