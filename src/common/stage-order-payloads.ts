import { normalizeSongPayload } from './song-order-payload';

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

function pick(src: Record<string, unknown>, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) out[key] = str(src[key]);
  return out;
}

function normalizeInPayload(raw: unknown) {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const linesRaw = Array.isArray(src.vat_tu_lines) ? src.vat_tu_lines : [];
  const vat_tu_lines = linesRaw
    .map((line) => {
      const row = (line && typeof line === 'object' ? line : {}) as Record<string, unknown>;
      return {
        ten_vat_tu: str(row.ten_vat_tu ?? row.vat_tu),
        don_vi: str(row.don_vi ?? row.dvt),
        so_luong: str(row.so_luong),
        ghi_chu: str(row.ghi_chu),
      };
    })
    .filter((r) => r.ten_vat_tu || r.don_vi || r.so_luong || r.ghi_chu);

  return {
    ...pick(src, [
      'so_mau_in',
      'thu_tu_in',
      'mau_so',
      'tccl_so',
      'tong_sl_giay_xuat',
      'hao_phi_cho_phep',
      'sl_yeu_cau_dat',
      'ngay_du_kien_sx',
    ]),
    vat_tu_lines,
  };
}

function normalizeKcsPayload(raw: unknown) {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return pick(src, ['noi_dung_mau_sac', 'tccl_so', 'tong_sl_kiem_soat']);
}

function normalizeBoiPayload(raw: unknown) {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return pick(src, [
    'so_luong_to_in',
    'loai_song',
    'so_luong_song',
    'keo_boi',
    'so_luong_keo',
    'tccl_so',
    'hao_phi_cho_phep',
    'sl_to_boi_dat',
    'ngay_du_kien_sx',
  ]);
}

function normalizeBePayload(raw: unknown) {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    so_sp_lan_be: str(src.so_sp_lan_be) || '1/1',
    ...pick(src, [
      'kich_thuoc_sp',
      'mau_so',
      'tccl_so',
      'sl_to_boi_du_kien',
      'hao_phi_cho_phep',
      'sl_thanh_pham_dat',
      'ngay_du_kien_sx',
    ]),
  };
}

const NORMALIZERS: Record<string, (raw: unknown) => Record<string, unknown>> = {
  song: (raw) => normalizeSongPayload(raw) as unknown as Record<string, unknown>,
  in: normalizeInPayload,
  kcs: normalizeKcsPayload,
  boi: normalizeBoiPayload,
  be: normalizeBePayload,
};

export function normalizeStagePayload(
  stageCode: string,
  raw: unknown
): Record<string, unknown> | null {
  const fn = NORMALIZERS[stageCode];
  if (!fn) {
    return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  }
  return fn(raw);
}
