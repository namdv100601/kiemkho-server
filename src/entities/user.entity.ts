import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Role } from '../common/auth/auth.types';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', unique: true })
  username!: string;

  @Column({ name: 'password_hash', type: 'varchar' })
  password_hash!: string;

  @Column({ name: 'full_name', type: 'varchar' })
  full_name!: string;

  @Column({ type: 'varchar' })
  role!: Role;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;
}
