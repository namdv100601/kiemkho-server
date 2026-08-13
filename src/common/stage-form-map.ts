/** Map tên khâu → mã biểu mẫu lệnh HABECO */
export const STAGE_FORM_BY_NAME: Record<string, string> = {
  Xả: 'xa',
  Sóng: 'song',
  In: 'in',
  KCS: 'kcs',
  Bồi: 'boi',
  Bế: 'be',
};

export const FORM_CODES = ['xa', 'song', 'in', 'kcs', 'boi', 'be'] as const;
export type FormCode = (typeof FORM_CODES)[number];

export function formCodeForStageName(name?: string | null): string | null {
  if (!name) return null;
  return STAGE_FORM_BY_NAME[name.trim()] ?? null;
}
