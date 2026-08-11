export type Role = 'cong_nhan' | 'quan_ly' | 'giam_doc' | 'thong_ke';

export interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  role: Role;
}
