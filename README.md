# server2

NestJS API (v2) + PostgreSQL (Docker). Cùng contract API với `server/` Express + SQLite.

## Chạy

```bash
cp .env.example .env
npm install
npm run db:up    # Postgres Docker (local)
npm run seed     # chỉ khi cần nạp dữ liệu mẫu (không chạy khi start/dev)
npm run dev      # http://localhost:3000
```

- API: http://localhost:3000  
- Swagger UI: http://localhost:3000/api/docs  

## Env

| Biến | Mặc định |
|------|----------|
| `PORT` | `3000` |
| `JWT_SECRET` | `nhamay-pmkiemke-secret-change-me` |
| `DATABASE_HOST` | `localhost` |
| `DATABASE_PORT` | `5432` |
| `DATABASE_USER` | `pmkiemke` |
| `DATABASE_PASSWORD` | `pmkiemke` |
| `DATABASE_NAME` | `pmkiemke` |
| `TYPEORM_SYNCHRONIZE` / `DATABASE_SYNC` | `true` (`true`/`1`/`yes`/`on` = bật; `false`/`0`/`no`/`off` = tắt) |

`npm run start` / `npm run dev` **không** tự seed. Chạy seed thủ công:

```bash
npm run seed
```
