import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/auth.types';

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Đăng nhập, trả JWT' })
  async login(@Body() body: { username?: string; password?: string }) {
    const { username, password } = body || {};
    if (!username || !password) {
      throw new BadRequestException('Thiếu tên đăng nhập hoặc mật khẩu');
    }
    return this.auth.login(username, password);
  }

  @Get('me')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Thông tin user hiện tại' })
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }
}
