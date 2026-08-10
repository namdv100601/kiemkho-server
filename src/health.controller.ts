import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('api')
export class HealthController {
  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  health() {
    return { ok: true };
  }
}
