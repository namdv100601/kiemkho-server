# server2

NestJS API (v2) + PostgreSQL (Docker). Cùng contract API với `server/` Express + SQLite.

## Chạy

```bash
cp .env.example .env
npm install
npm run db:up    # Postgres Docker
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

Schema tự tạo (`synchronize: true`) và seed khi bảng trống.
