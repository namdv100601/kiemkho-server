/** Định mức In / KCS / Bồi / Bế — lấy từ Excel «Hộp bia thường 24 lon - 27». */

export type StageFormCode = 'in' | 'kcs' | 'boi' | 'be';

export type StageFormMaterial = {
  name: string;
  unit: string;
  /** Số lượng định mức (để trống nếu chưa nhập) */
  so_luong: number | null;
};

export type InNormPayload = {
  so_mau_in: string;
  thu_tu_in: string;
  mau_so: string;
  /** Hao phí cho phép (tờ) tại mức tham chiếu — scale theo tỷ lệ SL / ref */
  hao_phi_to: number;
  ref_so_luong: number | null;
  materials: StageFormMaterial[];
};

export type KcsNormPayload = {
  noi_dung_mau_sac: string;
  tccl_so: string;
  ghi_chu_kiem_soat: string;
  /** Thường lấy từ SL đạt của In; lưu mặc định / hệ số nếu cần */
  ref_so_luong: number | null;
};

export type BoiNormPayload = {
  loai_song: string;
  tccl: string;
  /** Hao phí % (0.3 = 0.3%) */
  hao_phi_percent: number;
  ref_so_luong: number | null;
  /** Keo bồi Kg / 1000 tờ in */
  keo_boi_dm_per_1000: number;
  materials: StageFormMaterial[];
};

export type BeNormPayload = {
  so_sp_lan_be: string;
  kich_thuoc_hop: string;
  mau_tccl: string;
  hao_phi_percent: number;
  ref_so_luong: number | null;
};

export type StageFormNormPayload =
  | InNormPayload
  | KcsNormPayload
  | BoiNormPayload
  | BeNormPayload;

export function roundN(n: number, digits = 6): number {
  if (!Number.isFinite(n)) return 0;
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

function mat(name: string, unit: string): StageFormMaterial {
  return { name, unit, so_luong: null };
}

export function defaultInNormPayload(): InNormPayload {
  return {
    so_mau_in: '04',
    thu_tu_in: 'Đen - Đỏ - Vàng - Đỏ pha - Phủ bóng',
    mau_so: '01/H03/QM',
    hao_phi_to: 900,
    ref_so_luong: null,
    materials: [
      mat('Duplex 230/825*541', 'Tờ'),
      mat('Bản in', 'Tấm'),
      mat('Mực in offset màu đen', 'Kg'),
      mat('Mực in offset màu vàng', 'Kg'),
      mat('Mực in offset màu đỏ sen', 'Kg'),
      mat('Mực in offset màu đỏ cờ', 'Kg'),
      mat('Dầu pha mực', 'Kg'),
      mat('Nước tiết kiệm cồn stabilat', 'Lít'),
      mat('Cồn IPA', 'Lít'),
      mat('Dung dịch rửa lô', 'Lít'),
      mat('Chất phủ bóng', 'Kg'),
    ],
  };
}

export function defaultKcsNormPayload(): KcsNormPayload {
  return {
    noi_dung_mau_sac: 'Theo mẫu',
    tccl_so: '',
    ghi_chu_kiem_soat: 'Chi tiết trong Phiếu Y/c kiểm soát',
    ref_so_luong: null,
  };
}

export function defaultBoiNormPayload(): BoiNormPayload {
  return {
    loai_song: 'Sóng E 818*534mm',
    tccl: '01/H04/QM',
    hao_phi_percent: 0.3,
    ref_so_luong: null,
    keo_boi_dm_per_1000: 0,
    materials: [
      mat('Tờ in', 'Tờ'),
      mat('Sóng E 818*534mm', 'Tấm'),
      mat('Keo bồi', 'Kg'),
    ],
  };
}

export function defaultBeNormPayload(): BeNormPayload {
  return {
    so_sp_lan_be: '1/1',
    kich_thuoc_hop: '403*268.5*117.5 mm',
    mau_tccl: '01 - TCCL số 01/H04/QM',
    hao_phi_percent: 0.3,
    ref_so_luong: null,
  };
}

export function defaultPayloadFor(code: StageFormCode): StageFormNormPayload {
  if (code === 'in') return defaultInNormPayload();
  if (code === 'kcs') return defaultKcsNormPayload();
  if (code === 'boi') return defaultBoiNormPayload();
  return defaultBeNormPayload();
}

function parseNullableQty(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function normalizeMaterial(raw: unknown): StageFormMaterial {
  const m = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  // Hỗ trợ payload cũ: qty_fixed / dm_per_1000
  let soLuong = parseNullableQty(m.so_luong);
  if (soLuong == null && m.fixed && m.qty_fixed != null) {
    soLuong = parseNullableQty(m.qty_fixed);
  }
  return {
    name: String(m.name || ''),
    unit: String(m.unit || 'Kg'),
    so_luong: soLuong,
  };
}

export function normalizeStageFormNormPayload(
  code: StageFormCode,
  raw: unknown
): StageFormNormPayload {
  const base = defaultPayloadFor(code);
  if (!raw || typeof raw !== 'object') return base;
  const p = raw as Record<string, unknown>;

  if (code === 'in') {
    const b = base as InNormPayload;
    return {
      so_mau_in: String(p.so_mau_in ?? b.so_mau_in),
      thu_tu_in: String(p.thu_tu_in ?? b.thu_tu_in),
      mau_so: String(p.mau_so ?? b.mau_so),
      hao_phi_to: Number(p.hao_phi_to) || b.hao_phi_to,
      ref_so_luong:
        p.ref_so_luong === undefined ? b.ref_so_luong : parseNullableQty(p.ref_so_luong),
      materials: Array.isArray(p.materials)
        ? p.materials.map(normalizeMaterial)
        : b.materials,
    };
  }

  if (code === 'kcs') {
    const b = base as KcsNormPayload;
    return {
      noi_dung_mau_sac: String(p.noi_dung_mau_sac ?? b.noi_dung_mau_sac),
      tccl_so: String(p.tccl_so ?? b.tccl_so),
      ghi_chu_kiem_soat: String(p.ghi_chu_kiem_soat ?? b.ghi_chu_kiem_soat),
      ref_so_luong:
        p.ref_so_luong === undefined ? b.ref_so_luong : parseNullableQty(p.ref_so_luong),
    };
  }

  if (code === 'boi') {
    const b = base as BoiNormPayload;
    return {
      loai_song: String(p.loai_song ?? b.loai_song),
      tccl: String(p.tccl ?? b.tccl),
      hao_phi_percent: Number(p.hao_phi_percent) || b.hao_phi_percent,
      ref_so_luong:
        p.ref_so_luong === undefined ? b.ref_so_luong : parseNullableQty(p.ref_so_luong),
      keo_boi_dm_per_1000: Number(p.keo_boi_dm_per_1000) || b.keo_boi_dm_per_1000,
      materials: Array.isArray(p.materials)
        ? p.materials.map(normalizeMaterial)
        : b.materials,
    };
  }

  const b = base as BeNormPayload;
  return {
    so_sp_lan_be: String(p.so_sp_lan_be ?? b.so_sp_lan_be),
    kich_thuoc_hop: String(p.kich_thuoc_hop ?? b.kich_thuoc_hop),
    mau_tccl: String(p.mau_tccl ?? b.mau_tccl),
    hao_phi_percent: Number(p.hao_phi_percent) || b.hao_phi_percent,
    ref_so_luong:
      p.ref_so_luong === undefined ? b.ref_so_luong : parseNullableQty(p.ref_so_luong),
  };
}

export function haoPhiTo(refHao: number, refQty: number, soLuong: number): number {
  if (!refQty) return 0;
  return Math.round((refHao * soLuong) / refQty);
}

export function haoPhiPercentTo(percent: number, soLuong: number): number {
  return Math.round((soLuong * percent) / 100);
}

export const STAGE_FORM_LABELS: Record<StageFormCode, string> = {
  in: 'In',
  kcs: 'KCS',
  boi: 'Bồi',
  be: 'Bế',
};

function qtyStr(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return '';
  return String(v);
}

function findMat(
  materials: StageFormMaterial[],
  pred: (name: string) => boolean
): StageFormMaterial | undefined {
  return materials.find((m) => pred(m.name.trim().toLowerCase()));
}

/** Map định mức → payload lệnh (In / KCS / Bồi / Bế) để auto-fill form. */
export function orderPayloadFromStageNorm(
  code: StageFormCode,
  raw: unknown
): Record<string, unknown> {
  const p = normalizeStageFormNormPayload(code, raw);

  if (code === 'in') {
    const n = p as InNormPayload;
    const ref = n.ref_so_luong;
    const hao =
      ref != null && ref > 0 ? haoPhiTo(n.hao_phi_to, ref, ref) : n.hao_phi_to || null;
    const dat =
      ref != null && hao != null ? Math.max(0, Math.round(ref - hao)) : null;
    return {
      so_mau_in: n.so_mau_in || '',
      thu_tu_in: n.thu_tu_in || '',
      mau_so: n.mau_so || '',
      tccl_so: n.mau_so || '',
      tong_sl_giay_xuat: qtyStr(ref),
      hao_phi_cho_phep: qtyStr(hao),
      sl_yeu_cau_dat: qtyStr(dat),
      vat_tu_lines: n.materials.map((m) => ({
        ten_vat_tu: m.name || '',
        don_vi: m.unit || '',
        so_luong: qtyStr(m.so_luong),
        ghi_chu: '',
      })),
    };
  }

  if (code === 'kcs') {
    const n = p as KcsNormPayload;
    return {
      noi_dung_mau_sac: n.noi_dung_mau_sac || '',
      tccl_so: n.tccl_so || '',
      tong_sl_kiem_soat:
        n.ref_so_luong != null
          ? qtyStr(n.ref_so_luong)
          : n.ghi_chu_kiem_soat || '',
    };
  }

  if (code === 'boi') {
    const n = p as BoiNormPayload;
    const toIn = findMat(n.materials, (name) => name.includes('tờ in') || name === 'tờ in');
    const song = findMat(
      n.materials,
      (name) => name.includes('sóng') || name.includes('song')
    );
    const keo = findMat(n.materials, (name) => name.includes('keo'));
    const ref =
      n.ref_so_luong ??
      toIn?.so_luong ??
      song?.so_luong ??
      null;
    const hao =
      ref != null ? haoPhiPercentTo(n.hao_phi_percent, ref) : null;
    const dat = ref != null && hao != null ? Math.max(0, Math.round(ref - hao)) : null;
    return {
      so_luong_to_in: qtyStr(toIn?.so_luong ?? ref),
      loai_song: n.loai_song || song?.name || '',
      so_luong_song: qtyStr(song?.so_luong ?? ref),
      keo_boi: keo?.name || 'Keo bồi',
      so_luong_keo: qtyStr(keo?.so_luong),
      tccl_so: n.tccl || '',
      hao_phi_cho_phep:
        n.hao_phi_percent != null ? `${n.hao_phi_percent}%` : '',
      sl_to_boi_dat: qtyStr(dat),
    };
  }

  const n = p as BeNormPayload;
  const ref = n.ref_so_luong;
  const hao = ref != null ? haoPhiPercentTo(n.hao_phi_percent, ref) : null;
  const dat = ref != null && hao != null ? Math.max(0, Math.round(ref - hao)) : null;
  const mau = n.mau_tccl || '';
  const tcclMatch = mau.match(/TCCL\s*số\s*(.+)$/i);
  return {
    so_sp_lan_be: n.so_sp_lan_be || '1/1',
    kich_thuoc_sp: n.kich_thuoc_hop || '',
    mau_so: tcclMatch ? mau.replace(/\s*-\s*TCCL.*/i, '').trim() : mau,
    tccl_so: tcclMatch ? tcclMatch[1].trim() : '',
    sl_to_boi_du_kien: qtyStr(ref),
    hao_phi_cho_phep:
      n.hao_phi_percent != null ? `${n.hao_phi_percent}%` : '',
    sl_thanh_pham_dat: qtyStr(dat),
  };
}
