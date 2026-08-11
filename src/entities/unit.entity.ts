import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('units')
@Unique(['name'])
export class Unit {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'int', default: 0 })
  sort_order!: number;
}
