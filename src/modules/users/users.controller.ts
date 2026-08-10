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
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser, Role } from '../../common/auth/auth.types';
import { User } from '../../entities';

const ROLES: Role[] = ['cong_nhan', 'quan_ly', 'giam_doc'];

function publicUser(row: User) {
  return {
    id: row.id,
    username: row.username,
    full_name: row.full_name,
    role: row.role,
    created_at: row.created_at,
  };
}

@ApiTags('users')
@ApiBearerAuth('JWT')
@Controller('api/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('quan_ly')
export class UsersController {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  @Get()
  async list() {
    const rows = await this.users.find({ order: { role: 'ASC', username: 'ASC' } });
    return rows.map(publicUser);
  }

  @Post()
  async create(
    @Body()
    body: { username?: string; password?: string; full_name?: string; role?: Role }
  ) {
    const { username, password, full_name, role } = body || {};
    if (!username || !password || !full_name || !role) {
      throw new BadRequestException('Thiếu tên đăng nhập / mật khẩu / họ tên / vai trò');
    }
    if (!ROLES.includes(role)) throw new BadRequestException('Vai trò không hợp lệ');
    if (String(password).length < 4) {
      throw new BadRequestException('Mật khẩu tối thiểu 4 ký tự');
    }
    try {
      const row = this.users.create({
        username: String(username).trim(),
        password_hash: bcrypt.hashSync(String(password), 10),
        full_name: String(full_name).trim(),
        role,
      });
      const saved = await this.users.save(row);
      return publicUser(saved);
    } catch (e: unknown) {
      const msg = (e as Error).message || '';
      if (msg.includes('unique') || msg.includes('UNIQUE') || msg.includes('duplicate')) {
        throw new BadRequestException('Tên đăng nhập đã tồn tại');
      }
      throw new BadRequestException(msg);
    }
  }

  @Put(':id')
  async update(
    @Param('id') idParam: string,
    @Body()
    body: { username?: string; password?: string; full_name?: string; role?: Role }
  ) {
    const id = Number(idParam);
    const existing = await this.users.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy tài khoản');

    const { username, password, full_name, role } = body || {};
    if (role != null && !ROLES.includes(role)) {
      throw new BadRequestException('Vai trò không hợp lệ');
    }
    if (password != null && String(password).length > 0 && String(password).length < 4) {
      throw new BadRequestException('Mật khẩu tối thiểu 4 ký tự');
    }

    try {
      if (username != null) existing.username = String(username).trim();
      if (full_name != null) existing.full_name = String(full_name).trim();
      if (role != null) existing.role = role;
      if (password != null && String(password).length > 0) {
        existing.password_hash = bcrypt.hashSync(String(password), 10);
      }
      const saved = await this.users.save(existing);
      return publicUser(saved);
    } catch (e: unknown) {
      const msg = (e as Error).message || '';
      if (msg.includes('unique') || msg.includes('UNIQUE') || msg.includes('duplicate')) {
        throw new BadRequestException('Tên đăng nhập đã tồn tại');
      }
      throw new BadRequestException(msg);
    }
  }

  @Delete(':id')
  async remove(@Param('id') idParam: string, @CurrentUser() user: AuthUser) {
    const id = Number(idParam);
    if (user.id === id) {
      throw new BadRequestException('Không thể xóa tài khoản đang đăng nhập');
    }
    const existing = await this.users.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy tài khoản');
    await this.users.delete(id);
    return { ok: true };
  }
}
