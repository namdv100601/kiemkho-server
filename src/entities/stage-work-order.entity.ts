import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Lệnh theo biểu mẫu khâu (Xả, Sóng, In, KCS, Bồi, Bế). Hiện UI dùng trước cho Xả. */
@Entity('stage_work_orders')
export class StageWorkOrder {
  @PrimaryGeneratedColumn()
  id!: number;

  /** xa | song | in | kcs | boi | be */
  @Column({ name: 'stage_code', type: 'varchar' })
  stage_code!: string;

  /** 1. Tên sản phẩm */
  @Column({ name: 'ten_san_pham', type: 'varchar' })
  ten_san_pham!: string;

  /** 2. Kích thước xả */
  @Column({ name: 'kich_thuoc_xa', type: 'varchar', nullable: true })
  kich_thuoc_xa!: string | null;

  /** 3. Định lượng xuất */
  @Column({ name: 'dinh_luong_xuat', type: 'varchar', nullable: true })
  dinh_luong_xuat!: string | null;

  /** 4. Khối lượng */
  @Column({ name: 'khoi_luong', type: 'varchar', nullable: true })
  khoi_luong!: string | null;

  /** 5. Số lệnh */
  @Column({ name: 'so_lenh', type: 'varchar' })
  so_lenh!: string;

  /** 6. Ngày đưa lệnh (YYYY-MM-DD) */
  @Column({ name: 'ngay_dua_lenh', type: 'varchar' })
  ngay_dua_lenh!: string;

  /** 7. Ngày hoàn thành */
  @Column({ name: 'ngay_hoan_thanh', type: 'varchar', nullable: true })
  ngay_hoan_thanh!: string | null;

  /** 8. Ghi chú */
  @Column({ name: 'ghi_chu', type: 'text', nullable: true })
  ghi_chu!: string | null;

  @Column({ name: 'nguoi_lap', type: 'varchar', nullable: true })
  nguoi_lap!: string | null;

  @Column({ name: 'giam_doc', type: 'varchar', nullable: true })
  giam_doc!: string | null;

  /**
   * Dữ liệu riêng theo loại lệnh (JSON).
   * Lệnh Sóng: so_luong_yeu_cau, ngay_du_kien_sx, kraf_*, thông số KT, vat_tu_lines.
   */
  @Column({ type: 'jsonb', nullable: true })
  payload!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at!: Date;
}
