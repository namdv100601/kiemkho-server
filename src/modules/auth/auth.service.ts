import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from '../../entities';
import type { AuthUser } from '../../common/auth/auth.types';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService
  ) {}

  async login(username: string, password: string) {
    if (!username || !password) {
      throw new BadRequestException('Thiếu tên đăng nhập hoặc mật khẩu');
    }
    const user = await this.users.findOne({ where: { username } });
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      throw new UnauthorizedException('Sai tên đăng nhập hoặc mật khẩu');
    }
    const payload: AuthUser = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    };
    return { token: this.jwt.sign(payload), user: payload };
  }
}
