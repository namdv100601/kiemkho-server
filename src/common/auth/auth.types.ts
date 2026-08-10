export type Role = 'cong_nhan' | 'quan_ly' | 'giam_doc';

export interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  role: Role;
}
