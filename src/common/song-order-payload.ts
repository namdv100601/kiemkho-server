export type SongVatTuLine = {
  vat_tu: string;
  dvt: string;
  ton_dau: string;
  so_luong_dinh_muc: string;
  du_kien_xuat: string;
};

export type SongOrderPayload = {
  nha_cung_cap: string;
  so_luong_yeu_cau: string;
  ngay_du_kien_sx: string;
  kraf_song_gms: string;
  kraf_song_mm: string;
  kraf_mat_gms: string;
  kraf_mat_mm: string;
  buoc_song: string;
  trong_luong: string;
  do_day: string;
  kich_thuoc: string;
  vat_tu_lines: SongVatTuLine[];
};

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

function calcDuKien(tonDau: string, dinhMuc: string, explicit: string): string {
  if (explicit) return explicit;
  const a = Number(String(tonDau).replace(',', '.'));
  const b = Number(String(dinhMuc).replace(',', '.'));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return '';
  const n = b - a;
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000);
}

export function normalizeSongPayload(raw: unknown): SongOrderPayload {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const linesRaw = Array.isArray(src.vat_tu_lines) ? src.vat_tu_lines : [];
  const vat_tu_lines = linesRaw
    .map((line) => {
      const row = (line && typeof line === 'object' ? line : {}) as Record<string, unknown>;
      const ton_dau = str(row.ton_dau);
      const so_luong_dinh_muc = str(row.so_luong_dinh_muc);
      return {
        vat_tu: str(row.vat_tu),
        dvt: str(row.dvt),
        ton_dau,
        so_luong_dinh_muc,
        du_kien_xuat: calcDuKien(ton_dau, so_luong_dinh_muc, str(row.du_kien_xuat)),
      };
    })
    .filter(
      (r) =>
        r.vat_tu || r.dvt || r.ton_dau || r.so_luong_dinh_muc || r.du_kien_xuat
    );

  return {
    nha_cung_cap: str(src.nha_cung_cap),
    so_luong_yeu_cau: str(src.so_luong_yeu_cau),
    ngay_du_kien_sx: str(src.ngay_du_kien_sx),
    kraf_song_gms: str(src.kraf_song_gms),
    kraf_song_mm: str(src.kraf_song_mm),
    kraf_mat_gms: str(src.kraf_mat_gms),
    kraf_mat_mm: str(src.kraf_mat_mm),
    buoc_song: str(src.buoc_song),
    trong_luong: str(src.trong_luong),
    do_day: str(src.do_day),
    kich_thuoc: str(src.kich_thuoc),
    vat_tu_lines,
  };
}
