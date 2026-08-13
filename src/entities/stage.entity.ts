import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('stages')
export class Stage {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', unique: true })
  name!: string;

  @Column({ type: 'varchar' })
  type!: 'main' | 'supply';

  @Column({ name: 'supply_mode', type: 'varchar', nullable: true })
  supply_mode!: 'tu_san_xuat' | 'mua_ngoai' | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sort_order!: number;

  /** Mã biểu mẫu lệnh: xa | song | in | kcs | boi | be */
  @Column({ name: 'form_code', type: 'varchar', nullable: true })
  form_code!: string | null;

  @Column({ type: 'int', default: 1 })
  active!: number;
}
