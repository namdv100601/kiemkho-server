/** Default + công thức định mức Sóng theo Excel mẫu. */

export type SongKraftSongCfg = {
  so_to: number;
  dinh_luong: number;
  kt1: number;
  kt2: number;
  buoc_song: number;
  hao_phi: number;
};

export type SongKraftMatCfg = {
  so_to: number;
  dinh_luong: number;
  kt1: number;
  kt2: number;
  /** Trống (null) → nhân 1, không hiện số 1 trên form */
  buoc_song?: number | null;
  hao_phi: number;
};

export type SongNormMaterial = {
  name: string;
  unit: string;
  dm_per_1000: number;
};

export type SongNormPayload = {
  paper: {
    kraf_song_label: string;
    kraf_mat_label: string;
    kraf_song_gms: string;
    kraf_song_mm: string;
    kraf_mat_gms: string;
    kraf_mat_mm: string;
  };
  tech: {
    buoc_song: string;
    trong_luong: string;
    do_day: string;
    kich_thuoc: string;
    chieu_doc: string;
  };
  kraft_song: SongKraftSongCfg;
  kraft_mat: SongKraftMatCfg;
  materials: SongNormMaterial[];
};

export function defaultSongNormPayload(): SongNormPayload {
  return {
    paper: {
      kraf_song_label: 'Kraf sóng: 125 gms/1650 mm',
      kraf_mat_label: 'Kraf mặt: 150gms/1650 mm',
      kraf_song_gms: '125',
      kraf_song_mm: '1650',
      kraf_mat_gms: '150',
      kraf_mat_mm: '1650',
    },
    tech: {
      buoc_song: '3 ± 0,1 mm',
      trong_luong: '',
      do_day: '2,1 ± 0,2 mm',
      kich_thuoc: '(820*533) ± 2 mm',
      chieu_doc: 'Theo chiều 820 mm',
    },
    kraft_song: {
      so_to: 200000,
      dinh_luong: 0.125,
      kt1: 0.82,
      kt2: 0.533,
      buoc_song: 1.37,
      hao_phi: 1.05,
    },
    kraft_mat: {
      so_to: 200000,
      dinh_luong: 0.14,
      kt1: 0.82,
      kt2: 0.533,
      buoc_song: null,
      hao_phi: 1.05,
    },
    materials: [
      { name: 'Bột sắn', unit: 'Kg', dm_per_1000: 2.5 },
      { name: 'Sút', unit: 'Kg', dm_per_1000: 0.05 },
      { name: 'Chất kết dính', unit: 'Kg', dm_per_1000: 0.25 },
      { name: 'Hàn the', unit: 'Kg', dm_per_1000: 0.25 },
    ],
  };
}

export function roundKg(n: number, digits = 0): number {
  if (!Number.isFinite(n)) return 0;
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

export function kraftSongKg(cfg: SongKraftSongCfg): number {
  const { so_to, dinh_luong, kt1, kt2, buoc_song, hao_phi } = cfg;
  return roundKg(so_to * dinh_luong * kt1 * kt2 * buoc_song * hao_phi);
}

export function kraftMatKg(cfg: SongKraftMatCfg): number {
  const { so_to, dinh_luong, kt1, kt2, hao_phi } = cfg;
  const buoc =
    cfg.buoc_song == null || !Number.isFinite(Number(cfg.buoc_song))
      ? 1
      : Number(cfg.buoc_song);
  return roundKg(so_to * dinh_luong * kt1 * kt2 * buoc * hao_phi);
}

function optionalBuocSong(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** NVL: số_lượng_tấm × ĐMức/1000sp / 1000 */
export function nvlKg(soLuongTam: number, dmPer1000: number): number {
  return roundKg((soLuongTam * dmPer1000) / 1000);
}

export function normalizeSongNormPayload(raw: unknown): SongNormPayload {
  const base = defaultSongNormPayload();
  if (!raw || typeof raw !== 'object') return base;
  const p = raw as Partial<SongNormPayload>;
  return {
    paper: { ...base.paper, ...(p.paper || {}) },
    tech: { ...base.tech, ...(p.tech || {}) },
    kraft_song: { ...base.kraft_song, ...(p.kraft_song || {}) },
    kraft_mat: {
      ...base.kraft_mat,
      ...(p.kraft_mat || {}),
      buoc_song:
        p.kraft_mat && 'buoc_song' in p.kraft_mat
          ? optionalBuocSong(p.kraft_mat.buoc_song)
          : null,
    },
    materials:
      Array.isArray(p.materials) && p.materials.length
        ? p.materials.map((m) => ({
            name: String(m?.name || ''),
            unit: String(m?.unit || 'Kg'),
            dm_per_1000: Number(m?.dm_per_1000) || 0,
          }))
        : base.materials,
  };
}

/** Tính dòng vật tư lệnh Sóng từ định mức + số lượng tấm.
 * Số tờ Kraft sóng/mặt luôn = số lượng tấm.
 */
export function buildSongVatTuFromNorm(payload: SongNormPayload, soLuongTam: number) {
  const qty = Number.isFinite(soLuongTam) && soLuongTam > 0 ? soLuongTam : 0;
  const songKg = kraftSongKg({ ...payload.kraft_song, so_to: qty });
  const matKg = kraftMatKg({ ...payload.kraft_mat, so_to: qty });
  const gmsSong = payload.paper.kraf_song_gms || '125';
  const mmSong = payload.paper.kraf_song_mm || '1650';
  const gmsMat = payload.paper.kraf_mat_gms || '150';
  const mmMat = payload.paper.kraf_mat_mm || '1650';

  const lines: {
    vat_tu: string;
    dvt: string;
    ton_dau: string;
    so_luong_dinh_muc: string;
    du_kien_xuat: string;
  }[] = [
    {
      vat_tu: `Giấy Kraft sóng gia keo ${gmsSong}/${mmSong}`,
      dvt: 'Kg',
      ton_dau: '',
      so_luong_dinh_muc: String(songKg),
      du_kien_xuat: String(songKg),
    },
    {
      vat_tu: `Giấy Kraft mặt ${gmsMat}/${mmMat}`,
      dvt: 'Kg',
      ton_dau: '',
      so_luong_dinh_muc: String(matKg),
      du_kien_xuat: String(matKg),
    },
  ];

  for (const m of payload.materials) {
    const kg = nvlKg(qty, m.dm_per_1000);
    lines.push({
      vat_tu: m.name,
      dvt: m.unit || 'Kg',
      ton_dau: '',
      so_luong_dinh_muc: String(kg),
      du_kien_xuat: String(kg),
    });
  }

  return { kraft_song_kg: songKg, kraft_mat_kg: matKg, lines };
}

/**
 * Áp định mức theo số lượng tấm yêu cầu.
 * Số tờ Kraft sóng/mặt = số lượng tấm (không scale riêng từng loại).
 */
export function songNormForQuantity(
  payload: SongNormPayload,
  soLuongTam: number,
  _refQty = 200000
) {
  const qty = Number.isFinite(soLuongTam) && soLuongTam > 0 ? soLuongTam : 0;
  return buildSongVatTuFromNorm(payload, qty);
}
