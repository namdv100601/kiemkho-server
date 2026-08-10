import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json } from 'express';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.use(json({ limit: '15mb' }));
  app.useGlobalFilters(new ApiExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Nhà máy – Thống kê / Kế hoạch sản xuất (server2)')
    .setDescription(
      'API NestJS v2: danh mục, nhập liệu ca, mẫu nhập, báo cáo và xuất/nhập Excel. Dùng Bearer JWT sau khi login.'
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'JWT'
    )
    .addTag('auth')
    .addTag('users')
    .addTag('stages')
    .addTag('processes')
    .addTag('orders')
    .addTag('materials')
    .addTag('workers')
    .addTag('norms')
    .addTag('reports')
    .addTag('templates')
    .addTag('dashboard')
    .addTag('health')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  console.log(`server2 (NestJS) listening on http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/api/docs`);
}

bootstrap();
