/** Công thức định mức / lệnh Xả theo Excel mẫu + yêu cầu đối tác. */

export type XaKetQuaLine = {
  ngay_san_xuat: string;
  ngay_nhap: string;
  kiem_tra_ngoai_quan: string;
  dinh_luong_dau_vao: string;
  khoi_luong_tren_qua: string;
  khoi_luong_can_lai: string;
  rach_san_xuat: string;
  rach_truoc: string;
  vo_loi: string;
  thanh_pham_thuc_te: string;
  dinh_luong_kiem_tra: string;
  nguoi_xa: string;
};

/**
 * Payload định mức Xả — map mục Excel/Word:
 * 1 tên SP (ở entity.name)
 * 1.1 nha_cung_cap
 * 2 kich_thuoc_xa
 * 3 dinh_luong_xuat
 * 6–7 so_qua_default + trong_luong_qua → khối lượng
 * 8 so_luong_tuong_ung (Tờ) — có thể để trống, auto theo công thức Sheet1
 * 10 ghi_chu_default
 */
export type XaNormPayload = {
  nha_cung_cap: string;
  kich_thuoc_xa: string;
  dinh_luong_xuat: string;
  trong_luong_qua: number;
  so_qua_default: number;
  /** Ghi chú mặc định mục 10, vd: xả hết quả */
  ghi_chu_default: string;
  /**
   * Hệ số tính tờ (Sheet1: tờ ≈ KL / (ĐL_kg × KT1_m × KT2_m)).
   * Có thể override; mặc định parse từ kích thước + định lượng.
   */
  kt1_m: number;
  kt2_m: number;
  dinh_luong_kg: number;
};

export function defaultXaNormPayload(): XaNormPayload {
  return {
    nha_cung_cap: 'hanchang',
    kich_thuoc_xa: '940X595 mm',
    dinh_luong_xuat: '230gms',
    trong_luong_qua: 951,
    so_qua_default: 8,
    ghi_chu_default: 'xả hết quả',
    kt1_m: 0.94,
    kt2_m: 0.595,
    dinh_luong_kg: 0.23,
  };
}

export function emptyKetQuaLine(): XaKetQuaLine {
  return {
    ngay_san_xuat: '',
    ngay_nhap: '',
    kiem_tra_ngoai_quan: '',
    dinh_luong_dau_vao: '',
    khoi_luong_tren_qua: '',
    khoi_luong_can_lai: '',
    rach_san_xuat: '',
    rach_truoc: '',
    vo_loi: '',
    thanh_pham_thuc_te: '',
    dinh_luong_kiem_tra: '',
    nguoi_xa: '',
  };
}

export function roundKg(n: number, digits = 3): number {
  if (!Number.isFinite(n)) return 0;
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

/** Mục 6: khối lượng (Kg) = số quả × trọng lượng / quả */
export function khoiLuongKg(soQua: number, trongLuongQua: number): number {
  return roundKg(soQua * trongLuongQua);
}

/** Parse "940X595 mm" / "940*595" → [mm1, mm2] */
export function parseKichThuocMm(text: string): [number, number] | null {
  const m = String(text || '').match(/(\d+(?:[.,]\d+)?)\s*[xX×*]\s*(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const a = Number(m[1].replace(',', '.'));
  const b = Number(m[2].replace(',', '.'));
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null;
  return [a, b];
}

/** Parse "230gms" / "230" → gms */
export function parseDinhLuongGms(text: string): number | null {
  const m = String(text || '').match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Cập nhật kt1_m, kt2_m, dinh_luong_kg từ chuỗi KT / ĐL (Excel Sheet1). */
export function dimsFromLabels(
  kichThuocXa: string,
  dinhLuongXuat: string
): Pick<XaNormPayload, 'kt1_m' | 'kt2_m' | 'dinh_luong_kg'> {
  const base = defaultXaNormPayload();
  const mm = parseKichThuocMm(kichThuocXa);
  const gms = parseDinhLuongGms(dinhLuongXuat);
  return {
    kt1_m: mm ? roundKg(mm[0] / 1000, 6) : base.kt1_m,
    kt2_m: mm ? roundKg(mm[1] / 1000, 6) : base.kt2_m,
    dinh_luong_kg: gms ? roundKg(gms / 1000, 6) : base.dinh_luong_kg,
  };
}

/**
 * Mục 8: số lượng tương ứng (Tờ)
 * Sheet1: tờ = khối_lượng_kg / (định_lượng_kg × kt1_m × kt2_m)
 */
export function soLuongTuongUngTo(
  khoiLuong: number,
  kt1M: number,
  kt2M: number,
  dinhLuongKg: number
): number {
  const den = dinhLuongKg * kt1M * kt2M;
  if (!Number.isFinite(khoiLuong) || !Number.isFinite(den) || den <= 0) return 0;
  return Math.round(khoiLuong / den);
}

export function normalizeXaNormPayload(raw: unknown): XaNormPayload {
  const base = defaultXaNormPayload();
  if (!raw || typeof raw !== 'object') return base;
  const p = raw as Partial<XaNormPayload>;
  const kich_thuoc_xa = String(p.kich_thuoc_xa ?? base.kich_thuoc_xa);
  const dinh_luong_xuat = String(p.dinh_luong_xuat ?? base.dinh_luong_xuat);
  const dims = dimsFromLabels(kich_thuoc_xa, dinh_luong_xuat);
  return {
    nha_cung_cap: String(p.nha_cung_cap ?? base.nha_cung_cap),
    kich_thuoc_xa,
    dinh_luong_xuat,
    trong_luong_qua: Number(p.trong_luong_qua) || 0,
    so_qua_default: Math.max(0, Math.floor(Number(p.so_qua_default) || 0)),
    ghi_chu_default: String(p.ghi_chu_default ?? base.ghi_chu_default),
    kt1_m: Number(p.kt1_m) || dims.kt1_m,
    kt2_m: Number(p.kt2_m) || dims.kt2_m,
    dinh_luong_kg: Number(p.dinh_luong_kg) || dims.dinh_luong_kg,
  };
}

/** Tạo đúng N dòng Kết quả sản xuất (giữ dữ liệu cũ nếu có). */
export function buildKetQuaRows(
  soQua: number,
  prev: XaKetQuaLine[] = []
): XaKetQuaLine[] {
  const n = Math.max(0, Math.floor(soQua) || 0);
  const next: XaKetQuaLine[] = [];
  for (let i = 0; i < n; i += 1) {
    next.push({ ...emptyKetQuaLine(), ...(prev[i] || {}) });
  }
  return next;
}

export function formatKhoiLuongDisplay(kg: number): string {
  if (!Number.isFinite(kg) || kg === 0) return '';
  return Number.isInteger(kg) ? String(kg) : String(kg);
}
