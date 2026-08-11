-- Tài khoản mẫu vai trò Thống kê
-- Password: 123456
-- Chạy trên Supabase SQL Editor hoặc psql

INSERT INTO users (username, password_hash, full_name, role)
VALUES (
  'thongke',
  '$2a$10$piTVK03T8WWdhCU9TlzhwusVMh.QNUpeL9hK49gM7Vf0k4A.s5Az.',
  'Thống kê mẫu',
  'thong_ke'
)
ON CONFLICT (username) DO UPDATE
SET
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role;
